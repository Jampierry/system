import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, useSession } from '../../../src/state/session';
import { useAssistantSettings, type AssistantSettings } from '../../../src/state/assistantSettings';
import { Badge, Button, Card, Field, Heading, Spinner } from '../../../src/components/ui';
import { Page } from '../../../src/components/ItemsScreen';
import { ModeBadge } from '../../../src/components/ModeBadge';
import { useToast } from '../../../src/components/Toast';
import { getSpeechEngine } from '../../../src/voice/engine';
import { speakReply, type VoiceInfo } from '../../../src/voice/speech';
import { colors, radius, space } from '../../../src/theme';

const LANGS: [string, string][] = [['pt-BR', 'Português (BR)'], ['pt-PT', 'Português (PT)'], ['en-US', 'English (US)'], ['es-ES', 'Español']];
const RATES = [0.75, 1, 1.25, 1.5];
const TONES: [AssistantSettings['tone'], string, string][] = [['conciso', 'Conciso', 'Direto ao ponto'], ['detalhado', 'Detalhado', 'Explica o raciocínio'], ['informal', 'Informal', 'Papo leve'], ['formal', 'Formal', 'Profissional']];
const MODES: [AssistantSettings['replyMode'], string, string][] = [['text', 'Texto', 'Só escreve'], ['audio', 'Áudio', 'Só fala (texto sob demanda)'], ['both', 'Texto e áudio', 'Escreve e fala']];
const SAMPLE: Record<string, string> = { 'pt-BR': 'Olá! Eu sou o seu segundo cérebro.', 'pt-PT': 'Olá! Eu sou o seu segundo cérebro.', 'en-US': 'Hello! I am your second brain.', 'es-ES': '¡Hola! Soy tu segundo cerebro.' };

export default function AssistantSettingsScreen() {
  const toast = useToast();
  const { user } = useSession();
  const { settings, mode, save } = useAssistantSettings();
  const engine = useMemo(() => getSpeechEngine(), []);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [draft, setDraft] = useState<AssistantSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (settings) setDraft(settings); }, [settings]);
  useEffect(() => { engine?.listVoices().then(setVoices).catch(() => {}); }, [engine]);

  if (!draft) return <Spinner />;
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const set = (patch: Partial<AssistantSettings>) => setDraft(d => (d ? { ...d, ...patch } : d));
  const langVoices = voices.filter(v => v.lang.toLowerCase().startsWith(draft.language.slice(0, 2).toLowerCase()));

  async function commit() {
    setBusy(true);
    try { await save(draft!); toast.show('Configurações salvas', 'success'); } catch (e: any) { toast.show(e.message, 'error'); } finally { setBusy(false); }
  }

  const chip = (label: string, on: boolean, onPress: () => void, sub?: string) => (
    <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && { color: colors.accentText }]}>{label}</Text>
      {sub ? <Text style={styles.chipSub}>{sub}</Text> : null}
    </Pressable>
  );

  return (
    <Page>
      <Heading title="Assistente" subtitle="Escolha como o assistente fala com você." right={<ModeBadge mode={mode} />} />
      <Card style={{ gap: space.lg }}>
        <Text style={styles.h}>Como responder</Text>
        <View style={styles.chips}>{MODES.map(([k, l, s]) => chip(l, draft.replyMode === k, () => set({ replyMode: k }), s))}</View>

        <Text style={styles.h}>Tom</Text>
        <View style={styles.chips}>{TONES.map(([k, l, s]) => chip(l, draft.tone === k, () => set({ tone: k }), s))}</View>

        <Text style={styles.h}>Idioma</Text>
        <View style={styles.chips}>{LANGS.map(([k, l]) => chip(l, draft.language === k, () => set({ language: k, voice: null })))}</View>

        <Text style={styles.h}>Velocidade da voz</Text>
        <View style={styles.chips}>{RATES.map(r => chip(`${r}×`, draft.rate === r, () => set({ rate: r })))}</View>

        <Text style={styles.h}>Voz</Text>
        {!engine ? <Text style={styles.sub}>Este dispositivo não oferece síntese de voz.</Text> : (
          <View style={styles.chips}>
            {chip('Padrão do sistema', draft.voice === null, () => set({ voice: null }))}
            {langVoices.slice(0, 12).map(v => chip(v.name, draft.voice === v.id, () => set({ voice: v.id })))}
          </View>
        )}
        {engine && voices.length > 0 && langVoices.length === 0 ? <Text style={styles.sub}>Nenhuma voz instalada para este idioma; usando a padrão.</Text> : null}

        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button label="Testar voz" icon="play" variant="secondary" disabled={!engine} onPress={() => { if (!speakReply(engine, SAMPLE[draft.language] ?? SAMPLE['pt-BR'], { ...draft, replyMode: 'both' })) toast.show('Sem voz disponível', 'info'); }} />
          <Button label="Parar" variant="ghost" disabled={!engine} onPress={() => engine?.stop()} />
          <View style={{ flex: 1 }} />
          <Button label="Salvar" variant="primary" disabled={!dirty} loading={busy} onPress={commit} testID="save-settings" />
        </View>
      </Card>

      <Card style={{ marginTop: space.lg, gap: space.sm }}>
        <Text style={styles.h}>Modelo de IA</Text>
        <Text style={styles.sub}>
          {mode === 'claude' ? 'Conectado ao Claude. As respostas usam o modelo configurado no servidor.' : 'Modo demo: respostas simuladas para comandos simples (anota:, nota:, agenda, procure…). Para ativar o Claude, defina ANTHROPIC_API_KEY no ambiente do servidor e reinicie.'}
        </Text>
      </Card>

      <ChangePassword email={user?.email ?? ''} />
    </Page>
  );
}

function ChangePassword({ email }: { email: string }) {
  const toast = useToast();
  const { setSessionToken } = useSession();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (pw.length < 10) { setErr('A nova senha precisa ter ao menos 10 caracteres'); return; }
    setBusy(true); setErr('');
    try {
      const r = await api<{ token: string }>('/api/auth/change-password', { method: 'POST', body: { currentPassword: cur, newPassword: pw } });
      await setSessionToken(r.token);
      setCur(''); setPw(''); toast.show('Senha alterada', 'success');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <Card style={{ marginTop: space.lg, gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={styles.h}>Minha conta</Text><Badge text={email} /></View>
      <Field label="Senha atual" value={cur} onChangeText={setCur} secureTextEntry autoComplete="current-password" />
      <Field label="Nova senha (mín. 10 caracteres)" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" error={err} onSubmitEditing={submit} />
      <Button label="Alterar senha" variant="secondary" loading={busy} disabled={!cur || !pw} onPress={submit} style={{ alignSelf: 'flex-start' }} />
    </Card>
  );
}

const styles = StyleSheet.create({
  h: { color: colors.text, fontSize: 14, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 12.5, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, minWidth: 90 },
  chipOn: { backgroundColor: colors.accentBg, borderColor: '#2a3a7a' },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  chipSub: { color: colors.faint, fontSize: 11, marginTop: 2 },
});
