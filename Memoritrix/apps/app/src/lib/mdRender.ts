import { parseNote, stripFrontmatter } from '@cerebro/shared';

export type Inline = { t: 'text' | 'bold' | 'italic' | 'code' | 'wikilink' | 'tag' | 'link'; text: string; target?: string; href?: string };
export type ListItem = { inlines: Inline[]; checked?: boolean; depth: number };
export type Block =
  | { t: 'h'; level: number; inlines: Inline[] }
  | { t: 'p'; inlines: Inline[] }
  | { t: 'quote'; inlines: Inline[] }
  | { t: 'ul' | 'ol'; items: ListItem[] }
  | { t: 'code'; text: string; lang?: string }
  | { t: 'hr' }
  | { t: 'props'; entries: [string, string][] };

const INLINE_RE = /(`+)([^`]+?)\1|!?\[\[([^\[\]\n]+)\]\]|\*\*([^*]+)\*\*|\*([^*\n]+)\*|\[([^\]\n]+)\]\(([^)\s]+)\)|(?<=^|[\s(])(#[\p{L}\p{N}_/-]+)/gu;

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last?.t === 'text') last.text += text; else out.push({ t: 'text', text });
  };
  let last = 0;
  for (const m of s.matchAll(INLINE_RE)) {
    pushText(s.slice(last, m.index));
    last = m.index! + m[0].length;
    if (m[2] !== undefined) out.push({ t: 'code', text: m[2] });
    else if (m[3] !== undefined) {
      const bar = m[3].indexOf('|');
      const head = bar === -1 ? m[3] : m[3].slice(0, bar);
      const alias = bar === -1 ? undefined : m[3].slice(bar + 1).trim();
      const target = head.split(/[#^]/)[0].trim();
      if (!target) pushText(m[0]); else out.push({ t: 'wikilink', text: alias || head.trim(), target });
    }
    else if (m[4] !== undefined) out.push({ t: 'bold', text: m[4] });
    else if (m[5] !== undefined) out.push({ t: 'italic', text: m[5] });
    else if (m[6] !== undefined) out.push({ t: 'link', text: m[6], href: m[7] });
    else if (m[8] !== undefined) { if (/\p{L}|_/u.test(m[8])) out.push({ t: 'tag', text: m[8] }); else pushText(m[0]); }
  }
  pushText(s.slice(last));
  return out;
}

const HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const LIST = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;

export function parseBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  const fm = md.startsWith('---') ? parseNote(md).frontmatter : {};
  const body = stripFrontmatter(md);
  if (Object.keys(fm).length) {
    blocks.push({ t: 'props', entries: Object.entries(fm).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)]) });
  }
  const lines = body.split(/\r?\n/);
  let para: string[] = [];
  const flush = () => { if (para.length) { blocks.push({ t: 'p', inlines: parseInline(para.join(' ')) }); para = []; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^ {0,3}(`{3,}|~{3,})\s*([\w-]*)/.exec(line);
    if (fence) {
      flush();
      const code: string[] = [];
      for (i++; i < lines.length && !new RegExp(`^ {0,3}${fence[1][0]}{${fence[1].length},}\\s*$`).test(lines[i]); i++) code.push(lines[i]);
      blocks.push({ t: 'code', text: code.join('\n'), ...(fence[2] ? { lang: fence[2] } : {}) });
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) { flush(); blocks.push({ t: 'h', level: h[1].length, inlines: parseInline(h[2]) }); continue; }
    if (HR.test(line)) { flush(); blocks.push({ t: 'hr' }); continue; }
    if (/^\s*>/.test(line)) {
      flush();
      const q: string[] = [line.replace(/^\s*>\s?/, '')];
      while (i + 1 < lines.length && /^\s*>/.test(lines[i + 1])) q.push(lines[++i].replace(/^\s*>\s?/, ''));
      blocks.push({ t: 'quote', inlines: parseInline(q.join(' ')) });
      continue;
    }
    const li = LIST.exec(line);
    if (li) {
      flush();
      const kind: 'ul' | 'ol' = /\d/.test(li[2]) ? 'ol' : 'ul';
      const items: ListItem[] = [];
      for (let cur: RegExpExecArray | null = li; cur; cur = i + 1 < lines.length ? LIST.exec(lines[i + 1]) : null) {
        const depth = Math.floor(cur[1].replace(/\t/g, '  ').length / 2);
        const isNested = depth > 0;
        if (!isNested && (/\d/.test(cur[2]) ? 'ol' : 'ul') !== kind) break;
        const task = /^\[( |x|X)\]\s+(.*)$/.exec(cur[3]);
        items.push({ inlines: parseInline(task ? task[2] : cur[3]), depth, ...(task ? { checked: task[1] !== ' ' } : {}) });
        if (cur !== li) i++;
      }
      blocks.push({ t: kind, items });
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}
