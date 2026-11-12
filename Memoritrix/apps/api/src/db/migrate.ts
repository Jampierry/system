import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './connection';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export function migrate(db: Db): void {
  db.exec('create table if not exists schema_migrations(name text primary key, applied_at text not null)');
  const done = new Set((db.prepare('select name from schema_migrations').all() as { name: string }[]).map(r => r.name));
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(join(dir, f), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('insert into schema_migrations(name, applied_at) values(?, ?)').run(f, new Date().toISOString());
    })();
  }
}
