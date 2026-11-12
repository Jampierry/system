export type VoiceInfo = { id: string; name: string; lang: string };
export type SpeakOpts = { lang: string; rate: number; voice?: string | null };
export type SpeechEngine = {
  speak(text: string, opts: SpeakOpts): void;
  stop(): void;
  listVoices(): Promise<VoiceInfo[]>;
};
export type ReplySettings = { replyMode: 'text' | 'audio' | 'both'; language: string; rate: number; voice: string | null };

/** Texto limpo para ser lido em voz alta: sem markdown, links, wikilinks, marcadores e emojis. */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/\[\[([^\]|]*\|)?([^\]]+)\]\]/g, '$2')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[«»]/g, '')
    .replace(/\*+/g, '')
    .replace(/^\s*(?:[-+]|\d+\.|#{1,6})\s+/gm, '')
    .replace(/[\p{Extended_Pictographic}‍️]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fala a resposta se o modo pedir áudio. Devolve se falou. */
export function speakReply(engine: SpeechEngine | null, text: string, s: ReplySettings): boolean {
  if (!engine || s.replyMode === 'text') return false;
  const clean = cleanForSpeech(text);
  if (!clean) return false;
  engine.speak(clean, { lang: s.language, rate: s.rate, voice: s.voice });
  return true;
}

/** Motor de fala do navegador (speechSynthesis). `g` é injetável para testes. */
export function webSpeechEngine(g: any = globalThis): SpeechEngine | null {
  const synth = g.speechSynthesis;
  const Utter = g.SpeechSynthesisUtterance;
  if (!synth || !Utter) return null;
  const toInfo = (v: any): VoiceInfo => ({ id: v.name, name: v.name, lang: v.lang });
  return {
    speak(text, { lang, rate, voice }) {
      synth.cancel();
      const u = new Utter(text);
      u.lang = lang;
      u.rate = rate;
      u.voice = (voice ? synth.getVoices().find((v: any) => v.name === voice || v.voiceURI === voice) : null) ?? null;
      synth.speak(u);
    },
    stop() { synth.cancel(); },
    async listVoices() {
      let list: any[] = synth.getVoices();
      if (!list.length && synth.addEventListener) {
        await new Promise<void>(res => {
          const t = setTimeout(res, 1000);
          synth.addEventListener('voiceschanged', () => { clearTimeout(t); res(); }, { once: true });
        });
        list = synth.getVoices();
      }
      return list.map(toInfo);
    },
  };
}
