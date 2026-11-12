import { describe, it, expect } from 'vitest';
import { openDb } from './connection';
import { migrate } from './migrate';
import { loadConfig } from '../config';

const TABLES = ['users','profiles','sessions','password_recovery','audit_log','areas','items',
  'checklist_entries','notes','links','tags','templates','mindmaps','assistant_settings',
  'conversations','messages','logbook'];

describe('migrate', () => {
  it('é idempotente e cria todas as tabelas', () => {
    const db = openDb(':memory:');
    migrate(db);
    migrate(db);
    const names = (db.prepare("select name from sqlite_master where type in ('table')").all() as {name:string}[]).map(r => r.name);
    for (const t of TABLES) expect(names).toContain(t);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('indexa notas no FTS5 e acompanha updates/deletes', () => {
    const db = openDb(':memory:');
    migrate(db);
    db.prepare("insert into profiles(id,name,permissions_json,is_system) values('p','P','[]',1)").run();
    db.prepare("insert into users(id,email,name,password_hash,profile_id,created_at) values('u','a@b.c','A','x','p','2026-01-01')").run();
    db.prepare("insert into notes(id,user_id,path,title,body_md,created_at,updated_at) values('n1','u','n1','Receita','bolo de cenoura','2026-01-01','2026-01-01')").run();
    const find = (q: string) => db.prepare('select n.id from notes_fts f join notes n on n.rowid=f.rowid where notes_fts match ?').all(q);
    expect(find('cenoura')).toHaveLength(1);
    db.prepare("update notes set body_md='pizza' where id='n1'").run();
    expect(find('cenoura')).toHaveLength(0);
    expect(find('pizza')).toHaveLength(1);
    db.prepare("delete from notes where id='n1'").run();
    expect(find('pizza')).toHaveLength(0);
  });
});

describe('loadConfig', () => {
  it('lê variáveis e usa padrões', () => {
    const c = loadConfig({ ANTHROPIC_API_KEY: 'k', PORT: '9000' } as any);
    expect(c.port).toBe(9000);
    expect(c.anthropicKey).toBe('k');
    expect(loadConfig({} as any).port).toBe(8787);
    expect(loadConfig({} as any).anthropicKey).toBeUndefined();
  });
});
