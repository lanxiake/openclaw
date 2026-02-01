/**
 * Dashboard controller - State management for agent dashboard.
 */
import type { AgentEventPayload } from "../app-tool-stream";

/**
 * Task status.
 */
export type TaskStatus = "pending" | "active" | "completed" | "failed";

/**
 * Task entry.
 */
export type TaskEntry = {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  progress?: number;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
  error?: string;
};

/**
 * Timeline event.
 */
export type TimelineEvent = {
  id: string;
  ts: number;
  stream: string;
  phase?: string;
  title: string;
  detail?: string;
  duration?: number;
  toolCallId?: string;
  runId?: string;
};

/**
 * Tool call detail for inspector.
 */
export type ToolCallDetail = {
  toolCallId: string;
  name: string;
  status: "running" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  duration?: number;
  args?: Record<string, unknown>;
  result?: unknown;
};

/**
 * Current run info.
 */
export type CurrentRun = {
  runId: string;
  sessionKey: string;
  startedAt: number;
  status: "running" | "completed" | "failed";
};

/**
 * Resource usage.
 */
export type ResourceUsage = {
  tokensUsed: number;
  tokensLimit: number;
  apiCalls: number;
  duration: number;
};

/** Default context window limit for Claude models (200k tokens) */
const DEFAULT_TOKEN_LIMIT = 200_000;

/**
 * Timeline event limit.
 */
const TIMELINE_MAX_EVENTS = 200;

/**
 * Dashboard state.
 */
export type DashboardState = {
  currentRun: CurrentRun | null;
  tasks: TaskEntry[];
  timeline: TimelineEvent[];
  resources: ResourceUsage;
  toolCallStartTimes: Map<string, number>;
  toolCallDetails: Map<string, ToolCallDetail>;
  eventIdCounter: number;
};

/**
 * Dashboard host interface.
 */
export type DashboardHost = {
  sessionKey: string;
  dashboardState: DashboardState;
  requestUpdate: () => void;
};

/**
 * Create initial dashboard state.
 */
export function createDashboardState(): DashboardState {
  return {
    currentRun: null,
    tasks: [],
    timeline: [],
    resources: {
      tokensUsed: 0,
      tokensLimit: DEFAULT_TOKEN_LIMIT,
      apiCalls: 0,
      duration: 0,
    },
    toolCallStartTimes: new Map(),
    toolCallDetails: new Map(),
    eventIdCounter: 0,
  };
}

/**
 * Reset dashboard state.
 */
export function resetDashboardState(host: DashboardHost): void {
  host.dashboardState = createDashboardState();
  host.requestUpdate();
}

/**
 * Clear timeline only.
 */
export function clearDashboardTimeline(host: DashboardHost): void {
  host.dashboardState = {
    ...host.dashboardState,
    timeline: [],
  };
  host.requestUpdate();
}

/**
 * Generate unique event ID.
 */
function generateEventId(state: DashboardState): string {
  state.eventIdCounter++;
  return `evt-${Date.now()}-${state.eventIdCounter}`;
}

/**
 * Add timeline event.
 */
function addTimelineEvent(host: DashboardHost, event: Omit<TimelineEvent, "id">): void {
  const state = host.dashboardState;
  const newEvent: TimelineEvent = {
    id: generateEventId(state),
    ...event,
  };

  // Add to beginning (newest first) - create new array for immutability
  const newTimeline = [newEvent, ...state.timeline];

  // Trim if over limit
  host.dashboardState = {
    ...state,
    timeline: newTimeline.length > TIMELINE_MAX_EVENTS
      ? newTimeline.slice(0, TIMELINE_MAX_EVENTS)
      : newTimeline,
  };
}

/**
 * Handle lifecycle events.
 */
