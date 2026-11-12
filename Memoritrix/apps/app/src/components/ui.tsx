import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, radius, space } from '../theme';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({ label, onPress, variant = 'secondary', icon, disabled, loading, small, style, testID }: {
  label: string; onPress?: () => void; variant?: Variant; icon?: IconName; disabled?: boolean; loading?: boolean; small?: boolean; style?: ViewStyle; testID?: string;
}) {
  const v = variantStyle[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed, hovered }: any) => [styles.btn, small && styles.btnSmall, { backgroundColor: v.bg, borderColor: v.border, opacity: disabled ? 0.5 : pressed ? 0.8 : hovered ? 0.92 : 1 }, style]}
    >
      {loading ? <ActivityIndicator size="small" color={v.fg} /> : icon ? <Icon name={icon} size={small ? 14 : 16} color={v.fg} /> : null}
      <Text style={[styles.btnText, small && { fontSize: 12 }, { color: v.fg }]}>{label}</Text>
    </Pressable>
  );
}

const variantStyle = {
  primary: { bg: colors.accent, border: colors.accent, fg: colors.white },
  secondary: { bg: colors.accentBg, border: '#2a3a7a', fg: colors.accentText },
  ghost: { bg: 'transparent', border: colors.border, fg: colors.text },
  danger: { bg: '#3a1a20', border: '#6b2a33', fg: '#ff8a95' },
};

export function Field({ label, error, ...props }: TextInputProps & { label?: string; error?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.faint}
        accessibilityLabel={label}
        {...props}
        style={[styles.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, error ? { borderColor: colors.danger } : null, props.style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Heading({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.heading}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text accessibilityRole="header" style={styles.h1}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{right}</View> : null}
    </View>
  );
}

export function Badge({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'accent' | 'success' | 'danger' | 'warning' }) {
  const c = { muted: colors.muted, accent: colors.accentText, success: colors.success, danger: colors.danger, warning: colors.warning }[tone];
  return <Text style={[styles.badge, { color: c, borderColor: c + '55' }]}>{text}</Text>;
}

export function EmptyState({ icon = 'inbox', title, hint, action }: { icon?: IconName; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Icon name={icon} size={34} color={colors.muted} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.sub}>{hint}</Text> : null}
      {action}
    </View>
  );
}

export function Spinner() {
  return <View style={{ padding: space.xl, alignItems: 'center' }}><ActivityIndicator color={colors.accent} /></View>;
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md, borderWidth: 1, minHeight: 38 },
  btnSmall: { paddingHorizontal: 10, paddingVertical: 6, minHeight: 30 },
  btnText: { fontSize: 13, fontWeight: '600' },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  error: { color: colors.danger, fontSize: 12 },
  card: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: space.lg },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingBottom: space.md, marginBottom: space.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  h1: { color: colors.text, fontSize: 22, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
  badge: { fontSize: 11, fontWeight: '600', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 56, paddingHorizontal: space.lg },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
