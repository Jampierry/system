export type Selection = { start: number; end: number };
export type EditResult = { text: string; selection: Selection };

const clamp = (sel: Selection, len: number): Selection => {
  const a = Math.max(0, Math.min(len, sel.start));
  const b = Math.max(0, Math.min(len, sel.end));
  return { start: Math.min(a, b), end: Math.max(a, b) };
};

/** Envolve (ou desembrulha) a seleção com marcadores; sem seleção insere o par com o cursor no meio. */
export function wrapSelection(text: string, selection: Selection, before: string, after: string): EditResult {
  const { start, end } = clamp(selection, text.length);
  const wrapped = text.slice(start - before.length, start) === before && text.slice(end, end + after.length) === after && start !== end;
  if (wrapped) {
    return {
      text: text.slice(0, start - before.length) + text.slice(start, end) + text.slice(end + after.length),
      selection: { start: start - before.length, end: end - before.length },
    };
  }
  return {
    text: text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end),
    selection: { start: start + before.length, end: end + before.length },
  };
}

/** Adiciona (ou remove, se todas já tiverem) um prefixo nas linhas tocadas pela seleção. */
export function prefixLines(text: string, selection: Selection, prefix: string): EditResult {
  const { start, end } = clamp(selection, text.length);
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = text.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = text.length;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const all = lines.every(l => l.startsWith(prefix));
  const next = lines.map(l => (all ? l.slice(prefix.length) : prefix + l));
  const delta = next.join('\n').length - lines.join('\n').length;
  const firstDelta = all ? -prefix.length : prefix.length;
  return {
    text: text.slice(0, lineStart) + next.join('\n') + text.slice(lineEnd),
    selection: { start: start === lineStart ? lineStart : Math.max(lineStart, start + firstDelta), end: end + delta },
  };
}
