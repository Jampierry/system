import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { Deps } from '../../deps';
import { fail } from '../../errors';
import { cleanTitle, createNote, resolveLinks } from './repo';

const MAX_ZIP_B64 = 70 * 1024 * 1024;
const MAX_FILES = 5000;
const MAX_NOTE_BYTES = 2 * 1024 * 1024;

export type ImportFile = { name: string; content: string };

/** Normaliza um caminho de arquivo importado; devolve null para caminhos perigosos/ocultos ou não-.md. */
export function normalizeNotePath(name: string): { path: string; title: string } | null {
  const parts = name.replace(/\\/g, '/').split('/').filter(p => p !== '');
  if (!parts.length || !/\.md$/i.test(parts[parts.length - 1])) return null;
  if (parts.some(p => p === '..' || p === '.' || p.startsWith('.') || p === '__MACOSX')) return null;
  const clean = parts.map((p, i) => (i === parts.length - 1 ? p.replace(/\.md$/i, '') : p));
  const title = cleanTitle(clean[clean.length - 1]);
  if (!title) return null;
  return { path: clean.join('/'), title };
}

const MAX_UNZIPPED = 100 * 1024 * 1024;

export function importFiles(deps: Deps, userId: string, files: ImportFile[], zipBase64?: string): { imported: number; skipped: number } {
  const all: ImportFile[] = [...files];
  if (zipBase64) {
    if (zipBase64.length > MAX_ZIP_B64) fail(413, 'TOO_LARGE', 'Arquivo muito grande');
    try {
      let count = 0;
      let total = 0;
      const entries = unzipSync(new Uint8Array(Buffer.from(zipBase64, 'base64')), {
        filter: f => {
          if (!/\.md$/i.test(f.name) || f.originalSize > MAX_NOTE_BYTES) return false;
          count++; total += f.originalSize;
          if (count > MAX_FILES || total > MAX_UNZIPPED) throw new Error('zip grande demais'); // antes de descompactar
          return true;
        },
      });
      for (const [name, data] of Object.entries(entries)) all.push({ name, content: strFromU8(data) });
    } catch {
      fail(400, 'INVALID_ZIP', 'Arquivo zip inválido');
    }
  }
  if (all.length > MAX_FILES) fail(413, 'TOO_MANY_FILES', `No máximo ${MAX_FILES} arquivos por importação`);
  let imported = 0;
  let skipped = 0;
  deps.db.transaction(() => {
    for (const f of all) {
      const np = normalizeNotePath(f.name);
      if (!np || f.content.length > MAX_NOTE_BYTES) { skipped++; continue; }
      createNote(deps, userId, { title: np.title, body: f.content, path: np.path }, false);
      imported++;
    }
    resolveLinks(deps, userId);
  })();
  return { imported, skipped };
}

export function exportZip(deps: Deps, userId: string): Buffer {
  const rows = deps.db.prepare('select path, title, body_md from notes where user_id=? order by created_at, rowid').all(userId) as { path: string; title: string; body_md: string }[];
  const files: Record<string, Uint8Array> = {};
  for (const r of rows) {
    const base = (r.path || r.title).replace(/\\/g, '/').split('/').filter(p => p && p !== '.' && p !== '..').map(p => p.replace(/[<>:"|?*]/g, '-')).join('/') || cleanTitle(r.title) || 'nota';
    let name = `${base}.md`;
    for (let i = 2; files[name]; i++) name = `${base} (${i}).md`;
    files[name] = strToU8(r.body_md);
  }
  return Buffer.from(zipSync(files));
}
