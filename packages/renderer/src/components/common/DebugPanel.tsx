import React, { Component, useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Lightbox } from '../message/Lightbox';
import type { LightboxImage } from '../message/Lightbox';

const FBXPreview = lazy(() =>
  import('../message/FBXModelPreview').then((m) => ({ default: m.FBXModelPreview }))
);

// ── Types ────────────────────────────────────────────────────────────────────

type FileType = 'auto' | 'image' | 'glb' | 'gltf' | 'fbx' | 'code' | 'markdown' | 'generic';
type PanelTab = 'logs' | 'preview';

interface NetEntry {
  url: string;
  status: number | null;
  duration: number;
  ok: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const CODE_LANG_MAP: Record<string, string> = {
  cs: 'csharp', js: 'javascript', ts: 'typescript', jsx: 'jsx', tsx: 'tsx', json: 'json',
};

function autoDetect(url: string): Exclude<FileType, 'auto'> {
  const ext = url.toLowerCase().split('?')[0].split('.').pop() ?? '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif'].includes(ext)) return 'image';
  if (ext === 'glb') return 'glb';
  if (ext === 'gltf') return 'gltf';
  if (ext === 'fbx') return 'fbx';
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  if (ext in CODE_LANG_MAP) return 'code';
  return 'generic';
}

function resolveType(url: string, sel: FileType): Exclude<FileType, 'auto'> {
  return sel === 'auto' ? autoDetect(url) : sel;
}

function prettyHtml(raw: string): string {
  let depth = 0;
  const lines: string[] = [];
  const parts = raw.replace(/>\s*</g, '><').split(/(?<=>)(?=<)/);
  for (const chunk of parts) {
    const t = chunk.trim();
    if (!t) continue;
    const isClose = t.startsWith('</');
    const isSelf =
      t.endsWith('/>') ||
      /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)[\s/>]/i.test(t);
    if (isClose) depth = Math.max(0, depth - 1);
    lines.push('  '.repeat(depth) + t);
    if (!isClose && !isSelf && /^<[a-z]/i.test(t)) depth++;
  }
  return lines.join('\n');
}

function classifyLog(line: string): string {
  if (/\[ERROR\]/.test(line)) return 'text-red-400';
  if (/\[WARN\]/.test(line)) return 'text-yellow-400';
  if (/prisma:query/i.test(line)) return 'text-cyan-400';
  const m = line.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \S+ (\d{3}) /);
  if (m) {
    const c = +m[2];
    if (c >= 500) return 'text-red-400';
    if (c >= 400) return 'text-yellow-400';
    if (c >= 200) return 'text-green-400';
  }
  return 'text-white/70';
}

function extractUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

// ── Error Boundary (Part A) ──────────────────────────────────────────────────

interface EBState { error: Error | null; }

