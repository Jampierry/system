import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../theme';
import { Icon, type IconName } from '../Icon';

export const SWATCHES = ['#5b74f5', '#3ecf8e', '#f5b84b', '#f5626f', '#c58bff', '#4dd0e1', '#ff8a65', '#9aa0b4'];

export type ToolbarAction = { key: string; label: string; icon?: IconName; text?: string; onPress: () => void; disabled?: boolean; busy?: boolean; accent?: boolean };

export function Toolbar({ groups, onColor, colorDisabled }: { groups: ToolbarAction[][]; onColor: (c: string | undefined) => void; colorDisabled: boolean }) {
  const [palette, setPalette] = useState(false);
  return (
    <View style={{ zIndex: 5 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {groups.map((g, gi) => (
          <View key={gi} style={styles.group}>
            {g.map(a => (
              <Pressable key={a.key} accessibilityRole="button" accessibilityLabel={a.label} disabled={a.disabled || a.busy} onPress={a.onPress}
                style={({ hovered }: any) => [styles.btn, a.accent && styles.accent, hovered && { backgroundColor: '#1d1d26' }, (a.disabled || a.busy) && { opacity: 0.4 }]}>
                {a.icon ? <Icon name={a.icon} size={15} color={a.accent ? colors.accentText : colors.text} /> : <Text style={styles.glyph}>{a.text}</Text>}
                <Text style={[styles.label, a.accent && { color: colors.accentText }]}>{a.busy ? '…' : a.label}</Text>
              </Pressable>
            ))}
          </View>
        ))}
        <View style={styles.group}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cor do nó" disabled={colorDisabled} onPress={() => setPalette(p => !p)} style={[styles.btn, colorDisabled && { opacity: 0.4 }]}>
            <View style={styles.swatchPreview} /><Text style={styles.label}>Cor</Text>
          </Pressable>
        </View>
      </ScrollView>
      {palette ? (
        <View style={styles.palette}>
          {SWATCHES.map(c => <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Cor ${c}`} onPress={() => { onColor(c); setPalette(false); }} style={[styles.swatch, { backgroundColor: c }]} />)}
          <Pressable accessibilityRole="button" accessibilityLabel="Sem cor" onPress={() => { onColor(undefined); setPalette(false); }} style={[styles.swatch, { borderWidth: 1, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' }]}><Icon name="x" size={12} color={colors.muted} /></Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 4 },
  group: { flexDirection: 'row', gap: 2, backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 3 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, height: 30, borderRadius: 7 },
  accent: { backgroundColor: colors.accentBg },
  glyph: { color: colors.text, fontWeight: '800', fontSize: 13 },
  label: { color: colors.text, fontSize: 12 },
  swatchPreview: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent, borderWidth: 1, borderColor: '#fff3' },
  palette: { position: 'absolute', top: 44, right: 0, flexDirection: 'row', gap: 8, padding: 10, backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  swatch: { width: 24, height: 24, borderRadius: 12 },
});
