import { describe, it, expect } from 'vitest';
import { fuzzyScore, rank } from './fuzzy';

describe('fuzzy', () => {
  it('ignora caixa e acentos', () => {
    expect(fuzzyScore('acao', 'Próxima Ação')).not.toBeNull();
    expect(fuzzyScore('PRO', 'projeto')).not.toBeNull();
  });
  it('sem correspondência → null', () => {
    expect(fuzzyScore('xyz', 'Projeto')).toBeNull();
    expect(fuzzyScore('pro', 'aprender')).toBeNull();
  });
  it('prefixo vale mais que trecho no meio, que vale mais que subsequência', () => {
    const pre = fuzzyScore('pro', 'Projeto')!;
    const mid = fuzzyScore('jet', 'Projeto')!;
    const sub = fuzzyScore('pjt', 'Projeto')!;
    expect(pre).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(sub);
  });
  it('rank ordena por relevância e desempata pelo texto mais curto; consulta vazia mantém a ordem', () => {
    const items = ['Aprender', 'Pró-ximos passos', 'Projeto Aurora', 'xyz'];
    expect(rank(items, 'pro', s => s)).toEqual(['Projeto Aurora', 'Pró-ximos passos']);
    expect(rank(items, '', s => s)).toEqual(items);
    expect(rank(items, 'pj', s => s)).toEqual(['Projeto Aurora']);
  });
});
