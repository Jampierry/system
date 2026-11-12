import { z } from 'zod';
import type { Deps } from '../../deps';
import type { AiProvider } from '../../ai/provider';

export type Suggestion = { itemId: string; title: string; status: 'next' | 'waiting' | 'someday'; kind: string; dueAt: string | null; reason: string };

const modelItem = z.object({
  itemId: z.string(),
  status: z.enum(['next', 'waiting', 'someday']),
  kind: z.enum(['task', 'event', 'idea', 'checklist', 'project']).optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  reason: z.string().max(300).default(''),
});

const at = (d: Date, plusDays: number) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + plusDays, 12, 0, 0));
  return x.toISOString();
};

/** Classificação por palavras-chave (modo demo e fallback do modo Claude). */
export function heuristic(item: { id: string; title: string; kind: string }, now: Date): Suggestion {
  const t = item.title.toLowerCase();
  let status: Suggestion['status'] = 'next';
  let kind = item.kind;
  let reason = 'Parece uma ação concreta que pode ser feita em seguida.';
  if (/\b(aguard\w*|esperar|esperando|cobrar|depende d\w+)\b/.test(t)) { status = 'waiting'; reason = 'Depende de uma resposta ou ação de outra pessoa.'; }
  else if (/\b(talvez|algum dia|quem sabe|um dia)\b/.test(t)) { status = 'someday'; reason = 'Sem urgência: guarde para revisar depois.'; }
  else if (/\bprojeto\b/.test(t)) { kind = 'project'; reason = 'Parece um projeto com vários passos.'; }
  let dueAt: string | null = null;
  if (/(?<![\p{L}\p{N}])amanh[ãa](?![\p{L}\p{N}])/u.test(t)) dueAt = at(now, 1);
  else if (/\bhoje\b/.test(t)) dueAt = at(now, 0);
  if (dueAt && status === 'next') reason += ' Data sugerida a partir do texto.';
  return { itemId: item.id, title: item.title, status, kind, dueAt, reason };
}

export async function suggestInbox(
  deps: Deps, userId: string, provider: AiProvider, call: (p: AiProvider, run: () => Promise<string>) => Promise<string>,
): Promise<{ suggestions: Suggestion[]; mode: 'demo' | 'claude' }> {
  const items = deps.db.prepare("select id, title, kind from items where user_id=? and status='inbox' order by created_at, rowid").all(userId) as { id: string; title: string; kind: string }[];
  const now = deps.now();
  const base = new Map(items.map(i => [i.id, heuristic(i, now)]));
  let mode: 'demo' | 'claude' = 'demo';
  if (items.length && provider.mode === 'claude') {
    try {
      const prompt =
        `Classifique cada item da caixa de entrada (método GTD). Responda SOMENTE com um array JSON de objetos ` +
        `{"itemId","status":"next|waiting|someday","kind":"task|event|idea|checklist|project","dueAt":"ISO 8601 ou null","reason":"curta, em português"}.\n` +
        `Hoje: ${now.toISOString().slice(0, 10)}.\nItens:\n` + items.map(i => `- ${i.id}: ${i.title}`).join('\n');
      const text = await call(provider, async () => (await provider.respond({ system: 'Você organiza tarefas pelo método GTD.', messages: [{ role: 'user', content: prompt }], tools: [], runTool: async () => '{}' })).text);
      const m = /\[[\s\S]*\]/.exec(text);
      const arr: unknown = m ? JSON.parse(m[0]) : null;
      if (Array.isArray(arr)) {
        for (const raw of arr) {
          const r = modelItem.safeParse(raw);
          const it = r.success ? items.find(i => i.id === r.data.itemId) : undefined;
          if (!r.success || !it) continue;
          base.set(it.id, { itemId: it.id, title: it.title, status: r.data.status, kind: r.data.kind ?? it.kind, dueAt: r.data.dueAt ?? null, reason: r.data.reason });
          mode = 'claude';
        }
      }
    } catch { /* mantém a heurística */ }
  }
  return { suggestions: items.map(i => base.get(i.id)!), mode };
}
