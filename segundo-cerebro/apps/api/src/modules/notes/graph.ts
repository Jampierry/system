import type { Deps } from '../../deps';
import { ftsQuery } from '../../db/fts';
import { listItems } from '../items/repo';

export function backlinks(deps: Deps, userId: string, noteId: string) {
  return deps.db
    .prepare(
      `select distinct n.id, n.title from links l join notes n on n.id = l.src_note_id
       where l.dst_note_id = ? and n.id != ? and n.user_id = ? order by n.title`,
    )
    .all(noteId, noteId, userId) as { id: string; title: string }[];
}

const likeEscape = (s: string) => s.replace(/[\\%_]/g, c => '\\' + c);

export function unlinkedMentions(deps: Deps, userId: string, noteId: string, title: string) {
  if (title.trim().length < 3) return [];
  return deps.db
    .prepare(
      `select n.id, n.title from notes n
       where n.user_id = ? and n.id != ? and lower(n.body_md) like ? escape '\\'
         and not exists (select 1 from links l where l.src_note_id = n.id and l.dst_note_id = ?)
       order by n.title`,
    )
    .all(userId, noteId, `%${likeEscape(title.toLowerCase())}%`, noteId) as { id: string; title: string }[];
}

export function graph(deps: Deps, userId: string, f: { tag?: string; area?: string }) {
  const where = ['n.user_id = ?'];
  const args: unknown[] = [userId];
  if (f.area) { where.push('n.area_id = ?'); args.push(f.area); }
  if (f.tag) { where.push('exists (select 1 from tags t where t.note_id = n.id and t.tag = ?)'); args.push(f.tag.replace(/^#/, '').toLowerCase()); }
  const nodes = deps.db.prepare(`select n.id, n.title from notes n where ${where.join(' and ')} order by n.title`).all(...args) as { id: string; title: string }[];
  const ids = new Set(nodes.map(n => n.id));
  const rows = deps.db
    .prepare(
      `select distinct l.src_note_id s, l.dst_note_id d from links l join notes n on n.id = l.src_note_id
       where n.user_id = ? and l.dst_note_id is not null and l.dst_note_id != l.src_note_id`,
    )
    .all(userId) as { s: string; d: string }[];
  return { nodes, edges: rows.filter(r => ids.has(r.s) && ids.has(r.d)).map(r => ({ source: r.s, target: r.d })) };
}

export function search(deps: Deps, userId: string, q: string) {
  const m = ftsQuery(q);
  if (!m) return { notes: [], items: [] };
  const notes = deps.db
    .prepare(
      `select n.id, n.title, snippet(notes_fts, -1, '«', '»', '…', 12) snippet
       from notes_fts join notes n on n.rowid = notes_fts.rowid
       where notes_fts match ? and n.user_id = ? order by rank limit 50`,
    )
    .all(m, userId) as { id: string; title: string; snippet: string }[];
  const items = listItems(deps, userId, { q }).slice(0, 50).map(i => ({ id: i.id, title: i.title, status: i.status }));
  return { notes, items };
}
