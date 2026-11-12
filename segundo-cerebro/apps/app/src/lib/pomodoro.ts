export const WORK_SECONDS = 25 * 60;
export const BREAK_SECONDS = 5 * 60;

export type PomodoroState = { phase: 'work' | 'break'; remaining: number; running: boolean; completed: number };

export const initialPomodoro = (): PomodoroState => ({ phase: 'work', remaining: WORK_SECONDS, running: false, completed: 0 });
export const start = (s: PomodoroState): PomodoroState => ({ ...s, running: true });
export const pause = (s: PomodoroState): PomodoroState => ({ ...s, running: false });
/** Reinicia o relógio do foco mantendo o total de ciclos do dia. */
export const reset = (s: PomodoroState): PomodoroState => ({ phase: 'work', remaining: WORK_SECONDS, running: false, completed: s.completed });

/** Avança `seconds`; o tempo excedente passa para as fases seguintes (útil quando o app ficou em segundo plano). */
export function tick(s: PomodoroState, seconds = 1): PomodoroState {
  if (!s.running) return s;
  let { phase, completed } = s;
  let remaining = s.remaining - seconds;
  while (remaining <= 0) {
    if (phase === 'work') { completed++; phase = 'break'; remaining += BREAK_SECONDS; }
    else { phase = 'work'; remaining += WORK_SECONDS; }
  }
  return { ...s, phase, completed, remaining };
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
