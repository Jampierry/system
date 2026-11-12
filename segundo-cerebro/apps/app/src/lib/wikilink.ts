import { rank } from './fuzzy';

/** Se o cursor está dentro de um `[[` ainda aberto na mesma linha, devolve onde começa e o que foi digitado. */
export function activeWikilink(text: string, cursor: number): { start: number; query: string } | null {
  const before = text.slice(0, cursor);
  const start = before.lastIndexOf('[[');
  if (start === -1) return null;
  const query = before.slice(start + 2);
  return /[\]\n|#^]/.test(query) ? null : { start, query };
}

export function suggestTitles(titles: string[], query: string, limit = 8): string[] {
  return rank([...new Set(titles)], query, t => t).slice(0, limit);
}

export function applySuggestion(text: string, cursor: number, title: string): { text: string; cursor: number } {
  const a = activeWikilink(text, cursor);
  if (!a) return { text, cursor };
  const before = text.slice(0, a.start);
  let after = text.slice(cursor);
  if (after.startsWith(']]')) after = after.slice(2);
  return { text: `${before}[[${title}]]${after}`, cursor: before.length + 2 + title.length + 2 };
}
