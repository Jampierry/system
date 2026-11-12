import React, { useState } from 'react';
import { AuthCard } from '../src/components/AuthCard';
import { Button, Field } from '../src/components/ui';
import { api, useSession } from '../src/state/session';

export default function Setup() {
  const { login } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || !email.trim()) { setError('Preencha nome e e-mail'); return; }
    if (pw.length < 10) { setError('A senha precisa ter ao menos 10 caracteres'); return; }
    setBusy(true); setError('');
    try {
      await api('/api/auth/setup', { method: 'POST', body: { name: name.trim(), email: email.trim(), password: pw } });
      await login(email.trim(), pw);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <AuthCard title="Primeiro acesso" subtitle="Crie a conta de administrador para começar.">
      <Field label="Nome" value={name} onChangeText={setName} placeholder="Seu nome" />
      <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Senha (mín. 10 caracteres)" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" onSubmitEditing={submit} error={error} />
      <Button label="Criar administrador" variant="primary" loading={busy} onPress={submit} />
    </AuthCard>
  );
}
