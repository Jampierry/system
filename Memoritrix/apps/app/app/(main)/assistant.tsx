import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/state/session';
import { emit } from '../../src/state/bus';
import { useAssistantSettings } from '../../src/state/assistantSettings';
import { Badge, Button, EmptyState } from '../../src/components/ui';
import { Icon } from '../../src/components/Icon';
import { ChatBubble, type ChatMsg } from '../../src/components/ChatBubble';
import { ModeBadge } from '../../src/components/ModeBadge';
import { useToast } from '../../src/components/Toast';
import { getSpeechEngine } from '../../src/voice/engine';
import { speakReply } from '../../src/voice/speech';
import { startDictation, type Dictation } from '../../src/voice/recognition';
import { pickPhoto, type Photo } from '../../src/voice/photo';
import { colors, radius, space } from '../../src/theme';

type Reply = { conversationId: string; reply: { text: string }; mode: 'demo' | 'claude'; fallback: boolean; toolsUsed: { name: string; ok: boolean }[]; settings: { replyMode: 'text' | 'audio' | 'both'; language: string; rate: number; voice: string | null } };
const SUGGESTIONS = ['anota: comprar pão', 'o que tenho na agenda?', 'procure receitas', 'mapa mental sobre viagem ao Japão'];
const TOPICS: Record<string, string> = { criar_item: 'items', criar_evento: 'items', criar_nota: 'notes', gerar_mapa: 'mindmaps', adicionar_ao_mapa: 'mindmaps', expandir_ramo: 'mindmaps' };
let uid = 0;
const nid = () => `m${++uid}-${Date.now()}`;

