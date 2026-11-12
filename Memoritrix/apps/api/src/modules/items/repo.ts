import { randomUUID } from 'node:crypto';
import type { Deps } from '../../deps';
import { ftsQuery } from '../../db/fts';
import { fail } from '../../errors';
import { nextOccurrence } from './recurrence';

export type ItemRow = Record<string, any>;

export function toItem(deps: Pick<Deps, 'db'>, r: ItemRow) {
  const item: Record<string, unknown> = {
    id: r.id, title: r.title, body: r.body, kind: r.kind, status: r.status,
    areaId: r.area_id, projectId: r.project_id, dueAt: r.due_at, startAt: r.start_at, endAt: r.end_at,
    recurrence: r.recurrence_rule, waitingOn: r.waiting_on, createdAt: r.created_at, completedAt: r.completed_at,
  };
  if (r.kind === 'checklist') {
    item.entries = deps.db.prepare('select id, text, done from checklist_entries where item_id=? order by position').all(r.id)
      .map((e: any) => ({ id: e.id, text: e.text, done: !!e.done }));
  }
  return item;
}

export function getItem(deps: Deps, userId: string, id: string): ItemRow {
  return (deps.db.prepare('select * from items where id=? and user_id=?').get(id, userId) as ItemRow) ?? fail(404, 'NOT_FOUND', 'Item não encontrado');
}

/** Garante que area/projeto referenciados pertencem ao usuário. */
export function assertOwned(deps: Deps, userId: string, areaId?: string | null, projectId?: string | null): void {
  if (areaId && !deps.db.prepare('select 1 from areas where id=? and user_id=?').get(areaId, userId)) fail(400, 'INVALID_AREA', 'Área inexistente');
  if (projectId && !deps.db.prepare("select 1 from items where id=? and user_id=? and kind='project'").get(projectId, userId)) fail(400, 'INVALID_PROJECT', 'Projeto inexistente');
}

export type NewItem = {
  title: string; body?: string; kind?: string; status?: string; areaId?: string | null; projectId?: string | null;
  dueAt?: string | null; startAt?: string | null; endAt?: string | null; recurrence?: string | null; waitingOn?: string | null;
};

export function createItem(deps: Deps, userId: string, n: NewItem): ItemRow {
  assertOwned(deps, userId, n.areaId, n.projectId);
  const id = randomUUID();
  deps.db.prepare(
    `insert into items(id,user_id,area_id,project_id,title,body,kind,status,due_at,start_at,end_at,recurrence_rule,waiting_on,created_at)
     values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(id, userId, n.areaId ?? null, n.projectId ?? null, n.title, n.body ?? '', n.kind ?? 'task', n.status ?? 'inbox',
    n.dueAt ?? null, n.startAt ?? null, n.endAt ?? null, n.recurrence ?? null, n.waitingOn ?? null, deps.now().toISOString());
  return getItem(deps, userId, id);
}

export function logEntry(deps: Deps, userId: string, kind: string, refId: string | null, summary: string): void {
  deps.db.prepare('insert into logbook(id,user_id,at,kind,ref_id,summary) values(?,?,?,?,?,?)')
    .run(randomUUID(), userId, deps.now().toISOString(), kind, refId, summary);
}

export function updateItem(deps: Deps, userId: string, id: string, p: Partial<NewItem>): { item: ItemRow; next?: ItemRow } {
  const cur = getItem(deps, userId, id);
  const has = (k: keyof NewItem) => Object.prototype.hasOwnProperty.call(p, k);
  assertOwned(deps, userId, has('areaId') ? p.areaId : null, has('projectId') ? p.projectId : null);
  const wasDone = cur.status === 'done';
  const status = p.status ?? cur.status;
  const completedAt = status === 'done' ? (cur.completed_at ?? deps.now().toISOString()) : null;
  deps.db.prepare(
    `update items set title=?, body=?, kind=?, status=?, area_id=?, project_id=?, due_at=?, start_at=?, end_at=?,
       recurrence_rule=?, waiting_on=?, completed_at=? where id=?`,
  ).run(p.title ?? cur.title, p.body ?? cur.body, p.kind ?? cur.kind, status,
    has('areaId') ? p.areaId ?? null : cur.area_id, has('projectId') ? p.projectId ?? null : cur.project_id,
    has('dueAt') ? p.dueAt ?? null : cur.due_at, has('startAt') ? p.startAt ?? null : cur.start_at,
    has('endAt') ? p.endAt ?? null : cur.end_at, has('recurrence') ? p.recurrence ?? null : cur.recurrence_rule,
    has('waitingOn') ? p.waitingOn ?? null : cur.waiting_on, completedAt, id);
  const item = getItem(deps, userId, id);
  let next: ItemRow | undefined;
  if (status === 'done' && !wasDone) {
    logEntry(deps, userId, 'item.done', id, `Concluído: ${item.title}`);
    const base = item.due_at ?? item.start_at;
    const when = item.recurrence_rule && base ? nextOccurrence(item.recurrence_rule, new Date(base)) : null;
    if (when) {
      const shift = item.due_at ? { dueAt: when.toISOString() } : { startAt: when.toISOString() };
      next = createItem(deps, userId, {
        title: item.title, body: item.body, kind: item.kind, status: 'next', areaId: item.area_id, projectId: item.project_id,
        recurrence: item.recurrence_rule, ...shift,
        ...(item.end_at && item.start_at ? { endAt: new Date(new Date(item.end_at).getTime() + (when.getTime() - new Date(item.start_at).getTime())).toISOString() } : {}),
      });
    }
  }
  return { item, next };
}

export function listItems(deps: Deps, userId: string, f: { status?: string; area?: string; project?: string; kind?: string; q?: string }): ItemRow[] {
  const where = ['i.user_id = ?'];
  const args: unknown[] = [userId];
  if (f.status) { where.push('i.status = ?'); args.push(f.status); }
  if (f.area) { where.push('i.area_id = ?'); args.push(f.area); }
  if (f.project) { where.push('i.project_id = ?'); args.push(f.project); }
  if (f.kind) { where.push('i.kind = ?'); args.push(f.kind); }
  let join = '';
  if (f.q) {
    const m = ftsQuery(f.q);
    if (!m) return [];
    join = 'join items_fts on items_fts.rowid = i.rowid';
    where.push('items_fts match ?');
    args.push(m);
  }
  return deps.db.prepare(`select i.* from items i ${join} where ${where.join(' and ')} order by i.created_at desc, i.rowid desc limit 500`).all(...args) as ItemRow[];
}
