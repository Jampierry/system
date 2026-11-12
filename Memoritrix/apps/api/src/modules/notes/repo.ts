import { randomUUID } from 'node:crypto';
import { parseNote, renameWikilinks } from '@cerebro/shared';
import type { Deps } from '../../deps';
import { fail } from '../../errors';

export type NoteRow = Record<string, any>;

export const FORBIDDEN_TITLE = /[\[\]|#^\\/:*?"<>]/;
export const cleanTitle = (s: string) => s.replace(/[\[\]|#^\\/:*?"<>]/g, '-').trim();

export function toNote(deps: Pick<Deps, 'db'>, r: NoteRow, withBody = true) {
  const tags = (deps.db.prepare('select tag from tags where note_id=? order by tag').all(r.id) as { tag: string }[]).map(t => t.tag);
  const n: Record<string, unknown> = {
    id: r.id, title: r.title, path: r.path, areaId: r.area_id, isDaily: !!r.is_daily,
    tags, createdAt: r.created_at, updatedAt: r.updated_at,
  };
  if (withBody) {
    n.body = r.body_md;
    n.frontmatter = JSON.parse(r.frontmatter_json);
  }
  return n;
}

export function getNote(deps: Deps, userId: string, id: string): NoteRow {
  return (deps.db.prepare('select * from notes where id=? and user_id=?').get(id, userId) as NoteRow) ?? fail(404, 'NOT_FOUND', 'Nota não encontrada');
}

/** Resolve dst_note_id de todos os links do usuário (título sem distinção de caixa; empate → nota mais antiga). */
export function resolveLinks(deps: Deps, userId: string): void {
  deps.db.prepare(
    `update links set dst_note_id = (
       select n.id from notes n where n.user_id = ? and lower(n.title) = lower(links.dst_title)
       order by n.created_at, n.rowid limit 1)
     where src_note_id in (select id from notes where user_id = ?)`,
  ).run(userId, userId);
}

/** Re-deriva links, tags e frontmatter de uma nota a partir do corpo. */
function derive(deps: Deps, noteId: string, body: string): void {
  const p = parseNote(body);
  const { db } = deps;
  db.prepare('delete from links where src_note_id=?').run(noteId);
  db.prepare('delete from tags where note_id=?').run(noteId);
  const insL = db.prepare('insert into links(src_note_id, dst_title) values(?,?)');
  for (const t of new Set(p.links.map(l => l.target))) insL.run(noteId, t);
  const insT = db.prepare('insert or ignore into tags(note_id, tag) values(?,?)');
  for (const t of p.tags) insT.run(noteId, t);
  db.prepare('update notes set frontmatter_json=? where id=?').run(JSON.stringify(p.frontmatter), noteId);
}

export type NewNote = { title: string; body?: string; areaId?: string | null; path?: string; isDaily?: boolean };

export function createNote(deps: Deps, userId: string, n: NewNote, resolve = true): NoteRow {
  if (n.areaId && !deps.db.prepare('select 1 from areas where id=? and user_id=?').get(n.areaId, userId)) fail(400, 'INVALID_AREA', 'Área inexistente');
  const id = randomUUID();
  const now = deps.now().toISOString();
  const body = n.body ?? '';
  deps.db.prepare('insert into notes(id,user_id,area_id,path,title,body_md,is_daily,created_at,updated_at) values(?,?,?,?,?,?,?,?,?)')
    .run(id, userId, n.areaId ?? null, n.path ?? n.title, n.title, body, n.isDaily ? 1 : 0, now, now);
  derive(deps, id, body);
  if (resolve) resolveLinks(deps, userId);
  return getNote(deps, userId, id);
}

export function updateNote(deps: Deps, userId: string, id: string, p: { title?: string; body?: string; areaId?: string | null }): NoteRow {
  const cur = getNote(deps, userId, id);
  if (p.areaId && !deps.db.prepare('select 1 from areas where id=? and user_id=?').get(p.areaId, userId)) fail(400, 'INVALID_AREA', 'Área inexistente');
  const now = deps.now().toISOString();
  const title = p.title ?? cur.title;
  const renamed = title !== cur.title;

  deps.db.transaction(() => {
    // Notas que hoje apontam para esta (antes de mudar o título) têm o link reescrito.
    const linkers = renamed
      ? (deps.db.prepare('select distinct src_note_id id from links where dst_note_id=? and src_note_id != ?').all(id, id) as { id: string }[])
      : [];
    deps.db.prepare('update notes set title=?, body_md=?, area_id=?, path=?, updated_at=? where id=?')
      .run(title, p.body ?? cur.body_md, p.areaId === undefined ? cur.area_id : p.areaId, renamed && cur.path === cur.title ? title : cur.path, now, id);
    for (const { id: sid } of linkers) {
      const s = deps.db.prepare('select body_md from notes where id=?').get(sid) as { body_md: string };
      const nb = renameWikilinks(s.body_md, cur.title, title);
      if (nb !== s.body_md) {
        deps.db.prepare('update notes set body_md=?, updated_at=? where id=?').run(nb, now, sid);
        derive(deps, sid, nb);
      }
    }
    derive(deps, id, p.body ?? cur.body_md);
    if (renamed && (p.body ?? cur.body_md) !== cur.body_md) { /* corpo já veio com os links do usuário */ }
    resolveLinks(deps, userId);
  })();
  return getNote(deps, userId, id);
}

export function deleteNote(deps: Deps, userId: string, id: string): void {
  getNote(deps, userId, id);
  deps.db.prepare('delete from notes where id=?').run(id);
  resolveLinks(deps, userId);
}

export function renderTemplate(body: string, vars: { date?: string; title?: string }): string {
  return body.replace(/\{\{\s*(date|title)\s*\}\}/g, (_, k: 'date' | 'title') => vars[k] ?? '');
}
