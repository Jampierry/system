import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { children, visibleNodes } from '@cerebro/shared';
import { PanZoomView, type PanZoomHandle, type Transform } from '../PanZoomView';
import { NodeView } from './NodeView';
import { Minimap } from './Minimap';
import { nodeSize } from '../../lib/mindExport';
import type { MindEditor } from '../../state/useMindMapEditor';

const EXTENT = 6000;

export const MindMapCanvas = React.forwardRef<PanZoomHandle, { editor: MindEditor; readOnly?: boolean; onOpenNote: (noteId: string) => void }>(
  function MindMapCanvas({ editor, readOnly, onOpenNote }, ref) {
    const { map, selectedId, editingId } = editor;
    const nodes = useMemo(() => visibleNodes(map), [map]);
    const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
    const inner = useRef<PanZoomHandle>(null);
    React.useImperativeHandle(ref, () => ({ fit: (w, h, cx, cy) => inner.current?.fit(w, h, cx, cy), reset: () => inner.current?.reset(), centerOn: (x, y) => inner.current?.centerOn(x, y) }));
    const [view, setView] = useState<Transform | null>(null);
    const editorRef = useRef(editor);
    editorRef.current = editor;

    // atalhos de teclado (web); ignora quando o foco está num campo de texto
    useEffect(() => {
      if (Platform.OS !== 'web' || readOnly) return;
      const onKey = (e: KeyboardEvent) => {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        const r = editorRef.current.handleKey(e.key, { ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey, alt: e.altKey });
        if (r !== 'ignored') e.preventDefault();
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [readOnly]);

    return (
      <View style={{ flex: 1 }}>
        <PanZoomView ref={inner} onBackgroundPress={() => editor.select(null)} onTransform={setView}>
          <Svg width={EXTENT} height={EXTENT} style={{ position: 'absolute', left: -EXTENT / 2, top: -EXTENT / 2 }} pointerEvents="none">
            {nodes.map(n => {
              const p = n.parentId ? byId.get(n.parentId) : undefined;
              if (!p) return null;
              const mx = (p.x + n.x) / 2;
              const o = EXTENT / 2;
              return <Path key={n.id} d={`M ${p.x + o} ${p.y + o} C ${mx + o} ${p.y + o}, ${mx + o} ${n.y + o}, ${n.x + o} ${n.y + o}`} stroke={n.color ?? '#4a4a5e'} strokeWidth={1.8} fill="none" opacity={0.85} />;
            })}
          </Svg>
          {nodes.map(n => (
            <NodeView key={n.id} node={n} isRoot={n.id === map.rootId} selected={n.id === selectedId} editing={n.id === editingId} readOnly={readOnly}
              childCount={children(map, n.id).length}
              onSelect={() => editor.select(n.id)}
              onDrag={(x, y) => editor.drag(n.id, x, y)}
              onDragEnd={editor.commitDrag}
              onStartEdit={() => editor.startEdit(n.id)}
              onCommit={(text, then) => { editor.commitEdit(text); if (then === 'child') editor.addChild(); else if (then === 'sibling') editor.addSibling(); }}
              onCancel={editor.cancelEdit}
              onToggle={() => editor.toggleCollapse(n.id)}
              onOpenLink={() => n.noteId && onOpenNote(n.noteId)}
            />
          ))}
        </PanZoomView>
        <Minimap nodes={nodes} selectedId={selectedId} view={view} onJump={(x, y) => inner.current?.centerOn(x, y)} />
      </View>
    );
  },
);

/** Caixa que envolve todos os nós visíveis e o seu centro (para "ajustar à tela"). */
export function mapBounds(nodes: { x: number; y: number; text: string }[]) {
  if (!nodes.length) return { w: 0, h: 0, cx: 0, cy: 0 };
  const b = nodes.map(n => ({ ...nodeSize(n.text), x: n.x, y: n.y }));
  const minX = Math.min(...b.map(n => n.x - n.w / 2)); const maxX = Math.max(...b.map(n => n.x + n.w / 2));
  const minY = Math.min(...b.map(n => n.y - n.h / 2)); const maxY = Math.max(...b.map(n => n.y + n.h / 2));
  return { w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}
