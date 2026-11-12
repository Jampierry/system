import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, useSession } from '../../../src/state/session';
import { emit } from '../../../src/state/bus';
import { Badge, Button, EmptyState, Heading, Spinner } from '../../../src/components/ui';
import { Page } from '../../../src/components/ItemsScreen';
import { AdminNav, NoAccess } from '../../../src/components/AdminNav';
import { SecretModal } from '../../../src/components/SecretModal';
import { useToast } from '../../../src/components/Toast';
import { colors, radius, space } from '../../../src/theme';

type R = { id: string; status: 'pending' | 'approved' | 'used' | 'expired' | 'denied'; email: string; name: string; requestedAt: string; resolvedAt: string | null; expiresAt: string | null };
const STATUS: Record<R['status'], [string, 'warning' | 'accent' | 'success' | 'muted' | 'danger']> = {
  pending: ['Pendente', 'warning'], approved: ['Aprovada — aguardando uso', 'accent'], used: ['Usada', 'success'], expired: ['Expirada', 'muted'], denied: ['Negada', 'danger'],
};
const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export default function Recovery() {
  const { can } = useSession();
  const toast = useToast();
  const [rows, setRows] = useState<R[] | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [secret, setSecret] = useState<{ email: string; code: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRows((await api<{ requests: R[] }>(`/api/admin/recovery${filter === 'pending' ? '?status=pending' : ''}`)).requests); } catch (e: any) { toast.show(e.message, 'error'); setRows([]); }
  }, [filter, toast]);
  useEffect(() => { if (can('recovery.manage')) void load(); }, [load, can]);

  if (!can('recovery.manage')) return <Page><Heading title="Recuperação de senha" /><AdminNav /><NoAccess /></Page>;

  async function approve(r: R) {
    setBusy(r.id);
    try {
      const res = await api<{ code: string }>(`/api/admin/recovery/${r.id}/approve`, { method: 'POST' });
      setSecret({ email: r.email, code: res.code }); emit('recovery'); await load();
    } catch (e: any) { toast.show(e.message, 'error'); } finally { setBusy(null); }
  }
  async function deny(r: R) {
    setBusy(r.id);
    try { await api(`/api/admin/recovery/${r.id}/deny`, { method: 'POST' }); toast.show('Pedido negado', 'success'); emit('recovery'); await load(); } catch (e: any) { toast.show(e.message, 'error'); } finally { setBusy(null); }
  }

  return (
    <Page>
      <Heading title="Recuperação de senha" subtitle="Analise os pedidos de “esqueci a senha” e entregue o código ao usuário." right={<Button label="Atualizar" icon="sync" variant="ghost" onPress={load} />} />
      <AdminNav />
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: space.md }}>
        {(['pending', 'all'] as const).map(f => (
          <Pressable key={f} accessibilityRole="button" accessibilityState={{ selected: filter === f }} onPress={() => setFilter(f)} style={[styles.chip, filter === f && styles.chipOn]}>
            <Text style={[styles.chipText, filter === f && { color: colors.accentText }]}>{f === 'pending' ? 'Pendentes' : 'Todas'}</Text>
          </Pressable>
        ))}
      </View>
      {rows === null ? <Spinner /> : rows.length === 0 ? <EmptyState icon="key" title={filter === 'pending' ? 'Nenhum pedido pendente.' : 'Nenhum pedido registrado.'} hint="Quando alguém usar “Esqueci minha senha”, o pedido aparece aqui." /> : rows.map(r => (
        <View key={r.id} style={styles.card} accessibilityLabel={`Pedido de ${r.email}`}>
          <View style={{ flex: 1, minWidth: 200, gap: 4 }}>
            <Text style={styles.name}>{r.name}</Text>
            <Text style={styles.email}>{r.email}</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge text={STATUS[r.status][0]} tone={STATUS[r.status][1]} />
              <Text style={styles.when}>Pedido em {fmt(r.requestedAt)}</Text>
              {r.status === 'approved' && r.expiresAt ? <Text style={styles.when}>Código vale até {fmt(r.expiresAt)}</Text> : null}
            </View>
          </View>
          {r.status === 'pending' ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label="Aprovar" icon="check" variant="primary" small loading={busy === r.id} onPress={() => approve(r)} />
              <Button label="Negar" variant="danger" small disabled={busy === r.id} onPress={() => deny(r)} />
            </View>
          ) : null}
        </View>
      ))}
      <SecretModal visible={!!secret} title="Código de recuperação" label={`Código para ${secret?.email}`} secret={secret?.code ?? ''}
        note="Entregue este código ao usuário por um canal seguro (ele também é enviado por e-mail quando o servidor tem SMTP configurado). Vale por 1 hora, só pode ser usado uma vez e não será mostrado de novo."
        onClose={() => setSecret(null)} />
    </Page>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accentBg, borderColor: '#2a3a7a' },
  chipText: { color: colors.muted, fontSize: 12.5, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap', backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, marginBottom: space.sm },
  name: { color: colors.text, fontSize: 14.5, fontWeight: '700' },
  email: { color: colors.muted, fontSize: 12.5 },
  when: { color: colors.faint, fontSize: 11.5 },
});
