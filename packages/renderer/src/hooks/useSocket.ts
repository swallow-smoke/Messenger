import { useEffect } from 'react';
import { getSocket, connect, disconnect } from '../lib/socket';
import { useMessagesStore } from '../store/messages';
import { useChannelsStore } from '../store/channels';
import { usePresenceStore } from '../store/presence';
import { useAuthStore } from '../store/auth';
import { useTasksStore } from '../store/tasks';
import { useDocsStore } from '../store/docs';
import type { Message } from '../store/messages';
import type { Channel } from '../store/channels';
import type { Task } from '../store/tasks';
import type { UserStatus } from '../store/presence';
import { useDMStore } from '../store/dm';

export function useSocket(): void {
  const { appendMessage, updateMessage, deleteMessage, addReaction, setPinned } = useMessagesStore();
  const { activeChannelId, incrementUnread, addChannel, updateChannel, removeChannel } = useChannelsStore();
  const { setPresence, setTyping } = usePresenceStore();
  const { user } = useAuthStore();
  const { addTaskFromSocket, updateTaskFromSocket } = useTasksStore();
  const { updateDocMeta } = useDocsStore();
  const { appendDMMessage, activeConversationId, incrementUnread: incrementDMUnread } = useDMStore();

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
        return;
      }
      appendMessage(msg);
      if (msg.contextId !== activeChannelId && !msg.parentId) {
        incrementUnread(msg.contextId);
        if (user && msg.content.includes(`@${user.displayName}`) && window.electron?.notify) {
          void window.electron.notify.show(
            `#${msg.contextId} — ${msg.sender.displayName}`,
            msg.content.slice(0, 100)
          );
        }
      }
    });
    socket.on('message:update', (msg: Message) => updateMessage(msg));
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
