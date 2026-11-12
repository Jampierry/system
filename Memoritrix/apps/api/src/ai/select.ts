import Anthropic from '@anthropic-ai/sdk';
import type { Config } from '../config';
import { ClaudeProvider, type AnthropicLike } from './claude';
import { DemoProvider } from './demo';
import type { AiProvider } from './provider';

export const CLAUDE_MODEL = 'claude-sonnet-5-5';

/** Claude real se houver ANTHROPIC_API_KEY; senão modo demo. A chave nunca sai do servidor. */
export function selectProvider(cfg: Config, createClient?: (apiKey: string) => AnthropicLike): AiProvider {
  if (!cfg.anthropicKey) return new DemoProvider();
  const client = createClient ? createClient(cfg.anthropicKey) : (new Anthropic({ apiKey: cfg.anthropicKey }) as unknown as AnthropicLike);
  return new ClaudeProvider(client, CLAUDE_MODEL);
}
