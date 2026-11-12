import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { colors, radius } from '../theme';

type Ctx = { scale: number };
const PanZoomCtx = createContext<Ctx>({ scale: 1 });
export const usePanZoom = () => useContext(PanZoomCtx);

export type PanZoomHandle = { fit: (w: number, h: number) => void; reset: () => void };

/**
 * Superfície com pan (arrastar o fundo) e zoom (roda do mouse / botões). A origem (0,0) dos filhos fica no centro.
 * Filhos devem ser posicionados com `position: 'absolute'` em coordenadas relativas ao centro.
 */
export const PanZoomView = React.forwardRef<PanZoomHandle, {
  children: React.ReactNode; style?: ViewStyle; minScale?: number; maxScale?: number; showControls?: boolean; background?: string;
  onBackgroundPress?: () => void;
}>(function PanZoomView({ children, style, minScale = 0.2, maxScale = 3, showControls = true, background, onBackgroundPress }, ref) {
  const [t, setT] = useState({ x: 0, y: 0, scale: 1 });
  const tRef = useRef(t);
  tRef.current = t;
  const start = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const clampScale = useCallback((s: number) => Math.max(minScale, Math.min(maxScale, s)), [minScale, maxScale]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { start.current = { x: tRef.current.x, y: tRef.current.y }; moved.current = false; },
    onPanResponderMove: (_, g) => {
      if (Math.abs(g.dx) + Math.abs(g.dy) > 3) moved.current = true;
      setT(c => ({ ...c, x: start.current.x + g.dx, y: start.current.y + g.dy }));
    },
    onPanResponderRelease: () => { if (!moved.current) onBackgroundPress?.(); },
  }), [onBackgroundPress]);

  const zoomBy = useCallback((f: number) => setT(c => ({ ...c, scale: clampScale(c.scale * f) })), [clampScale]);

  React.useImperativeHandle(ref, () => ({
    reset: () => setT({ x: 0, y: 0, scale: 1 }),
    fit: (w: number, h: number) => setT(() => {
      if (!size.w || !size.h || !w || !h) return { x: 0, y: 0, scale: 1 };
      return { x: 0, y: 0, scale: clampScale(Math.min(size.w / (w + 80), size.h / (h + 80), 1.5)) };
    }),
  }), [size, clampScale]);

  const containerRef = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = containerRef.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomBy(Math.exp(-e.deltaY * 0.0015)); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <PanZoomCtx.Provider value={{ scale: t.scale }}>
      <View ref={containerRef} onLayout={onLayout} style={[styles.container, background ? { backgroundColor: background } : null, style]} {...pan.panHandlers}>
        <View pointerEvents="box-none" style={{ position: 'absolute', left: size.w / 2, top: size.h / 2, width: 0, height: 0, transform: [{ translateX: t.x }, { translateY: t.y }, { scale: t.scale }] }}>
          {children}
        </View>
        {showControls ? (
          <View style={styles.controls}>
            <Pressable accessibilityLabel="Aumentar zoom" onPress={() => zoomBy(1.25)} style={styles.ctl}><Text style={styles.ctlText}>+</Text></Pressable>
            <Pressable accessibilityLabel="Diminuir zoom" onPress={() => zoomBy(0.8)} style={styles.ctl}><Text style={styles.ctlText}>−</Text></Pressable>
            <Pressable accessibilityLabel="Centralizar" onPress={() => setT({ x: 0, y: 0, scale: 1 })} style={styles.ctl}><Text style={[styles.ctlText, { fontSize: 11 }]}>1:1</Text></Pressable>
          </View>
        ) : null}
      </View>
    </PanZoomCtx.Provider>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  controls: { position: 'absolute', right: 10, bottom: 10, gap: 6 },
  ctl: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  ctlText: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
