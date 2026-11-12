import { randomUUID } from 'node:crypto';
import { openDb, type Db } from './db/connection';
import { migrate } from './db/migrate';
import { loadConfig } from './config';
import { buildServer } from './server';
import { ensureSystemProfiles } from './modules/auth/bootstrap';
import { hashPassword } from './modules/auth/password';
import type { FastifyInstance } from 'fastify';
import type { Deps } from './deps';

export type TestCtx = { app: FastifyInstance; db: Db; clock: { t: Date }; deps: Deps };

export async function makeApp(extra: Partial<Deps> = {}): Promise<TestCtx> {
  const db = openDb(':memory:');
  migrate(db);
  ensureSystemProfiles(db);
  const clock = { t: new Date('2026-11-11T12:00:00Z') };
  const deps: Deps = { db, cfg: loadConfig({}), now: () => clock.t, ...extra };
  const app = await buildServer(deps);
  return { app, db, clock, deps };
}

export async function createUser(
  db: Db,
  o: { email: string; password?: string; profile?: 'admin' | 'member' | 'readonly'; status?: string; name?: string; mustChange?: boolean },
): Promise<string> {
  const id = randomUUID();
  const profileName = { admin: 'Administrador', member: 'Membro', readonly: 'Somente leitura' }[o.profile ?? 'member'];
  const p = db.prepare('select id from profiles where name = ?').get(profileName) as { id: string };
  db.prepare(
    'insert into users(id,email,name,password_hash,profile_id,status,must_change_password,created_at) values(?,?,?,?,?,?,?,?)',
  ).run(id, o.email, o.name ?? o.email, await hashPassword(o.password ?? 'senha-bem-longa-1'), p.id, o.status ?? 'active', o.mustChange ? 1 : 0, '2026-01-01T00:00:00Z');
  return id;
}

export async function loginAs(app: FastifyInstance, email: string, password = 'senha-bem-longa-1'): Promise<string> {
  const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
  if (r.statusCode !== 200) throw new Error('login falhou: ' + r.body);
  return r.json().token;
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
