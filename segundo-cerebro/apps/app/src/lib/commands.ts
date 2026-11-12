import type { Permission } from '@cerebro/shared';

export type Command = { id: string; label: string; hint?: string; href?: string; action?: 'capture' | 'new-note' | 'daily' | 'new-mindmap' };

const GO: [string, string, string][] = [
  ['inbox', 'Ir para: Caixa de entrada', '/inbox'], ['calendar', 'Ir para: Calendário', '/calendar'], ['focus', 'Ir para: Foco', '/focus'],
  ['next', 'Ir para: Próxima ação', '/next'], ['waiting', 'Ir para: Aguardando resposta', '/waiting'], ['someday', 'Ir para: Algum dia/talvez', '/someday'],
  ['projects', 'Ir para: Projetos', '/projects'], ['recurring', 'Ir para: Recorrências', '/recurring'], ['checklists', 'Ir para: Checklists', '/checklists'],
  ['review', 'Ir para: Revisão semanal', '/review'], ['logbook', 'Ir para: Logbook', '/logbook'],
  ['library', 'Ir para: Notas', '/library'], ['mindmaps', 'Ir para: Mapas mentais', '/library/mindmaps'], ['graph', 'Ir para: Grafo', '/library/graph'],
  ['assistant', 'Ir para: Assistente', '/assistant'], ['settings', 'Ir para: Configurações do assistente', '/settings/assistant'],
];

export function buildCommands(perms: Permission[]): Command[] {
  const has = (p: Permission) => perms.includes(p);
  const cmds: Command[] = GO.map(([id, label, href]) => ({ id: `go:${id}`, label, href }));
  if (has('items.write')) cmds.unshift({ id: 'capture', label: 'Capturar item', action: 'capture' });
  if (has('notes.write')) {
    cmds.unshift({ id: 'new:mindmap', label: 'Novo mapa mental', action: 'new-mindmap' });
    cmds.unshift({ id: 'daily', label: 'Abrir nota diária', action: 'daily' });
    cmds.unshift({ id: 'new:note', label: 'Nova nota', action: 'new-note' });
  }
  if (has('users.manage')) cmds.push({ id: 'go:admin-users', label: 'Administração: Usuários', href: '/admin/users' });
  if (has('profiles.manage')) cmds.push({ id: 'go:admin-profiles', label: 'Administração: Perfis', href: '/admin/profiles' });
  if (has('recovery.manage')) cmds.push({ id: 'go:admin-recovery', label: 'Administração: Recuperação de senha', href: '/admin/recovery' });
  if (has('audit.view')) cmds.push({ id: 'go:admin-audit', label: 'Administração: Auditoria', href: '/admin/audit' });
  return cmds;
}
