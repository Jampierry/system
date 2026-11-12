import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Permission } from '@cerebro/shared';
import { fail } from '../../errors';
import { findSessionUser, type AuthUser } from './sessions';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
    token?: string;
  }
}

export function bearerToken(req: FastifyRequest): string | undefined {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7).trim() : undefined;
}

/** Autentica a requisição (sem checar permissão nem troca de senha obrigatória). */
export function requireAuth(app: FastifyInstance) {
  return async (req: FastifyRequest) => {
    const token = bearerToken(req);
    const user = token ? findSessionUser(app.deps, token) : null;
    if (!user) fail(401, 'UNAUTHENTICATED', 'Faça login para continuar');
    req.user = user!;
    req.token = token;
  };
}

/** Autentica e exige a permissão; bloqueia quem precisa trocar a senha. */
export function requirePermission(app: FastifyInstance, perm: Permission) {
  const auth = requireAuth(app);
  return async (req: FastifyRequest) => {
    await auth(req);
    const u = req.user!;
    if (u.mustChangePassword) fail(403, 'PASSWORD_CHANGE_REQUIRED', 'Troque a senha para continuar');
    if (!u.permissions.includes(perm)) fail(403, 'FORBIDDEN', 'Sem permissão para esta ação');
  };
}

/** Autentica e bloqueia quem precisa trocar a senha; sem exigir permissão específica (leitura). */
export function requireUser(app: FastifyInstance) {
  const auth = requireAuth(app);
  return async (req: FastifyRequest) => {
    await auth(req);
    if (req.user!.mustChangePassword) fail(403, 'PASSWORD_CHANGE_REQUIRED', 'Troque a senha para continuar');
  };
}

/** Autentica e exige ao menos uma das permissões (bloqueia quem precisa trocar a senha). */
export function requireAnyPermission(app: FastifyInstance, perms: Permission[]) {
  const auth = requireAuth(app);
  return async (req: FastifyRequest) => {
    await auth(req);
    const u = req.user!;
    if (u.mustChangePassword) fail(403, 'PASSWORD_CHANGE_REQUIRED', 'Troque a senha para continuar');
    if (!perms.some(p => u.permissions.includes(p))) fail(403, 'FORBIDDEN', 'Sem permissão para esta ação');
  };
}
