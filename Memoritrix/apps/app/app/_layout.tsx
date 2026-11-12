import React, { useEffect, useState } from 'react';
import { Slot, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SessionProvider, api, useSession } from '../src/state/session';
import { ToastProvider } from '../src/components/Toast';
import { Spinner } from '../src/components/ui';
import { colors } from '../src/theme';

const PUBLIC = ['login', 'forgot', 'reset', 'setup'];

/** Decide para onde levar o usuário. undefined = já está no lugar certo; null = ainda carregando. */
function targetFor(opts: { loading: boolean; user: ReturnType<typeof useSession>['user']; needsSetup: boolean | null; first?: string }): string | null | undefined {
  const { loading, user, needsSetup, first } = opts;
  if (loading) return null;
  if (!user) {
    if (needsSetup === null) return null;
    if (needsSetup) return first === 'setup' ? undefined : '/setup';
    return first && PUBLIC.includes(first) ? undefined : '/login';
  }
  if (user.mustChangePassword) return first === 'change-password' ? undefined : '/change-password';
  return !first || PUBLIC.includes(first) || first === 'change-password' ? '/inbox' : undefined;
}

function Gate() {
  const router = useRouter();
  const navKey = useRootNavigationState()?.key;
  const { user, loading } = useSession();
  const segments = useSegments() as string[];
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading || user) { setNeedsSetup(null); return; }
    api<{ needsSetup: boolean }>('/api/auth/setup-status').then(r => setNeedsSetup(r.needsSetup)).catch(() => setNeedsSetup(false));
  }, [user, loading]);

  const target = targetFor({ loading, user, needsSetup, first: segments[0] });
  useEffect(() => {
    if (navKey && typeof target === 'string') router.replace(target as any);
  }, [navKey, target, router]);

  return (
    <>
      <Slot />
      {target !== undefined ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}><Spinner /></View> : null}
    </>
  );
}

export default function Root() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <ToastProvider>
        <SessionProvider>
          <Gate />
        </SessionProvider>
      </ToastProvider>
    </View>
  );
}
