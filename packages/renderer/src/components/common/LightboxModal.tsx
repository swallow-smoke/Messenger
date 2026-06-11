import React, { useEffect } from 'react';

interface Props {
  src: string;
  alt?: string;
  onClose(): void;
}

export function LightboxModal({ src, alt, onClose }: Props): React.ReactElement {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleDownload(e: React.MouseEvent): void {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = src;
    a.download = alt ?? 'image';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl leading-none"
        onClick={onClose}
        aria-label="Close"
      >
        &times;
      </button>

      {/* Download */}
      <button
        className="absolute top-4 right-14 flex items-center gap-1.5 text-white/60 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
        onClick={handleDownload}
        aria-label="Download"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        다운로드
      </button>

      <img
        src={src}
        alt={alt ?? ''}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {alt && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm bg-black/50 px-3 py-1 rounded-full">
          {alt}
        </p>
      )}
    </div>
  );
}
