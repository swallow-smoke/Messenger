type Subscriber = (line: string) => void;

const MAX_LINES = 500;
const ringBuffer: string[] = [];
const subscribers = new Set<Subscriber>();

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');
}

function push(line: string): void {
  ringBuffer.push(line);
  if (ringBuffer.length > MAX_LINES) ringBuffer.shift();
  for (const sub of subscribers) sub(line);
}

function fmt(level: string, args: unknown[]): string {
  const ts = new Date().toISOString().slice(11, 23);
  const msg = args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ');
  return `[${ts}] [${level}] ${msg}`;
}

/* preserve originals before overriding so we can still write to the terminal */
const _log   = console.log.bind(console);   // eslint-disable-line no-console
const _error = console.error.bind(console); // eslint-disable-line no-console
const _warn  = console.warn.bind(console);  // eslint-disable-line no-console
const _info  = console.info.bind(console);  // eslint-disable-line no-console

/* eslint-disable no-console */
console.log = (...args: unknown[]): void => {
  const line = fmt('INFO', args);
  _log(line);
  push(line);
};
console.error = (...args: unknown[]): void => {
  const line = fmt('ERROR', args);
  _error(line);
  push(line);
};
console.warn = (...args: unknown[]): void => {
  const line = fmt('WARN', args);
  _warn(line);
  push(line);
};
console.info = (...args: unknown[]): void => {
  const line = fmt('INFO', args);
  _info(line);
  push(line);
};
/* eslint-enable no-console */

/** Pass this to morgan({ stream }) to capture HTTP logs in the ring buffer. */
export const morganStream = {
  write(str: string): void {
    const raw = str.trimEnd();
    _log(raw);               // keep colored output in the terminal
    push(stripAnsi(raw));    // store clean version in ring buffer
  },
};

export function getRingBuffer(): readonly string[] {
  return ringBuffer;
}

export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => { subscribers.delete(fn); };
}
