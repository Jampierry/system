export type GNode = { id: string };
export type GEdge = { source: string; target: string };
export type Pos = { x: number; y: number };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Fruchterman–Reingold determinístico. Posições centradas em (0,0) dentro de ±width/2 e ±height/2. */
export function layoutGraph(nodes: GNode[], edges: GEdge[], o: { width: number; height: number; iterations?: number }): Record<string, Pos> {
  const n = nodes.length;
  const out: Record<string, Pos> = {};
  if (!n) return out;
  const hw = (o.width / 2) * 0.95;
  const hh = (o.height / 2) * 0.95;
  const pos = nodes.map((nd, i) => {
    const h = hash(nd.id);
    const angle = ((h % 3600) / 3600) * Math.PI * 2 + i * 0.0001;
    const r = 0.25 + ((h >>> 12) % 1000) / 1400;
    return { x: Math.cos(angle) * hw * r, y: Math.sin(angle) * hh * r };
  });
  const index = new Map(nodes.map((nd, i) => [nd.id, i]));
  const es = edges.map(e => [index.get(e.source), index.get(e.target)] as const).filter((e): e is readonly [number, number] => e[0] !== undefined && e[1] !== undefined && e[0] !== e[1]);
  const k = Math.sqrt((o.width * o.height) / n) * 0.55;
  const iters = o.iterations ?? (n > 300 ? 80 : 250);
  const disp = nodes.map(() => ({ x: 0, y: 0 }));

  for (let it = 0; it < iters; it++) {
    const temp = (Math.min(hw, hh) / 5) * (1 - it / iters) + 0.5;
    for (const d of disp) { d.x = 0; d.y = 0; }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        let d = Math.hypot(dx, dy);
        if (d < 0.01) { dx = (i - j) * 0.01; dy = 0.01; d = Math.hypot(dx, dy); }
        const f = (k * k) / d;
        disp[i].x += (dx / d) * f; disp[i].y += (dy / d) * f;
        disp[j].x -= (dx / d) * f; disp[j].y -= (dy / d) * f;
      }
    }
    for (const [a, b] of es) {
      const dx = pos[a].x - pos[b].x;
      const dy = pos[a].y - pos[b].y;
      const d = Math.max(Math.hypot(dx, dy), 0.01);
      const f = (d * d) / k;
      disp[a].x -= (dx / d) * f; disp[a].y -= (dy / d) * f;
      disp[b].x += (dx / d) * f; disp[b].y += (dy / d) * f;
    }
    for (let i = 0; i < n; i++) {
      disp[i].x -= pos[i].x * 0.6; // gravidade leve para o centro
      disp[i].y -= pos[i].y * 0.6;
      const d = Math.max(Math.hypot(disp[i].x, disp[i].y), 0.01);
      const m = Math.min(d, temp);
      pos[i].x = Math.max(-hw, Math.min(hw, pos[i].x + (disp[i].x / d) * m));
      pos[i].y = Math.max(-hh, Math.min(hh, pos[i].y + (disp[i].y / d) * m));
    }
  }
  nodes.forEach((nd, i) => { out[nd.id] = { x: Math.round(pos[i].x * 10) / 10, y: Math.round(pos[i].y * 10) / 10 }; });
  return out;
}
