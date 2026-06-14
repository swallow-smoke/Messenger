import React, { useEffect, useRef, useState } from 'react';
import { useWorkspaceSettingsStore, type NotifLevel } from '../../store/workspaceSettings';

export interface WorkspaceItem {
  id: string;
  name: string;
  iconUrl?: string;
  role: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  workspace: WorkspaceItem;
}

interface Props {
  workspaces: WorkspaceItem[];
  activeId: string | null;
  onSelect(id: string): void;
  onCreateNew(): void;
  onInvite(workspaceId: string): void;
  onOpenSettings(workspaceId: string): void;
  onLeave(workspaceId: string): void;
  onOpenRoles(workspaceId: string, tab: 'roles' | 'members'): void;
  onExport(workspaceId: string): void;
  onImport(workspaceId: string): void;
}

const NOTIF_LABELS: Record<NotifLevel, string> = {
  all: '모든 메시지',
  mentions: '멘션만',
  nothing: '알림 없음',
};

export function WorkspaceSwitcher({
  workspaces,
  activeId,
  onSelect,
  onCreateNew,
  onInvite,
  onOpenSettings,
  onLeave,
  onOpenRoles,
  onExport,
  onImport,
}: Props): React.ReactElement {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [showNotifPicker, setShowNotifPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isMuted, setMuted, getNotifLevel, setNotifLevel } = useWorkspaceSettingsStore();

  useEffect(() => {
    if (!menu) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenu(null);
    }
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null);
        setShowNotifPicker(false);
      }
    }
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [menu]);

  function openMenu(e: React.MouseEvent, ws: WorkspaceItem) {
    e.preventDefault();
    e.stopPropagation();
    setShowNotifPicker(false);
    setMenu({ x: e.clientX, y: e.clientY, workspace: ws });
  }

  function close() {
    setMenu(null);
    setShowNotifPicker(false);
  }

  const ws = menu?.workspace;
  const muted = ws ? isMuted(ws.id) : false;
  const notifLevel = ws ? getNotifLevel(ws.id) : 'all';
  const isOwner = ws?.role === 'owner';
  const isAdmin = ws?.role === 'admin' || isOwner;

  return (
    <div className="flex flex-col items-center gap-2 py-3 w-14 bg-sidebar border-r border-white/10">
      {workspaces.map((w) => (
        <button
          key={w.id}
          onClick={() => onSelect(w.id)}
          onContextMenu={(e) => openMenu(e, w)}
          title={w.name}
          className={`relative w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-all
            ${activeId === w.id ? 'bg-accent text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
        >
          {w.iconUrl ? (
            <img src={w.iconUrl} alt={w.name} className="w-full h-full rounded-lg object-cover" />
          ) : (
            w.name.charAt(0).toUpperCase()
          )}
          {isMuted(w.id) && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-sidebar rounded-full flex items-center justify-center text-[7px]">🔇</span>
          )}
        </button>
      ))}

      <button
        onClick={onCreateNew}
        title="새 워크스페이스 만들기"
        className="w-9 h-9 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 border border-dashed border-white/20 hover:border-white/40 transition-all text-lg"
      >
        +
      </button>

      {menu && ws && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-surface border border-white/15 rounded-xl shadow-2xl py-1 min-w-[180px]"
          style={{ left: menu.x + 8, top: Math.min(menu.y, window.innerHeight - 340) }}
        >
          <div className="px-3 py-1.5 text-xs font-semibold text-white/50 truncate border-b border-white/10 mb-1">
            {ws.name}
          </div>

          {/* Mute */}
          <button
            onClick={() => { setMuted(ws.id, !muted); close(); }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 text-white/80 flex items-center gap-2"
          >
            <span>{muted ? '🔔' : '🔇'}</span>
            {muted ? '알림 켜기' : '알림 끄기'}
          </button>

          {/* Notification level */}
          <div>
            <button
              onClick={() => setShowNotifPicker((v) => !v)}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 text-white/80 flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2">
                <span>🔔</span> 알림 설정
              </span>
              <span className="text-xs text-white/40">{NOTIF_LABELS[notifLevel]}</span>
            </button>
            {showNotifPicker && (
              <div className="bg-white/5 border-t border-b border-white/10 py-1">
                {(['all', 'mentions', 'nothing'] as NotifLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => { setNotifLevel(ws.id, level); setShowNotifPicker(false); }}
                    className={`w-full text-left px-5 py-1 text-xs flex items-center gap-2 transition-colors
                      ${notifLevel === level ? 'text-accent' : 'text-white/60 hover:text-white'}`}
                  >
                    <span className="w-2 h-2 rounded-full border flex-shrink-0"
                      style={{ borderColor: notifLevel === level ? 'var(--color-accent)' : 'rgba(255,255,255,0.2)',
                               background: notifLevel === level ? 'var(--color-accent)' : 'transparent' }}
                    />
                    {NOTIF_LABELS[level]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Invite */}
          {isAdmin && (
            <button
              onClick={() => { onInvite(ws.id); close(); }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 text-white/80 flex items-center gap-2"
            >
              <span>🔗</span> 초대하기
            </button>
          )}

          {/* Workspace settings */}
          {isAdmin && (
            <button
              onClick={() => { onOpenSettings(ws.id); close(); }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 text-white/80 flex items-center gap-2"
            >
              <span>⚙️</span> 워크스페이스 설정
            </button>
          )}

          {/* Roles */}
          {isAdmin && (
            <button
              onClick={() => { onOpenRoles(ws.id, 'roles'); close(); }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 text-white/80 flex items-center gap-2"
            >
              <span>🎭</span> 역할 관리
            </button>
          )}

          {/* Members */}
          {isAdmin && (
            <button
              onClick={() => { onOpenRoles(ws.id, 'members'); close(); }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 text-white/80 flex items-center gap-2"
            >
              <span>👥</span> 멤버 관리
            </button>
          )}

          {/* Export / Import */}
          {isOwner && (
            <>
              <hr className="border-white/10 my-1" />
              <button
                onClick={() => { onExport(ws.id); close(); }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 text-white/80 flex items-center gap-2"
              >
                <span>📤</span> 워크스페이스 내보내기
              </button>
              <button
                onClick={() => { onImport(ws.id); close(); }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 text-white/80 flex items-center gap-2"
              >
                <span>📥</span> 워크스페이스 가져오기
              </button>
            </>
          )}

          {/* Separator + destructive */}
          {!isOwner && (
            <>
              <hr className="border-white/10 my-1" />
              <button
                onClick={() => { onLeave(ws.id); close(); }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-red-500/10 text-red-400 flex items-center gap-2"
              >
                <span>🚪</span> 워크스페이스 나가기
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
