import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../state/session';
import { emit } from '../state/bus';
import { colors, radius, space } from '../theme';
import { Badge, Button, Spinner } from './ui';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { STATUS_LABEL } from '../lib/types';
import { formatDue } from '../lib/dates';

type Suggestion = { itemId: string; title: string; status: 'next' | 'waiting' | 'someday'; kind: string; dueAt: string | null; reason: string };
type Row = Suggestion & { on: boolean };
const OPTIONS = ['next', 'waiting', 'someday'] as const;

/** Mostra as sugestões da IA para a caixa de entrada; o usuário ajusta e só então aplica. */
export function ProcessSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [mode, setMode] = useState<'demo' | 'claude'>('demo');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setRows(null);
    api<{ suggestions: Suggestion[]; mode: 'demo' | 'claude' }>('/api/assistant/process-inbox', { method: 'POST' })
      .then(r => { setRows(r.suggestions.map(s => ({ ...s, on: true }))); setMode(r.mode); })
      .catch((e: any) => { toast.show(e.message ?? 'Não foi possível processar', 'error'); onClose(); });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (id: string, patch: Partial<Row>) => setRows(rs => rs?.map(r => (r.itemId === id ? { ...r, ...patch } : r)) ?? null);
  const chosen = rows?.filter(r => r.on) ?? [];

  async function apply() {
    setBusy(true);
    try {
      const r = await api<{ applied: number; skipped: number }>('/api/assistant/process-inbox/apply', {
        method: 'POST',
        body: { changes: chosen.map(c => ({ itemId: c.itemId, status: c.status, kind: c.kind, dueAt: c.dueAt })) },
      });
      emit('items');
      toast.show(`${r.applied} ${r.applied === 1 ? 'item organizado' : 'itens organizados'}`, 'success');
      onClose();
    } catch (e: any) {
      toast.show(e.message ?? 'Não foi possível aplicar', 'error');
    } finally { setBusy(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.head}>
            <Icon name="sparkle" size={18} color={colors.accentText} />
            <Text style={styles.title}>Processar caixa de entrada</Text>
            <Badge text={mode === 'claude' ? 'Claude' : 'Modo demo'} tone={mode === 'claude' ? 'accent' : 'muted'} />
          </View>
          <Text style={styles.sub}>Revise as sugestões. Nada muda até você aplicar.</Text>
          {rows === null ? <Spinner /> : rows.length === 0 ? <Text style={styles.sub}>Sua caixa de entrada está vazia.</Text> : (
            <ScrollView style={{ marginTop: space.md }} contentContainerStyle={{ gap: space.md }}>
              {rows.map(r => (
                <View key={r.itemId} style={[styles.card, !r.on && { opacity: 0.5 }]}>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: r.on }} accessibilityLabel={`Aplicar sugestão para ${r.title}`} onPress={() => set(r.itemId, { on: !r.on })} style={[styles.box, r.on && styles.boxOn]}>
                      {r.on ? <Icon name="check" size={12} color={colors.white} strokeWidth={3} /> : null}
                    </Pressable>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={styles.itemTitle}>{r.title}</Text>
                      <Text style={styles.reason}>{r.reason}</Text>
                      <View style={styles.chips}>
                        {OPTIONS.map(o => (
                          <Pressable key={o} accessibilityRole="button" accessibilityState={{ selected: r.status === o }} onPress={() => set(r.itemId, { status: o })} style={[styles.chip, r.status === o && styles.chipOn]}>
                            <Text style={[styles.chipText, r.status === o && { color: colors.accentText }]}>{STATUS_LABEL[o]}</Text>
                          </Pressable>
                        ))}
                        {r.kind === 'project' ? <Badge text="Projeto" tone="accent" /> : null}
                        {r.dueAt ? <Badge text={formatDue(r.dueAt, new Date()).text} tone="warning" /> : null}
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={styles.actions}>
            <Button label="Cancelar" variant="ghost" onPress={onClose} />
            <Button label={`Aplicar ${chosen.length}`} variant="primary" icon="check" loading={busy} disabled={!chosen.length} onPress={apply} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  sheet: { width: '100%', maxWidth: 620, maxHeight: '90%', backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: space.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', flex: 1 },
  sub: { color: colors.muted, fontSize: 12.5, marginTop: 6 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  itemTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  reason: { color: colors.muted, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accentBg, borderColor: '#2a3a7a' },
  chipText: { color: colors.muted, fontSize: 11.5 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: space.lg },
});
