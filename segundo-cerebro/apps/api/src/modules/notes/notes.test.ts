import { describe, it, expect } from 'vitest';
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate';
import { makeApp, createUser, loginAs, bearer, type TestCtx } from '../../test-utils';

async function setup() {
  const c = await makeApp();
  await createUser(c.db, { email: 'a@x.com' });
  await createUser(c.db, { email: 'b@x.com' });
  await createUser(c.db, { email: 'r@x.com', profile: 'readonly' });
  const A = bearer(await loginAs(c.app, 'a@x.com'));
  const B = bearer(await loginAs(c.app, 'b@x.com'));
  const R = bearer(await loginAs(c.app, 'r@x.com'));
  return { ...c, A, B, R };
}
type S = Awaited<ReturnType<typeof setup>>;
const api = (c: TestCtx, method: string, url: string, headers: any, payload?: any) =>
  c.app.inject({ method: method as any, url, headers, payload });
const mk = async (c: S, title: string, body = '', h = c.A, extra: any = {}) => {
  const r = await api(c, 'POST', '/api/notes', h, { title, body, ...extra });
  if (r.statusCode !== 200) throw new Error(r.body);
  return r.json().note;
};
const backlinks = async (c: S, id: string, h = c.A) => (await api(c, 'GET', `/api/notes/${id}/backlinks`, h)).json().backlinks as any[];

describe('notas e links', () => {
  it('cria nota, deriva tags e links e devolve tags', async () => {
    const c = await setup();
    const b = await mk(c, 'B');
    const a = await mk(c, 'A', 'ver [[B]] #ideias');
    expect(a.tags).toEqual(['ideias']);
    expect((await backlinks(c, b.id)).map(n => n.title)).toEqual(['A']);
  });

  it('wikilink para título inexistente não cria nota e resolve quando a nota passa a existir', async () => {
    const c = await setup();
    await mk(c, 'A', 'ver [[Futura]]');
    expect((await api(c, 'GET', '/api/notes', c.A)).json().notes).toHaveLength(1);
    const f = await mk(c, 'Futura');
    expect((await backlinks(c, f.id)).map(n => n.title)).toEqual(['A']);
  });

  it('link com alias, seção e caixa diferente resolve', async () => {
    const c = await setup();
    const b = await mk(c, 'Receitas');
    await mk(c, 'A', '[[receitas#Bolos|minhas receitas]]');
    expect(await backlinks(c, b.id)).toHaveLength(1);
  });

  it('link dentro de código não vira backlink', async () => {
    const c = await setup();
    const b = await mk(c, 'B');
    await mk(c, 'A', '`[[B]]`\n```\n[[B]]\n```');
    expect(await backlinks(c, b.id)).toHaveLength(0);
  });

  it('títulos duplicados: resolve ao mais antigo e não duplica backlink', async () => {
    const c = await setup();
    const velho = await mk(c, 'Dup');
    c.clock.t = new Date(c.clock.t.getTime() + 1000);
    const novo = await mk(c, 'Dup');
    await mk(c, 'A', '[[Dup]] e de novo [[Dup]]');
    expect(await backlinks(c, velho.id)).toHaveLength(1);
    expect(await backlinks(c, novo.id)).toHaveLength(0);
    const g = (await api(c, 'GET', '/api/graph', c.A)).json();
    expect(g.edges.filter((e: any) => e.target === velho.id)).toHaveLength(1);
  });

  it('auto-link não conta como backlink', async () => {
    const c = await setup();
    const a = await mk(c, 'A', 'eu mesmo [[A]]');
    expect(await backlinks(c, a.id)).toHaveLength(0);
  });

  it('renomear atualiza os links nas outras notas e mantém backlinks', async () => {
    const c = await setup();
    const b = await mk(c, 'Velho');
    const a = await mk(c, 'A', 'ver [[Velho|vel]]');
    const r = await api(c, 'PATCH', `/api/notes/${b.id}`, c.A, { title: 'Novo' });
    expect(r.statusCode).toBe(200);
    expect((await api(c, 'GET', `/api/notes/${a.id}`, c.A)).json().note.body).toBe('ver [[Novo|vel]]');
    expect((await backlinks(c, b.id)).map(n => n.title)).toEqual(['A']);
  });

  it('excluir nota deixa o link pendente sem quebrar', async () => {
    const c = await setup();
    const b = await mk(c, 'B');
    await mk(c, 'A', '[[B]]');
    expect((await api(c, 'DELETE', `/api/notes/${b.id}`, c.A)).statusCode).toBe(200);
    expect((await api(c, 'GET', '/api/graph', c.A)).json().edges).toEqual([]);
    const b2 = await mk(c, 'B');
    expect(await backlinks(c, b2.id)).toHaveLength(1);
  });

  it('menções sem link', async () => {
    const c = await setup();
    const b = await mk(c, 'Projeto Aurora');
    await mk(c, 'X', 'Falei do projeto aurora ontem');
    await mk(c, 'Y', 'Já linkado: [[Projeto Aurora]] e projeto aurora');
    const un = (await api(c, 'GET', `/api/notes/${b.id}/unlinked`, c.A)).json().mentions;
    expect(un.map((n: any) => n.title)).toEqual(['X']);
  });
});

