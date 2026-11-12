import { describe, it, expect } from 'vitest';
import {
  createMap, addChild, addSibling, removeNode, moveNode, setText, toggleCollapse, setColor, setLink,
  layoutRadial, visibleNodes, toOutlineMarkdown, fromOutlineMarkdown, mindmapSchema, History, children, subtreeIds,
  type MindMap,
} from './mindmap';

function sample() {
  let m = createMap('Raiz');
  const root = m.rootId;
  let r = addChild(m, root, 'A'); m = r.map; const a = r.id;
  r = addChild(m, root, 'B'); m = r.map; const b = r.id;
  r = addChild(m, a, 'A1'); m = r.map; const a1 = r.id;
  r = addChild(m, a, 'A2'); m = r.map; const a2 = r.id;
  r = addChild(m, a1, 'A1x'); m = r.map; const a1x = r.id;
  return { m, root, a, b, a1, a2, a1x };
}

describe('operações', () => {
  it('createMap cria só a raiz', () => {
    const m = createMap('Tema');
    expect(Object.keys(m.nodes)).toHaveLength(1);
    expect(m.nodes[m.rootId]).toMatchObject({ parentId: null, text: 'Tema' });
  });

  it('addChild liga ao pai e não muta o original', () => {
    const m = createMap('R');
    const { map, id } = addChild(m, m.rootId, 'F');
    expect(Object.keys(m.nodes)).toHaveLength(1);
    expect(map.nodes[id].parentId).toBe(m.rootId);
    expect(children(map, m.rootId).map(n => n.text)).toEqual(['F']);
    expect(() => addChild(m, 'inexistente')).toThrow();
  });

  it('addChild expande pai recolhido', () => {
    const { m, a } = sample();
    const c = toggleCollapse(m, a);
    expect(c.nodes[a].collapsed).toBe(true);
    const { map, id } = addChild(c, a, 'novo');
    expect(map.nodes[a].collapsed).toBeFalsy();
    expect(visibleNodes(map).map(n => n.id)).toContain(id);
  });

  it('addSibling cria irmão; na raiz cria filho', () => {
    const { m, a, root } = sample();
    const r = addSibling(m, a, 'irmão');
    expect(r.map.nodes[r.id].parentId).toBe(root);
    const r2 = addSibling(m, root, 'x');
    expect(r2.map.nodes[r2.id].parentId).toBe(root);
  });

  it('removeNode na raiz lança; remover pai remove descendentes e não deixa órfãos', () => {
    const { m, a, root, a1x } = sample();
    expect(() => removeNode(m, root)).toThrow();
    const r = removeNode(m, a);
    expect(r.nodes[a]).toBeUndefined();
    expect(r.nodes[a1x]).toBeUndefined();
    expect(Object.keys(r.nodes)).toHaveLength(2); // raiz + B
    expect(mindmapSchema.safeParse(r).success).toBe(true);
  });

  it('remover pai recolhido remove o ramo todo', () => {
    const { m, a, a1x } = sample();
    const r = removeNode(toggleCollapse(m, a), a);
    expect(r.nodes[a1x]).toBeUndefined();
    expect(mindmapSchema.safeParse(r).success).toBe(true);
  });

  it('moveNode desloca os descendentes junto', () => {
    const { m, a, a1 } = sample();
    const before = { a: { ...m.nodes[a] }, a1: { ...m.nodes[a1] } };
    const r = moveNode(m, a, before.a.x + 100, before.a.y - 30);
    expect(r.nodes[a1].x - before.a1.x).toBe(100);
    expect(r.nodes[a1].y - before.a1.y).toBe(-30);
  });

  it('setText/setColor/setLink', () => {
    const { m, b } = sample();
    expect(setText(m, b, 'Novo').nodes[b].text).toBe('Novo');
    expect(setColor(m, b, '#ff0000').nodes[b].color).toBe('#ff0000');
    expect(setLink(m, b, { noteId: 'n1' }).nodes[b].noteId).toBe('n1');
  });

  it('visibleNodes esconde filhos de nó recolhido (mas mostra o nó)', () => {
    const { m, a, a1, a2, a1x } = sample();
    const ids = visibleNodes(toggleCollapse(m, a)).map(n => n.id);
    expect(ids).toContain(a);
    for (const hidden of [a1, a2, a1x]) expect(ids).not.toContain(hidden);
  });

  it('subtreeIds inclui o nó e descendentes', () => {
    const { m, a, a1, a2, a1x } = sample();
    expect(subtreeIds(m, a).sort()).toEqual([a, a1, a2, a1x].sort());
  });
});

