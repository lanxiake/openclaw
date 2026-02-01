/**
 * Dashboard view - Real-time visualization of agent execution.
 */
import { html, nothing } from "lit";

import { formatDurationMs } from "../format";
import { icon } from "../icons";
import type { DashboardState, TimelineEvent, TaskEntry, ToolCallDetail } from "../controllers/dashboard";

/**
 * Timeline filter options.
 */
export type TimelineFilter = "all" | "lifecycle" | "tool" | "assistant" | "compaction";

export type DashboardProps = {
  connected: boolean;
  sessionKey: string;
  state: DashboardState;
  selectedTask: TaskEntry | null;
  selectedToolCall: ToolCallDetail | null;
  timelineFilter: TimelineFilter;
  onClearTimeline: () => void;
  onSelectTask: (taskId: string | null) => void;
  onSelectToolCall: (toolCallId: string | null) => void;
  onTimelineFilterChange: (filter: TimelineFilter) => void;
};

/**
 * Format timestamp for display.
 */
function formatTime(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Format full timestamp with date.
 */
function formatFullTime(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Get icon for event type.
 */
function getEventIcon(event: TimelineEvent): ReturnType<typeof icon> {
  switch (event.stream) {
    case "lifecycle":
      if (event.phase === "start") return icon("play");
      if (event.phase === "end") return icon("checkCircle");
      if (event.phase === "error") return icon("alertCircle");
      return icon("circle");
    case "tool":
      if (event.phase === "start") return icon("loader");
      if (event.phase === "result") return icon("check");
      return icon("tool");
    case "assistant":
      return icon("messageSquare");
    case "compaction":
      return icon("minimize");
    default:
      return icon("circle");
  }
}

/**
 * Get CSS class for event type.
 */
function getEventClass(event: TimelineEvent, isSelected: boolean): string {
  const classes = ["timeline-event"];
  classes.push(`timeline-event--${event.stream}`);
  if (event.phase) {
    classes.push(`timeline-event--${event.phase}`);
  }
  if (isSelected) {
    classes.push("timeline-event--selected");
  }
  return classes.join(" ");
}

/**
 * Render a single timeline event.
 */
function renderTimelineEvent(
  event: TimelineEvent,
  selectedToolCallId: string | null,
  onSelectToolCall: (id: string | null) => void,
) {
  const clickable = event.stream === "tool" && event.toolCallId;
  const isSelected = clickable && event.toolCallId === selectedToolCallId;

  return html`
    <div
      class=${getEventClass(event, isSelected)}
      @click=${clickable ? () => onSelectToolCall(isSelected ? null : event.toolCallId!) : nothing}
      style=${clickable ? "cursor: pointer" : ""}
    >
      <span class="timeline-time">${formatTime(event.ts)}</span>
      <span class="timeline-icon">${getEventIcon(event)}</span>
      <span class="timeline-content">
        <span class="timeline-title">${event.title}</span>
        ${event.detail ? html`<span class="timeline-detail">${event.detail}</span>` : nothing}
        ${event.duration != null
          ? html`<span class="timeline-duration">${formatDurationMs(event.duration)}</span>`
          : nothing}
      </span>
    </div>
  `;
}

/**
 * Render task card.
 */
function renderTaskCard(task: TaskEntry, isSelected: boolean, onSelect: (id: string | null) => void) {
  const statusIcon = (() => {
    switch (task.status) {
      case "pending":
        return icon("clock");
      case "active":
        return icon("loader");
      case "completed":
        return icon("checkCircle");
      case "failed":
        return icon("xCircle");
      default:
        return icon("circle");
    }
  })();

  return html`
    <div
      class="task-card task-card--${task.status} ${isSelected ? "task-card--selected" : ""}"
      @click=${() => onSelect(isSelected ? null : task.id)}
    >
      <div class="task-card-header">
        <span class="task-card-icon">${statusIcon}</span>
        <span class="task-card-name">${task.name}</span>
      </div>
      ${task.description
        ? html`<div class="task-card-description">${task.description}</div>`
        : nothing}
      ${task.progress != null
        ? html`
            <div class="task-card-progress">
              <div class="task-card-progress-bar" style="width: ${task.progress}%"></div>
            </div>
          `
        : nothing}
      ${task.duration != null
        ? html`<div class="task-card-duration">${formatDurationMs(task.duration)}</div>`
        : nothing}
    </div>
  `;
}

/**
 * Render task column.
 */
function renderTaskColumn(
  title: string,
  tasks: TaskEntry[],
  selectedTaskId: string | null,
  onSelect: (id: string | null) => void,
) {
  return html`
    <div class="task-column">
      <div class="task-column-header">
        <span class="task-column-title">${title}</span>
        <span class="task-column-count">(${tasks.length})</span>
      </div>
      <div class="task-column-body">
        ${tasks.length > 0
          ? tasks.map((task) => renderTaskCard(task, task.id === selectedTaskId, onSelect))
          : html`<div class="task-column-empty">No tasks</div>`}
      </div>
    </div>
  `;
}

/**
 * Render task detail panel.
 */
function renderTaskDetailPanel(task: TaskEntry, onClose: () => void) {
  const statusLabel = {
    pending: "Pending",
    active: "In Progress",
    completed: "Completed",
    failed: "Failed",
  }[task.status];

  return html`
    <div class="detail-panel">
      <div class="detail-panel-header">
        <span class="detail-panel-title">Task Details</span>
        <button class="detail-panel-close" @click=${onClose} title="Close">
          ${icon("x")}
        </button>
      </div>
      <div class="detail-panel-body">
        <div class="detail-field">
          <span class="detail-label">Name</span>
          <span class="detail-value">${task.name}</span>
        </div>
        <div class="detail-field">
          <span class="detail-label">Status</span>
          <span class="detail-value detail-status detail-status--${task.status}">
            ${statusLabel}
          </span>
        </div>
        ${task.description
          ? html`
              <div class="detail-field">
                <span class="detail-label">Description</span>
                <span class="detail-value">${task.description}</span>
              </div>
            `
          : nothing}
        ${task.progress != null
          ? html`
              <div class="detail-field">
                <span class="detail-label">Progress</span>
                <div class="detail-progress">
                  <div class="detail-progress-bar" style="width: ${task.progress}%"></div>
                  <span class="detail-progress-text">${task.progress}%</span>
                </div>
              </div>
            `
          : nothing}
        ${task.startedAt
          ? html`
              <div class="detail-field">
                <span class="detail-label">Started</span>
                <span class="detail-value detail-value--mono">${formatFullTime(task.startedAt)}</span>
              </div>
            `
          : nothing}
        ${task.completedAt
          ? html`
              <div class="detail-field">
                <span class="detail-label">Completed</span>
                <span class="detail-value detail-value--mono">${formatFullTime(task.completedAt)}</span>
              </div>
            `
          : nothing}
        ${task.duration != null
          ? html`
              <div class="detail-field">
                <span class="detail-label">Duration</span>
                <span class="detail-value detail-value--mono">${formatDurationMs(task.duration)}</span>
              </div>
            `
          : nothing}
        ${task.error
          ? html`
              <div class="detail-field">
                <span class="detail-label">Error</span>
                <div class="detail-error">${task.error}</div>
              </div>
            `
          : nothing}
      </div>
    </div>
  `;
}

/**
 * Format JSON for display.
 */
function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Render tool call inspector panel.
 */
function renderToolCallInspector(toolCall: ToolCallDetail, onClose: () => void) {
  const statusLabel = toolCall.status === "running" ? "Running" : toolCall.status === "completed" ? "Completed" : "Failed";

  return html`
    <div class="detail-panel detail-panel--wide">
      <div class="detail-panel-header">
        <span class="detail-panel-title">Tool Inspector</span>
        <button class="detail-panel-close" @click=${onClose} title="Close">
          ${icon("x")}
        </button>
      </div>
      <div class="detail-panel-body">
        <div class="detail-field">
          <span class="detail-label">Tool</span>
          <span class="detail-value detail-value--highlight">${toolCall.name}</span>
        </div>
        <div class="detail-field">
          <span class="detail-label">Status</span>
          <span class="detail-value detail-status detail-status--${toolCall.status}">
            ${statusLabel}
          </span>
        </div>
        <div class="detail-field">
          <span class="detail-label">Tool Call ID</span>
          <span class="detail-value detail-value--mono">${toolCall.toolCallId}</span>
        </div>
        ${toolCall.startedAt
          ? html`
              <div class="detail-field">
                <span class="detail-label">Started</span>
                <span class="detail-value detail-value--mono">${formatFullTime(toolCall.startedAt)}</span>
              </div>
            `
          : nothing}
        ${toolCall.duration != null
          ? html`
              <div class="detail-field">
                <span class="detail-label">Duration</span>
                <span class="detail-value detail-value--mono">${formatDurationMs(toolCall.duration)}</span>
              </div>
            `
          : nothing}
        ${toolCall.args
          ? html`
              <div class="detail-field detail-field--block">
                <span class="detail-label">Arguments</span>
                <pre class="detail-code">${formatJson(toolCall.args)}</pre>
              </div>
            `
          : nothing}
        ${toolCall.result !== undefined
          ? html`
              <div class="detail-field detail-field--block">
                <span class="detail-label">Result</span>
                <pre class="detail-code ${toolCall.status === "failed" ? "detail-code--error" : ""}">${formatJson(toolCall.result)}</pre>
              </div>
            `
          : nothing}
      </div>
    </div>
  `;
}

/**
 * Render timeline filter.
 */
function renderTimelineFilter(
  currentFilter: TimelineFilter,
  onFilterChange: (filter: TimelineFilter) => void,
) {
  const filters: Array<{ value: TimelineFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "lifecycle", label: "Lifecycle" },
    { value: "tool", label: "Tools" },
    { value: "assistant", label: "Assistant" },
    { value: "compaction", label: "Compaction" },
  ];

  return html`
    <div class="timeline-filters">
      ${filters.map(
        (f) => html`
          <button
            class="timeline-filter-btn ${currentFilter === f.value ? "timeline-filter-btn--active" : ""}"
            @click=${() => onFilterChange(f.value)}
          >
            ${f.label}
          </button>
        `,
      )}
    </div>
  `;
}

/**
 * Render resource monitor.
 */
function renderResourceMonitor(state: DashboardState) {
  const { resources } = state;
  const tokenPercent = resources.tokensLimit > 0
    ? Math.min(100, (resources.tokensUsed / resources.tokensLimit) * 100)
    : 0;
  const tokenWarning = tokenPercent > 80;

  return html`
    <div class="resource-monitor">
      <div class="resource-item">
        <span class="resource-label">Tokens</span>
        <span class="resource-value ${tokenWarning ? "resource-warning" : ""}">
          ${(resources.tokensUsed / 1000).toFixed(1)}k / ${(resources.tokensLimit / 1000).toFixed(0)}k
        </span>
        <div class="resource-bar">
          <div
            class="resource-bar-fill ${tokenWarning ? "resource-bar-warning" : ""}"
            style="width: ${tokenPercent}%"
          ></div>
        </div>
      </div>
      <div class="resource-item">
        <span class="resource-label">API Calls</span>
        <span class="resource-value">${resources.apiCalls}</span>
      </div>
      <div class="resource-item">
        <span class="resource-label">Duration</span>
        <span class="resource-value">${formatDurationMs(resources.duration)}</span>
      </div>
    </div>
  `;
}

/**
 * Filter timeline events.
 */
function filterTimeline(events: TimelineEvent[], filter: TimelineFilter): TimelineEvent[] {
  if (filter === "all") return events;
  return events.filter((e) => e.stream === filter);
}

/**
 * Render the dashboard view.
 */
export function renderDashboard(props: DashboardProps) {
  const {
    connected,
    sessionKey,
    state,
    selectedTask,
    selectedToolCall,
    timelineFilter,
    onClearTimeline,
    onSelectTask,
    onSelectToolCall,
    onTimelineFilterChange,
  } = props;

  if (!connected) {
    return html`
      <div class="dashboard-disconnected">
        <div class="dashboard-disconnected-icon">${icon("wifiOff")}</div>
        <div class="dashboard-disconnected-text">
          Connect to gateway to view agent dashboard
        </div>
      </div>
    `;
  }

  // Group tasks by status
  const pendingTasks = state.tasks.filter((t) => t.status === "pending");
  const activeTasks = state.tasks.filter((t) => t.status === "active");
  const completedTasks = state.tasks.filter((t) => t.status === "completed");
  const failedTasks = state.tasks.filter((t) => t.status === "failed");

  // Filter timeline
  const filteredTimeline = filterTimeline(state.timeline, timelineFilter);

  // Current run info
  const runInfo = state.currentRun
    ? html`
        <div class="dashboard-run-info">
          <span class="run-status run-status--${state.currentRun.status}">
            ${state.currentRun.status === "running" ? icon("loader") : icon("checkCircle")}
            ${state.currentRun.status}
          </span>
          <span class="run-id">Run: ${state.currentRun.runId.slice(0, 8)}...</span>
          <span class="run-session">Session: ${sessionKey}</span>
        </div>
      `
    : html`
        <div class="dashboard-run-info">
          <span class="run-status run-status--idle">
            ${icon("circle")}
            Idle
          </span>
          <span class="run-session">Session: ${sessionKey}</span>
        </div>
      `;

  // Check if any panel is open
  const hasDetailPanel = selectedTask || selectedToolCall;

  return html`
    <div class="dashboard ${hasDetailPanel ? "dashboard--with-panel" : ""}">
      <div class="dashboard-main">
        <!-- Header -->
        <div class="dashboard-header">
          <div class="dashboard-title">
            ${icon("barChart")}
            <span>Agent Dashboard</span>
          </div>
          ${runInfo}
        </div>

        <!-- Task Board -->
        <div class="dashboard-section">
          <div class="dashboard-section-header">
            <span class="dashboard-section-title">Task Board</span>
          </div>
          <div class="task-board">
            ${renderTaskColumn("Pending", pendingTasks, selectedTask?.id ?? null, onSelectTask)}
            ${renderTaskColumn("Active", activeTasks, selectedTask?.id ?? null, onSelectTask)}
            ${renderTaskColumn("Completed", completedTasks, selectedTask?.id ?? null, onSelectTask)}
            ${renderTaskColumn("Failed", failedTasks, selectedTask?.id ?? null, onSelectTask)}
          </div>
        </div>

        <!-- Timeline -->
        <div class="dashboard-section">
          <div class="dashboard-section-header">
            <span class="dashboard-section-title">Timeline</span>
            <div class="dashboard-section-actions">
              ${renderTimelineFilter(timelineFilter, onTimelineFilterChange)}
              <button class="dashboard-btn" @click=${onClearTimeline} title="Clear timeline">
                ${icon("trash")}
              </button>
            </div>
          </div>
          <div class="timeline">
            ${filteredTimeline.length > 0
              ? filteredTimeline.map((event) =>
                  renderTimelineEvent(event, selectedToolCall?.toolCallId ?? null, onSelectToolCall),
                )
              : html`<div class="timeline-empty">No events yet</div>`}
          </div>
        </div>

        <!-- Resource Monitor -->
        <div class="dashboard-section dashboard-section--footer">
          ${renderResourceMonitor(state)}
        </div>
      </div>

      <!-- Detail Panel -->
      ${hasDetailPanel
        ? html`
            <div class="dashboard-panel">
              ${selectedTask
                ? renderTaskDetailPanel(selectedTask, () => onSelectTask(null))
                : nothing}
              ${selectedToolCall
                ? renderToolCallInspector(selectedToolCall, () => onSelectToolCall(null))
                : nothing}
            </div>
          `
        : nothing}
    </div>
  `;
}