export default function Assistant() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ voice?: string; t?: string }>();
  const { settings, mode, reload } = useAssistantSettings();
  const engine = useMemo(() => getSpeechEngine(), []);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [autoSend, setAutoSend] = useState(true);
  const dictation = useRef<Dictation | null>(null);
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const sendRef = useRef<(t?: string) => Promise<void>>(async () => {});
  const autoSendRef = useRef(autoSend);
  autoSendRef.current = autoSend;

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    api<{ conversationId: string | null; messages: { role: 'user' | 'assistant'; text: string }[] }>('/api/assistant/history')
      .then(h => { setConvId(h.conversationId); setMsgs(h.messages.map(m => ({ id: nid(), role: m.role, text: m.text }))); })
      .catch(() => {});
  }, []);
  useEffect(() => () => { dictation.current?.stop(); engine?.stop(); }, [engine]);
  useEffect(() => { setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50); }, [msgs, busy]);

  const send = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if ((!text && !photo) || busy || !settings) return;
    const message = text || 'Veja esta imagem.';
    const img = photo;
    setMsgs(m => [...m, { id: nid(), role: 'user', text: message, image: img?.uri }]);
    setInput(''); setPhoto(null); setBusy(true);
    try {
      const r = await api<Reply>('/api/assistant/chat', { method: 'POST', body: { message, conversationId: convId ?? undefined, ...(img ? { imageBase64: img.base64, imageMime: img.mime } : {}) } });
      setConvId(r.conversationId);
      setMsgs(m => [...m, { id: nid(), role: 'assistant', text: r.reply.text, tools: r.toolsUsed, fallback: r.fallback }]);
      for (const t of new Set(r.toolsUsed.filter(x => x.ok).map(x => TOPICS[x.name]).filter(Boolean))) emit(t);
      speakReply(engine, r.reply.text, r.settings);
    } catch (e: any) {
      setMsgs(m => [...m, { id: nid(), role: 'assistant', text: e.message ?? 'Não foi possível falar com o assistente.', error: true }]);
    } finally { setBusy(false); }
  }, [input, photo, busy, settings, convId, engine]);
  sendRef.current = send;

  function toggleMic() {
    if (listening) { dictation.current?.stop(); return; }
    engine?.stop();
    const d = startDictation(settings?.language ?? 'pt-BR', (t, final) => {
      setInput(t);
      if (final && autoSendRef.current && t) void sendRef.current(t);
    }, globalThis, reason => {
      setListening(false);
      if (reason === 'not-allowed' || reason === 'service-not-allowed') toast.show('Permita o uso do microfone no navegador para falar com o assistente.', 'error');
      else if (reason && reason !== 'no-speech' && reason !== 'aborted') toast.show('Não consegui ouvir. Tente de novo.', 'error');
    });
    if (!d) {
      toast.show(Platform.OS === 'web' ? 'Ditado por voz não é suportado neste navegador. Use Chrome ou Edge.' : 'Neste aparelho, use o botão de microfone do teclado para ditar.', 'info');
      return;
    }
    dictation.current = d;
    setListening(true);
  }

  useEffect(() => { if (params.voice === '1' && settings) { const t = setTimeout(toggleMic, 400); return () => clearTimeout(t); } }, [params.voice, params.t, !!settings]); // eslint-disable-line react-hooks/exhaustive-deps

  async function attach(source: 'camera' | 'library') {
    try { const p = await pickPhoto(source); if (p) setPhoto(p); } catch (e: any) { toast.show(e.message ?? 'Não foi possível abrir a foto', 'error'); }
  }

  const audioOnly = settings?.replyMode === 'audio';
  const speakAgain = (text: string) => { if (settings) { engine?.speak(text, { lang: settings.language, rate: settings.rate, voice: settings.voice }); } };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={styles.h1}>Assistente</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <ModeBadge mode={mode} />
            {settings ? <Badge text={{ text: 'Só texto', audio: 'Só áudio', both: 'Texto e áudio' }[settings.replyMode]} /> : null}
            {mode === 'demo' ? <Text style={styles.sub}>Defina ANTHROPIC_API_KEY no servidor para usar o Claude.</Text> : null}
          </View>
        </View>
        <Button label="Nova conversa" small variant="ghost" icon="plus" onPress={() => { setConvId(null); setMsgs([]); engine?.stop(); }} />
        <Button label="Configurar" small variant="ghost" icon="settings" onPress={() => router.push('/settings/assistant' as any)} />
      </View>

      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ padding: space.lg, maxWidth: 860, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {msgs.length === 0 ? (
          <EmptyState icon="bot" title="Fale ou escreva. Eu organizo." hint="Peça para anotar, agendar, buscar ou montar um mapa mental. Você também pode enviar uma foto."
            action={<View style={styles.chips}>{SUGGESTIONS.map(s => <Pressable key={s} accessibilityRole="button" onPress={() => setInput(s)} style={styles.chip}><Text style={styles.chipText}>{s}</Text></Pressable>)}</View>} />
        ) : msgs.map(m => <ChatBubble key={m.id} msg={m} audioOnly={audioOnly} onSpeak={m.role === 'assistant' && engine ? () => speakAgain(m.text) : undefined} onStop={() => engine?.stop()} />)}
        {busy ? <Text accessibilityLiveRegion="polite" style={styles.typing}>Assistente está pensando…</Text> : null}
      </ScrollView>

      <View style={styles.composer}>
        {photo ? (
          <View style={styles.preview}>
            <Image source={{ uri: photo.uri }} style={styles.thumb} accessibilityLabel="Foto anexada" />
            <Pressable accessibilityRole="button" accessibilityLabel="Remover foto" onPress={() => setPhoto(null)} style={styles.rm}><Icon name="x" size={12} color={colors.white} /></Pressable>
          </View>
        ) : null}
        {listening ? <Text accessibilityLiveRegion="polite" style={styles.listening}>● Ouvindo… fale agora</Text> : null}
        <View style={styles.inputRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Tirar foto" onPress={() => attach('camera')} style={styles.iconBtn}><Icon name="camera" size={18} color={colors.muted} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Anexar imagem" onPress={() => attach('library')} style={styles.iconBtn}><Icon name="upload" size={18} color={colors.muted} /></Pressable>
          <TextInput
            value={input} onChangeText={setInput} multiline placeholder="Escreva ou toque no microfone…" placeholderTextColor={colors.faint} accessibilityLabel="Mensagem para o assistente"
            style={styles.input}
            onKeyPress={(e: any) => { if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey && Platform.OS === 'web') { e.preventDefault?.(); void send(); } }}
          />
          <Pressable accessibilityRole="button" accessibilityLabel={listening ? 'Parar de ouvir' : 'Falar com o assistente'} accessibilityState={{ selected: listening }} onPress={toggleMic} style={[styles.iconBtn, listening && styles.micOn]}>
            <Icon name="mic" size={18} color={listening ? colors.white : colors.muted} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Enviar" disabled={busy || (!input.trim() && !photo)} onPress={() => void send()} style={[styles.send, (busy || (!input.trim() && !photo)) && { opacity: 0.4 }]}>
            <Icon name="send" size={17} color={colors.white} />
          </Pressable>
        </View>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: autoSend }} onPress={() => setAutoSend(a => !a)} style={styles.auto}>
          <View style={[styles.box, autoSend && styles.boxOn]}>{autoSend ? <Icon name="check" size={10} color={colors.white} strokeWidth={3} /> : null}</View>
          <Text style={styles.autoText}>Enviar ao terminar de falar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap' },
  h1: { color: colors.text, fontSize: 22, fontWeight: '800' },
  sub: { color: colors.faint, fontSize: 11.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.panel },
  chipText: { color: colors.accentText, fontSize: 12.5 },
  typing: { color: colors.muted, fontSize: 12.5, fontStyle: 'italic' },
  composer: { borderTopWidth: 1, borderTopColor: colors.border, padding: space.md, gap: 8, backgroundColor: colors.bg, alignItems: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, width: '100%', maxWidth: 860 },
  input: { flex: 1, minHeight: 42, maxHeight: 140, color: colors.text, fontSize: 14.5, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, outlineStyle: 'none' } as any,
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  micOn: { backgroundColor: colors.danger, borderColor: colors.danger },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  listening: { color: colors.danger, fontSize: 12.5, fontWeight: '700' },
  preview: { alignSelf: 'flex-start', maxWidth: 860, width: '100%' },
  thumb: { width: 84, height: 84, borderRadius: radius.md },
  rm: { position: 'absolute', left: 70, top: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  auto: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: 860, width: '100%' },
  autoText: { color: colors.muted, fontSize: 12 },
  box: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
