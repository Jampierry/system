import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Permission } from '@cerebro/shared';
import { api, useSession } from '../../../src/state/session';
import { Badge, Button, Card, EmptyState, Field, Heading, Spinner } from '../../../src/components/ui';
import { Page } from '../../../src/components/ItemsScreen';
import { AdminNav, NoAccess } from '../../../src/components/AdminNav';
import { PermissionMatrix } from '../../../src/components/PermissionMatrix';
import { useToast } from '../../../src/components/Toast';
import { validateProfile } from '../../../src/lib/permissionMatrix';
import { colors, radius, space, useBreakpoint } from '../../../src/theme';

type Profile = { id: string; name: string; description: string; permissions: Permission[]; isSystem: boolean; users: number };

export default function Profiles() {
  const { can, user: me } = useSession();
  const toast = useToast();
  const { isMedium } = useBreakpoint();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [selected, setSelected] = useState<string | 'new' | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [perms, setPerms] = useState<Permission[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => {
    try { setProfiles((await api<{ profiles: Profile[] }>('/api/admin/profiles')).profiles); } catch (e: any) { toast.show(e.message, 'error'); setProfiles([]); }
  }, [toast]);
  useEffect(() => { if (can('profiles.manage')) void load(); }, [load, can]);

  const current = profiles?.find(p => p.id === selected) ?? null;
  useEffect(() => {
    setErr(''); setConfirm(false);
    if (selected === 'new') { setName(''); setDesc(''); setPerms(['notes.write', 'items.write', 'assistant.use']); }
    else if (current) { setName(current.name); setDesc(current.description); setPerms(current.permissions); }
  }, [selected, current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!can('profiles.manage')) return <Page><Heading title="Perfis" /><AdminNav /><NoAccess /></Page>;

  const isAdminProfile = !!current?.isSystem && current.name === 'Administrador';
  const missingGrant = perms.some(p => ['users.manage', 'profiles.manage', 'recovery.manage', 'audit.view'].includes(p) && !me?.permissions.includes(p));

  async function save() {
    const problem = validateProfile({ name, isSystem: current?.isSystem, permissions: perms });
    if (problem) { setErr(problem); return; }
    setBusy(true); setErr('');
    try {
      if (selected === 'new') {
        const r = await api<{ profile: Profile }>('/api/admin/profiles', { method: 'POST', body: { name: name.trim(), description: desc, permissions: perms } });
        await load(); setSelected(r.profile.id);
      } else {
        await api(`/api/admin/profiles/${selected}`, { method: 'PATCH', body: { ...(current?.isSystem ? {} : { name: name.trim() }), description: desc, permissions: perms } });
        await load();
      }
      toast.show('Perfil salvo', 'success');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function remove() {
    try { await api(`/api/admin/profiles/${selected}`, { method: 'DELETE' }); toast.show('Perfil excluído', 'success'); setSelected(null); await load(); } catch (e: any) { toast.show(e.message, 'error'); setConfirm(false); }
  }

  return (
    <Page>
      <Heading title="Perfis" subtitle="Defina o que cada tipo de usuário pode fazer." right={<Button label="Novo perfil" icon="plus" variant="primary" onPress={() => setSelected('new')} testID="new-profile" />} />
      <AdminNav />
      {profiles === null ? <Spinner /> : (
        <View style={{ flexDirection: isMedium ? 'row' : 'column', gap: space.lg, alignItems: 'flex-start' }}>
          <View style={{ width: isMedium ? 260 : '100%', gap: 6 }}>
            {profiles.map(p => (
              <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Perfil ${p.name}`} accessibilityState={{ selected: selected === p.id }} onPress={() => setSelected(p.id)} style={[styles.item, selected === p.id && styles.itemOn]}>
                <Text style={styles.itemName}>{p.name}</Text>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  {p.isSystem ? <Badge text="Sistema" /> : null}
                  <Text style={styles.count}>{p.users} {p.users === 1 ? 'usuário' : 'usuários'}</Text>
                </View>
              </Pressable>
            ))}
          </View>
          <View style={{ flex: 1, width: '100%', minWidth: 0 }}>
            {!selected ? <EmptyState icon="shield" title="Selecione um perfil" hint="Ou crie um novo para um tipo de acesso específico." /> : (
              <Card style={{ gap: space.lg }}>
                <Field label="Nome" value={name} onChangeText={setName} editable={!current?.isSystem} />
                <Field label="Descrição" value={desc} onChangeText={setDesc} editable={!isAdminProfile} />
                {isAdminProfile ? <Text style={styles.note}>O perfil Administrador sempre tem todas as permissões e não pode ser alterado.</Text> : null}
                <PermissionMatrix value={perms} onChange={setPerms} readOnly={isAdminProfile} />
                {missingGrant ? <Text style={styles.warn}>Você só pode conceder permissões administrativas que você mesmo possui.</Text> : null}
                {err ? <Text style={{ color: colors.danger, fontSize: 12.5 }}>{err}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {selected !== 'new' && !current?.isSystem ? (
                    confirm ? <Button label="Confirmar exclusão" variant="danger" icon="trash" onPress={remove} />
                      : <Button label="Excluir perfil" variant="ghost" icon="trash" disabled={(current?.users ?? 0) > 0} onPress={() => setConfirm(true)} />
                  ) : null}
                  {current && current.users > 0 && !current.isSystem ? <Text style={styles.note}>Há usuários neste perfil; mude-os de perfil antes de excluir.</Text> : null}
                  <View style={{ flex: 1 }} />
                  <Button label="Salvar perfil" variant="primary" loading={busy} disabled={isAdminProfile} onPress={save} testID="save-profile" />
                </View>
              </Card>
            )}
          </View>
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  item: { backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: 6 },
  itemOn: { borderColor: '#2a3a7a', backgroundColor: '#141b3a' },
  itemName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  count: { color: colors.faint, fontSize: 11.5 },
  note: { color: colors.muted, fontSize: 12.5, flexShrink: 1 },
  warn: { color: colors.warning, fontSize: 12.5 },
});
