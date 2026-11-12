import { describe, it, expect } from 'vitest';
import { createMap } from '@cerebro/shared';
import { makeApp, createUser, loginAs, bearer, type TestCtx } from '../../test-utils';
import type { AiProvider } from '../../ai/provider';

const api = (c: TestCtx, method: string, url: string, headers: any, payload?: any) => c.app.inject({ method: method as any, url, headers, payload });

async function setup(extra: any = {}) {
  const c = await makeApp(extra);
  await createUser(c.db, { email: 'a@x.com' });
  await createUser(c.db, { email: 'b@x.com' });
  await createUser(c.db, { email: 'r@x.com', profile: 'readonly' });
  await c.db.prepare("update profiles set permissions_json='[]' where id='sys-readonly'").run();
  return { ...c, A: bearer(await loginAs(c.app, 'a@x.com')), B: bearer(await loginAs(c.app, 'b@x.com')), R: bearer(await loginAs(c.app, 'r@x.com')) };
}
type S = Awaited<ReturnType<typeof setup>>;
const chat = (c: S, payload: any, h = c.A) => api(c, 'POST', '/api/assistant/chat', h, payload);
const fake = (fn: AiProvider['respond'], mode: 'claude' | 'demo' = 'claude'): AiProvider => ({ mode, respond: fn });

