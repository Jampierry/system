import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, space } from '../theme';
import { Icon, type IconName } from './Icon';
import { activeWikilink, applySuggestion, suggestTitles } from '../lib/wikilink';
import { prefixLines, wrapSelection, type Selection } from '../lib/editorOps';

type Tool = { label: string; icon?: IconName; text?: string; run: (v: string, s: Selection) => { text: string; selection: Selection } };
const TOOLS: Tool[] = [
  { label: 'Negrito', text: 'B', run: (v, s) => wrapSelection(v, s, '**', '**') },
  { label: 'Itálico', text: 'I', run: (v, s) => wrapSelection(v, s, '*', '*') },
  { label: 'Título', text: 'H', run: (v, s) => prefixLines(v, s, '## ') },
  { label: 'Lista', icon: 'checklist', run: (v, s) => prefixLines(v, s, '- ') },
  { label: 'Tarefa', icon: 'check', run: (v, s) => prefixLines(v, s, '- [ ] ') },
  { label: 'Link para nota', text: '[[ ]]', run: (v, s) => wrapSelection(v, s, '[[', ']]') },
  { label: 'Código', text: '</>', run: (v, s) => wrapSelection(v, s, '`', '`') },
];

/** Editor Markdown com barra de formatação e autocompletar de [[wikilinks]]. */
export function MarkdownEditor({ value, onChange, titles, readOnly, autoFocus }: {
  value: string; onChange: (v: string) => void; titles: string[]; readOnly?: boolean; autoFocus?: boolean;
}) {
  const [sel, setSel] = useState<Selection>({ start: 0, end: 0 });
  const [forced, setForced] = useState<Selection | undefined>();
  const ref = useRef<React.ComponentRef<typeof TextInput>>(null);

  const active = readOnly ? null : activeWikilink(value, sel.start);
  const suggestions = useMemo(() => (active ? suggestTitles(titles, active.query, 6) : []), [active?.query, active?.start, titles]); // eslint-disable-line react-hooks/exhaustive-deps

  function apply(t: Tool) {
    const r = t.run(value, sel);
    onChange(r.text);
    setForced(r.selection);
    setSel(r.selection);
    ref.current?.focus();
  }

  function pick(title: string) {
    const r = applySuggestion(value, sel.start, title);
    onChange(r.text);
    const c = { start: r.cursor, end: r.cursor };
    setForced(c);
    setSel(c);
    ref.current?.focus();
  }

  return (
    <View style={{ flex: 1 }}>
      {!readOnly ? (
        <View style={styles.toolbar}>
          {TOOLS.map(t => (
            <Pressable key={t.label} accessibilityRole="button" accessibilityLabel={t.label} onPress={() => apply(t)} style={({ hovered }: any) => [styles.tool, hovered && { backgroundColor: '#1d1d26' }]}>
              {t.icon ? <Icon name={t.icon} size={14} color={colors.muted} /> : <Text style={styles.toolText}>{t.text}</Text>}
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={v => { setForced(undefined); onChange(v); }}
        onSelectionChange={e => setSel(e.nativeEvent.selection)}
        selection={forced}
        multiline
        editable={!readOnly}
        autoFocus={autoFocus}
        placeholder="Escreva em Markdown. Use [[ para ligar a outras notas e #tags para organizar."
        placeholderTextColor={colors.faint}
        accessibilityLabel="Conteúdo da nota"
        style={styles.input}
        textAlignVertical="top"
      />
      {suggestions.length ? (
        <View style={styles.pop} accessibilityLabel="Sugestões de notas">
          {suggestions.map(s => (
            <Pressable key={s} accessibilityRole="button" onPress={() => pick(s)} style={({ hovered }: any) => [styles.sug, hovered && { backgroundColor: colors.selected }]}>
              <Icon name="note" size={13} color={colors.muted} /><Text style={styles.sugText} numberOfLines={1}>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', gap: 2, paddingBottom: 8, flexWrap: 'wrap' },
  tool: { minWidth: 32, height: 28, paddingHorizontal: 8, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  toolText: { color: colors.muted, fontSize: 12.5, fontWeight: '800' },
  input: { flex: 1, minHeight: 280, color: colors.text, fontSize: 15, lineHeight: 24, fontFamily: undefined, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.lg, outlineStyle: 'none' } as any,
  pop: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 4, zIndex: 10 },
  sug: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: radius.sm },
  sugText: { color: colors.text, fontSize: 13, flex: 1 },
});
