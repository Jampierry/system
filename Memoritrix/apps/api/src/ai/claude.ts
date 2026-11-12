import type { AiInput, AiProvider, AiResult, ChatMessage } from './provider';

export interface AnthropicLike {
  messages: { create(args: any, opts?: any): Promise<any> };
}

function toApiMessages(messages: ChatMessage[]): any[] {
  return messages.map(m => {
    if (m.role === 'user' && m.imageBase64) {
      return {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: m.imageMime ?? 'image/jpeg', data: m.imageBase64 } },
          { type: 'text', text: m.content || 'Veja esta imagem.' },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
}

const textOf = (content: any[]): string => content.filter(b => b.type === 'text').map(b => b.text).join('').trim();

export class ClaudeProvider implements AiProvider {
  readonly mode = 'claude' as const;
  constructor(private client: AnthropicLike, private model: string, private maxSteps = 5, private timeoutMs = 30_000) {}

  async respond(input: AiInput): Promise<AiResult> {
    const msgs = toApiMessages(input.messages);
    let lastText = '';
    for (let step = 0; step < this.maxSteps; step++) {
      const resp = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: 1500,
          system: input.system,
          messages: msgs,
          ...(input.tools.length ? { tools: input.tools } : {}),
        },
        { timeout: this.timeoutMs },
      );
      const content: any[] = resp.content ?? [];
      lastText = textOf(content) || lastText;
      if (resp.stop_reason !== 'tool_use') return { text: textOf(content) };
      msgs.push({ role: 'assistant', content });
      const results = [];
      for (const b of content.filter(c => c.type === 'tool_use')) {
        results.push({ type: 'tool_result', tool_use_id: b.id, content: await input.runTool(b.name, b.input) });
      }
      msgs.push({ role: 'user', content: results });
    }
    return { text: lastText || 'Não consegui concluir o pedido. Tente reformular.' };
  }
}