describe('isolamento e permissões', () => {
  it('B não vê notas, backlinks nem grafo de A; links não cruzam usuários', async () => {
    const c = await setup();
    const a = await mk(c, 'Segredo');
    await mk(c, 'Outra', '[[Segredo]]', c.B);
    expect((await api(c, 'GET', `/api/notes/${a.id}`, c.B)).statusCode).toBe(404);
    expect((await api(c, 'PATCH', `/api/notes/${a.id}`, c.B, { body: 'x' })).statusCode).toBe(404);
    expect((await api(c, 'GET', `/api/notes/${a.id}/backlinks`, c.B)).statusCode).toBe(404);
    expect(await backlinks(c, a.id)).toHaveLength(0); // a nota do B não resolve para a do A
    expect((await api(c, 'GET', '/api/graph', c.B)).json().edges).toEqual([]);
    expect((await api(c, 'GET', '/api/search?q=segredo', c.B)).json().notes.map((n: any) => n.title)).toEqual(['Outra']);
  });

  it('readonly lê mas não escreve; exporta só com export.data', async () => {
    const c = await setup();
    expect((await api(c, 'POST', '/api/notes', c.R, { title: 'x' })).statusCode).toBe(403);
    expect((await api(c, 'GET', '/api/notes', c.R)).statusCode).toBe(200);
    expect((await api(c, 'GET', '/api/export', c.R)).statusCode).toBe(403);
  });
});

