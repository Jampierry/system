import { useCallback, useEffect, useState } from 'react';
import { api } from './session';
import { useBus } from './bus';
import { useArea } from './area';
import type { Item } from '../lib/types';

/** Carrega /api/items com filtros, respeita a área selecionada e recarrega quando 'items' muda. */
export function useItems(params: Record<string, string | undefined>) {
  const { areaId } = useArea();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');
  const key = JSON.stringify(params);

  const reload = useCallback(async () => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(JSON.parse(key) as Record<string, string | undefined>)) if (v) q.set(k, v);
    if (areaId) q.set('area', areaId);
    try {
      setItems((await api<{ items: Item[] }>(`/api/items?${q}`)).items);
      setError('');
    } catch (e: any) {
      setError(e.message ?? 'Erro ao carregar');
      setItems([]);
    }
  }, [key, areaId]);

  useEffect(() => { void reload(); }, [reload]);
  useBus('items', () => { void reload(); });
  return { items, error, reload };
}
