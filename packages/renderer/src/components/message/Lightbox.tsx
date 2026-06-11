import React, { useState, useEffect, useCallback } from 'react';

export interface LightboxImage {
  src: string;
  fileName: string;
  fileSize: number;
}

interface Props {
  images: LightboxImage[];
  initialIndex: number;
  onClose(): void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Lightbox({ images, initialIndex, onClose }: Props): React.ReactElement {
  const [index, setIndex] = useState(initialIndex);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const current = images[index];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  const prev = useCallback(() => {
    if (hasPrev) { setIndex((i) => i - 1); setDimensions(null); }
  }, [hasPrev]);

  const next = useCallback(() => {
    if (hasNext) { setIndex((i) => i + 1); setDimensions(null); }
  }, [hasNext]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next]);

  function handleDownload(e: React.MouseEvent): void {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = current.src;
    a.download = current.fileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleOpenExternal(e: React.MouseEvent): void {
    e.stopPropagation();
    if (window.electron?.shell) void window.electron.shell.openExternal(current.src);
    else window.open(current.src, '_blank');
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col min-w-0 mr-4">
          <span className="text-white text-sm font-medium truncate">{current.fileName}</span>
          <span className="text-white/50 text-xs">{formatFileSize(current.fileSize)}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleDownload}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="다운로드"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button
            onClick={handleOpenExternal}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="브라우저에서 열기"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="닫기"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Image */}
      <img
        src={current.src}
        alt={current.fileName}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onLoad={(e) => {
          const img = e.currentTarget;
          setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
        }}
      />

      {/* Left arrow */}
      {hasPrev && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/70 text-white rounded-full transition-colors"
          onClick={(e) => { e.stopPropagation(); prev(); }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Right arrow */}
      {hasNext && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/70 text-white rounded-full transition-colors"
          onClick={(e) => { e.stopPropagation(); next(); }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Bottom bar */}
      <div className="absolute bottom-0 inset-x-0 flex items-center justify-center py-3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
        {dimensions ? (
          <span className="text-white/50 text-xs">{dimensions.w} × {dimensions.h}</span>
        ) : (
          images.length > 1 && (
            <span className="text-white/40 text-xs">{index + 1} / {images.length}</span>
          )
        )}
      </div>
    </div>
  );
}