describe('busca, grafo, diárias, templates', () => {
  it('busca full-text acha trecho do corpo e é segura com sintaxe estranha', async () => {
    const c = await setup();
    await mk(c, 'Receita', 'bolo de cenoura com cobertura');
    const r = (await api(c, 'GET', '/api/search?q=cenou', c.A)).json();
    expect(r.notes).toHaveLength(1);
    expect(r.notes[0].snippet).toContain('cenoura');
    for (const q of ['"', 'a*(', 'NEAR(', 'x OR', '-']) {
      expect((await api(c, 'GET', `/api/search?q=${encodeURIComponent(q)}`, c.A)).statusCode).toBe(200);
    }
  });

  it('grafo filtra por tag', async () => {
    const c = await setup();
    await mk(c, 'A', '[[B]] #x');
    await mk(c, 'B', '#x');
    await mk(c, 'C', '#y');
    const all = (await api(c, 'GET', '/api/graph', c.A)).json();
    expect(all.nodes).toHaveLength(3);
    expect(all.edges).toHaveLength(1);
    expect((await api(c, 'GET', '/api/graph?tag=y', c.A)).json().nodes.map((n: any) => n.title)).toEqual(['C']);
  });

  it('nota diária: mesma nota nas duas chamadas e usa o template', async () => {
    const c = await setup();
    const t = await api(c, 'POST', '/api/templates', c.A, { name: 'Nota diária', body: '# {{date}}\n\n## Tarefas\n' });
    expect(t.statusCode).toBe(200);
    const d1 = (await api(c, 'POST', '/api/notes/daily', c.A, { date: '2026-11-11' })).json().note;
    const d2 = (await api(c, 'POST', '/api/notes/daily', c.A, { date: '2026-11-11' })).json().note;
    expect(d1.id).toBe(d2.id);
    expect(d1.title).toBe('2026-11-11');
    expect(d1.isDaily).toBe(true);
    expect(d1.body).toBe('# 2026-11-11\n\n## Tarefas\n');
    expect((await api(c, 'POST', '/api/notes/daily', c.A, { date: 'ontem' })).statusCode).toBe(400);
  });

  it('criar nota a partir de template', async () => {
    const c = await setup();
    const t = (await api(c, 'POST', '/api/templates', c.A, { name: 'Reunião', body: '# {{title}}\nParticipantes:' })).json().template;
    const n = await mk(c, 'Kickoff', undefined, c.A, { templateId: t.id });
    expect(n.body).toBe('# Kickoff\nParticipantes:');
  });
});

describe('importar e exportar', () => {
  it('importa .md soltos e zip (ignora caminhos perigosos) preservando links', async () => {
    const c = await setup();
    const zip = zipSync({
      'Vault/Ideias.md': strToU8('---\ntags: [x]\n---\nver [[Projeto]]'),
      'Vault/Projeto.md': strToU8('# Projeto'),
      '../fora.md': strToU8('malicioso'),
      'Vault/imagem.png': strToU8('nao-e-nota'),
    });
    const r = await api(c, 'POST', '/api/import', c.A, {
      files: [{ name: 'Solta.md', content: 'oi #solta' }],
      zipBase64: Buffer.from(zip).toString('base64'),
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().imported).toBe(3);
    const titles = (await api(c, 'GET', '/api/notes', c.A)).json().notes.map((n: any) => n.title).sort();
    expect(titles).toEqual(['Ideias', 'Projeto', 'Solta']);
    const proj = (await api(c, 'GET', '/api/notes', c.A)).json().notes.find((n: any) => n.title === 'Projeto');
    expect((await backlinks(c, proj.id)).map(n => n.title)).toEqual(['Ideias']);
  });

  it('export → import em outro usuário preserva títulos e links', async () => {
    const c = await setup();
    await mk(c, 'Alfa', 'vai para [[Beta]] #t');
    await mk(c, 'Beta', 'fim');
    const ex = await api(c, 'GET', '/api/export', c.A);
    expect(ex.statusCode).toBe(200);
    expect(ex.headers['content-type']).toContain('zip');
    const files = unzipSync(new Uint8Array(ex.rawPayload));
    expect(Object.keys(files).sort()).toEqual(['Alfa.md', 'Beta.md']);
    expect(strFromU8(files['Alfa.md'])).toContain('[[Beta]]');
    const imp = await api(c, 'POST', '/api/import', c.B, { zipBase64: ex.rawPayload.toString('base64') });
    expect(imp.json().imported).toBe(2);
    const beta = (await api(c, 'GET', '/api/notes', c.B)).json().notes.find((n: any) => n.title === 'Beta');
    expect((await backlinks(c, beta.id, c.B)).map(n => n.title)).toEqual(['Alfa']);
  });

  it('zip inválido → 400', async () => {
    const c = await setup();
    const r = await api(c, 'POST', '/api/import', c.A, { zipBase64: Buffer.from('isto não é zip').toString('base64') });
    expect(r.statusCode).toBe(400);
  });
});
