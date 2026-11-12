import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../theme';
import { Button } from './ui';
import { useToast } from './Toast';
import { formatClock, initialPomodoro, pause, reset, start, tick, type PomodoroState } from '../lib/pomodoro';

export function Pomodoro({ focusTitle }: { focusTitle?: string }) {
  const toast = useToast();
  const [s, setS] = useState<PomodoroState>(initialPomodoro);
  const last = useRef(Date.now());
  const prev = useRef(s);

  useEffect(() => {
    if (!s.running) return;
    last.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - last.current) / 1000);
      if (elapsed >= 1) { last.current += elapsed * 1000; setS(cur => tick(cur, elapsed)); }
    }, 500);
    return () => clearInterval(id);
  }, [s.running]);

  useEffect(() => {
    if (s.phase !== prev.current.phase) toast.show(s.phase === 'break' ? 'Ciclo concluído! Pausa de 5 minutos.' : 'Pausa encerrada. Hora de focar.', 'info');
    prev.current = s;
  }, [s, toast]);

  return (
    <View style={styles.card}>
      <Text style={styles.phase}>{s.phase === 'work' ? 'Foco' : 'Pausa'}</Text>
      <Text accessibilityLabel={`Tempo restante ${formatClock(s.remaining)}`} style={[styles.clock, s.phase === 'break' && { color: colors.success }]}>{formatClock(s.remaining)}</Text>
      <Text style={styles.focus} numberOfLines={1}>{focusTitle ? `Em foco: ${focusTitle}` : 'Escolha uma tarefa para focar'}</Text>
      <View style={styles.actions}>
        <Button label={s.running ? 'Pausar' : 'Iniciar'} icon={s.running ? 'pause' : 'play'} variant="primary" onPress={() => setS(c => (c.running ? pause(c) : start(c)))} />
        <Button label="Reiniciar" variant="ghost" onPress={() => setS(c => reset(c))} />
      </View>
      <Text style={styles.count}>{s.completed} {s.completed === 1 ? 'ciclo concluído' : 'ciclos concluídos'} hoje</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.xl, alignItems: 'center', gap: 6 },
  phase: { color: colors.accentText, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  clock: { color: colors.text, fontSize: 56, fontWeight: '800', fontVariant: ['tabular-nums'] },
  focus: { color: colors.muted, fontSize: 13, maxWidth: 360 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  count: { color: colors.faint, fontSize: 11.5, marginTop: 8 },
});
