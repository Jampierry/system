import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../theme';
import { Button } from './ui';
import { Icon } from './Icon';

/** Mostra uma credencial (senha temporária ou código) uma única vez, com botão de copiar. */
export function SecretModal({ visible, title, label, secret, note, onClose }: { visible: boolean; title: string; label: string; secret: string; note: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await (globalThis as any).navigator?.clipboard?.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sem área de transferência */ }
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name="key" size={18} color={colors.warning} /><Text style={styles.title}>{title}</Text></View>
          <Text style={styles.note}>{note}</Text>
          <Text style={styles.label}>{label}</Text>
          <Text selectable accessibilityLabel={`${label}: ${secret}`} style={styles.secret} testID="secret-value">{secret}</Text>
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
            <Button label={copied ? 'Copiado!' : 'Copiar'} icon="copy" variant="secondary" onPress={copy} />
            <Button label="Já anotei, fechar" variant="primary" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000b', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  sheet: { width: '100%', maxWidth: 520, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: space.xl, gap: space.md },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  secret: { color: colors.text, fontSize: 15, fontFamily: 'monospace', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14 },
});
