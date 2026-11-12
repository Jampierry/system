import { describe, it, expect } from 'vitest';
import { makeApp, createUser, loginAs, bearer, type TestCtx } from '../../test-utils';

async function setup() {
  const ctx = await makeApp();
  const adminId = await createUser(ctx.db, { email: 'admin@x.com', profile: 'admin' });
  await createUser(ctx.db, { email: 'membro@x.com', profile: 'member' });
  const admin = bearer(await loginAs(ctx.app, 'admin@x.com'));
  const member = bearer(await loginAs(ctx.app, 'membro@x.com'));
  return { ...ctx, adminId, admin, member };
}
const call = (c: TestCtx, method: string, url: string, headers: any, payload?: any) =>
  c.app.inject({ method: method as any, url, headers, payload });
const profileId = (c: TestCtx, name: string) => (c.db.prepare('select id from profiles where name=?').get(name) as any).id;

describe('admin: usuários', () => {
  it('membro recebe 403', async () => {
    const c = await setup();
    expect((await call(c, 'GET', '/api/admin/users', c.member)).statusCode).toBe(403);
    expect((await call(c, 'GET', '/api/admin/profiles', c.member)).statusCode).toBe(403);
    expect((await call(c, 'GET', '/api/admin/audit', c.member)).statusCode).toBe(403);
  });

  it('admin cria usuário; senha temporária loga e força troca', async () => {
    const c = await setup();
    const r = await call(c, 'POST', '/api/admin/users', c.admin, { name: 'Ana', email: 'Ana@X.com', profileId: profileId(c, 'Membro') });
    expect(r.statusCode).toBe(200);
    const { user, temporaryPassword } = r.json();
    expect(user.email).toBe('ana@x.com');
    expect(temporaryPassword.length).toBeGreaterThanOrEqual(10);
    const token = await loginAs(c.app, 'ana@x.com', temporaryPassword);
    const me = await call(c, 'GET', '/api/auth/me', bearer(token));
    expect(me.json().user.mustChangePassword).toBe(true);
    expect(c.db.prepare("select count(*) c from audit_log where action='user.create'").get()).toEqual({ c: 1 });
  });

  it('e-mail repetido → 409', async () => {
    const c = await setup();
    const r = await call(c, 'POST', '/api/admin/users', c.admin, { name: 'X', email: 'membro@x.com', profileId: profileId(c, 'Membro') });
    expect(r.statusCode).toBe(409);
  });

  it('bloquear revoga sessões; desbloquear permite login', async () => {
    const c = await setup();
    const id = (c.db.prepare("select id from users where email='membro@x.com'").get() as any).id;
    expect((await call(c, 'PATCH', `/api/admin/users/${id}`, c.admin, { status: 'locked' })).statusCode).toBe(200);
    expect((await call(c, 'GET', '/api/auth/me', c.member)).statusCode).toBe(401);
    expect((await c.app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'membro@x.com', password: 'senha-bem-longa-1' } })).statusCode).toBe(403);
    await call(c, 'PATCH', `/api/admin/users/${id}`, c.admin, { status: 'active' });
    await loginAs(c.app, 'membro@x.com');
  });

  it('revoke-sessions encerra sessões do usuário', async () => {
    const c = await setup();
    const id = (c.db.prepare("select id from users where email='membro@x.com'").get() as any).id;
    await call(c, 'POST', `/api/admin/users/${id}/revoke-sessions`, c.admin);
    expect((await call(c, 'GET', '/api/auth/me', c.member)).statusCode).toBe(401);
  });

  it('último admin não pode se bloquear, excluir ou rebaixar (409 LAST_ADMIN)', async () => {
    const c = await setup();
    const url = `/api/admin/users/${c.adminId}`;
    for (const r of [
      await call(c, 'PATCH', url, c.admin, { status: 'locked' }),
      await call(c, 'DELETE', url, c.admin),
      await call(c, 'PATCH', url, c.admin, { profileId: profileId(c, 'Membro') }),
    ]) {
      expect(r.statusCode).toBe(409);
      expect(r.json().error.code).toBe('LAST_ADMIN');
    }
  });

  it('com outro admin ativo, ainda recusa ação sobre si mesmo (SELF_ACTION)', async () => {
    const c = await setup();
    await createUser(c.db, { email: 'admin2@x.com', profile: 'admin' });
    const r = await call(c, 'PATCH', `/api/admin/users/${c.adminId}`, c.admin, { status: 'locked' });
    expect(r.statusCode).toBe(409);
    expect(r.json().error.code).toBe('SELF_ACTION');
    // mas pode bloquear o outro
    const other = (c.db.prepare("select id from users where email='admin2@x.com'").get() as any).id;
    expect((await call(c, 'PATCH', `/api/admin/users/${other}`, c.admin, { status: 'locked' })).statusCode).toBe(200);
  });

  it('excluir é soft e esconde da lista', async () => {
    const c = await setup();
    const id = (c.db.prepare("select id from users where email='membro@x.com'").get() as any).id;
    expect((await call(c, 'DELETE', `/api/admin/users/${id}`, c.admin)).statusCode).toBe(200);
    const list = (await call(c, 'GET', '/api/admin/users', c.admin)).json().users;
    expect(list.map((u: any) => u.email)).not.toContain('membro@x.com');
    expect((c.db.prepare('select deleted_at from users where id=?').get(id) as any).deleted_at).toBeTruthy();
  });
});

