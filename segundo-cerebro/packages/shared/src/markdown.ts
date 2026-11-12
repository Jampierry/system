export type ParsedNote = {
  frontmatter: Record<string, unknown>;
  links: { target: string; alias?: string }[];
  tags: string[];
  headings: { level: number; text: string }[];
};

/** Substitui código (cercado e inline) por espaços, preservando posições e quebras de linha. */
export function maskCode(md: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  const lines = md.split('\n');
  let fence: { ch: string; len: number } | null = null;
  const out = lines.map(line => {
    const m = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (m && m[1][0] === fence.ch && m[1].length >= fence.len && /^ {0,3}[`~]+\s*$/.test(line)) fence = null;
      return blank(line);
    }
    if (m) {
      fence = { ch: m[1][0], len: m[1].length };
      return blank(line);
    }
    return line;
  });
  return out.join('\n').replace(/(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g, s => blank(s));
}

function scalar(v: string): unknown {
  const t = v.trim();
  if (/^(true|false)$/i.test(t)) return t.toLowerCase() === 'true';
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t.replace(/^(["'])(.*)\1$/, '$2');
}

function splitFrontmatter(md: string): { fm: string | null; body: string } {
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(md);
  return m ? { fm: m[1], body: md.slice(m[0].length) } : { fm: null, body: md };
}

function parseFrontmatter(src: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const [, key, raw] = m;
    if (raw === '') {
      const list: unknown[] = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) list.push(scalar(lines[++i].replace(/^\s*-\s+/, '')));
      if (list.length) out[key] = list;
    } else if (raw.startsWith('[') && raw.endsWith(']')) {
      out[key] = raw.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean).map(scalar);
    } else {
      out[key] = scalar(raw);
    }
  }
  return out;
}

const LINK_RE = /!?\[\[([^\[\]\n]*?)\]\]/g;

function splitTarget(inner: string): { target: string; alias?: string; rest: string } {
  const bar = inner.indexOf('|');
  const head = bar === -1 ? inner : inner.slice(0, bar);
  const alias = bar === -1 ? undefined : inner.slice(bar + 1).trim() || undefined;
  const cut = head.search(/[#^]/);
  return { target: (cut === -1 ? head : head.slice(0, cut)).trim(), alias, rest: cut === -1 ? '' : head.slice(cut) };
}

export function parseNote(md: string): ParsedNote {
  const { fm, body } = splitFrontmatter(md);
  const frontmatter = fm === null ? {} : parseFrontmatter(fm);
  const text = maskCode(body);

  const links: ParsedNote['links'] = [];
  for (const m of text.matchAll(LINK_RE)) {
    const { target, alias } = splitTarget(m[1]);
    if (target) links.push(alias ? { target, alias } : { target });
  }

  const tags = new Set<string>();
  for (const m of text.matchAll(/(?<=^|[\s(])#([\p{L}\p{N}_/-]+)/gmu)) {
    if (/\p{L}|_/u.test(m[1])) tags.add(m[1].toLowerCase());
  }
  const fmTags = frontmatter.tags;
  const fmList = Array.isArray(fmTags) ? fmTags : typeof fmTags === 'string' ? fmTags.split(/[,\s]+/) : [];
  for (const t of fmList) {
    const s = String(t).replace(/^#/, '').trim().toLowerCase();
    if (s) tags.add(s);
  }

  const headings: ParsedNote['headings'] = [];
  for (const line of text.split('\n')) {
    const h = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*$/.exec(line);
    if (h) headings.push({ level: h[1].length, text: h[2].replace(/[ \t]+#+$/, '').trim() });
  }
  return { frontmatter, links, tags: [...tags], headings };
}

/** Reescreve [[Antigo]] → [[Novo]] (preservando alias e seção), ignorando código. */
export function renameWikilinks(md: string, oldTitle: string, newTitle: string): string {
  const masked = maskCode(md);
  let out = '';
  let last = 0;
  for (const m of masked.matchAll(LINK_RE)) {
    const start = m.index! + (m[0].startsWith('!') ? 3 : 2);
    const { target } = splitTarget(m[1]);
    if (target.toLowerCase() !== oldTitle.trim().toLowerCase()) continue;
    const original = md.slice(start, start + m[1].length);
    const bar = original.indexOf('|');
    const head = bar === -1 ? original : original.slice(0, bar);
    const tail = bar === -1 ? '' : original.slice(bar);
    const cut = head.search(/[#^]/);
    out += md.slice(last, start) + newTitle + (cut === -1 ? '' : head.slice(cut)) + tail;
    last = start + m[1].length;
  }
  return out + md.slice(last);
}
