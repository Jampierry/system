import { useWindowDimensions } from 'react-native';

/** Tema escuro inspirado no app de referência. */
export const colors = {
  bg: '#0c0c10',
  surface: '#121217',
  panel: '#15151b',
  border: '#22222b',
  text: '#ececf1',
  muted: '#8b8b99',
  faint: '#5d5d6b',
  accent: '#5b74f5',
  accentBg: '#1a2552',
  accentText: '#9db0ff',
  selected: '#1b2748',
  success: '#3ecf8e',
  warning: '#f5b84b',
  danger: '#f5626f',
  white: '#ffffff',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 };

export function useBreakpoint() {
  const { width } = useWindowDimensions();
  return { width, isWide: width >= 1100, isMedium: width >= 760, isNarrow: width < 760 };
}
