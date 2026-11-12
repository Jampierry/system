import { PERMISSIONS, type Permission } from '@cerebro/shared';

export const PERMISSION_INFO: Record<Permission, { label: string; hint: string }> = {
  'users.manage': { label: 'Gerenciar usuários', hint: 'Criar, editar, bloquear e excluir usuários; redefinir senhas.' },
  'profiles.manage': { label: 'Gerenciar perfis', hint: 'Criar perfis e definir o que cada um pode fazer.' },
  'recovery.manage': { label: 'Aprovar recuperação de senha', hint: 'Analisar pedidos de "esqueci a senha" e gerar códigos.' },
  'audit.view': { label: 'Ver auditoria', hint: 'Consultar o registro de acessos e ações administrativas.' },
  'notes.write': { label: 'Escrever notas e mapas', hint: 'Criar e editar notas, mapas mentais, templates e importações.' },
  'items.write': { label: 'Gerenciar tarefas e agenda', hint: 'Capturar, organizar e concluir itens, projetos e checklists.' },
  'assistant.use': { label: 'Usar o assistente', hint: 'Conversar por texto, voz e foto e usar a IA para organizar.' },
  'export.data': { label: 'Exportar dados', hint: 'Baixar todas as notas em Markdown.' },
};

export const PERMISSION_GROUPS: { title: string; perms: Permission[] }[] = [
  { title: 'Uso do app', perms: ['notes.write', 'items.write', 'assistant.use', 'export.data'] },
  { title: 'Administração', perms: ['users.manage', 'profiles.manage', 'recovery.manage', 'audit.view'] },
];

/** Alterna uma permissão devolvendo um novo array na ordem canônica, sem duplicatas. */
export function togglePermission(perms: readonly Permission[], p: Permission): Permission[] {
  const set = new Set(perms);
  if (set.has(p)) set.delete(p); else set.add(p);
  return PERMISSIONS.filter(x => set.has(x));
}

export function validateProfile(p: { name: string; isSystem?: boolean; permissions: readonly Permission[] }): string | null {
  if (!p.name.trim()) return 'Informe um nome para o perfil';
  if (p.isSystem && p.name === 'Administrador') return 'O perfil Administrador não pode ser alterado';
  if (p.isSystem && p.name === 'Membro' && !p.permissions.includes('assistant.use')) return 'O perfil Membro precisa manter o acesso ao assistente';
  return null;
}
