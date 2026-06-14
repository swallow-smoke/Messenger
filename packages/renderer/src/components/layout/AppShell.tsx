import React, { useState, useEffect, useCallback } from 'react';
import { WorkspaceSwitcher, type WorkspaceItem } from './WorkspaceSwitcher';
import { Sidebar } from './Sidebar';
import { MemberPanel } from './MemberPanel';
import { MessageFeed } from '../message/MessageFeed';
import { DocsView } from '../docs/DocsView';
import { TaskBoard } from '../tasks/TaskBoard';
import { DMView } from '../dm/DMView';
import { FriendsPage } from '../friends/FriendsPage';
import { ThreadPanel } from '../message/ThreadPanel';
import { CommandPalette } from '../common/CommandPalette';
import { MentionsInbox } from '../message/MentionsInbox';
import { KeyboardShortcutsModal } from '../common/KeyboardShortcutsModal';
import { WorkspaceCreateModal } from '../workspace/WorkspaceCreateModal';
import { InviteModal } from '../workspace/InviteModal';
import { WorkspaceImportModal } from '../workspace/WorkspaceImportModal';
import { ChannelCreateModal } from '../channels/ChannelCreateModal';
import { ProfileEditModal } from '../user/ProfileEditModal';
import { SettingsPage, RolesModal } from '../../pages/SettingsPage';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useWorkspaceSettingsStore } from '../../store/workspaceSettings';
import { useSettingsStore } from '../../store/settings';
import { useChannelsStore } from '../../store/channels';
import { useDMStore } from '../../store/dm';
import { useFriendsStore } from '../../store/friends';
import { usePreferencesStore } from '../../store/preferences';
import { useChannelSoundsStore } from '../../store/channelSounds';
import { useChannelOrderStore } from '../../store/channelOrder';
import { useMemberColorsStore } from '../../store/memberColors';
import { useSocket } from '../../hooks/useSocket';
import { storage } from '../../lib/api';
import api from '../../lib/api';
import type { Message } from '../../store/messages';
import toast from 'react-hot-toast';

type Tab = 'channels' | 'dm' | 'friends' | 'docs' | 'tasks' | 'mentions';

const SIDEBAR_WIDTH_KEY = 'sidebarWidth';
const MEMBER_PANEL_KEY = 'memberPanelOpen';