class PreviewErrorBoundary extends Component<{ children: React.ReactNode }, EBState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: Error): EBState { return { error: err }; }
  render(): React.ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg space-y-1 font-mono text-[11px]">
          <div className="text-red-400 font-semibold">Render Error</div>
          <pre className="text-red-300/80 whitespace-pre-wrap break-all">{error.message}</pre>
          {error.stack && (
            <pre className="text-red-300/40 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
              {error.stack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Preview sub-components (same rendering logic as MessageItem) ─────────────

function ImagePreview({ url }: { url: string }): React.ReactElement {
  const [lb, setLb] = useState(false);
  const [failed, setFailed] = useState(false);
  const images: LightboxImage[] = [
    { src: url, fileName: url.split('/').pop()?.split('?')[0] ?? url, fileSize: 0 },
  ];

  if (failed) {
    return (
      <div className="text-red-400 text-xs p-2 bg-red-500/10 border border-red-500/20 rounded break-all">
        Image load failed: {url}
      </div>
    );
  }
  return (
    <>
      {lb && <Lightbox images={images} initialIndex={0} onClose={() => setLb(false)} />}
      <img
        src={url}
        alt="preview"
        className="max-w-full max-h-72 object-contain rounded cursor-zoom-in hover:opacity-90 transition-opacity"
        onClick={() => setLb(true)}
        onError={() => setFailed(true)}
      />
    </>
  );
}

function ModelViewerLocal({ fileUrl, fileName }: { fileUrl: string; fileName: string }): React.ReactElement {
  return (
    <div className="rounded-lg overflow-hidden border border-white/10 bg-black/30" style={{ width: '100%', height: 280 }}>
      <model-viewer
        src={fileUrl}
        alt={fileName}
        camera-controls=""
        auto-rotate=""
        shadow-intensity="1"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

function CodePreview({ url }: { url: string }): React.ReactElement {
  const [content, setContent] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const lang = CODE_LANG_MAP[ext] ?? 'text';

  useEffect(() => {
    setContent(null);
    setErr(false);
    fetch(url).then((r) => r.text()).then(setContent).catch(() => setErr(true));
  }, [url]);

  if (err) return <p className="text-red-400 text-xs">코드 파일 로드 실패</p>;
  if (!content) return <p className="text-white/40 text-xs">로드 중...</p>;
  return (
    <SyntaxHighlighter
      style={oneDark}
      language={lang}
      showLineNumbers
      PreTag="div"
      customStyle={{ fontSize: '0.7rem', maxHeight: 260, margin: 0, borderRadius: 8 }}
    >
      {content}
    </SyntaxHighlighter>
  );
}

function MarkdownPreview({ url }: { url: string }): React.ReactElement {
  const [content, setContent] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setContent(null);
    setErr(false);
    fetch(url).then((r) => r.text()).then(setContent).catch(() => setErr(true));
  }, [url]);

  if (err) return <p className="text-red-400 text-xs">마크다운 파일 로드 실패</p>;
  if (!content) return <p className="text-white/40 text-xs">로드 중...</p>;
  return (
    <div className="prose prose-invert prose-xs max-w-none text-xs max-h-64 overflow-y-auto">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function GenericPreview({ url }: { url: string }): React.ReactElement {
  const name = url.split('/').pop()?.split('?')[0] ?? url;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => { e.preventDefault(); window.open(url, '_blank'); }}
      className="inline-flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
    >
      <span>📎</span>
      <div>
        <div className="font-medium">{name}</div>
        <div className="text-white/40 text-[10px]">클릭하여 열기</div>
      </div>
    </a>
  );
}

function PreviewRenderer({ url, type }: { url: string; type: Exclude<FileType, 'auto'> }): React.ReactElement {
  const fileName = url.split('/').pop()?.split('?')[0] ?? 'file';

  if (type === 'image') return <ImagePreview url={url} />;
  if (type === 'glb' || type === 'gltf') return <ModelViewerLocal fileUrl={url} fileName={fileName} />;
  if (type === 'fbx') {
    return (
      <Suspense fallback={<p className="text-white/40 text-xs">FBX 로드 중...</p>}>
        <FBXPreview fileUrl={url} fileName={fileName} />
      </Suspense>
    );
  }
  if (type === 'code') return <CodePreview url={url} />;
  if (type === 'markdown') return <MarkdownPreview url={url} />;
  return <GenericPreview url={url} />;
}

// ── Panel implementation (all hooks live here) ───────────────────────────────

function DebugPanelImpl(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>('logs');

  // Logs tab
  const [logs, setLogs] = useState<string[]>([]);
  const [logFilter, setLogFilter] = useState('');
  const [logPaused, setLogPaused] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Preview tab
  const [url, setUrl] = useState('');
  const [fileType, setFileType] = useState<FileType>('auto');
  const [renderKey, setRenderKey] = useState(0);
  const [activeUrl, setActiveUrl] = useState('');
  const [activeType, setActiveType] = useState<Exclude<FileType, 'auto'>>('generic');
  const [htmlSource, setHtmlSource] = useState('');
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [netLog, setNetLog] = useState<NetEntry[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const origFetchRef = useRef<typeof window.fetch | null>(null);

  // Logs tab: connect SSE when open
  useEffect(() => {
    if (!open || tab !== 'logs') return;
    fetch('http://localhost:9999/logs')
      .then((r) => r.json() as Promise<unknown>)
      .then((data) => { if (Array.isArray(data)) setLogs(data as string[]); })
      .catch(() => {});
    const es = new EventSource('http://localhost:9999/logs/stream');
    es.onmessage = (e) => { setLogs((prev) => [...prev.slice(-499), e.data as string]); };
    return () => es.close();
  }, [open, tab]);

  // Auto-scroll log output
  useEffect(() => {
    if (!logPaused && tab === 'logs') {
      logsEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [logs, logPaused, tab]);

  // Part C: patch window.fetch while panel is open to capture network requests
  useEffect(() => {
    if (!open) return;
    const orig = window.fetch.bind(window) as typeof window.fetch;
    origFetchRef.current = orig;

    window.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const urlStr = extractUrl(input);
      // Skip debug server's own requests to avoid noise
      if (urlStr.includes(':9999')) return orig(input, init);
      const t0 = performance.now();
      try {
        const resp = await orig(input, init);
        setNetLog((prev) => [
          ...prev,
          { url: urlStr, status: resp.status, duration: performance.now() - t0, ok: resp.ok },
        ]);
        return resp;
      } catch (err) {
        setNetLog((prev) => [
          ...prev,
          { url: urlStr, status: null, duration: performance.now() - t0, ok: false },
        ]);
        throw err;
      }
    }) as typeof window.fetch;

    return () => {
      if (origFetchRef.current) {
        window.fetch = origFetchRef.current;
        origFetchRef.current = null;
      }
    };
  }, [open]);

  // Part B: capture rendered HTML after component settles post-render
  useEffect(() => {
    if (!activeUrl) return;
    const id = setTimeout(() => {
      if (previewRef.current) {
        setHtmlSource(prettyHtml(previewRef.current.innerHTML));
      }
    }, 600);
    return () => clearTimeout(id);
  }, [renderKey, activeUrl]);

  function handleRender(): void {
    const trimmed = url.trim();
    if (!trimmed) return;
    setNetLog([]);
    setHtmlSource('');
    setHtmlOpen(false);
    setActiveType(resolveType(trimmed, fileType));
    setActiveUrl(trimmed);
    setRenderKey((k) => k + 1);
  }

  const filteredLogs = logFilter
    ? logs.filter((l) => l.toLowerCase().includes(logFilter.toLowerCase()))
    : logs;

  return (
    <>
      {/* Collapsed: floating bug button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Debug Panel (dev only)"
          className="fixed bottom-4 left-4 z-[9999] w-9 h-9 rounded-full bg-[#161b22] border border-white/20 shadow-lg flex items-center justify-center text-lg hover:bg-white/10 transition-colors"
        >
          🐛
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div
          className="fixed bottom-4 left-4 z-[9999] flex flex-col bg-[#0d1117] border border-white/15 rounded-xl shadow-2xl overflow-hidden"
          style={{ width: 500, height: 540 }}
        >
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-3 py-2 bg-[#161b22] border-b border-white/10 flex-shrink-0">
            <span className="text-sm mr-1 select-none">🐛</span>
            {(['logs', 'preview'] as PanelTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 text-xs rounded-md transition-colors capitalize ${
                  tab === t
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                {t}
              </button>
            ))}
            <button
              onClick={() => setOpen(false)}
              className="ml-auto text-white/40 hover:text-white text-base leading-none px-1"
            >
              ×
            </button>
          </div>

          {/* ── LOGS TAB ── */}
          {tab === 'logs' && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex gap-2 px-3 py-2 border-b border-white/10 flex-shrink-0">
                <input
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  placeholder="Filter…"
                  className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-white/80 font-mono outline-none focus:border-white/30"
                />
                <button
                  onClick={() => setLogs([])}
                  className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[11px] text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => setLogPaused((v) => !v)}
                  className={`px-2 py-1 border rounded text-[11px] transition-colors ${
                    logPaused
                      ? 'bg-accent/20 border-accent/40 text-accent'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {logPaused ? 'Resume' : 'Pause'}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px]">
                {filteredLogs.map((line, i) => (
                  <div
                    key={i}
                    className={`whitespace-pre-wrap break-all leading-[1.6] ${classifyLog(line)}`}
                  >
                    {line}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* ── PREVIEW TAB ── */}
          {tab === 'preview' && (
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
              {/* Controls */}
              <div className="flex gap-2 px-3 py-2 border-b border-white/10 flex-shrink-0">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRender(); }}
                  placeholder="Paste file URL…"
                  className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-white/80 font-mono outline-none focus:border-white/30 min-w-0"
                />
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value as FileType)}
                  className="bg-[#161b22] border border-white/10 rounded px-1.5 py-1 text-[11px] text-white/80 outline-none cursor-pointer"
                >
                  <option value="auto">Auto</option>
                  <option value="image">Image</option>
                  <option value="glb">GLB</option>
                  <option value="gltf">GLTF</option>
                  <option value="fbx">FBX</option>
                  <option value="code">Code</option>
                  <option value="markdown">Markdown</option>
                  <option value="generic">Generic</option>
                </select>
                <button
                  onClick={handleRender}
                  className="px-3 py-1 bg-accent/20 hover:bg-accent/40 text-accent border border-accent/30 rounded text-[11px] font-medium transition-colors whitespace-nowrap"
                >
                  Render
                </button>
              </div>

              <div className="flex-1 px-3 py-3 space-y-3">
                {/* Preview output — ErrorBoundary key resets on each Render click */}
                {activeUrl ? (
                  <div ref={previewRef}>
                    <PreviewErrorBoundary key={renderKey}>
                      <PreviewRenderer url={activeUrl} type={activeType} />
                    </PreviewErrorBoundary>
                  </div>
                ) : (
                  <div className="text-white/25 text-xs text-center py-8">
                    Paste a URL and click Render
                  </div>
                )}

                {/* Part B: HTML inspector */}
                {activeUrl && (
                  <div className="border border-white/10 rounded-lg overflow-hidden text-[11px]">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10">
                      <button
                        onClick={() => {
                          if (!htmlOpen && previewRef.current) {
                            setHtmlSource(prettyHtml(previewRef.current.innerHTML));
                          }
                          setHtmlOpen((v) => !v);
                        }}
                        className="text-white/60 hover:text-white flex items-center gap-1.5 transition-colors"
                      >
                        <span className={`text-[9px] transition-transform inline-block ${htmlOpen ? 'rotate-90' : ''}`}>
                          ▶
                        </span>
                        Rendered HTML
                      </button>
                      <button
                        onClick={() => { void navigator.clipboard.writeText(htmlSource); }}
                        className="text-white/40 hover:text-white/70 px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
                      >
                        Copy HTML
                      </button>
                    </div>
                    {htmlOpen && (
                      <pre className="text-[10px] font-mono text-white/60 p-3 max-h-36 overflow-auto whitespace-pre-wrap break-all bg-black/20 leading-[1.5]">
                        {htmlSource || '(capturing…)'}
                      </pre>
                    )}
                  </div>
                )}

                {/* Part C: Network request log */}
                {netLog.length > 0 && (
                  <div className="border border-white/10 rounded-lg overflow-hidden text-[11px]">
                    <div className="px-3 py-1.5 bg-white/5 border-b border-white/10 text-white/50">
                      Network ({netLog.length})
                    </div>
                    <div className="max-h-32 overflow-y-auto divide-y divide-white/5">
                      {netLog.map((entry, i) => (
                        <div key={i} className="flex items-start gap-2 px-3 py-1.5 font-mono">
                          <span
                            className={`flex-shrink-0 font-bold w-8 ${
                              entry.status === null ? 'text-red-400'
                              : entry.ok ? 'text-green-400'
                              : entry.status >= 500 ? 'text-red-400'
                              : 'text-yellow-400'
                            }`}
                          >
                            {entry.status ?? 'ERR'}
                          </span>
                          <span className="text-white/35 flex-shrink-0 w-12 text-right">
                            {entry.duration.toFixed(0)}ms
                          </span>
                          <span className="text-white/60 break-all">{entry.url}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Public export: no-op in production ───────────────────────────────────────

export function DebugPanel(): React.ReactElement | null {
  if (!import.meta.env.DEV) return null;
  return <DebugPanelImpl />;
}
