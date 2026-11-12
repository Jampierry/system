import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Permission } from '@cerebro/shared';
import { PERMISSION_GROUPS, PERMISSION_INFO, togglePermission } from '../lib/permissionMatrix';
import { colors, radius, space } from '../theme';
import { Icon } from './Icon';

export function PermissionMatrix({ value, onChange, readOnly }: { value: Permission[]; onChange: (p: Permission[]) => void; readOnly?: boolean }) {
  return (
    <View style={{ gap: space.lg }}>
      {PERMISSION_GROUPS.map(g => (
        <View key={g.title} style={{ gap: 6 }}>
          <Text style={styles.group}>{g.title}</Text>
          {g.perms.map(p => {
            const on = value.includes(p);
            return (
              <Pressable key={p} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: readOnly }} accessibilityLabel={PERMISSION_INFO[p].label}
                disabled={readOnly} onPress={() => onChange(togglePermission(value, p))} style={[styles.row, on && styles.rowOn, readOnly && { opacity: 0.6 }]}>
                <View style={[styles.box, on && styles.boxOn]}>{on ? <Icon name="check" size={12} color={colors.white} strokeWidth={3} /> : null}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{PERMISSION_INFO[p].label}</Text>
                  <Text style={styles.hint}>{PERMISSION_INFO[p].hint}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  rowOn: { borderColor: '#2a3a7a', backgroundColor: '#141b3a' },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { color: colors.text, fontSize: 13.5, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
