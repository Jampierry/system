import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { toOutlineMarkdown, visibleNodes, type MindMap } from '@cerebro/shared';
import { api, useSession } from '../../../../src/state/session';
import { emit } from '../../../../src/state/bus';
import { useTabs } from '../../../../src/state/tabs';
import { useMindMapEditor, type MindEditor } from '../../../../src/state/useMindMapEditor';
import { Badge, Button, Spinner } from '../../../../src/components/ui';
import { Icon } from '../../../../src/components/Icon';
import { useToast } from '../../../../src/components/Toast';
import { MindMapCanvas, mapBounds } from '../../../../src/components/mindmap/MindMapCanvas';
import { Toolbar, type ToolbarAction } from '../../../../src/components/mindmap/Toolbar';
import type { PanZoomHandle } from '../../../../src/components/PanZoomView';
import { layoutRadial } from '@cerebro/shared';
import { mapToSvg } from '../../../../src/lib/mindExport';
import { downloadBlob, filesSupported } from '../../../../src/lib/files';
import { colors, radius, space } from '../../../../src/theme';

type Loaded = { id: string; title: string; graph: MindMap };

export default function MindMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<Loaded | null>(null);
  const [missing, setMissing] = useState(false);
  const router = useRouter();
  useEffect(() => {
    setData(null); setMissing(false);
    api<{ mindmap: Loaded }>(`/api/mindmaps/${id}`).then(r => setData(r.mindmap)).catch(() => setMissing(true));
  }, [id]);
  if (missing) return <View style={styles.center}><Text style={{ color: colors.muted }}>Mapa não encontrado.</Text><Button label="Voltar aos mapas" variant="ghost" onPress={() => router.replace('/library/mindmaps' as any)} /></View>;
  if (!data) return <Spinner />;
  return <Editor key={data.id} data={data} />;
}

