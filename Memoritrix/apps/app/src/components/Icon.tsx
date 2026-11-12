import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'inbox' | 'calendar' | 'target' | 'arrow' | 'clock' | 'bulb' | 'folder' | 'repeat' | 'checklist' | 'review'
  | 'logbook' | 'plus' | 'mic' | 'search' | 'graph' | 'settings' | 'book' | 'check' | 'note' | 'map' | 'bot'
  | 'user' | 'shield' | 'x' | 'down' | 'left' | 'right' | 'trash' | 'send' | 'camera' | 'menu' | 'brain'
  | 'key' | 'logout' | 'wave' | 'play' | 'pause' | 'download' | 'upload' | 'edit' | 'tag' | 'copy' | 'sparkle' | 'sync';

const P = (d: string) => <Path d={d} />;

const ICONS: Record<IconName, React.ReactNode> = {
  inbox: P('M3 13h5l1.5 3h5L16 13h5 M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z'),
  calendar: <><Rect x="4" y="5" width="16" height="15" rx="2" />{P('M4 10h16 M9 3v4 M15 3v4')}</>,
  target: <><Circle cx="12" cy="12" r="9" /><Circle cx="12" cy="12" r="5" /><Circle cx="12" cy="12" r="1" /></>,
  arrow: P('M7 17L17 7 M8 7h9v9'),
  clock: <><Circle cx="12" cy="12" r="9" />{P('M12 7v5l3 2')}</>,
  bulb: P('M9 18h6 M10 21h4 M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z'),
  folder: P('M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'),
  repeat: P('M17 2l4 4-4 4 M3 11V9a3 3 0 0 1 3-3h15 M7 22l-4-4 4-4 M21 13v2a3 3 0 0 1-3 3H3'),
  checklist: P('M10 6h11 M10 12h11 M10 18h11 M3 6l1.5 1.5L7 5 M3 12l1.5 1.5L7 11 M3 18l1.5 1.5L7 17'),
  review: P('M3 6h18 M3 12h12 M3 18h8 M17 15l2 2 4-4'),
  logbook: P('M3 12a9 9 0 1 0 3-6.7 M3 4v5h5 M12 8v5l3 2'),
  plus: P('M12 5v14 M5 12h14'),
  mic: P('M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M5 11a7 7 0 0 0 14 0 M12 18v3'),
  search: <><Circle cx="11" cy="11" r="7" />{P('M21 21l-4.3-4.3')}</>,
  graph: <><Circle cx="6" cy="6" r="2.5" /><Circle cx="18" cy="8" r="2.5" /><Circle cx="12" cy="18" r="2.5" />
    <Line x1="8" y1="7" x2="16" y2="7.6" /><Line x1="17" y1="10.3" x2="13" y2="15.6" /><Line x1="10.5" y1="16.2" x2="7" y2="8.3" /></>,
  settings: <><Circle cx="12" cy="12" r="4" />{P('M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1L7 17 M17 7l2.1-2.1')}</>,
  book: P('M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 19a2 2 0 0 1 2-2h13'),
  check: P('M5 12l5 5 9-10'),
  note: P('M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h7'),
  map: <><Circle cx="12" cy="12" r="2.5" /><Circle cx="4.5" cy="5" r="1.8" /><Circle cx="19.5" cy="5" r="1.8" /><Circle cx="12" cy="20" r="1.8" />
    <Line x1="10" y1="10.5" x2="5.8" y2="6.3" /><Line x1="14" y1="10.5" x2="18.2" y2="6.3" /><Line x1="12" y1="14.5" x2="12" y2="18.2" /></>,
  bot: <><Rect x="4" y="8" width="16" height="11" rx="3" />{P('M12 4v4 M9 13h.01 M15 13h.01 M9 16h6')}</>,
  user: <><Circle cx="12" cy="8" r="4" />{P('M4 21a8 8 0 0 1 16 0')}</>,
  shield: P('M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'),
  x: P('M6 6l12 12 M18 6L6 18'),
  down: P('M6 9l6 6 6-6'),
  left: P('M15 6l-6 6 6 6'),
  right: P('M9 6l6 6-6 6'),
  trash: P('M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13'),
  send: P('M3 11l18-8-8 18-2-8z'),
  camera: <>{P('M4 8h3l2-3h6l2 3h3v11H4z')}<Circle cx="12" cy="13" r="3.5" /></>,
  menu: P('M4 6h16 M4 12h16 M4 18h16'),
  brain: P('M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V4a3 3 0 0 0-3 0z M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1'),
  key: <><Circle cx="8" cy="15" r="4" />{P('M11 12l9-9 M16 7l3 3')}</>,
  logout: P('M9 21H5V3h4 M16 17l5-5-5-5 M21 12H9'),
  wave: P('M4 10v4 M8 6v12 M12 3v18 M16 7v10 M20 10v4'),
  play: P('M7 4l13 8-13 8z'),
  pause: P('M8 5v14 M16 5v14'),
  download: P('M12 4v11 M7 11l5 5 5-5 M5 20h14'),
  upload: P('M12 16V5 M7 9l5-5 5 5 M5 20h14'),
  edit: P('M4 20h4L19 9l-4-4L4 16z'),
  tag: P('M3 12V4h8l10 10-8 8z M7.5 8.5h.01'),
  copy: <><Rect x="9" y="9" width="11" height="11" rx="2" />{P('M5 15V6a2 2 0 0 1 2-2h8')}</>,
  sparkle: P('M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z'),
  sync: P('M21 12a9 9 0 0 1-15.5 6.2 M3 12A9 9 0 0 1 18.5 5.8 M18 2v4h-4 M6 22v-4h4'),
};

export function Icon({ name, size = 18, color = '#ececf1', strokeWidth = 1.7 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </Svg>
  );
}
