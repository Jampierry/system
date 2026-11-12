export type Config = {
  port: number;
  dbPath: string;
  anthropicKey?: string;
  adminEmail?: string;
  adminPassword?: string;
  smtpUrl?: string;
  webDir?: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const opt = (v?: string) => (v && v.trim() ? v.trim() : undefined);
  return {
    port: Number(env.PORT) || 8787,
    dbPath: opt(env.DB_PATH) ?? './data/cerebro.sqlite',
    anthropicKey: opt(env.ANTHROPIC_API_KEY),
    adminEmail: opt(env.ADMIN_EMAIL),
    adminPassword: opt(env.ADMIN_PASSWORD),
    smtpUrl: opt(env.SMTP_URL),
    webDir: opt(env.WEB_DIR),
  };
}
