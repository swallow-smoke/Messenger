import { useEffect } from 'react';
import { useFocusModeStore } from '../store/focusMode';
import { setUserStatus } from '../lib/status';

// Mounted once (in AppShell). Watches focus mode and restores the previous status
// when the timer elapses. Re-arms after a page refresh from the persisted endsAt.
export function useFocusTimer(): void {
  const active = useFocusModeStore((s) => s.active);
  const endsAt = useFocusModeStore((s) => s.endsAt);

  useEffect(() => {
    if (!active || !endsAt) return;

    function restore(): void {
      const { prevStatus, prevStatusText, clear } = useFocusModeStore.getState();
      setUserStatus(prevStatus ?? 'online', prevStatusText ?? undefined);
      clear();
    }

    const remaining = endsAt - Date.now();
    if (remaining <= 0) {
      restore();
      return;
    }
    const id = setTimeout(restore, remaining);
    return () => clearTimeout(id);
  }, [active, endsAt]);
}
