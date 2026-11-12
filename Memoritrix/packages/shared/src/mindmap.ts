import { z } from 'zod';

export type MindNode = {
  id: string;
  parentId: string | null;
  text: string;
  x: number;
  y: number;
  color?: string;
  collapsed?: boolean;
  noteId?: string;
  itemId?: string;
};
export type MindMap = { rootId: string; nodes: Record<string, MindNode> };

export const MAX_NODES = 2000;
const MAX_COORD = 1_000_000;

const nodeSchema = z.object({
  id: z.string().min(1).max(64),
  parentId: z.string().min(1).max(64).nullable(),
  text: z.string().max(500),
  x: z.number().finite().min(-MAX_COORD).max(MAX_COORD),
  y: z.number().finite().min(-MAX_COORD).max(MAX_COORD),
  color: z.string().max(32).optional(),
  collapsed: z.boolean().optional(),
  noteId: z.string().max(64).optional(),
  itemId: z.string().max(64).optional(),
});

export const mindmapSchema: z.ZodType<MindMap> = z
  .object({ rootId: z.string().min(1), nodes: z.record(nodeSchema) })
  .superRefine((m, ctx) => {
    const bad = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    const ids = Object.keys(m.nodes);
    if (ids.length > MAX_NODES) return bad(`Mapa com mais de ${MAX_NODES} nós`);
    const root = m.nodes[m.rootId];
    if (!root) return bad('Raiz inexistente');
    if (root.parentId !== null) return bad('A raiz não pode ter pai');
    for (const [key, n] of Object.entries(m.nodes)) {
      if (n.id !== key) return bad(`Nó ${key} com id divergente`);
      if (key !== m.rootId && (n.parentId === null || !m.nodes[n.parentId])) return bad(`Nó ${key} sem pai válido`);
    }
    for (const id of ids) {
      let cur: MindNode | undefined = m.nodes[id];
      for (let steps = 0; cur && cur.id !== m.rootId; steps++) {
        if (steps > ids.length) return bad('Ciclo detectado');
        cur = cur.parentId ? m.nodes[cur.parentId] : undefined;
      }
    }
  }) as z.ZodType<MindMap>;

