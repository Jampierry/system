import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

type Kind = 'info' | 'success' | 'error';
type Ctx = { show: (message: string, kind?: Kind) => void };
const ToastCtx = createContext<Ctx>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; kind: Kind } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((message: string, kind: Kind = 'info') => {
    setToast({ message, kind });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={styles.wrap}>
          <View accessibilityLiveRegion="polite" style={[styles.toast, toast.kind === 'error' && styles.err, toast.kind === 'success' && styles.ok]}>
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </View>
      ) : null}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center', zIndex: 1000 },
  toast: { backgroundColor: '#23232d', borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10, maxWidth: 520 },
  err: { backgroundColor: '#3a1a20', borderColor: '#6b2a33' },
  ok: { backgroundColor: '#12301f', borderColor: '#1f5a38' },
  text: { color: colors.text, fontSize: 13 },
});
