import React, { useState, useEffect, useCallback } from 'react';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { Sidebar } from './Sidebar';
import { MemberPanel } from './MemberPanel';
import { MessageFeed } from '../message/MessageFeed';
import { DocsView } from '../docs/DocsView';
import { TaskBoard } from '../tasks/TaskBoard';
import { DMView } from '../dm/DMView';
import { FriendsPage } from '../friends/FriendsPage';
import { ThreadPanel } from '../message/ThreadPanel';
import { CommandPalette } from '../common/CommandPalette';
import { KeyboardShortcutsModal } from '../common/KeyboardShortcutsModal';
import { WorkspaceCreateModal } from '../workspace/WorkspaceCreateModal';
import { ChannelCreateModal } from '../channels/ChannelCreateModal';
import { ProfileEditModal } from '../user/ProfileEditModal';
import { SettingsPage } from '../../pages/SettingsPage';
import { useChannelsStore } from '../../store/channels';
import { useDMStore } from '../../store/dm';
import { useFriendsStore } from '../../store/friends';
import { usePreferencesStore } from '../../store/preferences';
import { useSocket } from '../../hooks/useSocket';
import { storage } from '../../lib/api';
import api from '../../lib/api';
import type { Message } from '../../store/messages';

type Tab = 'channels' | 'dm' | 'friends' | 'docs' | 'tasks';

interface Workspace {
  id: string;
  name: string;
  iconUrl?: string;
}

const SIDEBAR_WIDTH_KEY = 'sidebarWidth';
const MEMBER_PANEL_KEY = 'memberPanelOpen';

export function AppShell(): React.ReactElement {
  useSocket();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
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

  const { fetchChannels, activeChannelId, setActive } = useChannelsStore();
  const { fetchConversations } = useDMStore();
  const { fetchAll: fetchFriends, fetchRequests } = useFriendsStore();
  const loadPreferences = usePreferencesStore((s) => s.load);

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

  // Load workspaces
  useEffect(() => {
    api.get('/workspaces').then(({ data }) => {
      setWorkspaces(data as Workspace[]);
      if ((data as Workspace[]).length > 0) {
        setActiveWorkspaceId((data as Workspace[])[0].id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeWorkspaceId) {
      void fetchChannels(activeWorkspaceId);
      void fetchConversations(activeWorkspaceId);
    }
  }, [activeWorkspaceId, fetchChannels, fetchConversations]);

  // Load friends and preferences once on mount
  useEffect(() => {
    void fetchFriends();
    void fetchRequests();
    void loadPreferences();
  }, [fetchFriends, fetchRequests, loadPreferences]);

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

  function handleWorkspaceCreated(ws: Workspace): void {
    setWorkspaces((prev) => [...prev, ws]);
    setActiveWorkspaceId(ws.id);
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
        <CommandPalette onClose={() => setShowCommandPalette(false)} onSelectChannel={handleSelectChannel} />
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
          <ThreadPanel parentId={threadMsg.id} contextId={threadMsg.contextId} onClose={() => setThreadMsg(null)} />
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
