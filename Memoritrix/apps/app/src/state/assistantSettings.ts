import { useCallback, useEffect, useState } from 'react';
import { api } from './session';

export type AssistantSettings = { voice: string | null; language: string; rate: number; tone: 'conciso' | 'detalhado' | 'informal' | 'formal'; replyMode: 'text' | 'audio' | 'both' };
const DEFAULTS: AssistantSettings = { voice: null, language: 'pt-BR', rate: 1, tone: 'conciso', replyMode: 'both' };

export function useAssistantSettings() {
  const [settings, setSettings] = useState<AssistantSettings | null>(null);
  const [mode, setMode] = useState<'demo' | 'claude' | null>(null);

  const reload = useCallback(async () => {
    try { setSettings((await api<{ settings: AssistantSettings }>('/api/assistant/settings')).settings); } catch { setSettings(DEFAULTS); }
    try { setMode((await api<{ mode: 'demo' | 'claude' }>('/api/assistant/mode')).mode); } catch { setMode(null); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const save = useCallback(async (patch: Partial<AssistantSettings>): Promise<AssistantSettings> => {
    const r = await api<{ settings: AssistantSettings }>('/api/assistant/settings', { method: 'PUT', body: patch });
    setSettings(r.settings);
    return r.settings;
  }, []);

  return { settings, mode, save, reload };
}
