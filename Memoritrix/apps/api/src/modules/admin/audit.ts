import type { Deps } from '../../deps';

export function logAudit(deps: Pick<Deps, 'db' | 'now'>, actorId: string | null, action: string, target?: string | null, meta?: unknown): void {
  deps.db
    .prepare('insert into audit_log(actor_id, action, target, meta_json, at) values(?,?,?,?,?)')
    .run(actorId, action, target ?? null, meta === undefined ? null : JSON.stringify(meta), deps.now().toISOString());
}
