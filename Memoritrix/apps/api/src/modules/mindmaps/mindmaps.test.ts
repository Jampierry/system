import { describe, it, expect } from 'vitest';
import { createMap, addChild, toOutlineMarkdown } from '@cerebro/shared';
import { makeApp, createUser, loginAs, bearer, type TestCtx } from '../../test-utils';

async function setup() {
  const c = await makeApp();
  await createUser(c.db, { email: 'a@x.com' });
  await createUser(c.db, { email: 'b@x.com' });
  await createUser(c.db, { email: 'r@x.com', profile: 'readonly' });
  return { ...c, A: bearer(await loginAs(c.app, 'a@x.com')), B: bearer(await loginAs(c.app, 'b@x.com')), R: bearer(await loginAs(c.app, 'r@x.com')) };
}
type S = Awaited<ReturnType<typeof setup>>;
const api = (c: TestCtx, method: string, url: string, headers: any, payload?: any) => c.app.inject({ method: method as any, url, headers, payload });

describe('mindmaps API', () => {
  it('cria com raiz padrão, lista, lê e atualiza', async () => {
    const c = await setup();
    const created = (await api(c, 'POST', '/api/mindmaps', c.A, { title: 'Estudos' })).json().mindmap;
    expect(created.graph.nodes[created.graph.rootId].text).toBe('Estudos');
    expect((await api(c, 'GET', '/api/mindmaps', c.A)).json().mindmaps.map((m: any) => m.title)).toEqual(['Estudos']);
    let g = created.graph;
    g = addChild(g, g.rootId, 'Filho').map;
    const put = await api(c, 'PUT', `/api/mindmaps/${created.id}`, c.A, { title: 'Estudos 2', graph: g });
    expect(put.statusCode).toBe(200);
    const got = (await api(c, 'GET', `/api/mindmaps/${created.id}`, c.A)).json().mindmap;
    expect(got.title).toBe('Estudos 2');
    expect(Object.keys(got.graph.nodes)).toHaveLength(2);
  });

  it('JSON inválido → 400 INVALID_MAP e o mapa anterior é preservado', async () => {
    const c = await setup();
    const m = (await api(c, 'POST', '/api/mindmaps', c.A, { title: 'T' })).json().mindmap;
    const bad = { ...m.graph, nodes: { ...m.graph.nodes, x: { id: 'x', parentId: 'y', text: 'a', x: 0, y: 0 }, y: { id: 'y', parentId: 'x', text: 'b', x: 0, y: 0 } } };
    const r = await api(c, 'PUT', `/api/mindmaps/${m.id}`, c.A, { graph: bad });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('INVALID_MAP');
    expect((await api(c, 'GET', `/api/mindmaps/${m.id}`, c.A)).json().mindmap.graph).toEqual(m.graph);
    expect((await api(c, 'POST', '/api/mindmaps', c.A, { title: 'Z', graph: { rootId: 'nada' } })).statusCode).toBe(400);
  });

  it('isolamento e permissões', async () => {
    const c = await setup();
    const m = (await api(c, 'POST', '/api/mindmaps', c.A, { title: 'T' })).json().mindmap;
    expect((await api(c, 'GET', `/api/mindmaps/${m.id}`, c.B)).statusCode).toBe(404);
    expect((await api(c, 'PUT', `/api/mindmaps/${m.id}`, c.B, { graph: m.graph })).statusCode).toBe(404);
    expect((await api(c, 'DELETE', `/api/mindmaps/${m.id}`, c.B)).statusCode).toBe(404);
    expect((await api(c, 'POST', '/api/mindmaps', c.R, { title: 'x' })).statusCode).toBe(403);
    expect((await api(c, 'GET', '/api/mindmaps', c.R)).statusCode).toBe(200);
    expect((await api(c, 'DELETE', `/api/mindmaps/${m.id}`, c.A)).statusCode).toBe(200);
  });

  async function withBranch(c: S) {
    let g = createMap('Projeto');
    const a = addChild(g, g.rootId, 'Pesquisa'); g = a.map;
    g = addChild(g, a.id, 'Ler artigos').map;
    g = addChild(g, a.id, 'Entrevistas').map;
    g = addChild(g, g.rootId, 'Execução').map;
    const m = (await api(c, 'POST', '/api/mindmaps', c.A, { title: 'Projeto', graph: g })).json().mindmap;
    return { m, branchId: a.id as string };
  }

  it('to-notes: ramo vira notas ligadas por wikilinks', async () => {
    const c = await setup();
    const { m, branchId } = await withBranch(c);
    const r = await api(c, 'POST', `/api/mindmaps/${m.id}/to-notes`, c.A, { nodeId: branchId, as: 'notes' });
    expect(r.statusCode).toBe(200);
    expect(r.json().created).toBe(3);
    const notes = (await api(c, 'GET', '/api/notes', c.A)).json().notes;
    expect(notes.map((n: any) => n.title).sort()).toEqual(['Entrevistas', 'Ler artigos', 'Pesquisa']);
    const root = notes.find((n: any) => n.title === 'Pesquisa');
    const bl = (await api(c, 'GET', `/api/notes/${notes.find((n: any) => n.title === 'Ler artigos').id}/backlinks`, c.A)).json().backlinks;
    expect(bl.map((n: any) => n.id)).toEqual([root.id]);
  });

  it('to-notes: título repetido dentro do ramo ganha sufixo e não duplica nota existente do usuário', async () => {
    const c = await setup();
    let g = createMap('R');
    g = addChild(g, g.rootId, 'Igual').map;
    const first = addChild(g, g.rootId, 'Igual'); g = first.map;
    const m = (await api(c, 'POST', '/api/mindmaps', c.A, { title: 'R', graph: g })).json().mindmap;
    const r = await api(c, 'POST', `/api/mindmaps/${m.id}/to-notes`, c.A, { nodeId: g.rootId, as: 'notes' });
    expect(r.json().created).toBe(3);
    const titles = (await api(c, 'GET', '/api/notes', c.A)).json().notes.map((n: any) => n.title).sort();
    expect(titles).toEqual(['Igual', 'Igual (2)', 'R']);
  });

  it('to-notes: tarefas — raiz do ramo vira projeto e descendentes tarefas na caixa de entrada', async () => {
    const c = await setup();
    const { m, branchId } = await withBranch(c);
    const r = await api(c, 'POST', `/api/mindmaps/${m.id}/to-notes`, c.A, { nodeId: branchId, as: 'tasks' });
    expect(r.json().created).toBe(3);
    const items = (await api(c, 'GET', '/api/items', c.A)).json().items;
    const project = items.find((i: any) => i.kind === 'project');
    expect(project.title).toBe('Pesquisa');
    const tasks = items.filter((i: any) => i.kind === 'task');
    expect(tasks.map((t: any) => t.title).sort()).toEqual(['Entrevistas', 'Ler artigos']);
    expect(tasks.every((t: any) => t.projectId === project.id && t.status === 'inbox')).toBe(true);
  });

  it('to-notes: nó inexistente → 404 e conversão inclui só o ramo', async () => {
    const c = await setup();
    const { m } = await withBranch(c);
    expect((await api(c, 'POST', `/api/mindmaps/${m.id}/to-notes`, c.A, { nodeId: 'nada', as: 'notes' })).statusCode).toBe(404);
    expect(toOutlineMarkdown(m.graph)).toContain('Execução');
  });
});
