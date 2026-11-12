import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, EmptyState, Field, Heading, Spinner } from '../../src/components/ui';
import { Page } from '../../src/components/ItemsScreen';
import { ItemRow } from '../../src/components/ItemRow';
import { ProcessSheet } from '../../src/components/ProcessSheet';
import { useItems } from '../../src/state/useItems';
import { useItemActions } from '../../src/state/itemActions';
import { useSession } from '../../src/state/session';
import { View } from 'react-native';

export default function Inbox() {
  const router = useRouter();
  const { can } = useSession();
  const { items } = useItems({ status: 'inbox' });
  const act = useItemActions();
  const [text, setText] = useState('');
  const [processing, setProcessing] = useState(false);

  async function add() {
    if (text.trim() && (await act.create({ title: text.trim() }))) setText('');
  }

  return (
    <Page>
      <Heading
        title="Caixa de entrada."
        subtitle="Tire da cabeça. Deixe aqui tudo o que precisa da sua atenção."
        right={can('assistant.use') ? (
          <>
            <Button label="Processar" icon="sync" variant="secondary" disabled={!items?.length} onPress={() => setProcessing(true)} testID="process-inbox" />
            <Button label="Processar" icon="wave" variant="secondary" onPress={() => router.push({ pathname: '/assistant', params: { voice: '1', t: String(Date.now()) } } as any)} />
          </>
        ) : undefined}
      />
      {act.canWrite ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 16 }}>
          <View style={{ flex: 1 }}><Field value={text} onChangeText={setText} placeholder="Adicionar item…" onSubmitEditing={add} /></View>
          <Button label="Adicionar" icon="plus" variant="secondary" disabled={!text.trim()} onPress={add} />
        </View>
      ) : null}
      {items === null ? <Spinner /> : items.length === 0 ? (
        <EmptyState title="Sua caixa de entrada está vazia." hint="Use “Capturar item” para registrar o que vier à mente." />
      ) : items.map(i => (
        <ItemRow key={i.id} item={i} quick={[
          { label: 'Próxima ação', patch: { status: 'next' } },
          { label: 'Aguardando', patch: { status: 'waiting' } },
          { label: 'Algum dia', patch: { status: 'someday' } },
        ]} />
      ))}
      <ProcessSheet visible={processing} onClose={() => setProcessing(false)} />
    </Page>
  );
}
