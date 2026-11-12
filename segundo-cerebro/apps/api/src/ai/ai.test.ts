import { describe, it, expect } from 'vitest';
import { loadConfig } from '../config';
import { selectProvider } from './select';
import { DemoProvider } from './demo';
import { ClaudeProvider } from './claude';
import { buildTools } from './tools';
import { makeApp, createUser } from '../test-utils';
import { createMap } from '@cerebro/shared';

const baseInput = { system: 's', messages: [{ role: 'user' as const, content: '' }], tools: [] };

describe('selectProvider', () => {
  it('sem chave → demo; com chave → claude (sem rede)', () => {
    expect(selectProvider(loadConfig({})).mode).toBe('demo');
    const p = selectProvider(loadConfig({ ANTHROPIC_API_KEY: 'k' } as any), () => ({ messages: { create: async () => ({}) } }));
    expect(p.mode).toBe('claude');
  });
});

describe('DemoProvider', () => {
  const run = async (content: string, extra: any = {}) => {
    const calls: { name: string; args: any }[] = [];
    const r = await new DemoProvider().respond({
      ...baseInput, messages: [{ role: 'user', content, ...extra }],
      runTool: async (name, args) => { calls.push({ name, args }); return JSON.stringify({ ok: true }); },
    });
    return { r, calls };
  };
  it('"anota: comprar pão" chama criar_item', async () => {
    const { r, calls } = await run('anota: comprar pão');
    expect(calls).toEqual([{ name: 'criar_item', args: { title: 'comprar pão' } }]);
    expect(r.text).toContain('comprar pão');
  });
  it('nota, agenda e busca', async () => {
    expect((await run('nota: ideias de livro')).calls[0]).toEqual({ name: 'criar_nota', args: { title: 'ideias de livro' } });
    expect((await run('o que tenho na agenda?')).calls[0].name).toBe('listar_agenda');
    expect((await run('procure lisboa')).calls[0]).toEqual({ name: 'buscar', args: { q: 'lisboa' } });
  });
  it('foto vira item avisando do modo demo', async () => {
    const { calls, r } = await run('olha isso', { imageBase64: 'AAAA', imageMime: 'image/png' });
    expect(calls[0].name).toBe('criar_item');
    expect(r.text.toLowerCase()).toContain('demo');
  });
  it('mensagem desconhecida devolve ajuda sem chamar ferramentas', async () => {
    const { r, calls } = await run('qual o sentido da vida');
    expect(calls).toHaveLength(0);
    expect(r.text).toContain('anota:');
  });
});

describe('ClaudeProvider', () => {
  const toolUse = (id: string, name: string, input: any) => ({ stop_reason: 'tool_use', content: [{ type: 'text', text: 'vou fazer' }, { type: 'tool_use', id, name, input }] });
  const end = (text: string) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });

  it('loop de ferramentas: executa tool_use, devolve tool_result e retorna o texto final', async () => {
    const sent: any[] = [];
    const queue = [toolUse('t1', 'criar_item', { title: 'x' }), end('Pronto!')];
    const client = { messages: { create: async (args: any) => { sent.push(JSON.parse(JSON.stringify(args))); return queue.shift(); } } };
    const ran: any[] = [];
    const p = new ClaudeProvider(client, 'claude-sonnet-5-5');
    const r = await p.respond({
      system: 'sys', tools: [{ name: 'criar_item', description: 'd', input_schema: { type: 'object', properties: {} } }],
      messages: [{ role: 'user', content: 'anota x' }],
      runTool: async (name, args) => { ran.push([name, args]); return '{"ok":true}'; },
    });
    expect(r.text).toBe('Pronto!');
    expect(ran).toEqual([['criar_item', { title: 'x' }]]);
    expect(sent[0].model).toBe('claude-sonnet-5-5');
    expect(sent[0].system).toBe('sys');
    const last = sent[1].messages.at(-1);
    expect(last.role).toBe('user');
    expect(last.content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 't1' });
  });

  it('envia a imagem como bloco base64 na última mensagem do usuário', async () => {
    let seen: any;
    const client = { messages: { create: async (a: any) => { seen = a; return end('ok'); } } };
    await new ClaudeProvider(client, 'm').respond({
      system: 's', tools: [], runTool: async () => '',
      messages: [{ role: 'assistant', content: 'oi' }, { role: 'user', content: 'veja', imageBase64: 'QUJD', imageMime: 'image/png' }],
    });
    const content = seen.messages.at(-1).content;
    expect(content).toContainEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } });
    expect(content).toContainEqual({ type: 'text', text: 'veja' });
  });

  it('limita os passos de ferramenta (sem loop infinito)', async () => {
    let n = 0;
    const client = { messages: { create: async () => { n++; return toolUse('t' + n, 'buscar', { q: 'x' }); } } };
    const r = await new ClaudeProvider(client, 'm', 5).respond({ ...baseInput, runTool: async () => '{}' });
    expect(n).toBe(5);
    expect(typeof r.text).toBe('string');
  });

  it('erro do cliente propaga (o chamador decide o fallback)', async () => {
    const client = { messages: { create: async () => { throw new Error('boom'); } } };
    await expect(new ClaudeProvider(client, 'm').respond({ ...baseInput, runTool: async () => '' })).rejects.toThrow('boom');
  });
});

