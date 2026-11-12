import React from 'react';
import { ItemsScreen } from '../../src/components/ItemsScreen';

export default function Next() {
  return (
    <ItemsScreen title="Próxima ação" subtitle="O próximo passo concreto de cada coisa." params={{ status: 'next' }} icon="arrow"
      filter={i => i.kind !== 'project'} createDefaults={{ status: 'next' }} placeholder="Nova próxima ação…"
      emptyTitle="Nenhuma próxima ação." emptyHint="Processe a caixa de entrada para decidir os próximos passos."
      quick={() => [{ label: 'Aguardando', patch: { status: 'waiting' } }, { label: 'Algum dia', patch: { status: 'someday' } }]} />
  );
}
