import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createMap, children, mindmapSchema, subtreeIds, type MindMap } from '@cerebro/shared';
import { fail } from '../../errors';
import { requirePermission, requireUser } from '../auth/guard';
import { cleanTitle, createNote, resolveLinks } from '../notes/repo';
import { createItem } from '../items/repo';

function parseGraph(g: unknown): MindMap {
  const r = mindmapSchema.safeParse(g);
  if (!r.success) fail(400, 'INVALID_MAP', 'Mapa mental inválido: ' + r.error.issues.map(i => i.message).slice(0, 3).join('; '));
  return r.data as MindMap;
}

export async function mindmapRoutes(app: FastifyInstance) {
  const deps = app.deps;
  const { db } = deps;
  const read = requireUser(app);
  const write = requirePermission(app, 'notes.write');
  const dto = (r: any) => ({ id: r.id, title: r.title, graph: JSON.parse(r.graph_json) as MindMap, updatedAt: r.updated_at });
  const get = (uid: string, id: string) => (db.prepare('select * from mindmaps where id=? and user_id=?').get(id, uid) as any) ?? fail(404, 'NOT_FOUND', 'Mapa não encontrado');

  app.get('/api/mindmaps', { preHandler: read }, async (req) => ({
    mindmaps: (db.prepare('select id, title, updated_at from mindmaps where user_id=? order by updated_at desc, rowid desc').all(req.user!.id) as any[])
      .map(r => ({ id: r.id, title: r.title, updatedAt: r.updated_at })),
  }));

  app.post('/api/mindmaps', { preHandler: write }, async (req) => {
    const b = z.object({ title: z.string().trim().min(1).max(200), graph: z.unknown().optional() }).parse(req.body);
    const graph = b.graph === undefined ? createMap(b.title) : parseGraph(b.graph);
    const id = randomUUID();
    db.prepare('insert into mindmaps(id,user_id,title,graph_json,updated_at) values(?,?,?,?,?)')
      .run(id, req.user!.id, b.title, JSON.stringify(graph), deps.now().toISOString());
    return { mindmap: dto(get(req.user!.id, id)) };
  });

  app.get('/api/mindmaps/:id', { preHandler: read }, async (req) => ({ mindmap: dto(get(req.user!.id, (req.params as any).id)) }));

  app.put('/api/mindmaps/:id', { preHandler: write }, async (req) => {
    const cur = get(req.user!.id, (req.params as any).id);
    const b = z.object({ title: z.string().trim().min(1).max(200).optional(), graph: z.unknown() }).parse(req.body);
    const graph = parseGraph(b.graph);
    db.prepare('update mindmaps set title=?, graph_json=?, updated_at=? where id=?')
      .run(b.title ?? cur.title, JSON.stringify(graph), deps.now().toISOString(), cur.id);
    return { mindmap: dto(get(req.user!.id, cur.id)) };
  });

  app.delete('/api/mindmaps/:id', { preHandler: write }, async (req) => {
    db.prepare('delete from mindmaps where id=?').run(get(req.user!.id, (req.params as any).id).id);
    return { ok: true };
  });

  app.post('/api/mindmaps/:id/to-notes', { preHandler: write }, async (req) => {
    const uid = req.user!.id;
    const b = z.object({ nodeId: z.string(), as: z.enum(['notes', 'tasks']) }).parse(req.body);
    const graph = parseGraph(dto(get(uid, (req.params as any).id)).graph);
    if (!graph.nodes[b.nodeId]) fail(404, 'NOT_FOUND', 'Nó não encontrado');
    const ids = subtreeIds(graph, b.nodeId);

    if (b.as === 'tasks') {
      if (!req.user!.permissions.includes('items.write')) fail(403, 'FORBIDDEN', 'Sem permissão para criar tarefas');
      let projectId = '';
      deps.db.transaction(() => {
        for (const id of ids) {
          const text = graph.nodes[id].text.trim() || 'Sem título';
          if (id === b.nodeId) projectId = createItem(deps, uid, { title: text, kind: 'project', status: 'next' }).id;
          else createItem(deps, uid, { title: text, kind: 'task', status: 'inbox', projectId });
        }
      })();
      return { created: ids.length, projectId };
    }

    // Notas: um título único por nó (dentro do ramo e entre as notas já existentes do usuário).
    const taken = new Set((db.prepare('select lower(title) t from notes where user_id=?').all(uid) as { t: string }[]).map(r => r.t));
    const title = new Map<string, string>();
    for (const id of ids) {
      const base = cleanTitle(graph.nodes[id].text) || 'Sem título';
      let t = base;
      for (let i = 2; taken.has(t.toLowerCase()); i++) t = `${base} (${i})`;
      taken.add(t.toLowerCase());
      title.set(id, t);
    }
    let rootNoteId = '';
    deps.db.transaction(() => {
      for (const id of ids) {
        const kids = children(graph, id).map(c => `- [[${title.get(c.id)}]]`);
        const body = `# ${title.get(id)}\n\n${kids.join('\n')}${kids.length ? '\n' : ''}`;
        const note = createNote(deps, uid, { title: title.get(id)!, body, path: `Mapas/${title.get(id)}` }, false);
        if (id === b.nodeId) rootNoteId = note.id;
      }
      resolveLinks(deps, uid);
    })();
    return { created: ids.length, rootNoteId };
  });
}
