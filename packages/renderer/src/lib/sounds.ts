export type SoundId = 'default' | 'ding' | 'pop' | 'chime' | 'none';

export const SOUND_OPTIONS: { id: SoundId; label: string }[] = [
  { id: 'default', label: '기본' },
  { id: 'ding', label: '딩' },
  { id: 'pop', label: '팝' },
  { id: 'chime', label: '차임' },
  { id: 'none', label: '없음' },
];

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === 'suspended') void _ctx.resume();
  return _ctx;
}

function tone(freq: number, duration: number, vol = 0.12, type: OscillatorType = 'sine', delay = 0): void {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

export function playSound(soundId: SoundId): void {
  try {
    if (soundId === 'none') return;
    if (soundId === 'default') {
      tone(660, 0.12);
    } else if (soundId === 'ding') {
      tone(880, 0.18, 0.14);
    } else if (soundId === 'pop') {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.09);
    } else if (soundId === 'chime') {
      tone(528, 0.2, 0.1, 'sine', 0);
      tone(660, 0.2, 0.08, 'sine', 0.12);
      tone(792, 0.28, 0.07, 'sine', 0.24);
    }
  } catch {
    // AudioContext unavailable
  }
}
