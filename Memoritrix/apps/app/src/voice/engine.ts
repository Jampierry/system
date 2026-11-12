import { Platform } from 'react-native';
import { webSpeechEngine, type SpeechEngine, type VoiceInfo } from './speech';

/** Motor de fala da plataforma: speechSynthesis no web, expo-speech no nativo. */
export function getSpeechEngine(): SpeechEngine | null {
  if (Platform.OS === 'web') return webSpeechEngine(globalThis);
  try {
    const Speech = require('expo-speech');
    return {
      speak(text, { lang, rate, voice }) { Speech.stop(); Speech.speak(text, { language: lang, rate, voice: voice ?? undefined }); },
      stop() { Speech.stop(); },
      async listVoices(): Promise<VoiceInfo[]> {
        return (await Speech.getAvailableVoicesAsync()).map((v: any) => ({ id: v.identifier, name: v.name, lang: v.language }));
      },
    };
  } catch {
    return null;
  }
}
