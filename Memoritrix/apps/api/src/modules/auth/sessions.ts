import { randomUUID } from 'node:crypto';
import type { Deps } from '../../deps';
import { newToken, hashToken } from './tokens';
import type { Permission } from '@cerebro/shared';

export const SESSION_DAYS = 30;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  profile: { id: string; name: string };
  permissions: Permission[];
  mustChangePassword: boolean;
};

export function createSession(deps: Deps, userId: string, userAgent?: string): string {
  const { token, hash } = newToken();
  const now = deps.now();
  const exp = new Date(now.getTime() + SESSION_DAYS * 86400_000);
  deps.db
    .prepare('insert into sessions(id,user_id,token_hash,expires_at,user_agent,created_at) values(?,?,?,?,?,?)')
    .run(randomUUID(), userId, hash, exp.toISOString(), userAgent ?? null, now.toISOString());
  return token;
}

export function revokeUserSessions(deps: Pick<Deps, 'db'>, userId: string): void {
  deps.db.prepare('delete from sessions where user_id = ?').run(userId);
}

export function deleteSession(deps: Pick<Deps, 'db'>, token: string): void {
  deps.db.prepare('delete from sessions where token_hash = ?').run(hashToken(token));
}

export function loadUser(deps: Pick<Deps, 'db'>, userId: string): AuthUser | null {
  const r = deps.db
    .prepare(
      `select u.id, u.email, u.name, u.must_change_password m, u.status, u.deleted_at,
              p.id pid, p.name pname, p.permissions_json perms
       from users u join profiles p on p.id = u.profile_id where u.id = ?`,
    )
    .get(userId) as any;
  if (!r || r.deleted_at) return null;
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    profile: { id: r.pid, name: r.pname },
    permissions: JSON.parse(r.perms),
    mustChangePassword: !!r.m,
  };
}

export function findSessionUser(deps: Deps, token: string): AuthUser | null {
  const s = deps.db
    .prepare('select user_id, expires_at from sessions where token_hash = ?')
    .get(hashToken(token)) as { user_id: string; expires_at: string } | undefined;
  if (!s || s.expires_at <= deps.now().toISOString()) return null;
  const st = deps.db.prepare('select status from users where id = ?').get(s.user_id) as { status: string } | undefined;
  if (!st || st.status !== 'active') return null;
  return loadUser(deps, s.user_id);
}
