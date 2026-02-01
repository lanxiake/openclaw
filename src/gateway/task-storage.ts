/**
 * Task storage module - Persists tasks to disk with real-time change notifications.
 *
 * This module provides:
 * - Task CRUD operations with JSON persistence
 * - Change listeners for real-time WebSocket updates
 * - Automatic cleanup of old completed tasks
 * - Debounced disk writes for performance
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { resolveStateDir } from "../config/paths.js";
import type {
  Task,
  TaskCreateParams,
  TaskUpdateParams,
  TaskListParams,
  TaskListResult,
  TaskStatsResult,
  TaskChangeEvent,
  TaskChangeType,
} from "./protocol/index.js";

// Re-export TaskChangeEvent for consumers
export type { TaskChangeEvent } from "./protocol/index.js";

/**
 * Task storage configuration.
 */
export type TaskStorageConfig = {
  /** Storage directory */
  storageDir: string;
  /** Maximum age of completed tasks in milliseconds (default: 7 days) */
  maxCompletedTaskAge: number;
  /** Maximum number of tasks to keep */
  maxTasks: number;
  /** Debounce delay for disk writes in milliseconds */
  saveDebounceMs: number;
};

const DEFAULT_CONFIG: TaskStorageConfig = {
  storageDir: join(resolveStateDir(), "dashboard"),
  maxCompletedTaskAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxTasks: 10000,
  saveDebounceMs: 100,
};

let config = { ...DEFAULT_CONFIG };
let tasks = new Map<string, Task>();
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

type TaskChangeListener = (event: TaskChangeEvent) => void;
const changeListeners = new Set<TaskChangeListener>();

/**
 * Get the task storage file path.
 */
function getTaskFilePath(): string {
  return join(config.storageDir, "tasks.json");
}

/**
 * Load tasks from disk.
 */
function loadTasksFromDisk(): void {
  const filePath = getTaskFilePath();
  if (!existsSync(filePath)) {
    tasks = new Map();
    return;
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const data = JSON.parse(content) as Task[];
    tasks = new Map(data.map((task) => [task.id, task]));
  } catch (err) {
    console.error("[task-storage] Failed to load tasks:", err);
    tasks = new Map();
  }
}

/**
 * Save tasks to disk (debounced).
 */
function scheduleSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveTasksToDisk();
    saveTimeout = null;
  }, config.saveDebounceMs);
}

/**
 * Save tasks to disk immediately.
 */
function saveTasksToDisk(): void {
  const filePath = getTaskFilePath();
  try {
    const data = Array.from(tasks.values());
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[task-storage] Failed to save tasks:", err);
  }
}

/**
 * Notify change listeners.
 */
function notifyChange(type: TaskChangeType, task: Task | undefined, taskId: string): void {
  const event: TaskChangeEvent = {
    type,
    task,
    taskId,
    timestamp: Date.now(),
  };
  for (const listener of changeListeners) {
    try {
      listener(event);
    } catch (err) {
      console.error("[task-storage] Change listener error:", err);
    }
  }
}

/**
 * Initialize task storage.
 */
export function initTaskStorage(customConfig?: Partial<TaskStorageConfig>): void {
  if (initialized) {
    return;
  }

  config = { ...DEFAULT_CONFIG, ...customConfig };

  // Ensure storage directory exists
  if (!existsSync(config.storageDir)) {
    mkdirSync(config.storageDir, { recursive: true });
  }

  loadTasksFromDisk();
  cleanupOldTasks();
  initialized = true;
}

/**
 * Shutdown task storage.
 */
export function shutdownTaskStorage(): void {
  if (!initialized) {
    return;
  }

  // Flush pending saves
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
    saveTasksToDisk();
  }

  tasks.clear();
  changeListeners.clear();
  initialized = false;
}

/**
 * Subscribe to task changes.
 */
export function onTaskChange(listener: TaskChangeListener): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

/**
 * Create a new task.
 */
export function createTask(params: TaskCreateParams): Task {
  const now = Date.now();
  const task: Task = {
    id: randomUUID(),
    title: params.title,
    description: params.description,
    status: params.status ?? "pending",
    priority: params.priority,
    progress: params.progress,
    runId: params.runId,
    sessionKey: params.sessionKey,
    parentId: params.parentId,
    tags: params.tags,
    metadata: params.metadata,
    createdAt: now,
    updatedAt: now,
  };

  tasks.set(task.id, task);
  scheduleSave();
  notifyChange("created", task, task.id);

  return task;
}

/**
 * Update an existing task.
 */
