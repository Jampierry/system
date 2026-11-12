import { describe, it, expect } from 'vitest';
import { PERMISSIONS } from '@cerebro/shared';
import { PERMISSION_INFO, PERMISSION_GROUPS, togglePermission, validateProfile } from './permissionMatrix';

describe('togglePermission', () => {
  it('adiciona mantendo a ordem canônica e remove ao alternar de novo', () => {
    const a = togglePermission(['items.write'], 'users.manage');
    expect(a).toEqual(['users.manage', 'items.write']); // ordem de PERMISSIONS, não de inserção
    expect(togglePermission(a, 'users.manage')).toEqual(['items.write']);
  });
  it('não muta o array original e ignora duplicatas', () => {
    const base = ['notes.write'] as const;
    const out = togglePermission([...base], 'items.write');
    expect(base).toEqual(['notes.write']);
    expect(out).toEqual(['notes.write', 'items.write']);
    expect(togglePermission(['notes.write', 'notes.write'] as any, 'items.write')).toEqual(['notes.write', 'items.write']);
  });
});

describe('PERMISSION_INFO / GROUPS', () => {
  it('toda permissão tem rótulo e dica em português', () => {
    for (const p of PERMISSIONS) {
      expect(PERMISSION_INFO[p].label.length).toBeGreaterThan(2);
      expect(PERMISSION_INFO[p].hint.length).toBeGreaterThan(5);
    }
  });
  it('os grupos cobrem cada permissão exatamente uma vez', () => {
    const all = PERMISSION_GROUPS.flatMap(g => g.perms);
    expect([...all].sort()).toEqual([...PERMISSIONS].sort());
  });
});

describe('validateProfile', () => {
  it('exige nome', () => {
    expect(validateProfile({ name: '  ', permissions: [] })).toBe('Informe um nome para o perfil');
    expect(validateProfile({ name: 'Leitor+', permissions: [] })).toBeNull();
  });
  it('o perfil de sistema Membro precisa manter assistant.use', () => {
    expect(validateProfile({ name: 'Membro', isSystem: true, permissions: ['notes.write'] })).toMatch(/assistente/i);
    expect(validateProfile({ name: 'Membro', isSystem: true, permissions: ['assistant.use'] })).toBeNull();
    // perfis customizados podem ficar sem o assistente
    expect(validateProfile({ name: 'Sem IA', permissions: ['notes.write'] })).toBeNull();
  });
  it('o perfil Administrador não pode ser editado', () => {
    expect(validateProfile({ name: 'Administrador', isSystem: true, permissions: ['notes.write'] })).toMatch(/Administrador/);
  });
});
