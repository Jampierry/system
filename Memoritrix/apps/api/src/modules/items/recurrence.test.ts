import { describe, it, expect } from 'vitest';
import { nextOccurrence } from './recurrence';

const d = (s: string) => new Date(s);
describe('nextOccurrence', () => {
  it('daily, weekly', () => {
    expect(nextOccurrence('daily', d('2026-11-11T12:00:00Z'))?.toISOString()).toBe('2026-11-12T12:00:00.000Z');
    expect(nextOccurrence('weekly', d('2026-11-11T12:00:00Z'))?.toISOString()).toBe('2026-11-18T12:00:00.000Z');
  });
  it('monthly preserva o dia e ajusta fim de mês', () => {
    expect(nextOccurrence('monthly', d('2026-10-15T09:00:00Z'))?.toISOString()).toBe('2026-11-15T09:00:00.000Z');
    expect(nextOccurrence('monthly', d('2026-01-31T09:00:00Z'))?.toISOString()).toBe('2026-02-28T09:00:00.000Z');
    expect(nextOccurrence('monthly', d('2026-12-31T09:00:00Z'))?.toISOString()).toBe('2027-01-31T09:00:00.000Z');
  });
  it('weekdays pula o fim de semana', () => {
    expect(nextOccurrence('weekdays', d('2026-11-13T09:00:00Z'))?.toISOString()).toBe('2026-11-16T09:00:00.000Z'); // sexta → segunda
    expect(nextOccurrence('weekdays', d('2026-11-11T09:00:00Z'))?.toISOString()).toBe('2026-11-12T09:00:00.000Z');
  });
  it('regra desconhecida → null', () => {
    expect(nextOccurrence('de vez em quando', d('2026-11-11T09:00:00Z'))).toBeNull();
  });
});
