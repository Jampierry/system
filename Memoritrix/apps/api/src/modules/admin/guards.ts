import type { Permission } from '@cerebro/shared';
import type { Db } from '../../db/connection';
import { fail } from '../../errors';
import type { AuthUser } from '../auth/sessions';

/** Permissões que dão poder sobre outras contas. Só quem as possui pode concedê-las ou gerenciar quem as tem. */
export const ADMIN_PERMS: readonly Permission[] = ['users.manage', 'profiles.manage', 'recovery.manage', 'audit.view'];

export function profilePerms(db: Db, profileId: string): Permission[] {
  const r = db.prepare('select permissions_json p from profiles where id = ?').get(profileId) as { p: string } | undefined;
  return r ? (JSON.parse(r.p) as Permission[]) : [];
}

export function userProfilePerms(db: Db, userId: string): Permission[] {
  const r = db.prepare('select p.permissions_json p from users u join profiles p on p.id = u.profile_id where u.id = ?').get(userId) as { p: string } | undefined;
  return r ? (JSON.parse(r.p) as Permission[]) : [];
}

/**
 * Impede escalada de privilégio: o ator só pode conceder, alterar ou agir sobre contas/perfis
 * cujas permissões administrativas ele próprio possui.
 */
export function assertCanGrant(actor: AuthUser, perms: readonly Permission[]): void {
  const missing = perms.filter(p => ADMIN_PERMS.includes(p) && !actor.permissions.includes(p));
  if (missing.length) fail(403, 'ESCALATION', 'Você não pode conceder ou gerenciar permissões administrativas que não possui');
}
