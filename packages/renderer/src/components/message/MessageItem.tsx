import React, { useState, useRef, useCallback, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, Attachment } from '../../store/messages';
import { useMessagesStore } from '../../store/messages';
import { ReactionBar } from './ReactionBar';
import { EmbedCard } from './EmbedCard';
import { MarkdownContent } from './MarkdownContent';
import { UserAvatar } from '../user/UserAvatar';
import { Lightbox } from './Lightbox';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useAuthStore } from '../../store/auth';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface EmojiData {
  native: string;
}

interface Props {
  message: Message;
  onReply(msg: Message): void;
  onPin?(msg: Message): void;
  isGrouped?: boolean;
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}

function is3D(fileName: string) {
  return fileName.endsWith('.glb') || fileName.endsWith('.fbx') || fileName.endsWith('.gltf');
}

function isMarkdown(fileName: string) {
  return fileName.endsWith('.md') || fileName.endsWith('.markdown');
}

function fileIcon(mimeType: string, fileName: string): string {
  if (is3D(fileName)) return '🎮';
  if (isMarkdown(fileName)) return '📄';
  if (fileName.endsWith('.psd') || fileName.endsWith('.ai')) return '🎨';
  if (mimeType.startsWith('video/')) return '🎬';
  return '📎';
}

// Markdown viewer modal for .md file attachments
function MarkdownFileModal({ attachment, onClose }: { attachment: Attachment; onClose(): void }): React.ReactElement {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(attachment.fileUrl)
      .then((r) => r.text())
      .then(setContent)
      .catch(() => setError(true));
  }, [attachment.fileUrl]);

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-white/10 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">📄</span>
            <span className="font-medium text-sm">{attachment.fileName}</span>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {error ? (
            <p className="text-white/40 text-sm text-center py-8">파일을 불러올 수 없습니다.</p>
          ) : content === null ? (
            <p className="text-white/40 text-sm text-center py-8">로드 중...</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 3D file chip with thumbnail attempt
function Asset3DChip({ attachment }: { attachment: Attachment }): React.ReactElement {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(attachment.thumbnailUrl ?? null);

  useEffect(() => {
    if (thumbnailUrl || !window.electron?.asset?.getThumbnail) return;
    window.electron.asset.getThumbnail(attachment.fileUrl)
      .then((url: string | null) => { if (url) setThumbnailUrl(url); })
      .catch(() => {});
  }, [attachment.fileUrl, thumbnailUrl]);

  return (
    <a
      href={attachment.fileUrl}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => {
        e.preventDefault();
        if (window.electron?.shell) void window.electron.shell.openExternal(attachment.fileUrl);
        else window.open(attachment.fileUrl, '_blank');
      }}
      className="inline-flex items-center gap-2 mt-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
    >
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" className="w-8 h-8 rounded object-cover" />
      ) : (
        <span className="text-base">🎮</span>
      )}
      <div>
        <div className="font-medium">{attachment.fileName}</div>
        <div className="text-white/40">{(attachment.fileSize / 1024).toFixed(0)} KB</div>
      </div>
    </a>
  );
}

