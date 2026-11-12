import { describe, it, expect } from 'vitest';
import { initialPomodoro, start, pause, reset, tick, WORK_SECONDS, BREAK_SECONDS, formatClock } from './pomodoro';

describe('pomodoro', () => {
  it('começa parado em 25:00 de foco', () => {
    expect(initialPomodoro()).toEqual({ phase: 'work', remaining: 25 * 60, running: false, completed: 0 });
    expect(WORK_SECONDS).toBe(1500);
    expect(BREAK_SECONDS).toBe(300);
  });
  it('não conta tempo enquanto está parado', () => {
    expect(tick(initialPomodoro(), 10).remaining).toBe(1500);
  });
  it('conta o tempo rodando', () => {
    expect(tick(start(initialPomodoro()), 60).remaining).toBe(1440);
  });
  it('ao fim de 25 min conclui o ciclo e vai para a pausa de 5', () => {
    const s = tick(start(initialPomodoro()), 25 * 60);
    expect(s).toMatchObject({ phase: 'break', remaining: 300, completed: 1, running: true });
  });
  it('ao fim da pausa volta ao foco sem contar ciclo extra', () => {
    let s = tick(start(initialPomodoro()), 25 * 60);
    s = tick(s, 5 * 60);
    expect(s).toMatchObject({ phase: 'work', remaining: 1500, completed: 1 });
  });
  it('tempo em excesso (app em segundo plano) passa para a fase seguinte', () => {
    const s = tick(start(initialPomodoro()), 25 * 60 + 10);
    expect(s).toMatchObject({ phase: 'break', remaining: 290, completed: 1 });
    const many = tick(start(initialPomodoro()), 2 * (25 + 5) * 60 + 30);
    expect(many).toMatchObject({ phase: 'work', completed: 2, remaining: 1470 });
  });
  it('pausar e reiniciar', () => {
    const s = pause(tick(start(initialPomodoro()), 100));
    expect(s.running).toBe(false);
    expect(reset(s)).toEqual(initialPomodoro());
    expect(reset({ ...s, completed: 3 }).completed).toBe(3); // reiniciar não zera os ciclos do dia
  });
  it('formatClock', () => {
    expect(formatClock(1500)).toBe('25:00');
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(-3)).toBe('00:00');
  });
});
