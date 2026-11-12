import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { loginSchema, passwordSchema, emailSchema } from '@cerebro/shared';
import { fail } from '../../errors';
import { logAudit } from '../admin/audit';
import { hashPassword, verifyPassword } from './password';
import { createSession, deleteSession, loadUser, revokeUserSessions } from './sessions';
import { requireAuth } from './guard';
import { createAdminUser } from './bootstrap';

const MAX_FAILS = 5;
const WINDOW_MS = 60_000;

export async function authRoutes(app: FastifyInstance) {
  const deps = app.deps;
  const { db } = deps;
  const auth = requireAuth(app);

  app.get('/api/auth/setup-status', async () => ({
    needsSetup: (db.prepare('select count(*) c from users').get() as { c: number }).c === 0,
  }));

  app.post('/api/auth/setup', async (req) => {
    const body = z.object({ name: z.string().min(1), email: emailSchema, password: passwordSchema }).parse(req.body);
    if ((db.prepare('select count(*) c from users').get() as { c: number }).c > 0) fail(409, 'ALREADY_SETUP', 'O sistema já foi configurado');
    const id = await createAdminUser(db, body);
    logAudit(deps, id, 'setup.admin', body.email);
    return { ok: true };
  });

  app.post('/api/auth/login', async (req) => {
    const { email, password } = loginSchema.parse(req.body);
    const since = new Date(deps.now().getTime() - WINDOW_MS).toISOString();
    const fails = (db.prepare("select count(*) c from audit_log where action='login.fail' and target=? and at > ?").get(email, since) as { c: number }).c;
    if (fails >= MAX_FAILS) fail(429, 'RATE_LIMITED', 'Muitas tentativas. Aguarde um minuto.');

    const row = db.prepare('select id, password_hash, status, deleted_at from users where email = ?').get(email) as any;
    const valid = await verifyPassword(password, row?.password_hash ?? 'scrypt$AAAA$AAAA');
    if (!row || row.deleted_at || !valid) {
      logAudit(deps, null, 'login.fail', email);
      fail(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos');
    }
    if (row.status !== 'active') {
      logAudit(deps, row.id, 'login.blocked', email);
      fail(403, 'ACCOUNT_LOCKED', 'Conta bloqueada. Procure um administrador.');
    }
    db.prepare('update users set last_login_at = ? where id = ?').run(deps.now().toISOString(), row.id);
    const token = createSession(deps, row.id, req.headers['user-agent']);
    logAudit(deps, row.id, 'login.ok', email);
    return { token, user: loadUser(deps, row.id) };
  });

  app.post('/api/auth/logout', { preHandler: auth }, async (req) => {
    deleteSession(deps, req.token!);
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: auth }, async (req) => ({ user: req.user }));

  app.post('/api/auth/change-password', { preHandler: auth }, async (req) => {
    const { currentPassword, newPassword } = z.object({ currentPassword: z.string(), newPassword: passwordSchema }).parse(req.body);
    const u = req.user!;
    const row = db.prepare('select password_hash from users where id = ?').get(u.id) as { password_hash: string };
    if (!(await verifyPassword(currentPassword, row.password_hash))) fail(400, 'WRONG_PASSWORD', 'Senha atual incorreta');
    db.prepare('update users set password_hash = ?, must_change_password = 0 where id = ?').run(await hashPassword(newPassword), u.id);
    revokeUserSessions(deps, u.id);
    const token = createSession(deps, u.id, req.headers['user-agent']);
    logAudit(deps, u.id, 'password.change', u.email);
    return { ok: true, token };
  });
}
