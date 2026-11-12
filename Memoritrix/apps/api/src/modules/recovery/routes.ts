import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { emailSchema, passwordSchema } from '@cerebro/shared';
import { fail } from '../../errors';
import { requirePermission } from '../auth/guard';
import { hashPassword } from '../auth/password';
import { revokeUserSessions } from '../auth/sessions';
import { logAudit } from '../admin/audit';
import { assertCanGrant, userProfilePerms } from '../admin/guards';
import { expireOpen, issueCode, mailCode, hashToken } from './service';

const MAX_FAILS = 5;
const WINDOW_MS = 60_000;

export async function recoveryRoutes(app: FastifyInstance) {
  const deps = app.deps;
  const { db } = deps;
  const guard = requirePermission(app, 'recovery.manage');
  const userByEmail = (email: string) =>
    db.prepare("select id, email, status from users where email = ? and deleted_at is null").get(email) as { id: string; email: string; status: string } | undefined;

  // Resposta neutra: nunca revela se o e-mail existe.
  app.post('/api/auth/forgot', async (req, reply) => {
    const { email } = z.object({ email: emailSchema }).parse(req.body);
    const u = userByEmail(email);
    if (u && u.status === 'active' && !db.prepare("select 1 from password_recovery where user_id=? and status='pending'").get(u.id)) {
      db.prepare("insert into password_recovery(id,user_id,status,requested_at) values(?,?, 'pending', ?)")
        .run(crypto.randomUUID(), u.id, deps.now().toISOString());
      logAudit(deps, u.id, 'recovery.request', email);
    }
    return reply.status(202).send({ ok: true, message: 'Se o e-mail estiver cadastrado, um administrador analisará o pedido.' });
  });

  app.get('/api/admin/recovery', { preHandler: guard }, async (req) => {
    const status = (req.query as any).status as string | undefined;
    const rows = db
      .prepare(`select r.id, r.status, r.requested_at, r.resolved_at, r.expires_at, u.email, u.name
                from password_recovery r join users u on u.id = r.user_id
                where (? is null or r.status = ?) order by r.requested_at desc limit 200`)
      .all(status ?? null, status ?? null) as any[];
    return { requests: rows.map(r => ({ id: r.id, status: r.status, email: r.email, name: r.name, requestedAt: r.requested_at, resolvedAt: r.resolved_at, expiresAt: r.expires_at })) };
  });

  const getOpen = (id: string) => {
    const r = db.prepare('select r.*, u.email from password_recovery r join users u on u.id=r.user_id where r.id=?').get(id) as any;
    if (!r) fail(404, 'NOT_FOUND', 'Solicitação não encontrada');
    if (r.status !== 'pending') fail(409, 'NOT_PENDING', 'A solicitação já foi resolvida');
    return r;
  };

  app.post('/api/admin/recovery/:id/approve', { preHandler: guard }, async (req) => {
    const r = getOpen((req.params as any).id);
    assertCanGrant(req.user!, userProfilePerms(db, r.user_id));
    const { code } = await issueCode(deps, r.user_id, req.user!.id, r.id);
    logAudit(deps, req.user!.id, 'recovery.approve', r.email);
    await mailCode(deps, r.email, code);
    return { code, expiresInMinutes: 60 };
  });

  app.post('/api/admin/recovery/:id/deny', { preHandler: guard }, async (req) => {
    const r = getOpen((req.params as any).id);
    assertCanGrant(req.user!, userProfilePerms(db, r.user_id));
    db.prepare("update password_recovery set status='denied', resolved_by=?, resolved_at=? where id=?")
      .run(req.user!.id, deps.now().toISOString(), r.id);
    logAudit(deps, req.user!.id, 'recovery.deny', r.email);
    return { ok: true };
  });

  app.post('/api/admin/users/:id/force-reset', { preHandler: guard }, async (req) => {
    const id = (req.params as any).id as string;
    const u = db.prepare('select id, email from users where id=? and deleted_at is null').get(id) as any;
    if (!u) fail(404, 'NOT_FOUND', 'Usuário não encontrado');
    assertCanGrant(req.user!, userProfilePerms(db, id));
    expireOpen(deps, id);
    const { code } = await issueCode(deps, id, req.user!.id);
    logAudit(deps, req.user!.id, 'recovery.force', u.email);
    await mailCode(deps, u.email, code);
    return { code, expiresInMinutes: 60 };
  });

  app.post('/api/auth/reset', async (req) => {
    const { email, code, newPassword } = z.object({ email: emailSchema, code: z.string().min(1), newPassword: passwordSchema }).parse(req.body);
    const since = new Date(deps.now().getTime() - WINDOW_MS).toISOString();
    const fails = (db.prepare("select count(*) c from audit_log where action='recovery.reset-fail' and target=? and at > ?").get(email, since) as { c: number }).c;
    if (fails >= MAX_FAILS) fail(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um minuto.');

    const u = userByEmail(email);
    const row = u && (db
      .prepare("select id from password_recovery where user_id=? and status='approved' and token_hash=? and expires_at > ?")
      .get(u.id, hashToken(code), deps.now().toISOString()) as { id: string } | undefined);
    if (!u || !row || u.status !== 'active') {
      logAudit(deps, null, 'recovery.reset-fail', email);
      fail(400, 'INVALID_CODE', 'Código inválido ou expirado');
    }
    db.prepare('update users set password_hash=?, must_change_password=0 where id=?').run(await hashPassword(newPassword), u!.id);
    db.prepare("update password_recovery set status='used', resolved_at=? where id=?").run(deps.now().toISOString(), row!.id);
    expireOpen(deps, u!.id);
    revokeUserSessions(deps, u!.id);
    logAudit(deps, u!.id, 'recovery.reset', email);
    return { ok: true };
  });
}
