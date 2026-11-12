import { addChild, addSibling, children, History, removeNode, moveNode, setColor, setLink, setText, toggleCollapse, type MindMap } from '@cerebro/shared';

export type KeyAction = 'child' | 'sibling' | 'remove' | 'edit' | 'toggle' | 'first-child' | 'parent' | 'next' | 'prev' | 'undo' | 'redo';
export type Mods = { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean };

export function keyToAction(key: string, mods: Mods): KeyAction | null {
  if (mods.ctrl || mods.meta) {
    const k = key.toLowerCase();
    if (k === 'z') return mods.shift ? 'redo' : 'undo';
    if (k === 'y') return 'redo';
    return null;
  }
  switch (key) {
    case 'Tab': return 'child';
    case 'Enter': return 'sibling';
    case 'Delete': case 'Backspace': return 'remove';
    case 'F2': return 'edit';
    case ' ': return 'toggle';
    case 'ArrowRight': return 'first-child';
    case 'ArrowLeft': return 'parent';
    case 'ArrowDown': return 'next';
    case 'ArrowUp': return 'prev';
    default: return null;
  }
}

type Snap = { map: MindMap; selectedId: string | null };
type Applied = MindMap | { map: MindMap; id: string };

/** Estado e regras do editor de mapa mental, sem React (testável). A UI só reflete este objeto. */
export class MindEditorCore {
  map: MindMap;
  selectedId: string | null;
  editingId: string | null = null;
  private history = new History<Snap>();
  private current: Snap;
  private saved: Snap;
  private dragging = false;

  constructor(initial: MindMap) {
    this.map = initial;
    this.selectedId = initial.rootId;
    this.current = { map: initial, selectedId: initial.rootId };
    this.saved = this.current;
    this.history.push(this.current);
  }

  get dirty(): boolean { return this.current !== this.saved || this.dragging; }
  get canUndo(): boolean { return this.history.canUndo; }
  get canRedo(): boolean { return this.history.canRedo; }

  private commit(map: MindMap, selectedId: string | null): void {
    this.map = map;
    this.selectedId = selectedId && map.nodes[selectedId] ? selectedId : map.rootId;
    this.current = { map, selectedId: this.selectedId };
    this.history.push(this.current);
  }

  private restore(s: Snap): void {
    this.current = s;
    this.map = s.map;
    this.selectedId = s.selectedId && s.map.nodes[s.selectedId] ? s.selectedId : s.map.rootId;
    this.editingId = null;
    this.dragging = false;
  }

  /** Aplica uma operação pura do mapa. Se ela devolver {map, id}, seleciona e abre a edição do novo nó. */
  apply(fn: (m: MindMap) => Applied): void {
    const r = fn(this.map);
    const map = 'nodes' in r ? r : r.map;
    const id = 'nodes' in r ? undefined : r.id;
    this.commit(map, id ?? this.selectedId);
    if (id) this.editingId = id;
  }

  /** Troca o mapa inteiro (ex.: após a IA mexer nele no servidor). */
  replace(map: MindMap): void { this.commit(map, this.selectedId); this.editingId = null; }

  markSaved(): void { this.saved = this.current; }

  select(id: string | null): void {
    if (id && !this.map.nodes[id]) return;
    if (id) {
      // nó dentro de ramo recolhido não pode ficar selecionado: seleciona o ancestral recolhido mais alto
      const path: string[] = [];
      for (let n = this.map.nodes[id]; n; n = n.parentId ? this.map.nodes[n.parentId] : undefined as any) path.unshift(n.id);
      const hidden = path.slice(0, -1).find(pid => this.map.nodes[pid].collapsed);
      id = hidden ?? id;
    }
    if (this.editingId && this.editingId !== id) this.editingId = null;
    this.selectedId = id;
  }

  startEdit(id: string | null = this.selectedId): void { if (id && this.map.nodes[id]) { this.selectedId = id; this.editingId = id; } }
  cancelEdit(): void { this.editingId = null; }
  commitEdit(text: string): void {
    const id = this.editingId;
    if (!id) return;
    const t = text.trim();
    this.editingId = null;
    if (t && t !== this.map.nodes[id]?.text) this.commit(setText(this.map, id, t.slice(0, 500)), id);
  }

  addChild(): void { if (this.selectedId) this.apply(m => addChild(m, this.selectedId!)); }
  addSibling(): void { if (this.selectedId) this.apply(m => addSibling(m, this.selectedId!)); }

  remove(): boolean {
    const id = this.selectedId;
    if (!id || id === this.map.rootId) return false;
    const parent = this.map.nodes[id].parentId;
    this.commit(removeNode(this.map, id), parent);
    this.editingId = null;
    return true;
  }

  toggleCollapse(id: string | null = this.selectedId): boolean {
    if (!id || !children(this.map, id).length) return false;
    this.commit(toggleCollapse(this.map, id), id);
    return true;
  }

  setColor(color: string | undefined): void { if (this.selectedId) this.commit(setColor(this.map, this.selectedId, color), this.selectedId); }
  setLink(link: { noteId?: string; itemId?: string }): void { if (this.selectedId) this.commit(setLink(this.map, this.selectedId, link), this.selectedId); }

  /** Movimento durante o arrasto: não entra no histórico até commitDrag(). */
  drag(id: string, x: number, y: number): void {
    if (!this.map.nodes[id]) return;
    this.dragging = true;
    this.map = moveNode(this.map, id, x, y);
  }
  commitDrag(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.commit(this.map, this.selectedId);
  }

  undo(): boolean { const s = this.history.undo(); if (s) this.restore(s); return !!s; }
  redo(): boolean { const s = this.history.redo(); if (s) this.restore(s); return !!s; }

  /** Trata uma tecla. 'edit' = a UI deve focar o campo de texto do nó selecionado. */
  handleKey(key: string, mods: Mods): 'handled' | 'edit' | 'ignored' {
    if (this.editingId) return 'ignored';
    const action = keyToAction(key, mods);
    if (!action) return 'ignored';
    if (action === 'undo') return this.undo() ? 'handled' : 'ignored';
    if (action === 'redo') return this.redo() ? 'handled' : 'ignored';
    const sel = this.selectedId;
    if (!sel) { this.select(this.map.rootId); return 'handled'; }
    const node = this.map.nodes[sel];
    switch (action) {
      case 'child': this.addChild(); return 'handled';
      case 'sibling': this.addSibling(); return 'handled';
      case 'remove': return this.remove() ? 'handled' : 'ignored';
      case 'edit': this.startEdit(sel); return 'edit';
      case 'toggle': return this.toggleCollapse(sel) ? 'handled' : 'ignored';
      case 'first-child': {
        const kids = children(this.map, sel);
        if (!kids.length) return 'ignored';
        if (node.collapsed) { this.toggleCollapse(sel); return 'handled'; }
        this.select(kids[0].id);
        return 'handled';
      }
      case 'parent': if (!node.parentId) return 'ignored'; this.select(node.parentId); return 'handled';
      case 'next':
      case 'prev': {
        if (!node.parentId) return 'ignored';
        const sibs = children(this.map, node.parentId);
        const i = sibs.findIndex(n => n.id === sel) + (action === 'next' ? 1 : -1);
        if (i < 0 || i >= sibs.length) return 'ignored';
        this.select(sibs[i].id);
        return 'handled';
      }
    }
    return 'ignored';
  }
}
