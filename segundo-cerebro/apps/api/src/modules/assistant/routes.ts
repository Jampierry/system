import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { parseNote } from '@cerebro/shared';
import { fail } from '../../errors';
import { requirePermission, requireUser } from '../auth/guard';
import { DemoProvider, demoOutline } from '../../ai/demo';
import { selectProvider } from '../../ai/select';
import type { AiProvider, ChatMessage } from '../../ai/provider';
import { buildTools, loadOwnedMap, type ToolCtx } from '../../ai/tools';
import { updateItem } from '../items/repo';
import { buildSystem, getSettings, saveSettings, settingsSchema } from './settings';
import { suggestInbox } from './process-inbox';

const MAX_IMAGE_B64 = 7 * 1024 * 1024;
const chatSchema = z.object({
  message: z.string().trim().min(1, 'Escreva uma mensagem').max(8000),
  conversationId: z.string().optional(),
  imageBase64: z.string().optional(),
  imageMime: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']).optional(),
});

export async function assistantRoutes(app: FastifyInstance) {
  const deps = app.deps;
  const { db } = deps;
  const read = requireUser(app);
  const use = requirePermission(app, 'assistant.use');
  let cached: AiProvider | undefined;
  const provider = () => (cached ??= deps.ai ?? selectProvider(deps.cfg));
  const timeoutMs = () => deps.aiTimeoutMs ?? 30_000;

  /** Executa `fn` com limite de tempo. */
  async function withTimeout<T>(fn: () => Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([fn(), new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error('Tempo esgotado na IA')), timeoutMs()); })]);
    } finally {
      clearTimeout(timer);
    }
  }
  const timed = (_p: AiProvider, run: () => Promise<string>) => withTimeout(run);

  /** Roda o provider com ferramentas; em falha/timeout cai no modo demo. */
  async function runWithFallback(
    ctx: ToolCtx,
    build: (tools: ReturnType<typeof buildTools>) => Parameters<AiProvider['respond']>[0],
    demoFallback = true,
  ) {
    const used: { name: string; ok: boolean }[] = [];
    const tools = buildTools(ctx);
    const wrapped = { defs: tools.defs, run: async (name: string, args: unknown) => {
      const out = await tools.run(name, args);
      let ok = true;
      try { ok = !JSON.parse(out).error; } catch { /* ok */ }
      used.push({ name, ok });
      return out;
    } };
    const input = build({ defs: wrapped.defs, run: wrapped.run });
    const p = provider();
    // Sem Claude e sem fallback pedido (ações estruturadas), quem chama usa o caminho determinístico.
    if (p.mode === 'demo' && !demoFallback) return { text: '', mode: 'demo' as const, fallback: false, used, tools: wrapped };
    try {
      const r = await withTimeout(() => p.respond(input));
      return { text: r.text, mode: p.mode, fallback: false, used, tools: wrapped };
    } catch {
      used.length = 0;
      if (!demoFallback) return { text: '', mode: 'demo' as const, fallback: true, used, tools: wrapped };
      try {
        const r = await new DemoProvider().respond(input);
        return { text: r.text, mode: 'demo' as const, fallback: p.mode !== 'demo', used, tools: wrapped };
      } catch {
        return { text: 'Desculpe, tive um problema para responder agora.', mode: 'demo' as const, fallback: true, used, tools: wrapped };
      }
    }
  }

  app.get('/api/assistant/mode', { preHandler: read }, async () => ({ mode: provider().mode }));

  app.get('/api/assistant/settings', { preHandler: read }, async (req) => ({ settings: getSettings(deps, req.user!.id) }));
  app.put('/api/assistant/settings', { preHandler: read }, async (req) => ({
    settings: saveSettings(deps, req.user!.id, settingsSchema.partial().parse(req.body)),
  }));

  app.post('/api/assistant/chat', { preHandler: use }, async (req) => {
    const b = chatSchema.parse(req.body);
    if (b.imageBase64 && b.imageBase64.length > MAX_IMAGE_B64) fail(413, 'IMAGE_TOO_LARGE', 'Imagem grande demais (máx. ~5 MB)');
    if (b.imageBase64 && !b.imageMime) fail(400, 'VALIDATION', 'Informe imageMime');
    const user = req.user!;
    let convId = b.conversationId;
    if (convId) {
      if (!db.prepare('select 1 from conversations where id=? and user_id=?').get(convId, user.id)) fail(404, 'NOT_FOUND', 'Conversa não encontrada');
    } else {
      convId = randomUUID();
      db.prepare('insert into conversations(id,user_id,created_at) values(?,?,?)').run(convId, user.id, deps.now().toISOString());
    }
    const save = (role: string, content: unknown) =>
      db.prepare('insert into messages(id,conversation_id,role,content_json,created_at) values(?,?,?,?,?)').run(randomUUID(), convId, role, JSON.stringify(content), deps.now().toISOString());
    save('user', { text: b.message, hasImage: !!b.imageBase64 }); // salva antes de chamar a IA: nunca se perde

    const rows = db.prepare('select role, content_json from messages where conversation_id=? order by rowid desc limit 20').all(convId) as { role: 'user' | 'assistant'; content_json: string }[];
    const history: ChatMessage[] = rows.reverse().map(r => ({ role: r.role, content: JSON.parse(r.content_json).text ?? '' }));
    if (b.imageBase64) Object.assign(history[history.length - 1], { imageBase64: b.imageBase64, imageMime: b.imageMime });

    const settings = getSettings(deps, user.id);
    const out = await runWithFallback({ deps, userId: user.id, permissions: user.permissions }, tools => ({
      system: buildSystem(settings, user.name, deps.now()), messages: history, tools: tools.defs, runTool: tools.run,
    }));
    save('assistant', { text: out.text, tools: out.used });
    return {
      conversationId: convId, reply: { text: out.text }, mode: out.mode, fallback: out.fallback, toolsUsed: out.used,
      settings: { replyMode: settings.replyMode, language: settings.language, rate: settings.rate, voice: settings.voice },
    };
  });

  app.get('/api/assistant/history', { preHandler: use }, async (req) => {
    const q = req.query as { conversationId?: string };
    const uid = req.user!.id;
    const conv = (q.conversationId
      ? db.prepare('select id from conversations where id=? and user_id=?').get(q.conversationId, uid)
      : db.prepare('select id from conversations where user_id=? order by created_at desc, rowid desc limit 1').get(uid)) as { id: string } | undefined;
    if (q.conversationId && !conv) fail(404, 'NOT_FOUND', 'Conversa não encontrada');
    if (!conv) return { conversationId: null, messages: [] };
    const rows = db.prepare('select role, content_json, created_at from messages where conversation_id=? order by rowid').all(conv.id) as any[];
    return { conversationId: conv.id, messages: rows.map(r => ({ role: r.role, text: JSON.parse(r.content_json).text, at: r.created_at })) };
  });

  // Processar caixa de entrada
  app.post('/api/assistant/process-inbox', { preHandler: use }, async (req) => suggestInbox(deps, req.user!.id, provider(), timed));

  app.post('/api/assistant/process-inbox/apply', { preHandler: requirePermission(app, 'items.write') }, async (req) => {
    const { changes } = z.object({
      changes: z.array(z.object({
        itemId: z.string(),
        status: z.enum(['inbox', 'next', 'waiting', 'someday']),
        kind: z.enum(['task', 'event', 'idea', 'checklist', 'project']).optional(),
        dueAt: z.string().datetime({ offset: true }).nullable().optional(),
        waitingOn: z.string().nullable().optional(),
      })).max(500),
    }).parse(req.body);
    let applied = 0;
    let skipped = 0;
    deps.db.transaction(() => {
      for (const c of changes) {
        try {
          const { itemId, ...patch } = c;
          updateItem(deps, req.user!.id, itemId, patch);
          applied++;
        } catch { skipped++; }
      }
    })();
    return { applied, skipped };
  });

  // Mapa mental com IA
  const mapGuard = async (req: any) => {
    await use(req);
    if (!req.user.permissions.includes('notes.write')) fail(403, 'FORBIDDEN', 'Sem permissão para editar mapas');
  };

  app.post('/api/assistant/mindmap/expand', { preHandler: mapGuard }, async (req) => {
    const b = z.object({ mindmapId: z.string(), nodeId: z.string() }).parse(req.body);
    const ctx: ToolCtx = { deps, userId: req.user!.id, permissions: req.user!.permissions };
    let map;
    try { map = loadOwnedMap(ctx, b.mindmapId).map; } catch { fail(404, 'NOT_FOUND', 'Mapa não encontrado'); }
    const node = map!.nodes[b.nodeId];
    if (!node) fail(404, 'NOT_FOUND', 'Nó não encontrado');
    const path: string[] = [];
    for (let n: typeof node | undefined = node; n; n = n.parentId ? map!.nodes[n.parentId] : undefined) path.unshift(n.text);

    let added = 0;
    const out = await runWithFallback(ctx, tools => ({
      system: 'Você ajuda a expandir mapas mentais com sub-tópicos curtos e úteis, em português.',
      messages: [{ role: 'user', content: `Expanda este ramo chamando a ferramenta expandir_ramo com ${JSON.stringify({ mindmapId: b.mindmapId, nodeId: b.nodeId })} e de 3 a 6 "filhos" curtos. Caminho do ramo: ${path.join(' > ')}.` }],
      tools: tools.defs.filter(d => d.name === 'expandir_ramo'),
      runTool: async (name, args) => {
        const r = await tools.run(name, args);
        try { added += JSON.parse(r).added ?? 0; } catch { /* ignora */ }
        return r;
      },
    }), false);
    if (added === 0) {
      const t = node.text.slice(0, 60);
      const r = JSON.parse(await buildTools(ctx).run('expandir_ramo', { mindmapId: b.mindmapId, nodeId: b.nodeId, filhos: [`${t} — conceito`, `${t} — exemplos`, `${t} — próximos passos`] }));
      if (r.error) fail(400, 'EXPAND_FAILED', r.error);
      added = r.added;
      return { added, mode: 'demo' };
    }
    return { added, mode: out.mode };
  });

  app.post('/api/assistant/mindmap/generate', { preHandler: mapGuard }, async (req) => {
    const b = z.object({ topic: z.string().trim().min(1).max(200).optional(), noteId: z.string().optional() })
      .refine(v => v.topic || v.noteId, 'Informe um tema ou uma nota').parse(req.body);
    const uid = req.user!.id;
    let topic = b.topic ?? '';
    let source = '';
    let headings: string[] = [];
    if (b.noteId) {
      const n = db.prepare('select title, body_md from notes where id=? and user_id=?').get(b.noteId, uid) as { title: string; body_md: string } | undefined;
      if (!n) fail(404, 'NOT_FOUND', 'Nota não encontrada');
      topic ||= n!.title;
      source = n!.body_md.slice(0, 8000);
      headings = parseNote(n!.body_md).headings.filter(h => h.level >= 2).map(h => h.text).slice(0, 8);
    }
    const ctx: ToolCtx = { deps, userId: uid, permissions: req.user!.permissions };
    let mindmapId = '';
    const out = await runWithFallback(ctx, tools => ({
      system: 'Você cria mapas mentais claros e hierárquicos (até 3 níveis, textos curtos), em português.',
      messages: [{ role: 'user', content: `Crie um mapa mental sobre "${topic}" chamando a ferramenta gerar_mapa com titulo e outline em Markdown.${source ? `\nBase o mapa neste conteúdo:\n${source}` : ''}` }],
      tools: tools.defs.filter(d => d.name === 'gerar_mapa'),
      runTool: async (name, args) => {
        const r = await tools.run(name, args);
        try { mindmapId = JSON.parse(r).mindmapId ?? mindmapId; } catch { /* ignora */ }
        return r;
      },
    }), false);
    if (!mindmapId) {
      const outline = headings.length ? `# ${topic}\n` + headings.map(h => `- ${h}\n`).join('') : demoOutline(topic);
      const r = JSON.parse(await buildTools(ctx).run('gerar_mapa', { titulo: topic, outline }));
      if (r.error) fail(400, 'GENERATE_FAILED', r.error);
      return { mindmapId: r.mindmapId, mode: 'demo' };
    }
    return { mindmapId, mode: out.mode };
  });
}
