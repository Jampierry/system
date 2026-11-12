import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { fail } from '../../errors';
import { requirePermission, requireUser } from '../auth/guard';
import { backlinks, graph, search, unlinkedMentions } from './graph';
import { FORBIDDEN_TITLE, createNote, deleteNote, getNote, renderTemplate, toNote, updateNote } from './repo';
import { exportZip, importFiles } from './transfer';

const title = z.string().trim().min(1, 'Informe um título').max(200).refine(t => !FORBIDDEN_TITLE.test(t), 'O título não pode conter [ ] | # ^ \\ / : * ? " < >');
const MAX_BODY = 2 * 1024 * 1024;
const body = z.string().max(MAX_BODY);

export async function noteRoutes(app: FastifyInstance) {
  const deps = app.deps;
  const { db } = deps;
  const read = requireUser(app);
  const write = requirePermission(app, 'notes.write');
  const dto = (r: any, withBody = true) => toNote(deps, r, withBody);

  app.get('/api/notes', { preHandler: read }, async (req) => {
    const q = req.query as { tag?: string; area?: string; daily?: string };
    const where = ['user_id = ?'];
    const args: unknown[] = [req.user!.id];
    if (q.area) { where.push('area_id = ?'); args.push(q.area); }
    if (q.tag) { where.push('exists (select 1 from tags t where t.note_id = notes.id and t.tag = ?)'); args.push(q.tag.replace(/^#/, '').toLowerCase()); }
    if (q.daily === '1') where.push('is_daily = 1');
    const rows = db.prepare(`select * from notes where ${where.join(' and ')} order by updated_at desc, rowid desc limit 2000`).all(...args);
    return { notes: rows.map(r => dto(r, false)) };
  });

  app.post('/api/notes', { preHandler: write }, async (req) => {
    const b = z.object({ title, body: body.optional(), areaId: z.string().nullable().optional(), path: z.string().max(500).optional(), templateId: z.string().optional() }).parse(req.body);
    let content = b.body;
    if (b.templateId) {
      const t = db.prepare('select body_md from templates where id=? and user_id=?').get(b.templateId, req.user!.id) as { body_md: string } | undefined;
      if (!t) fail(400, 'INVALID_TEMPLATE', 'Template inexistente');
      content = renderTemplate(t!.body_md, { title: b.title, date: deps.now().toISOString().slice(0, 10) });
    }
    return { note: dto(createNote(deps, req.user!.id, { title: b.title, body: content, areaId: b.areaId, path: b.path })) };
  });

  app.post('/api/notes/daily', { preHandler: write }, async (req) => {
    const b = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d => !Number.isNaN(Date.parse(d)), 'Data inválida').optional() }).parse(req.body ?? {});
    const date = b.date ?? deps.now().toISOString().slice(0, 10);
    const uid = req.user!.id;
    const existing = db.prepare('select * from notes where user_id=? and is_daily=1 and title=?').get(uid, date);
    if (existing) return { note: dto(existing) };
    const t = db.prepare("select body_md from templates where user_id=? and name='Nota diária'").get(uid) as { body_md: string } | undefined;
    const content = renderTemplate(t?.body_md ?? '# {{date}}\n\n', { date, title: date });
    return { note: dto(createNote(deps, uid, { title: date, body: content, isDaily: true, path: `Diárias/${date}` })) };
  });

  app.get('/api/notes/:id', { preHandler: read }, async (req) => {
    const r = getNote(deps, req.user!.id, (req.params as any).id);
    const links = db.prepare('select dst_title t, dst_note_id d from links where src_note_id=?').all(r.id) as any[];
    return { note: { ...dto(r), links: links.map(l => ({ target: l.t, noteId: l.d })) } };
  });

  app.patch('/api/notes/:id', { preHandler: write }, async (req) => {
    const b = z.object({ title: title.optional(), body: body.optional(), areaId: z.string().nullable().optional() }).parse(req.body);
    return { note: dto(updateNote(deps, req.user!.id, (req.params as any).id, b)) };
  });

  app.delete('/api/notes/:id', { preHandler: write }, async (req) => {
    deleteNote(deps, req.user!.id, (req.params as any).id);
    return { ok: true };
  });

  app.get('/api/notes/:id/backlinks', { preHandler: read }, async (req) => {
    const r = getNote(deps, req.user!.id, (req.params as any).id);
    return { backlinks: backlinks(deps, req.user!.id, r.id) };
  });

  app.get('/api/notes/:id/unlinked', { preHandler: read }, async (req) => {
    const r = getNote(deps, req.user!.id, (req.params as any).id);
    return { mentions: unlinkedMentions(deps, req.user!.id, r.id, r.title) };
  });

  app.get('/api/graph', { preHandler: read }, async (req) => graph(deps, req.user!.id, req.query as any));
  app.get('/api/search', { preHandler: read }, async (req) => search(deps, req.user!.id, String((req.query as any).q ?? '')));

  // Templates
  const tdto = (r: any) => ({ id: r.id, name: r.name, body: r.body_md });
  const getT = (uid: string, id: string) => (db.prepare('select * from templates where id=? and user_id=?').get(id, uid) as any) ?? fail(404, 'NOT_FOUND', 'Template não encontrado');
  app.get('/api/templates', { preHandler: read }, async (req) => ({ templates: (db.prepare('select * from templates where user_id=? order by name').all(req.user!.id) as any[]).map(tdto) }));
  app.post('/api/templates', { preHandler: write }, async (req) => {
    const b = z.object({ name: z.string().trim().min(1), body: body.default('') }).parse(req.body);
    const id = randomUUID();
    db.prepare('insert into templates(id,user_id,name,body_md) values(?,?,?,?)').run(id, req.user!.id, b.name, b.body);
    return { template: tdto(getT(req.user!.id, id)) };
  });
  app.patch('/api/templates/:id', { preHandler: write }, async (req) => {
    const cur = getT(req.user!.id, (req.params as any).id);
    const b = z.object({ name: z.string().trim().min(1).optional(), body: body.optional() }).parse(req.body);
    db.prepare('update templates set name=?, body_md=? where id=?').run(b.name ?? cur.name, b.body ?? cur.body_md, cur.id);
    return { template: tdto(getT(req.user!.id, cur.id)) };
  });
  app.delete('/api/templates/:id', { preHandler: write }, async (req) => {
    db.prepare('delete from templates where id=?').run(getT(req.user!.id, (req.params as any).id).id);
    return { ok: true };
  });

  // Importar / exportar
  app.post('/api/import', { preHandler: write }, async (req) => {
    const b = z.object({
      files: z.array(z.object({ name: z.string(), content: z.string() })).default([]),
      zipBase64: z.string().optional(),
    }).parse(req.body);
    return importFiles(deps, req.user!.id, b.files, b.zipBase64);
  });

  app.get('/api/export', { preHandler: requirePermission(app, 'export.data') }, async (req, reply) => {
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', 'attachment; filename="segundo-cerebro.zip"')
      .send(exportZip(deps, req.user!.id));
  });
}
