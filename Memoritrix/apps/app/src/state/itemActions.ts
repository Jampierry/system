import { useCallback } from 'react';
import { api, useSession } from './session';
import { emit } from './bus';
import { useArea } from './area';
import { useToast } from '../components/Toast';
import type { Item } from '../lib/types';

/** Ações sobre itens com aviso de erro/sucesso e atualização das telas. */
export function useItemActions() {
  const toast = useToast();
  const { can } = useSession();
  const { areaId } = useArea();
  const canWrite = can('items.write');

  const run = useCallback(async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
    try {
      const r = await fn();
      emit('items');
      if (ok) toast.show(ok, 'success');
      return r;
    } catch (e: any) {
      toast.show(e.message ?? 'Não foi possível concluir a ação', 'error');
      return undefined;
    }
  }, [toast]);

  return {
    canWrite,
    update: (id: string, patch: Record<string, unknown>, ok?: string) =>
      run(() => api<{ item: Item; next?: Item }>(`/api/items/${id}`, { method: 'PATCH', body: patch }), ok),
    complete: async (it: Item) => {
      const r = await run(() => api<{ item: Item; next?: Item }>(`/api/items/${it.id}`, { method: 'PATCH', body: { status: it.status === 'done' ? 'next' : 'done' } }));
      if (r && it.status !== 'done') toast.show(r.next ? 'Concluído — próxima ocorrência criada' : 'Concluído', 'success');
    },
    remove: (id: string) => run(() => api(`/api/items/${id}`, { method: 'DELETE' }), 'Item excluído'),
    create: (body: Record<string, unknown>, ok?: string) =>
      run(() => api<{ item: Item }>('/api/items', { method: 'POST', body: { areaId, ...body } }), ok),
  };
}
