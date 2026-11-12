import React from 'react';
import { ItemsScreen } from '../../src/components/ItemsScreen';

export default function Someday() {
  return (
    <ItemsScreen title="Algum dia/talvez" subtitle="Ideias sem compromisso. Revise na revisão semanal." params={{ status: 'someday' }} icon="bulb"
      createDefaults={{ status: 'someday' }} placeholder="Uma ideia para algum dia…"
      emptyTitle="Nada guardado para algum dia." emptyHint="Guarde aqui o que você não quer perder, mas não é para agora."
      quick={() => [{ label: 'Ativar', patch: { status: 'next' } }]} />
  );
}
