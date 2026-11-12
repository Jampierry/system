import { describe, it, expect, vi } from 'vitest';
import { cleanForSpeech, speakReply, webSpeechEngine, type SpeechEngine } from './speech';
import { startDictation } from './recognition';

const settings = (replyMode: 'text' | 'audio' | 'both') => ({ replyMode, language: 'pt-BR', rate: 1.25, voice: 'Luciana' as string | null });
const fakeEngine = () => ({ speak: vi.fn(), stop: vi.fn(), listVoices: vi.fn(async () => []) }) satisfies SpeechEngine;

describe('speakReply', () => {
  it('modo "text" não fala', () => {
    const e = fakeEngine();
    expect(speakReply(e, 'Olá!', settings('text'))).toBe(false);
    expect(e.speak).not.toHaveBeenCalled();
  });
  it('modo "both" e "audio" falam com idioma, velocidade e voz das configurações', () => {
    for (const m of ['both', 'audio'] as const) {
      const e = fakeEngine();
      expect(speakReply(e, 'Olá!', settings(m))).toBe(true);
      expect(e.speak).toHaveBeenCalledWith('Olá!', { lang: 'pt-BR', rate: 1.25, voice: 'Luciana' });
    }
  });
  it('sem motor ou sem texto falável, não fala nem quebra', () => {
    expect(speakReply(null, 'Olá', settings('both'))).toBe(false);
    const e = fakeEngine();
    expect(speakReply(e, '   ', settings('both'))).toBe(false);
    expect(speakReply(e, '😀 **' , settings('both'))).toBe(false);
    expect(e.speak).not.toHaveBeenCalled();
  });
});

describe('cleanForSpeech', () => {
  it('remove markdown, links, wikilinks, marcadores e emojis', () => {
    expect(cleanForSpeech('**Oi** [[Nota|apelido]] veja https://x.com/a e `código` 😀\n- item um\n# Título')).toBe('Oi apelido veja e código item um Título');
    expect(cleanForSpeech('Achei «bolo» e [link](http://y.com)')).toBe('Achei bolo e link');
  });
});

describe('webSpeechEngine', () => {
  it('cria o utterance com idioma, velocidade e voz pelo nome; stop cancela', () => {
    const spoken: any[] = [];
    class Utter { constructor(public text: string) {} lang = ''; rate = 1; voice: any = null; }
    const synth = { speak: (u: any) => spoken.push(u), cancel: vi.fn(), getVoices: () => [{ name: 'Luciana', lang: 'pt-BR', voiceURI: 'luciana' }, { name: 'Alex', lang: 'en-US', voiceURI: 'alex' }] };
    const engine = webSpeechEngine({ speechSynthesis: synth, SpeechSynthesisUtterance: Utter })!;
    engine.speak('Oi', { lang: 'pt-BR', rate: 1.5, voice: 'Luciana' });
    expect(spoken[0]).toMatchObject({ text: 'Oi', lang: 'pt-BR', rate: 1.5 });
    expect(spoken[0].voice.name).toBe('Luciana');
    expect(synth.cancel).toHaveBeenCalled(); // corta a fala anterior antes de falar
    engine.stop();
    expect(synth.cancel).toHaveBeenCalledTimes(2);
  });
  it('voz inexistente cai na padrão do idioma; sem API devolve null', () => {
    class Utter { constructor(public text: string) {} lang = ''; rate = 1; voice: any = null; }
    const spoken: any[] = [];
    const synth = { speak: (u: any) => spoken.push(u), cancel: () => {}, getVoices: () => [{ name: 'Joana', lang: 'pt-PT' }] };
    webSpeechEngine({ speechSynthesis: synth, SpeechSynthesisUtterance: Utter })!.speak('x', { lang: 'pt-BR', rate: 1, voice: 'Inexistente' });
    expect(spoken[0].voice).toBeNull();
    expect(webSpeechEngine({})).toBeNull();
  });
  it('listVoices devolve nome e idioma', async () => {
    const synth = { speak() {}, cancel() {}, getVoices: () => [{ name: 'Luciana', lang: 'pt-BR' }] };
    const engine = webSpeechEngine({ speechSynthesis: synth, SpeechSynthesisUtterance: class {} })!;
    expect(await engine.listVoices()).toEqual([{ id: 'Luciana', name: 'Luciana', lang: 'pt-BR' }]);
  });
});

describe('startDictation', () => {
  it('sem SpeechRecognition devolve null', () => {
    expect(startDictation('pt-BR', () => {}, {})).toBeNull();
  });
  it('configura idioma, repassa parcial e final, e stop() para o reconhecimento', () => {
    let inst: any;
    class Rec {
      lang = ''; interimResults = false; continuous = true; onresult: any; onend: any; onerror: any; started = false; stopped = false;
      constructor() { inst = this; }
      start() { this.started = true; } stop() { this.stopped = true; this.onend?.(); }
    }
    const got: [string, boolean][] = [];
    const ended = vi.fn();
    const d = startDictation('pt-BR', (t, f) => got.push([t, f]), { webkitSpeechRecognition: Rec }, ended)!;
    expect(inst.lang).toBe('pt-BR');
    expect(inst.interimResults).toBe(true);
    expect(inst.started).toBe(true);
    inst.onresult({ results: [Object.assign([{ transcript: 'anota comprar' }], { isFinal: false })], resultIndex: 0 });
    inst.onresult({ results: [Object.assign([{ transcript: 'anota comprar pão' }], { isFinal: true })], resultIndex: 0 });
    expect(got).toEqual([['anota comprar', false], ['anota comprar pão', true]]);
    d.stop();
    expect(inst.stopped).toBe(true);
    expect(ended).toHaveBeenCalledTimes(1);
  });
  it('erro de permissão encerra e avisa', () => {
    let inst: any;
    class Rec { lang = ''; start() {} stop() {} constructor() { inst = this; } }
    const ended = vi.fn();
    startDictation('pt-BR', () => {}, { SpeechRecognition: Rec }, ended);
    inst.onerror({ error: 'not-allowed' });
    expect(ended).toHaveBeenCalledWith('not-allowed');
  });
});