describe('admin: perfis', () => {
  it('perfil de sistema não é removível; Administrador não perde permissões', async () => {
    const c = await setup();
    const r = await call(c, 'DELETE', `/api/admin/profiles/${profileId(c, 'Membro')}`, c.admin);
    expect(r.statusCode).toBe(409);
    const e = await call(c, 'PATCH', `/api/admin/profiles/${profileId(c, 'Administrador')}`, c.admin, { permissions: ['notes.write'] });
    expect(e.statusCode).toBe(409);
  });

  it('CRUD de perfil customizado e efeito no /me', async () => {
    const c = await setup();
    const created = await call(c, 'POST', '/api/admin/profiles', c.admin, { name: 'Leitor+', description: 'x', permissions: ['export.data'] });
    expect(created.statusCode).toBe(200);
    const pid = created.json().profile.id;
    await call(c, 'POST', '/api/admin/users', c.admin, { name: 'L', email: 'l@x.com', profileId: pid });
    await createUser(c.db, { email: 'p@x.com', profile: 'member' });
    const id = (c.db.prepare("select id from users where email='p@x.com'").get() as any).id;
    await call(c, 'PATCH', `/api/admin/users/${id}`, c.admin, { profileId: pid });
    const t = bearer(await loginAs(c.app, 'p@x.com'));
    expect((await call(c, 'GET', '/api/auth/me', t)).json().user.permissions).toEqual(['export.data']);
    await call(c, 'PATCH', `/api/admin/profiles/${pid}`, c.admin, { permissions: ['export.data', 'notes.write'] });
    expect((await call(c, 'GET', '/api/auth/me', t)).json().user.permissions).toEqual(['export.data', 'notes.write']);
    // em uso → não remove
    expect((await call(c, 'DELETE', `/api/admin/profiles/${pid}`, c.admin)).statusCode).toBe(409);
  });

  it('rejeita permissão desconhecida e nome repetido', async () => {
    const c = await setup();
    expect((await call(c, 'POST', '/api/admin/profiles', c.admin, { name: 'Z', permissions: ['voar'] })).statusCode).toBe(400);
    expect((await call(c, 'POST', '/api/admin/profiles', c.admin, { name: 'Membro', permissions: [] })).statusCode).toBe(409);
  });
});

