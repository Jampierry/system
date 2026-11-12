import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, useSession } from '../state/session';
import { useCreators } from '../state/creators';
import { buildCommands, type Command } from '../lib/commands';
import { rank } from '../lib/fuzzy';
import { colors, radius, space } from '../theme';
import { Icon, type IconName } from './Icon';
import { useCapture } from './CaptureModal';

type Ctx = { open: () => void };
const PaletteCtx = createContext<Ctx>({ open: () => {} });
export const usePalette = () => useContext(PaletteCtx);

type Result = { key: string; label: string; hint?: string; icon: IconName; run: () => void };

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useSession();
  const creators = useCreators();
  const { openCapture } = useCapture();
  const [visible, setVisible] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [found, setFound] = useState<{ notes: { id: string; title: string; snippet: string }[]; items: { id: string; title: string; status: string }[] }>({ notes: [], items: [] });
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const open = useCallback(() => { setQ(''); setIdx(0); setVisible(true); }, []);
  const close = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setVisible(v => { if (!v) { setQ(''); setIdx(0); } return !v; }); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!visible || q.trim().length < 2) { setFound({ notes: [], items: [] }); return; }
    const h = setTimeout(() => { api<typeof found>(`/api/search?q=${encodeURIComponent(q.trim())}`).then(setFound).catch(() => setFound({ notes: [], items: [] })); }, 180);
    return () => clearTimeout(h);
  }, [q, visible]);

  const commands = useMemo(() => buildCommands(user?.permissions ?? []), [user]);
  const results: Result[] = useMemo(() => {
    const run = (c: Command) => () => {
      close();
      if (c.href) router.push(c.href as any);
      else if (c.action === 'capture') openCapture();
      else if (c.action === 'new-note') void creators.newNote();
      else if (c.action === 'daily') void creators.openDaily();
      else if (c.action === 'new-mindmap') void creators.newMindmap();
    };
    const cmdRes: Result[] = rank(commands, q, c => c.label).slice(0, 8).map(c => ({ key: c.id, label: c.label, icon: c.action ? 'plus' : 'right', run: run(c) }));
    const noteRes: Result[] = found.notes.slice(0, 6).map(n => ({ key: 'n' + n.id, label: n.title, hint: n.snippet.replace(/[«»]/g, ''), icon: 'note', run: () => { close(); router.push(`/library/${n.id}` as any); } }));
    const itemRes: Result[] = found.items.slice(0, 4).map(i => ({ key: 'i' + i.id, label: i.title, hint: 'Item', icon: 'check', run: () => { close(); router.push('/inbox' as any); } }));
    return [...noteRes, ...cmdRes, ...itemRes];
  }, [commands, q, found, router, creators, openCapture, close]);

  useEffect(() => { setIdx(0); }, [q]);

  function onKey(e: any) {
    const k = e.nativeEvent.key;
    if (k === 'ArrowDown') { e.preventDefault?.(); setIdx(i => Math.min(results.length - 1, i + 1)); }
    else if (k === 'ArrowUp') { e.preventDefault?.(); setIdx(i => Math.max(0, i - 1)); }
    else if (k === 'Enter') { e.preventDefault?.(); results[idx]?.run(); }
    else if (k === 'Escape') close();
  }

  return (
    <PaletteCtx.Provider value={{ open }}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.box} onPress={() => {}}>
            <View style={styles.inputRow}>
              <Icon name="search" size={16} color={colors.muted} />
              <TextInput ref={inputRef} autoFocus value={q} onChangeText={setQ} onKeyPress={onKey} placeholder="Buscar notas, itens e comandos…" placeholderTextColor={colors.faint}
                accessibilityLabel="Paleta de comandos" style={styles.input} />
              <Text style={styles.kbd}>Esc</Text>
            </View>
            <View accessibilityRole="list">
              {results.length === 0 ? <Text style={styles.none}>Nada encontrado.</Text> : results.map((r, i) => (
                <Pressable key={r.key} accessibilityRole="button" onPress={r.run} onHoverIn={() => setIdx(i)} style={[styles.row, i === idx && styles.rowOn]}>
                  <Icon name={r.icon} size={14} color={i === idx ? colors.accentText : colors.muted} />
                  <Text style={styles.label} numberOfLines={1}>{r.label}</Text>
                  {r.hint ? <Text style={styles.hint} numberOfLines={1}>{r.hint}</Text> : null}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </PaletteCtx.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000b', alignItems: 'center', paddingTop: 90, paddingHorizontal: space.lg },
  box: { width: '100%', maxWidth: 600, backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: space.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  input: { flex: 1, color: colors.text, fontSize: 15, outlineStyle: 'none' } as any,
  kbd: { color: colors.faint, fontSize: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.md, paddingVertical: 10 },
  rowOn: { backgroundColor: colors.selected },
  label: { color: colors.text, fontSize: 13.5, flexShrink: 1 },
  hint: { color: colors.faint, fontSize: 12, flex: 1 },
  none: { color: colors.faint, padding: space.lg, textAlign: 'center' },
});