export function updateTask(params: TaskUpdateParams): Task | null {
  const existing = tasks.get(params.id);
  if (!existing) {
    return null;
  }

  const now = Date.now();
  const updated: Task = {
    ...existing,
    updatedAt: now,
  };

  // Apply updates (null means clear the field)
  if (params.title !== undefined) {
    updated.title = params.title;
  }
  if (params.description !== undefined) {
    updated.description = params.description === null ? undefined : params.description;
  }
  if (params.status !== undefined) {
    updated.status = params.status;
    // Set completedAt when task is completed/failed/cancelled
    if (["completed", "failed", "cancelled"].includes(params.status)) {
      updated.completedAt = now;
    } else {
      updated.completedAt = undefined;
    }
  }
  if (params.priority !== undefined) {
    updated.priority = params.priority === null ? undefined : params.priority;
  }
  if (params.progress !== undefined) {
    updated.progress = params.progress === null ? undefined : params.progress;
  }
  if (params.runId !== undefined) {
    updated.runId = params.runId === null ? undefined : params.runId;
  }
  if (params.sessionKey !== undefined) {
    updated.sessionKey = params.sessionKey === null ? undefined : params.sessionKey;
  }
  if (params.parentId !== undefined) {
    updated.parentId = params.parentId === null ? undefined : params.parentId;
  }
  if (params.tags !== undefined) {
    updated.tags = params.tags === null ? undefined : params.tags;
  }
  if (params.metadata !== undefined) {
    updated.metadata = params.metadata === null ? undefined : params.metadata;
  }

  tasks.set(updated.id, updated);
  scheduleSave();
  notifyChange("updated", updated, updated.id);

  return updated;
}

/**
 * Delete a task.
 */
export function deleteTask(id: string): boolean {
  const existing = tasks.get(id);
  if (!existing) {
    return false;
  }

  tasks.delete(id);
  scheduleSave();
  notifyChange("deleted", undefined, id);

  return true;
}

/**
 * Get a task by ID.
 */
export function getTask(id: string): Task | null {
  return tasks.get(id) ?? null;
}

/**
 * List tasks with filtering and pagination.
 */
export function listTasks(params: TaskListParams = {}): TaskListResult {
  const {
    status,
    priority,
    runId,
    sessionKey,
    parentId,
    tags,
    search,
    limit = 100,
    offset = 0,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = params;

  let filtered = Array.from(tasks.values());

  // Apply filters
  if (status) {
    filtered = filtered.filter((t) => t.status === status);
  }
  if (priority) {
    filtered = filtered.filter((t) => t.priority === priority);
  }
  if (runId) {
    filtered = filtered.filter((t) => t.runId === runId);
  }
  if (sessionKey) {
    filtered = filtered.filter((t) => t.sessionKey === sessionKey);
  }
  if (parentId) {
    filtered = filtered.filter((t) => t.parentId === parentId);
  }
  if (tags && tags.length > 0) {
    filtered = filtered.filter((t) => t.tags?.some((tag) => tags.includes(tag)));
  }
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(searchLower) ||
        t.description?.toLowerCase().includes(searchLower),
    );
  }

  // Sort
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const statusOrder = { active: 0, pending: 1, completed: 2, failed: 3, cancelled: 4 };

  const sorted = filtered.toSorted((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "createdAt":
        cmp = a.createdAt - b.createdAt;
        break;
      case "updatedAt":
        cmp = a.updatedAt - b.updatedAt;
        break;
      case "priority": {
        const aPriority = a.priority ? priorityOrder[a.priority] : 3;
        const bPriority = b.priority ? priorityOrder[b.priority] : 3;
        cmp = aPriority - bPriority;
        break;
      }
      case "status":
        cmp = statusOrder[a.status] - statusOrder[b.status];
        break;
    }
    return sortOrder === "desc" ? -cmp : cmp;
  });

  const total = sorted.length;
  const taskList = sorted.slice(offset, offset + limit);
  const hasMore = offset + taskList.length < total;

  return { tasks: taskList, total, hasMore };
}

/**
 * Get task statistics.
 */
export function getTaskStats(): TaskStatsResult {
  const allTasks = Array.from(tasks.values());

  const byStatus = {
    pending: 0,
    active: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };

  const byPriority = {
    low: 0,
    medium: 0,
    high: 0,
    unset: 0,
  };

  for (const task of allTasks) {
    byStatus[task.status]++;
    if (task.priority) {
      byPriority[task.priority]++;
    } else {
      byPriority.unset++;
    }
  }

  return {
    total: allTasks.length,
    byStatus,
    byPriority,
  };
}

/**
 * Clean up old completed tasks.
 */
export function cleanupOldTasks(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [id, task] of tasks) {
    // Remove old completed/failed/cancelled tasks
    if (
      task.completedAt &&
      ["completed", "failed", "cancelled"].includes(task.status) &&
      now - task.completedAt > config.maxCompletedTaskAge
    ) {
      tasks.delete(id);
      cleaned++;
    }
  }

  // If still over limit, remove oldest completed tasks
  if (tasks.size > config.maxTasks) {
    const completedTasks = Array.from(tasks.values())
      .filter((t) => ["completed", "failed", "cancelled"].includes(t.status))
      .toSorted((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));

    while (tasks.size > config.maxTasks && completedTasks.length > 0) {
      const oldest = completedTasks.shift();
      if (oldest) {
        tasks.delete(oldest.id);
        cleaned++;
      }
    }
  }

  if (cleaned > 0) {
    scheduleSave();
    console.log(`[task-storage] Cleaned up ${cleaned} old tasks`);
  }

  return cleaned;
}

/**
 * Get all tasks (for internal use).
 */
export function getAllTasks(): Task[] {
  return Array.from(tasks.values());
}
