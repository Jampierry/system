import React from 'react';
import { ItemsScreen } from '../../src/components/ItemsScreen';

export default function Recurring() {
  return (
    <ItemsScreen title="Recorrências" subtitle="Itens que se repetem. Ao concluir, a próxima ocorrência é criada." params={{}} icon="repeat"
      filter={i => !!i.recurrence && i.status !== 'done' && i.status !== 'trashed'} placeholder="Para criar, adicione e defina a repetição nos detalhes…"
      createDefaults={{ status: 'next' }} emptyTitle="Nenhuma recorrência." emptyHint="Abra um item, escolha a repetição e defina uma data." />
  );
}
