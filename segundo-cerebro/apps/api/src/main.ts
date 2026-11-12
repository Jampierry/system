import { loadConfig } from './config';
import { openDb } from './db/connection';
import { migrate } from './db/migrate';
import { buildServer } from './server';
import { ensureAdmin, ensureSystemProfiles } from './modules/auth/bootstrap';
import { createMailer } from './modules/recovery/mailer';

const cfg = loadConfig();
const db = openDb(cfg.dbPath);
migrate(db);
ensureSystemProfiles(db);
await ensureAdmin(db, cfg);

const app = await buildServer({ db, cfg, now: () => new Date(), mailer: createMailer(cfg.smtpUrl) });
await app.listen({ port: cfg.port, host: '0.0.0.0' });
console.log(`Segundo Cérebro em http://localhost:${cfg.port} — IA: ${cfg.anthropicKey ? 'Claude' : 'modo demo'}`);