describe('chat', () => {
  it('modo demo: "anota: comprar pão" cria item e responde', async () => {
    const c = await setup();
    const r = await chat(c, { message: 'anota: comprar pão' });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.mode).toBe('demo');
    expect(j.reply.text).toContain('comprar pão');
    expect(j.toolsUsed).toEqual([{ name: 'criar_item', ok: true }]);
    expect(c.db.prepare("select count(*) c from items where title='comprar pão' and status='inbox'").get()).toEqual({ c: 1 });
    expect(c.db.prepare('select count(*) c from messages').get()).toEqual({ c: 2 });
  });

  it('continua a mesma conversa; conversa de outro usuário → 404', async () => {
    const c = await setup();
    const id = (await chat(c, { message: 'oi' })).json().conversationId;
    const again = (await chat(c, { message: 'tudo bem?', conversationId: id })).json();
    expect(again.conversationId).toBe(id);
    expect((await chat(c, { message: 'x', conversationId: id }, c.B)).statusCode).toBe(404);
    const hist = (await api(c, 'GET', `/api/assistant/history?conversationId=${id}`, c.A)).json();
    expect(hist.messages.map((m: any) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
  });

  it('Claude falha → fallback demo, mensagem do usuário preservada', async () => {
    const c = await setup({ ai: fake(async () => { throw new Error('API fora do ar'); }) });
    const j = (await chat(c, { message: 'anota: pagar luz' })).json();
    expect(j.mode).toBe('demo');
    expect(j.fallback).toBe(true);
    expect(c.db.prepare("select count(*) c from items where title='pagar luz'").get()).toEqual({ c: 1 });
    expect((c.db.prepare("select content_json j from messages where role='user'").get() as any).j).toContain('pagar luz');
  });

  it('Claude lento (timeout) → fallback demo', async () => {
    const c = await setup({ aiTimeoutMs: 50, ai: fake(() => new Promise(() => {})) });
    const j = (await chat(c, { message: 'oi' })).json();
    expect(j.fallback).toBe(true);
    expect(j.reply.text.length).toBeGreaterThan(0);
  });

  it('tom e modo de resposta entram no system; imagem é repassada', async () => {
    let seen: any;
    const c = await setup({ ai: fake(async (input) => { seen = input; return { text: 'ok', toolsUsed: [] }; }) });
    await api(c, 'PUT', '/api/assistant/settings', c.A, { tone: 'informal', replyMode: 'audio', language: 'pt-BR', rate: 1.2, voice: 'Luciana' });
    await chat(c, { message: 'veja', imageBase64: 'QUJD', imageMime: 'image/png' });
    expect(seen.system).toContain('informal');
    expect(seen.system.toLowerCase()).toContain('voz alta');
    const last = seen.messages.at(-1);
    expect(last).toMatchObject({ role: 'user', content: 'veja', imageBase64: 'QUJD', imageMime: 'image/png' });
    expect(seen.tools.map((t: any) => t.name)).toContain('criar_item');
  });

  it('valida entrada e exige assistant.use', async () => {
    const c = await setup();
    expect((await chat(c, { message: '' })).statusCode).toBe(400);
    expect((await chat(c, { message: 'x', imageBase64: 'AAAA', imageMime: 'text/html' })).statusCode).toBe(400);
    expect((await chat(c, { message: 'x', imageBase64: 'A'.repeat(9 * 1024 * 1024), imageMime: 'image/png' })).statusCode).toBe(413);
    expect((await chat(c, { message: 'oi' }, c.R)).statusCode).toBe(403);
  });
});

describe('modo e configurações', () => {
  it('/mode informa o modo e nunca vaza a chave', async () => {
    const c = await setup({ cfg: { port: 1, dbPath: ':memory:', anthropicKey: 'sk-ant-segredo' } , ai: fake(async () => ({ text: '', toolsUsed: [] })) });
    const r = await api(c, 'GET', '/api/assistant/mode', c.A);
    expect(r.json()).toEqual({ mode: 'claude' });
    expect(r.body).not.toContain('sk-ant');
    expect((await api(c, 'GET', '/api/assistant/mode', {})).statusCode).toBe(401);
  });

  it('settings: padrões, atualização e validação', async () => {
    const c = await setup();
    expect((await api(c, 'GET', '/api/assistant/settings', c.A)).json().settings).toEqual({ voice: null, language: 'pt-BR', rate: 1, tone: 'conciso', replyMode: 'both' });
    const put = await api(c, 'PUT', '/api/assistant/settings', c.A, { replyMode: 'text', rate: 1.5 });
    expect(put.json().settings).toMatchObject({ replyMode: 'text', rate: 1.5, language: 'pt-BR' });
    expect((await api(c, 'PUT', '/api/assistant/settings', c.A, { rate: 9 })).statusCode).toBe(400);
    expect((await api(c, 'PUT', '/api/assistant/settings', c.A, { replyMode: 'video' })).statusCode).toBe(400);
    expect((await api(c, 'GET', '/api/assistant/settings', c.B)).json().settings.replyMode).toBe('both');
  });
});

describe('processar caixa de entrada', () => {
  const addItem = async (c: S, title: string, h = c.A) => (await api(c, 'POST', '/api/items', h, { title })).json().item;

  it('demo: uma sugestão por item, nada muda até aplicar', async () => {
    const c = await setup();
    const a = await addItem(c, 'Ligar para o dentista amanhã');
    const b = await addItem(c, 'Aguardar resposta do João');
    const d = await addItem(c, 'Talvez aprender violino');
    const e = await addItem(c, 'Projeto reforma da casa');
    const r = (await api(c, 'POST', '/api/assistant/process-inbox', c.A)).json();
    expect(r.suggestions).toHaveLength(4);
    const by = Object.fromEntries(r.suggestions.map((s: any) => [s.itemId, s]));
    expect(by[a.id]).toMatchObject({ status: 'next', dueAt: '2026-11-12T12:00:00.000Z' });
    expect(by[b.id].status).toBe('waiting');
    expect(by[d.id].status).toBe('someday');
    expect(by[e.id]).toMatchObject({ status: 'next', kind: 'project' });
    expect(by[a.id].reason.length).toBeGreaterThan(0);
    expect((await api(c, 'GET', '/api/items/counts', c.A)).json().counts.inbox).toBe(4);

    const ap = await api(c, 'POST', '/api/assistant/process-inbox/apply', c.A, { changes: r.suggestions.map((s: any) => ({ itemId: s.itemId, status: s.status, kind: s.kind, dueAt: s.dueAt })) });
    expect(ap.json()).toEqual({ applied: 4, skipped: 0 });
    expect((await api(c, 'GET', '/api/items/counts', c.A)).json().counts.inbox).toBe(0);
  });

  it('apply ignora itens de outro usuário', async () => {
    const c = await setup();
    const mine = await addItem(c, 'meu');
    const theirs = await addItem(c, 'alheio', c.B);
    const ap = await api(c, 'POST', '/api/assistant/process-inbox/apply', c.A, { changes: [{ itemId: mine.id, status: 'next' }, { itemId: theirs.id, status: 'next' }] });
    expect(ap.json()).toEqual({ applied: 1, skipped: 1 });
    expect((await api(c, 'GET', '/api/items?status=inbox', c.B)).json().items).toHaveLength(1);
  });

  it('modo Claude usa o JSON do modelo; JSON inválido cai na heurística', async () => {
    let reply = '';
    const c = await setup({ ai: fake(async () => ({ text: reply, toolsUsed: [] })) });
    const a = await addItem(c, 'Ligar para o banco');
    reply = '```json\n' + JSON.stringify([{ itemId: a.id, status: 'waiting', reason: 'depende do banco' }]) + '\n```';
    let r = (await api(c, 'POST', '/api/assistant/process-inbox', c.A)).json();
    expect(r.suggestions[0]).toMatchObject({ status: 'waiting', reason: 'depende do banco' });
    reply = 'não consegui, desculpe';
    r = (await api(c, 'POST', '/api/assistant/process-inbox', c.A)).json();
    expect(r.suggestions[0].status).toBe('next');
    reply = JSON.stringify([{ itemId: 'inventado', status: 'next', reason: 'x' }, { itemId: a.id, status: 'voando', reason: 'x' }]);
    r = (await api(c, 'POST', '/api/assistant/process-inbox', c.A)).json();
    expect(r.suggestions).toHaveLength(1); // item inventado ignorado, status inválido → heurística
    expect(r.suggestions[0].itemId).toBe(a.id);
  });

  it('caixa vazia → lista vazia', async () => {
    const c = await setup();
    expect((await api(c, 'POST', '/api/assistant/process-inbox', c.A)).json().suggestions).toEqual([]);
  });
});

describe('mapa mental com IA', () => {
  function mapFor(c: S) {
    const g = createMap('Estudar IA');
    const id = 'mm1';
    const uid = (c.db.prepare("select id from users where email='a@x.com'").get() as any).id;
    c.db.prepare('insert into mindmaps(id,user_id,title,graph_json,updated_at) values(?,?,?,?,?)').run(id, uid, 'Estudar IA', JSON.stringify(g), 'x');
    return { id, g };
  }

  it('expand em modo demo adiciona filhos ao nó', async () => {
    const c = await setup();
    const { id, g } = mapFor(c);
    const r = await api(c, 'POST', '/api/assistant/mindmap/expand', c.A, { mindmapId: id, nodeId: g.rootId });
    expect(r.statusCode).toBe(200);
    expect(r.json().added).toBeGreaterThanOrEqual(3);
    const stored = JSON.parse((c.db.prepare('select graph_json g from mindmaps where id=?').get(id) as any).g);
    expect(Object.keys(stored.nodes).length).toBe(1 + r.json().added);
  });

  it('expand com Claude: o modelo chama expandir_ramo', async () => {
    const c = await setup({ ai: fake(async (input) => { const g = JSON.parse(await input.runTool('expandir_ramo', { ...JSON.parse(input.messages[0].content.match(/\{.*\}/s)![0]), filhos: ['Redes neurais', 'Dados'] })); return { text: 'ok' + g.added, toolsUsed: [] }; }) });
    const { id, g } = mapFor(c);
    const r = await api(c, 'POST', '/api/assistant/mindmap/expand', c.A, { mindmapId: id, nodeId: g.rootId });
    expect(r.json().added).toBe(2);
  });

  it('expand em mapa de outro usuário → 404; generate cria mapa novo', async () => {
    const c = await setup();
    const { id, g } = mapFor(c);
    expect((await api(c, 'POST', '/api/assistant/mindmap/expand', c.B, { mindmapId: id, nodeId: g.rootId })).statusCode).toBe(404);
    const r = await api(c, 'POST', '/api/assistant/mindmap/generate', c.A, { topic: 'Viagem ao Japão' });
    expect(r.statusCode).toBe(200);
    const m = (await api(c, 'GET', `/api/mindmaps/${r.json().mindmapId}`, c.A)).json().mindmap;
    expect(m.title).toBe('Viagem ao Japão');
    expect(Object.keys(m.graph.nodes).length).toBeGreaterThan(3);
    expect((await api(c, 'POST', '/api/assistant/mindmap/generate', c.A, {})).statusCode).toBe(400);
  });
});
