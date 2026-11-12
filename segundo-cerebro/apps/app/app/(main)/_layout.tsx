import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { Sidebar } from '../../src/components/Sidebar';
import { TopBar } from '../../src/components/TopBar';
import { CalendarPanel } from '../../src/components/CalendarPanel';
import { CaptureProvider } from '../../src/components/CaptureModal';
import { Icon } from '../../src/components/Icon';
import { AreaProvider } from '../../src/state/area';
import { TabsProvider } from '../../src/state/tabs';
import { useSession } from '../../src/state/session';
import { colors, useBreakpoint } from '../../src/theme';

const RAIL: { icon: any; label: string; href: string }[] = [
  { icon: 'inbox', label: 'Início', href: '/inbox' },
  { icon: 'sync', label: 'Revisão', href: '/review' },
  { icon: 'search', label: 'Biblioteca', href: '/library' },
  { icon: 'graph', label: 'Grafo', href: '/library/graph' },
  { icon: 'bot', label: 'Assistente', href: '/assistant' },
];

export default function MainLayout() {
  const { isWide, isMedium, isNarrow } = useBreakpoint();
  const [drawer, setDrawer] = useState(false);
  const router = useRouter();
  const { user } = useSession();
  if (!user || user.mustChangePassword) return null; // o Gate redireciona; nada de telas privadas sem sessão
  return (
    <AreaProvider>
      <CaptureProvider>
        <TabsProvider>
          <View style={styles.root}>
            {isMedium ? (
              <View style={styles.rail}>
                {RAIL.map(r => (
                  <Pressable key={r.href} accessibilityRole="link" accessibilityLabel={r.label} onPress={() => router.push(r.href as any)} style={styles.railBtn}>
                    <Icon name={r.icon} size={18} color={colors.muted} />
                  </Pressable>
                ))}
              </View>
            ) : null}
            {isMedium ? <Sidebar /> : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <TopBar narrow={isNarrow} onMenu={() => setDrawer(true)} />
              <View style={{ flex: 1 }}><Slot /></View>
            </View>
            {isWide ? <CalendarPanel /> : null}
            {isNarrow && drawer ? (
              <View style={StyleSheet.absoluteFill}>
                <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: '#000a' }]} onPress={() => setDrawer(false)} accessibilityLabel="Fechar menu" />
                <Sidebar onNavigate={() => setDrawer(false)} />
              </View>
            ) : null}
          </View>
        </TabsProvider>
      </CaptureProvider>
    </AreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  rail: { width: 48, alignItems: 'center', paddingTop: 54, gap: 6, borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: colors.bg },
  railBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
});
