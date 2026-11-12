import React from 'react';
import { ItemsScreen } from '../../src/components/ItemsScreen';

export default function Waiting() {
  return (
    <ItemsScreen title="Aguardando resposta" subtitle="O que depende de outras pessoas." params={{ status: 'waiting' }} icon="clock"
      createDefaults={{ status: 'waiting' }} placeholder="Algo que você está esperando…"
      emptyTitle="Você não está esperando nada." emptyHint="Itens que dependem de alguém aparecem aqui."
      quick={() => [{ label: 'Voltou: próxima ação', patch: { status: 'next', waitingOn: null } }]} />
  );
}