export function MessageItem({ message, onReply, onPin, isGrouped = false }: Props): React.ReactElement {
  const { user } = useAuthStore();
  const { editMessage, deleteMessage: softDelete, setPinned, pinnedMessages } = useMessagesStore();

  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; fileName: string } | null>(null);
  const [mdViewerAttachment, setMdViewerAttachment] = useState<Attachment | null>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const embed = (message.metadata as Record<string, unknown>).embed;
  const createdAt = new Date(message.createdAt);
  const relativeTime = formatDistanceToNow(createdAt, { addSuffix: true, locale: ko });
  const fullTime = format(createdAt, 'yyyy년 M월 d일 HH:mm', { locale: ko });

  function handleDoubleClick() {
    if (!user || user.id !== message.senderId) return;
    setEditing(true);
    setEditValue(message.content);
    setTimeout(() => editRef.current?.focus(), 0);
  }

  async function saveEdit() {
    const content = editValue.trim();
    if (!content || content === message.content) { setEditing(false); return; }
    try {
      await editMessage(message.id, message.contextId, content);
      setEditing(false);
    } catch {
      toast.error('메시지 수정에 실패했습니다.');
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') { setEditing(false); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void saveEdit(); }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  useEffect(() => {
    function close() { setContextMenu(null); setShowEmojiPicker(false); }
    if (contextMenu || showEmojiPicker) {
      window.addEventListener('click', close);
      return () => window.removeEventListener('click', close);
    }
  }, [contextMenu, showEmojiPicker]);

  async function handleDelete() {
    setConfirmDelete(false);
    try {
      await api.delete(`/messages/${message.id}`);
      softDelete(message.id, message.contextId);
    } catch {
      toast.error('메시지 삭제에 실패했습니다.');
    }
  }

  function copyMessageLink() {
    const url = `${window.location.origin}#channel/${message.contextId}/message/${message.id}`;
    void navigator.clipboard.writeText(url).then(() => toast.success('링크 복사됨'));
  }

  function handlePin() {
    const pinned = pinnedMessages[message.contextId];
    if (pinned?.id === message.id) {
      setPinned(message.contextId, null);
      toast.success('고정 해제됨');
    } else {
      setPinned(message.contextId, message);
      onPin?.(message);
      toast.success('메시지 고정됨');
    }
    setContextMenu(null);
  }

  const handleAddEmoji = useCallback(async (emojiData: EmojiData) => {
    setShowEmojiPicker(false);
    try {
      await api.post(`/messages/${message.id}/reactions`, { emoji: emojiData.native });
    } catch {
      // toast shown by api interceptor
    }
  }, [message.id]);

  const isPinned = pinnedMessages[message.contextId]?.id === message.id;

  return (
    <>
      {lightbox && (
        <Lightbox src={lightbox.src} fileName={lightbox.fileName} onClose={() => setLightbox(null)} />
      )}
      {mdViewerAttachment && (
        <MarkdownFileModal
          attachment={mdViewerAttachment}
          onClose={() => setMdViewerAttachment(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="메시지 삭제"
          message="이 메시지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
          confirmLabel="삭제"
          danger
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {contextMenu && (
        <div
          className="fixed z-50 bg-surface border border-white/15 rounded-lg shadow-2xl py-1 min-w-40"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { onReply(message); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 text-white/80"
          >
            💬 스레드에서 답글
          </button>
          <button
            onClick={() => { setShowEmojiPicker(true); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 text-white/80"
          >
            😊 리액션 추가
          </button>
          <button
            onClick={copyMessageLink}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 text-white/80"
          >
            🔗 링크 복사
          </button>
          <button
            onClick={handlePin}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 text-white/80"
          >
            📌 {isPinned ? '고정 해제' : '고정'}
          </button>
          {user && user.id === message.senderId && (
            <>
              <button
                onClick={() => { setEditing(true); setEditValue(message.content); setContextMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 text-white/80"
              >
                ✏️ 편집
              </button>
              <hr className="border-white/10 my-1" />
              <button
                onClick={() => { setConfirmDelete(true); setContextMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-red-500/20 text-red-400"
              >
                🗑️ 삭제
              </button>
            </>
          )}
        </div>
      )}

      {showEmojiPicker && (
        <div
          className="fixed z-50"
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <Picker
            data={data}
            onEmojiSelect={(e: EmojiData) => void handleAddEmoji(e)}
            theme="dark"
            locale="ko"
            previewPosition="none"
          />
        </div>
      )}

      <div
        className={`flex gap-3 px-4 ${isGrouped ? 'py-0.5' : 'py-1.5'} hover:bg-white/5 group relative transition-colors ${
          message.isPending ? 'opacity-60' : ''
        } ${isPinned ? 'border-l-2 border-accent/40' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
      >
        {isGrouped ? (
          <div className="w-9 flex-shrink-0 flex items-center justify-center">
            <span className="text-[10px] text-white/0 group-hover:text-white/30 transition-colors select-none leading-none">
              {format(createdAt, 'HH:mm')}
            </span>
          </div>
        ) : (
          <UserAvatar
            userId={message.senderId}
            displayName={message.sender.displayName}
            avatarUrl={message.sender.avatarUrl}
            size="md"
            showStatus
          />
        )}

        <div className="flex flex-col min-w-0 flex-1">
          {!isGrouped && (
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-sm">{message.sender.displayName}</span>
              <span
                className="text-xs text-white/40 cursor-default"
                title={fullTime}
              >
                {relativeTime}
              </span>
              {message.isEdited && <span className="text-xs text-white/30">(편집됨)</span>}
              {message.isPending && <span className="text-xs text-white/30">전송 중...</span>}
            </div>
          )}

          {message.isDeleted ? (
            <p className="text-white/30 italic text-sm">삭제된 메시지입니다.</p>
          ) : editing ? (
            <div className="mt-1">
              <textarea
                ref={editRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                rows={2}
                className="w-full bg-white/10 rounded px-3 py-2 text-sm text-white outline-none resize-none focus:ring-1 focus:ring-accent"
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
              <div className="flex gap-2 mt-1 text-xs text-white/50">
                <span>Enter 저장</span>
                <span>·</span>
                <button onClick={() => setEditing(false)} className="text-accent hover:underline">Esc 취소</button>
              </div>
            </div>
          ) : (
            <>
              <MarkdownContent content={message.content} />
              {isGrouped && (message.isEdited || message.isPending) && (
                <div className="flex gap-1 text-xs text-white/30">
                  {message.isEdited && <span>(편집됨)</span>}
                  {message.isPending && <span>전송 중...</span>}
                </div>
              )}
              {embed && <EmbedCard embed={embed as Parameters<typeof EmbedCard>[0]['embed']} />}
              {message.attachments.map((a) => {
                if (isImage(a.mimeType)) {
                  return (
                    <div key={a.id} className="mt-1 inline-block">
                      <img
                        src={a.fileUrl}
                        alt={a.fileName}
                        className="max-w-[400px] max-h-[300px] rounded cursor-pointer hover:opacity-90 transition-opacity object-cover"
                        onClick={() => setLightbox({ src: a.fileUrl, fileName: a.fileName })}
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.style.display = 'none';
                          el.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <a
                        href={a.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hidden inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/70"
                      >
                        <span className="text-base">🖼️</span>
                        <span className="font-medium">{a.fileName}</span>
                      </a>
                    </div>
                  );
                }
                if (is3D(a.fileName)) {
                  return <Asset3DChip key={a.id} attachment={a} />;
                }
                if (isMarkdown(a.fileName)) {
                  return (
                    <button
                      key={a.id}
                      onClick={() => setMdViewerAttachment(a)}
                      className="inline-flex items-center gap-2 mt-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors text-left"
                    >
                      <span className="text-base">📄</span>
                      <div>
                        <div className="font-medium">{a.fileName}</div>
                        <div className="text-white/40">{(a.fileSize / 1024).toFixed(0)} KB · 클릭하여 미리보기</div>
                      </div>
                    </button>
                  );
                }
                return (
                  <a
                    key={a.id}
                    href={a.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      if (window.electron?.shell) void window.electron.shell.openExternal(a.fileUrl);
                      else window.open(a.fileUrl, '_blank');
                    }}
                    className="inline-flex items-center gap-2 mt-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <span className="text-base">{fileIcon(a.mimeType, a.fileName)}</span>
                    <div>
                      <div className="font-medium">{a.fileName}</div>
                      <div className="text-white/40">{(a.fileSize / 1024).toFixed(0)} KB</div>
                    </div>
                  </a>
                );
              })}
            </>
          )}

          {user && !message.isDeleted && (
            <ReactionBar
              messageId={message.id}
              reactions={message.reactions}
              currentUserId={user.id}
              showAddButton={hovered}
            />
          )}

          {message._count && message._count.replies > 0 && !message.parentId && (
            <button
              onClick={() => onReply(message)}
              className="text-xs text-accent hover:underline mt-0.5 text-left"
            >
              {message._count.replies}개 답글
            </button>
          )}
        </div>

        {hovered && user && !message.isDeleted && (
          <div className="absolute right-4 top-1 flex gap-0.5 bg-surface border border-white/10 rounded-lg shadow-lg px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => void (async () => {
                try {
                  await api.post(`/messages/${message.id}/reactions`, { emoji: '👍' });
                } catch {}
              })()}
              className="p-1.5 hover:bg-white/10 rounded text-sm"
              title="👍 리액션"
            >
              👍
            </button>
            <button
              onClick={() => onReply(message)}
              className="px-2 py-1 text-xs hover:bg-white/10 rounded text-white/70 hover:text-white"
              title="스레드 답글"
            >
              답글
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleContextMenu(e as unknown as React.MouseEvent); }}
              className="px-1.5 py-1 text-xs hover:bg-white/10 rounded text-white/70 hover:text-white"
              title="더 보기"
            >
              •••
            </button>
          </div>
        )}
      </div>
    </>
  );
}
