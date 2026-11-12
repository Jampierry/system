import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../src/state/session';
import { useBus } from '../../src/state/bus';
import { Button, EmptyState, Field, Heading } from '../../src/components/ui';
import { Page } from '../../src/components/ItemsScreen';
import { ItemRow } from '../../src/components/ItemRow';
import { Icon } from '../../src/components/Icon';
import { monthCells } from '../../src/components/CalendarPanel';
import { useItemActions } from '../../src/state/itemActions';
import { toDateInput } from '../../src/lib/dates';
import { colors, radius, space } from '../../src/theme';
import type { Item } from '../../src/lib/types';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEK = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function CalendarScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const today = new Date();
  const todayKey = dayKey(today.getFullYear(), today.getMonth(), today.getDate());
  const [selected, setSelected] = useState(/^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date! : todayKey);
  const [cur, setCur] = useState(() => ({ y: Number(selected.slice(0, 4)), m: Number(selected.slice(5, 7)) - 1 }));
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState('');
  const act = useItemActions();

  useEffect(() => {
    if (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
      setSelected(params.date);
      setCur({ y: Number(params.date.slice(0, 4)), m: Number(params.date.slice(5, 7)) - 1 });
    }
  }, [params.date]);

  const load = useCallback(async () => {
    try { setItems((await api<{ items: Item[] }>(`/api/calendar?month=${cur.y}-${pad(cur.m + 1)}`)).items); } catch { setItems([]); }
  }, [cur]);
  useEffect(() => { void load(); }, [load]);
  useBus('items', () => { void load(); });

  const byDay = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const i of items) {
      const k = toDateInput(i.startAt ?? i.dueAt);
      (map[k] ??= []).push(i);
    }
    return map;
  }, [items]);
  const cells = useMemo(() => monthCells(cur.y, cur.m), [cur]);
  const shift = (d: number) => setCur(c => { const dt = new Date(c.y, c.m + d, 1); return { y: dt.getFullYear(), m: dt.getMonth() }; });
  const dayItems = byDay[selected] ?? [];

  async function add() {
    const [y, mo, d] = selected.split('-').map(Number);
    if (text.trim() && (await act.create({ title: text.trim(), status: 'next', dueAt: new Date(y, mo - 1, d, 12, 0, 0).toISOString() }))) setText('');
  }

  return (
    <Page>
      <Heading title="Calendário" subtitle="Itens com data. Toque em um dia para ver e adicionar." />
      <View style={styles.monthHead}>
        <Pressable accessibilityLabel="Mês anterior" onPress={() => shift(-1)} hitSlop={8}><Icon name="left" size={18} color={colors.muted} /></Pressable>
        <Text style={styles.month}>{MONTHS[cur.m]} de {cur.y}</Text>
        <Pressable accessibilityLabel="Próximo mês" onPress={() => shift(1)} hitSlop={8}><Icon name="right" size={18} color={colors.muted} /></Pressable>
        <Button label="Hoje" small variant="ghost" onPress={() => { setCur({ y: today.getFullYear(), m: today.getMonth() }); setSelected(todayKey); }} />
      </View>
      <View style={styles.grid}>
        {WEEK.map(w => <Text key={w} style={styles.wd}>{w}</Text>)}
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.cell} />;
          const k = dayKey(cur.y, cur.m, d);
          const n = (byDay[k] ?? []).filter(x => x.status !== 'done').length;
          const on = k === selected;
          return (
            <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Dia ${d}${n ? `, ${n} itens` : ''}`} accessibilityState={{ selected: on }} onPress={() => setSelected(k)}
              style={[styles.cell, styles.cellDay, on && styles.cellOn, k === todayKey && styles.cellToday]}>
              <Text style={[styles.dn, k === todayKey && { color: colors.accentText, fontWeight: '800' }]}>{d}</Text>
              {n > 0 ? <View style={styles.pill}><Text style={styles.pillText}>{n}</Text></View> : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.dayTitle}>{selected.split('-').reverse().join('/')}</Text>
      {act.canWrite ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: space.md }}>
          <View style={{ flex: 1 }}><Field value={text} onChangeText={setText} placeholder="Adicionar neste dia…" onSubmitEditing={add} /></View>
          <Button label="Adicionar" icon="plus" variant="secondary" disabled={!text.trim()} onPress={add} />
        </View>
      ) : null}
      {dayItems.length === 0 ? <EmptyState icon="calendar" title="Nada neste dia." /> : dayItems.map(i => <ItemRow key={i.id} item={i} />)}
    </Page>
  );
}

const styles = StyleSheet.create({
  monthHead: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: space.md },
  month: { color: colors.text, fontSize: 16, fontWeight: '700', minWidth: 170 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderLeftWidth: 1, borderColor: colors.border },
  wd: { width: `${100 / 7}%`, color: colors.faint, fontSize: 11, textAlign: 'center', paddingVertical: 6, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  cell: { width: `${100 / 7}%`, minHeight: 58, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.border, padding: 6 },
  cellDay: { backgroundColor: colors.surface },
  cellOn: { backgroundColor: colors.selected },
  cellToday: { borderColor: colors.accent },
  dn: { color: colors.muted, fontSize: 12.5 },
  pill: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: colors.accentBg, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1 },
  pillText: { color: colors.accentText, fontSize: 10.5, fontWeight: '700' },
  dayTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: space.xl, marginBottom: space.sm },
});
