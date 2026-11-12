import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../state/session';
import { useBus } from '../state/bus';
import { colors, radius, space } from '../theme';
import { Icon } from './Icon';

type Item = { id: string; title: string; status: string; dueAt: string | null; startAt: string | null };
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEK = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const key = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;

/** Células do mês (semana começa na segunda). null = vazio. */
export function monthCells(year: number, month: number): (number | null)[] {
  const first = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function CalendarPanel() {
  const router = useRouter();
  const today = new Date();
  const [cur, setCur] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [data, setData] = useState<{ items: Item[]; days: Record<string, number> }>({ items: [], days: {} });

  const load = useCallback(async () => {
    try { setData(await api(`/api/calendar?month=${key(cur.y, cur.m)}`)); } catch { setData({ items: [], days: {} }); }
  }, [cur]);
  useEffect(() => { void load(); }, [load]);
  useBus('items', () => { void load(); });

  const cells = useMemo(() => monthCells(cur.y, cur.m), [cur]);
  const shift = (d: number) => setCur(c => { const dt = new Date(c.y, c.m + d, 1); return { y: dt.getFullYear(), m: dt.getMonth() }; });
  const pending = data.items.filter(i => i.status !== 'done');
  const isToday = (d: number) => d === today.getDate() && cur.m === today.getMonth() && cur.y === today.getFullYear();

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Pressable accessibilityLabel="Mês anterior" onPress={() => shift(-1)} hitSlop={8}><Icon name="left" size={16} color={colors.muted} /></Pressable>
        <Text style={styles.title}>{MONTHS[cur.m]} de {cur.y}</Text>
        <Pressable accessibilityLabel="Próximo mês" onPress={() => shift(1)} hitSlop={8}><Icon name="right" size={16} color={colors.muted} /></Pressable>
      </View>
      <View style={styles.grid}>
        {WEEK.map((w, i) => <Text key={i} style={styles.wd}>{w}</Text>)}
        {cells.map((d, i) => {
          const k = d ? `${key(cur.y, cur.m)}-${String(d).padStart(2, '0')}` : '';
          const n = d ? data.days[k] ?? 0 : 0;
          return (
            <Pressable key={i} disabled={!d} accessibilityLabel={d ? `Dia ${d}${n ? `, ${n} itens` : ''}` : undefined}
              onPress={() => router.push({ pathname: '/calendar', params: { date: k } } as any)} style={[styles.cell, d ? styles.cellOn : null, d && isToday(d) && styles.today]}>
              {d ? <Text style={[styles.dn, isToday(d) && { color: colors.white, fontWeight: '800' }]}>{d}</Text> : null}
              {n > 0 ? <View style={styles.mark} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.list}>
        {pending.length === 0 ? (
          <View style={styles.none}><Icon name="calendar" size={22} color={colors.faint} /><Text style={styles.noneText}>Nenhum item pendente neste mês.</Text></View>
        ) : pending.slice(0, 12).map(i => {
          const w = i.startAt ?? i.dueAt ?? '';
          return (
            <View key={i.id} style={styles.li}>
              <Text style={styles.liDate}>{w.slice(8, 10)}/{w.slice(5, 7)}</Text>
              <Text style={styles.liTitle} numberOfLines={1}>{i.title}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 290, padding: space.lg, borderLeftWidth: 1, borderLeftColor: colors.border, backgroundColor: colors.bg, height: '100%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  title: { color: colors.text, fontSize: 13, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wd: { width: `${100 / 7}%`, textAlign: 'center', color: colors.faint, fontSize: 10.5, paddingBottom: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  cellOn: { },
  today: { backgroundColor: colors.accent, borderRadius: radius.pill },
  dn: { color: colors.muted, fontSize: 11.5 },
  mark: { position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.warning },
  list: { marginTop: space.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md, gap: 8 },
  none: { alignItems: 'center', gap: 8, paddingVertical: space.xl },
  noneText: { color: colors.faint, fontSize: 11.5, textAlign: 'center' },
  li: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  liDate: { color: colors.warning, fontSize: 11, fontWeight: '700', width: 36 },
  liTitle: { flex: 1, color: colors.text, fontSize: 12.5 },
});
