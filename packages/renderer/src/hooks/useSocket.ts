import { useEffect } from 'react';
import { getSocket, connect, disconnect } from '../lib/socket';
import { useMessagesStore } from '../store/messages';
import { useChannelsStore } from '../store/channels';
import { usePresenceStore } from '../store/presence';
import { useAuthStore } from '../store/auth';
import { useTasksStore } from '../store/tasks';
import { useDocsStore } from '../store/docs';
import { useFriendsStore } from '../store/friends';
import { useSettingsStore } from '../store/settings';
import { usePreferencesStore } from '../store/preferences';
import { useChannelSoundsStore } from '../store/channelSounds';
import { useWorkspaceSettingsStore } from '../store/workspaceSettings';
import { playSound } from '../lib/sounds';
import type { Message } from '../store/messages';
import type { Channel } from '../store/channels';
import type { Task } from '../store/tasks';
import type { UserStatus } from '../store/presence';
import type { FriendRequest } from '../store/friends';
import { useDMStore } from '../store/dm';
import toast from 'react-hot-toast';

export function useSocket(): void {
  const { appendMessage, updateMessage, deleteMessage, addReaction, setPinned } = useMessagesStore();
  const { updateDMMessage } = useDMStore();
  const { activeChannelId, incrementUnread, addChannel, updateChannel, removeChannel } = useChannelsStore();
  const { setPresence, setTyping } = usePresenceStore();
  const { user } = useAuthStore();
  const { addTaskFromSocket, updateTaskFromSocket } = useTasksStore();
  const { updateDocMeta } = useDocsStore();
  const { appendDMMessage, activeConversationId, incrementUnread: incrementDMUnread } = useDMStore();
  const { addIncomingRequest, markAccepted } = useFriendsStore();

  useEffect(() => {
    connect();
    const socket = getSocket();

    // Messages
    socket.on('message:new', (msg: Message) => {
      if (msg.contextType === 'dm') {
        appendDMMessage(msg);
        if (msg.contextId !== activeConversationId) {
          incrementDMUnread(msg.contextId);
        }
      } else {
        // appendMessage handles clientTempId dedup internally
        appendMessage(msg);
        if (msg.contextId !== activeChannelId && !msg.parentId) {
          incrementUnread(msg.contextId);
        }
      }

      // Desktop notifications + sound for mentions and keywords
      if (user && msg.senderId !== user.id) {
        const { settings } = useSettingsStore.getState();

        // Resolve workspace for this message's channel (for mute/notifLevel check)
        let workspaceId: string | undefined;
        if (msg.contextType === 'channel') {
          workspaceId = useChannelsStore.getState().channels.find((c) => c.id === msg.contextId)?.workspaceId;
        }

        const wsSettings = useWorkspaceSettingsStore.getState();
        const isMuted = workspaceId ? wsSettings.isMuted(workspaceId) : false;
        const notifLevel = workspaceId ? wsSettings.getNotifLevel(workspaceId) : 'all';
        const isMention = msg.mentions?.includes(user.id) ?? false;

        // Skip all notifications/sounds when workspace is muted or notifLevel is 'nothing'
        if (!isMuted && notifLevel !== 'nothing') {
          // Play per-channel notification sound (skipped if mentions-only and not a mention)
          if (settings.notifSound && msg.contextType === 'channel' && (notifLevel === 'all' || isMention)) {
            const soundId = useChannelSoundsStore.getState().getSound(msg.contextId);
            playSound(soundId);
          }

          if (settings.notifDesktop && window.electron?.notify) {
            if (settings.notifMention && isMention) {
              void window.electron.notify.show(
                `@멘션 — ${msg.sender.displayName}`,
                msg.content.slice(0, 100)
              );
            } else if (notifLevel === 'all') {
              const { prefs } = usePreferencesStore.getState();
              const matched = prefs.keywords.find((kw) =>
                msg.content.toLowerCase().includes(kw.toLowerCase())
              );
              if (matched) {
                void window.electron.notify.show(
                  `키워드 "${matched}" — ${msg.sender.displayName}`,
                  msg.content.slice(0, 100)
                );
              }
            }
          }
        }
      }
    });
    socket.on('message:update', (msg: Message) => {
      if (msg.contextType === 'dm') {
        updateDMMessage(msg);
      } else {
        updateMessage(msg);
      }
    });
    socket.on('message:delete', ({ id, contextId }: { id: string; contextId: string }) =>
      deleteMessage(id, contextId)
    );
    socket.on('message:reaction', addReaction);

    // Pin/unpin
    socket.on('message:pinned', ({ message, channelId }: { message: Message; channelId: string }) => {
      setPinned(channelId, message);
    });
    socket.on('message:unpinned', ({ channelId }: { channelId: string }) => {
      setPinned(channelId, null);
    });

    // Channels
    socket.on('channel:created', (channel: Channel) => addChannel(channel));
    socket.on('channel:updated', (channel: Channel) => updateChannel(channel));
    socket.on('channel:deleted', ({ id }: { id: string }) => removeChannel(id));

    // Typing / Presence
    socket.on('typing:update', ({ userId, isTyping, contextId }: { userId: string; isTyping: boolean; contextId: string }) => {
      setTyping(contextId, userId, isTyping);
    });
    socket.on('presence:update', ({ userId, status, statusText }: { userId: string; status: UserStatus; statusText?: string }) => {
      setPresence({ userId, status, statusText });
    });

    // Tasks
    socket.on('task:created', (task: Task) => addTaskFromSocket(task));
    socket.on('task:updated', (task: Task) => updateTaskFromSocket(task));
    socket.on('task:status-changed', (task: Task) => updateTaskFromSocket(task));

    // Docs
    socket.on('doc:updated', ({ id, title, updatedAt }: { id: string; title: string; updatedAt: string; workspaceId: string }) => {
      updateDocMeta(id, { title, updatedAt });
    });

    // Friends
    socket.on('friend:request-received', (req: FriendRequest) => {
      addIncomingRequest(req);
      toast(`${req.requester.displayName}님이 친구 요청을 보냈습니다`, { icon: '👋' });
      if (window.electron?.notify) {
        void window.electron.notify.show('친구 요청', `${req.requester.displayName}님이 친구 요청을 보냈습니다`);
      }
    });
    socket.on('friend:request-accepted', ({ id, accepter }: { id: string; accepter: { id: string; displayName: string } }) => {
      markAccepted(id);
      toast.success(`${accepter.displayName}님이 친구 요청을 수락했습니다`);
    });

    // Reconnect: rejoin all active rooms
    socket.on('connect', () => {
      const { activeChannelId: chId } = useChannelsStore.getState();
      const { activeConversationId: convId } = useDMStore.getState();
      if (chId) socket.emit('channel:join', chId);
      if (convId) socket.emit('channel:join', convId);
    });

    return () => {
      socket.off('message:new');
      socket.off('message:update');
      socket.off('message:delete');
      socket.off('message:reaction');
      socket.off('message:pinned');
      socket.off('message:unpinned');
      socket.off('channel:created');
      socket.off('channel:updated');
      socket.off('channel:deleted');
      socket.off('typing:update');
      socket.off('presence:update');
      socket.off('task:created');
      socket.off('task:updated');
      socket.off('task:status-changed');
      socket.off('doc:updated');
      socket.off('friend:request-received');
      socket.off('friend:request-accepted');
      socket.off('connect');
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeChannelId) return;
    const socket = getSocket();
    socket.emit('channel:join', activeChannelId);
    return () => {
      socket.emit('channel:leave', activeChannelId);
    };
  }, [activeChannelId]);

  useEffect(() => {
    if (!activeConversationId) return;
    const socket = getSocket();
    socket.emit('channel:join', activeConversationId);
    return () => {
      socket.emit('channel:leave', activeConversationId);
    };
  }, [activeConversationId]);
}
