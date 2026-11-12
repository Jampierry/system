import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/state/session';
import { useBus } from '../../src/state/bus';
import { Badge, Button, EmptyState, Field, Heading, Spinner } from '../../src/components/ui';
import { Page } from '../../src/components/ItemsScreen';
import { ItemRow } from '../../src/components/ItemRow';
import { ProcessSheet } from '../../src/components/ProcessSheet';
import { useToast } from '../../src/components/Toast';
import { useItemActions } from '../../src/state/itemActions';
import { colors, radius, space } from '../../src/theme';
import type { Item } from '../../src/lib/types';

type Review = { inbox: Item[]; waiting: Item[]; someday: Item[]; projectsWithoutNext: Item[] };
const STEPS = ['Caixa de entrada', 'Aguardando', 'Projetos', 'Algum dia', 'Concluir'];

function ProjectNext({ project }: { project: Item }) {
  const act = useItemActions();
  const [text, setText] = useState('');
  async function add() {
    if (text.trim() && (await act.create({ title: text.trim(), status: 'next', projectId: project.id }))) setText('');
  }
  return (
    <View style={styles.proj}>
      <Text style={styles.projName}>{project.title}</Text>
      {act.canWrite ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field value={text} onChangeText={setText} placeholder="Qual é o próximo passo?" onSubmitEditing={add} /></View>
          <Button label="Definir" variant="secondary" small onPress={add} disabled={!text.trim()} />
        </View>
      ) : null}
    </View>
  );
}

export default function Weekly() {
  const toast = useToast();
  const act = useItemActions();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Review | null>(null);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => { try { setData(await api<Review>('/api/review/weekly')); } catch { setData({ inbox: [], waiting: [], someday: [], projectsWithoutNext: [] }); } }, []);
  useEffect(() => { void load(); }, [load]);
  useBus('items', () => { void load(); });

  async function finish() {
    try { await api('/api/review/complete', { method: 'POST' }); setDone(true); toast.show('Revisão semanal concluída', 'success'); } catch (e: any) { toast.show(e.message, 'error'); }
  }

  const counts = data ? [data.inbox.length, data.waiting.length, data.projectsWithoutNext.length, data.someday.length, 0] : [];
  const rows = (list: Item[], empty: string, quick?: (i: Item) => { label: string; patch: Record<string, unknown> }[]) =>
    list.length === 0 ? <EmptyState icon="check" title={empty} /> : list.map(i => <ItemRow key={i.id} item={i} quick={quick?.(i)} />);

  return (
    <Page>
      <Heading title="Revisão semanal" subtitle="Cinco passos para manter o sistema confiável." />
      <View style={styles.steps}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.step, i === step && styles.stepOn]}>
            <Text style={[styles.stepText, i === step && { color: colors.accentText }]}>{i + 1}. {s}</Text>
            {counts[i] ? <Badge text={String(counts[i])} tone="warning" /> : null}
          </View>
        ))}
      </View>
      {data === null ? <Spinner /> : (
        <View style={{ marginTop: space.lg }}>
          {step === 0 ? (
            <>
              <Text style={styles.help}>Esvazie a caixa de entrada: decida o destino de cada item.</Text>
              {data.inbox.length ? <Button label="Processar com IA" icon="sparkle" variant="secondary" onPress={() => setProcessing(true)} style={{ alignSelf: 'flex-start', marginBottom: 8 }} /> : null}
              {rows(data.inbox, 'Caixa de entrada vazia', () => [{ label: 'Próxima ação', patch: { status: 'next' } }, { label: 'Algum dia', patch: { status: 'someday' } }])}
            </>
          ) : step === 1 ? (
            <>
              <Text style={styles.help}>Cobre o que está parado e traga de volta o que já respondeu.</Text>
              {rows(data.waiting, 'Nada aguardando', () => [{ label: 'Voltou: próxima ação', patch: { status: 'next', waitingOn: null } }])}
            </>
          ) : step === 2 ? (
            <>
              <Text style={styles.help}>Todo projeto precisa de uma próxima ação.</Text>
              {data.projectsWithoutNext.length === 0 ? <EmptyState icon="check" title="Todos os projetos têm próxima ação" /> : data.projectsWithoutNext.map(p => <ProjectNext key={p.id} project={p} />)}
            </>
          ) : step === 3 ? (
            <>
              <Text style={styles.help}>Alguma dessas ideias merece sair da gaveta?</Text>
              {rows(data.someday, 'Nada guardado para algum dia', () => [{ label: 'Ativar', patch: { status: 'next' } }])}
            </>
          ) : (
            <View style={{ alignItems: 'center', gap: 12, paddingVertical: space.xl }}>
              <Text style={styles.help}>{done ? 'Revisão registrada no Logbook. Bom trabalho!' : 'Tudo revisado? Registre a revisão no Logbook.'}</Text>
              <Button label={done ? 'Revisão concluída' : 'Concluir revisão'} icon="check" variant="primary" disabled={done || !act.canWrite} onPress={finish} />
            </View>
          )}
        </View>
      )}
      <View style={styles.nav}>
        <Button label="Voltar" variant="ghost" disabled={step === 0} onPress={() => setStep(s => s - 1)} />
        <Button label="Avançar" variant="secondary" disabled={step === STEPS.length - 1} onPress={() => setStep(s => s + 1)} />
      </View>
      <ProcessSheet visible={processing} onClose={() => setProcessing(false)} />
    </Page>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  stepOn: { backgroundColor: colors.accentBg, borderColor: '#2a3a7a' },
  stepText: { color: colors.muted, fontSize: 12.5, fontWeight: '600' },
  help: { color: colors.muted, fontSize: 13, marginBottom: space.md, textAlign: 'left' },
  proj: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, marginBottom: space.md, gap: 8 },
  projName: { color: colors.text, fontWeight: '700', fontSize: 14 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xl },
});
