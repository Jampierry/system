import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, useSession } from '../../../src/state/session';
import { Badge, Button, EmptyState, Heading, Spinner } from '../../../src/components/ui';
import { Page } from '../../../src/components/ItemsScreen';
import { AdminNav, NoAccess } from '../../../src/components/AdminNav';
import { useToast } from '../../../src/components/Toast';
import { colors, space } from '../../../src/theme';

type E = { id: number; actorEmail: string | null; action: string; target: string | null; meta: any; at: string };
const LABEL: Record<string, [string, 'muted' | 'success' | 'danger' | 'warning' | 'accent']> = {
  'login.ok': ['Login', 'success'], 'login.fail': ['Falha de login', 'danger'], 'login.blocked': ['Login bloqueado', 'danger'],
  'setup.admin': ['Primeiro acesso', 'accent'], 'password.change': ['Senha alterada', 'accent'],
  'user.create': ['Usuário criado', 'accent'], 'user.update': ['Usuário alterado', 'accent'], 'user.delete': ['Usuário excluído', 'warning'], 'user.revoke-sessions': ['Sessões encerradas', 'warning'],
  'profile.create': ['Perfil criado', 'accent'], 'profile.update': ['Perfil alterado', 'accent'], 'profile.delete': ['Perfil excluído', 'warning'],
  'recovery.request': ['Recuperação solicitada', 'warning'], 'recovery.approve': ['Recuperação aprovada', 'accent'], 'recovery.deny': ['Recuperação negada', 'muted'],
  'recovery.force': ['Redefinição forçada', 'warning'], 'recovery.reset': ['Senha redefinida', 'success'], 'recovery.reset-fail': ['Código inválido', 'danger'], 'recovery.mail-fail': ['Falha no e-mail', 'danger'],
};

export default function Audit() {
  const { can } = useSession();
  const toast = useToast();
  const [rows, setRows] = useState<E[] | null>(null);
  const [next, setNext] = useState<number | null>(null);

  const load = useCallback(async (before?: number) => {
    try {
      const r = await api<{ entries: E[]; next: number | null }>(`/api/admin/audit?limit=50${before ? `&before=${before}` : ''}`);
      setRows(prev => (before ? [...(prev ?? []), ...r.entries] : r.entries));
      setNext(r.next);
    } catch (e: any) { toast.show(e.message, 'error'); setRows(prev => prev ?? []); }
  }, [toast]);
  useEffect(() => { if (can('audit.view')) void load(); }, [load, can]);

  if (!can('audit.view')) return <Page><Heading title="Auditoria" /><AdminNav /><NoAccess /></Page>;

  return (
    <Page>
      <Heading title="Auditoria" subtitle="Acessos e ações administrativas, do mais recente ao mais antigo." right={<Button label="Atualizar" icon="sync" variant="ghost" onPress={() => load()} />} />
      <AdminNav />
      {rows === null ? <Spinner /> : rows.length === 0 ? <EmptyState icon="logbook" title="Nada registrado ainda." /> : (
        <View>
          {rows.map(e => {
            const [label, tone] = LABEL[e.action] ?? [e.action, 'muted' as const];
            return (
              <View key={e.id} style={styles.row}>
                <Text style={styles.time}>{new Date(e.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}</Text>
                <Badge text={label} tone={tone} />
                <Text style={styles.text} numberOfLines={2}>
                  {e.actorEmail ?? 'anônimo/sistema'}{e.target ? ` → ${e.target}` : ''}{e.meta ? `  ${JSON.stringify(e.meta)}` : ''}
                </Text>
              </View>
            );
          })}
          {next ? <Button label="Carregar mais" variant="ghost" onPress={() => load(next)} style={{ alignSelf: 'center', marginTop: space.lg }} /> : null}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  time: { color: colors.faint, fontSize: 11.5, width: 128, fontVariant: ['tabular-nums'] },
  text: { color: colors.text, fontSize: 12.5, flex: 1, minWidth: 200 },
});