function Editor({ data }: { data: Loaded }) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { can } = useSession();
  const { setTitle: setTabTitle } = useTabs();
  const writable = can('notes.write');
  const editor = useMindMapEditor(data.graph);
  const [title, setTitle] = useState(data.title);
  const [status, setStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [busy, setBusy] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const canvas = useRef<PanZoomHandle>(null);
  const savedTitle = useRef(data.title);
  const latest = useRef({ editor, title });
  latest.current = { editor, title };

  const save = useCallback(async (): Promise<boolean> => {
    const { editor: ed, title: t } = latest.current;
    if (!ed.core.dirty && t === savedTitle.current) return true;
    setStatus('saving');
    const sent = ed.core.map;
    try {
      await api(`/api/mindmaps/${data.id}`, { method: 'PUT', body: { title: t.trim() || 'Mapa sem título', graph: sent } });
      if (ed.core.map === sent) ed.markSaved();
      savedTitle.current = t;
      setTabTitle(pathname, t.trim() || 'Mapa');
      emit('mindmaps');
      // lê o estado vivo do núcleo (o objeto do hook é um retrato da última renderização)
      setStatus(latest.current.editor.core.dirty || latest.current.title !== t ? 'dirty' : 'saved');
      return true;
    } catch (e: any) { setStatus('error'); toast.show(e.message ?? 'Não foi possível salvar', 'error'); return false; }
  }, [data.id, pathname, setTabTitle, toast]);

  // salvamento automático: 800 ms depois da última alteração
  const dirtyNow = editor.dirty || title !== savedTitle.current;
  useEffect(() => {
    if (!writable || !dirtyNow) return;
    setStatus('dirty');
    const h = setTimeout(() => { void save(); }, 800);
    return () => clearTimeout(h);
  }, [editor.map, editor.dirty, title, writable, dirtyNow, save]);
  useEffect(() => () => { void save(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setTabTitle(pathname, data.title); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = editor.selectedId ? editor.map.nodes[editor.selectedId] : null;
  const fit = () => { const b = mapBounds(visibleNodes(latest.current.editor.map)); canvas.current?.fit(b.w, b.h, b.cx, b.cy); };
  useEffect(() => { const h = setTimeout(fit, 150); return () => clearTimeout(h); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function reloadFromServer() {
    const r = await api<{ mindmap: Loaded }>(`/api/mindmaps/${data.id}`);
    editor.replace(r.mindmap.graph);
    editor.markSaved();
    setTimeout(fit, 100);
  }

  async function expandAi() {
    if (!sel) { toast.show('Selecione um nó para expandir', 'info'); return; }
    setBusy('ai');
    try {
      if (!(await save())) return;
      const r = await api<{ added: number; mode: string }>('/api/assistant/mindmap/expand', { method: 'POST', body: { mindmapId: data.id, nodeId: sel.id } });
      await reloadFromServer();
      toast.show(`${r.added} novos nós (${r.mode === 'claude' ? 'Claude' : 'modo demo'})`, 'success');
    } catch (e: any) { toast.show(e.message, 'error'); } finally { setBusy(null); }
  }

  async function convert(as: 'notes' | 'tasks') {
    if (!sel) { toast.show('Selecione o nó do ramo a converter', 'info'); return; }
    setBusy(as);
    try {
      if (!(await save())) return;
      const r = await api<{ created: number }>(`/api/mindmaps/${data.id}/to-notes`, { method: 'POST', body: { nodeId: sel.id, as } });
      emit(as === 'notes' ? 'notes' : 'items');
      toast.show(as === 'notes' ? `${r.created} notas criadas na biblioteca` : `${r.created} itens criados (projeto + tarefas na caixa de entrada)`, 'success');
    } catch (e: any) { toast.show(e.message, 'error'); } finally { setBusy(null); }
  }

  async function exportAs(kind: 'md' | 'svg' | 'png') {
    const name = (title.trim() || 'mapa-mental').replace(/[\\/:*?"<>|]/g, '-');
    try {
      if (kind === 'md') {
        const md = toOutlineMarkdown(editor.map);
        if (filesSupported) downloadBlob(new Blob([md], { type: 'text/markdown' }), `${name}.md`);
        try { await (globalThis as any).navigator?.clipboard?.writeText(md); } catch { /* sem área de transferência */ }
        toast.show(filesSupported ? 'Outline exportado e copiado' : 'Outline copiado', 'success');
      } else if (kind === 'svg') {
        downloadBlob(new Blob([mapToSvg(editor.map)], { type: 'image/svg+xml' }), `${name}.svg`);
      } else {
        const svg = mapToSvg(editor.map);
        const img = new Image();
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('Falha ao gerar a imagem')); img.src = url; });
        const c = document.createElement('canvas');
        c.width = img.width * 2; c.height = img.height * 2;
        const ctx = c.getContext('2d')!;
        ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const blob: Blob = await new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Falha ao gerar a imagem'))), 'image/png'));
        downloadBlob(blob, `${name}.png`);
      }
    } catch (e: any) { toast.show(e.message, 'error'); }
  }

  const A = (key: string, label: string, icon: any, onPress: () => void, extra: Partial<ToolbarAction> = {}): ToolbarAction => ({ key, label, icon, onPress, ...extra });
  const hasSel = !!sel;
  const groups: ToolbarAction[][] = [
    writable ? [
      A('child', 'Filho', 'plus', editor.addChild, { disabled: !hasSel }),
      A('sibling', 'Irmão', 'right', editor.addSibling, { disabled: !hasSel }),
      A('edit', 'Editar', 'edit', () => editor.startEdit(), { disabled: !hasSel }),
      A('remove', 'Remover', 'trash', () => { if (!editor.remove()) toast.show('A raiz não pode ser removida', 'info'); }, { disabled: !hasSel }),
    ] : [],
    [
      A('undo', 'Desfazer', 'left', editor.undo, { disabled: !editor.canUndo || !writable }),
      A('redo', 'Refazer', 'right', editor.redo, { disabled: !editor.canRedo || !writable }),
    ],
    [
      A('collapse', sel?.collapsed ? 'Expandir' : 'Recolher', 'down', () => editor.toggleCollapse(), { disabled: !hasSel }),
      A('layout', 'Organizar', 'graph', () => { editor.apply(m => layoutRadial(m)); setTimeout(fit, 100); }, { disabled: !writable }),
      A('fit', 'Ajustar', 'target', fit),
    ],
    writable ? [
      A('link', sel?.noteId ? 'Trocar nota' : 'Vincular nota', 'note', () => setPicker(true), { disabled: !hasSel }),
      ...(sel?.noteId ? [A('open', 'Abrir nota', 'book', () => router.push(`/library/${sel.noteId}` as any))] : []),
    ] : [],
    can('assistant.use') && writable ? [A('ai', 'Expandir com IA', 'sparkle', expandAi, { accent: true, busy: busy === 'ai', disabled: !hasSel })] : [],
    writable ? [
      A('tonotes', 'Ramo → notas', 'note', () => convert('notes'), { busy: busy === 'notes', disabled: !hasSel }),
      A('totasks', 'Ramo → tarefas', 'checklist', () => convert('tasks'), { busy: busy === 'tasks', disabled: !hasSel || !can('items.write') }),
    ] : [],
    [
      A('md', 'Outline', 'download', () => exportAs('md')),
      ...(filesSupported ? [A('svg', 'SVG', 'download', () => exportAs('svg')), A('png', 'PNG', 'download', () => exportAs('png'))] : []),
    ],
  ].filter(g => g.length);

  const statusText = { saved: 'Salvo', saving: 'Salvando…', dirty: 'Editando…', error: 'Não salvo' }[status];

  return (
    <View style={{ flex: 1, padding: space.lg, gap: space.sm }}>
      <View style={styles.head}>
        <Pressable accessibilityRole="link" accessibilityLabel="Voltar aos mapas" onPress={() => router.push('/library/mindmaps' as any)} hitSlop={8}><Icon name="left" size={18} color={colors.muted} /></Pressable>
        <TextInput value={title} onChangeText={setTitle} editable={writable} accessibilityLabel="Título do mapa" placeholder="Título do mapa" placeholderTextColor={colors.faint} style={styles.title} />
        <Badge text={`${Object.keys(editor.map.nodes).length} nós`} />
        <Text accessibilityLiveRegion="polite" style={[styles.status, status === 'error' && { color: colors.danger }]}>{statusText}</Text>
      </View>
      <Toolbar groups={groups} colorDisabled={!hasSel || !writable} onColor={c => editor.setColor(c)} />
      <View style={{ flex: 1 }}>
        <MindMapCanvas ref={canvas} editor={editor} readOnly={!writable} onOpenNote={nid => router.push(`/library/${nid}` as any)} />
      </View>
      <Text style={styles.hint}>Tab: novo filho · Enter: irmão · Duplo clique/F2: editar · Delete: remover · Espaço: recolher · Setas: navegar · Ctrl+Z: desfazer · Role para dar zoom</Text>
      <NotePicker visible={picker} onClose={() => setPicker(false)} onPick={(nid) => { editor.setLink({ noteId: nid }); setPicker(false); }} />
    </View>
  );
}

function NotePicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (id: string) => void }) {
  const [notes, setNotes] = useState<{ id: string; title: string }[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => { if (visible) api<{ notes: { id: string; title: string }[] }>('/api/notes').then(r => setNotes(r.notes)).catch(() => setNotes([])); }, [visible]);
  const list = notes.filter(n => n.title.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>Vincular a uma nota</Text>
          <TextInput autoFocus value={q} onChangeText={setQ} placeholder="Buscar nota…" placeholderTextColor={colors.faint} accessibilityLabel="Buscar nota para vincular" style={styles.search} />
          <ScrollView style={{ maxHeight: 320 }}>
            {list.length === 0 ? <Text style={{ color: colors.faint, padding: 12 }}>Nenhuma nota encontrada.</Text> : list.map(n => (
              <Pressable key={n.id} accessibilityRole="button" onPress={() => onPick(n.id)} style={({ hovered }: any) => [styles.pick, hovered && { backgroundColor: colors.selected }]}>
                <Icon name="note" size={14} color={colors.muted} /><Text style={{ color: colors.text, fontSize: 13.5 }}>{n.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '800', paddingVertical: 2, outlineStyle: 'none' } as any,
  status: { color: colors.faint, fontSize: 12 },
  hint: { color: colors.faint, fontSize: 11.5 },
  backdrop: { flex: 1, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  sheet: { width: '100%', maxWidth: 460, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: space.xl, gap: space.md },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  search: { color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.sm },
});
