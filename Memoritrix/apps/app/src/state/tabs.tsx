import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';

const TITLES: [string, string][] = [
  ['/inbox', 'Caixa de entrada'], ['/calendar', 'Calendário'], ['/focus', 'Foco'], ['/next', 'Próxima ação'],
  ['/waiting', 'Aguardando resposta'], ['/someday', 'Algum dia/talvez'], ['/projects', 'Projetos'], ['/recurring', 'Recorrências'],
  ['/checklists', 'Checklists'], ['/review', 'Revisão semanal'], ['/logbook', 'Logbook'],
  ['/library/mindmaps', 'Mapas mentais'], ['/library/graph', 'Grafo'], ['/library', 'Notas'],
  ['/assistant', 'Assistente'], ['/settings', 'Configurações'], ['/admin/users', 'Usuários'], ['/admin/profiles', 'Perfis'],
  ['/admin/recovery', 'Recuperação de senha'], ['/admin/audit', 'Auditoria'],
];

export function routeTitle(path: string): string {
  const hit = TITLES.find(([p]) => path === p || path.startsWith(p + '/'));
  return hit ? hit[1] : 'Organização';
}

export type Tab = { path: string; title: string };
type Ctx = { tabs: Tab[]; active: string; close: (path: string) => void; setTitle: (path: string, title: string) => void };
const TabsCtx = createContext<Ctx>({ tabs: [], active: '', close: () => {}, setTitle: () => {} });

export function TabsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tabs, setTabs] = useState<Tab[]>([]);

  useEffect(() => {
    if (!pathname || pathname === '/') return;
    setTabs(prev => (prev.some(t => t.path === pathname) ? prev : [...prev, { path: pathname, title: routeTitle(pathname) }].slice(-8)));
  }, [pathname]);

  const close = useCallback((path: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.path === path);
      const next = prev.filter(t => t.path !== path);
      if (path === pathname) router.replace((next[Math.max(0, idx - 1)]?.path ?? '/inbox') as any);
      return next;
    });
  }, [pathname, router]);

  const setTitle = useCallback((path: string, title: string) => {
    setTabs(prev => prev.map(t => (t.path === path ? { ...t, title } : t)));
  }, []);

  return <TabsCtx.Provider value={{ tabs, active: pathname, close, setTitle }}>{children}</TabsCtx.Provider>;
}

export const useTabs = () => useContext(TabsCtx);
