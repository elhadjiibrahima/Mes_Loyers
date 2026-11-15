import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#13201B',
    background: '#F4F6F5',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E6ECE9',
    textSecondary: '#56645E',
    border: '#DDE5E1',
    primary: '#0F7B5F',
    primaryText: '#FFFFFF',
    hero: '#0F7B5F',
    heroText: '#FFFFFF',
    heroMuted: '#D3EDE4',
    inverse: '#13201B',
    inverseText: '#FFFFFF',
    inverseMuted: '#B9C6C0',
    success: '#0B6650',
    successBg: '#E9F5F0',
    warning: '#8A4B05',
    warningBg: '#FDF3E4',
    danger: '#A61E25',
    dangerBg: '#FCEBEC',
  },
  dark: {
    text: '#F2F4F3',
    background: '#0B0F0D',
    backgroundElement: '#161B19',
    backgroundSelected: '#232A27',
    textSecondary: '#A3AEA9',
    border: '#2A322E',
    primary: '#2BB58C',
    primaryText: '#05140F',
    hero: '#0E4D3C',
    heroText: '#FFFFFF',
    heroMuted: '#A9D5C5',
    inverse: '#232A27',
    inverseText: '#FFFFFF',
    inverseMuted: '#A3AEA9',
    success: '#4ADE9B',
    successBg: '#12261F',
    warning: '#FBBF24',
    warningBg: '#2B2110',
    danger: '#F87171',
    dangerBg: '#2E1517',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

export const Radius = { small: 10, medium: 14, large: 18, round: 999 } as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
/** Sur le web, la barre d'onglets est en haut et passe par-dessus le contenu. */
export const WebTabInset = Platform.OS === 'web' ? 64 : 0;
