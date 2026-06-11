import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../../store/tasks';

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-white/40',
};

interface Props {
  task: Task;
  onClick(task: Task): void;
}

export function TaskCard({ task, onClick }: Props): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(task)}
      className="bg-surface border border-white/10 rounded-lg p-3 cursor-pointer hover:border-accent/50 transition-colors"
    >
      <div className="flex items-start gap-2">
        <span className="text-xs text-white/40 font-mono mt-0.5">#{task.seqNum}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs ${PRIORITY_COLOR[task.priority]}`}>{task.priority}</span>
            <span className="text-xs text-white/30">{task.type}</span>
            {task.assignee && (
              <span className="text-xs text-white/50 ml-auto truncate">{task.assignee.displayName}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
