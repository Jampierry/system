import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { api, useSession } from '../state/session';
import { useBus } from '../state/bus';
import { colors, radius, space } from '../theme';
import { EmptyState } from './ui';

const TABS = [
  { href: '/admin/users', label: 'Usuários', perm: 'users.manage' },
  { href: '/admin/profiles', label: 'Perfis', perm: 'profiles.manage' },
  { href: '/admin/recovery', label: 'Recuperação de senha', perm: 'recovery.manage' },
  { href: '/admin/audit', label: 'Auditoria', perm: 'audit.view' },
] as const;

export function AdminNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { can } = useSession();
  const [pending, setPending] = useState(0);
  const [tick, setTick] = useState(0);
  useBus('recovery', () => setTick(t => t + 1));
  useEffect(() => {
    if (!can('recovery.manage')) return;
    api<{ requests: unknown[] }>('/api/admin/recovery?status=pending').then(r => setPending(r.requests.length)).catch(() => {});
  }, [can, pathname, tick]);
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {TABS.filter(t => can(t.perm)).map(t => {
        const on = pathname.startsWith(t.href);
        return (
          <Pressable key={t.href} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => router.push(t.href as any)} style={[styles.tab, on && styles.tabOn]}>
            <Text style={[styles.text, on && { color: colors.accentText }]}>{t.label}</Text>
            {t.href === '/admin/recovery' && pending > 0 ? <Text style={styles.badge}>{pending}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function NoAccess() {
  return <EmptyState icon="shield" title="Sem permissão para esta área." hint="Peça a um administrador para ajustar o seu perfil." />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space.lg },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  tabOn: { backgroundColor: colors.accentBg, borderColor: '#2a3a7a' },
  text: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  badge: { backgroundColor: colors.warning, color: '#1a1200', fontSize: 11, fontWeight: '800', borderRadius: 9, paddingHorizontal: 6, overflow: 'hidden' },
});
