import { describe, it, expect } from 'vitest';
import { layoutGraph } from './graphLayout';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const nodes = ['a', 'b', 'c', 'x', 'y', 'z', 'solo'].map(id => ({ id }));
const edges = [['a', 'b'], ['b', 'c'], ['c', 'a'], ['x', 'y'], ['y', 'z'], ['z', 'x']].map(([source, target]) => ({ source, target }));

describe('layoutGraph', () => {
  it('é determinístico e finito, dentro dos limites', () => {
    const p1 = layoutGraph(nodes, edges, { width: 800, height: 600 });
    const p2 = layoutGraph(nodes, edges, { width: 800, height: 600 });
    expect(p1).toEqual(p2);
    for (const n of nodes) {
      const p = p1[n.id];
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(400);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(300);
    }
  });
  it('nós ligados ficam mais próximos que nós de grupos diferentes', () => {
    const p = layoutGraph(nodes, edges, { width: 800, height: 600 });
    const intra = (dist(p.a, p.b) + dist(p.b, p.c) + dist(p.x, p.y) + dist(p.y, p.z)) / 4;
    const inter = (dist(p.a, p.x) + dist(p.b, p.y) + dist(p.c, p.z) + dist(p.a, p.z)) / 4;
    expect(intra).toBeLessThan(inter);
  });
  it('nós distintos não coincidem; grafo vazio e aresta para nó inexistente são tolerados', () => {
    const p = layoutGraph(nodes, edges, { width: 800, height: 600 });
    const list = Object.values(p);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) expect(dist(list[i], list[j])).toBeGreaterThan(1);
    expect(layoutGraph([], [], { width: 100, height: 100 })).toEqual({});
    expect(() => layoutGraph([{ id: 'a' }], [{ source: 'a', target: 'fantasma' }], { width: 100, height: 100 })).not.toThrow();
    expect(layoutGraph([{ id: 'a' }], [], { width: 100, height: 100 }).a).toBeDefined();
  });
});
