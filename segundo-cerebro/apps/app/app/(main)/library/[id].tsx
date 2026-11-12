import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { parseNote } from '@cerebro/shared';
import { api, useSession } from '../../../src/state/session';
import { emit, useBus } from '../../../src/state/bus';
import { useCreators } from '../../../src/state/creators';
import { useTabs } from '../../../src/state/tabs';
import { Button, Spinner } from '../../../src/components/ui';
import { Icon } from '../../../src/components/Icon';
import { MarkdownEditor } from '../../../src/components/MarkdownEditor';
import { MarkdownPreview } from '../../../src/components/MarkdownPreview';
import { BacklinksPanel } from '../../../src/components/BacklinksPanel';
import { useToast } from '../../../src/components/Toast';
import { colors, radius, space, useBreakpoint } from '../../../src/theme';

type Note = { id: string; title: string; body: string; tags: string[]; isDaily: boolean; updatedAt: string };
type NoteLite = { id: string; title: string; createdAt: string };
type Mode = 'edit' | 'split' | 'read';
const FORBIDDEN = /[\[\]|#^\\/:*?"<>]/;

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { can } = useSession();
  const { setTitle: setTabTitle } = useTabs();
  const { isWide } = useBreakpoint();
  const creators = useCreators();
  const writable = can('notes.write');

  const [note, setNote] = useState<Note | null>(null);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [titles, setTitles] = useState<NoteLite[]>([]);
  const [mode, setMode] = useState<Mode>(isWide ? 'split' : 'edit');
  const [status, setStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [confirmDel, setConfirmDel] = useState(false);
  const [panel, setPanel] = useState(false);
  const saved = useRef({ title: '', body: '' });
  const latest = useRef({ title: '', body: '', id: '' });
  latest.current = { title, body, id: id ?? '' };

  const loadTitles = useCallback(() => { api<{ notes: NoteLite[] }>('/api/notes').then(r => setTitles(r.notes)).catch(() => {}); }, []);
  useEffect(() => { loadTitles(); }, [loadTitles]);
  useBus('notes', loadTitles);

  useEffect(() => {
    setNote(null); setMissing(false);
    api<{ note: Note }>(`/api/notes/${id}`).then(r => {
      setNote(r.note); setTitle(r.note.title); setBody(r.note.body);
      saved.current = { title: r.note.title, body: r.note.body };
      setStatus('saved'); setTabTitle(pathname, r.note.title);
    }).catch(() => setMissing(true));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const titleError = !title.trim() ? 'Informe um título' : FORBIDDEN.test(title) ? 'O título não pode conter [ ] | # ^ \\ / : * ? " < >' : '';

  const save = useCallback(async (silent = true) => {
    const cur = latest.current;
    if (!cur.id || (cur.title === saved.current.title && cur.body === saved.current.body)) return;
    if (!cur.title.trim() || FORBIDDEN.test(cur.title)) { setStatus('error'); return; }
    setStatus('saving');
    try {
      const r = await api<{ note: Note }>(`/api/notes/${cur.id}`, { method: 'PATCH', body: { title: cur.title.trim(), body: cur.body } });
      saved.current = { title: cur.title.trim(), body: cur.body };
      setNote(r.note);
      setStatus(latest.current.title === cur.title && latest.current.body === cur.body ? 'saved' : 'dirty');
      setTabTitle(pathname, r.note.title);
      emit('notes');
      if (!silent) toast.show('Nota salva', 'success');
    } catch (e: any) { setStatus('error'); toast.show(e.message ?? 'Não foi possível salvar', 'error'); }
  }, [pathname, setTabTitle, toast]);

  // autosave com debounce
  useEffect(() => {
    if (!note || !writable) return;
    if (title === saved.current.title && body === saved.current.body) return;
    setStatus('dirty');
    const h = setTimeout(() => { void save(); }, 800);
    return () => clearTimeout(h);
  }, [title, body, note, writable, save]);

  // salva ao sair da tela
  useEffect(() => () => { void save(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const titleMap = useMemo(() => {
    const m = new Map<string, NoteLite>();
    for (const n of titles) { const k = n.title.toLowerCase(); const cur = m.get(k); if (!cur || n.createdAt < cur.createdAt) m.set(k, n); }
    return m;
  }, [titles]);
  const parsed = useMemo(() => parseNote(body), [body]);
  const links = useMemo(() => parsed.links.map(l => ({ target: l.target, noteId: titleMap.get(l.target.toLowerCase())?.id ?? null })), [parsed, titleMap]);

  async function generateMap() {
    try {
      await save();
      const r = await api<{ mindmapId: string }>('/api/assistant/mindmap/generate', { method: 'POST', body: { noteId: id } });
      emit('mindmaps');
      router.push(`/library/mindmaps/${r.mindmapId}` as any);
    } catch (e: any) { toast.show(e.message ?? 'Não foi possível gerar o mapa', 'error'); }
  }

  async function remove() {
    try { await api(`/api/notes/${id}`, { method: 'DELETE' }); emit('notes'); toast.show('Nota excluída', 'success'); router.replace('/library' as any); } catch (e: any) { toast.show(e.message, 'error'); }
  }

  if (missing) return <View style={styles.center}><Text style={{ color: colors.muted }}>Nota não encontrada.</Text><Button label="Voltar às notas" variant="ghost" onPress={() => router.replace('/library' as any)} /></View>;
  if (!note) return <Spinner />;

  const showEdit = mode !== 'read' && writable;
  const showRead = mode !== 'edit' || !writable;
  const statusText = { saved: 'Salvo', saving: 'Salvando…', dirty: 'Editando…', error: 'Não salvo' }[status];
  const side = (
    <BacklinksPanel noteId={note.id} tags={note.tags} headings={parsed.headings} onOpen={nid => router.push(`/library/${nid}` as any)} onTag={t => router.push({ pathname: '/library', params: { tag: t } } as any)} />
  );

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ flex: 1, padding: space.lg, gap: space.md, minWidth: 0 }}>
        <View style={styles.head}>
          <TextInput value={title} onChangeText={setTitle} editable={writable} accessibilityLabel="Título da nota" placeholder="Título" placeholderTextColor={colors.faint} style={[styles.title, titleError ? { borderBottomColor: colors.danger } : null]} />
          <Text accessibilityLiveRegion="polite" style={[styles.status, status === 'error' && { color: colors.danger }]}>{statusText}</Text>
        </View>
        {titleError ? <Text style={{ color: colors.danger, fontSize: 12 }}>{titleError}</Text> : null}
        <View style={styles.bar}>
          {(['edit', 'split', 'read'] as Mode[]).map(m => (
            <Pressable key={m} accessibilityRole="button" accessibilityState={{ selected: mode === m }} onPress={() => setMode(m)} style={[styles.seg, mode === m && styles.segOn]}>
              <Text style={[styles.segText, mode === m && { color: colors.accentText }]}>{{ edit: 'Editar', split: 'Dividido', read: 'Ler' }[m]}</Text>
            </Pressable>
          ))}
          <View style={{ flex: 1 }} />
          {writable && can('assistant.use') ? <Button label="Gerar mapa" small variant="ghost" icon="map" onPress={generateMap} /> : null}
          {!isWide ? <Button label="Painel" small variant="ghost" icon="graph" onPress={() => setPanel(p => !p)} /> : null}
          {writable ? (confirmDel
            ? <Button label="Confirmar exclusão" small variant="danger" icon="trash" onPress={remove} />
            : <Button label="Excluir" small variant="ghost" icon="trash" onPress={() => setConfirmDel(true)} />) : null}
        </View>
        <View style={{ flex: 1, flexDirection: mode === 'split' && isWide ? 'row' : 'column', gap: space.md, minHeight: 0 }}>
          {showEdit ? <View style={{ flex: 1, minHeight: 300 }}><MarkdownEditor value={body} onChange={setBody} titles={titles.map(t => t.title)} readOnly={!writable} /></View> : null}
          {showRead ? (
            <ScrollView style={[{ flex: 1 }, mode === 'split' && styles.readBox]} contentContainerStyle={{ padding: mode === 'split' ? space.lg : 0 }}>
              <MarkdownPreview md={body} links={links} onOpenLink={(t, nid) => { void creators.openByTitle(t, nid); }} onTag={t => router.push({ pathname: '/library', params: { tag: t } } as any)} />
            </ScrollView>
          ) : null}
        </View>
        {!isWide && panel ? <View style={styles.sideInline}>{side}</View> : null}
      </View>
      {isWide ? <ScrollView style={styles.side}>{side}</ScrollView> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, color: colors.text, fontSize: 26, fontWeight: '800', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: 'transparent', outlineStyle: 'none' } as any,
  status: { color: colors.faint, fontSize: 12 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  seg: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  segOn: { backgroundColor: colors.accentBg, borderColor: '#2a3a7a' },
  segText: { color: colors.muted, fontSize: 12.5, fontWeight: '600' },
  readBox: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  side: { width: 280, flexGrow: 0, flexShrink: 0, borderLeftWidth: 1, borderLeftColor: colors.border, backgroundColor: colors.surface },
  sideInline: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
});
