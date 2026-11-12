import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { parseBlocks, type Inline } from '../lib/mdRender';
import { colors, radius, space } from '../theme';

type Link = { target: string; noteId: string | null };

export function MarkdownPreview({ md, links, onOpenLink, onTag }: {
  md: string; links: Link[]; onOpenLink: (target: string, noteId: string | null) => void; onTag?: (tag: string) => void;
}) {
  const blocks = useMemo(() => parseBlocks(md), [md]);
  const resolved = useMemo(() => new Map(links.map(l => [l.target.toLowerCase(), l.noteId])), [links]);

  const inl = (list: Inline[], base?: object) => list.map((n, i) => {
    switch (n.t) {
      case 'bold': return <Text key={i} style={[base, styles.bold]}>{n.text}</Text>;
      case 'italic': return <Text key={i} style={[base, styles.italic]}>{n.text}</Text>;
      case 'code': return <Text key={i} style={styles.inlineCode}>{n.text}</Text>;
      case 'link': return <Text key={i} accessibilityRole="link" style={[base, styles.link]} onPress={() => { try { globalThis.open?.(n.href, '_blank'); } catch { /* sem janela */ } }}>{n.text}</Text>;
      case 'tag': return <Text key={i} style={[base, styles.tag]} onPress={() => onTag?.(n.text.slice(1))}>{n.text}</Text>;
      case 'wikilink': {
        const id = resolved.get(n.target!.toLowerCase()) ?? null;
        return <Text key={i} accessibilityRole="link" style={[base, id ? styles.wiki : styles.wikiMissing]} onPress={() => onOpenLink(n.target!, id)}>{n.text}</Text>;
      }
      default: return <Text key={i} style={base}>{n.text}</Text>;
    }
  });

  return (
    <View style={{ gap: space.md }}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h': return <Text key={i} accessibilityRole="header" style={[styles.h, { fontSize: [28, 23, 19, 17, 15, 14][b.level - 1] }]}>{inl(b.inlines)}</Text>;
          case 'p': return <Text key={i} style={styles.p}>{inl(b.inlines)}</Text>;
          case 'quote': return <View key={i} style={styles.quote}><Text style={[styles.p, { color: colors.muted }]}>{inl(b.inlines)}</Text></View>;
          case 'hr': return <View key={i} style={styles.hr} />;
          case 'code': return <View key={i} style={styles.code}><Text style={styles.codeText}>{b.text}</Text></View>;
          case 'props': return (
            <View key={i} style={styles.props}>
              {b.entries.map(([k, v]) => <View key={k} style={{ flexDirection: 'row', gap: 12 }}><Text style={styles.propKey}>{k}</Text><Text style={styles.propVal}>{v}</Text></View>)}
            </View>
          );
          case 'ul':
          case 'ol': return (
            <View key={i} style={{ gap: 4 }}>
              {b.items.map((it, j) => (
                <View key={j} style={{ flexDirection: 'row', gap: 8, paddingLeft: it.depth * 18 }}>
                  <Text style={[styles.p, { color: colors.muted, width: 18 }]}>{it.checked === undefined ? (b.t === 'ol' ? `${j + 1}.` : '•') : it.checked ? '☑' : '☐'}</Text>
                  <Text style={[styles.p, { flex: 1 }, it.checked && { color: colors.faint, textDecorationLine: 'line-through' }]}>{inl(it.inlines)}</Text>
                </View>
              ))}
            </View>
          );
          default: return null;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  h: { color: colors.text, fontWeight: '800', marginTop: 6 },
  p: { color: colors.text, fontSize: 15, lineHeight: 24 },
  bold: { fontWeight: '800' },
  italic: { fontStyle: 'italic' },
  inlineCode: { backgroundColor: '#1d1d26', color: '#f0b27a', fontFamily: 'monospace', fontSize: 13 },
  link: { color: colors.accentText, textDecorationLine: 'underline' },
  tag: { color: '#c58bff', fontWeight: '600' },
  wiki: { color: colors.accentText, fontWeight: '600' },
  wikiMissing: { color: colors.warning, fontWeight: '600', textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: 12 },
  hr: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  code: { backgroundColor: '#0f0f15', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12 },
  codeText: { color: '#cfd2ff', fontFamily: 'monospace', fontSize: 13 },
  props: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 4 },
  propKey: { color: colors.muted, fontSize: 12.5, width: 90 },
  propVal: { color: colors.text, fontSize: 12.5, flex: 1 },
});
