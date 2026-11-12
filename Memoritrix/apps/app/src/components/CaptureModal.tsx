import React, { createContext, useCallback, useContext, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, useSession } from '../state/session';
import { emit } from '../state/bus';
import { useArea } from '../state/area';
import { colors, radius, space } from '../theme';
import { Button, Field } from './ui';
import { useToast } from './Toast';

type Ctx = { openCapture: (initial?: string) => void };
const CaptureCtx = createContext<Ctx>({ openCapture: () => {} });

export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const { can } = useSession();
  const { areaId } = useArea();
  const toast = useToast();

  const openCapture = useCallback((initial = '') => { setText(initial); setOpen(true); }, []);

  async function save() {
    const [first, ...rest] = text.trim().split('\n');
    if (!first) return;
    setBusy(true);
    try {
      await api('/api/items', { method: 'POST', body: { title: first.trim(), body: rest.join('\n').trim(), areaId } });
      emit('items');
      toast.show('Capturado na caixa de entrada', 'success');
      setOpen(false);
      setText('');
    } catch (e: any) {
      toast.show(e.message ?? 'Não foi possível salvar', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CaptureCtx.Provider value={{ openCapture }}>
      {children}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>Capturar item</Text>
            <Text style={styles.hint}>Tire da cabeça. Você organiza depois, na Caixa de entrada.</Text>
            {can('items.write') ? (
              <>
                <Field
                  autoFocus
                  multiline
                  placeholder="O que está na sua cabeça?"
                  value={text}
                  onChangeText={setText}
                  onKeyPress={(e: any) => { if (e.nativeEvent.key === 'Enter' && (e.ctrlKey || e.metaKey || e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)) void save(); }}
                />
                <View style={styles.actions}>
                  <Button label="Cancelar" variant="ghost" onPress={() => setOpen(false)} />
                  <Button label="Salvar" variant="primary" icon="plus" loading={busy} disabled={!text.trim()} onPress={save} />
                </View>
              </>
            ) : (
              <Text style={styles.hint}>Seu perfil é somente leitura.</Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </CaptureCtx.Provider>
  );
}

export const useCapture = () => useContext(CaptureCtx);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  card: { width: '100%', maxWidth: 480, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: space.xl, gap: space.md },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 12.5 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
