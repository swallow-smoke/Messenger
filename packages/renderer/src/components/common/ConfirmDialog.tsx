import React from 'react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  danger = false,
  onConfirm,
  onCancel,
}: Props): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="bg-surface border border-white/15 rounded-xl p-6 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-white mb-2">{title}</h3>
        <p className="text-white/60 text-sm mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded text-sm text-white/70 hover:bg-white/10 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-1.5 rounded text-sm text-white transition-colors ${
              danger
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-accent hover:bg-accent/80'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
