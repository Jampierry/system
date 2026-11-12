import { loadConfig } from './config';
import { openDb } from './db/connection';
import { migrate } from './db/migrate';
import { buildServer } from './server';
import { ensureAdmin, ensureSystemProfiles } from './modules/auth/bootstrap';
import { createMailer } from './modules/recovery/mailer';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cfg = loadConfig();
// por padrão serve o app web exportado em apps/app/dist (npm run build), se existir
const defaultWeb = resolve(dirname(fileURLToPath(import.meta.url)), '../../app/dist');
if (!cfg.webDir && existsSync(join(defaultWeb, 'index.html'))) cfg.webDir = defaultWeb;
const db = openDb(cfg.dbPath);
migrate(db);
ensureSystemProfiles(db);
await ensureAdmin(db, cfg);

const app = await buildServer({ db, cfg, now: () => new Date(), mailer: createMailer(cfg.smtpUrl) });
await app.listen({ port: cfg.port, host: '0.0.0.0' });
console.log(`Segundo Cérebro em http://localhost:${cfg.port} — app web: ${cfg.webDir ? 'servido' : 'não exportado (rode npm run build)'} — IA: ${cfg.anthropicKey ? 'Claude' : 'modo demo'}`);
