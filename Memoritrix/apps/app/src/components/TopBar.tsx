import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTabs } from '../state/tabs';
import { colors, radius, space } from '../theme';
import { Icon } from './Icon';
import { useCapture } from './CaptureModal';

export function TopBar({ narrow, onMenu }: { narrow: boolean; onMenu: () => void }) {
  const router = useRouter();
  const { tabs, active, close } = useTabs();
  const { openCapture } = useCapture();
  return (
    <View style={styles.bar}>
      {narrow ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir menu" onPress={onMenu} style={styles.iconBtn}><Icon name="menu" size={18} /></Pressable>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Capturar item" onPress={() => openCapture()} style={[styles.round, { backgroundColor: colors.accentBg }]}>
        <Icon name="plus" size={15} color={colors.accentText} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Assistente por voz" onPress={() => router.push({ pathname: '/assistant', params: { voice: '1', t: String(Date.now()) } } as any)} style={[styles.round, { backgroundColor: colors.accent }]}>
        <Icon name="wave" size={15} color={colors.white} />
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
        {tabs.map(t => {
          const on = t.path === active;
          return (
            <Pressable key={t.path} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => router.push(t.path as any)} style={[styles.tab, on && styles.tabOn]}>
              <Text style={[styles.tabText, on && { color: colors.text }]} numberOfLines={1}>{t.title}</Text>
              <Pressable accessibilityLabel={`Fechar ${t.title}`} onPress={() => close(t.path)} hitSlop={8}><Icon name="x" size={12} color={colors.faint} /></Pressable>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="Configurações" onPress={() => router.push('/settings/assistant' as any)} style={styles.iconBtn}>
        <Icon name="settings" size={17} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.md, height: 46, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg },
  round: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 30, borderRadius: radius.md, backgroundColor: 'transparent', maxWidth: 200 },
  tabOn: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  tabText: { color: colors.muted, fontSize: 12 },
});
