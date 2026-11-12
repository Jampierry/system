import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, useSession } from '../../../src/state/session';
import { Badge, Button, EmptyState, Field, Heading, Spinner } from '../../../src/components/ui';
import { Page } from '../../../src/components/ItemsScreen';
import { AdminNav, NoAccess } from '../../../src/components/AdminNav';
import { SecretModal } from '../../../src/components/SecretModal';
import { useToast } from '../../../src/components/Toast';
import { colors, radius, space } from '../../../src/theme';

type U = { id: string; email: string; name: string; status: 'active' | 'locked' | 'invited'; profile: { id: string; name: string }; mustChangePassword: boolean; lastLoginAt: string | null };
type P = { id: string; name: string };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca acessou');

export default function Users() {
  const { can, user: me } = useSession();
  const toast = useToast();
  const [users, setUsers] = useState<U[] | null>(null);
  const [profiles, setProfiles] = useState<P[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<U | 'new' | null>(null);
  const [secret, setSecret] = useState<{ title: string; label: string; value: string; note: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setUsers((await api<{ users: U[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`)).users); } catch (e: any) { toast.show(e.message, 'error'); setUsers([]); }
  }, [q, toast]);
  useEffect(() => { if (can('users.manage')) { const h = setTimeout(() => { void load(); }, 200); return () => clearTimeout(h); } }, [load, can]);
  useEffect(() => { if (can('users.manage')) api<{ profiles: P[] }>('/api/admin/profiles').then(r => setProfiles(r.profiles)).catch(() => {}); }, [can]);

  if (!can('users.manage')) return <Page><Heading title="Usuários" /><AdminNav /><NoAccess /></Page>;

  async function act(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast.show(ok, 'success'); setConfirm(null); await load(); } catch (e: any) { toast.show(e.message, 'error'); }
  }

  return (
    <Page>
      <Heading title="Usuários" subtitle="Quem tem acesso e com qual perfil." right={<Button label="Novo usuário" icon="plus" variant="primary" onPress={() => setEditing('new')} testID="new-user" />} />
      <AdminNav />
      <Field value={q} onChangeText={setQ} placeholder="Buscar por nome ou e-mail…" accessibilityLabel="Buscar usuários" />
      <View style={{ marginTop: space.md, gap: space.sm }}>
        {users === null ? <Spinner /> : users.length === 0 ? <EmptyState icon="user" title="Nenhum usuário encontrado." /> : users.map(u => {
          const self = u.id === me?.id;
          return (
            <View key={u.id} style={styles.card} accessibilityLabel={`Usuário ${u.name}`}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{u.name.slice(0, 1).toUpperCase()}</Text></View>
              <View style={{ flex: 1, minWidth: 180, gap: 4 }}>
                <Text style={styles.name}>{u.name}{self ? '  (você)' : ''}</Text>
                <Text style={styles.email}>{u.email}</Text>
                <View style={styles.badges}>
                  <Badge text={u.profile.name} tone="accent" />
                  <Badge text={u.status === 'active' ? 'Ativo' : u.status === 'locked' ? 'Bloqueado' : 'Convidado'} tone={u.status === 'active' ? 'success' : 'danger'} />
                  {u.mustChangePassword ? <Badge text="Trocar senha no próximo acesso" tone="warning" /> : null}
                  <Text style={styles.last}>{fmt(u.lastLoginAt)}</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <Button label="Editar" small variant="ghost" icon="edit" onPress={() => setEditing(u)} />
                <Button label="Redefinir senha" small variant="ghost" icon="key" onPress={() => act(async () => {
                  const r = await api<{ code: string }>(`/api/admin/users/${u.id}/force-reset`, { method: 'POST' });
                  setSecret({ title: 'Código de redefinição', label: `Código para ${u.email}`, value: r.code, note: 'Entregue este código ao usuário por um canal seguro. Ele vale por 1 hora e só pode ser usado uma vez, na tela "Já tenho um código".' });
                }, 'Código gerado')} />
                <Button label="Encerrar sessões" small variant="ghost" onPress={() => act(() => api(`/api/admin/users/${u.id}/revoke-sessions`, { method: 'POST' }), 'Sessões encerradas')} />
                {!self ? (
                  <>
                    <Button label={u.status === 'locked' ? 'Desbloquear' : 'Bloquear'} small variant="ghost" onPress={() => act(() => api(`/api/admin/users/${u.id}`, { method: 'PATCH', body: { status: u.status === 'locked' ? 'active' : 'locked' } }), u.status === 'locked' ? 'Usuário desbloqueado' : 'Usuário bloqueado')} />
                    {confirm === u.id
                      ? <Button label="Confirmar exclusão" small variant="danger" icon="trash" onPress={() => act(() => api(`/api/admin/users/${u.id}`, { method: 'DELETE' }), 'Usuário excluído')} />
                      : <Button label="Excluir" small variant="ghost" icon="trash" onPress={() => setConfirm(u.id)} />}
                  </>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      <UserForm key={typeof editing === 'object' && editing ? editing.id : String(editing)} target={editing} profiles={profiles} onClose={() => setEditing(null)}
        onSaved={async (temp) => { setEditing(null); await load(); if (temp) setSecret({ title: 'Usuário criado', label: `Senha temporária de ${temp.email}`, value: temp.password, note: 'Mostrada uma única vez. No primeiro acesso a pessoa será obrigada a escolher uma senha nova.' }); }} />
      <SecretModal visible={!!secret} title={secret?.title ?? ''} label={secret?.label ?? ''} secret={secret?.value ?? ''} note={secret?.note ?? ''} onClose={() => setSecret(null)} />
    </Page>
  );
}

function UserForm({ target, profiles, onClose, onSaved }: { target: U | 'new' | null; profiles: P[]; onClose: () => void; onSaved: (temp?: { email: string; password: string }) => void }) {
  const toast = useToast();
  const isNew = target === 'new';
  const u = typeof target === 'object' && target ? target : null;
  const [name, setName] = useState(u?.name ?? '');
  const [email, setEmail] = useState('');
  const [profileId, setProfileId] = useState(u?.profile.id ?? '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!profileId && profiles.length) setProfileId((profiles.find(p => p.name === 'Membro') ?? profiles[0]).id); }, [profiles, profileId]);

  async function submit() {
    if (!name.trim()) { setErr('Informe o nome'); return; }
    if (isNew && !/^\S+@\S+\.\S+$/.test(email.trim())) { setErr('Informe um e-mail válido'); return; }
    if (!profileId) { setErr('Escolha um perfil'); return; }
    setBusy(true); setErr('');
    try {
      if (isNew) {
        const r = await api<{ temporaryPassword: string; user: U }>('/api/admin/users', { method: 'POST', body: { name: name.trim(), email: email.trim(), profileId } });
        onSaved({ email: r.user.email, password: r.temporaryPassword });
      } else {
        await api(`/api/admin/users/${u!.id}`, { method: 'PATCH', body: { name: name.trim(), profileId } });
        toast.show('Usuário atualizado', 'success');
        onSaved();
      }
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>{isNew ? 'Novo usuário' : 'Editar usuário'}</Text>
          <Field label="Nome" value={name} onChangeText={setName} autoFocus />
          {isNew ? <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /> : <Text style={styles.email}>{u?.email}</Text>}
          <Text style={styles.label}>Perfil</Text>
          <View style={styles.chips}>
            {profiles.map(p => (
              <Pressable key={p.id} accessibilityRole="button" accessibilityState={{ selected: profileId === p.id }} onPress={() => setProfileId(p.id)} style={[styles.chip, profileId === p.id && styles.chipOn]}>
                <Text style={[styles.chipText, profileId === p.id && { color: colors.accentText }]}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
          {err ? <Text style={{ color: colors.danger, fontSize: 12.5 }}>{err}</Text> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Button label="Cancelar" variant="ghost" onPress={onClose} />
            <Button label={isNew ? 'Criar usuário' : 'Salvar'} variant="primary" loading={busy} onPress={submit} testID="save-user" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap', backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentBg, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.accentText, fontWeight: '800', fontSize: 16 },
  name: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  email: { color: colors.muted, fontSize: 12.5 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  last: { color: colors.faint, fontSize: 11.5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', flex: 1, minWidth: 220 },
  backdrop: { flex: 1, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  sheet: { width: '100%', maxWidth: 460, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: space.xl, gap: space.md },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accentBg, borderColor: '#2a3a7a' },
  chipText: { color: colors.muted, fontSize: 12.5 },
});
