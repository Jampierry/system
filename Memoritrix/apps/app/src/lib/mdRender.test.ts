import { describe, it, expect } from 'vitest';
import { parseBlocks, parseInline } from './mdRender';

describe('parseInline', () => {
  it('texto simples', () => expect(parseInline('olá')).toEqual([{ t: 'text', text: 'olá' }]));
  it('negrito, itálico e código', () => {
    expect(parseInline('a **b** *c* `d`')).toEqual([
      { t: 'text', text: 'a ' }, { t: 'bold', text: 'b' }, { t: 'text', text: ' ' },
      { t: 'italic', text: 'c' }, { t: 'text', text: ' ' }, { t: 'code', text: 'd' },
    ]);
  });
  it('wikilink com alias e seção', () => {
    expect(parseInline('ver [[Projeto|aurora]] e [[Nota#Sec]]')).toEqual([
      { t: 'text', text: 'ver ' }, { t: 'wikilink', text: 'aurora', target: 'Projeto' },
      { t: 'text', text: ' e ' }, { t: 'wikilink', text: 'Nota#Sec', target: 'Nota' },
    ]);
  });
  it('tags só com letra e precedidas de espaço', () => {
    expect(parseInline('#ideias e #123 e C# e x#y')).toEqual([
      { t: 'tag', text: '#ideias' }, { t: 'text', text: ' e #123 e C# e x#y' },
    ]);
  });
  it('links externos; código protege o conteúdo', () => {
    expect(parseInline('[site](https://x.com)')).toEqual([{ t: 'link', text: 'site', href: 'https://x.com' }]);
    expect(parseInline('`[[nao]] #nao`')).toEqual([{ t: 'code', text: '[[nao]] #nao' }]);
  });
});

describe('parseBlocks', () => {
  it('títulos, parágrafos e citação', () => {
    const b = parseBlocks('# Título\n\ntexto com [[A]]\n\n> citado');
    expect(b.map(x => x.t)).toEqual(['h', 'p', 'quote']);
    expect(b[0]).toMatchObject({ t: 'h', level: 1 });
  });
  it('listas com tarefas e aninhamento', () => {
    const b = parseBlocks('- [ ] a\n- [x] b\n  - filho\n1. um\n2. dois');
    expect(b[0]).toMatchObject({ t: 'ul' });
    const ul = b[0] as any;
    expect(ul.items.map((i: any) => [i.checked, i.depth])).toEqual([[false, 0], [true, 0], [undefined, 1]]);
    expect(b[1]).toMatchObject({ t: 'ol' });
    expect((b[1] as any).items).toHaveLength(2);
  });
  it('bloco de código preserva o conteúdo literal', () => {
    const b = parseBlocks('```js\nconst a = [[x]];\n```');
    expect(b).toEqual([{ t: 'code', lang: 'js', text: 'const a = [[x]];' }]);
  });
  it('frontmatter vira propriedades e não aparece como texto', () => {
    const b = parseBlocks('---\ntitle: Oi\ntags: [a, b]\n---\ncorpo');
    expect(b[0]).toEqual({ t: 'props', entries: [['title', 'Oi'], ['tags', 'a, b']] });
    expect(b[1]).toMatchObject({ t: 'p' });
  });
  it('linha horizontal e entrada vazia', () => {
    expect(parseBlocks('---x\n\n***')[1]).toEqual({ t: 'hr' });
    expect(parseBlocks('')).toEqual([]);
  });
});
