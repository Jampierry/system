import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { MindNode } from '@cerebro/shared';
import { nodeSize } from '../../lib/mindExport';
import { colors } from '../../theme';
import { Icon } from '../Icon';
import { usePanZoom } from '../PanZoomView';

type Props = {
  node: MindNode; isRoot: boolean; selected: boolean; editing: boolean; childCount: number; readOnly?: boolean;
  onSelect: () => void; onDrag: (x: number, y: number) => void; onDragEnd: () => void;
  onStartEdit: () => void; onCommit: (text: string, then?: 'child' | 'sibling') => void; onCancel: () => void;
  onToggle: () => void; onOpenLink: () => void;
};

export function NodeView(props: Props) {
  const { node, isRoot, selected, editing, childCount, readOnly } = props;
  const { scale } = usePanZoom();
  const { w, h } = nodeSize(node.text);
  const latest = useRef({ ...props, scale, w, h });
  latest.current = { ...props, scale, w, h };
  const start = useRef({ x: 0, y: 0, moved: false, last: 0 });

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      const L = latest.current;
      start.current.x = L.node.x; start.current.y = L.node.y; start.current.moved = false;
      L.onSelect();
    },
    onPanResponderMove: (_, g) => {
      const L = latest.current;
      if (L.readOnly || L.editing) return;
      if (!start.current.moved && Math.abs(g.dx) + Math.abs(g.dy) < 4) return;
      start.current.moved = true;
      L.onDrag(start.current.x + g.dx / L.scale, start.current.y + g.dy / L.scale);
    },
    onPanResponderRelease: () => {
      const L = latest.current;
      if (start.current.moved) { L.onDragEnd(); return; }
      const now = Date.now();
      if (!L.readOnly && now - start.current.last < 350) L.onStartEdit(); // duplo toque/clique edita
      start.current.last = now;
    },
  }), []);

  const border = node.color ?? colors.accent;
  return (
    <View
      {...(editing ? {} : pan.panHandlers)}
      accessibilityRole="button"
      accessibilityLabel={`Nó ${node.text}${selected ? ', selecionado' : ''}`}
      accessibilityState={{ selected }}
      style={[styles.node, { left: node.x - w / 2, top: node.y - h / 2, width: w, height: h, borderColor: border, backgroundColor: isRoot ? colors.accentBg : colors.panel },
        isRoot && { borderWidth: 2 }, selected && styles.selected]}
    >
      {node.noteId ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir nota vinculada" hitSlop={6} onPress={props.onOpenLink} style={{ marginRight: 6 }}><Icon name="note" size={13} color={colors.accentText} /></Pressable>
      ) : null}
      {editing ? <NodeEditor text={node.text} onCommit={props.onCommit} onCancel={props.onCancel} />
        : <Text numberOfLines={1} style={[styles.text, isRoot && { fontWeight: '800' }]}>{node.text}</Text>}
      {node.collapsed && childCount > 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Expandir ${childCount} nós`} onPress={props.onToggle} hitSlop={6} style={styles.count}><Text style={styles.countText}>+{childCount}</Text></Pressable>
      ) : null}
    </View>
  );
}

function NodeEditor({ text, onCommit, onCancel }: { text: string; onCommit: (t: string, then?: 'child' | 'sibling') => void; onCancel: () => void }) {
  const [v, setV] = useState(text);
  const done = useRef(false);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  // seleciona todo o texto ao abrir a edição (selectTextOnFocus do RN-web não é confiável)
  useEffect(() => {
    const el: any = input.current;
    const t = setTimeout(() => { el?.focus?.(); if (typeof el?.select === 'function') el.select(); else el?.setSelection?.(0, text.length); }, 0);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const finish = (then?: 'child' | 'sibling') => { if (done.current) return; done.current = true; onCommit(v, then); };
  useEffect(() => () => { done.current = true; }, []);
  return (
    <TextInput
      ref={input} autoFocus selectTextOnFocus value={v} onChangeText={setV} accessibilityLabel="Texto do nó"
      onSubmitEditing={() => finish()}
      onBlur={() => finish()}
      onKeyPress={(e: any) => {
        const k = e.nativeEvent.key;
        if (k === 'Escape') { done.current = true; onCancel(); }
        else if (k === 'Tab') { e.preventDefault?.(); finish('child'); }
      }}
      style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  node: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, cursor: 'grab' } as any,
  selected: { shadowColor: colors.accent, shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, boxShadow: '0 0 0 3px #5b74f544' } as any,
  text: { color: colors.text, fontSize: 13, fontWeight: '500', flexShrink: 1 },
  input: { color: colors.text, fontSize: 13, flex: 1, textAlign: 'center', padding: 0, outlineStyle: 'none' } as any,
  count: { position: 'absolute', right: -10, top: -9, backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  countText: { color: colors.white, fontSize: 10.5, fontWeight: '800' },
});
