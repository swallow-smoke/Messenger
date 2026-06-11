import { create } from 'zustand';
import api from '../lib/api';

export interface Task {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: 'feature' | 'bug' | 'art' | 'design' | 'infra' | 'etc';
  seqNum: number;
  assigneeId?: string;
  assignee?: { id: string; displayName: string; avatarUrl?: string };
  dueDate?: string;
  linkedDocId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskFilters {
  status?: string;
  assigneeId?: string;
  priority?: string;
}

interface TasksState {
  tasks: Record<string, Task[]>;
  filters: TaskFilters;
  fetchTasks(workspaceId: string): Promise<void>;
  createTask(data: Partial<Task> & { workspaceId: string; title: string }): Promise<Task>;
  updateTask(id: string, data: Partial<Task>): Promise<void>;
  deleteTask(id: string, workspaceId: string): Promise<void>;
  setFilters(filters: TaskFilters): void;
  addTaskFromSocket(task: Task): void;
  updateTaskFromSocket(task: Task): void;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: {},
  filters: {},

  async fetchTasks(workspaceId) {
    const { filters } = get();
    const { data } = await api.get('/tasks', { params: { workspaceId, ...filters } });
    set((s) => ({ tasks: { ...s.tasks, [workspaceId]: data as Task[] } }));
  },

  async createTask(data) {
    const { data: task } = await api.post('/tasks', data);
    set((s) => ({
      tasks: { ...s.tasks, [data.workspaceId]: [...(s.tasks[data.workspaceId] ?? []), task as Task] },
    }));
    return task as Task;
  },

  async updateTask(id, data) {
    const { data: updated } = await api.patch(`/tasks/${id}`, data);
    const workspaceId = (updated as Task).workspaceId;
    set((s) => ({
      tasks: {
        ...s.tasks,
        [workspaceId]: (s.tasks[workspaceId] ?? []).map((t) => (t.id === id ? (updated as Task) : t)),
      },
    }));
  },

  async deleteTask(id, workspaceId) {
    await api.delete(`/tasks/${id}`);
    set((s) => ({
      tasks: { ...s.tasks, [workspaceId]: (s.tasks[workspaceId] ?? []).filter((t) => t.id !== id) },
    }));
  },

  setFilters(filters) {
    set({ filters });
  },

  addTaskFromSocket(task) {
    set((s) => {
      const list = s.tasks[task.workspaceId] ?? [];
      if (list.some((t) => t.id === task.id)) return s;
      return { tasks: { ...s.tasks, [task.workspaceId]: [...list, task] } };
    });
  },

  updateTaskFromSocket(task) {
    set((s) => ({
      tasks: {
        ...s.tasks,
        [task.workspaceId]: (s.tasks[task.workspaceId] ?? []).map((t) => (t.id === task.id ? task : t)),
      },
    }));
  },
}));