function handleLifecycleEvent(host: DashboardHost, payload: AgentEventPayload): void {
  const data = payload.data ?? {};
  const phase = typeof data.phase === "string" ? data.phase : "";
  const state = host.dashboardState;

  if (phase === "start") {
    // New run started - create new state immutably
    host.dashboardState = {
      ...state,
      currentRun: {
        runId: payload.runId,
        sessionKey: payload.sessionKey ?? host.sessionKey,
        startedAt: payload.ts,
        status: "running",
      },
      resources: {
        ...state.resources,
        apiCalls: 0,
        duration: 0,
      },
    };

    addTimelineEvent(host, {
      ts: payload.ts,
      stream: "lifecycle",
      phase: "start",
      title: "Agent Started",
      detail: `Run: ${payload.runId.slice(0, 8)}...`,
      runId: payload.runId,
    });
  } else if (phase === "end") {
    // Run completed
    if (state.currentRun && state.currentRun.runId === payload.runId) {
      const duration = payload.ts - state.currentRun.startedAt;
      host.dashboardState = {
        ...host.dashboardState,
        currentRun: {
          ...state.currentRun,
          status: "completed",
        },
        resources: {
          ...host.dashboardState.resources,
          duration,
        },
      };
    }

    addTimelineEvent(host, {
      ts: payload.ts,
      stream: "lifecycle",
      phase: "end",
      title: "Agent Completed",
      duration: state.currentRun ? payload.ts - state.currentRun.startedAt : undefined,
      runId: payload.runId,
    });
  } else if (phase === "error") {
    // Run failed
    if (state.currentRun && state.currentRun.runId === payload.runId) {
      host.dashboardState = {
        ...host.dashboardState,
        currentRun: {
          ...state.currentRun,
          status: "failed",
        },
      };
    }

    const error = typeof data.error === "string" ? data.error : "Unknown error";
    addTimelineEvent(host, {
      ts: payload.ts,
      stream: "lifecycle",
      phase: "error",
      title: "Agent Error",
      detail: error,
      runId: payload.runId,
    });
  }
}

/**
 * Handle tool events.
 */
function handleToolEvent(host: DashboardHost, payload: AgentEventPayload): void {
  const data = payload.data ?? {};
  const phase = typeof data.phase === "string" ? data.phase : "";
  const toolCallId = typeof data.toolCallId === "string" ? data.toolCallId : "";
  const name = typeof data.name === "string" ? data.name : "tool";
  const state = host.dashboardState;

  if (phase === "start") {
    // Tool started - track start time in state
    state.toolCallStartTimes.set(toolCallId, payload.ts);

    // Store tool call detail
    const args = data.args && typeof data.args === "object"
      ? (data.args as Record<string, unknown>)
      : undefined;

    state.toolCallDetails.set(toolCallId, {
      toolCallId,
      name,
      status: "running",
      startedAt: payload.ts,
      args,
    });

    // Update API calls count immutably
    host.dashboardState = {
      ...state,
      resources: {
        ...state.resources,
        apiCalls: state.resources.apiCalls + 1,
      },
    };

    // Format args preview
    let argsPreview = "";
    if (args) {
      const keys = Object.keys(args).slice(0, 2);
      argsPreview = keys
        .map((k) => {
          const v = args[k];
          if (typeof v === "string") {
            return `${k}="${v.slice(0, 30)}${v.length > 30 ? "..." : ""}"`;
          }
          return `${k}=${JSON.stringify(v).slice(0, 20)}`;
        })
        .join(", ");
    }

    addTimelineEvent(host, {
      ts: payload.ts,
      stream: "tool",
      phase: "start",
      title: `Tool: ${name}`,
      detail: argsPreview || undefined,
      toolCallId,
      runId: payload.runId,
    });
  } else if (phase === "result") {
    // Tool completed
    const startTime = state.toolCallStartTimes.get(toolCallId);
    const duration = startTime ? payload.ts - startTime : undefined;
    state.toolCallStartTimes.delete(toolCallId);

    // Update tool call detail
    const existingDetail = state.toolCallDetails.get(toolCallId);
    if (existingDetail) {
      state.toolCallDetails.set(toolCallId, {
        ...existingDetail,
        status: "completed",
        completedAt: payload.ts,
        duration,
        result: data.result,
      });
    }

    // Format result preview
    let resultPreview = "";
    if (data.result !== undefined) {
      if (typeof data.result === "string") {
        resultPreview = data.result.slice(0, 50);
        if (data.result.length > 50) resultPreview += "...";
      } else if (typeof data.result === "object" && data.result !== null) {
        const result = data.result as Record<string, unknown>;
        if (typeof result.text === "string") {
          resultPreview = result.text.slice(0, 50);
          if (result.text.length > 50) resultPreview += "...";
        } else if (result.success !== undefined) {
          resultPreview = result.success ? "Success" : "Failed";
        }
      }
    }

    addTimelineEvent(host, {
      ts: payload.ts,
      stream: "tool",
      phase: "result",
      title: `Tool: ${name}`,
      detail: resultPreview || "Completed",
      duration,
      toolCallId,
      runId: payload.runId,
    });
  }
}

/**
 * Handle assistant events.
 */
function handleAssistantEvent(host: DashboardHost, payload: AgentEventPayload): void {
  const data = payload.data ?? {};
  const text = typeof data.text === "string" ? data.text : "";

  // Only log significant assistant messages (not deltas)
  if (text && text.length > 20) {
    addTimelineEvent(host, {
      ts: payload.ts,
      stream: "assistant",
      title: "Assistant Response",
      detail: text.slice(0, 100) + (text.length > 100 ? "..." : ""),
      runId: payload.runId,
    });
  }
}

