import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { fail } from '../../errors';
import { requirePermission, requireUser } from '../auth/guard';
import { createItem, getItem, listItems, logEntry, toItem, updateItem } from './repo';

const iso = z.string().datetime({ offset: true }).nullable();
const base = {
  body: z.string().optional(),
  kind: z.enum(['task', 'event', 'idea', 'checklist', 'project']).optional(),
  status: z.enum(['inbox', 'next', 'waiting', 'someday', 'done', 'trashed']).optional(),
  areaId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  dueAt: iso.optional(), startAt: iso.optional(), endAt: iso.optional(),
  recurrence: z.string().nullable().optional(),
  waitingOn: z.string().nullable().optional(),
};
const createSchema = z.object({ title: z.string().trim().min(1, 'Informe um título'), ...base });
const patchSchema = z.object({ title: z.string().trim().min(1).optional(), ...base });
const areaSchema = z.object({ name: z.string().trim().min(1), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() });
const ACTIVE = "status not in ('done','trashed')";

export async function itemRoutes(app: FastifyInstance) {
  const deps = app.deps;
  const { db } = deps;
  const read = requireUser(app);
  const write = requirePermission(app, 'items.write');
  const dto = (r: any) => toItem(deps, r);

  app.post('/api/items', { preHandler: write }, async (req) => ({ item: dto(createItem(deps, req.user!.id, createSchema.parse(req.body))) }));

  app.get('/api/items', { preHandler: read }, async (req) => {
    const q = req.query as Record<string, string | undefined>;
    return { items: listItems(deps, req.user!.id, q).map(dto) };
  });

  app.get('/api/items/counts', { preHandler: read }, async (req) => {
    const rows = db.prepare('select status, count(*) n from items where user_id=? group by status').all(req.user!.id) as { status: string; n: number }[];
    const counts: Record<string, number> = { inbox: 0, next: 0, waiting: 0, someday: 0, done: 0 };
    for (const r of rows) counts[r.status] = r.n;
    return { counts };
  });

  app.patch('/api/items/:id', { preHandler: write }, async (req) => {
    const r = updateItem(deps, req.user!.id, (req.params as any).id, patchSchema.parse(req.body));
    return { item: dto(r.item), ...(r.next ? { next: dto(r.next) } : {}) };
  });

  app.delete('/api/items/:id', { preHandler: write }, async (req) => {
    const it = getItem(deps, req.user!.id, (req.params as any).id);
    db.prepare('delete from items where id=?').run(it.id);
    return { ok: true };
  });

  app.put('/api/items/:id/entries', { preHandler: write }, async (req) => {
    const it = getItem(deps, req.user!.id, (req.params as any).id);
    const { entries } = z.object({ entries: z.array(z.object({ text: z.string().trim().min(1), done: z.boolean().default(false) })).max(500) }).parse(req.body);
    db.transaction(() => {
      db.prepare('delete from checklist_entries where item_id=?').run(it.id);
      const ins = db.prepare('insert into checklist_entries(id,item_id,text,done,position) values(?,?,?,?,?)');
      entries.forEach((e, i) => ins.run(randomUUID(), it.id, e.text, e.done ? 1 : 0, i));
    })();
    return { item: dto(getItem(deps, req.user!.id, it.id)) };
  });

  // Áreas
  const areaDto = (r: any) => ({ id: r.id, name: r.name, color: r.color });
  const getArea = (uid: string, id: string) => (db.prepare('select * from areas where id=? and user_id=?').get(id, uid) as any) ?? fail(404, 'NOT_FOUND', 'Área não encontrada');
  app.get('/api/areas', { preHandler: read }, async (req) => ({ areas: (db.prepare('select * from areas where user_id=? order by name').all(req.user!.id) as any[]).map(areaDto) }));
  app.post('/api/areas', { preHandler: write }, async (req) => {
    const b = areaSchema.parse(req.body);
    const id = randomUUID();
    db.prepare('insert into areas(id,user_id,name,color) values(?,?,?,?)').run(id, req.user!.id, b.name, b.color ?? '#6366f1');
    return { area: areaDto(getArea(req.user!.id, id)) };
  });
  app.patch('/api/areas/:id', { preHandler: write }, async (req) => {
    const cur = getArea(req.user!.id, (req.params as any).id);
    const b = areaSchema.partial().parse(req.body);
    db.prepare('update areas set name=?, color=? where id=?').run(b.name ?? cur.name, b.color ?? cur.color, cur.id);
    return { area: areaDto(getArea(req.user!.id, cur.id)) };
  });
  app.delete('/api/areas/:id', { preHandler: write }, async (req) => {
    const cur = getArea(req.user!.id, (req.params as any).id);
    db.prepare('delete from areas where id=?').run(cur.id);
    return { ok: true };
  });

  // Calendário
  app.get('/api/calendar', { preHandler: read }, async (req) => {
    const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês inválido, use YYYY-MM').parse((req.query as any).month);
    const rows = db.prepare(
      `select * from items where user_id=? and status != 'trashed' and substr(coalesce(start_at, due_at),1,7) = ? order by coalesce(start_at, due_at)`,
    ).all(req.user!.id, month) as any[];
    const days: Record<string, number> = {};
    for (const r of rows) {
      if (r.status === 'done') continue;
      const day = String(r.start_at ?? r.due_at).slice(0, 10);
      days[day] = (days[day] ?? 0) + 1;
    }
    return { items: rows.map(dto), days };
  });

  // Revisão semanal
  app.get('/api/review/weekly', { preHandler: read }, async (req) => {
    const uid = req.user!.id;
    const by = (status: string) => (db.prepare("select * from items where user_id=? and status=? and kind!='project' order by created_at").all(uid, status) as any[]).map(dto);
    const projects = db.prepare(`select * from items where user_id=? and kind='project' and ${ACTIVE}`).all(uid) as any[];
    const hasNext = db.prepare("select 1 from items where project_id=? and status='next'");
    return {
      inbox: by('inbox'), waiting: by('waiting'), someday: by('someday'),
      projectsWithoutNext: projects.filter(p => !hasNext.get(p.id)).map(dto),
    };
  });

  app.post('/api/review/complete', { preHandler: write }, async (req) => {
    logEntry(deps, req.user!.id, 'review.done', null, 'Revisão semanal concluída');
    return { ok: true };
  });

  app.get('/api/logbook', { preHandler: read }, async (req) => {
    const limit = Math.min(Number((req.query as any).limit) || 100, 500);
    const rows = db.prepare('select * from logbook where user_id=? order by at desc, rowid desc limit ?').all(req.user!.id, limit) as any[];
    return { entries: rows.map(r => ({ id: r.id, at: r.at, kind: r.kind, refId: r.ref_id, summary: r.summary })) };
  });

}
