import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { makeApp, createUser, loginAs, bearer, type TestCtx } from '../../test-utils';

async function setup() {
  const sent: { to: string; subject: string; text: string }[] = [];
  const ctx = await makeApp({ mailer: { send: async (to, subject, text) => void sent.push({ to, subject, text }) } });
  await createUser(ctx.db, { email: 'admin@x.com', profile: 'admin' });
  await createUser(ctx.db, { email: 'ana@x.com', profile: 'member' });
  const admin = bearer(await loginAs(ctx.app, 'admin@x.com'));
  return { ...ctx, admin, sent };
}
const post = (c: TestCtx, url: string, payload?: any, headers?: any) =>
  c.app.inject({ method: 'POST', url, payload, headers });
const forgot = (c: TestCtx, email: string) => post(c, '/api/auth/forgot', { email });
const pending = async (c: TestCtx & { admin: any }) =>
  ((await c.app.inject({ method: 'GET', url: '/api/admin/recovery?status=pending', headers: c.admin })).json().requests as any[]);
const reset = (c: TestCtx, email: string, code: string, newPassword = 'nova-senha-longa') =>
  post(c, '/api/auth/reset', { email, code, newPassword });
async function approved(c: Awaited<ReturnType<typeof setup>>, email = 'ana@x.com') {
  await forgot(c, email);
  const [req] = await pending(c);
  const r = await post(c, `/api/admin/recovery/${req.id}/approve`, undefined, c.admin);
  return { id: req.id as string, code: r.json().code as string };
}

describe('esqueci a senha', () => {
  it('resposta idêntica para e-mail existente e inexistente; só o existente cria solicitação', async () => {
    const c = await setup();
    const a = await forgot(c, 'ana@x.com');
    const b = await forgot(c, 'ninguem@x.com');
    expect(a.statusCode).toBe(202);
    expect(b.statusCode).toBe(202);
    expect(a.body).toBe(b.body);
    expect(c.db.prepare('select count(*) c from password_recovery').get()).toEqual({ c: 1 });
    await forgot(c, 'ana@x.com'); // não duplica pendente
    expect(c.db.prepare('select count(*) c from password_recovery').get()).toEqual({ c: 1 });
  });

  it('admin vê a fila; membro não', async () => {
    const c = await setup();
    await forgot(c, 'ana@x.com');
    const list = await pending(c);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ email: 'ana@x.com', status: 'pending' });
    const member = bearer(await loginAs(c.app, 'ana@x.com'));
    expect((await c.app.inject({ method: 'GET', url: '/api/admin/recovery', headers: member })).statusCode).toBe(403);
    expect((await post(c, `/api/admin/recovery/${list[0].id}/approve`, undefined, member)).statusCode).toBe(403);
  });
});

describe('aprovar e redefinir', () => {
  it('código válido troca a senha, derruba sessões antigas e é auditado', async () => {
    const c = await setup();
    const old = bearer(await loginAs(c.app, 'ana@x.com'));
    const { code } = await approved(c);
    const r = await reset(c, 'ana@x.com', code);
    expect(r.statusCode).toBe(200);
    expect((await c.app.inject({ method: 'GET', url: '/api/auth/me', headers: old })).statusCode).toBe(401);
    await loginAs(c.app, 'ana@x.com', 'nova-senha-longa');
    expect(c.db.prepare("select count(*) c from audit_log where action in ('recovery.approve','recovery.reset')").get()).toEqual({ c: 2 });
  });

  it('banco guarda só o hash do código', async () => {
    const c = await setup();
    const { id, code } = await approved(c);
    const row = c.db.prepare('select token_hash from password_recovery where id=?').get(id) as any;
    expect(row.token_hash).toBe(createHash('sha256').update(code).digest('hex'));
    expect(row.token_hash).not.toBe(code);
  });

  it('reuso do código → 400 INVALID_CODE', async () => {
    const c = await setup();
    const { code } = await approved(c);
    expect((await reset(c, 'ana@x.com', code)).statusCode).toBe(200);
    const again = await reset(c, 'ana@x.com', code, 'outra-senha-longa');
    expect(again.statusCode).toBe(400);
    expect(again.json().error.code).toBe('INVALID_CODE');
  });

  it('código vencido (+61 min) e solicitação negada dão o mesmo erro e não trocam a senha', async () => {
    const c = await setup();
    const { code } = await approved(c);
    c.clock.t = new Date(c.clock.t.getTime() + 61 * 60_000);
    const expired = await reset(c, 'ana@x.com', code);
    expect(expired.statusCode).toBe(400);
    expect(expired.json().error.code).toBe('INVALID_CODE');

    await createUser(c.db, { email: 'bia@x.com' });
    await forgot(c, 'bia@x.com');
    const [req] = await pending(c);
    expect((await post(c, `/api/admin/recovery/${req.id}/deny`, undefined, c.admin)).statusCode).toBe(200);
    const denied = await reset(c, 'bia@x.com', 'qualquer-coisa');
    expect(denied.json().error).toEqual(expired.json().error);
    await loginAs(c.app, 'ana@x.com'); // senha antiga continua valendo
    await loginAs(c.app, 'bia@x.com');
  });

  it('código de outro usuário não funciona e senha curta é rejeitada', async () => {
    const c = await setup();
    await createUser(c.db, { email: 'bia@x.com' });
    const { code } = await approved(c);
    expect((await reset(c, 'bia@x.com', code)).json().error.code).toBe('INVALID_CODE');
    expect((await reset(c, 'ana@x.com', code, 'curta')).statusCode).toBe(400);
  });

  it('não aprova duas vezes; 6 códigos errados → 429', async () => {
    const c = await setup();
    const { id } = await approved(c);
    expect((await post(c, `/api/admin/recovery/${id}/approve`, undefined, c.admin)).statusCode).toBe(409);
    for (let i = 0; i < 5; i++) expect((await reset(c, 'ana@x.com', 'errado' + i)).statusCode).toBe(400);
    expect((await reset(c, 'ana@x.com', 'errado6')).statusCode).toBe(429);
  });

  it('envia o código por e-mail quando há mailer', async () => {
    const c = await setup();
    const { code } = await approved(c);
    expect(c.sent).toHaveLength(1);
    expect(c.sent[0].to).toBe('ana@x.com');
    expect(c.sent[0].text).toContain(code);
  });
});

describe('force-reset', () => {
  it('admin gera código direto; invalida pedidos anteriores', async () => {
    const c = await setup();
    const { code: old } = await approved(c);
    const id = (c.db.prepare("select id from users where email='ana@x.com'").get() as any).id;
    const r = await post(c, `/api/admin/users/${id}/force-reset`, undefined, c.admin);
    expect(r.statusCode).toBe(200);
    expect((await reset(c, 'ana@x.com', old)).statusCode).toBe(400);
    expect((await reset(c, 'ana@x.com', r.json().code)).statusCode).toBe(200);
  });
});