export function AppShell(): React.ReactElement {
  useSocket();

  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('channels');
  const [threadMsg, setThreadMsg] = useState<Message | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const [memberPanelOpen, setMemberPanelOpen] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeDMConversationId, setActiveDMConversationId] = useState<string | null>(null);
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState<string | null>(null);
  const [leaveWorkspaceId, setLeaveWorkspaceId] = useState<string | null>(null);
  const [rolesWorkspaceId, setRolesWorkspaceId] = useState<string | null>(null);
  const [rolesInitialTab, setRolesInitialTab] = useState<'roles' | 'members'>('roles');
  const [showImportModal, setShowImportModal] = useState(false);

  const { fetchChannels, fetchCategories, activeChannelId, setActive } = useChannelsStore();
  const { fetchConversations } = useDMStore();
  const { fetchAll: fetchFriends, fetchRequests } = useFriendsStore();
  const loadPreferences = usePreferencesStore((s) => s.load);
  const loadChannelSounds = useChannelSoundsStore((s) => s.load);
  const loadChannelOrder = useChannelOrderStore((s) => s.load);
  const setMemberColors = useMemberColorsStore((s) => s.setColors);
  const clearMemberColors = useMemberColorsStore((s) => s.clear);
  const loadWorkspaceSettings = useWorkspaceSettingsStore((s) => s.load);

  // Load persisted settings
  useEffect(() => {
    storage.get(SIDEBAR_WIDTH_KEY).then((w) => { if (w) setSidebarWidth(Number(w)); }).catch(() => {});
    storage.get(MEMBER_PANEL_KEY).then((v) => { if (v !== null) setMemberPanelOpen(v !== 'false'); }).catch(() => {});
  }, []);

  // Electron updater events
  useEffect(() => {
    if (!window.electron?.updater) return;
    window.electron.updater.onUpdateAvailable(() => setUpdateAvailable(true));
    window.electron.updater.onUpdateDownloaded(() => setUpdateDownloaded(true));
  }, []);

  function handleSidebarWidth(w: number): void {
    setSidebarWidth(w);
    void storage.set(SIDEBAR_WIDTH_KEY, String(w));
  }

  function handleMemberPanelToggle(): void {
    setMemberPanelOpen((v) => {
      const next = !v;
      void storage.set(MEMBER_PANEL_KEY, String(next));
      return next;
    });
  }

  // Load workspaces + workspace settings
  useEffect(() => {
    void loadWorkspaceSettings();
    api.get('/workspaces').then(({ data }) => {
      const list = data as WorkspaceItem[];
      setWorkspaces(list);
      if (list.length > 0) setActiveWorkspaceId(list[0].id);
    }).catch(() => {});
  }, [loadWorkspaceSettings]);

  useEffect(() => {
    if (activeWorkspaceId) {
      void fetchChannels(activeWorkspaceId);
      void fetchConversations(activeWorkspaceId);
      void fetchCategories(activeWorkspaceId);
      void loadChannelOrder(activeWorkspaceId);
      clearMemberColors();
      api.get<Array<{ id: string; roles: Array<{ color: string; position: number }> }>>(
        `/workspaces/${activeWorkspaceId}/members`
      ).then(({ data }) => {
        setMemberColors(data.map((m) => ({
          userId: m.id,
          color: m.roles.sort((a, b) => a.position - b.position)[0]?.color ?? null,
        })));
      }).catch(() => {});
    }
  }, [activeWorkspaceId, fetchChannels, fetchConversations, fetchCategories, loadChannelOrder, setMemberColors, clearMemberColors]);

  // Load friends, preferences, and channel sounds once on mount
  useEffect(() => {
    void fetchFriends();
    void fetchRequests();
    void loadPreferences();
    void loadChannelSounds();
  }, [fetchFriends, fetchRequests, loadPreferences, loadChannelSounds]);

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 'k') {
      e.preventDefault();
      setShowCommandPalette((v) => !v);
    }
    if (ctrl && e.key === '/') {
      e.preventDefault();
      setShowShortcuts((v) => !v);
    }
    if (ctrl && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      const { settings: s, update } = useSettingsStore.getState();
      update({ uiZoom: Math.min(1.5, Math.round(((s.uiZoom ?? 1) + 0.1) * 10) / 10) });
    }
    if (ctrl && e.key === '-') {
      e.preventDefault();
      const { settings: s, update } = useSettingsStore.getState();
      update({ uiZoom: Math.max(0.7, Math.round(((s.uiZoom ?? 1) - 0.1) * 10) / 10) });
    }
    if (ctrl && e.key === '0') {
      e.preventDefault();
      useSettingsStore.getState().update({ uiZoom: 1 });
    }
    if (e.key === 'Escape') {
      setShowCommandPalette(false);
      setShowShortcuts(false);
      setShowCreateWorkspace(false);
      setShowCreateChannel(false);
      setShowProfile(false);
      setShowSettings(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  function handleSelectChannel(id: string): void {
    setActive(id);
    setActiveTab('channels');
  }

  function handleSelectDM(conversationId: string): void {
    setActiveDMConversationId(conversationId);
    setActiveTab('dm');
  }

  async function handleOpenDMWithUser(userId: string): Promise<void> {
    try {
      const { data } = await api.post<{ id: string }>('/dm', { participantIds: [userId] });
      handleSelectDM(data.id);
    } catch {
      // dm conversation may already exist; fetch conversations and find it
      if (activeWorkspaceId) {
        await fetchConversations(activeWorkspaceId);
      }
    }
  }

  function handleWorkspaceCreated(ws: WorkspaceItem): void {
    setWorkspaces((prev) => [...prev, { ...ws, role: 'owner' }]);
    setActiveWorkspaceId(ws.id);
  }

  async function handleExportWorkspace(workspaceId: string): Promise<void> {
    try {
      const { data } = await api.get(`/workspaces/${workspaceId}/export`);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const wsName = workspaces.find((w) => w.id === workspaceId)?.name ?? 'workspace';
      a.href = url;
      a.download = `${wsName}-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('워크스페이스 내보내기 완료');
    } catch {
      toast.error('내보내기 실패');
    }
  }

  async function handleLeaveWorkspace(workspaceId: string): Promise<void> {
    try {
      await api.delete(`/workspaces/${workspaceId}/leave`);
      setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
      if (activeWorkspaceId === workspaceId) {
        const remaining = workspaces.filter((w) => w.id !== workspaceId);
        setActiveWorkspaceId(remaining[0]?.id ?? null);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(msg ?? '워크스페이스를 나갈 수 없습니다');
    }
  }

  const showMemberPanel =
    memberPanelOpen && (activeTab === 'channels' || activeTab === 'dm');

  const renderMainContent = (): React.ReactElement => {
    if (activeTab === 'channels' && activeChannelId) {
      return <MessageFeed channelId={activeChannelId} onOpenThread={(msg) => setThreadMsg(msg)} />;
    }
    if (activeTab === 'dm' && activeDMConversationId) {
      return <DMView conversationId={activeDMConversationId} />;
    }
    if (activeTab === 'friends') {
      return <FriendsPage onOpenDM={(uid) => void handleOpenDMWithUser(uid)} />;
    }
    if (activeTab === 'docs' && activeWorkspaceId) {
      return <DocsView workspaceId={activeWorkspaceId} />;
    }
    if (activeTab === 'tasks' && activeWorkspaceId) {
      return <TaskBoard workspaceId={activeWorkspaceId} />;
    }
    if (activeTab === 'mentions') {
      return <MentionsInbox onSelectChannel={handleSelectChannel} />;
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white/30 gap-4">
        <div className="text-6xl">👾</div>
        <p className="text-sm">
          {activeTab === 'channels'
            ? '채널을 선택하세요'
            : activeTab === 'dm'
            ? 'DM을 선택하세요'
            : activeTab === 'docs'
            ? '문서를 선택하세요'
            : '탭을 선택하세요'}
        </p>
        <p className="text-xs opacity-60">Ctrl+K 로 빠르게 이동할 수 있습니다</p>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Modals */}
      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          onSelectChannel={handleSelectChannel}
          workspaceId={activeWorkspaceId ?? undefined}
          onSelectDM={handleSelectDM}
          onOpenDMWithUser={(uid) => void handleOpenDMWithUser(uid)}
        />
      )}
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showCreateWorkspace && (
        <WorkspaceCreateModal onClose={() => setShowCreateWorkspace(false)} onCreated={handleWorkspaceCreated} />
      )}
      {showCreateChannel && activeWorkspaceId && (
        <ChannelCreateModal workspaceId={activeWorkspaceId} onClose={() => setShowCreateChannel(false)} />
      )}
      {showProfile && <ProfileEditModal onClose={() => setShowProfile(false)} />}
      {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}
      {showImportModal && (
        <WorkspaceImportModal
          onClose={() => setShowImportModal(false)}
          onImported={(ws) => {
            setWorkspaces((prev) => [...prev, ws]);
            setActiveWorkspaceId(ws.id);
            setShowImportModal(false);
          }}
        />
      )}
      {rolesWorkspaceId && (
        <RolesModal
          workspaceId={rolesWorkspaceId}
          initialTab={rolesInitialTab}
          onClose={() => setRolesWorkspaceId(null)}
        />
      )}
      {inviteWorkspaceId && (
        <InviteModal
          workspaceId={inviteWorkspaceId}
          workspaceName={workspaces.find((w) => w.id === inviteWorkspaceId)?.name ?? ''}
          onClose={() => setInviteWorkspaceId(null)}
        />
      )}
      {leaveWorkspaceId && (
        <ConfirmDialog
          title="워크스페이스 나가기"
          message={`정말 "${workspaces.find((w) => w.id === leaveWorkspaceId)?.name ?? ''}" 워크스페이스를 떠나시겠습니까?`}
          confirmLabel="나가기"
          danger
          onConfirm={() => { void handleLeaveWorkspace(leaveWorkspaceId); setLeaveWorkspaceId(null); }}
          onCancel={() => setLeaveWorkspaceId(null)}
        />
      )}

      {/* Update banners */}
      {updateDownloaded && (
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-accent text-white text-sm">
          <span>새 업데이트가 준비되었습니다. 지금 설치하시겠습니까?</span>
          <div className="flex gap-2">
            <button onClick={() => window.electron?.updater.install()} className="px-3 py-1 bg-white text-accent rounded text-xs font-medium hover:bg-white/90">
              지금 설치
            </button>
            <button onClick={() => setUpdateDownloaded(false)} className="text-white/70 hover:text-white">&times;</button>
          </div>
        </div>
      )}
      {updateAvailable && !updateDownloaded && (
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-surface border-b border-white/10 text-sm">
          <span className="text-white/70">새 버전을 다운로드 중...</span>
          <button onClick={() => setUpdateAvailable(false)} className="text-white/40 hover:text-white">&times;</button>
        </div>
      )}

      <WorkspaceSwitcher
        workspaces={workspaces}
        activeId={activeWorkspaceId}
        onSelect={setActiveWorkspaceId}
        onCreateNew={() => setShowCreateWorkspace(true)}
        onInvite={(id) => setInviteWorkspaceId(id)}
        onOpenSettings={(id) => { setActiveWorkspaceId(id); setShowSettings(true); }}
        onLeave={(id) => setLeaveWorkspaceId(id)}
        onOpenRoles={(id, tab) => { setActiveWorkspaceId(id); setRolesInitialTab(tab); setRolesWorkspaceId(id); }}
        onExport={(id) => void handleExportWorkspace(id)}
        onImport={() => setShowImportModal(true)}
      />

      <Sidebar
        workspaceId={activeWorkspaceId ?? ''}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        width={sidebarWidth}
        onWidthChange={handleSidebarWidth}
        onCreateChannel={() => setShowCreateChannel(true)}
        onOpenProfile={() => setShowProfile(true)}
        onOpenSettings={() => setShowSettings(true)}
        onSelectDM={handleSelectDM}
      />

      <div className="flex flex-1 overflow-hidden" data-main="">
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-primary)]">
          {renderMainContent()}
        </div>
        {threadMsg && (
          <ThreadPanel
            parentId={threadMsg.id}
            contextId={threadMsg.contextId}
            onClose={() => setThreadMsg(null)}
            parentMessage={threadMsg}
          />
        )}
        {showMemberPanel && (
          <MemberPanel
            activeChannelId={activeChannelId}
            activeDMConversationId={activeDMConversationId}
            activeTab={activeTab}
            onOpenDM={(uid) => void handleOpenDMWithUser(uid)}
          />
        )}
      </div>

      {/* Member panel toggle button */}
      {(activeTab === 'channels' || activeTab === 'dm') && (
        <button
          onClick={handleMemberPanelToggle}
          className="absolute bottom-3 right-3 z-40 w-8 h-8 rounded-full bg-surface border border-white/15 flex items-center justify-center text-white/40 hover:text-white/80 shadow-lg transition-colors"
          title={memberPanelOpen ? '멤버 패널 닫기' : '멤버 패널 열기'}
        >
          <svg className={`w-4 h-4 transition-transform ${memberPanelOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
