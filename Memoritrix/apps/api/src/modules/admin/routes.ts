import type { FastifyInstance } from 'fastify';
import { requirePermission } from '../auth/guard';
import { userRoutes } from './users';
import { profileRoutes } from './profiles';

export async function adminRoutes(app: FastifyInstance) {
  await app.register(userRoutes);
  await app.register(profileRoutes);

  app.get('/api/admin/audit', { preHandler: requirePermission(app, 'audit.view') }, async (req) => {
    const q = req.query as { limit?: string; before?: string };
    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
    const before = q.before ? Number(q.before) : Number.MAX_SAFE_INTEGER;
    const rows = app.deps.db
      .prepare(`select a.id, a.actor_id, u.email actor_email, a.action, a.target, a.meta_json, a.at
                from audit_log a left join users u on u.id = a.actor_id where a.id < ? order by a.id desc limit ?`)
      .all(before, limit + 1) as any[];
    const page = rows.slice(0, limit);
    return {
      entries: page.map(r => ({ id: r.id, actorId: r.actor_id, actorEmail: r.actor_email, action: r.action, target: r.target, meta: r.meta_json ? JSON.parse(r.meta_json) : null, at: r.at })),
      next: rows.length > limit ? page[page.length - 1].id : null,
    };
  });
}
