import { describe, it, expect } from 'vitest';
import { formatDue, recurrenceLabel, dueAtFor, toDateInput, parseDateInput } from './dates';

const now = new Date(2026, 10, 12, 10, 0, 0); // 12/11/2026 local (quinta)
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0).toISOString();

describe('formatDue', () => {
  it('sem data', () => expect(formatDue(null, now)).toEqual({ text: '', tone: 'none' }));
  it('hoje, amanhã, atrasado', () => {
    expect(formatDue(at(2026, 11, 12), now)).toEqual({ text: 'Hoje', tone: 'today' });
    expect(formatDue(at(2026, 11, 13), now)).toEqual({ text: 'Amanhã', tone: 'soon' });
    expect(formatDue(at(2026, 11, 10), now)).toEqual({ text: 'Atrasado · 10/11', tone: 'overdue' });
  });
  it('próximos dias mostram dia da semana; depois a data completa', () => {
    expect(formatDue(at(2026, 11, 16), now)).toEqual({ text: 'seg, 16/11', tone: 'soon' });
    expect(formatDue(at(2026, 12, 25), now)).toEqual({ text: '25/12/2026', tone: 'later' });
  });
});

describe('recorrência e datas', () => {
  it('recurrenceLabel', () => {
    expect(recurrenceLabel('daily')).toBe('Todo dia');
    expect(recurrenceLabel('weekly')).toBe('Toda semana');
    expect(recurrenceLabel('monthly')).toBe('Todo mês');
    expect(recurrenceLabel('weekdays')).toBe('Dias úteis');
    expect(recurrenceLabel(null)).toBe('');
    expect(recurrenceLabel('xyz')).toBe('xyz');
  });
  it('dueAtFor gera ISO ao meio-dia local do dia pedido', () => {
    const iso = dueAtFor(now, 1);
    const d = new Date(iso);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 13, 12]);
  });
  it('toDateInput / parseDateInput ida e volta e validação', () => {
    expect(toDateInput(at(2026, 3, 5))).toBe('2026-03-05');
    expect(toDateInput(null)).toBe('');
    const iso = parseDateInput('2026-03-05');
    expect(iso && toDateInput(iso)).toBe('2026-03-05');
    expect(parseDateInput('')).toBeNull();
    expect(parseDateInput('05/03/2026')).toBeUndefined(); // formato inválido
    expect(parseDateInput('2026-02-31')).toBeUndefined(); // dia inexistente
  });
});
