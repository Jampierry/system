import React from 'react';
import { Badge } from './ui';

export function ModeBadge({ mode }: { mode: 'demo' | 'claude' | null }) {
  if (!mode) return null;
  return <Badge text={mode === 'claude' ? 'Claude' : 'Modo demo'} tone={mode === 'claude' ? 'accent' : 'muted'} />;
}
