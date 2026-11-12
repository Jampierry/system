import { randomUUID } from 'node:crypto';
import type { Deps } from '../../deps';
import { newToken, hashToken } from '../auth/tokens';
import { logAudit } from '../admin/audit';

export const RECOVERY_TTL_MS = 60 * 60_000;

/** Marca como expiradas as solicitações abertas (pendentes/aprovadas) de um usuário. */
export function expireOpen(deps: Deps, userId: string): void {
  deps.db
    .prepare("update password_recovery set status='expired', resolved_at=? where user_id=? and status in ('pending','approved')")
    .run(deps.now().toISOString(), userId);
}

/** Cria uma solicitação aprovada e devolve o código em claro (mostrado uma única vez). */
export async function issueCode(deps: Deps, userId: string, adminId: string, existingId?: string): Promise<{ id: string; code: string }> {
  const { token, hash } = newToken();
  const now = deps.now();
  const exp = new Date(now.getTime() + RECOVERY_TTL_MS).toISOString();
  const id = existingId ?? randomUUID();
  if (existingId) {
    deps.db
      .prepare("update password_recovery set status='approved', token_hash=?, resolved_by=?, resolved_at=?, expires_at=? where id=?")
      .run(hash, adminId, now.toISOString(), exp, id);
  } else {
    deps.db
      .prepare("insert into password_recovery(id,user_id,status,token_hash,requested_at,resolved_by,resolved_at,expires_at) values(?,?,'approved',?,?,?,?,?)")
      .run(id, userId, hash, now.toISOString(), adminId, now.toISOString(), exp);
  }
  return { id, code: token };
}

export async function mailCode(deps: Deps, email: string, code: string): Promise<void> {
  if (!deps.mailer) return;
  try {
    await deps.mailer.send(
      email,
      'Código para redefinir sua senha',
      `Use este código para redefinir sua senha (vale por 1 hora):\n\n${code}\n\nSe você não pediu, ignore este e-mail.`,
    );
  } catch (e) {
    logAudit(deps, null, 'recovery.mail-fail', email, { message: String((e as Error).message) });
  }
}

export { hashToken };
