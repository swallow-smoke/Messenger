import { Server } from 'socket.io';
import { prisma } from '../lib/prisma';

function nowHHMM(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function inWindow(cur: string, start: string, end: string): boolean {
  // Same-day window when start <= end; otherwise an overnight window that wraps midnight.
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
}

// Runs every minute: applies any matching active schedule to the user's presence
// statusText. Only writes when the text actually changes (idempotent, avoids spam).
async function tick(io: Server): Promise<void> {
  try {
    const now = new Date();
    const day = now.getDay();
    const cur = nowHHMM(now);

    const schedules = await prisma.statusSchedule.findMany({ where: { isActive: true } });
    for (const s of schedules) {
      if (s.dayOfWeek !== null && s.dayOfWeek !== day) continue;
      if (!inWindow(cur, s.startTime, s.endTime)) continue;

      const statusText = s.statusEmoji ? `${s.statusEmoji} ${s.statusText}` : s.statusText;
      const user = await prisma.user.findUnique({
        where: { id: s.userId },
        select: { status: true, statusText: true },
      });
      if (!user || user.statusText === statusText) continue;

      await prisma.user.update({ where: { id: s.userId }, data: { statusText } });
      io.emit('presence:update', { userId: s.userId, status: user.status, statusText });
    }
  } catch (err) {
    console.error('status-scheduler tick error', err);
  }
}

export function startStatusScheduler(io: Server): void {
  setInterval(() => void tick(io), 60_000);
  void tick(io);
}
