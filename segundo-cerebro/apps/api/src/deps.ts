import type { Db } from './db/connection';
import type { Config } from './config';
import type { AiProvider } from './ai/provider';

export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
}

export type Deps = {
  db: Db;
  cfg: Config;
  now: () => Date;
  mailer?: Mailer;
  /** Provider de IA injetado (testes); por padrão é escolhido pela config. */
  ai?: AiProvider;
  /** Tempo máximo de uma resposta da IA antes do fallback (ms). */
  aiTimeoutMs?: number;
};