describe('admin: auditoria', () => {
  it('lista ações com ator e pagina', async () => {
    const c = await setup();
    await call(c, 'POST', '/api/admin/users', c.admin, { name: 'A', email: 'a@x.com', profileId: profileId(c, 'Membro') });
    const r = (await call(c, 'GET', '/api/admin/audit?limit=2', c.admin)).json();
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0]).toHaveProperty('action');
    expect(r.next).toBeTruthy();
    const r2 = (await call(c, 'GET', `/api/admin/audit?limit=50&before=${r.next}`, c.admin)).json();
    expect(r2.entries.every((e: any) => e.id < r.next)).toBe(true);
  });
});

describe('admin: sem escalada de privilégio', () => {
  /** Cria um gestor com um perfil customizado que só tem `perms`. */
  async function manager(c: Awaited<ReturnType<typeof setup>>, perms: string[], email = 'gestor@x.com') {
    const created = await call(c, 'POST', '/api/admin/profiles', c.admin, { name: 'Gestor ' + email, permissions: perms });
    await createUser(c.db, { email });
    c.db.prepare('update users set profile_id = ? where email = ?').run(created.json().profile.id, email);
    return { token: bearer(await loginAs(c.app, email)), profileId: created.json().profile.id as string };
  }
  const idOf = (c: any, email: string) => (c.db.prepare('select id from users where email=?').get(email) as any).id;

  it('quem gerencia usuários lista perfis (para atribuir), mas não os altera', async () => {
    const c = await setup();
    const { token, profileId } = await manager(c, ['users.manage']);
    expect((await call(c, 'GET', '/api/admin/profiles', token)).statusCode).toBe(200);
    expect((await call(c, 'POST', '/api/admin/profiles', token, { name: 'X', permissions: [] })).statusCode).toBe(403);
    expect((await call(c, 'DELETE', `/api/admin/profiles/${profileId}`, token)).statusCode).toBe(403);
  });

  it('gestor de usuários cria membros, mas não atribui perfis administrativos que não possui', async () => {
    const c = await setup();
    const { token } = await manager(c, ['users.manage']);
    const ok = await call(c, 'POST', '/api/admin/users', token, { name: 'N', email: 'n@x.com', profileId: profileId(c, 'Membro') });
    expect(ok.statusCode).toBe(200);
    const bad = await call(c, 'POST', '/api/admin/users', token, { name: 'A', email: 'a2@x.com', profileId: profileId(c, 'Administrador') });
    expect(bad.statusCode).toBe(403);
    expect(bad.json().error.code).toBe('ESCALATION');
    // promover alguém por PATCH também é barrado
    const mid = idOf(c, 'membro@x.com');
    expect((await call(c, 'PATCH', `/api/admin/users/${mid}`, token, { profileId: profileId(c, 'Administrador') })).statusCode).toBe(403);
  });

  it('gestor de usuários não mexe em contas administrativas (bloquear, excluir, rebaixar, encerrar sessões)', async () => {
    const c = await setup();
    const { token } = await manager(c, ['users.manage']);
    const adminId = c.adminId;
    for (const r of [
      await call(c, 'PATCH', `/api/admin/users/${adminId}`, token, { status: 'locked' }),
      await call(c, 'PATCH', `/api/admin/users/${adminId}`, token, { profileId: profileId(c, 'Membro') }),
      await call(c, 'DELETE', `/api/admin/users/${adminId}`, token),
      await call(c, 'POST', `/api/admin/users/${adminId}/revoke-sessions`, token),
    ]) { expect(r.statusCode).toBe(403); expect(r.json().error.code).toBe('ESCALATION'); }
    expect((await call(c, 'GET', '/api/auth/me', c.admin)).statusCode).toBe(200); // admin segue logado
  });

  it('admin (com todas as permissões) continua podendo tudo', async () => {
    const c = await setup();
    const ok = await call(c, 'POST', '/api/admin/users', c.admin, { name: 'Outro', email: 'outro@x.com', profileId: profileId(c, 'Administrador') });
    expect(ok.statusCode).toBe(200);
  });
});
