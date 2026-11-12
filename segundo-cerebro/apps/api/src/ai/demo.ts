import type { AiInput, AiProvider, AiResult } from './provider';

const HELP =
  'Estou no modo demo (sem ANTHROPIC_API_KEY). Experimente: "anota: comprar pão", "nota: ideias de livro", ' +
  '"o que tenho na agenda?", "procure lisboa" ou "mapa mental sobre viagem".';

const safeJson = (s: string): any => { try { return JSON.parse(s); } catch { return {}; } };

/** Assistente simulado e determinístico: entende alguns comandos em pt-BR e usa as mesmas ferramentas. */
export class DemoProvider implements AiProvider {
  readonly mode = 'demo' as const;

  async respond(input: AiInput): Promise<AiResult> {
    const last = [...input.messages].reverse().find(m => m.role === 'user');
    const text = (last?.content ?? '').trim();
    const call = async (name: string, args: unknown) => safeJson(await input.runTool(name, args));
    const fail = (r: any) => `Não consegui: ${r.error}`;

    if (last?.imageBase64) {
      const title = text || 'Foto capturada';
      const r = await call('criar_item', { title, body: '(imagem recebida no modo demo)' });
      return {
        text: r.error
          ? fail(r)
          : `Salvei na caixa de entrada: "${title}". (Modo demo: não consigo ler a imagem. Configure ANTHROPIC_API_KEY para ativar a leitura de fotos.)`,
      };
    }

    let m = /^\s*(?:anota|anotar|lembre|lembrar|adicione|adicionar|tarefa)\b\s*:?\s*(.+)$/is.exec(text);
    if (m) {
      const r = await call('criar_item', { title: m[1].trim() });
      return { text: r.error ? fail(r) : `Anotado na caixa de entrada: "${m[1].trim()}".` };
    }
    m = /^\s*(?:nota|crie uma nota|criar nota)\b\s*:?\s*(.+)$/is.exec(text);
    if (m) {
      const r = await call('criar_nota', { title: m[1].trim() });
      return { text: r.error ? fail(r) : `Criei a nota "${m[1].trim()}".` };
    }
    if (/\b(agenda|compromissos|calend[aá]rio)\b/i.test(text)) {
      const r = await call('listar_agenda', {});
      if (r.error) return { text: fail(r) };
      const items: any[] = r.items ?? [];
      return { text: items.length ? 'Próximos compromissos: ' + items.slice(0, 5).map(i => i.title).join('; ') + '.' : 'Você não tem compromissos nos próximos dias.' };
    }
    m = /^\s*(?:busca|buscar|procure|procurar|encontre|pesquise)\s+(.+)$/is.exec(text);
    if (m) {
      const r = await call('buscar', { q: m[1].trim() });
      if (r.error) return { text: fail(r) };
      const titles = [...(r.notes ?? []), ...(r.items ?? [])].map((x: any) => x.title);
      return { text: titles.length ? `Encontrei: ${titles.slice(0, 5).join('; ')}.` : 'Não encontrei nada com esse termo.' };
    }
    m = /mapa mental (?:sobre|de|do|da)\s+(.+)$/is.exec(text);
    if (m) {
      const tema = m[1].trim();
      const r = await call('gerar_mapa', { titulo: tema, outline: demoOutline(tema) });
      return { text: r.error ? fail(r) : `Criei um mapa mental sobre "${tema}".` };
    }
    return { text: HELP };
  }
}

export function demoOutline(tema: string): string {
  const secoes = ['Ideias principais', 'Passos', 'Recursos', 'Riscos', 'Perguntas em aberto'];
  return `# ${tema}\n` + secoes.map(s => `- ${s}\n  - ${s}: item 1\n  - ${s}: item 2\n`).join('');
}
