import { describe, it, expect } from 'vitest';
import { addChild, createMap, children, visibleNodes } from '@cerebro/shared';
import { MindEditorCore, keyToAction } from './mindEditor';

const make = () => {
  const m = createMap('Raiz');
  const c = new MindEditorCore(m);
  return { c, root: m.rootId };
};

describe('keyToAction', () => {
  it('mapeia atalhos', () => {
    expect(keyToAction('Tab', {})).toBe('child');
    expect(keyToAction('Enter', {})).toBe('sibling');
    expect(keyToAction('Delete', {})).toBe('remove');
    expect(keyToAction('Backspace', {})).toBe('remove');
    expect(keyToAction('F2', {})).toBe('edit');
    expect(keyToAction(' ', {})).toBe('toggle');
    expect(keyToAction('ArrowRight', {})).toBe('first-child');
    expect(keyToAction('ArrowLeft', {})).toBe('parent');
    expect(keyToAction('ArrowDown', {})).toBe('next');
    expect(keyToAction('ArrowUp', {})).toBe('prev');
    expect(keyToAction('z', { ctrl: true })).toBe('undo');
    expect(keyToAction('z', { meta: true })).toBe('undo');
    expect(keyToAction('z', { ctrl: true, shift: true })).toBe('redo');
    expect(keyToAction('y', { ctrl: true })).toBe('redo');
    expect(keyToAction('x', {})).toBeNull();
  });
});

