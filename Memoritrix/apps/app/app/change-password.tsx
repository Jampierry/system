import React, { useState } from 'react';
import { AuthCard } from '../src/components/AuthCard';
import { Button, Field } from '../src/components/ui';
import { api, useSession } from '../src/state/session';

export default function ChangePassword() {
  const { setSessionToken, logout } = useSession();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (pw.length < 10) { setError('A nova senha precisa ter ao menos 10 caracteres'); return; }
    setBusy(true); setError('');
    try {
      const r = await api<{ token: string }>('/api/auth/change-password', { method: 'POST', body: { currentPassword: cur, newPassword: pw } });
      await setSessionToken(r.token);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <AuthCard title="Defina uma nova senha" subtitle="Por segurança, troque a senha temporária antes de continuar.">
      <Field label="Senha atual (temporária)" value={cur} onChangeText={setCur} secureTextEntry autoComplete="current-password" />
      <Field label="Nova senha (mín. 10 caracteres)" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" onSubmitEditing={submit} error={error} />
      <Button label="Salvar nova senha" variant="primary" loading={busy} onPress={submit} />
      <Button label="Sair" variant="ghost" onPress={() => void logout()} />
    </AuthCard>
  );
}
