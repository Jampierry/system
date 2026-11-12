import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { fromOutlineMarkdown } from '@cerebro/shared';
import { api, useSession } from '../../../../src/state/session';
import { emit, useBus } from '../../../../src/state/bus';
import { useCreators } from '../../../../src/state/creators';
import { Badge, Button, EmptyState, Field, Heading, Spinner } from '../../../../src/components/ui';
import { Icon } from '../../../../src/components/Icon';
import { Page } from '../../../../src/components/ItemsScreen';
import { useToast } from '../../../../src/components/Toast';
import { filesSupported, pickFiles, readAsText } from '../../../../src/lib/files';
import { colors, radius, space } from '../../../../src/theme';

type Row = { id: string; title: string; updatedAt: string };

export default function MindMaps() {
  const router = useRouter();
  const toast = useToast();
  const { can } = useSession();
  const creators = useCreators();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [gen, setGen] = useState(false);
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'demo' | 'claude' | null>(null);

  const load = useCallback(async () => {
    try { setRows((await api<{ mindmaps: Row[] }>('/api/mindmaps')).mindmaps); } catch { setRows([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useBus('mindmaps', () => { void load(); });
  useEffect(() => { api<{ mode: 'demo' | 'claude' }>('/api/assistant/mode').then(r => setMode(r.mode)).catch(() => {}); }, []);

  async function generate() {
    if (!topic.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ mindmapId: string }>('/api/assistant/mindmap/generate', { method: 'POST', body: { topic: topic.trim() } });
      emit('mindmaps'); setGen(false); setTopic('');
      router.push(`/library/mindmaps/${r.mindmapId}` as any);
    } catch (e: any) { toast.show(e.message, 'error'); } finally { setBusy(false); }
  }

  async function importOutline() {
    const [f] = await pickFiles('.md,.txt', false);
    if (!f) return;
    try {
      const title = f.name.replace(/\.[^.]+$/, '');
      const graph = fromOutlineMarkdown(await readAsText(f), title);
      const r = await api<{ mindmap: { id: string } }>('/api/mindmaps', { method: 'POST', body: { title: graph.nodes[graph.rootId].text || title, graph } });
      emit('mindmaps'); router.push(`/library/mindmaps/${r.mindmap.id}` as any);
    } catch (e: any) { toast.show(e.message, 'error'); }
  }

  return (
    <Page>
      <Heading title="Mapas mentais" subtitle="Arraste, conecte e expanda ideias. A IA ajuda a abrir ramos."
        right={can('notes.write') ? (
          <>
            <Button label="Novo mapa" icon="plus" variant="primary" onPress={() => void creators.newMindmap()} testID="new-mindmap" />
            {can('assistant.use') ? <Button label="Gerar com IA" icon="sparkle" variant="secondary" onPress={() => setGen(true)} testID="gen-mindmap" /> : null}
            {filesSupported ? <Button label="Importar outline" icon="upload" variant="ghost" onPress={importOutline} /> : null}
          </>
        ) : undefined} />
      {rows === null ? <Spinner /> : rows.length === 0 ? <EmptyState icon="map" title="Nenhum mapa mental ainda." hint="Crie um mapa em branco ou peça para a IA gerar a partir de um tema." /> : (
        <View style={styles.grid}>
          {rows.map(m => (
            <Pressable key={m.id} accessibilityRole="link" accessibilityLabel={`Abrir ${m.title}`} onPress={() => router.push(`/library/mindmaps/${m.id}` as any)} style={({ hovered }: any) => [styles.card, hovered && { borderColor: colors.accent }]}>
              <Icon name="map" size={22} color={colors.accentText} />
              <Text style={styles.name} numberOfLines={2}>{m.title}</Text>
              <Text style={styles.date}>{new Date(m.updatedAt).toLocaleDateString('pt-BR')}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Modal visible={gen} transparent animationType="fade" onRequestClose={() => setGen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setGen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="sparkle" size={18} color={colors.accentText} />
              <Text style={styles.sheetTitle}>Gerar mapa mental</Text>
              {mode ? <Badge text={mode === 'claude' ? 'Claude' : 'Modo demo'} tone={mode === 'claude' ? 'accent' : 'muted'} /> : null}
            </View>
            <Field autoFocus label="Tema" value={topic} onChangeText={setTopic} placeholder="Ex.: Planejar uma viagem ao Japão" onSubmitEditing={generate} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <Button label="Cancelar" variant="ghost" onPress={() => setGen(false)} />
              <Button label="Gerar" variant="primary" icon="sparkle" loading={busy} disabled={!topic.trim()} onPress={generate} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Page>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  card: { width: 210, minHeight: 110, backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: 8 },
  name: { color: colors.text, fontSize: 14.5, fontWeight: '700', flex: 1 },
  date: { color: colors.faint, fontSize: 11.5 },
  backdrop: { flex: 1, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  sheet: { width: '100%', maxWidth: 460, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: space.xl, gap: space.md },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800', flex: 1 },
});
