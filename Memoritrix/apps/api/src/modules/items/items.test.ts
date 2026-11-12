import { describe, it, expect } from 'vitest';
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
const capture = async (c: S, title: string, extra: any = {}, h = c.A) =>
  (await api(c, 'POST', '/api/items', h, { title, ...extra })).json().item;

describe('captura e fluxo', () => {
  it('captura entra na inbox e o contador bate', async () => {
    const c = await setup();
    const it = await capture(c, 'Comprar pão');
    expect(it.status).toBe('inbox');
    await capture(c, 'Ligar para o banco');
    const counts = (await api(c, 'GET', '/api/items/counts', c.A)).json().counts;
    expect(counts.inbox).toBe(2);
    const list = (await api(c, 'GET', '/api/items?status=inbox', c.A)).json().items;
    expect(list.map((i: any) => i.title).sort()).toEqual(['Comprar pão', 'Ligar para o banco']);
  });

  it('mover entre listas e filtrar', async () => {
    const c = await setup();
    const it = await capture(c, 'X');
    const r = await api(c, 'PATCH', `/api/items/${it.id}`, c.A, { status: 'next' });
    expect(r.json().item.status).toBe('next');
    expect((await api(c, 'GET', '/api/items?status=inbox', c.A)).json().items).toHaveLength(0);
    expect((await api(c, 'GET', '/api/items?status=next', c.A)).json().items).toHaveLength(1);
    const w = await api(c, 'PATCH', `/api/items/${it.id}`, c.A, { status: 'waiting', waitingOn: 'João' });
    expect(w.json().item.waitingOn).toBe('João');
  });

  it('isolamento entre usuários', async () => {
    const c = await setup();
    const it = await capture(c, 'Segredo');
    expect((await api(c, 'GET', '/api/items', c.B)).json().items).toHaveLength(0);
    expect((await api(c, 'PATCH', `/api/items/${it.id}`, c.B, { title: 'x' })).statusCode).toBe(404);
    expect((await api(c, 'DELETE', `/api/items/${it.id}`, c.B)).statusCode).toBe(404);
  });

  it('readonly lê mas não escreve', async () => {
    const c = await setup();
    expect((await api(c, 'POST', '/api/items', c.R, { title: 'x' })).statusCode).toBe(403);
    expect((await api(c, 'GET', '/api/items', c.R)).statusCode).toBe(200);
  });

  it('valida entrada: título vazio e vínculos de outro usuário', async () => {
    const c = await setup();
    expect((await api(c, 'POST', '/api/items', c.A, { title: '  ' })).statusCode).toBe(400);
    const area = (await api(c, 'POST', '/api/areas', c.B, { name: 'Casa' })).json().area;
    const r = await api(c, 'POST', '/api/items', c.A, { title: 'x', areaId: area.id });
    expect(r.statusCode).toBe(400);
  });

  it('áreas: CRUD e filtro', async () => {
    const c = await setup();
    const area = (await api(c, 'POST', '/api/areas', c.A, { name: 'Trabalho', color: '#ff0000' })).json().area;
    await capture(c, 'Relatório', { areaId: area.id });
    await capture(c, 'Avulso');
    expect((await api(c, 'GET', `/api/items?area=${area.id}`, c.A)).json().items).toHaveLength(1);
    await api(c, 'PATCH', `/api/areas/${area.id}`, c.A, { name: 'Job' });
    expect((await api(c, 'GET', '/api/areas', c.A)).json().areas[0].name).toBe('Job');
    expect((await api(c, 'DELETE', `/api/areas/${area.id}`, c.A)).statusCode).toBe(200);
    expect((await api(c, 'GET', '/api/items', c.A)).json().items).toHaveLength(2); // itens permanecem
  });

  it('checklist guarda entradas', async () => {
    const c = await setup();
    const it = await capture(c, 'Mala de viagem', { kind: 'checklist' });
    const r = await api(c, 'PUT', `/api/items/${it.id}/entries`, c.A, { entries: [{ text: 'Passaporte', done: true }, { text: 'Carregador', done: false }] });
    expect(r.json().item.entries.map((e: any) => [e.text, e.done])).toEqual([['Passaporte', true], ['Carregador', false]]);
    const list = (await api(c, 'GET', '/api/items?kind=checklist', c.A)).json().items;
    expect(list[0].entries).toHaveLength(2);
  });
});

