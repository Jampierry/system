import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PERMISSIONS } from '@cerebro/shared';
import { fail } from '../../errors';
import { requirePermission } from '../auth/guard';
import { logAudit } from './audit';

const permsSchema = z.array(z.enum(PERMISSIONS));
const dto = (r: any) => ({
  id: r.id, name: r.name, description: r.description,
  permissions: JSON.parse(r.permissions_json), isSystem: !!r.is_system, users: r.n ?? 0,
});
const SELECT = 'select p.*, (select count(*) from users u where u.profile_id=p.id and u.deleted_at is null) n from profiles p';

export async function profileRoutes(app: FastifyInstance) {
  const deps = app.deps;
  const { db } = deps;
  const guard = requirePermission(app, 'profiles.manage');
  const get = (id: string) => (db.prepare(`${SELECT} where p.id = ?`).get(id) as any) ?? fail(404, 'NOT_FOUND', 'Perfil não encontrado');

  app.get('/api/admin/profiles', { preHandler: guard }, async () => ({
    profiles: (db.prepare(`${SELECT} order by is_system desc, name`).all() as any[]).map(dto),
  }));

  app.post('/api/admin/profiles', { preHandler: guard }, async (req) => {
    const b = z.object({ name: z.string().min(1), description: z.string().default(''), permissions: permsSchema }).parse(req.body);
    if (db.prepare('select 1 from profiles where name = ?').get(b.name)) fail(409, 'NAME_TAKEN', 'Já existe um perfil com este nome');
    const id = randomUUID();
    db.prepare('insert into profiles(id,name,description,permissions_json,is_system) values(?,?,?,?,0)')
      .run(id, b.name, b.description, JSON.stringify(b.permissions));
    logAudit(deps, req.user!.id, 'profile.create', b.name);
    return { profile: dto(get(id)) };
  });

  app.patch('/api/admin/profiles/:id', { preHandler: guard }, async (req) => {
    const { id } = req.params as { id: string };
    const b = z.object({ name: z.string().min(1).optional(), description: z.string().optional(), permissions: permsSchema.optional() }).parse(req.body);
    const cur = get(id);
    if (cur.is_system && (b.name !== undefined && b.name !== cur.name)) fail(409, 'SYSTEM_PROFILE', 'Perfis de sistema não podem ser renomeados');
    if (id === 'sys-admin' && b.permissions) fail(409, 'SYSTEM_PROFILE', 'O perfil Administrador não pode perder permissões');
    if (b.name && b.name !== cur.name && db.prepare('select 1 from profiles where name = ?').get(b.name)) fail(409, 'NAME_TAKEN', 'Já existe um perfil com este nome');
    db.prepare('update profiles set name=?, description=?, permissions_json=? where id=?')
      .run(b.name ?? cur.name, b.description ?? cur.description, b.permissions ? JSON.stringify(b.permissions) : cur.permissions_json, id);
    logAudit(deps, req.user!.id, 'profile.update', cur.name, b);
    return { profile: dto(get(id)) };
  });

  app.delete('/api/admin/profiles/:id', { preHandler: guard }, async (req) => {
    const { id } = req.params as { id: string };
    const cur = get(id);
    if (cur.is_system) fail(409, 'SYSTEM_PROFILE', 'Perfis de sistema não podem ser removidos');
    if (cur.n > 0) fail(409, 'PROFILE_IN_USE', 'Há usuários usando este perfil');
    db.prepare('delete from profiles where id = ?').run(id);
    logAudit(deps, req.user!.id, 'profile.delete', cur.name);
    return { ok: true };
  });
}
