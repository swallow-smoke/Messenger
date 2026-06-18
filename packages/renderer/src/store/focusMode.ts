import { create } from 'zustand';

const STORAGE_KEY = 'focusMode';

export const FOCUS_STATUS_TEXT = '🎯 Focusing';
// Focus mode reuses the 'dnd' presence so others see do-not-disturb while focusing.
export const FOCUS_STATUS = 'dnd';

export interface FocusSnapshot {
  endsAt: number;
  durationMin: number;
  prevStatus: string;
  prevStatusText: string | null;
}

interface FocusModeState {
  active: boolean;
  endsAt: number | null;
  durationMin: number | null;
  prevStatus: string | null;
  prevStatusText: string | null;
  begin(snapshot: FocusSnapshot): void;
  clear(): void;
}

function persist(state: FocusModeState): void {
  try {
    if (state.active && state.endsAt) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          endsAt: state.endsAt,
          durationMin: state.durationMin,
          prevStatus: state.prevStatus,
          prevStatusText: state.prevStatusText,
        })
      );
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore quota / unavailable storage */
  }
}

function hydrate(): Pick<FocusModeState, 'active' | 'endsAt' | 'durationMin' | 'prevStatus' | 'prevStatusText'> {
  const empty = { active: false, endsAt: null, durationMin: null, prevStatus: null, prevStatusText: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as FocusSnapshot;
    if (!parsed.endsAt) return empty;
    return {
      active: true,
      endsAt: parsed.endsAt,
      durationMin: parsed.durationMin ?? null,
      prevStatus: parsed.prevStatus ?? 'online',
      prevStatusText: parsed.prevStatusText ?? null,
    };
  } catch {
    return empty;
  }
}

export const useFocusModeStore = create<FocusModeState>((set, get) => ({
  ...hydrate(),

  begin(snapshot) {
    set({
      active: true,
      endsAt: snapshot.endsAt,
      durationMin: snapshot.durationMin,
      prevStatus: snapshot.prevStatus,
      prevStatusText: snapshot.prevStatusText,
    });
    persist(get());
  },

  clear() {
    set({ active: false, endsAt: null, durationMin: null, prevStatus: null, prevStatusText: null });
    persist(get());
  },
}));
