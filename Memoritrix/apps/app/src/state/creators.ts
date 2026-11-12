import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { api } from './session';
import { emit } from './bus';
import { useArea } from './area';
import { useToast } from '../components/Toast';

const pad = (n: number) => String(n).padStart(2, '0');
export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type NoteLite = { id: string; title: string };

/** Criação/abertura de notas e mapas, usada pela sidebar, paleta e telas. */
export function useCreators() {
  const router = useRouter();
  const toast = useToast();
  const { areaId } = useArea();
  const guard = useCallback(async (fn: () => Promise<void>) => {
    try { await fn(); } catch (e: any) { toast.show(e.message ?? 'Não foi possível concluir', 'error'); }
  }, [toast]);

  const createNote = useCallback(async (title: string, body = ''): Promise<string> => {
    const { note } = await api<{ note: NoteLite }>('/api/notes', { method: 'POST', body: { title, body, areaId } });
    emit('notes');
    return note.id;
  }, [areaId]);

  const newNote = useCallback(() => guard(async () => {
    const { notes } = await api<{ notes: NoteLite[] }>('/api/notes');
    const taken = new Set(notes.map(n => n.title.toLowerCase()));
    let title = 'Nova nota';
    for (let i = 2; taken.has(title.toLowerCase()); i++) title = `Nova nota (${i})`;
    router.push(`/library/${await createNote(title)}` as any);
  }), [guard, createNote, router]);

  const openDaily = useCallback(() => guard(async () => {
    const { note } = await api<{ note: NoteLite }>('/api/notes/daily', { method: 'POST', body: { date: localDate() } });
    emit('notes');
    router.push(`/library/${note.id}` as any);
  }), [guard, router]);

  const newMindmap = useCallback(() => guard(async () => {
    const { mindmap } = await api<{ mindmap: { id: string } }>('/api/mindmaps', { method: 'POST', body: { title: 'Novo mapa mental' } });
    emit('mindmaps');
    router.push(`/library/mindmaps/${mindmap.id}` as any);
  }), [guard, router]);

  /** Abre a nota com esse título; se não existir, cria (links para notas futuras). */
  const openByTitle = useCallback((title: string, noteId?: string | null) => guard(async () => {
    if (noteId) { router.push(`/library/${noteId}` as any); return; }
    const { notes } = await api<{ notes: NoteLite[] }>('/api/notes');
    const hit = notes.find(n => n.title.toLowerCase() === title.toLowerCase());
    router.push(`/library/${hit ? hit.id : await createNote(title, `# ${title}\n`)}` as any);
  }), [guard, createNote, router]);

  return { newNote, openDaily, newMindmap, openByTitle };
}
