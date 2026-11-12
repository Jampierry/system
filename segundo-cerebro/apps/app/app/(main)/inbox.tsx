import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api } from '../../src/state/session';
import { useBus } from '../../src/state/bus';
import { useArea } from '../../src/state/area';
import { Button, EmptyState, Heading, Spinner } from '../../src/components/ui';
import { useCapture } from '../../src/components/CaptureModal';
import { colors, space } from '../../src/theme';

type Item = { id: string; title: string };

export default function Inbox() {
  const { areaId } = useArea();
  const { openCapture } = useCapture();
  const [items, setItems] = useState<Item[] | null>(null);
  const load = useCallback(async () => {
    const q = new URLSearchParams({ status: 'inbox', ...(areaId ? { area: areaId } : {}) });
    setItems((await api<{ items: Item[] }>(`/api/items?${q}`)).items);
  }, [areaId]);
  useEffect(() => { void load(); }, [load]);
  useBus('items', () => { void load(); });

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, maxWidth: 900, width: '100%', alignSelf: 'center' }}>
      <Heading title="Caixa de entrada." subtitle="Tire da cabeça. Deixe aqui tudo o que precisa da sua atenção." />
      {items === null ? <Spinner /> : items.length === 0 ? (
        <EmptyState title="Sua caixa de entrada está vazia." action={<Button label="Adicionar item" icon="plus" variant="ghost" onPress={() => openCapture()} />} />
      ) : items.map(i => (
        <View key={i.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}><Text style={{ color: colors.text }}>{i.title}</Text></View>
      ))}
    </ScrollView>
  );
}
