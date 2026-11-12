export type Dictation = { stop(): void };

/**
 * Ditado por voz via Web Speech API (Chrome/Edge/Safari). Devolve null se o ambiente não suporta.
 * `onText` recebe o texto reconhecido até agora e se ele já é final; `onEnd` avisa o fim (com o motivo em caso de erro).
 */
export function startDictation(
  lang: string,
  onText: (text: string, final: boolean) => void,
  g: any = globalThis,
  onEnd?: (reason?: string) => void,
): Dictation | null {
  const Ctor = g.SpeechRecognition ?? g.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  let finished = false;
  const finish = (reason?: string) => { if (finished) return; finished = true; onEnd?.(reason); };
  rec.onresult = (e: any) => {
    let text = '';
    let final = false;
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      final = !!e.results[i].isFinal;
    }
    onText(text.trim(), final);
  };
  rec.onend = () => finish();
  rec.onerror = (e: any) => finish(e?.error ?? 'error');
  try { rec.start(); } catch { finish('start-failed'); }
  return { stop: () => { try { rec.stop(); } catch { finish(); } } };
}