export function newId(): string {
  const c = (globalThis as any).crypto;
  return c?.randomUUID ? c.randomUUID() : 'n' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const children = (m: MindMap, id: string): MindNode[] => Object.values(m.nodes).filter(n => n.parentId === id);

export function subtreeIds(m: MindMap, id: string): string[] {
  const out: string[] = [];
  const walk = (i: string) => {
    out.push(i);
    for (const c of children(m, i)) walk(c.id);
  };
  if (m.nodes[id]) walk(id);
  return out;
}

const need = (m: MindMap, id: string): MindNode => m.nodes[id] ?? (() => { throw new Error(`Nó inexistente: ${id}`); })();
const patch = (m: MindMap, id: string, p: Partial<MindNode>): MindMap => ({ ...m, nodes: { ...m.nodes, [id]: { ...need(m, id), ...p } } });

export function createMap(title: string): MindMap {
  const id = newId();
  return { rootId: id, nodes: { [id]: { id, parentId: null, text: title, x: 0, y: 0 } } };
}

export function addChild(m: MindMap, parentId: string, text = 'Novo nó'): { map: MindMap; id: string } {
  const parent = need(m, parentId);
  const id = newId();
  const count = children(m, parentId).length;
  const node: MindNode = { id, parentId, text, x: parent.x + 180, y: parent.y + count * 56 };
  const nodes = { ...m.nodes, [id]: node, [parentId]: { ...parent, collapsed: false } };
  return { map: { ...m, nodes }, id };
}

export function addSibling(m: MindMap, id: string, text = 'Novo nó'): { map: MindMap; id: string } {
  const n = need(m, id);
  return addChild(m, n.parentId ?? id, text);
}

export function removeNode(m: MindMap, id: string): MindMap {
  if (id === m.rootId) throw new Error('A raiz não pode ser removida');
  need(m, id);
  const drop = new Set(subtreeIds(m, id));
  return { ...m, nodes: Object.fromEntries(Object.entries(m.nodes).filter(([k]) => !drop.has(k))) };
}

export function moveNode(m: MindMap, id: string, x: number, y: number): MindMap {
  const n = need(m, id);
  const dx = x - n.x;
  const dy = y - n.y;
  const nodes = { ...m.nodes };
  for (const i of subtreeIds(m, id)) nodes[i] = { ...nodes[i], x: nodes[i].x + dx, y: nodes[i].y + dy };
  return { ...m, nodes };
}

export const setText = (m: MindMap, id: string, text: string): MindMap => patch(m, id, { text });
export const setColor = (m: MindMap, id: string, color: string | undefined): MindMap => patch(m, id, { color });
export const setLink = (m: MindMap, id: string, link: { noteId?: string; itemId?: string }): MindMap => patch(m, id, { noteId: link.noteId, itemId: link.itemId });
export const toggleCollapse = (m: MindMap, id: string): MindMap => patch(m, id, { collapsed: !need(m, id).collapsed });

export function visibleNodes(m: MindMap): MindNode[] {
  const out: MindNode[] = [];
  const walk = (id: string) => {
    const n = m.nodes[id];
    out.push(n);
    if (!n.collapsed) for (const c of children(m, id)) walk(c.id);
  };
  if (m.nodes[m.rootId]) walk(m.rootId);
  return out;
}

const CHAR_W = 7.4;
export const NODE_H = 36;

/** Tamanho estimado do retângulo de um nó a partir do texto (usado no layout, no canvas e na exportação). */
export function nodeSize(text: string): { w: number; h: number } {
  return { w: Math.max(70, Math.min(260, Math.round(text.length * CHAR_W + 32))), h: NODE_H };
}

const MIN_GAP_PX = 44;
const RING_STEP = 170;

/** Layout radial: ângulo proporcional ao número de folhas; raio por nível cresce até evitar sobreposição. */
export function layoutRadial(m: MindMap): MindMap {
  const kids = new Map<string, MindNode[]>();
  for (const n of Object.values(m.nodes)) if (n.parentId) kids.set(n.parentId, [...(kids.get(n.parentId) ?? []), n]);
  const leaves = new Map<string, number>();
  const countLeaves = (id: string): number => {
    const k = kids.get(id) ?? [];
    const v = k.length ? k.reduce((s, c) => s + countLeaves(c.id), 0) : 1;
    leaves.set(id, v);
    return v;
  };
  countLeaves(m.rootId);

  const angle = new Map<string, number>();
  const depthOf = new Map<string, number>();
  const place = (id: string, a0: number, a1: number, depth: number) => {
    angle.set(id, (a0 + a1) / 2);
    depthOf.set(id, depth);
    const k = kids.get(id) ?? [];
    const total = k.reduce((s, c) => s + leaves.get(c.id)!, 0);
    let cur = a0;
    for (const c of k) {
      const span = ((a1 - a0) * leaves.get(c.id)!) / total;
      place(c.id, cur, cur + span, depth + 1);
      cur += span;
    }
  };
  place(m.rootId, -Math.PI / 2, (3 * Math.PI) / 2, 0);

  const byDepth = new Map<number, string[]>();
  for (const [id, d] of depthOf) if (d > 0) byDepth.set(d, [...(byDepth.get(d) ?? []), id]);
  const radius = new Map<number, number>([[0, 0]]);
  for (const d of [...byDepth.keys()].sort((a, b) => a - b)) {
    const as = byDepth.get(d)!.map(id => angle.get(id)!).sort((a, b) => a - b);
    let gap = 2 * Math.PI;
    for (let i = 0; i < as.length; i++) {
      const next = i === as.length - 1 ? as[0] + 2 * Math.PI : as[i + 1];
      if (as.length > 1) gap = Math.min(gap, next - as[i]);
    }
    const need = MIN_GAP_PX / (2 * Math.sin(Math.min(gap, Math.PI) / 2));
    radius.set(d, Math.max(radius.get(d - 1)! + RING_STEP, need));
  }

  const nodes: Record<string, MindNode> = {};
  for (const n of Object.values(m.nodes)) {
    const d = depthOf.get(n.id) ?? 0;
    const r = radius.get(d) ?? 0;
    const a = angle.get(n.id) ?? 0;
    nodes[n.id] = { ...n, x: d === 0 ? 0 : Math.round(r * Math.cos(a)), y: d === 0 ? 0 : Math.round(r * Math.sin(a)) };
  }
  separateBoxes(Object.values(nodes), m.rootId);
  return { ...m, nodes };
}

/** Afasta nós cujos retângulos se sobrepõem (a raiz fica fixa). Relaxamento simples, limitado em tamanho. */
function separateBoxes(list: MindNode[], rootId: string): void {
  if (list.length < 2 || list.length > 600) return;
  const PAD = 14;
  const size = list.map(n => nodeSize(n.text));
  for (let iter = 0; iter < 300; iter++) {
    let moved = false;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]; const b = list[j];
        const dx = b.x - a.x; const dy = b.y - a.y;
        const ox = (size[i].w + size[j].w) / 2 + PAD - Math.abs(dx);
        const oy = (size[i].h + size[j].h) / 2 + PAD - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        const horizontal = ox < oy;
        const sign = (horizontal ? dx : dy) >= 0 ? 1 : -1;
        const push = (horizontal ? ox : oy) / 2 + 0.5;
        const fixA = a.id === rootId; const fixB = b.id === rootId;
        const ka = fixA ? 0 : fixB ? 2 : 1; const kb = fixB ? 0 : fixA ? 2 : 1;
        if (horizontal) { a.x -= sign * push * ka; b.x += sign * push * kb; }
        else { a.y -= sign * push * ka; b.y += sign * push * kb; }
      }
    }
    if (!moved) break;
  }
  for (const n of list) { n.x = Math.round(n.x); n.y = Math.round(n.y); }
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

