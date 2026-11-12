import { describe, it, expect } from 'vitest';
import { buildCommands } from './commands';

const ids = (perms: string[]) => buildCommands(perms as any).map(c => c.id);

describe('buildCommands', () => {
  it('comandos básicos existem para todos', () => {
    const all = ids([]);
    for (const id of ['go:inbox', 'go:library', 'go:assistant', 'go:graph']) expect(all).toContain(id);
  });
  it('escrita só com permissão', () => {
    expect(ids([])).not.toContain('new:note');
    expect(ids(['notes.write'])).toEqual(expect.arrayContaining(['new:note', 'daily']));
    expect(ids(['items.write'])).toContain('capture');
    expect(ids([])).not.toContain('capture');
  });
  it('administração só com permissão correspondente', () => {
    expect(ids([])).not.toContain('go:admin-users');
    expect(ids(['users.manage'])).toContain('go:admin-users');
    expect(ids(['audit.view'])).toContain('go:admin-audit');
  });
  it('cada comando tem rótulo em português', () => {
    for (const c of buildCommands(['users.manage', 'notes.write', 'items.write'] as any)) expect(c.label.length).toBeGreaterThan(2);
  });
});
