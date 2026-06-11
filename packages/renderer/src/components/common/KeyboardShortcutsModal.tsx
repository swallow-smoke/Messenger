import React, { useEffect } from 'react';

interface Props {
  onClose(): void;
}

const SHORTCUTS = [
  { keys: 'Ctrl+K', desc: '명령 팔레트 열기' },
  { keys: 'Ctrl+/', desc: '단축키 도움말' },
  { keys: 'Ctrl+F', desc: '채널 내 메시지 검색' },
  { keys: 'Ctrl+Shift+F', desc: '전체 메시지 검색' },
  { keys: 'Ctrl+Shift+G', desc: '앱 창 토글 (숨기기/보이기)' },
  { keys: 'Enter', desc: '메시지 전송' },
  { keys: 'Shift+Enter', desc: '줄 바꿈' },
  { keys: 'Esc', desc: '편집 취소 / 모달 닫기' },
  { keys: '↑', desc: '마지막 메시지 편집' },
  { keys: 'Ctrl+B', desc: '굵게 (메시지 입력 중)' },
  { keys: 'Ctrl+I', desc: '기울임 (메시지 입력 중)' },
];

export function KeyboardShortcutsModal({ onClose }: Props): React.ReactElement {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-white/15 rounded-xl p-6 w-96 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">키보드 단축키</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="space-y-1">
          {SHORTCUTS.map(({ keys, desc }) => (
            <div key={keys} className="flex items-center justify-between py-1.5">
              <span className="text-white/70 text-sm">{desc}</span>
              <kbd className="text-xs bg-white/10 border border-white/20 rounded px-2 py-0.5 text-white/60 font-mono">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
