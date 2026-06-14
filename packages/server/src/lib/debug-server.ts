import express, { type Request, type Response } from 'express';
import http from 'http';
import { getRingBuffer, subscribe } from './debug-logger';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GameDev Messenger — Debug Logs</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0d1117;color:#e6edf3;font-family:'Cascadia Code','Fira Code','Consolas',monospace;font-size:12.5px;height:100vh;display:flex;flex-direction:column;overflow:hidden}
  #toolbar{display:flex;gap:8px;align-items:center;padding:7px 12px;background:#161b22;border-bottom:1px solid #30363d;flex-shrink:0}
  #filter{background:#21262d;border:1px solid #30363d;color:#e6edf3;padding:4px 9px;border-radius:5px;font:inherit;flex:1;min-width:0;outline:none}
  #filter:focus{border-color:#58a6ff}
  button{background:#21262d;border:1px solid #30363d;color:#e6edf3;padding:4px 11px;border-radius:5px;cursor:pointer;font-size:12px;white-space:nowrap}
  button:hover{background:#30363d}
  #pauseBtn.active{background:#1f6feb;border-color:#388bfd;color:#fff}
  #status{display:flex;align-items:center;gap:6px;font-size:11px;color:#8b949e;margin-left:auto;white-space:nowrap}
  #dot{width:8px;height:8px;border-radius:50%;background:#3fb950;flex-shrink:0;transition:background .3s}
  #dot.off{background:#f85149}
  #logs{flex:1;overflow-y:auto;padding:6px 12px 12px;display:flex;flex-direction:column;gap:0}
  .ln{padding:1px 0;white-space:pre-wrap;word-break:break-all;line-height:1.55}
  .error{color:#f85149}
  .warn{color:#d29922}
  .prisma{color:#39c5cf}
  .http2{color:#3fb950}
  .http4{color:#d29922}
  .http5{color:#f85149}
  .info{color:#c9d1d9}
</style>
</head>
<body>
<div id="toolbar">
  <input id="filter" type="text" placeholder="Filter logs…" autocomplete="off" spellcheck="false" />
  <button id="clearBtn">Clear</button>
  <button id="pauseBtn">Pause</button>
  <div id="status"><div id="dot"></div><span id="statusTxt">Connecting…</span></div>
</div>
<div id="logs"></div>
<script>
(function(){
  const logsEl  = document.getElementById('logs');
  const filterEl = document.getElementById('filter');
  const clearBtn = document.getElementById('clearBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const dot       = document.getElementById('dot');
  const statusTxt = document.getElementById('statusTxt');

  let paused = false;
  let lines  = [];
  let kw     = '';

  function classify(line) {
    if (/\[ERROR\]/.test(line))  return 'error';
    if (/\[WARN\]/.test(line))   return 'warn';
    if (/prisma:query/i.test(line)) return 'prisma';
    // Morgan HTTP line: METHOD /path STATUS ms
    const m = line.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \S+ (\d{3}) /);
    if (m) {
      const c = +m[2];
      if (c >= 500) return 'http5';
      if (c >= 400) return 'http4';
      if (c >= 200) return 'http2';
    }
    return 'info';
  }

  function makeEl(text) {
    const d = document.createElement('div');
    d.className = 'ln ' + classify(text);
    d.textContent = text;
    return d;
  }

  function scrollBottom() {
    if (!paused) logsEl.scrollTop = logsEl.scrollHeight;
  }

  function render() {
    logsEl.innerHTML = '';
    const show = kw ? lines.filter(l => l.toLowerCase().includes(kw)) : lines;
    const frag = document.createDocumentFragment();
    show.forEach(l => frag.appendChild(makeEl(l)));
    logsEl.appendChild(frag);
    scrollBottom();
  }

  function addLine(line) {
    lines.push(line);
    if (lines.length > 500) lines.shift();
    if (kw && !line.toLowerCase().includes(kw)) return;
    logsEl.appendChild(makeEl(line));
    scrollBottom();
  }

  filterEl.addEventListener('input', function() {
    kw = this.value.toLowerCase();
    render();
  });

  clearBtn.addEventListener('click', function() {
    logsEl.innerHTML = '';
  });

  pauseBtn.addEventListener('click', function() {
    paused = !paused;
    pauseBtn.classList.toggle('active', paused);
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    if (!paused) scrollBottom();
  });

  function setStatus(ok) {
    dot.className = ok ? '' : 'off';
    statusTxt.textContent = ok ? 'Connected' : 'Disconnected — reconnecting…';
  }

  // Load history first
  fetch('/logs')
    .then(function(r){ return r.json(); })
    .then(function(data){ lines = data; render(); })
    .catch(function(){});

  // Live stream via SSE
  var es;
  function connect() {
    es = new EventSource('/logs/stream');
    es.onopen  = function(){ setStatus(true); };
    es.onmessage = function(e){ addLine(e.data); };
    es.onerror = function(){
      setStatus(false);
      es.close();
      setTimeout(connect, 3000);
    };
  }
  connect();
})();
</script>
</body>
</html>`;

export function startDebugServer(port = 9999): void {
  if (process.env.NODE_ENV === 'production') return;

  const app = express();

  app.use((_req: Request, res: Response, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });

  app.get('/', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(HTML);
  });

  app.get('/logs', (_req: Request, res: Response) => {
    res.json(getRingBuffer());
  });

  app.get('/logs/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const unsubscribe = subscribe((line: string) => {
      res.write(`data: ${line}\n\n`);
    });

    req.on('close', () => { unsubscribe(); });
  });

  const srv = http.createServer(app);
  srv.on('error', (err: NodeJS.ErrnoException) => {
    process.stderr.write(`[debug-server] port ${port} unavailable: ${err.message}\n`);
  });
  srv.listen(port, () => {
    console.log(`Debug log viewer → http://localhost:${port}`);
  });
}
