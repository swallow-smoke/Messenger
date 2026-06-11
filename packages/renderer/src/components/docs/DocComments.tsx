import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import api from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import { UserAvatar } from '../user/UserAvatar';
import toast from 'react-hot-toast';
import type { DocComment } from '../../store/docs';

interface Props {
  docId: string;
  workspaceMembers?: Array<{ id: string; displayName: string; avatarUrl?: string }>;
}

function CommentInput({
  placeholder,
  onSubmit,
  onCancel,
  members = [],
}: {
  placeholder?: string;
  onSubmit(content: string): Promise<void>;
  onCancel?(): void;
  members?: Props['workspaceMembers'];
}) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredMembers = mentionQuery !== null
    ? (members ?? []).filter((m) =>
        m.displayName.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 6)
    : [];

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setValue(v);
    const pos = e.target.selectionStart ?? v.length;
    const before = v.slice(0, pos);
    const match = /@(\w*)$/.exec(before);
    if (match) {
      setMentionQuery(match[1]);
      setMentionStart(match.index);
    } else {
      setMentionQuery(null);
    }
  }

  function insertMention(member: { displayName: string }) {
    const pos = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(pos);
    const next = `${before}@${member.displayName} ${after}`;
    setValue(next);
    setMentionQuery(null);
    setTimeout(() => {
      const newPos = mentionStart + member.displayName.length + 2;
      textareaRef.current?.setSelectionRange(newPos, newPos);
      textareaRef.current?.focus();
    }, 0);
  }

  async function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setValue('');
    } catch {
      // error already shown by caller
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative">
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 bg-surface border border-white/15 rounded-lg shadow-xl z-10 py-1 min-w-48">
          {filteredMembers.map((m) => (
            <button
              key={m.id}
              onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 flex items-center gap-2"
            >
              <UserAvatar userId={m.id} displayName={m.displayName} avatarUrl={m.avatarUrl} size="xs" />
              <span>{m.displayName}</span>
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !mentionQuery) {
            e.preventDefault();
            void handleSubmit();
          }
          if (e.key === 'Escape') {
            setMentionQuery(null);
            onCancel?.();
          }
        }}
        placeholder={placeholder ?? '댓글을 입력하세요... (@멘션 지원)'}
        rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-accent resize-none"
      />
      <div className="flex justify-end gap-2 mt-1.5">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1 text-xs text-white/50 hover:text-white transition-colors"
          >
            취소
          </button>
        )}
        <button
          onClick={() => void handleSubmit()}
          disabled={!value.trim() || submitting}
          className="px-3 py-1 text-xs bg-accent hover:bg-accent/80 disabled:opacity-40 rounded-md font-medium transition-colors"
        >
          {submitting ? '...' : '등록'}
        </button>
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  currentUserId,
  onDelete,
  onReply,
  members,
}: {
  comment: DocComment;
  currentUserId: string;
  onDelete(id: string): Promise<void>;
  onReply(parentId: string, content: string): Promise<void>;
  members?: Props['workspaceMembers'];
}) {
  const [showReplyInput, setShowReplyInput] = useState(false);

  const relTime = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ko });

  return (
    <div className="group">
      <div className="flex gap-2.5">
        <UserAvatar
          userId={comment.author.id}
          displayName={comment.author.displayName}
          avatarUrl={comment.author.avatarUrl}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{comment.author.displayName}</span>
            <span className="text-xs text-white/30">{relTime}</span>
            <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setShowReplyInput((v) => !v)}
                className="text-xs text-white/40 hover:text-accent px-1.5 py-0.5 rounded hover:bg-white/5"
              >
                답글
              </button>
              {comment.authorId === currentUserId && (
                <button
                  onClick={() => void onDelete(comment.id)}
                  className="text-xs text-white/30 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-red-500/10"
                >
                  삭제
                </button>
              )}
            </div>
          </div>
          <div className="mt-0.5 text-sm prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.content}</ReactMarkdown>
          </div>

          {comment.replies.length > 0 && (
            <div className="mt-2 pl-3 border-l border-white/10 space-y-2">
              {comment.replies.map((reply) => (
                <div key={reply.id} className="group/reply flex gap-2">
                  <UserAvatar
                    userId={reply.author.id}
                    displayName={reply.author.displayName}
                    avatarUrl={reply.author.avatarUrl}
                    size="xs"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">{reply.author.displayName}</span>
                      <span className="text-xs text-white/30">
                        {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true, locale: ko })}
                      </span>
                      {reply.authorId === currentUserId && (
                        <button
                          onClick={() => void onDelete(reply.id)}
                          className="ml-auto text-xs text-white/30 hover:text-red-400 opacity-0 group-hover/reply:opacity-100 transition-opacity"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{reply.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showReplyInput && (
            <div className="mt-2 pl-3 border-l border-white/10">
              <CommentInput
                placeholder="답글 입력... (@멘션 지원)"
                onSubmit={async (content) => {
                  await onReply(comment.id, content);
                  setShowReplyInput(false);
                }}
                onCancel={() => setShowReplyInput(false)}
                members={members}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocComments({ docId, workspaceMembers }: Props): React.ReactElement {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<DocComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/documents/${docId}/comments`)
      .then(({ data }) => setComments(data as DocComment[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [docId]);

  async function addComment(content: string): Promise<void> {
    const { data } = await api.post(`/documents/${docId}/comments`, { content });
    setComments((prev) => [...prev, data as DocComment]);
  }

  async function addReply(parentId: string, content: string): Promise<void> {
    const { data } = await api.post(`/documents/${docId}/comments`, { content, parentId });
    const reply = data as DocComment;
    setComments((prev) =>
      prev.map((c) =>
        c.id === parentId ? { ...c, replies: [...c.replies, reply] } : c
      )
    );
  }

  async function deleteComment(id: string): Promise<void> {
    try {
      await api.delete(`/documents/${docId}/comments/${id}`);
      setComments((prev) => {
        const filtered = prev.filter((c) => c.id !== id);
        return filtered.map((c) => ({
          ...c,
          replies: c.replies.filter((r) => r.id !== id),
        }));
      });
    } catch {
      toast.error('댓글 삭제 실패');
    }
  }

  if (!user) return <></>;

  return (
    <div className="border-t border-white/10 mt-6 pt-6">
      <h3 className="text-sm font-semibold text-white/70 mb-4">
        댓글{comments.length > 0 ? ` (${comments.length})` : ''}
      </h3>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-2.5 animate-pulse">
              <div className="w-7 h-7 rounded-full bg-white/10 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-24 bg-white/10 rounded" />
                <div className="h-2.5 w-full bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-white/30 mb-4">첫 번째 댓글을 남겨보세요.</p>
      ) : (
        <div className="space-y-5 mb-5">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              currentUserId={user.id}
              onDelete={deleteComment}
              onReply={addReply}
              members={workspaceMembers}
            />
          ))}
        </div>
      )}

      <CommentInput
        onSubmit={async (content) => {
          try {
            await addComment(content);
          } catch {
            toast.error('댓글 등록 실패');
            throw new Error('failed');
          }
        }}
        members={workspaceMembers}
      />
    </div>
  );
}
