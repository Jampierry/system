import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, useSession } from './session';
import { emit, useBus } from './bus';

export type Area = { id: string; name: string; color: string };
type Ctx = { areas: Area[]; areaId: string | null; setAreaId: (id: string | null) => void; reload: () => Promise<void>; create: (name: string) => Promise<void> };
const AreaCtx = createContext<Ctx>({ areas: [], areaId: null, setAreaId: () => {}, reload: async () => {}, create: async () => {} });

export function AreaProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaId, setAreaId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    try { setAreas((await api<{ areas: Area[] }>('/api/areas')).areas); } catch { /* sem áreas */ }
  }, [user]);
  useEffect(() => { void reload(); }, [reload]);
  useBus('areas', () => { void reload(); });

  const create = useCallback(async (name: string) => {
    const { area } = await api<{ area: Area }>('/api/areas', { method: 'POST', body: { name } });
    await reload();
    setAreaId(area.id);
    emit('items');
  }, [reload]);

  // área apagada em outro lugar volta para "Todas"
  useEffect(() => { if (areaId && !areas.some(a => a.id === areaId)) setAreaId(null); }, [areas, areaId]);

  return <AreaCtx.Provider value={{ areas, areaId, setAreaId, reload, create }}>{children}</AreaCtx.Provider>;
}

export const useArea = () => useContext(AreaCtx);
