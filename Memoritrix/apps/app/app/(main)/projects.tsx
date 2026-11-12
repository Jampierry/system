import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/state/session';
import { Badge, Button, EmptyState, Field, Heading, Spinner } from '../../src/components/ui';
import { Page } from '../../src/components/ItemsScreen';
import { ItemRow } from '../../src/components/ItemRow';
import { Icon } from '../../src/components/Icon';
import { useItems } from '../../src/state/useItems';
import { useItemActions } from '../../src/state/itemActions';
import { useBus } from '../../src/state/bus';
import { colors, radius, space } from '../../src/theme';
import type { Item } from '../../src/lib/types';

function Project({ project }: { project: Item }) {
  const act = useItemActions();
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<Item[] | null>(null);
  const [text, setText] = useState('');

  const load = React.useCallback(async () => {
    try { setChildren((await api<{ items: Item[] }>(`/api/items?project=${project.id}`)).items); } catch { setChildren([]); }
  }, [project.id]);
  React.useEffect(() => { void load(); }, [load]);
  useBus('items', () => { void load(); });

  const active = (children ?? []).filter(c => c.status !== 'done' && c.status !== 'trashed');
  const hasNext = active.some(c => c.status === 'next');
  const done = (children ?? []).filter(c => c.status === 'done').length;

  async function add() {
    if (text.trim() && (await act.create({ title: text.trim(), status: 'next', projectId: project.id }))) setText('');
  }

  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(o => !o)} style={styles.head}>
        <Icon name={open ? 'down' : 'right'} size={16} color={colors.muted} />
        <Icon name="folder" size={16} color={colors.accentText} />
        <Text style={styles.name}>{project.title}</Text>
        {children ? <Badge text={`${done}/${children.length} concluídas`} /> : null}
        {children && !hasNext ? <Badge text="Sem próxima ação" tone="warning" /> : null}
      </Pressable>
      {open ? (
        <View style={{ paddingLeft: space.lg }}>
          {children === null ? <Spinner /> : active.map(c => <ItemRow key={c.id} item={c} />)}
          {act.canWrite ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <View style={{ flex: 1 }}><Field value={text} onChangeText={setText} placeholder="Nova próxima ação do projeto…" onSubmitEditing={add} /></View>
              <Button label="Adicionar" variant="secondary" small onPress={add} disabled={!text.trim()} />
            </View>
          ) : null}
          <ItemRow item={project} />
        </View>
      ) : null}
    </View>
  );
}

export default function Projects() {
  const { items } = useItems({ kind: 'project' });
  const act = useItemActions();
  const [text, setText] = useState('');
  const list = (items ?? []).filter(i => i.status !== 'done' && i.status !== 'trashed');
  async function add() {
    if (text.trim() && (await act.create({ title: text.trim(), kind: 'project', status: 'next' }))) setText('');
  }
  return (
    <Page>
      <Heading title="Projetos" subtitle="Resultados que pedem mais de um passo. Todo projeto precisa de uma próxima ação." />
      {act.canWrite ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: space.lg }}>
          <View style={{ flex: 1 }}><Field value={text} onChangeText={setText} placeholder="Novo projeto…" onSubmitEditing={add} /></View>
          <Button label="Criar projeto" icon="plus" variant="secondary" disabled={!text.trim()} onPress={add} />
        </View>
      ) : null}
      {items === null ? <Spinner /> : list.length === 0 ? <EmptyState icon="folder" title="Nenhum projeto ativo." hint="Crie um projeto e adicione suas próximas ações." /> : list.map(p => <Project key={p.id} project={p} />)}
    </Page>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: space.md, marginBottom: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, minWidth: 120 },
});
