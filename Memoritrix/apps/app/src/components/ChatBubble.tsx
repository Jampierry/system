import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../theme';
import { Badge } from './ui';
import { Icon } from './Icon';

export type ChatMsg = {
  id: string; role: 'user' | 'assistant'; text: string; image?: string;
  tools?: { name: string; ok: boolean }[]; fallback?: boolean; error?: boolean;
};

const TOOL_LABEL: Record<string, string> = {
  criar_item: 'Item criado', criar_nota: 'Nota criada', criar_evento: 'Evento criado', listar_agenda: 'Agenda consultada',
  buscar: 'Busca feita', resumir_nota: 'Nota lida', adicionar_ao_mapa: 'Mapa atualizado', expandir_ramo: 'Mapa atualizado', gerar_mapa: 'Mapa criado',
};

export function ChatBubble({ msg, onSpeak, onStop, audioOnly }: { msg: ChatMsg; onSpeak?: () => void; onStop?: () => void; audioOnly?: boolean }) {
  const mine = msg.role === 'user';
  const [reveal, setReveal] = useState(false);
  const hidden = !mine && audioOnly && !reveal && !msg.error;
  return (
    <View style={[styles.row, mine && { justifyContent: 'flex-end' }]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs, msg.error && styles.err]} accessibilityLabel={`${mine ? 'Você' : 'Assistente'}: ${hidden ? 'resposta em áudio' : msg.text}`}>
        {msg.image ? <Image source={{ uri: msg.image }} style={styles.img} resizeMode="cover" accessibilityLabel="Foto enviada" /> : null}
        {hidden ? (
          <Pressable accessibilityRole="button" onPress={() => setReveal(true)} style={styles.hiddenRow}>
            <Icon name="wave" size={16} color={colors.accentText} /><Text style={styles.hiddenText}>Resposta em áudio · mostrar texto</Text>
          </Pressable>
        ) : <Text selectable style={[styles.text, mine && { color: colors.white }]}>{msg.text}</Text>}
        {!mine && msg.tools?.length ? (
          <View style={styles.tools}>{msg.tools.map((t, i) => <Badge key={i} text={t.ok ? (TOOL_LABEL[t.name] ?? t.name) : `Falhou: ${TOOL_LABEL[t.name] ?? t.name}`} tone={t.ok ? 'success' : 'danger'} />)}</View>
        ) : null}
        {!mine && msg.fallback ? <Text style={styles.warn}>Claude indisponível: respondi em modo demo.</Text> : null}
        {!mine && !msg.error && onSpeak ? (
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Ouvir resposta" onPress={onSpeak} hitSlop={6} style={styles.act}><Icon name="play" size={12} color={colors.muted} /><Text style={styles.actText}>Ouvir</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Parar áudio" onPress={onStop} hitSlop={6} style={styles.act}><Icon name="pause" size={12} color={colors.muted} /><Text style={styles.actText}>Parar</Text></Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: space.md },
  bubble: { maxWidth: '82%', borderRadius: radius.lg, padding: space.md, gap: 8 },
  mine: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  err: { borderColor: colors.danger },
  text: { color: colors.text, fontSize: 14.5, lineHeight: 22 },
  img: { width: 220, height: 160, borderRadius: radius.md },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  warn: { color: colors.warning, fontSize: 11.5 },
  actions: { flexDirection: 'row', gap: 14 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actText: { color: colors.muted, fontSize: 11.5 },
  hiddenRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hiddenText: { color: colors.accentText, fontSize: 13 },
});
