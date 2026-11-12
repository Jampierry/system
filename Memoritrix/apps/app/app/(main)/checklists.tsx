import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/state/session';
import { emit } from '../../src/state/bus';
import { Badge, Button, EmptyState, Field, Heading, Spinner } from '../../src/components/ui';
import { Page } from '../../src/components/ItemsScreen';
import { Icon } from '../../src/components/Icon';
import { useToast } from '../../src/components/Toast';
import { useItems } from '../../src/state/useItems';
import { useItemActions } from '../../src/state/itemActions';
import { colors, radius, space } from '../../src/theme';
import type { Item } from '../../src/lib/types';

type Entry = { id?: string; text: string; done: boolean };

function Checklist({ item }: { item: Item }) {
  const act = useItemActions();
  const toast = useToast();
  const [text, setText] = useState('');
  const entries: Entry[] = item.entries ?? [];

  async function save(next: Entry[]) {
    try {
      await api(`/api/items/${item.id}/entries`, { method: 'PUT', body: { entries: next.map(e => ({ text: e.text, done: e.done })) } });
      emit('items');
    } catch (e: any) { toast.show(e.message, 'error'); }
  }
  const done = entries.filter(e => e.done).length;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Icon name="checklist" size={16} color={colors.accentText} />
        <Text style={styles.name}>{item.title}</Text>
        <Badge text={`${done}/${entries.length}`} tone={entries.length && done === entries.length ? 'success' : 'muted'} />
        {act.canWrite && entries.some(e => e.done) ? <Button label="Desmarcar tudo" small variant="ghost" onPress={() => void save(entries.map(e => ({ ...e, done: false })))} /> : null}
      </View>
      {entries.map((e, i) => (
        <View key={e.id ?? i} style={styles.entry}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: e.done }} accessibilityLabel={e.text} disabled={!act.canWrite}
            onPress={() => void save(entries.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} style={[styles.box, e.done && styles.boxOn]}>
            {e.done ? <Icon name="check" size={11} color={colors.white} strokeWidth={3} /> : null}
          </Pressable>
          <Text style={[styles.entryText, e.done && { color: colors.faint, textDecorationLine: 'line-through' }]}>{e.text}</Text>
          {act.canWrite ? <Pressable accessibilityLabel={`Remover ${e.text}`} onPress={() => void save(entries.filter((_, j) => j !== i))} hitSlop={8}><Icon name="x" size={13} color={colors.faint} /></Pressable> : null}
        </View>
      ))}
      {act.canWrite ? (
        <View style={{ marginTop: 8 }}>
          <Field value={text} onChangeText={setText} placeholder="Novo item da checklist…" onSubmitEditing={() => { if (text.trim()) { void save([...entries, { text: text.trim(), done: false }]); setText(''); } }} />
        </View>
      ) : null}
    </View>
  );
}

export default function Checklists() {
  const { items } = useItems({ kind: 'checklist' });
  const act = useItemActions();
  const [text, setText] = useState('');
  async function add() {
    if (text.trim() && (await act.create({ title: text.trim(), kind: 'checklist', status: 'next' }))) setText('');
  }
  const list = (items ?? []).filter(i => i.status !== 'trashed');
  return (
    <Page>
      <Heading title="Checklists" subtitle="Listas que você reutiliza: viagem, mudança, rotina." />
      {act.canWrite ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: space.lg }}>
          <View style={{ flex: 1 }}><Field value={text} onChangeText={setText} placeholder="Nova checklist…" onSubmitEditing={add} /></View>
          <Button label="Criar" icon="plus" variant="secondary" disabled={!text.trim()} onPress={add} />
        </View>
      ) : null}
      {items === null ? <Spinner /> : list.length === 0 ? <EmptyState icon="checklist" title="Nenhuma checklist." hint="Crie uma para não esquecer nada." /> : list.map(i => <Checklist key={i.id} item={i} />)}
    </Page>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, minWidth: 120 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  entryText: { color: colors.text, fontSize: 14, flex: 1 },
  box: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.success, borderColor: colors.success },
});
