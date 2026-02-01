/**
 * Dashboard event broadcaster - Broadcasts all agent events to dashboard.
 *
 * This module intercepts agent events and:
 * 1. Stores them to disk for persistence
 * 2. Broadcasts them to all connected dashboard clients
 * 3. Bypasses verboseLevel filtering for dashboard
 */
import { onAgentEvent, type AgentEventPayload } from "../infra/agent-events.js";
import {
  storeDashboardEvent,
  storeTaskEvent,
  initDashboardStorage,
  type TaskEventData,
  type DashboardEvent,
} from "./dashboard-storage.js";
import {
  initTaskStorage,
  shutdownTaskStorage,
  onTaskChange,
  type TaskChangeEvent,
} from "./task-storage.js";

/**
 * Dashboard broadcast function type.
 */
type BroadcastFn = (event: string, payload: unknown) => void;

let broadcastFn: BroadcastFn | null = null;
let initialized = false;
let unsubscribe: (() => void) | null = null;
let unsubscribeTaskChange: (() => void) | null = null;

// Track tool calls for auto-task creation
const activeToolCalls = new Map<string, { name: string; startedAt: number; args?: Record<string, unknown> }>();

/**
 * Initialize dashboard broadcaster.
 */
export function initDashboardBroadcaster(broadcast: BroadcastFn): void {
  if (initialized) return;

  broadcastFn = broadcast;
  initDashboardStorage();
  initTaskStorage();

  // Subscribe to ALL agent events (bypassing verboseLevel filter)
  unsubscribe = onAgentEvent((evt) => {
    if (!evt) return;
    handleDashboardAgentEvent(evt);
  });

  // Subscribe to task changes for real-time updates
  unsubscribeTaskChange = onTaskChange((event: TaskChangeEvent) => {
    if (broadcastFn) {
      broadcastFn("task", event);
    }
  });

  initialized = true;
  console.log("[dashboard] Dashboard broadcaster initialized");
}

/**
 * Shutdown dashboard broadcaster.
 */
export function shutdownDashboardBroadcaster(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (unsubscribeTaskChange) {
    unsubscribeTaskChange();
    unsubscribeTaskChange = null;
  }
  shutdownTaskStorage();
  initialized = false;
  broadcastFn = null;
}

/**
 * Handle agent event for dashboard.
 * This is called for ALL agent events, regardless of verboseLevel.
 */
export function handleDashboardAgentEvent(evt: AgentEventPayload): void {
  if (!initialized || !broadcastFn) return;

  const ts = evt.ts ?? Date.now();
  const data = evt.data ?? {};

  // Store event to disk
  const storedEvent = storeDashboardEvent({
    ts,
    runId: evt.runId,
    sessionKey: evt.sessionKey,
    stream: evt.stream as DashboardEvent["stream"],
    phase: typeof data.phase === "string" ? data.phase : undefined,
    data,
  });

  // Auto-create tasks from tool calls
  if (evt.stream === "tool") {
    handleToolEventForTasks(evt);
  }

  // Broadcast to dashboard clients (using "dashboard" event type)
  broadcastFn("dashboard", storedEvent);
}

/**
 * Handle tool events to auto-create tasks.
 */
function handleToolEventForTasks(evt: AgentEventPayload): void {
  if (!broadcastFn) return;

  const data = evt.data ?? {};
  const phase = typeof data.phase === "string" ? data.phase : "";
  const toolCallId = typeof data.toolCallId === "string" ? data.toolCallId : "";
  const name = typeof data.name === "string" ? data.name : "tool";

  if (phase === "start") {
    // Track tool call start
    activeToolCalls.set(toolCallId, {
      name,
      startedAt: evt.ts ?? Date.now(),
      args: data.args as Record<string, unknown> | undefined,
    });

    // Emit task created event
    const taskData: TaskEventData = {
      taskId: `tool-${toolCallId}`,
      action: "started",
      name: `Tool: ${name}`,
      description: formatArgsPreview(data.args),
      status: "active",
    };

    const taskEvent = storeTaskEvent(evt.runId, evt.sessionKey, taskData);
    broadcastFn("dashboard", taskEvent);
  } else if (phase === "result") {
    const toolCall = activeToolCalls.get(toolCallId);
    activeToolCalls.delete(toolCallId);

    // Determine success/failure
    const isError = data.isError === true || (typeof data.error === "string" && data.error.length > 0);

    // Emit task completed/failed event
    const taskData: TaskEventData = {
      taskId: `tool-${toolCallId}`,
      action: isError ? "failed" : "completed",
      name: `Tool: ${name}`,
      status: isError ? "failed" : "completed",
      progress: 100,
      error: isError ? (typeof data.error === "string" ? data.error : "Tool execution failed") : undefined,
    };

    const taskEvent = storeTaskEvent(evt.runId, evt.sessionKey, taskData);
    broadcastFn("dashboard", taskEvent);
  }
}

/**
 * Format args preview for task description.
 */
function formatArgsPreview(args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;

  const record = args as Record<string, unknown>;
  const keys = Object.keys(record).slice(0, 2);

  if (keys.length === 0) return undefined;

  return keys
    .map((k) => {
      const v = record[k];
      if (typeof v === "string") {
        return `${k}="${v.slice(0, 30)}${v.length > 30 ? "..." : ""}"`;
      }
      return `${k}=${JSON.stringify(v).slice(0, 20)}`;
    })
    .join(", ");
}

/**
 * Emit a task event.
 */
export function emitTaskEvent(
  runId: string,
  sessionKey: string | undefined,
  taskData: TaskEventData,
): void {
  if (!initialized || !broadcastFn) return;

  const storedEvent = storeTaskEvent(runId, sessionKey, taskData);
  broadcastFn("dashboard", storedEvent);
}

/**
 * Create a task tracker for a run.
 */
export function createTaskTracker(runId: string, sessionKey?: string) {
  const tasks = new Map<string, TaskEventData>();

  return {
    /**
     * Create a new task.
     */
    createTask(taskId: string, name: string, description?: string): void {
      const taskData: TaskEventData = {
        taskId,
        action: "created",
        name,
        description,
        status: "pending",
      };
      tasks.set(taskId, taskData);
      emitTaskEvent(runId, sessionKey, taskData);
    },

    /**
     * Start a task.
     */
    startTask(taskId: string): void {
      const task = tasks.get(taskId);
      if (!task) return;

      task.action = "started";
      task.status = "active";
      emitTaskEvent(runId, sessionKey, task);
    },

    /**
     * Update task progress.
     */
    updateProgress(taskId: string, progress: number): void {
      const task = tasks.get(taskId);
      if (!task) return;

      task.action = "progress";
      task.progress = progress;
      emitTaskEvent(runId, sessionKey, task);
    },

    /**
     * Complete a task.
     */
    completeTask(taskId: string): void {
      const task = tasks.get(taskId);
      if (!task) return;

      task.action = "completed";
      task.status = "completed";
      task.progress = 100;
      emitTaskEvent(runId, sessionKey, task);
    },

    /**
     * Fail a task.
     */
    failTask(taskId: string, error: string): void {
      const task = tasks.get(taskId);
      if (!task) return;

      task.action = "failed";
      task.status = "failed";
      task.error = error;
      emitTaskEvent(runId, sessionKey, task);
    },

    /**
     * Get all tasks.
     */
    getTasks(): TaskEventData[] {
      return Array.from(tasks.values());
    },
  };
}
