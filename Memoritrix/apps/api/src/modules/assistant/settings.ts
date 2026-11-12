import { z } from 'zod';
import type { Deps } from '../../deps';

export const settingsSchema = z.object({
  voice: z.string().max(100).nullable(),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Idioma inválido (ex.: pt-BR)'),
  rate: z.number().min(0.5).max(2),
  tone: z.enum(['conciso', 'detalhado', 'informal', 'formal']),
  replyMode: z.enum(['text', 'audio', 'both']),
});
export type AssistantSettings = z.infer<typeof settingsSchema>;

export const DEFAULTS: AssistantSettings = { voice: null, language: 'pt-BR', rate: 1, tone: 'conciso', replyMode: 'both' };

export function getSettings(deps: Deps, userId: string): AssistantSettings {
  const r = deps.db.prepare('select * from assistant_settings where user_id=?').get(userId) as any;
  return r ? { voice: r.voice ?? null, language: r.language, rate: r.rate, tone: r.tone, replyMode: r.reply_mode } : { ...DEFAULTS };
}

export function saveSettings(deps: Deps, userId: string, patch: Partial<AssistantSettings>): AssistantSettings {
  const s = settingsSchema.parse({ ...getSettings(deps, userId), ...patch });
  deps.db.prepare(
    `insert into assistant_settings(user_id,voice,language,rate,tone,reply_mode) values(?,?,?,?,?,?)
     on conflict(user_id) do update set voice=excluded.voice, language=excluded.language, rate=excluded.rate, tone=excluded.tone, reply_mode=excluded.reply_mode`,
  ).run(userId, s.voice, s.language, s.rate, s.tone, s.replyMode);
  return s;
}

export function buildSystem(s: AssistantSettings, userName: string, now: Date): string {
  const lines = [
    `Você é o assistente do "Memoritrix" ("Seu segundo cérebro em ação") de ${userName}: um app de agenda, tarefas (GTD), notas ligadas e mapas mentais.`,
    `Hoje é ${now.toISOString().slice(0, 10)}. Responda em ${s.language}. Tom das respostas: ${s.tone}.`,
    'Use as ferramentas para registrar tarefas, notas, eventos e mapas quando o usuário pedir, e confirme brevemente o que foi feito.',
    'Não invente informações do usuário: busque nas notas e itens antes de afirmar algo.',
  ];
  if (s.replyMode !== 'text') lines.push('Suas respostas serão lidas em voz alta: use frases curtas, sem markdown, listas ou emojis.');
  return lines.join('\n');
}
