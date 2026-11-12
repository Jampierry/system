const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Pontuação de relevância (maior = melhor) ou null se não casar. Ignora caixa e acentos. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = norm(query).trim();
  const t = norm(text);
  if (!q) return 0;
  if (t.startsWith(q)) return 100;
  const idx = t.indexOf(q);
  if (idx >= 0) return idx === 0 || /[\s\-_/]/.test(t[idx - 1]) ? 80 : 60;
  let ti = 0;
  let first = -1;
  let last = -1;
  for (const ch of q) {
    ti = t.indexOf(ch, ti);
    if (ti === -1) return null;
    if (first === -1) first = ti;
    last = ti++;
  }
  return Math.max(1, 40 - (last - first + 1 - q.length));
}

/** Filtra e ordena por relevância; empate → texto mais curto → ordem original. Consulta vazia mantém tudo. */
export function rank<T>(items: T[], query: string, text: (t: T) => string): T[] {
  if (!query.trim()) return [...items];
  return items
    .map((it, i) => ({ it, i, s: fuzzyScore(query, text(it)), len: text(it).length }))
    .filter((x): x is typeof x & { s: number } => x.s !== null)
    .sort((a, b) => b.s - a.s || a.len - b.len || a.i - b.i)
    .map(x => x.it);
}
