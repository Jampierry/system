import type { FastifyInstance } from 'fastify';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { emailSchema } from '@cerebro/shared';
import { fail } from '../../errors';
import { requirePermission } from '../auth/guard';
import { hashPassword } from '../auth/password';
import { revokeUserSessions } from '../auth/sessions';
import { logAudit } from './audit';
import { assertCanGrant, profilePerms, userProfilePerms } from './guards';

const dto = (r: any) => ({
  id: r.id, email: r.email, name: r.name, status: r.status,
  profile: { id: r.pid, name: r.pname },
  mustChangePassword: !!r.must_change_password,
  createdAt: r.created_at, lastLoginAt: r.last_login_at,
});

const SELECT = `select u.*, p.id pid, p.name pname from users u join profiles p on p.id = u.profile_id`;

export const tempPassword = () => randomBytes(12).toString('base64url');

export async function userRoutes(app: FastifyInstance) {
  const deps = app.deps;
  const { db } = deps;
  const guard = requirePermission(app, 'users.manage');

  /** Usuários ativos cujo perfil concede users.manage. */
  const activeAdminIds = (): string[] =>
    (db.prepare(`${SELECT} where u.status='active' and u.deleted_at is null`).all() as any[])
      .filter(r => (JSON.parse((db.prepare('select permissions_json p from profiles where id=?').get(r.pid) as any).p) as string[]).includes('users.manage'))
      .map(r => r.id);

  /** Impede ações que removeriam o último admin ou o próprio ator do poder de administrar. */
  function guardSelfAndLastAdmin(actorId: string, targetId: string) {
    const admins = activeAdminIds();
    if (admins.includes(targetId) && admins.length === 1) fail(409, 'LAST_ADMIN', 'Não é possível remover o último administrador');
    if (actorId === targetId) fail(409, 'SELF_ACTION', 'Você não pode fazer isso na própria conta');
  }

  const getUser = (id: string) => {
    const r = db.prepare(`${SELECT} where u.id = ? and u.deleted_at is null`).get(id);
    return r ?? fail(404, 'NOT_FOUND', 'Usuário não encontrado');
  };

  app.get('/api/admin/users', { preHandler: guard }, async (req) => {
    const q = String((req.query as any).q ?? '').trim().toLowerCase();
    const rows = db.prepare(`${SELECT} where u.deleted_at is null order by u.created_at, u.email`).all() as any[];
    const users = rows.filter(r => !q || r.email.includes(q) || r.name.toLowerCase().includes(q)).map(dto);
    return { users };
  });

  app.post('/api/admin/users', { preHandler: guard }, async (req) => {
    const b = z.object({ name: z.string().min(1), email: emailSchema, profileId: z.string() }).parse(req.body);
    if (db.prepare('select 1 from users where email = ?').get(b.email)) fail(409, 'EMAIL_TAKEN', 'Já existe um usuário com este e-mail');
    if (!db.prepare('select 1 from profiles where id = ?').get(b.profileId)) fail(400, 'INVALID_PROFILE', 'Perfil inexistente');
    assertCanGrant(req.user!, profilePerms(db, b.profileId));
    const id = randomUUID();
    const pw = tempPassword();
    db.prepare('insert into users(id,email,name,password_hash,profile_id,status,must_change_password,created_at) values(?,?,?,?,?,?,1,?)')
      .run(id, b.email, b.name, await hashPassword(pw), b.profileId, 'active', deps.now().toISOString());
    logAudit(deps, req.user!.id, 'user.create', b.email);
    return { user: dto(getUser(id)), temporaryPassword: pw };
  });

  app.patch('/api/admin/users/:id', { preHandler: guard }, async (req) => {
    const { id } = req.params as { id: string };
    const b = z.object({
      name: z.string().min(1).optional(),
      profileId: z.string().optional(),
      status: z.enum(['active', 'locked']).optional(),
    }).parse(req.body);
    const cur = getUser(id) as any;
    assertCanGrant(req.user!, userProfilePerms(db, id));
    if (b.profileId) assertCanGrant(req.user!, profilePerms(db, b.profileId));
    const demoting = b.profileId !== undefined && b.profileId !== cur.profile_id &&
      !(JSON.parse((db.prepare('select permissions_json p from profiles where id=?').get(b.profileId) as any)?.p ?? '[]') as string[]).includes('users.manage');
    if (b.status === 'locked' || demoting) guardSelfAndLastAdmin(req.user!.id, id);
    if (b.profileId && !db.prepare('select 1 from profiles where id = ?').get(b.profileId)) fail(400, 'INVALID_PROFILE', 'Perfil inexistente');
    db.prepare('update users set name = ?, profile_id = ?, status = ? where id = ?')
      .run(b.name ?? cur.name, b.profileId ?? cur.profile_id, b.status ?? cur.status, id);
    if (b.status === 'locked') revokeUserSessions(deps, id);
    logAudit(deps, req.user!.id, 'user.update', cur.email, b);
    return { user: dto(getUser(id)) };
  });

  app.post('/api/admin/users/:id/revoke-sessions', { preHandler: guard }, async (req) => {
    const { id } = req.params as { id: string };
    const cur = getUser(id) as any;
    assertCanGrant(req.user!, userProfilePerms(db, id));
    revokeUserSessions(deps, id);
    logAudit(deps, req.user!.id, 'user.revoke-sessions', cur.email);
    return { ok: true };
  });

  app.delete('/api/admin/users/:id', { preHandler: guard }, async (req) => {
    const { id } = req.params as { id: string };
    const cur = getUser(id) as any;
    assertCanGrant(req.user!, userProfilePerms(db, id));
    guardSelfAndLastAdmin(req.user!.id, id);
    // o e-mail é liberado para novo cadastro (único no banco); o original fica no log de auditoria
    db.prepare("update users set deleted_at = ?, status = 'locked', email = ? where id = ?").run(deps.now().toISOString(), `deleted+${id}+${cur.email}`, id);
    revokeUserSessions(deps, id);
    logAudit(deps, req.user!.id, 'user.delete', cur.email);
    return { ok: true };
  });
}
