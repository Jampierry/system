import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../theme';
import { Icon } from './Icon';
import { Badge, Button, Field } from './ui';
import { useItemActions } from '../state/itemActions';
import { KIND_LABEL, STATUS_LABEL, type Item } from '../lib/types';
import { RECURRENCES, dueAtFor, formatDue, parseDateInput, recurrenceLabel, toDateInput } from '../lib/dates';

export type Quick = { label: string; patch: Record<string, unknown> };

export function ItemRow({ item, quick, extra }: { item: Item; quick?: Quick[]; extra?: React.ReactNode }) {
  const act = useItemActions();
  const [open, setOpen] = useState(false);
  const due = formatDue(item.startAt ?? item.dueAt, new Date());
  const done = item.status === 'done';
  const tone = ({ overdue: 'danger', today: 'warning', soon: 'accent', later: 'muted', none: 'muted' } as const)[due.tone];
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={`Concluir ${item.title}`}
        disabled={!act.canWrite} onPress={() => void act.complete(item)} hitSlop={8} style={[styles.check, done && styles.checkOn]}>
        {done ? <Icon name="check" size={12} color={colors.white} strokeWidth={3} /> : null}
      </Pressable>
      <Pressable style={{ flex: 1, gap: 6 }} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Abrir ${item.title}`}>
        <Text style={[styles.title, done && { textDecorationLine: 'line-through', color: colors.faint }]}>{item.title}</Text>
        <View style={styles.meta}>
          {item.kind !== 'task' ? <Badge text={KIND_LABEL[item.kind] ?? item.kind} /> : null}
          {due.text ? <Badge text={due.text} tone={tone} /> : null}
          {item.recurrence ? <Badge text={recurrenceLabel(item.recurrence)} tone="accent" /> : null}
          {item.waitingOn ? <Badge text={`Com ${item.waitingOn}`} tone="warning" /> : null}
        </View>
        {extra}
      </Pressable>
      {quick && act.canWrite ? (
        <View style={styles.quick}>
          {quick.map(q => <Button key={q.label} label={q.label} small variant="ghost" onPress={() => void act.update(item.id, q.patch)} />)}
        </View>
      ) : null}
      <ItemDetail item={item} visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

const STATUS_CHIPS = ['inbox', 'next', 'waiting', 'someday', 'done'] as const;

export function ItemDetail({ item, visible, onClose }: { item: Item; visible: boolean; onClose: () => void }) {
  const act = useItemActions();
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const [date, setDate] = useState(toDateInput(item.startAt ?? item.dueAt));
  const [rec, setRec] = useState<string | null>(item.recurrence);
  const [status, setStatus] = useState(item.status);
  const [kind, setKind] = useState(item.kind);
  const [waitingOn, setWaitingOn] = useState(item.waitingOn ?? '');
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const parsed = parseDateInput(date);
    if (parsed === undefined) { setError('Use a data no formato AAAA-MM-DD'); return; }
    if (!title.trim()) { setError('Informe um título'); return; }
    const isEvent = item.kind === 'event';
    const r = await act.update(item.id, {
      title: title.trim(), body, status, kind, recurrence: rec, waitingOn: status === 'waiting' ? waitingOn.trim() || null : null,
      ...(isEvent ? { startAt: parsed } : { dueAt: parsed }),
    }, 'Item atualizado');
    if (r) onClose();
  }

  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && { color: colors.accentText }]}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView contentContainerStyle={{ gap: space.md }} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>Detalhes do item</Text>
            <Field label="Título" value={title} onChangeText={setTitle} />
            <Field label="Notas" value={body} onChangeText={setBody} multiline />
            <Text style={styles.label}>Status</Text>
            <View style={styles.chips}>{STATUS_CHIPS.map(s => chip(STATUS_LABEL[s], status === s, () => setStatus(s)))}</View>
            {status === 'waiting' ? <Field label="Aguardando resposta de" value={waitingOn} onChangeText={setWaitingOn} placeholder="Nome ou empresa" /> : null}
            <Text style={styles.label}>Tipo</Text>
            <View style={styles.chips}>{(['task', 'project', 'checklist', 'idea'] as const).map(k => chip(KIND_LABEL[k], kind === k, () => setKind(k)))}</View>
            <Field label="Data (AAAA-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-11-20" autoCapitalize="none" />
            <View style={styles.chips}>
              {chip('Hoje', false, () => setDate(toDateInput(dueAtFor(new Date(), 0))))}
              {chip('Amanhã', false, () => setDate(toDateInput(dueAtFor(new Date(), 1))))}
              {chip('Em 7 dias', false, () => setDate(toDateInput(dueAtFor(new Date(), 7))))}
              {chip('Sem data', false, () => setDate(''))}
            </View>
            <Text style={styles.label}>Repetição</Text>
            <View style={styles.chips}>
              {chip('Nenhuma', rec === null, () => setRec(null))}
              {RECURRENCES.map(r => chip(recurrenceLabel(r), rec === r, () => setRec(r)))}
            </View>
            {rec && !date ? <Text style={styles.warn}>Defina uma data para a repetição funcionar.</Text> : null}
            {error ? <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
            <View style={styles.actions}>
              {act.canWrite ? (
                confirmDel
                  ? <Button label="Confirmar exclusão" variant="danger" icon="trash" onPress={async () => { if (await act.remove(item.id)) onClose(); }} />
                  : <Button label="Excluir" variant="ghost" icon="trash" onPress={() => setConfirmDel(true)} />
              ) : null}
              <View style={{ flex: 1 }} />
              <Button label="Fechar" variant="ghost" onPress={onClose} />
              <Button label="Salvar" variant="primary" disabled={!act.canWrite} onPress={save} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  check: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkOn: { backgroundColor: colors.success, borderColor: colors.success },
  title: { color: colors.text, fontSize: 14.5 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', maxWidth: 360 },
  backdrop: { flex: 1, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '92%', backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: space.xl },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accentBg, borderColor: '#2a3a7a' },
  chipText: { color: colors.muted, fontSize: 12 },
  warn: { color: colors.warning, fontSize: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space.sm },
});
