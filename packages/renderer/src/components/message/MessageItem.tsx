import React, { useState, useRef, useCallback, useEffect, Suspense, lazy } from 'react';

const FBXModelPreview = lazy(() =>
  import('./FBXModelPreview').then((m) => ({ default: m.FBXModelPreview }))
);
const GLTFModelPreview = lazy(() =>
  import('./GLTFModelPreview').then((m) => ({ default: m.GLTFModelPreview }))
);
import { formatDistanceToNow, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message, Attachment } from '../../store/messages';
import { useMessagesStore } from '../../store/messages';
import { usePreferencesStore } from '../../store/preferences';
import { useChannelsStore } from '../../store/channels';
import { TaskCreateModal } from '../tasks/TaskCreateModal';
import { ReactionBar } from './ReactionBar';
import { EmbedCard } from './EmbedCard';
import { LinkPreviewCard, type LinkPreviewData } from './LinkPreviewCard';
import { MarkdownContent } from './MarkdownContent';
import { UserAvatar } from '../user/UserAvatar';
import { Lightbox, type LightboxImage } from './Lightbox';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useAuthStore } from '../../store/auth';
import { useMemberColorsStore } from '../../store/memberColors';
import { SpriteSheetModal } from './SpriteSheetModal';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface EmojiData {
  native: string;
}

interface Props {
  message: Message;
  onReply(msg: Message): void;
  isGrouped?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?(id: string): void;
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}

function is3D(fileName: string) {
  const n = fileName.toLowerCase();
  return n.endsWith('.glb') || n.endsWith('.fbx') || n.endsWith('.gltf');
}

function isMarkdown(fileName: string) {
  const n = fileName.toLowerCase();
  return n.endsWith('.md') || n.endsWith('.markdown');
}

const CODE_EXTS = new Set(['.cs', '.js', '.ts', '.jsx', '.tsx', '.json']);
const CODE_LANG_MAP: Record<string, string> = {
  cs: 'csharp', js: 'javascript', ts: 'typescript', jsx: 'jsx', tsx: 'tsx', json: 'json',
};
const DIFF_EXTS = new Set(['.cs', '.json']);

function isCodeFile(fileName: string) {
  const dot = fileName.lastIndexOf('.');
  return dot !== -1 && CODE_EXTS.has(fileName.slice(dot).toLowerCase());
}

function fileIcon(mimeType: string, fileName: string): string {
  if (is3D(fileName)) return '🎮';
  if (isMarkdown(fileName)) return '📄';
  if (isCodeFile(fileName)) return '📝';
  if (fileName.toLowerCase().endsWith('.psd') || fileName.toLowerCase().endsWith('.ai')) return '🎨';
  if (mimeType.startsWith('video/')) return '🎬';
  return '📎';
}

