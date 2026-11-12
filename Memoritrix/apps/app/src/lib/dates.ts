const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const pad = (n: number) => String(n).padStart(2, '0');
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export type DueInfo = { text: string; tone: 'none' | 'overdue' | 'today' | 'soon' | 'later' };

export function formatDue(iso: string | null | undefined, now: Date): DueInfo {
  if (!iso) return { text: '', tone: 'none' };
  const d = new Date(iso);
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86400_000);
  const dm = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  if (diff < 0) return { text: `Atrasado · ${dm}`, tone: 'overdue' };
  if (diff === 0) return { text: 'Hoje', tone: 'today' };
  if (diff === 1) return { text: 'Amanhã', tone: 'soon' };
  if (diff < 7) return { text: `${WEEKDAYS[d.getDay()]}, ${dm}`, tone: 'soon' };
  return { text: `${dm}/${d.getFullYear()}`, tone: 'later' };
}

const LABELS: Record<string, string> = { daily: 'Todo dia', weekly: 'Toda semana', monthly: 'Todo mês', weekdays: 'Dias úteis' };
export const RECURRENCES = Object.keys(LABELS);
export const recurrenceLabel = (rule: string | null | undefined): string => (rule ? LABELS[rule] ?? rule : '');

/** ISO ao meio-dia (hora local) de hoje + `plusDays`. */
export function dueAtFor(now: Date, plusDays = 0): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + plusDays, 12, 0, 0).toISOString();
}

export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** '' → null (sem data); formato ou dia inválido → undefined. */
export function parseDateInput(s: string): string | null | undefined {
  const t = s.trim();
  if (!t) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d, 12, 0, 0);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date.toISOString() : undefined;
}
