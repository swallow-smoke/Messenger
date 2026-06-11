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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl leading-none"
        onClick={onClose}
        aria-label="Close"
      >
        &times;
      </button>
      <img
        src={src}
        alt={alt ?? ''}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
