import { describe, it, expect } from 'vitest';
import { wrapSelection, prefixLines } from './editorOps';

describe('wrapSelection', () => {
  it('envolve o trecho selecionado e mantém a seleção sobre o texto', () => {
    expect(wrapSelection('abc def', { start: 0, end: 3 }, '**', '**')).toEqual({ text: '**abc** def', selection: { start: 2, end: 5 } });
  });
  it('sem seleção insere o par e posiciona o cursor no meio', () => {
    expect(wrapSelection('ab', { start: 1, end: 1 }, '[[', ']]')).toEqual({ text: 'a[[]]b', selection: { start: 3, end: 3 } });
  });
  it('desfaz quando o trecho já está envolvido', () => {
    expect(wrapSelection('**abc** def', { start: 2, end: 5 }, '**', '**')).toEqual({ text: 'abc def', selection: { start: 0, end: 3 } });
  });
  it('seleção invertida/fora dos limites é saneada', () => {
    expect(wrapSelection('abc', { start: 9, end: 1 }, '_', '_').text).toBe('a_bc_');
  });
});

describe('prefixLines', () => {
  it('adiciona o prefixo em cada linha tocada pela seleção', () => {
    expect(prefixLines('a\nb\nc', { start: 0, end: 3 }, '- ')).toEqual({ text: '- a\n- b\nc', selection: { start: 0, end: 7 } });
  });
  it('remove quando todas as linhas já têm o prefixo', () => {
    expect(prefixLines('- a\n- b', { start: 0, end: 7 }, '- ')).toEqual({ text: 'a\nb', selection: { start: 0, end: 3 } });
  });
  it('cursor simples afeta só a linha atual', () => {
    expect(prefixLines('x\ny', { start: 3, end: 3 }, '## ')).toEqual({ text: 'x\n## y', selection: { start: 6, end: 6 } });
  });
});
