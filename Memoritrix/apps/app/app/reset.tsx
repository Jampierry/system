import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { AuthCard } from '../src/components/AuthCard';
import { Button, Field } from '../src/components/ui';
import { useToast } from '../src/components/Toast';
import { api } from '../src/state/session';
import { colors } from '../src/theme';

export default function Reset() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (pw.length < 10) { setError('A nova senha precisa ter ao menos 10 caracteres'); return; }
    setBusy(true); setError('');
    try {
      await api('/api/auth/reset', { method: 'POST', body: { email: email.trim(), code: code.trim(), newPassword: pw } });
      toast.show('Senha redefinida. Entre com a nova senha.', 'success');
      router.replace('/login');
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <AuthCard title="Redefinir senha" subtitle="Cole o código que o administrador enviou."
      footer={<Link href="/login" asChild><Pressable accessibilityRole="link"><Text style={{ color: colors.accentText, fontSize: 13 }}>Voltar ao login</Text></Pressable></Link>}>
      <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Código" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} placeholder="Código de recuperação" />
      <Field label="Nova senha" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" onSubmitEditing={submit} error={error} />
      <Button label="Redefinir senha" variant="primary" loading={busy} onPress={submit} />
    </AuthCard>
  );
}
