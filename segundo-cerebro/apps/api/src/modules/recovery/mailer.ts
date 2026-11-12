import nodemailer from 'nodemailer';
import type { Mailer } from '../../deps';

export class ConsoleMailer implements Mailer {
  async send(to: string, subject: string, text: string): Promise<void> {
    console.log(`[mailer] para=${to} assunto="${subject}"\n${text}`);
  }
}

export class SmtpMailer implements Mailer {
  private tx;
  constructor(url: string, private from = 'Segundo Cérebro <no-reply@localhost>') {
    this.tx = nodemailer.createTransport(url);
  }
  async send(to: string, subject: string, text: string): Promise<void> {
    await this.tx.sendMail({ from: this.from, to, subject, text });
  }
}

export function createMailer(smtpUrl?: string): Mailer {
  return smtpUrl ? new SmtpMailer(smtpUrl) : new ConsoleMailer();
}
