import React, { useState } from 'react';
import { useTasksStore } from '../../store/tasks';
import toast from 'react-hot-toast';

interface Props {
  workspaceId: string;
  onClose(): void;
}

const STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const;
const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
const TYPES = ['feature', 'bug', 'art', 'design', 'infra', 'etc'] as const;

const STATUS_KO: Record<string, string> = { backlog: 'Backlog', todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const PRIORITY_KO: Record<string, string> = { critical: '긴급', high: '높음', medium: '보통', low: '낮음' };
const TYPE_KO: Record<string, string> = { feature: '기능', bug: '버그', art: '아트', design: '디자인', infra: '인프라', etc: '기타' };

const PRIORITY_COLOR: Record<string, string> = { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-blue-400' };

export function TaskCreateModal({ workspaceId, onClose }: Props): React.ReactElement {
  const { createTask } = useTasksStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<typeof STATUSES[number]>('backlog');
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>('medium');
  const [type, setType] = useState<typeof TYPES[number]>('feature');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!title.trim()) { toast.error('제목을 입력하세요'); return; }
    setLoading(true);
    try {
      await createTask({
        workspaceId,
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        type,
        dueDate: dueDate || undefined,
      });
      toast.success('태스크가 생성되었습니다');
      onClose();
    } catch {
      toast.error('태스크 생성 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface border border-white/10 rounded-xl w-full max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">새 태스크</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-1">제목 *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="태스크 제목..."
              className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="상세 내용..."
              className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent resize-none placeholder-white/30"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-white/60 mb-1">상태</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof STATUSES[number])}
                className="w-full bg-white/10 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-accent"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_KO[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">우선순위</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof PRIORITIES[number])}
                className="w-full bg-white/10 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-accent"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p} className={PRIORITY_COLOR[p]}>{PRIORITY_KO[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">유형</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as typeof TYPES[number])}
                className="w-full bg-white/10 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-accent"
              >
                {TYPES.map((t) => <option key={t} value={t}>{TYPE_KO[t]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">마감일</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm text-white/60 hover:text-white border border-white/10 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 text-sm bg-accent hover:bg-accent/80 disabled:opacity-50 rounded-lg font-medium transition-colors"
            >
              {loading ? '생성 중...' : '태스크 만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
