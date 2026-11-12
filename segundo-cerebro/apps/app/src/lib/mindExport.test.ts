import { describe, it, expect } from 'vitest';
import { addChild, createMap, toggleCollapse, setText } from '@cerebro/shared';
import { mapToSvg, nodeSize } from './mindExport';

describe('nodeSize', () => {
  it('cresce com o texto, com mínimo e máximo', () => {
    expect(nodeSize('a').w).toBe(70);
    expect(nodeSize('texto médio de exemplo').w).toBeGreaterThan(70);
    expect(nodeSize('x'.repeat(200)).w).toBe(260);
    expect(nodeSize('a').h).toBeGreaterThan(20);
  });
});

describe('mapToSvg', () => {
  it('gera um SVG com nós, arestas e viewBox cobrindo tudo', () => {
    let m = createMap('Raiz');
    const a = addChild(m, m.rootId, 'Filho A'); m = a.map;
    m = addChild(m, m.rootId, 'Filho B').map;
    const svg = mapToSvg(m);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    for (const t of ['Raiz', 'Filho A', 'Filho B']) expect(svg).toContain(t);
    expect((svg.match(/<path /g) ?? []).length).toBe(2);
    const vb = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg)!;
    expect(Number(vb[3])).toBeGreaterThan(0);
    expect(Number(vb[4])).toBeGreaterThan(0);
  });
  it('escapa caracteres especiais do XML', () => {
    let m = createMap('A & B <script>"x"');
    m = setText(m, m.rootId, 'A & B <script>"x"');
    const svg = mapToSvg(m);
    expect(svg).toContain('A &amp; B &lt;script&gt;&quot;x&quot;');
    expect(svg).not.toContain('<script>');
  });
  it('não exporta descendentes de nós recolhidos', () => {
    let m = createMap('R');
    const a = addChild(m, m.rootId, 'A'); m = a.map;
    m = addChild(m, a.id, 'Escondido').map;
    m = toggleCollapse(m, a.id);
    expect(mapToSvg(m)).not.toContain('Escondido');
  });
  it('cor do nó entra no traço', () => {
    const m = createMap('R');
    m.nodes[m.rootId] = { ...m.nodes[m.rootId], color: '#ff0000' };
    expect(mapToSvg(m)).toContain('#ff0000');
  });
});
