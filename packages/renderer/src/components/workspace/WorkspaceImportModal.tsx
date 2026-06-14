import React, { useRef, useState } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import type { WorkspaceItem } from '../layout/WorkspaceSwitcher';

interface Props {
  onClose(): void;
  onImported(workspace: WorkspaceItem): void;
}

export function WorkspaceImportModal({ onClose, onImported }: Props): React.ReactElement {
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport(): Promise<void> {
    if (!file) { toast.error('파일을 선택하세요'); return; }
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as unknown;
      const { data: result } = await api.post<{ workspace: WorkspaceItem }>('/workspaces/import', data);
      toast.success(`워크스페이스 "${result.workspace.name}" 가져오기 완료`);
      onImported({ ...result.workspace, role: 'owner' });
    } catch {
      toast.error('가져오기 실패 — JSON 형식을 확인하세요');
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface border border-white/10 rounded-xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <span className="font-semibold text-sm">📥 워크스페이스 가져오기</span>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-white/60">
            내보내기로 생성된 JSON 파일을 선택하면 새 워크스페이스로 가져옵니다.
            메시지는 현재 계정 이름으로 임포트됩니다.
          </p>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              file ? 'border-accent/50 bg-accent/5' : 'border-white/15 hover:border-white/30'
            }`}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-accent">{file.name}</p>
                <p className="text-xs text-white/40">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-white/50">JSON 파일 선택</p>
                <p className="text-xs text-white/30">클릭하여 파일을 선택하세요</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 text-sm text-white/60 hover:text-white disabled:opacity-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => void handleImport()}
              disabled={!file || importing}
              className="px-4 py-2 bg-accent hover:bg-accent/80 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {importing ? '가져오는 중...' : '가져오기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