/**
 * Handle compaction events.
 */
function handleCompactionEvent(host: DashboardHost, payload: AgentEventPayload): void {
  const data = payload.data ?? {};
  const phase = typeof data.phase === "string" ? data.phase : "";

  if (phase === "start") {
    addTimelineEvent(host, {
      ts: payload.ts,
      stream: "compaction",
      phase: "start",
      title: "Context Compaction",
      detail: "Compacting conversation history...",
      runId: payload.runId,
    });
  } else if (phase === "end") {
    addTimelineEvent(host, {
      ts: payload.ts,
      stream: "compaction",
      phase: "end",
      title: "Context Compaction",
      detail: "Completed",
      runId: payload.runId,
    });
  }
}

/**
 * Handle agent event for dashboard.
 */
export function handleDashboardAgentEvent(
  host: DashboardHost,
  payload?: AgentEventPayload,
): void {
  if (!payload) return;

  // Validate required fields
  if (typeof payload.stream !== "string") return;
  if (typeof payload.runId !== "string" || !payload.runId) return;
  if (typeof payload.ts !== "number") return;

  // Filter by session
  const sessionKey = typeof payload.sessionKey === "string" ? payload.sessionKey : undefined;
  if (sessionKey && sessionKey !== host.sessionKey) return;

  try {
    // Route to appropriate handler
    switch (payload.stream) {
      case "lifecycle":
        handleLifecycleEvent(host, payload);
        break;
      case "tool":
        handleToolEvent(host, payload);
        break;
      case "assistant":
        handleAssistantEvent(host, payload);
        break;
      case "compaction":
        handleCompactionEvent(host, payload);
        break;
    }

    // Update duration if running
    const state = host.dashboardState;
    if (state.currentRun && state.currentRun.status === "running") {
      host.dashboardState = {
        ...state,
        resources: {
          ...state.resources,
          duration: Date.now() - state.currentRun.startedAt,
        },
      };
    }
  } catch (err) {
    // Log error but don't interrupt event flow
    console.error("[dashboard] Error handling agent event:", err);
  }

  host.requestUpdate();
}

/**
 * Add a task to the dashboard.
 */
export function addDashboardTask(host: DashboardHost, task: TaskEntry): void {
  const state = host.dashboardState;
  const existingIndex = state.tasks.findIndex((t) => t.id === task.id);
  if (existingIndex >= 0) {
    // Update existing task immutably
    host.dashboardState = {
      ...state,
      tasks: [
        ...state.tasks.slice(0, existingIndex),
        task,
        ...state.tasks.slice(existingIndex + 1),
      ],
    };
  } else {
    // Add new task immutably
    host.dashboardState = {
      ...state,
      tasks: [...state.tasks, task],
    };
  }
  host.requestUpdate();
}

/**
 * Update a task status.
 */
export function updateDashboardTask(
  host: DashboardHost,
  taskId: string,
  updates: Partial<TaskEntry>,
): void {
  const state = host.dashboardState;
  const taskIndex = state.tasks.findIndex((t) => t.id === taskId);
  if (taskIndex >= 0) {
    const task = state.tasks[taskIndex];
    const updatedTask: TaskEntry = {
      ...task,
      ...updates,
      ...(updates.status === "completed" && task.startedAt
        ? {
            completedAt: Date.now(),
            duration: Date.now() - task.startedAt,
          }
        : {}),
    };
    host.dashboardState = {
      ...state,
      tasks: [
        ...state.tasks.slice(0, taskIndex),
        updatedTask,
        ...state.tasks.slice(taskIndex + 1),
      ],
    };
    host.requestUpdate();
  }
}

/**
 * Remove a task from the dashboard.
 */
export function removeDashboardTask(host: DashboardHost, taskId: string): void {
  const state = host.dashboardState;
  host.dashboardState = {
    ...state,
    tasks: state.tasks.filter((t) => t.id !== taskId),
  };
  host.requestUpdate();
}

/**
 * Update resource usage.
 */
export function updateDashboardResources(
  host: DashboardHost,
  updates: Partial<ResourceUsage>,
): void {
  host.dashboardState = {
    ...host.dashboardState,
    resources: {
      ...host.dashboardState.resources,
      ...updates,
    },
  };
  host.requestUpdate();
}

/**
 * Get tool call detail by ID.
 */
