import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Props {
  workspaceId: string;
  workspaceName: string;
  onClose(): void;
}

export function InviteModal({ workspaceId, workspaceName, onClose }: Props): React.ReactElement {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.post<{ inviteToken: string }>(`/workspaces/${workspaceId}/invite`)
      .then(({ data }) => setToken(data.inviteToken))
      .catch(() => toast.error('초대 코드 생성 실패'))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  function copyCode() {
    void navigator.clipboard.writeText(token).then(() => toast.success('초대 코드 복사됨'));
  }

  function copyLink() {
    const link = `${window.location.origin}#join/${token}`;
    void navigator.clipboard.writeText(link).then(() => toast.success('초대 링크 복사됨'));
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface border border-white/10 rounded-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">초대하기</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <p className="text-sm text-white/50 mb-4">
          아래 코드나 링크를 공유하여 <span className="text-white/80 font-medium">{workspaceName}</span>에 초대하세요.
          코드는 24시간 후 만료됩니다.
        </p>
        {loading ? (
          <div className="text-center py-4 text-white/30 text-sm">생성 중...</div>
        ) : token ? (
          <>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-3 flex items-center justify-between gap-2">
              <span className="font-mono text-sm text-white/90 tracking-widest break-all">{token}</span>
              <button
                onClick={copyCode}
                className="flex-shrink-0 px-3 py-1 bg-accent/20 hover:bg-accent/40 text-accent rounded text-xs transition-colors"
              >
                복사
              </button>
            </div>
            <button
              onClick={copyLink}
              className="w-full py-2 text-sm text-white/60 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors"
            >
              초대 링크 복사
            </button>
          </>
        ) : (
          <div className="text-center py-4 text-red-400 text-sm">코드 생성에 실패했습니다</div>
        )}
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-[11px] text-white/30">
            다른 사용자는 <span className="font-mono bg-white/5 px-1 rounded">설정 → 워크스페이스 참가</span>에서 코드를 입력할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
