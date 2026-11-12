const DAY = 86400_000;

/** Próxima ocorrência (UTC) depois de `after`, ou null se a regra for desconhecida. */
export function nextOccurrence(rule: string, after: Date): Date | null {
  switch (rule) {
    case 'daily':
      return new Date(after.getTime() + DAY);
    case 'weekly':
      return new Date(after.getTime() + 7 * DAY);
    case 'weekdays': {
      let d = new Date(after.getTime() + DAY);
      while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = new Date(d.getTime() + DAY);
      return d;
    }
    case 'monthly': {
      const y = after.getUTCFullYear();
      const m = after.getUTCMonth() + 1;
      const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const d = new Date(after.getTime());
      d.setUTCDate(1);
      d.setUTCMonth(m);
      d.setUTCDate(Math.min(after.getUTCDate(), lastDay));
      return d;
    }
    default:
      return null;
  }
}
