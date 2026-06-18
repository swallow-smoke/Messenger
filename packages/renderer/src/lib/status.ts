import { getSocket } from './socket';
import { useAuthStore } from '../store/auth';

// Single place that pushes a status change both to the local auth store and the
// server (presence system). Used by the status menu and the focus-mode timer.
export function setUserStatus(status: string, statusText?: string): void {
  useAuthStore.getState().updateStatus(status, statusText);
  getSocket().emit('status:set', { status, statusText });
}