describe('MindEditorCore', () => {
  it('apply(addChild) marca sujo, seleciona o novo nó e abre a edição', () => {
    const { c, root } = make();
    expect(c.dirty).toBe(false);
    c.apply(m => addChild(m, root, 'A'));
    expect(c.dirty).toBe(true);
    expect(Object.keys(c.map.nodes)).toHaveLength(2);
    expect(c.selectedId).not.toBe(root);
    expect(c.map.nodes[c.selectedId!].text).toBe('A');
    expect(c.editingId).toBe(c.selectedId);
  });

  it('undo restaura o mapa anterior e a seleção; redo reaplica', () => {
    const { c, root } = make();
    c.select(root);
    c.apply(m => addChild(m, root, 'A'));
    const added = c.selectedId!;
    expect(c.undo()).toBe(true);
    expect(Object.keys(c.map.nodes)).toHaveLength(1);
    expect(c.selectedId).toBe(root);
    expect(c.redo()).toBe(true);
    expect(c.map.nodes[added]).toBeDefined();
    expect(c.undo() && c.undo()).toBe(false); // nada mais a desfazer
    expect(c.canUndo).toBe(false);
  });

  it('dirty acompanha o último salvamento, inclusive ao desfazer', () => {
    const { c, root } = make();
    c.apply(m => addChild(m, root, 'A'));
    c.markSaved();
    expect(c.dirty).toBe(false);
    c.undo();
    expect(c.dirty).toBe(true);
    c.redo();
    expect(c.dirty).toBe(false);
  });

  it('atalhos: Tab cria filho, Enter cria irmão', () => {
    const { c, root } = make();
    c.select(root);
    expect(c.handleKey('Tab', {})).toBe('handled');
    const child = c.selectedId!;
    expect(c.map.nodes[child].parentId).toBe(root);
    c.cancelEdit();
    expect(c.handleKey('Enter', {})).toBe('handled');
    expect(c.map.nodes[c.selectedId!].parentId).toBe(root);
    expect(children(c.map, root)).toHaveLength(2);
  });

  it('Delete na raiz é ignorado sem erro; num filho remove o ramo e seleciona o pai', () => {
    const { c, root } = make();
    c.select(root);
    const before = c.map;
    expect(() => c.handleKey('Delete', {})).not.toThrow();
    expect(c.handleKey('Delete', {})).toBe('ignored');
    expect(c.map).toBe(before);
    c.apply(m => addChild(m, root, 'A'));
    const a = c.selectedId!;
    c.apply(m => addChild(m, a, 'A1'));
    c.select(a);
    expect(c.handleKey('Delete', {})).toBe('handled');
    expect(Object.keys(c.map.nodes)).toHaveLength(1);
    expect(c.selectedId).toBe(root);
  });

  it('navegação por setas', () => {
    const { c, root } = make();
    c.apply(m => addChild(m, root, 'A')); const a = c.selectedId!;
    c.apply(m => addChild(m, root, 'B')); const b = c.selectedId!;
    c.cancelEdit();
    c.select(root);
    c.handleKey('ArrowRight', {});
    expect(c.selectedId).toBe(a);
    c.handleKey('ArrowDown', {});
    expect(c.selectedId).toBe(b);
    c.handleKey('ArrowUp', {});
    expect(c.selectedId).toBe(a);
    c.handleKey('ArrowLeft', {});
    expect(c.selectedId).toBe(root);
    c.handleKey('ArrowLeft', {}); // raiz não tem pai
    expect(c.selectedId).toBe(root);
  });

  it('Espaço recolhe/expande; recolher um ancestral da seleção seleciona o ancestral', () => {
    const { c, root } = make();
    c.apply(m => addChild(m, root, 'A')); const a = c.selectedId!;
    c.apply(m => addChild(m, a, 'A1')); const a1 = c.selectedId!;
    c.cancelEdit();
    c.select(a1);
    c.select(root);
    c.handleKey(' ', {});
    expect(visibleNodes(c.map).map(n => n.id)).toEqual([root]);
    c.select(a1); // nó oculto não pode ficar selecionado
    expect(c.selectedId).toBe(root);
    c.handleKey(' ', {});
    expect(visibleNodes(c.map)).toHaveLength(3);
  });

  it('Ctrl+Z / Ctrl+Shift+Z', () => {
    const { c, root } = make();
    c.select(root);
    c.handleKey('Tab', {});
    c.cancelEdit();
    expect(c.handleKey('z', { ctrl: true })).toBe('handled');
    expect(Object.keys(c.map.nodes)).toHaveLength(1);
    expect(c.handleKey('z', { ctrl: true, shift: true })).toBe('handled');
    expect(Object.keys(c.map.nodes)).toHaveLength(2);
  });

  it('arrastar: movimento transitório, um único passo de histórico ao soltar', () => {
    const { c, root } = make();
    c.apply(m => addChild(m, root, 'A')); const a = c.selectedId!; c.cancelEdit();
    const x0 = c.map.nodes[a].x;
    c.drag(a, x0 + 10, 5); c.drag(a, x0 + 50, 20); c.drag(a, x0 + 100, 40);
    expect(c.map.nodes[a].x).toBe(x0 + 100);
    c.commitDrag();
    expect(c.undo()).toBe(true);
    expect(c.map.nodes[a].x).toBe(x0); // volta ao ponto de partida de uma vez
  });

  it('edição: commit troca o texto; vazio mantém o anterior; cancelar descarta', () => {
    const { c, root } = make();
    c.apply(m => addChild(m, root, 'A')); const a = c.selectedId!;
    c.commitEdit('  Novo texto  ');
    expect(c.map.nodes[a].text).toBe('Novo texto');
    expect(c.editingId).toBeNull();
    c.startEdit(a);
    c.commitEdit('   ');
    expect(c.map.nodes[a].text).toBe('Novo texto');
    c.startEdit(a);
    c.cancelEdit();
    expect(c.editingId).toBeNull();
  });

  it('F2 pede edição; atalhos são ignorados enquanto edita', () => {
    const { c, root } = make();
    c.select(root);
    expect(c.handleKey('F2', {})).toBe('edit');
    expect(c.editingId).toBe(root);
    expect(c.handleKey('Delete', {})).toBe('ignored');
    expect(c.handleKey('Tab', {})).toBe('ignored');
  });

  it('setColor e setLink entram no histórico', () => {
    const { c, root } = make();
    c.select(root);
    c.setColor('#ff0000');
    expect(c.map.nodes[root].color).toBe('#ff0000');
    c.setLink({ noteId: 'n1' });
    expect(c.map.nodes[root].noteId).toBe('n1');
    c.undo();
    expect(c.map.nodes[root].noteId).toBeUndefined();
  });

  it('replace troca o mapa inteiro (ex.: depois da IA) e vira novo ponto de histórico', () => {
    const { c, root } = make();
    const bigger = addChild(c.map, root, 'IA').map;
    c.replace(bigger);
    expect(Object.keys(c.map.nodes)).toHaveLength(2);
    c.undo();
    expect(Object.keys(c.map.nodes)).toHaveLength(1);
  });
});
