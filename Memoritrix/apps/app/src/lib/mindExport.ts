import { nodeSize, visibleNodes, type MindMap } from '@cerebro/shared';

export { nodeSize, NODE_H } from '@cerebro/shared';
const CHAR_W = 7.4;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function mapToSvg(map: MindMap): string {
  const nodes = visibleNodes(map);
  const box = nodes.map(n => ({ n, ...nodeSize(n.text) }));
  const pad = 40;
  const minX = Math.min(...box.map(b => b.n.x - b.w / 2)) - pad;
  const maxX = Math.max(...box.map(b => b.n.x + b.w / 2)) + pad;
  const minY = Math.min(...box.map(b => b.n.y - b.h / 2)) - pad;
  const maxY = Math.max(...box.map(b => b.n.y + b.h / 2)) + pad;
  const w = Math.round(maxX - minX);
  const h = Math.round(maxY - minY);
  const byId = new Map(box.map(b => [b.n.id, b]));

  let edges = '';
  for (const b of box) {
    const p = b.n.parentId ? byId.get(b.n.parentId) : undefined;
    if (!p) continue;
    const mx = (p.n.x + b.n.x) / 2;
    edges += `<path d="M ${p.n.x} ${p.n.y} C ${mx} ${p.n.y}, ${mx} ${b.n.y}, ${b.n.x} ${b.n.y}" fill="none" stroke="#4a4a5e" stroke-width="1.6"/>`;
  }
  let shapes = '';
  for (const b of box) {
    const root = b.n.id === map.rootId;
    const stroke = b.n.color ?? '#5b74f5';
    const max = Math.floor((b.w - 24) / CHAR_W);
    const label = b.n.text.length > max ? b.n.text.slice(0, Math.max(1, max - 1)) + '…' : b.n.text;
    shapes += `<rect x="${b.n.x - b.w / 2}" y="${b.n.y - b.h / 2}" width="${b.w}" height="${b.h}" rx="10" fill="${root ? '#1a2552' : '#15151b'}" stroke="${stroke}" stroke-width="${root ? 2 : 1.5}"/>`;
    shapes += `<text x="${b.n.x}" y="${b.n.y + 4.5}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="${root ? 700 : 500}" fill="#ececf1">${esc(label)}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${minX} ${minY} ${w} ${h}"><rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#0c0c10"/>${edges}${shapes}</svg>`;
}
