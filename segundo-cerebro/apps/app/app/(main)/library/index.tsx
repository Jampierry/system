import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, apiBlob, useSession } from '../../../src/state/session';
import { useBus, emit } from '../../../src/state/bus';
import { useArea } from '../../../src/state/area';
import { useCreators } from '../../../src/state/creators';
import { Badge, Button, EmptyState, Field, Heading, Spinner } from '../../../src/components/ui';
import { Page } from '../../../src/components/ItemsScreen';
import { useToast } from '../../../src/components/Toast';
import { downloadBlob, filesSupported, pickFiles, readAsBase64, readAsText } from '../../../src/lib/files';
import { colors, radius, space } from '../../../src/theme';

type Note = { id: string; title: string; tags: string[]; updatedAt: string; isDaily: boolean };
type Hit = { id: string; title: string; snippet: string };

function Highlight({ text }: { text: string }) {
  const parts = text.split(/(«[^»]*»)/g);
  return <Text style={styles.snip} numberOfLines={2}>{parts.map((p, i) => (p.startsWith('«') ? <Text key={i} style={styles.mark}>{p.slice(1, -1)}</Text> : p))}</Text>;
}

export default function Library() {
  const router = useRouter();
  const toast = useToast();
  const { can } = useSession();
  const { areaId } = useArea();
  const creators = useCreators();
  const params = useLocalSearchParams<{ tag?: string }>();
  const [tag, setTag] = useState<string | null>(params.tag ?? null);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);

  useEffect(() => { setTag(params.tag ?? null); }, [params.tag]);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (areaId) qs.set('area', areaId);
    try { setNotes((await api<{ notes: Note[] }>(`/api/notes?${qs}`)).notes); } catch { setNotes([]); }
  }, [areaId]);
  useEffect(() => { void load(); }, [load]);
  useBus('notes', () => { void load(); });

  useEffect(() => {
    if (q.trim().length < 2) { setHits(null); return; }
    const h = setTimeout(() => { api<{ notes: Hit[] }>(`/api/search?q=${encodeURIComponent(q.trim())}`).then(r => setHits(r.notes)).catch(() => setHits([])); }, 200);
    return () => clearTimeout(h);
  }, [q]);

  const allTags = [...new Set((notes ?? []).flatMap(n => n.tags))].sort();
  const list = (notes ?? []).filter(n => !tag || n.tags.includes(tag));

  async function doImport() {
    const files = await pickFiles('.md,.zip', true);
    if (!files.length) return;
    try {
      const md = files.filter(f => /\.md$/i.test(f.name));
      const zip = files.find(f => /\.zip$/i.test(f.name));
      const r = await api<{ imported: number; skipped: number }>('/api/import', {
        method: 'POST',
        body: { files: await Promise.all(md.map(async f => ({ name: f.name, content: await readAsText(f) }))), zipBase64: zip ? await readAsBase64(zip) : undefined },
      });
      emit('notes');
      toast.show(`${r.imported} notas importadas${r.skipped ? `, ${r.skipped} ignoradas` : ''}`, 'success');
    } catch (e: any) { toast.show(e.message, 'error'); }
  }

  async function doExport() {
    try { downloadBlob(await apiBlob('/api/export'), 'segundo-cerebro.zip'); toast.show('Exportação iniciada', 'success'); } catch (e: any) { toast.show(e.message, 'error'); }
  }

  return (
    <Page>
      <Heading title="Notas" subtitle="Escreva em Markdown e ligue ideias com [[links]]."
        right={<>
          {can('notes.write') ? <Button label="Nova nota" icon="plus" variant="primary" onPress={() => void creators.newNote()} testID="new-note" /> : null}
          {can('notes.write') ? <Button label="Nota diária" icon="calendar" variant="secondary" onPress={() => void creators.openDaily()} /> : null}
          {filesSupported && can('notes.write') ? <Button label="Importar" icon="upload" variant="ghost" onPress={doImport} /> : null}
          {filesSupported && can('export.data') ? <Button label="Exportar" icon="download" variant="ghost" onPress={doExport} /> : null}
        </>} />
      <Field value={q} onChangeText={setQ} placeholder="Buscar no texto das notas…" accessibilityLabel="Buscar notas" />
      {allTags.length ? (
        <View style={styles.tags}>
          <Pressable onPress={() => setTag(null)} accessibilityRole="button"><Text style={[styles.tag, !tag && styles.tagOn]}>Todas</Text></Pressable>
          {allTags.map(t => <Pressable key={t} onPress={() => setTag(tag === t ? null : t)} accessibilityRole="button" accessibilityState={{ selected: tag === t }}><Text style={[styles.tag, tag === t && styles.tagOn]}>#{t}</Text></Pressable>)}
        </View>
      ) : null}
      <View style={{ marginTop: space.md }}>
        {hits ? (
          hits.length === 0 ? <EmptyState icon="search" title="Nada encontrado." hint="Tente outros termos." /> : hits.map(h => (
            <Pressable key={h.id} accessibilityRole="link" onPress={() => router.push(`/library/${h.id}` as any)} style={styles.row}>
              <Text style={styles.title}>{h.title}</Text><Highlight text={h.snippet} />
            </Pressable>))
        ) : notes === null ? <Spinner /> : list.length === 0 ? (
          <EmptyState icon="note" title="Nenhuma nota ainda." hint="Crie a primeira nota ou importe seu vault do Obsidian." />
        ) : list.map(n => (
          <Pressable key={n.id} accessibilityRole="link" accessibilityLabel={`Abrir ${n.title}`} onPress={() => router.push(`/library/${n.id}` as any)} style={({ hovered }: any) => [styles.row, hovered && { backgroundColor: '#15151b' }]}>
            <Text style={styles.title}>{n.title}</Text>
            <View style={styles.meta}>
              {n.isDaily ? <Badge text="Diária" tone="accent" /> : null}
              {n.tags.slice(0, 4).map(t => <Badge key={t} text={`#${t}`} />)}
              <Text style={styles.date}>{new Date(n.updatedAt).toLocaleDateString('pt-BR')}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.md },
  tag: { color: colors.muted, fontSize: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  tagOn: { color: colors.accentText, backgroundColor: colors.accentBg, borderColor: '#2a3a7a' },
  row: { paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 6 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  date: { color: colors.faint, fontSize: 11.5 },
  snip: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
  mark: { color: colors.warning, fontWeight: '700' },
});
