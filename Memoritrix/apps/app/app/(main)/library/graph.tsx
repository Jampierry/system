import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../../src/state/session';
import { useBus } from '../../../src/state/bus';
import { useArea } from '../../../src/state/area';
import { Button, EmptyState, Heading, Spinner } from '../../../src/components/ui';
import { GraphView } from '../../../src/components/GraphView';
import { colors, radius, space } from '../../../src/theme';

type G = { nodes: { id: string; title: string }[]; edges: { source: string; target: string }[] };

export default function GraphScreen() {
  const router = useRouter();
  const { areaId } = useArea();
  const [tag, setTag] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [data, setData] = useState<G | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hideOrphans, setHideOrphans] = useState(false);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (tag) qs.set('tag', tag);
    if (areaId) qs.set('area', areaId);
    try { setData(await api<G>(`/api/graph?${qs}`)); } catch { setData({ nodes: [], edges: [] }); }
  }, [tag, areaId]);
  useEffect(() => { void load(); }, [load]);
  useBus('notes', () => { void load(); });
  useEffect(() => { api<{ notes: { tags: string[] }[] }>('/api/notes').then(r => setTags([...new Set(r.notes.flatMap(n => n.tags))].sort())).catch(() => {}); }, []);

  const view = useMemo(() => {
    if (!data) return null;
    if (!hideOrphans) return data;
    const linked = new Set(data.edges.flatMap(e => [e.source, e.target]));
    return { nodes: data.nodes.filter(n => linked.has(n.id)), edges: data.edges };
  }, [data, hideOrphans]);
  const sel = view?.nodes.find(n => n.id === selected);

  return (
    <View style={{ flex: 1, padding: space.lg }}>
      <Heading title="Grafo" subtitle="Como suas notas se conectam. Arraste para mover, role para dar zoom, toque em uma nota para destacar." />
      <View style={styles.filters}>
        <Pressable onPress={() => setTag(null)} accessibilityRole="button"><Text style={[styles.chip, !tag && styles.chipOn]}>Todas</Text></Pressable>
        {tags.map(t => <Pressable key={t} onPress={() => setTag(tag === t ? null : t)} accessibilityRole="button" accessibilityState={{ selected: tag === t }}><Text style={[styles.chip, tag === t && styles.chipOn]}>#{t}</Text></Pressable>)}
        <Pressable onPress={() => setHideOrphans(h => !h)} accessibilityRole="button" accessibilityState={{ selected: hideOrphans }}><Text style={[styles.chip, hideOrphans && styles.chipOn]}>Ocultar notas soltas</Text></Pressable>
        <View style={{ flex: 1 }} />
        {view ? <Text style={styles.count}>{view.nodes.length} notas · {view.edges.length} ligações</Text> : null}
      </View>
      <View style={{ flex: 1 }}>
        {view === null ? <Spinner /> : view.nodes.length === 0 ? <EmptyState icon="graph" title="Nenhuma nota para mostrar." hint="Crie notas e ligue-as com [[links]]." /> : (
          <GraphView nodes={view.nodes} edges={view.edges} selectedId={selected} onSelect={setSelected} />
        )}
        {sel ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle} numberOfLines={1}>{sel.title}</Text>
            <Button label="Abrir nota" small variant="primary" onPress={() => router.push(`/library/${sel.id}` as any)} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: space.md },
  chip: { color: colors.muted, fontSize: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  chipOn: { color: colors.accentText, backgroundColor: colors.accentBg, borderColor: '#2a3a7a' },
  count: { color: colors.faint, fontSize: 12 },
  card: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: 10, maxWidth: 360 },
  cardTitle: { color: colors.text, fontWeight: '700', fontSize: 13, flexShrink: 1 },
});