function CodeFileModal({
  attachment,
  enableHighlight,
  onClose,
}: {
  attachment: Attachment;
  enableHighlight: boolean;
  onClose(): void;
}): React.ReactElement {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const ext = attachment.fileName.toLowerCase().split('.').pop() ?? '';
  const language = CODE_LANG_MAP[ext] ?? 'text';

  useEffect(() => {
    fetch(attachment.fileUrl)
      .then((r) => r.text())
      .then(setContent)
      .catch(() => setError(true));
  }, [attachment.fileUrl]);

  function download() {
    const a = document.createElement('a');
    a.href = attachment.fileUrl;
    a.download = attachment.fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-white/10 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">📝</span>
            <span className="font-medium text-sm">{attachment.fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={download}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition-colors"
            >
              다운로드
            </button>
            <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">&times;</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {error ? (
            <p className="text-white/40 text-sm text-center py-8">파일을 불러올 수 없습니다.</p>
          ) : content === null ? (
            <p className="text-white/40 text-sm text-center py-8">로드 중...</p>
          ) : enableHighlight ? (
            <SyntaxHighlighter
              style={oneDark}
              language={language}
              showLineNumbers
              PreTag="div"
              customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.78rem', minHeight: '100%' }}
            >
              {content}
            </SyntaxHighlighter>
          ) : (
            <pre className="text-xs font-mono text-white/80 p-4 overflow-auto whitespace-pre-wrap">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
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

function openExternal(url: string) {
  if (window.electron?.shell) void window.electron.shell.openExternal(url);
  else window.open(url, '_blank');
}

function handleAttachmentDragStart(e: React.DragEvent, mimeType: string, fileName: string, fileUrl: string) {
  e.dataTransfer.setData('DownloadURL', `${mimeType}:${fileName}:${fileUrl}`);
}

function ModelViewerPreview({ attachment }: { attachment: Attachment }): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <GLTFModelPreview fileUrl={attachment.fileUrl} fileName={attachment.fileName} />
    </Suspense>
  );
}

// Static chip for .glb/.gltf when enable3DPreview is off
function Asset3DChip({ attachment }: { attachment: Attachment }): React.ReactElement {
  return (
    <a
      href={attachment.fileUrl}
      target="_blank"
      rel="noreferrer"
      draggable
      onDragStart={(e) => handleAttachmentDragStart(e, 'model/gltf-binary', attachment.fileName, attachment.fileUrl)}
      onClick={(e) => { e.preventDefault(); openExternal(attachment.fileUrl); }}
      className="inline-flex items-center gap-2 mt-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
    >
      <span className="text-base">🎮</span>
      <div>
        <div className="font-medium">{attachment.fileName}</div>
        <div className="text-white/40">{(attachment.fileSize / 1024).toFixed(0)} KB</div>
      </div>
    </a>
  );
}

// Static placeholder card for .fbx — no client-side FBX rendering
function FbxPlaceholder({ attachment }: { attachment: Attachment }): React.ReactElement {
  return (
    <div className="inline-flex items-center gap-3 mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white/70">
      <span className="text-2xl">🎮</span>
      <div className="flex-1">
        <div className="font-medium text-white/80">{attachment.fileName}</div>
        <div className="text-white/40 mt-0.5">
          {(attachment.fileSize / 1024).toFixed(0)} KB · 3D 모델 (FBX)
        </div>
      </div>
      <a
        href={attachment.fileUrl}
        download={attachment.fileName}
        onClick={(e) => { e.preventDefault(); openExternal(attachment.fileUrl); }}
        className="px-2 py-1 bg-accent/20 hover:bg-accent/40 text-accent rounded text-xs transition-colors"
      >
        다운로드
      </a>
    </div>
  );
}

export function MessageItem({ message, onReply, isGrouped = false, selectMode = false, selected = false, onToggleSelect }: Props): React.ReactElement {
  const { user } = useAuthStore();
  const { editMessage, deleteMessage: softDelete, pinnedMessages } = useMessagesStore();
  const { prefs } = usePreferencesStore();
  const { channels } = useChannelsStore();
  const workspaceId = channels.find((c) => c.id === message.contextId)?.workspaceId;
  const senderRoleColor = useMemberColorsStore((s) => s.colors[message.senderId] ?? null);

  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showConvertToTask, setShowConvertToTask] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; initialIndex: number } | null>(null);
  const [mdViewerAttachment, setMdViewerAttachment] = useState<Attachment | null>(null);
  const [codeViewerAttachment, setCodeViewerAttachment] = useState<Attachment | null>(null);
  const [diffModal, setDiffModal] = useState<{ attachment: Attachment; prevFileUrl: string } | null>(null);
  const [loadingDiff, setLoadingDiff] = useState<string | null>(null);
  const [spriteModal, setSpriteModal] = useState<{ imageUrl: string; atlasUrl: string; fileName: string } | null>(null);
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [tagInput, setTagInput] = useState<string | null>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const metaAttachments = (message.metadata as { attachments?: Array<{ file_url: string; has_alpha?: boolean }> }).attachments;
  const alphaMap = new Map(metaAttachments?.map((att) => [att.file_url, att.has_alpha]) ?? []);
  const atlasAttachment = message.attachments.find((a) => a.fileName.toLowerCase().endsWith('.json'));
  const editHistory = ((message.metadata as Record<string, unknown>).editHistory as Array<{ content: string; editedAt: string }>) ?? [];
  const buildTag = (message.metadata as Record<string, unknown>).buildTag as string | undefined;
  const parentMessage = useMessagesStore((s) =>
    message.parentId ? (s.messages[message.contextId] ?? []).find((m) => m.id === message.parentId) ?? null : null
  );

  async function openDiff(attachment: Attachment): Promise<void> {
    if (message.contextType !== 'channel') return;
    setLoadingDiff(attachment.id);
    try {
      const { data } = await api.get<{ fileUrl: string } | null>(
        `/channels/${message.contextId}/attachment-history/${encodeURIComponent(attachment.fileName)}`,
        { params: { excludeMessageId: message.id } }
      );
      if (!data) {
        toast('이 파일의 이전 버전이 없습니다', { icon: 'ℹ️' });
      } else {
        setDiffModal({ attachment, prevFileUrl: data.fileUrl });
      }
    } catch {
      toast.error('이전 버전을 불러오지 못했습니다');
    } finally {
      setLoadingDiff(null);
    }
  }

  const embed = (message.metadata as Record<string, unknown>).embed;
  const linkPreview = (message.metadata as Record<string, unknown>).linkPreview as LinkPreviewData | undefined;
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

  async function handlePin() {
    const isPinnedNow = pinnedMessages[message.contextId]?.id === message.id;
    try {
      if (isPinnedNow) {
        await api.delete(`/messages/${message.id}/pin`);
        toast.success('고정 해제됨');
      } else {
        await api.post(`/messages/${message.id}/pin`);
        toast.success('메시지 고정됨');
      }
    } catch {
      toast.error('핀 작업에 실패했습니다');
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
        <Lightbox images={lightbox.images} initialIndex={lightbox.initialIndex} onClose={() => setLightbox(null)} />
      )}
      {mdViewerAttachment && (
        <MarkdownFileModal
          attachment={mdViewerAttachment}
          onClose={() => setMdViewerAttachment(null)}
        />
      )}
      {codeViewerAttachment && (
        <CodeFileModal
          attachment={codeViewerAttachment}
          enableHighlight={prefs.enableCodeHighlight}
          onClose={() => setCodeViewerAttachment(null)}
        />
      )}
      {diffModal && (
        <DiffModal
          newUrl={diffModal.attachment.fileUrl}
          prevUrl={diffModal.prevFileUrl}
          fileName={diffModal.attachment.fileName}
          onClose={() => setDiffModal(null)}
        />
      )}
      {spriteModal && (
        <SpriteSheetModal
          imageUrl={spriteModal.imageUrl}
          atlasUrl={spriteModal.atlasUrl}
          fileName={spriteModal.fileName}
          onClose={() => setSpriteModal(null)}
        />
      )}
      {showEditHistory && (
        <EditHistoryModal
          history={editHistory}
          onClose={() => setShowEditHistory(false)}
        />
      )}
      {tagInput !== null && (
        <TagInputModal
          currentTag={tagInput}
          onSave={async (tag) => {
            try {
              await api.patch(`/messages/${message.id}/tag`, { buildTag: tag || null });
              setTagInput(null);
            } catch {
              toast.error('태그 저장에 실패했습니다');
            }
          }}
          onClose={() => setTagInput(null)}
        />
      )}
      {showConvertToTask && workspaceId && (
        <TaskCreateModal
          workspaceId={workspaceId}
          initialTitle={message.content.slice(0, 100)}
          initialDescription={message.content.length > 100 ? message.content : undefined}
          onClose={() => setShowConvertToTask(false)}
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
            onClick={() => void handlePin()}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 text-white/80"
          >
            📌 {isPinned ? '고정 해제' : '고정'}
          </button>
          {workspaceId && (
            <button
              onClick={() => { setShowConvertToTask(true); setContextMenu(null); }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 text-white/80"
            >
              📋 태스크로 변환
            </button>
          )}
          <button
            onClick={() => { setTagInput(buildTag ?? ''); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 text-white/80"
          >
            🏷️ 빌드 태그 {buildTag ? `(${buildTag})` : '설정'}
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
        className={`flex gap-3 px-4 hover:bg-white/5 group relative transition-colors ${
          message.isPending ? 'opacity-60' : ''
        } ${isPinned ? 'border-l-2 border-accent/40' : ''} ${
          selected ? 'bg-accent/10' : ''
        }`}
        style={{
          paddingTop: isGrouped ? '0.125rem' : 'var(--message-padding-y)',
          paddingBottom: isGrouped ? '0.125rem' : 'var(--message-padding-y)',
          fontSize: 'var(--message-font-size)',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={selectMode ? undefined : handleContextMenu}
        onDoubleClick={selectMode ? undefined : handleDoubleClick}
        onClick={selectMode ? () => onToggleSelect?.(message.id) : undefined}
      >
        {selectMode ? (
          <div className="w-9 flex-shrink-0 flex items-center justify-center">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect?.(message.id)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded cursor-pointer accent-accent"
            />
          </div>
        ) : isGrouped ? (
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
              <span
                className="font-semibold text-sm"
                style={senderRoleColor ? { color: senderRoleColor } : undefined}
              >
                {message.sender.displayName}
              </span>
              <span
                className="text-xs text-white/40 cursor-default"
                title={fullTime}
              >
                {relativeTime}
              </span>
              {message.isEdited && (
                <button
                  onClick={() => editHistory.length > 0 && setShowEditHistory(true)}
                  className={`text-xs text-white/30 ${editHistory.length > 0 ? 'hover:text-white/50' : 'cursor-default'}`}
                >
                  (편집됨)
                </button>
              )}
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
              {message.parentId && parentMessage && (
                <div
                  className="flex items-start gap-2 mb-1 pl-2 border-l-2 border-white/20 opacity-70 text-xs text-white/60 truncate cursor-pointer hover:opacity-100 transition-opacity"
                  onClick={() => onReply(parentMessage)}
                >
                  <span className="font-medium text-white/80 shrink-0">{parentMessage.sender.displayName}</span>
                  <span className="truncate">{parentMessage.content.slice(0, 120)}</span>
                </div>
              )}
              <MarkdownContent content={message.content} enableCodeHighlight={prefs.enableCodeHighlight} />
              {isGrouped && (message.isEdited || message.isPending) && (
                <div className="flex gap-1 text-xs text-white/30">
                  {message.isEdited && (
                    <button
                      onClick={() => editHistory.length > 0 && setShowEditHistory(true)}
                      className={editHistory.length > 0 ? 'hover:text-white/50' : 'cursor-default'}
                    >
                      (편집됨)
                    </button>
                  )}
                  {message.isPending && <span>전송 중...</span>}
                </div>
              )}
              {buildTag && (
                <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 bg-accent/20 text-accent rounded text-[10px] font-mono">
                  🏷️ {buildTag}
                </span>
              )}
              {embed && <EmbedCard embed={embed as Parameters<typeof EmbedCard>[0]['embed']} />}
              {linkPreview && <LinkPreviewCard preview={linkPreview} />}
              {message.attachments.map((a) => {
                const lowerName = a.fileName.toLowerCase();
                if (lowerName.endsWith('.fbx')) {
                  return prefs.enable3DPreview ? (
                    <Suspense key={a.id} fallback={<FbxPlaceholder attachment={a} />}>
                      <FBXModelPreview fileUrl={a.fileUrl} fileName={a.fileName} fileSize={a.fileSize} />
                    </Suspense>
                  ) : (
                    <FbxPlaceholder key={a.id} attachment={a} />
                  );
                }
                if (lowerName.endsWith('.glb') || lowerName.endsWith('.gltf')) {
                  return prefs.enable3DPreview
                    ? <ModelViewerPreview key={a.id} attachment={a} />
                    : <Asset3DChip key={a.id} attachment={a} />;
                }
                if (isImage(a.mimeType)) {
                  return (
                    <div key={a.id} className="mt-1 inline-block relative">
                      <img
                        src={a.fileUrl}
                        alt={a.fileName}
                        draggable
                        onDragStart={(e) => handleAttachmentDragStart(e, a.mimeType, a.fileName, a.fileUrl)}
                        className="max-w-[400px] max-h-[300px] rounded cursor-pointer hover:opacity-90 transition-opacity object-cover"
                        onClick={() => setLightbox({ images: [{ src: a.fileUrl, fileName: a.fileName, fileSize: a.fileSize }], initialIndex: 0 })}
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.style.display = 'none';
                          el.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      {a.mimeType === 'image/png' && alphaMap.get(a.fileUrl) === true && (
                        <span className="absolute top-1 left-1 text-[9px] bg-black/70 text-white/80 px-1.5 py-0.5 rounded font-mono" title="알파 채널 포함">α</span>
                      )}
                      {atlasAttachment && (
                        <button
                          className="absolute bottom-1 right-1 text-[10px] bg-black/70 hover:bg-accent/80 text-white/80 hover:text-white px-1.5 py-0.5 rounded transition-colors"
                          title="스프라이트 시트 미리보기"
                          onClick={(e) => { e.stopPropagation(); setSpriteModal({ imageUrl: a.fileUrl, atlasUrl: atlasAttachment.fileUrl, fileName: a.fileName }); }}
                        >
                          🎮 스프라이트
                        </button>
                      )}
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
                if (isCodeFile(a.fileName)) {
                  const ext = a.fileName.slice(a.fileName.lastIndexOf('.')).toLowerCase();
                  const canDiff = DIFF_EXTS.has(ext) && message.contextType === 'channel';
                  return (
                    <div key={a.id} className="inline-flex items-center gap-1 mt-1">
                      <button
                        onClick={() => setCodeViewerAttachment(a)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors text-left"
                      >
                        <span className="text-base">📝</span>
                        <div>
                          <div className="font-medium">{a.fileName}</div>
                          <div className="text-white/40">{(a.fileSize / 1024).toFixed(0)} KB · 클릭하여 미리보기</div>
                        </div>
                      </button>
                      {canDiff && (
                        <button
                          onClick={() => void openDiff(a)}
                          disabled={loadingDiff === a.id}
                          className="px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] text-white/50 hover:bg-accent/20 hover:text-accent hover:border-accent/40 disabled:opacity-40 transition-colors"
                          title="이전 버전과 비교"
                        >
                          {loadingDiff === a.id ? '...' : 'diff'}
                        </button>
                      )}
                    </div>
                  );
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

/* =====================================================================
   EDIT HISTORY MODAL
   ===================================================================== */

interface EditHistoryItem { content: string; editedAt: string; }

function EditHistoryModal({ history, onClose }: { history: EditHistoryItem[]; onClose(): void }): React.ReactElement {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface border border-white/10 rounded-xl w-full max-w-xl max-h-[70vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
          <span className="font-semibold text-sm">편집 기록</span>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-4">편집 기록이 없습니다.</p>
          ) : [...history].reverse().map((item, idx) => (
            <div key={idx} className="border border-white/10 rounded-lg p-3">
              <div className="text-[10px] text-white/40 mb-1">
                {format(new Date(item.editedAt), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
              </div>
              <p className="text-sm text-white/80 whitespace-pre-wrap">{item.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   TAG INPUT MODAL
   ===================================================================== */

function TagInputModal({
  currentTag,
  onSave,
  onClose,
}: {
  currentTag: string;
  onSave(tag: string): Promise<void>;
  onClose(): void;
}): React.ReactElement {
  const [value, setValue] = useState(currentTag);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(value.trim());
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface border border-white/10 rounded-xl w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <span className="font-semibold text-sm">🏷️ 빌드 태그 설정</span>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={(e) => void submit(e)} className="p-4 space-y-3">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="예: v1.2.3, build-42, alpha..."
            className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-accent"
          />
          <div className="flex justify-between gap-2">
            {currentTag && (
              <button
                type="button"
                onClick={() => void onSave('')}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
              >
                태그 삭제
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-white/60 hover:text-white">취소</button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =====================================================================
   TEXT DIFF UTILITIES
   ===================================================================== */

interface DiffLine { type: 'equal' | 'delete' | 'insert'; line: string; }

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const o = oldText.split('\n').slice(0, 400);
  const n = newText.split('\n').slice(0, 400);
  const m = o.length, k = n.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(k + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= k; j++) {
      dp[i][j] = o[i - 1] === n[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const result: DiffLine[] = [];
  let i = m, j = k;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && o[i - 1] === n[j - 1]) {
      result.unshift({ type: 'equal', line: o[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'insert', line: n[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'delete', line: o[i - 1] });
      i--;
    }
  }
  return result;
}

/* =====================================================================
   UNITY SECTION PARSER
   ===================================================================== */

interface UnitySection { id: string; type: string; name?: string; content: string; }

function parseUnitySections(text: string): Map<string, UnitySection> {
  const map = new Map<string, UnitySection>();
  const parts = text.split(/(?=--- !u!)/);
  for (const part of parts) {
    const h = /^--- (!u!\d+) &(\d+)/.exec(part);
    if (!h) continue;
    const nameMatch = /m_Name: (.+)/.exec(part);
    map.set(h[2], { id: h[2], type: h[1], name: nameMatch?.[1]?.trim(), content: part });
  }
  return map;
}

interface UnitySummary {
  added: UnitySection[];
  removed: UnitySection[];
  modified: UnitySection[];
}

function computeUnitySummary(oldText: string, newText: string): UnitySummary {
  const oldSections = parseUnitySections(oldText);
  const newSections = parseUnitySections(newText);
  const added: UnitySection[] = [];
  const removed: UnitySection[] = [];
  const modified: UnitySection[] = [];
  for (const [id, sec] of newSections) {
    if (!oldSections.has(id)) added.push(sec);
    else if (oldSections.get(id)!.content !== sec.content) modified.push(sec);
  }
  for (const [id, sec] of oldSections) {
    if (!newSections.has(id)) removed.push(sec);
  }
  return { added, removed, modified };
}

interface DiffModalProps { newUrl: string; prevUrl: string; fileName: string; onClose(): void; }

function DiffModal({ newUrl, prevUrl, fileName, onClose }: DiffModalProps): React.ReactElement {
  const [diff, setDiff] = useState<DiffLine[] | null>(null);
  const [unitySummary, setUnitySummary] = useState<UnitySummary | null>(null);
  const [error, setError] = useState('');
  const isUnity = fileName.toLowerCase().endsWith('.unity');

  useEffect(() => {
    void (async () => {
      try {
        const [oldText, newText] = await Promise.all([
          fetch(prevUrl).then((r) => r.text()),
          fetch(newUrl).then((r) => r.text()),
        ]);
        if (isUnity) setUnitySummary(computeUnitySummary(oldText, newText));
        setDiff(computeLineDiff(oldText, newText));
      } catch {
        setError('파일을 불러올 수 없습니다');
      }
    })();
  }, [prevUrl, newUrl, isUnity]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-surface border border-white/20 rounded-xl w-[700px] max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <span className="font-semibold text-sm">변경사항: {fileName}</span>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto font-mono text-xs leading-5">
          {!diff && !error && <div className="p-8 text-center text-white/40">불러오는 중...</div>}
          {error && <div className="p-8 text-center text-red-400">{error}</div>}
          {unitySummary && (unitySummary.added.length > 0 || unitySummary.removed.length > 0 || unitySummary.modified.length > 0) && (
            <div className="px-4 py-3 border-b border-white/10 bg-black/20 font-sans space-y-1.5">
              <div className="text-white/60 text-xs font-medium mb-2">Unity 씬 변경 사항</div>
              {unitySummary.added.map((s) => (
                <div key={`add-${s.id}`} className="flex items-center gap-2 text-green-400 text-xs">
                  <span>+</span>
                  <span>{s.name ?? `오브젝트 #${s.id}`}</span>
                  <span className="text-green-600">{s.type}</span>
                </div>
              ))}
              {unitySummary.removed.map((s) => (
                <div key={`rem-${s.id}`} className="flex items-center gap-2 text-red-400 text-xs">
                  <span>−</span>
                  <span>{s.name ?? `오브젝트 #${s.id}`}</span>
                  <span className="text-red-600">{s.type}</span>
                </div>
              ))}
              {unitySummary.modified.map((s) => (
                <div key={`mod-${s.id}`} className="flex items-center gap-2 text-yellow-400 text-xs">
                  <span>~</span>
                  <span>{s.name ?? `오브젝트 #${s.id}`}</span>
                  <span className="text-yellow-600">{s.type}</span>
                </div>
              ))}
            </div>
          )}
          {diff && diff.map((dl, idx) => (
            <div
              key={idx}
              className={`px-3 whitespace-pre-wrap break-all ${
                dl.type === 'insert' ? 'bg-green-500/15 text-green-300' :
                dl.type === 'delete' ? 'bg-red-500/15 text-red-300' :
                'text-white/50'
              }`}
            >
              <span className="mr-2 select-none text-white/25">
                {dl.type === 'insert' ? '+' : dl.type === 'delete' ? '-' : ' '}
              </span>
              {dl.line || ' '}
            </div>
          ))}
        </div>
        {diff && (
          <div className="px-4 py-2 border-t border-white/10 text-xs text-white/40 flex-shrink-0">
            <span className="text-green-400">+{diff.filter((l) => l.type === 'insert').length}</span>
            {' '}
            <span className="text-red-400">-{diff.filter((l) => l.type === 'delete').length}</span>
            {' '}변경
          </div>
        )}
      </div>
    </div>
  );
}