export function toOutlineMarkdown(m: MindMap): string {
  let out = `# ${oneLine(m.nodes[m.rootId].text)}\n`;
  const walk = (id: string, depth: number) => {
    for (const c of children(m, id)) {
      out += `${'  '.repeat(depth - 1)}- ${oneLine(c.text)}\n`;
      walk(c.id, depth + 1);
    }
  };
  walk(m.rootId, 1);
  return out;
}

export function fromOutlineMarkdown(md: string, defaultTitle = 'Mapa mental'): MindMap {
  const lines = md.split(/\r?\n/).filter(l => l.trim() !== '');
  let title = defaultTitle;
  if (lines.length && /^#\s+\S/.test(lines[0])) title = oneLine(lines.shift()!.replace(/^#\s+/, ''));
  let map = createMap(title);
  const stack: string[] = [map.rootId];
  let base = 0;
  for (const line of lines) {
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    const li = /^([ \t]*)(?:[-*+]|\d+\.)\s+(.*)$/.exec(line);
    let depth: number;
    let text: string;
    if (h) {
      depth = Math.max(1, h[1].length - 1);
      base = depth;
      text = h[2];
    } else if (li) {
      const indent = li[1].replace(/\t/g, '  ').length;
      depth = base + 1 + Math.floor(indent / 2);
      text = li[2];
    } else {
      depth = 1;
      text = line;
    }
    text = oneLine(text).slice(0, 500);
    if (!text) continue;
    depth = Math.min(depth, stack.length);
    const r = addChild(map, stack[depth - 1], text);
    map = r.map;
    stack.length = depth;
    stack.push(r.id);
  }
  return layoutRadial(map);
}

export class History<T> {
  private items: T[] = [];
  private idx = -1;
  constructor(private limit = 100) {}
  push(s: T): void {
    this.items = this.items.slice(0, this.idx + 1);
    this.items.push(s);
    if (this.items.length > this.limit) this.items.shift();
    this.idx = this.items.length - 1;
  }
  undo(): T | undefined {
    if (this.idx <= 0) return undefined;
    return this.items[--this.idx];
  }
  redo(): T | undefined {
    if (this.idx >= this.items.length - 1) return undefined;
    return this.items[++this.idx];
  }
  get canUndo(): boolean { return this.idx > 0; }
  get canRedo(): boolean { return this.idx < this.items.length - 1; }
}
