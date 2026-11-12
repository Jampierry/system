import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../theme';
import { EmptyState, Field, Heading, Spinner, Button } from './ui';
import { IconName } from './Icon';
import { ItemRow, type Quick } from './ItemRow';
import { useItems } from '../state/useItems';
import { useItemActions } from '../state/itemActions';
import type { Item } from '../lib/types';

export const Page = ({ children }: { children: React.ReactNode }) => (
  <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">{children}</ScrollView>
);

/** Tela de lista genérica: filtros da API, linha de adição rápida e estado vazio. */
export function ItemsScreen({ title, subtitle, params, emptyTitle, emptyHint, icon, createDefaults, quick, filter, placeholder }: {
  title: string; subtitle?: string; params: Record<string, string | undefined>;
  emptyTitle: string; emptyHint?: string; icon?: IconName; createDefaults?: Record<string, unknown>;
  quick?: (it: Item) => Quick[]; filter?: (it: Item) => boolean; placeholder?: string;
}) {
  const { items, error } = useItems(params);
  const act = useItemActions();
  const [text, setText] = useState('');
  const list = (items ?? []).filter(filter ?? (() => true));

  async function add() {
    if (!text.trim()) return;
    if (await act.create({ title: text.trim(), ...createDefaults })) setText('');
  }

  return (
    <Page>
      <Heading title={title} subtitle={subtitle} />
      {act.canWrite ? (
        <View style={styles.add}>
          <View style={{ flex: 1 }}><Field value={text} onChangeText={setText} placeholder={placeholder ?? 'Adicionar item…'} onSubmitEditing={add} /></View>
          <Button label="Adicionar" icon="plus" variant="secondary" disabled={!text.trim()} onPress={add} />
        </View>
      ) : null}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {items === null ? <Spinner /> : list.length === 0 ? <EmptyState icon={icon} title={emptyTitle} hint={emptyHint} /> : list.map(i => <ItemRow key={i.id} item={i} quick={quick?.(i)} />)}
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.xl, maxWidth: 900, width: '100%', alignSelf: 'center' },
  add: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: space.lg },
});
