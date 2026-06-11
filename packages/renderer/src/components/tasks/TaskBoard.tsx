import React, { useEffect, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useTasksStore } from '../../store/tasks';
import type { Task } from '../../store/tasks';
import { TaskCard } from './TaskCard';
import { TaskDetail } from './TaskDetail';
import { TaskCreateModal } from './TaskCreateModal';

const COLUMNS: Task['status'][] = ['backlog', 'todo', 'in_progress', 'review', 'done'];

const COLUMN_LABEL: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-blue-400',
};

const TYPE_BADGE: Record<string, string> = {
  feature: 'bg-blue-500/20 text-blue-300',
  bug: 'bg-red-500/20 text-red-300',
  art: 'bg-purple-500/20 text-purple-300',
  design: 'bg-pink-500/20 text-pink-300',
  infra: 'bg-gray-500/20 text-gray-300',
  etc: 'bg-white/10 text-white/50',
};

interface Props {
  workspaceId: string;
}

export function TaskBoard({ workspaceId }: Props): React.ReactElement {
  const { tasks, fetchTasks, updateTask } = useTasksStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const allTasks = tasks[workspaceId] ?? [];

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    void fetchTasks(workspaceId);
  }, [workspaceId, fetchTasks]);

  const filteredTasks = filterStatus ? allTasks.filter((t) => t.status === filterStatus) : allTasks;

  function getByStatus(status: Task['status']): Task[] {
    return filteredTasks.filter((t) => t.status === status);
  }

  async function handleDragEnd(event: DragEndEvent): Promise<void> {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const targetTask = allTasks.find((t) => t.id === over.id);
    if (!targetTask) return;
    const draggedTask = allTasks.find((t) => t.id === active.id);
    if (!draggedTask || draggedTask.status === targetTask.status) return;
    await updateTask(draggedTask.id, { status: targetTask.status });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0">
        <h2 className="font-semibold text-sm">태스크</h2>
        <div className="flex-1" />
        {/* Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-white/10 rounded-lg px-2 py-1 text-xs outline-none"
        >
          <option value="">전체</option>
          {COLUMNS.map((s) => <option key={s} value={s}>{COLUMN_LABEL[s]}</option>)}
        </select>
        {/* View toggle */}
        <div className="flex gap-1 bg-white/10 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('board')}
            className={`px-2 py-1 rounded text-xs transition-colors ${viewMode === 'board' ? 'bg-accent text-white' : 'text-white/50 hover:text-white'}`}
          >
            보드
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-2 py-1 rounded text-xs transition-colors ${viewMode === 'list' ? 'bg-accent text-white' : 'text-white/50 hover:text-white'}`}
          >
            목록
          </button>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent/80 rounded-lg text-xs font-medium transition-colors"
        >
          <span>+</span> 태스크 추가
        </button>
      </div>

      {/* Content */}
      {viewMode === 'board' ? (
        <div className="flex gap-3 p-4 overflow-x-auto flex-1">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
            {COLUMNS.map((status) => {
              const col = getByStatus(status);
              return (
                <div key={status} className="flex flex-col gap-2 min-w-52 w-52 flex-shrink-0">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                      {COLUMN_LABEL[status]}
                    </span>
                    <span className="text-xs text-white/30">{col.length}</span>
                  </div>
                  <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                    <SortableContext items={col.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                      {col.map((task) => (
                        <TaskCard key={task.id} task={task} onClick={setSelectedTask} />
                      ))}
                    </SortableContext>
                    <button
                      onClick={() => setShowCreate(true)}
                      className="w-full py-1.5 text-xs text-white/30 hover:text-white/60 hover:bg-white/5 rounded-lg transition-colors border border-dashed border-white/10"
                    >
                      + 추가
                    </button>
                  </div>
                </div>
              );
            })}
          </DndContext>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface/95">
              <tr className="border-b border-white/10 text-xs text-white/40">
                <th className="text-left px-4 py-2">제목</th>
                <th className="text-left px-3 py-2">유형</th>
                <th className="text-left px-3 py-2">우선순위</th>
                <th className="text-left px-3 py-2">상태</th>
                <th className="text-left px-3 py-2">담당자</th>
                <th className="text-left px-3 py-2">마감일</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white/30 text-xs font-mono">#{task.seqNum}</span>
                      <span className="font-medium">{task.title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_BADGE[task.type] ?? TYPE_BADGE.etc}`}>
                      {task.type}
                    </span>
                  </td>
                  <td className={`px-3 py-2 text-xs font-medium ${PRIORITY_COLOR[task.priority] ?? ''}`}>
                    {task.priority}
                  </td>
                  <td className="px-3 py-2 text-xs text-white/60">{COLUMN_LABEL[task.status]}</td>
                  <td className="px-3 py-2 text-xs text-white/50">
                    {task.assignee?.displayName ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-white/40">
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-white/30 text-sm">
                    태스크가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedTask && (
        <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
      {showCreate && (
        <TaskCreateModal workspaceId={workspaceId} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