describe('ferramentas', () => {
  async function ctx(profile: 'member' | 'readonly' = 'member') {
    const c = await makeApp();
    const userId = await createUser(c.db, { email: 'a@x.com', profile });
    const other = await createUser(c.db, { email: 'b@x.com' });
    const perms = profile === 'member' ? ['items.write', 'notes.write', 'assistant.use'] : ['assistant.use'];
    return { ...c, userId, other, tools: buildTools({ deps: c.deps, userId, permissions: perms as any }) };
  }

  it('criar_item cria na inbox e criar_nota cria nota; buscar encontra', async () => {
    const c = await ctx();
    const r = JSON.parse(await c.tools.run('criar_item', { title: 'Pagar conta' }));
    expect(r.ok).toBe(true);
    expect(c.db.prepare("select status from items where title='Pagar conta'").get()).toEqual({ status: 'inbox' });
    await c.tools.run('criar_nota', { title: 'Lisboa', body: 'roteiro de viagem' });
    const found = JSON.parse(await c.tools.run('buscar', { q: 'roteiro' }));
    expect(found.notes.map((n: any) => n.title)).toEqual(['Lisboa']);
  });

  it('args inválidos devolvem erro em JSON sem lançar', async () => {
    const c = await ctx();
    expect(JSON.parse(await c.tools.run('criar_item', { title: '' })).error).toBeTruthy();
    expect(JSON.parse(await c.tools.run('criar_item', 'lixo')).error).toBeTruthy();
    expect(JSON.parse(await c.tools.run('inexistente', {})).error).toBeTruthy();
  });

  it('readonly não vê nem executa ferramentas de escrita', async () => {
    const c = await ctx('readonly');
    const names = c.tools.defs.map(d => d.name);
    expect(names).toContain('buscar');
    expect(names).not.toContain('criar_item');
    expect(JSON.parse(await c.tools.run('criar_item', { title: 'x' })).error).toBeTruthy();
  });

  it('criar_evento e listar_agenda', async () => {
    const c = await ctx();
    await c.tools.run('criar_evento', { title: 'Dentista', startAt: '2026-11-12T14:00:00.000Z' });
    const ag = JSON.parse(await c.tools.run('listar_agenda', { from: '2026-11-11', to: '2026-11-13' }));
    expect(ag.items.map((i: any) => i.title)).toEqual(['Dentista']);
  });

  it('ferramentas de mapa só mexem em mapas do próprio usuário', async () => {
    const c = await ctx();
    const g = createMap('Tema');
    c.db.prepare('insert into mindmaps(id,user_id,title,graph_json,updated_at) values(?,?,?,?,?)').run('m1', c.userId, 'Tema', JSON.stringify(g), 'x');
    c.db.prepare('insert into mindmaps(id,user_id,title,graph_json,updated_at) values(?,?,?,?,?)').run('m2', c.other, 'Alheio', JSON.stringify(g), 'x');
    const ok = JSON.parse(await c.tools.run('expandir_ramo', { mindmapId: 'm1', nodeId: g.rootId, filhos: ['a', 'b'] }));
    expect(ok.added).toBe(2);
    const stored = JSON.parse((c.db.prepare("select graph_json g from mindmaps where id='m1'").get() as any).g);
    expect(Object.keys(stored.nodes)).toHaveLength(3);
    expect(JSON.parse(await c.tools.run('adicionar_ao_mapa', { mindmapId: 'm2', texts: ['x'] })).error).toBeTruthy();
    const gen = JSON.parse(await c.tools.run('gerar_mapa', { titulo: 'Novo', outline: '# Novo\n- a\n  - b\n- c' }));
    expect(gen.nodes).toBe(4);
  });

  it('resumir_nota devolve o corpo da nota do usuário e nunca a de outro', async () => {
    const c = await ctx();
    await c.tools.run('criar_nota', { title: 'Aula', body: 'conteúdo da aula' });
    expect(JSON.parse(await c.tools.run('resumir_nota', { title: 'Aula' })).body).toBe('conteúdo da aula');
    c.db.prepare("insert into notes(id,user_id,path,title,body_md,created_at,updated_at) values('n9',?,?,?,?,?,?)").run(c.other, 'Alheia', 'Alheia', 'segredo', 'x', 'x');
    expect(JSON.parse(await c.tools.run('resumir_nota', { title: 'Alheia' })).error).toBeTruthy();
  });
});
