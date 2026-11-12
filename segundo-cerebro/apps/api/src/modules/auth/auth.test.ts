import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { makeApp, createUser, loginAs, bearer } from '../../test-utils';
import { hashPassword, verifyPassword } from './password';
import { newToken } from './tokens';
import { requirePermission } from './guard';

describe('password', () => {
  it('scrypt com salt por usuário', async () => {
    const a = await hashPassword('senha-bem-longa-1');
    const b = await hashPassword('senha-bem-longa-1');
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('senha-bem-longa-1', a)).toBe(true);
    expect(await verifyPassword('outra', a)).toBe(false);
  });
  it('newToken devolve token de 256 bits e o hash SHA-256', () => {
    const t = newToken();
    expect(Buffer.from(t.token, 'base64url')).toHaveLength(32);
    expect(t.hash).toBe(createHash('sha256').update(t.token).digest('hex'));
  });
});

describe('auth routes', () => {
  it('login correto devolve token e /me com permissões', async () => {
    const { app, db } = await makeApp();
    await createUser(db, { email: 'a@x.com', profile: 'admin' });
    const token = await loginAs(app, 'a@x.com');
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(token) });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.permissions).toContain('users.manage');
  });

  it('senha errada → 401 INVALID_CREDENTIALS e audita', async () => {
    const { app, db } = await makeApp();
    await createUser(db, { email: 'a@x.com' });
    const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@x.com', password: 'errada-errada' } });
    expect(r.statusCode).toBe(401);
    expect(r.json().error.code).toBe('INVALID_CREDENTIALS');
    expect(db.prepare("select count(*) c from audit_log where action='login.fail'").get()).toEqual({ c: 1 });
  });

  it('usuário bloqueado → 403 e sem token → 401', async () => {
    const { app, db } = await makeApp();
    await createUser(db, { email: 'l@x.com', status: 'locked' });
    const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'l@x.com', password: 'senha-bem-longa-1' } });
    expect(r.statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/auth/me' })).statusCode).toBe(401);
  });

  it('readonly sem permissão → 403 numa rota protegida', async () => {
    const { app, db } = await makeApp();
    app.get('/api/_probe', { preHandler: requirePermission(app, 'items.write') }, async () => ({ ok: true }));
    await createUser(db, { email: 'r@x.com', profile: 'readonly' });
    await createUser(db, { email: 'm@x.com', profile: 'member' });
    const r = await app.inject({ method: 'GET', url: '/api/_probe', headers: bearer(await loginAs(app, 'r@x.com')) });
    expect(r.statusCode).toBe(403);
    const m = await app.inject({ method: 'GET', url: '/api/_probe', headers: bearer(await loginAs(app, 'm@x.com')) });
    expect(m.statusCode).toBe(200);
  });

  it('6ª tentativa errada em 1 min → 429', async () => {
    const { app, db } = await makeApp();
    await createUser(db, { email: 'a@x.com' });
    const bad = () => app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@x.com', password: 'errada-errada' } });
    for (let i = 0; i < 5; i++) expect((await bad()).statusCode).toBe(401);
    expect((await bad()).statusCode).toBe(429);
  });

  it('token no banco é hash, nunca o enviado', async () => {
    const { app, db } = await makeApp();
    await createUser(db, { email: 'a@x.com' });
    const token = await loginAs(app, 'a@x.com');
    const rows = db.prepare('select token_hash from sessions').all() as { token_hash: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).not.toBe(token);
    expect(rows[0].token_hash).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('logout invalida a sessão; sessão expirada é recusada', async () => {
    const { app, db, clock } = await makeApp();
    await createUser(db, { email: 'a@x.com' });
    const t1 = await loginAs(app, 'a@x.com');
    await app.inject({ method: 'POST', url: '/api/auth/logout', headers: bearer(t1) });
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(t1) })).statusCode).toBe(401);
    const t2 = await loginAs(app, 'a@x.com');
    clock.t = new Date('2026-12-31T00:00:00Z');
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(t2) })).statusCode).toBe(401);
  });

  it('troca de senha: exige a atual, mínimo 10 e limpa mustChangePassword', async () => {
    const { app, db } = await makeApp();
    await createUser(db, { email: 'a@x.com', mustChange: true });
    const t = await loginAs(app, 'a@x.com');
    const h = bearer(t);
    const bad = await app.inject({ method: 'POST', url: '/api/auth/change-password', headers: h, payload: { currentPassword: 'x', newPassword: 'nova-senha-longa' } });
    expect(bad.statusCode).toBe(400);
    const short = await app.inject({ method: 'POST', url: '/api/auth/change-password', headers: h, payload: { currentPassword: 'senha-bem-longa-1', newPassword: 'curta' } });
    expect(short.statusCode).toBe(400);
    const ok = await app.inject({ method: 'POST', url: '/api/auth/change-password', headers: h, payload: { currentPassword: 'senha-bem-longa-1', newPassword: 'nova-senha-longa' } });
    expect(ok.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: h })).statusCode).toBe(401); // sessões antigas revogadas
    expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(ok.json().token) })).json().user.mustChangePassword).toBe(false);
    await loginAs(app, 'a@x.com', 'nova-senha-longa');
  });

  it('mustChangePassword bloqueia rotas protegidas por permissão', async () => {
    const { app, db } = await makeApp();
    app.get('/api/_probe', { preHandler: requirePermission(app, 'items.write') }, async () => ({ ok: true }));
    await createUser(db, { email: 'a@x.com', mustChange: true });
    const r = await app.inject({ method: 'GET', url: '/api/_probe', headers: bearer(await loginAs(app, 'a@x.com')) });
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('setup: só funciona sem usuários', async () => {
    const { app, db } = await makeApp();
    expect((await app.inject({ method: 'GET', url: '/api/auth/setup-status' })).json()).toEqual({ needsSetup: true });
    const payload = { name: 'Dono', email: 'dono@x.com', password: 'senha-bem-longa-1' };
    const r = await app.inject({ method: 'POST', url: '/api/auth/setup', payload });
    expect(r.statusCode).toBe(200);
    await loginAs(app, 'dono@x.com');
    expect((await app.inject({ method: 'POST', url: '/api/auth/setup', payload: { ...payload, email: 'o@x.com' } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'GET', url: '/api/auth/setup-status' })).json()).toEqual({ needsSetup: false });
    void db;
  });
});
