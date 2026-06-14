import React, { useEffect, useRef, useState } from 'react';

interface AtlasFrame {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function parseAtlas(json: unknown): AtlasFrame[] | null {
  if (typeof json !== 'object' || json === null) return null;
  const obj = json as Record<string, unknown>;

  if (Array.isArray(obj.frames)) {
    const frames: AtlasFrame[] = [];
    for (const f of obj.frames as Record<string, unknown>[]) {
      const fr = f.frame as Record<string, number> | undefined;
      if (!fr) continue;
      const name = String(f.filename ?? f.name ?? '');
      const x = Number(fr.x ?? 0), y = Number(fr.y ?? 0), w = Number(fr.w ?? 0), h = Number(fr.h ?? 0);
      if (w > 0 && h > 0) frames.push({ name, x, y, w, h });
    }
    return frames.length > 0 ? frames : null;
  }

  if (typeof obj.frames === 'object' && !Array.isArray(obj.frames) && obj.frames !== null) {
    const frames: AtlasFrame[] = [];
    for (const [name, data] of Object.entries(obj.frames as Record<string, unknown>)) {
      const fr = (data as Record<string, unknown>).frame as Record<string, number> | undefined;
      if (!fr) continue;
      const x = Number(fr.x ?? 0), y = Number(fr.y ?? 0), w = Number(fr.w ?? 0), h = Number(fr.h ?? 0);
      if (w > 0 && h > 0) frames.push({ name, x, y, w, h });
    }
    return frames.length > 0 ? frames : null;
  }

  return null;
}

function SpriteFrame({ imageUrl, frame }: { imageUrl: string; frame: AtlasFrame }): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = frame.w;
      canvas.height = frame.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
    };
    img.src = imageUrl;
  }, [imageUrl, frame]);

  const scale = Math.min(1, 64 / Math.max(frame.w, frame.h, 1));

  return (
    <div className="flex flex-col items-center gap-1 p-1 rounded hover:bg-white/10 cursor-pointer" title={frame.name}>
      <canvas
        ref={canvasRef}
        style={{ imageRendering: 'pixelated', width: frame.w * scale, height: frame.h * scale }}
      />
      <span className="text-[9px] text-white/30 truncate max-w-[60px]">{frame.name.replace(/\.[^.]+$/, '')}</span>
    </div>
  );
}

interface Props {
  imageUrl: string;
  atlasUrl: string;
  fileName: string;
  onClose(): void;
}

export function SpriteSheetModal({ imageUrl, atlasUrl, fileName, onClose }: Props): React.ReactElement {
  const [frames, setFrames] = useState<AtlasFrame[] | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(12);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(atlasUrl);
        const json: unknown = await res.json();
        const parsed = parseAtlas(json);
        if (!parsed) { setError('Atlas JSON 형식을 인식할 수 없습니다'); return; }
        setFrames(parsed);
      } catch {
        setError('Atlas 파일을 불러올 수 없습니다');
      }
    })();
  }, [atlasUrl]);

  useEffect(() => {
    if (!frames || !frames[selectedIdx]) return;
    const frame = frames[selectedIdx];
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = previewRef.current;
      if (!canvas) return;
      canvas.width = frame.w;
      canvas.height = frame.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, frame.w, frame.h);
      ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
    };
    img.src = imageUrl;
  }, [imageUrl, frames, selectedIdx]);

  useEffect(() => {
    if (!frames) return;
    if (playing) {
      intervalRef.current = setInterval(() => {
        setSelectedIdx((i) => (i + 1) % frames.length);
      }, 1000 / fps);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, fps, frames]);

  const selectedFrame = frames?.[selectedIdx];
  const previewScale = selectedFrame
    ? Math.min(4, 200 / Math.max(selectedFrame.w, selectedFrame.h, 1))
    : 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-surface border border-white/20 rounded-xl w-[700px] max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <span className="font-semibold text-sm">스프라이트 미리보기: {fileName}</span>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">&times;</button>
        </div>

        {error && <div className="p-8 text-center text-red-400">{error}</div>}

        {!frames && !error && <div className="p-8 text-center text-white/40">불러오는 중...</div>}

        {frames && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Frame grid */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex flex-wrap gap-1">
                {frames.map((frame, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedIdx(i); setPlaying(false); }}
                    className={`rounded border ${i === selectedIdx ? 'border-accent bg-accent/20' : 'border-white/10'}`}
                  >
                    <SpriteFrame imageUrl={imageUrl} frame={frame} />
                  </button>
                ))}
              </div>
            </div>

            {/* Preview panel */}
            <div className="w-56 flex-shrink-0 border-l border-white/10 p-4 flex flex-col gap-4 items-center">
              <div className="flex items-center justify-center bg-white/5 rounded-lg p-3" style={{ minHeight: 120 }}>
                {selectedFrame && (
                  <canvas
                    ref={previewRef}
                    style={{
                      imageRendering: 'pixelated',
                      width: selectedFrame.w * previewScale,
                      height: selectedFrame.h * previewScale,
                    }}
                  />
                )}
              </div>
              {selectedFrame && (
                <div className="text-xs text-white/40 text-center">
                  <div className="font-medium text-white/70 truncate max-w-full">{selectedFrame.name}</div>
                  <div>{selectedFrame.w}×{selectedFrame.h}px</div>
                  <div>{selectedIdx + 1} / {frames.length}</div>
                </div>
              )}
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>FPS: {fps}</span>
                  <input
                    type="range"
                    min={1}
                    max={60}
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    className="w-24 accent-accent"
                  />
                </div>
                <button
                  onClick={() => setPlaying((v) => !v)}
                  className={`w-full py-1.5 rounded-lg text-sm transition-colors ${
                    playing ? 'bg-accent/20 text-accent border border-accent/40' : 'bg-white/10 hover:bg-white/15'
                  }`}
                >
                  {playing ? '■ 정지' : '▶ 재생'}
                </button>
              </div>
            </div>
          </div>
        )}

        {frames && (
          <div className="px-4 py-2 border-t border-white/10 text-xs text-white/40 flex-shrink-0">
            {frames.length}개 프레임
          </div>
        )}
      </div>
    </div>
  );
}
