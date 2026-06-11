import { create } from 'zustand';
import { storage } from '../lib/api';

export type Theme = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'normal' | 'large';
export type Density = 'comfortable' | 'compact';
export type BgType = 'default' | 'gradient' | 'image';

export const ACCENT_PRESETS = [
  { name: 'Indigo',  hex: '#818cf8', rgb: '129 140 248' },
  { name: 'Violet',  hex: '#8b5cf6', rgb: '139 92 246' },
  { name: 'Blue',    hex: '#3b82f6', rgb: '59 130 246' },
  { name: 'Cyan',    hex: '#06b6d4', rgb: '6 182 212' },
  { name: 'Green',   hex: '#22c55e', rgb: '34 197 94' },
  { name: 'Orange',  hex: '#f97316', rgb: '249 115 22' },
  { name: 'Pink',    hex: '#ec4899', rgb: '236 72 153' },
  { name: 'Red',     hex: '#ef4444', rgb: '239 68 68' },
];

export const BG_GRADIENTS = [
  'linear-gradient(135deg, #09090b 0%, #1a0533 100%)',
  'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
  'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
  'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%)',
  'linear-gradient(135deg, #1d2671 0%, #c33764 100%)',
];

export interface AppSettings {
  theme: Theme;
  accentColor: string;
  accentRgb: string;
  messageFontSize: FontSize;
  messageDensity: Density;
  hideConsecutiveAvatars: boolean;
  bgType: BgType;
  bgGradient: number;
  bgImage: string | null;
  bgBrightness: number;
  notifDesktop: boolean;
  notifMention: boolean;
  notifDm: boolean;
  notifSound: boolean;
  notifKeywords: string[];
}

const DEFAULTS: AppSettings = {
  theme: 'dark',
  accentColor: '#818cf8',
  accentRgb: '129 140 248',
  messageFontSize: 'normal',
  messageDensity: 'comfortable',
  hideConsecutiveAvatars: false,
  bgType: 'default',
  bgGradient: 0,
  bgImage: null,
  bgBrightness: 100,
  notifDesktop: true,
  notifMention: true,
  notifDm: true,
  notifSound: true,
  notifKeywords: [],
};

const FONT_SIZE_PX: Record<FontSize, string> = {
  small: '13px',
  normal: '15px',
  large: '17px',
};

function loadFromLS(): AppSettings {
  try {
    const raw = localStorage.getItem('app_settings');
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {/* ignore */}
  return { ...DEFAULTS };
}

function saveToLS(s: AppSettings): void {
  try { localStorage.setItem('app_settings', JSON.stringify(s)); } catch {/* ignore */}
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

export function applySettings(s: AppSettings): void {
  const html = document.documentElement;

  // Theme
  html.setAttribute('data-theme', resolveTheme(s.theme));

  // Accent
  html.style.setProperty('--accent', s.accentColor);
  html.style.setProperty('--accent-rgb', s.accentRgb);

  // Message display
  html.style.setProperty('--message-font-size', FONT_SIZE_PX[s.messageFontSize]);
  html.style.setProperty('--message-padding-y', s.messageDensity === 'compact' ? '0.2rem' : '0.375rem');

  // Background (gradients applied directly; image handled by AppBackground React component)
  const body = document.body;
  if (s.bgType === 'gradient') {
    body.style.background = BG_GRADIENTS[s.bgGradient] ?? BG_GRADIENTS[0];
  } else {
    body.style.background = '';
  }
}

interface SettingsStore {
  settings: AppSettings;
  update(partial: Partial<AppSettings>): void;
  load(): Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: loadFromLS(),

  update(partial) {
    const next = { ...get().settings, ...partial };
    set({ settings: next });
    saveToLS(next);
    applySettings(next);
    void storage.set('app_settings', JSON.stringify(next));
  },

  async load() {
    try {
      const raw = await storage.get('app_settings');
      if (raw) {
        const loaded = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) };
        set({ settings: loaded });
        saveToLS(loaded);
        applySettings(loaded);
        return;
      }
    } catch {/* ignore */}
    applySettings(get().settings);
  },
}));