export function getToolCallDetail(
  state: DashboardState,
  toolCallId: string,
): ToolCallDetail | null {
  return state.toolCallDetails.get(toolCallId) ?? null;
}

/**
 * Get task by ID.
 */
export function getTaskById(
  state: DashboardState,
  taskId: string,
): TaskEntry | null {
  return state.tasks.find((t) => t.id === taskId) ?? null;
}

/**
 * Dashboard event from server (stored event format).
 */
export type DashboardEvent = {
  id: string;
  ts: number;
  runId: string;
  sessionKey?: string;
  stream: string;
  phase?: string;
  data: Record<string, unknown>;
};

/**
 * Handle dashboard event from server.
 * This handles events from the dedicated dashboard broadcaster.
 */
export function handleDashboardEvent(
  host: DashboardHost,
  event?: DashboardEvent,
): void {
  if (!event) return;

  // Validate required fields
  if (typeof event.stream !== "string") return;
  if (typeof event.runId !== "string" || !event.runId) return;
  if (typeof event.ts !== "number") return;

  // Filter by session
  if (event.sessionKey && event.sessionKey !== host.sessionKey) return;

  try {
    // Handle task events
    if (event.stream === "task") {
      handleTaskEvent(host, event);
      host.requestUpdate();
      return;
    }

    // Convert to AgentEventPayload format and use existing handler
    const payload: AgentEventPayload = {
      runId: event.runId,
      seq: 0,
      stream: event.stream,
      ts: event.ts,
      sessionKey: event.sessionKey,
      data: event.data,
    };

    // Route to appropriate handler
    switch (event.stream) {
      case "lifecycle":
        handleLifecycleEvent(host, payload);
        break;
      case "tool":
        handleToolEvent(host, payload);
        break;
      case "assistant":
        handleAssistantEvent(host, payload);
        break;
      case "compaction":
        handleCompactionEvent(host, payload);
        break;
    }

    // Update duration if running
    const state = host.dashboardState;
    if (state.currentRun && state.currentRun.status === "running") {
      host.dashboardState = {
        ...state,
        resources: {
          ...state.resources,
          duration: Date.now() - state.currentRun.startedAt,
        },
      };
    }
  } catch (err) {
    console.error("[dashboard] Error handling dashboard event:", err);
  }

  host.requestUpdate();
}

/**
 * Handle task event.
 */
function handleTaskEvent(host: DashboardHost, event: DashboardEvent): void {
  const data = event.data;
  const taskId = typeof data.taskId === "string" ? data.taskId : "";
  const action = typeof data.action === "string" ? data.action : "";
  const name = typeof data.name === "string" ? data.name : "Task";
  const description = typeof data.description === "string" ? data.description : undefined;
  const status = typeof data.status === "string" ? data.status as TaskStatus : "pending";
  const progress = typeof data.progress === "number" ? data.progress : undefined;
  const error = typeof data.error === "string" ? data.error : undefined;

  if (!taskId) return;

  const state = host.dashboardState;
  const existingIndex = state.tasks.findIndex((t) => t.id === taskId);

  if (action === "created" || action === "started") {
    const task: TaskEntry = {
      id: taskId,
      name,
      description,
      status,
      progress,
      startedAt: action === "started" ? event.ts : undefined,
    };

    if (existingIndex >= 0) {
      // Update existing task
      host.dashboardState = {
        ...state,
        tasks: [
          ...state.tasks.slice(0, existingIndex),
          { ...state.tasks[existingIndex], ...task },
          ...state.tasks.slice(existingIndex + 1),
        ],
      };
    } else {
      // Add new task
      host.dashboardState = {
        ...state,
        tasks: [...state.tasks, task],
      };
    }
  } else if (action === "progress" && existingIndex >= 0) {
    // Update progress
    const task = state.tasks[existingIndex];
    host.dashboardState = {
      ...state,
      tasks: [
        ...state.tasks.slice(0, existingIndex),
        { ...task, progress, status },
        ...state.tasks.slice(existingIndex + 1),
      ],
    };
  } else if ((action === "completed" || action === "failed") && existingIndex >= 0) {
    // Complete or fail task
    const task = state.tasks[existingIndex];
    const completedAt = event.ts;
    const duration = task.startedAt ? completedAt - task.startedAt : undefined;

    host.dashboardState = {
      ...state,
      tasks: [
        ...state.tasks.slice(0, existingIndex),
        {
          ...task,
          status,
          progress: action === "completed" ? 100 : task.progress,
          completedAt,
          duration,
          error: action === "failed" ? error : undefined,
        },
        ...state.tasks.slice(existingIndex + 1),
      ],
    };
  }
}
