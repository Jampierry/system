import type { Db } from './db/connection';
import type { Config } from './config';

export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
}

export type Deps = {
  db: Db;
  cfg: Config;
  now: () => Date;
  mailer?: Mailer;
};
