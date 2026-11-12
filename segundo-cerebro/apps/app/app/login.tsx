import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Link } from 'expo-router';
import { AuthCard } from '../src/components/AuthCard';
import { Button, Field } from '../src/components/ui';
import { useSession } from '../src/state/session';
import { colors } from '../src/theme';

export default function Login() {
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) { setError('Informe e-mail e senha'); return; }
    setBusy(true);
    setError('');
    try { await login(email.trim(), password); } catch (e: any) { setError(e.message ?? 'Não foi possível entrar'); } finally { setBusy(false); }
  }

  return (
    <AuthCard title="Entrar" subtitle="Acesse seu segundo cérebro."
      footer={<Link href="/forgot" asChild><Pressable accessibilityRole="link"><Text style={{ color: colors.accentText, fontSize: 13 }}>Esqueci minha senha</Text></Pressable></Link>}>
      <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="username" placeholder="voce@exemplo.com" />
      <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" placeholder="Sua senha" onSubmitEditing={submit} error={error} />
      <Button label="Entrar" variant="primary" loading={busy} onPress={submit} testID="login-submit" />
    </AuthCard>
  );
}
