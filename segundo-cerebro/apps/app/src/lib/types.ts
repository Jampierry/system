export type ItemStatus = 'inbox' | 'next' | 'waiting' | 'someday' | 'done' | 'trashed';
export type ItemKind = 'task' | 'event' | 'idea' | 'checklist' | 'project';

export type Item = {
  id: string; title: string; body: string; kind: ItemKind; status: ItemStatus;
  areaId: string | null; projectId: string | null;
  dueAt: string | null; startAt: string | null; endAt: string | null;
  recurrence: string | null; waitingOn: string | null; createdAt: string; completedAt: string | null;
  entries?: { id: string; text: string; done: boolean }[];
};

export const STATUS_LABEL: Record<string, string> = {
  inbox: 'Caixa de entrada', next: 'Próxima ação', waiting: 'Aguardando', someday: 'Algum dia', done: 'Concluído',
};
export const KIND_LABEL: Record<string, string> = { task: 'Tarefa', project: 'Projeto', checklist: 'Checklist', event: 'Evento', idea: 'Ideia' };
