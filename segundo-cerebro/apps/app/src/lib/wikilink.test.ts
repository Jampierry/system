import { describe, it, expect } from 'vitest';
import { activeWikilink, suggestTitles, applySuggestion } from './wikilink';

describe('wikilink autocomplete', () => {
  it('detecta [[ aberto antes do cursor', () => {
    expect(activeWikilink('ver [[pro', 9)).toEqual({ start: 4, query: 'pro' });
    expect(activeWikilink('ver [[', 6)).toEqual({ start: 4, query: '' });
  });
  it('não ativa fora de um link aberto', () => {
    expect(activeWikilink('ver [[pro]] x', 13)).toBeNull();
    expect(activeWikilink('sem links', 5)).toBeNull();
    expect(activeWikilink('[[a\nb', 5)).toBeNull(); // quebra de linha encerra
    expect(activeWikilink('[[nota|ali', 10)).toBeNull(); // digitando alias
    expect(activeWikilink('[[nota#sec', 10)).toBeNull();
  });
  it('sugere títulos por prefixo/fuzzy, sem duplicar e limitando', () => {
    const titles = ['Projeto Aurora', 'Projeto Aurora', 'Aprender', 'Receitas', 'Pró-ximos'];
    expect(suggestTitles(titles, 'pro')).toEqual(['Pró-ximos', 'Projeto Aurora']); // empate de relevância → título mais curto
    expect(suggestTitles(['a1', 'a2', 'a3'], 'a', 2)).toHaveLength(2);
    expect(suggestTitles(titles, '')).toHaveLength(4);
  });
  it('aplica a sugestão fechando os colchetes e posiciona o cursor depois', () => {
    expect(applySuggestion('ver [[pro', 9, 'Projeto Aurora')).toEqual({ text: 'ver [[Projeto Aurora]]', cursor: 22 });
  });
  it('reaproveita ]] já existentes depois do cursor', () => {
    expect(applySuggestion('ver [[pro]] fim', 9, 'Projeto Aurora')).toEqual({ text: 'ver [[Projeto Aurora]] fim', cursor: 22 });
  });
});
