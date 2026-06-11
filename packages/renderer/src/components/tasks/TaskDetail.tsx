import React, { useEffect, useState } from 'react';
import type { Task } from '../../store/tasks';
import { useTasksStore } from '../../store/tasks';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Comment {
  id: string;
  content: string;
  author: { id: string; displayName: string; avatarUrl?: string };
  createdAt: string;
}

interface Props {
  task: Task;
  onClose(): void;
}

const STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'] as const;
const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

const STATUS_KO: Record<string, string> = { backlog: 'Backlog', todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done', cancelled: '취소됨' };
const PRIORITY_KO: Record<string, string> = { critical: '긴급', high: '높음', medium: '보통', low: '낮음' };
const PRIORITY_COLOR: Record<string, string> = { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-blue-400' };
const TYPE_KO: Record<string, string> = { feature: '기능', bug: '버그', art: '아트', design: '디자인', infra: '인프라', etc: '기타' };

export function TaskDetail({ task, onClose }: Props): React.ReactElement {
  const { updateTask } = useTasksStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/tasks/${task.id}/comments`)
      .then(({ data }) => setComments(data as Comment[]))
      .catch(() => {});
  }, [task.id]);

  async function addComment(): Promise<void> {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/tasks/${task.id}/comments`, { content: newComment });
      setComments((c) => [...c, data as Comment]);
      setNewComment('');
    } catch {
      toast.error('댓글 추가 실패');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(status: typeof STATUSES[number]): Promise<void> {
    await updateTask(task.id, { status }).catch(() => toast.error('업데이트 실패'));
  }

  async function updatePriority(priority: typeof PRIORITIES[number]): Promise<void> {
    await updateTask(task.id, { priority }).catch(() => toast.error('업데이트 실패'));
  }

  async function saveTitle(): Promise<void> {
    if (!title.trim() || title === task.title) { setEditingTitle(false); return; }
    await updateTask(task.id, { title: title.trim() }).catch(() => toast.error('업데이트 실패'));
    setEditingTitle(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface border border-white/10 rounded-xl max-w-2xl w-full mx-4 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-white/10 gap-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <span className="text-accent font-mono text-xs mt-1 flex-shrink-0">#{task.seqNum}</span>
            {editingTitle ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => void saveTitle()}
                onKeyDown={(e) => { if (e.key === 'Enter') void saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                className="flex-1 bg-white/10 rounded px-2 py-0.5 text-base font-semibold outline-none focus:ring-1 focus:ring-accent"
                autoFocus
              />
            ) : (
              <h2
                className="font-semibold text-base cursor-pointer hover:text-white/80 flex-1"
                onDoubleClick={() => setEditingTitle(true)}
                title="더블클릭으로 수정"
              >
                {task.title}
              </h2>
            )}
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none flex-shrink-0">&times;</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {task.description && (
              <div>
                <h3 className="text-xs font-semibold text-white/40 uppercase mb-1.5">설명</h3>
                <p className="text-sm text-white/70 whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            {/* Comments */}
            <div>
              <h3 className="text-xs font-semibold text-white/40 uppercase mb-3">댓글 {comments.length > 0 && `(${comments.length})`}</h3>
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5 text-sm">
                    <div className="w-7 h-7 rounded-full bg-white/20 flex-shrink-0 flex items-center justify-center text-xs font-semibold">
                      {c.author.avatarUrl ? (
                        <img src={c.author.avatarUrl} alt={c.author.displayName} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        c.author.displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-xs">{c.author.displayName}</span>
                        <span className="text-[10px] text-white/30">{new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-white/70 mt-0.5">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar meta */}
          <div className="w-44 flex-shrink-0 border-l border-white/10 p-4 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">상태</label>
              <select
                value={task.status}
                onChange={(e) => void updateStatus(e.target.value as typeof STATUSES[number])}
                className="w-full bg-white/10 rounded px-2 py-1 text-xs outline-none"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_KO[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">우선순위</label>
              <select
                value={task.priority}
                onChange={(e) => void updatePriority(e.target.value as typeof PRIORITIES[number])}
                className={`w-full bg-white/10 rounded px-2 py-1 text-xs outline-none ${PRIORITY_COLOR[task.priority]}`}
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_KO[p]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">유형</label>
              <div className="text-xs text-white/60">{TYPE_KO[task.type] ?? task.type}</div>
            </div>
            {task.assignee && (
              <div>
                <label className="block text-xs text-white/40 mb-1.5">담당자</label>
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="w-5 h-5 rounded-full bg-accent/70 flex items-center justify-center text-[10px] font-bold">
                    {task.assignee.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate">{task.assignee.displayName}</span>
                </div>
              </div>
            )}
            {task.dueDate && (
              <div>
                <label className="block text-xs text-white/40 mb-1.5">마감일</label>
                <div className="text-xs text-white/60">{new Date(task.dueDate).toLocaleDateString()}</div>
              </div>
            )}
          </div>
        </div>

        {/* Comment input */}
        <div className="px-6 py-4 border-t border-white/10 flex gap-2 flex-shrink-0">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) void addComment(); }}
            placeholder="댓글 추가..."
            className="flex-1 bg-white/10 rounded-lg px-3 py-1.5 text-sm outline-none placeholder-white/30 focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={() => void addComment()}
            disabled={submitting || !newComment.trim()}
            className="px-4 py-1.5 bg-accent hover:bg-accent/80 disabled:opacity-50 rounded-lg text-sm transition-colors"
          >
            작성
          </button>
        </div>
      </div>
    </div>
  );
}
