import { describe, it, expect } from 'vitest';
import { parseNote, renameWikilinks } from './markdown';

describe('parseNote', () => {
  it('extrai links com alias, tags e ignora código inline', () => {
    const r = parseNote('a [[B|alias]] #t `[[x]]` #t2');
    expect(r.links).toEqual([{ target: 'B', alias: 'alias' }]);
    expect(r.tags).toEqual(['t', 't2']);
  });
  it('ignora blocos de código cercados', () => {
    const r = parseNote('antes [[A]]\n```js\n[[Z]] #nao # Titulo falso\n```\n~~~\n[[Y]]\n~~~\ndepois #sim');
    expect(r.links.map(l => l.target)).toEqual(['A']);
    expect(r.tags).toEqual(['sim']);
    expect(r.headings).toEqual([]);
  });
  it('link com seção usa só o alvo', () => {
    expect(parseNote('[[Nota#Seção|texto]]').links).toEqual([{ target: 'Nota', alias: 'texto' }]);
  });
  it('não confunde #123, C# e fragmento de URL com tags', () => {
    expect(parseNote('item #123 e C# e http://x.com/#frag').tags).toEqual([]);
    expect(parseNote('#a/b #ação_1').tags).toEqual(['a/b', 'ação_1']);
  });
  it('colchetes malformados não quebram nem criam links', () => {
    expect(parseNote('[[ ]] [[]] [[aberto').links).toEqual([]);
  });
  it('headings com nível e texto', () => {
    expect(parseNote('# Um\ntexto\n### Três ###\n#semespaco').headings).toEqual([
      { level: 1, text: 'Um' },
      { level: 3, text: 'Três' },
    ]);
  });
  it('frontmatter: escalares, listas e tags', () => {
    const r = parseNote('---\ntitle: Minha nota\nnota: 3\nok: true\naliases: [a, b]\ntags:\n  - x\n  - y\n---\ncorpo #z');
    expect(r.frontmatter).toEqual({ title: 'Minha nota', nota: 3, ok: true, aliases: ['a', 'b'], tags: ['x', 'y'] });
    expect(r.tags.sort()).toEqual(['x', 'y', 'z']);
  });
  it('sem frontmatter válido, devolve objeto vazio', () => {
    expect(parseNote('--- não fecha').frontmatter).toEqual({});
  });
});

describe('renameWikilinks', () => {
  it('troca o alvo preservando alias e seção; ignora código', () => {
    const md = '[[Velho]] [[velho|x]] [[Velho#S]] `[[Velho]]`\n```\n[[Velho]]\n```\n[[Velhote]]';
    expect(renameWikilinks(md, 'Velho', 'Novo')).toBe('[[Novo]] [[Novo|x]] [[Novo#S]] `[[Velho]]`\n```\n[[Velho]]\n```\n[[Velhote]]');
  });
});
