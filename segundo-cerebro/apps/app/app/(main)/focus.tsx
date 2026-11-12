import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Heading, EmptyState, Spinner, Button } from '../../src/components/ui';
import { Page } from '../../src/components/ItemsScreen';
import { ItemRow } from '../../src/components/ItemRow';
import { Pomodoro } from '../../src/components/Pomodoro';
import { useItems } from '../../src/state/useItems';
import { toDateInput } from '../../src/lib/dates';
import { colors, space } from '../../src/theme';
import type { Item } from '../../src/lib/types';

export default function Focus() {
  const { items } = useItems({ status: 'next' });
  const [focusId, setFocusId] = useState<string | null>(null);
  const todayKey = toDateInput(new Date().toISOString());
  const list = (items ?? []).filter(i => i.kind !== 'project');
  const dayOf = (i: Item) => toDateInput(i.startAt ?? i.dueAt);
  const overdue = list.filter(i => dayOf(i) && dayOf(i) < todayKey);
  const today = list.filter(i => dayOf(i) === todayKey);
  const rest = list.filter(i => !dayOf(i)).slice(0, 5);
  const focusItem = list.find(i => i.id === focusId);

  const section = (title: string, rows: Item[]) => rows.length ? (
    <View style={{ marginTop: space.lg }}>
      <Text style={styles.section}>{title}</Text>
      {rows.map(i => (
        <ItemRow key={i.id} item={i} extra={<Button label={focusId === i.id ? 'Em foco' : 'Focar nisso'} small variant={focusId === i.id ? 'secondary' : 'ghost'} icon="target" onPress={() => setFocusId(i.id)} style={{ alignSelf: 'flex-start' }} />} />
      ))}
    </View>
  ) : null;

  return (
    <Page>
      <Heading title="Foco" subtitle="Atrasados, o que é para hoje e o que mais vale a pena agora." />
      <Pomodoro focusTitle={focusItem?.title} />
      {items === null ? <Spinner /> : overdue.length + today.length + rest.length === 0 ? (
        <EmptyState icon="target" title="Nada para focar agora." hint="Defina datas nas próximas ações para vê-las aqui." />
      ) : (
        <>{section('Atrasados', overdue)}{section('Hoje', today)}{section('Sem data (top 5)', rest)}</>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
});
