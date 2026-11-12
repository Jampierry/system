import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../state/session';
import { useBus } from '../state/bus';
import { colors, radius, space } from '../theme';
import { Icon } from './Icon';

type Ref = { id: string; title: string };

export function BacklinksPanel({ noteId, tags, headings, onOpen, onTag }: {
  noteId: string; tags: string[]; headings: { level: number; text: string }[]; onOpen: (id: string) => void; onTag: (t: string) => void;
}) {
  const [backlinks, setBacklinks] = useState<Ref[]>([]);
  const [mentions, setMentions] = useState<Ref[]>([]);
  const [tick, setTick] = useState(0);
  useBus('notes', () => setTick(t => t + 1));

  useEffect(() => {
    let live = true;
    api<{ backlinks: Ref[] }>(`/api/notes/${noteId}/backlinks`).then(r => live && setBacklinks(r.backlinks)).catch(() => live && setBacklinks([]));
    api<{ mentions: Ref[] }>(`/api/notes/${noteId}/unlinked`).then(r => live && setMentions(r.mentions)).catch(() => live && setMentions([]));
    return () => { live = false; };
  }, [noteId, tick]);

  const list = (items: Ref[], empty: string) => items.length
    ? items.map(n => (
      <Pressable key={n.id} accessibilityRole="link" onPress={() => onOpen(n.id)} style={({ hovered }: any) => [styles.row, hovered && { backgroundColor: '#1a1a22' }]}>
        <Icon name="note" size={13} color={colors.muted} /><Text style={styles.rowText} numberOfLines={1}>{n.title}</Text>
      </Pressable>))
    : <Text style={styles.empty}>{empty}</Text>;

  return (
    <View style={styles.wrap}>
      <Text style={styles.h}>Backlinks · {backlinks.length}</Text>
      {list(backlinks, 'Nenhuma nota aponta para esta.')}
      <Text style={styles.h}>Menções sem link · {mentions.length}</Text>
      {list(mentions, 'Nenhuma menção solta.')}
      <Text style={styles.h}>Estrutura</Text>
      {headings.length ? headings.map((h, i) => <Text key={i} style={[styles.outline, { paddingLeft: (h.level - 1) * 12 }]} numberOfLines={1}>{h.text}</Text>) : <Text style={styles.empty}>Sem títulos.</Text>}
      <Text style={styles.h}>Tags</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {tags.length ? tags.map(t => <Pressable key={t} onPress={() => onTag(t)} accessibilityRole="button"><Text style={styles.tag}>#{t}</Text></Pressable>) : <Text style={styles.empty}>Sem tags.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, padding: space.md },
  h: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 6, borderRadius: radius.sm },
  rowText: { color: colors.text, fontSize: 13, flex: 1 },
  empty: { color: colors.faint, fontSize: 12 },
  outline: { color: colors.muted, fontSize: 12.5 },
  tag: { color: '#c58bff', fontSize: 12.5, backgroundColor: '#241b33', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
});
