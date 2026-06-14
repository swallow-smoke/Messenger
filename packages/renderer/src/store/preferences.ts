import { create } from 'zustand';
import api from '../lib/api';

export interface UserPreferences {
  enableCodeHighlight: boolean;
  enable3DPreview: boolean;
  keywords: string[];
}

interface PreferencesState {
  prefs: UserPreferences;
  loaded: boolean;
  load(): Promise<void>;
  update(partial: Partial<UserPreferences>): Promise<void>;
}

const DEFAULTS: UserPreferences = {
  enableCodeHighlight: true,
  enable3DPreview: true,
  keywords: [],
};

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  prefs: { ...DEFAULTS },
  loaded: false,

  async load() {
    try {
      const { data } = await api.get<{ enableCodeHighlight: boolean; enable3DPreview: boolean; keywords: string[] }>('/preferences');
      set({
        prefs: {
          enableCodeHighlight: data.enableCodeHighlight,
          enable3DPreview: data.enable3DPreview,
          keywords: data.keywords ?? [],
        },
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },

  async update(partial) {
    const optimistic = { ...get().prefs, ...partial };
    set({ prefs: optimistic });
    try {
      await api.patch('/preferences', partial);
    } catch {
      set({ prefs: get().prefs });
    }
  },
}));
