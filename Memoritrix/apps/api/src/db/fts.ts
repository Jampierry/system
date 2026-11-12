/** Converte texto livre numa consulta FTS5 segura: cada termo vira prefixo entre aspas. */
export function ftsQuery(q: string): string | null {
  const terms = q.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (!terms.length) return null;
  return terms.map(t => `"${t}"*`).join(' ');
}
