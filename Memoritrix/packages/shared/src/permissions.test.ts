import { describe, it, expect } from 'vitest';
import { hasPermission, SYSTEM_PROFILES, PERMISSIONS } from './permissions';
import { passwordSchema, loginSchema } from './schemas';

describe('permissions', () => {
  it('readonly não escreve notas', () => {
    expect(hasPermission(SYSTEM_PROFILES.readonly, 'notes.write')).toBe(false);
  });
  it('admin gerencia usuários', () => {
    expect(hasPermission(SYSTEM_PROFILES.admin, 'users.manage')).toBe(true);
  });
  it('admin tem todas as permissões', () => {
    expect(SYSTEM_PROFILES.admin).toEqual([...PERMISSIONS]);
  });
  it('membro não administra', () => {
    expect(hasPermission(SYSTEM_PROFILES.member, 'users.manage')).toBe(false);
    expect(hasPermission(SYSTEM_PROFILES.member, 'assistant.use')).toBe(true);
  });
});

describe('schemas', () => {
  it('senha curta é rejeitada', () => {
    expect(passwordSchema.safeParse('curta').success).toBe(false);
    expect(passwordSchema.safeParse('longa-o-bastante').success).toBe(true);
  });
  it('login exige e-mail válido', () => {
    expect(loginSchema.safeParse({ email: 'x', password: 'abc' }).success).toBe(false);
  });
});