describe('conclusão, recorrência e logbook', () => {
  it('concluir recorrente gera a próxima ocorrência e grava no logbook', async () => {
    const c = await setup();
    const it = await capture(c, 'Regar plantas', { status: 'next', dueAt: '2026-11-11T12:00:00.000Z', recurrence: 'weekly' });
    const r = await api(c, 'PATCH', `/api/items/${it.id}`, c.A, { status: 'done' });
    expect(r.json().item.completedAt).toBeTruthy();
    expect(r.json().next.dueAt).toBe('2026-11-18T12:00:00.000Z');
    expect(r.json().next.status).toBe('next');
    const log = (await api(c, 'GET', '/api/logbook', c.A)).json().entries;
    expect(log[0].summary).toContain('Regar plantas');
    // concluir de novo não duplica
    await api(c, 'PATCH', `/api/items/${it.id}`, c.A, { status: 'done' });
    expect((await api(c, 'GET', '/api/items?status=next', c.A)).json().items).toHaveLength(1);
  });

  it('item sem recorrência não gera próximo', async () => {
    const c = await setup();
    const it = await capture(c, 'Única vez', { status: 'next', dueAt: '2026-11-11T12:00:00.000Z' });
    expect((await api(c, 'PATCH', `/api/items/${it.id}`, c.A, { status: 'done' })).json().next).toBeUndefined();
  });
});

describe('calendário, revisão e busca', () => {
  it('calendar traz só itens do mês pedido', async () => {
    const c = await setup();
    await capture(c, 'Outubro', { dueAt: '2026-10-23T10:00:00.000Z', status: 'next' });
    await capture(c, 'Novembro', { dueAt: '2026-11-02T10:00:00.000Z', status: 'next' });
    await capture(c, 'Evento', { kind: 'event', startAt: '2026-10-05T14:00:00.000Z', endAt: '2026-10-05T15:00:00.000Z' });
    const r = (await api(c, 'GET', '/api/calendar?month=2026-10', c.A)).json();
    expect(r.items.map((i: any) => i.title).sort()).toEqual(['Evento', 'Outubro']);
    expect(r.days['2026-10-23']).toBe(1);
    expect((await api(c, 'GET', '/api/calendar?month=outubro', c.A)).statusCode).toBe(400);
  });

  it('revisão semanal lista projeto sem próxima ação', async () => {
    const c = await setup();
    const p1 = await capture(c, 'Reforma', { kind: 'project', status: 'next' });
    const p2 = await capture(c, 'Viagem', { kind: 'project', status: 'next' });
    await capture(c, 'Comprar tinta', { status: 'next', projectId: p1.id });
    await capture(c, 'Solta');
    await capture(c, 'Talvez', { status: 'someday' });
    const r = (await api(c, 'GET', '/api/review/weekly', c.A)).json();
    expect(r.projectsWithoutNext.map((p: any) => p.id)).toEqual([p2.id]);
    expect(r.inbox).toHaveLength(1);
    expect(r.someday).toHaveLength(1);
  });

  it('busca full-text por título e é segura com caracteres especiais', async () => {
    const c = await setup();
    await capture(c, 'Planejar viagem para Lisboa');
    await capture(c, 'Outra coisa');
    expect((await api(c, 'GET', '/api/items?q=lisboa', c.A)).json().items).toHaveLength(1);
    expect((await api(c, 'GET', '/api/items?q=lis', c.A)).json().items).toHaveLength(1); // prefixo
    for (const q of ['"', 'a*(', 'NEAR(', 'x OR']) {
      expect((await api(c, 'GET', `/api/items?q=${encodeURIComponent(q)}`, c.A)).statusCode).toBe(200);
    }
  });
});

describe('conclusão da revisão semanal', () => {
  it('grava no logbook e exige permissão de escrita', async () => {
    const c = await setup();
    const r = await api(c, 'POST', '/api/review/complete', c.A);
    expect(r.statusCode).toBe(200);
    const log = (await api(c, 'GET', '/api/logbook', c.A)).json().entries;
    expect(log[0]).toMatchObject({ kind: 'review.done', summary: 'Revisão semanal concluída' });
    expect((await api(c, 'POST', '/api/review/complete', c.R)).statusCode).toBe(403);
    expect((await api(c, 'GET', '/api/logbook', c.B)).json().entries).toEqual([]);
  });
});
