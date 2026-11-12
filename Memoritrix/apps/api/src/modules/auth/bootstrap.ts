import { randomUUID } from 'node:crypto';
import { SYSTEM_PROFILES, SYSTEM_PROFILE_NAMES } from '@cerebro/shared';
import type { Db } from '../../db/connection';
import type { Config } from '../../config';
import { hashPassword } from './password';

export function ensureSystemProfiles(db: Db): void {
  const ins = db.prepare('insert or ignore into profiles(id,name,description,permissions_json,is_system) values(?,?,?,?,1)');
  const desc = { admin: 'Acesso total, inclusive administração', member: 'Uso normal do app', readonly: 'Apenas leitura' };
  for (const k of ['admin', 'member', 'readonly'] as const) {
    ins.run(`sys-${k}`, SYSTEM_PROFILE_NAMES[k], desc[k], JSON.stringify(SYSTEM_PROFILES[k]));
  }
}

export async function createAdminUser(db: Db, o: { email: string; name: string; password: string }): Promise<string> {
  const id = randomUUID();
  db.prepare(
    'insert into users(id,email,name,password_hash,profile_id,status,must_change_password,created_at) values(?,?,?,?,?,?,0,?)',
  ).run(id, o.email.toLowerCase(), o.name, await hashPassword(o.password), 'sys-admin', 'active', new Date().toISOString());
  return id;
}

/** Cria o primeiro administrador a partir do ambiente, se ainda não existe nenhum usuário. */
export async function ensureAdmin(db: Db, cfg: Config): Promise<void> {
  const n = (db.prepare('select count(*) c from users').get() as { c: number }).c;
  if (n > 0 || !cfg.adminEmail || !cfg.adminPassword) return;
  await createAdminUser(db, { email: cfg.adminEmail, name: 'Administrador', password: cfg.adminPassword });
}
