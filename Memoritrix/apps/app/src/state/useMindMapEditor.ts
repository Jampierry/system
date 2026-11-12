import { useMemo, useReducer, useRef } from 'react';
import type { MindMap } from '@cerebro/shared';
import { MindEditorCore, type Mods } from '../lib/mindEditor';

/** Liga o MindEditorCore ao React: cada ação do núcleo re-renderiza a tela. */
export function useMindMapEditor(initial: MindMap) {
  const ref = useRef<MindEditorCore | null>(null);
  if (!ref.current) ref.current = new MindEditorCore(initial);
  const core = ref.current;
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const actions = useMemo(() => {
    const w = <A extends unknown[], R>(fn: (...a: A) => R) => (...a: A): R => { const r = fn(...a); bump(); return r; };
    return {
      apply: w(core.apply.bind(core)),
      replace: w(core.replace.bind(core)),
      select: w(core.select.bind(core)),
      startEdit: w(core.startEdit.bind(core)),
      cancelEdit: w(core.cancelEdit.bind(core)),
      commitEdit: w(core.commitEdit.bind(core)),
      addChild: w(core.addChild.bind(core)),
      addSibling: w(core.addSibling.bind(core)),
      remove: w(core.remove.bind(core)),
      toggleCollapse: w(core.toggleCollapse.bind(core)),
      setColor: w(core.setColor.bind(core)),
      setLink: w(core.setLink.bind(core)),
      drag: w(core.drag.bind(core)),
      commitDrag: w(core.commitDrag.bind(core)),
      undo: w(core.undo.bind(core)),
      redo: w(core.redo.bind(core)),
      markSaved: w(core.markSaved.bind(core)),
      handleKey: w((key: string, mods: Mods) => core.handleKey(key, mods)),
    };
  }, [core]);

  return {
    ...actions,
    core,
    map: core.map,
    selectedId: core.selectedId,
    editingId: core.editingId,
    dirty: core.dirty,
    canUndo: core.canUndo,
    canRedo: core.canRedo,
  };
}

export type MindEditor = ReturnType<typeof useMindMapEditor>;
