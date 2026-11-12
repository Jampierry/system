import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Link } from 'expo-router';
import { AuthCard } from '../src/components/AuthCard';
import { Button, Field } from '../src/components/ui';
import { api } from '../src/state/session';
import { colors } from '../src/theme';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim()) { setError('Informe seu e-mail'); return; }
    setBusy(true); setError('');
    try {
      const r = await api<{ message: string }>('/api/auth/forgot', { method: 'POST', body: { email: email.trim() } });
      setMsg(r.message);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  const link = (href: any, text: string) => <Link key={text} href={href} asChild><Pressable accessibilityRole="link"><Text style={{ color: colors.accentText, fontSize: 13 }}>{text}</Text></Pressable></Link>;
  return (
    <AuthCard title="Recuperar senha" subtitle="Um administrador analisa o pedido e envia um código de uso único (vale por 1 hora)."
      footer={<>{link('/reset', 'Já tenho um código')}{link('/login', 'Voltar ao login')}</>}>
      <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" onSubmitEditing={submit} error={error} />
      {msg ? <Text accessibilityLiveRegion="polite" style={{ color: colors.success, fontSize: 13, lineHeight: 19 }}>{msg}</Text> : null}
      <Button label="Solicitar recuperação" variant="primary" loading={busy} onPress={submit} />
    </AuthCard>
  );
}
