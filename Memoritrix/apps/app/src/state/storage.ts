import { Platform } from 'react-native';

const KEY = 'cerebro.token';

export const tokenStorage = {
  async get(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
      const SecureStore = require('expo-secure-store');
      return (await SecureStore.getItemAsync(KEY)) ?? null;
    } catch {
      return null;
    }
  },
  async set(token: string): Promise<void> {
    try {
      if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, token);
      else await require('expo-secure-store').setItemAsync(KEY, token);
    } catch { /* sem armazenamento: sessão só em memória */ }
  },
  async clear(): Promise<void> {
    try {
      if (Platform.OS === 'web') globalThis.localStorage?.removeItem(KEY);
      else await require('expo-secure-store').deleteItemAsync(KEY);
    } catch { /* ignora */ }
  },
};
