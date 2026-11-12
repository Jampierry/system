export const PERMISSIONS = [
  'users.manage',
  'profiles.manage',
  'recovery.manage',
  'audit.view',
  'notes.write',
  'items.write',
  'assistant.use',
  'export.data',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function hasPermission(perms: readonly Permission[], needed: Permission): boolean {
  return perms.includes(needed);
}

export const SYSTEM_PROFILES: Record<'admin' | 'member' | 'readonly', Permission[]> = {
  admin: [...PERMISSIONS],
  member: ['notes.write', 'items.write', 'assistant.use', 'export.data'],
  readonly: [],
};

export const SYSTEM_PROFILE_NAMES: Record<'admin' | 'member' | 'readonly', string> = {
  admin: 'Administrador',
  member: 'Membro',
  readonly: 'Somente leitura',
};
