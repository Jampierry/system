import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { PanZoomView } from './PanZoomView';
import { layoutGraph, type GEdge, type GNode } from '../lib/graphLayout';
import { colors } from '../theme';

const W = 1400;
const H = 900;

export function GraphView({ nodes, edges, selectedId, onSelect }: {
  nodes: (GNode & { title: string })[]; edges: GEdge[]; selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  const pos = useMemo(() => layoutGraph(nodes, edges, { width: W, height: H }), [nodes, edges]);
  const degree = useMemo(() => {
    const d: Record<string, number> = {};
    for (const e of edges) { d[e.source] = (d[e.source] ?? 0) + 1; d[e.target] = (d[e.target] ?? 0) + 1; }
    return d;
  }, [edges]);
  const neighbors = useMemo(() => {
    const s = new Set<string>();
    if (selectedId) { s.add(selectedId); for (const e of edges) { if (e.source === selectedId) s.add(e.target); if (e.target === selectedId) s.add(e.source); } }
    return s;
  }, [edges, selectedId]);

  return (
    <PanZoomView onBackgroundPress={() => onSelect(null)}>
      <Svg width={W} height={H} style={{ position: 'absolute', left: -W / 2, top: -H / 2 }} pointerEvents="none">
        {edges.map((e, i) => {
          const a = pos[e.source]; const b = pos[e.target];
          if (!a || !b) return null;
          const on = !selectedId || (e.source === selectedId || e.target === selectedId);
          return <Line key={i} x1={a.x + W / 2} y1={a.y + H / 2} x2={b.x + W / 2} y2={b.y + H / 2} stroke={on && selectedId ? colors.accent : '#3a3a4a'} strokeWidth={on && selectedId ? 1.6 : 1} opacity={on ? 0.9 : 0.15} />;
        })}
      </Svg>
      {nodes.map(n => {
        const p = pos[n.id]; if (!p) return null;
        const r = 5 + Math.min(degree[n.id] ?? 0, 8) * 1.3;
        const dim = selectedId && !neighbors.has(n.id);
        const sel = n.id === selectedId;
        return (
          <Pressable key={n.id} accessibilityRole="button" accessibilityLabel={`Nota ${n.title}`} onPress={() => onSelect(n.id)}
            style={{ position: 'absolute', left: p.x - r, top: p.y - r, width: r * 2, height: r * 2, alignItems: 'center', opacity: dim ? 0.25 : 1 }}>
            <View style={[styles.dot, { width: r * 2, height: r * 2, borderRadius: r, backgroundColor: sel ? colors.warning : (degree[n.id] ? colors.accent : colors.faint) }]} />
            <View pointerEvents="none" style={[styles.labelBox, { top: r * 2 + 2, left: r - 60 }]}>
              <Text numberOfLines={1} style={[styles.label, sel && { color: colors.text, fontWeight: '700' }]}>{n.title}</Text>
            </View>
          </Pressable>
        );
      })}
    </PanZoomView>
  );
}

const styles = StyleSheet.create({
  dot: { },
  labelBox: { position: 'absolute', width: 120, alignItems: 'center' },
  label: { color: colors.muted, fontSize: 10.5, textAlign: 'center' },
});
