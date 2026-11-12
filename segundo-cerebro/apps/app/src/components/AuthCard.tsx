import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../theme';
import { Icon } from './Icon';

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.logo}><Icon name="brain" size={26} color={colors.accentText} /></View>
          <Text style={styles.brand}>Segundo Cérebro</Text>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
          <View style={{ gap: space.md, marginTop: space.md }}>{children}</View>
          {footer ? <View style={{ marginTop: space.lg, gap: 8, alignItems: 'center' }}>{footer}</View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  card: { width: '100%', maxWidth: 400, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: space.xl },
  logo: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.accentBg, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  brand: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 4 },
  sub: { color: colors.muted, fontSize: 13, marginTop: 6, lineHeight: 19 },
});