describe('layout radial', () => {
  it('não sobrepõe nós do mesmo nível, mesmo em árvore grande', () => {
    let m = createMap('R');
    const root = m.rootId;
    for (let i = 0; i < 12; i++) {
      const r = addChild(m, root, `F${i}`); m = r.map;
      for (let j = 0; j < 8; j++) m = addChild(m, r.id, `N${i}.${j}`).map;
    }
    const l = layoutRadial(m);
    const depth = (id: string): number => (l.nodes[id].parentId ? 1 + depth(l.nodes[id].parentId!) : 0);
    const nodes = Object.values(l.nodes);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (depth(nodes[i].id) !== depth(nodes[j].id)) continue;
        expect(Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)).toBeGreaterThanOrEqual(40);
      }
    }
    expect(l.nodes[root]).toMatchObject({ x: 0, y: 0 });
  });
});

describe('outline', () => {
  it('ida e volta preserva hierarquia e texto', () => {
    const { m } = sample();
    const md = toOutlineMarkdown(m);
    expect(md).toBe('# Raiz\n- A\n  - A1\n    - A1x\n  - A2\n- B\n');
    const back = fromOutlineMarkdown(md);
    expect(toOutlineMarkdown(back)).toBe(md);
    expect(mindmapSchema.safeParse(back).success).toBe(true);
  });

  it('aceita saltos de nível e linhas sem marcador sem quebrar', () => {
    const back = fromOutlineMarkdown('# T\n- a\n      - fundo demais\n* b\ntexto solto\n');
    expect(mindmapSchema.safeParse(back).success).toBe(true);
    expect(Object.values(back.nodes).map(n => n.text)).toEqual(['T', 'a', 'fundo demais', 'b', 'texto solto']);
  });

  it('markdown vazio vira mapa com raiz padrão', () => {
    const m = fromOutlineMarkdown('');
    expect(Object.keys(m.nodes)).toHaveLength(1);
  });
});

describe('mindmapSchema', () => {
  const ok = (): MindMap => sample().m;
  it('aceita mapa válido', () => expect(mindmapSchema.safeParse(ok()).success).toBe(true));
  it('rejeita ciclo', () => {
    const m = ok();
    const [a, b] = Object.keys(m.nodes).filter(id => id !== m.rootId);
    m.nodes[a] = { ...m.nodes[a], parentId: b };
    m.nodes[b] = { ...m.nodes[b], parentId: a };
    expect(mindmapSchema.safeParse(m).success).toBe(false);
  });
  it('rejeita nó órfão (pai inexistente) e raiz com pai', () => {
    const m = ok();
    const id = Object.keys(m.nodes).find(i => i !== m.rootId)!;
    expect(mindmapSchema.safeParse({ ...m, nodes: { ...m.nodes, [id]: { ...m.nodes[id], parentId: 'fantasma' } } }).success).toBe(false);
    expect(mindmapSchema.safeParse({ ...m, nodes: { ...m.nodes, [m.rootId]: { ...m.nodes[m.rootId], parentId: id } } }).success).toBe(false);
  });
  it('rejeita raiz inexistente, chave ≠ id, segunda raiz, coordenada não finita e texto gigante', () => {
    const m = ok();
    expect(mindmapSchema.safeParse({ ...m, rootId: 'x' }).success).toBe(false);
    const id = Object.keys(m.nodes).find(i => i !== m.rootId)!;
    expect(mindmapSchema.safeParse({ ...m, nodes: { ...m.nodes, [id]: { ...m.nodes[id], id: 'outro' } } }).success).toBe(false);
    expect(mindmapSchema.safeParse({ ...m, nodes: { ...m.nodes, [id]: { ...m.nodes[id], parentId: null } } }).success).toBe(false);
    expect(mindmapSchema.safeParse({ ...m, nodes: { ...m.nodes, [id]: { ...m.nodes[id], x: Infinity } } }).success).toBe(false);
    expect(mindmapSchema.safeParse({ ...m, nodes: { ...m.nodes, [id]: { ...m.nodes[id], text: 'x'.repeat(501) } } }).success).toBe(false);
    expect(mindmapSchema.safeParse('lixo').success).toBe(false);
  });
});

describe('History', () => {
  it('undo/redo e descarte do redo ao empilhar', () => {
    const h = new History<string>();
    h.push('A'); h.push('B'); h.push('C');
    expect(h.undo()).toBe('B');
    expect(h.undo()).toBe('A');
    expect(h.undo()).toBeUndefined();
    expect(h.redo()).toBe('B');
    h.push('D');
    expect(h.redo()).toBeUndefined();
    expect(h.undo()).toBe('B');
  });
  it('limita o tamanho', () => {
    const h = new History<number>(3);
    for (let i = 0; i < 10; i++) h.push(i);
    expect(h.undo()).toBe(8);
    expect(h.undo()).toBe(7);
    expect(h.undo()).toBeUndefined();
  });
});
