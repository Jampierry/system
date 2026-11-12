import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/state/session';
import { EmptyState, Heading, Spinner } from '../../src/components/ui';
import { Page } from '../../src/components/ItemsScreen';
import { colors, space } from '../../src/theme';

type Entry = { id: string; at: string; kind: string; summary: string };

function dayLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const diff = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400_000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function Logbook() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  useEffect(() => { api<{ entries: Entry[] }>('/api/logbook?limit=300').then(r => setEntries(r.entries)).catch(() => setEntries([])); }, []);
  const groups: [string, Entry[]][] = [];
  const now = new Date();
  for (const e of entries ?? []) {
    const label = dayLabel(e.at, now);
    const g = groups.find(x => x[0] === label);
    if (g) g[1].push(e); else groups.push([label, [e]]);
  }
  return (
    <Page>
      <Heading title="Logbook" subtitle="O registro do que você concluiu." />
      {entries === null ? <Spinner /> : groups.length === 0 ? <EmptyState icon="logbook" title="Nada registrado ainda." hint="Conclua itens e revisões para vê-los aqui." /> : groups.map(([label, list]) => (
        <View key={label} style={{ marginBottom: space.lg }}>
          <Text style={styles.day}>{label}</Text>
          {list.map(e => (
            <View key={e.id} style={styles.row}>
              <Text style={styles.time}>{new Date(e.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
              <Text style={styles.text}>{e.summary}</Text>
            </View>
          ))}
        </View>
      ))}
    </Page>
  );
}

const styles = StyleSheet.create({
  day: { color: colors.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  time: { color: colors.faint, fontSize: 12, width: 44, fontVariant: ['tabular-nums'] },
  text: { color: colors.text, fontSize: 14, flex: 1 },
});
