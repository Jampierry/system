import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { MindNode } from '@cerebro/shared';
import { colors, radius } from '../../theme';
import type { Transform } from '../PanZoomView';

const W = 170;
const H = 112;

/** Visão geral do mapa com o retângulo da área visível; tocar move a câmera para lá. */
export function Minimap({ nodes, selectedId, view, onJump }: { nodes: MindNode[]; selectedId: string | null; view: Transform | null; onJump: (wx: number, wy: number) => void }) {
  if (!nodes.length) return null;
  const xs = nodes.map(n => n.x); const ys = nodes.map(n => n.y);
  let minX = Math.min(...xs) - 120; let maxX = Math.max(...xs) + 120; let minY = Math.min(...ys) - 60; let maxY = Math.max(...ys) + 60;
  if (view && view.w) {
    const vx0 = (-view.x - view.w / 2) / view.scale; const vx1 = (-view.x + view.w / 2) / view.scale;
    const vy0 = (-view.y - view.h / 2) / view.scale; const vy1 = (-view.y + view.h / 2) / view.scale;
    minX = Math.min(minX, vx0); maxX = Math.max(maxX, vx1); minY = Math.min(minY, vy0); maxY = Math.max(maxY, vy1);
  }
  const k = Math.min(W / (maxX - minX), H / (maxY - minY));
  const px = (x: number) => (x - minX) * k;
  const py = (y: number) => (y - minY) * k;
  return (
    <Pressable accessibilityLabel="Minimapa" style={styles.box}
      onPress={(e: any) => { const { locationX, locationY } = e.nativeEvent; onJump(minX + locationX / k, minY + locationY / k); }}>
      {nodes.map(n => <View key={n.id} pointerEvents="none" style={[styles.dot, { left: px(n.x) - 2, top: py(n.y) - 2 }, n.id === selectedId && { backgroundColor: colors.warning }]} />)}
      {view && view.w ? (
        <View pointerEvents="none" style={[styles.view, {
          left: px((-view.x - view.w / 2) / view.scale), top: py((-view.y - view.h / 2) / view.scale),
          width: (view.w / view.scale) * k, height: (view.h / view.scale) * k,
        }]} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', left: 10, bottom: 10, width: W, height: H, backgroundColor: '#0c0c10cc', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  dot: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  view: { position: 'absolute', borderWidth: 1, borderColor: colors.accentText, backgroundColor: '#5b74f522' },
});
