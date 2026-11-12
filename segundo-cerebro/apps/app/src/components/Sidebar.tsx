import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { api, useSession } from '../state/session';
import { useArea } from '../state/area';
import { useBus } from '../state/bus';
import { colors, radius, space } from '../theme';
import { Icon, type IconName } from './Icon';
import { useCapture } from './CaptureModal';
import { useToast } from './Toast';

type Counts = Record<string, number>;
type NavItem = { href: string; label: string; icon: IconName; count?: string };

const PRODUCTIVITY_A: NavItem[] = [
  { href: '/inbox', label: 'Caixa de entrada', icon: 'inbox', count: 'inbox' },
  { href: '/calendar', label: 'Calendário', icon: 'calendar' },
  { href: '/focus', label: 'Foco', icon: 'target' },
];
const PRODUCTIVITY_B: NavItem[] = [
  { href: '/next', label: 'Próxima ação', icon: 'arrow', count: 'next' },
  { href: '/waiting', label: 'Aguardando resposta', icon: 'clock', count: 'waiting' },
  { href: '/someday', label: 'Algum dia/talvez', icon: 'bulb', count: 'someday' },
  { href: '/projects', label: 'Projetos', icon: 'folder' },
  { href: '/recurring', label: 'Recorrências', icon: 'repeat' },
  { href: '/checklists', label: 'Checklists', icon: 'checklist' },
];
const LIBRARY: NavItem[] = [
  { href: '/library', label: 'Todas as notas', icon: 'note' },
  { href: '/library/mindmaps', label: 'Mapas mentais', icon: 'map' },
  { href: '/library/graph', label: 'Grafo', icon: 'graph' },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, can, logout } = useSession();
  const { openCapture } = useCapture();
  const toast = useToast();
  const [counts, setCounts] = useState<Counts>({});
  const mode = pathname.startsWith('/library') ? 'library' : 'productivity';

  const loadCounts = useCallback(async () => {
    try { setCounts((await api<{ counts: Counts }>('/api/items/counts')).counts); } catch { /* sem contadores */ }
  }, []);
  useEffect(() => { void loadCounts(); }, [loadCounts, pathname]);
  useBus('items', () => { void loadCounts(); });

  const go = (href: string) => { router.push(href as any); onNavigate?.(); };

  async function openDaily() {
    try {
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const { note } = await api<{ note: { id: string } }>('/api/notes/daily', { method: 'POST', body: { date } });
      go(`/library/${note.id}`);
    } catch (e: any) { toast.show(e.message, 'error'); }
  }

  const row = (it: NavItem) => {
    const selected = pathname === it.href || (it.href !== '/library' && pathname.startsWith(it.href + '/'));
    const n = it.count ? counts[it.count] : undefined;
    return (
      <Pressable key={it.href} accessibilityRole="link" accessibilityLabel={it.label} onPress={() => go(it.href)}
        style={({ hovered }: any) => [styles.row, selected && styles.rowSelected, hovered && !selected && styles.rowHover]}>
        <Icon name={it.icon} size={16} color={selected ? colors.accentText : colors.muted} />
        <Text style={[styles.rowText, selected && { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>{it.label}</Text>
        {n ? <Text style={[styles.count, selected && { color: colors.accentText }]}>{n}</Text> : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.sm }} showsVerticalScrollIndicator={false}>
        <Text style={styles.workspace}>Organização</Text>
        <View style={styles.brain}><Icon name="brain" size={18} color={colors.accentText} /><Text style={styles.brainText}>Brain</Text></View>
        <AreaPicker />
        <View style={styles.segment}>
          {(['productivity', 'library'] as const).map(m => (
            <Pressable key={m} accessibilityRole="button" accessibilityLabel={m === 'productivity' ? 'Produtividade' : 'Biblioteca'}
              onPress={() => go(m === 'productivity' ? '/inbox' : '/library')} style={[styles.segBtn, mode === m && styles.segBtnOn]}>
              <Icon name={m === 'productivity' ? 'check' : 'book'} size={14} color={mode === m ? colors.accentText : colors.muted} />
              <Text style={[styles.segText, mode === m && { color: colors.accentText }]}>{m === 'productivity' ? 'Produtividade' : 'Biblioteca'}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Capturar item" onPress={() => { openCapture(); onNavigate?.(); }} style={styles.capture}>
          <Icon name="plus" size={16} color={colors.accentText} />
          <Text style={styles.captureText}>Capturar item</Text>
          <Icon name="wave" size={16} color={colors.accentText} />
        </Pressable>

        {mode === 'productivity' ? (
          <>
            <View style={styles.group}>{PRODUCTIVITY_A.map(row)}</View>
            <View style={styles.group}>{PRODUCTIVITY_B.map(row)}</View>
          </>
        ) : (
          <>
            <View style={styles.group}>
              {LIBRARY.map(row)}
              <Pressable accessibilityRole="button" accessibilityLabel="Nota diária" onPress={openDaily} style={({ hovered }: any) => [styles.row, hovered && styles.rowHover]}>
                <Icon name="calendar" size={16} color={colors.muted} /><Text style={styles.rowText}>Nota diária</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {mode === 'productivity' ? (
          <>
            {row({ href: '/review', label: 'Revisão semanal', icon: 'review' })}
            {row({ href: '/logbook', label: 'Logbook', icon: 'logbook' })}
          </>
        ) : null}
        {row({ href: '/assistant', label: 'Assistente', icon: 'bot' })}
        {(can('users.manage') || can('profiles.manage') || can('recovery.manage') || can('audit.view'))
          ? row({ href: can('users.manage') ? '/admin/users' : can('profiles.manage') ? '/admin/profiles' : can('recovery.manage') ? '/admin/recovery' : '/admin/audit', label: 'Administração', icon: 'shield' })
          : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Sair" onPress={() => void logout()} style={({ hovered }: any) => [styles.row, hovered && styles.rowHover]}>
          <Icon name="logout" size={16} color={colors.muted} />
          <Text style={styles.rowText} numberOfLines={1}>Sair · {user?.name}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AreaPicker() {
  const { areas, areaId, setAreaId, create } = useArea();
  const { can } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const current = areas.find(a => a.id === areaId);
  return (
    <View style={{ zIndex: 5 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Selecionar área" onPress={() => setOpen(o => !o)} style={styles.area}>
        <View style={[styles.dot, { backgroundColor: current?.color ?? colors.accent }]} />
        <Text style={styles.areaText} numberOfLines={1}>{current?.name ?? 'Todas as áreas'}</Text>
        <Icon name="down" size={14} color={colors.muted} />
      </Pressable>
      {open ? (
        <View style={styles.menu}>
          <Pressable onPress={() => { setAreaId(null); setOpen(false); }} style={styles.menuRow}><Text style={styles.rowText}>Todas as áreas</Text></Pressable>
          {areas.map(a => (
            <Pressable key={a.id} onPress={() => { setAreaId(a.id); setOpen(false); }} style={styles.menuRow}>
              <View style={[styles.dot, { backgroundColor: a.color }]} /><Text style={styles.rowText}>{a.name}</Text>
            </Pressable>
          ))}
          {can('items.write') ? (
            <View style={styles.newArea}>
              <TextInput value={name} onChangeText={setName} placeholder="Nova área…" placeholderTextColor={colors.faint} style={styles.newAreaInput}
                onSubmitEditing={() => { if (name.trim()) { void create(name.trim()); setName(''); setOpen(false); } }} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 240, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border, height: '100%' },
  workspace: { color: colors.text, fontSize: 13, fontWeight: '800', paddingHorizontal: 4 },
  brain: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  brainText: { color: colors.text, fontSize: 12.5 },
  area: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8 },
  areaText: { flex: 1, color: colors.text, fontSize: 12.5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  menu: { position: 'absolute', top: 40, left: 0, right: 0, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 4, zIndex: 20 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: radius.sm },
  newArea: { padding: 4 },
  newAreaInput: { color: colors.text, fontSize: 12.5, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 6 },
  segment: { flexDirection: 'row', backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 3, gap: 3 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6, borderRadius: radius.sm },
  segBtnOn: { backgroundColor: colors.accentBg },
  segText: { color: colors.muted, fontSize: 11.5, fontWeight: '600' },
  capture: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 9, marginTop: 6 },
  captureText: { flex: 1, color: colors.accentText, fontSize: 13, fontWeight: '700' },
  group: { gap: 2, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.sm },
  rowSelected: { backgroundColor: colors.selected },
  rowHover: { backgroundColor: '#1a1a22' },
  rowText: { flex: 1, color: colors.muted, fontSize: 13 },
  count: { color: colors.faint, fontSize: 11, fontWeight: '700' },
  footer: { padding: space.md, borderTopWidth: 1, borderTopColor: colors.border, gap: 2 },
});
