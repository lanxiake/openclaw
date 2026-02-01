/**
 * Dashboard storage module - Persists dashboard events to disk.
 *
 * This module provides:
 * - Event storage in JSONL format
 * - Event retrieval with pagination
 * - Automatic cleanup of old events
 */
import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync, readdirSync, unlinkSync, statSync } from "node:fs";
import { join } from "node:path";
import { resolveStateDir } from "../config/paths.js";

/**
 * Dashboard event types.
 */
export type DashboardEventType = "lifecycle" | "tool" | "assistant" | "compaction" | "task";

/**
 * Dashboard event.
 */
export type DashboardEvent = {
  id: string;
  ts: number;
  runId: string;
  sessionKey?: string;
  stream: DashboardEventType;
  phase?: string;
  data: Record<string, unknown>;
};

/**
 * Task event data.
 */
export type TaskEventData = {
  taskId: string;
  action: "created" | "started" | "progress" | "completed" | "failed";
  name: string;
  description?: string;
  status: "pending" | "active" | "completed" | "failed";
  progress?: number;
  error?: string;
};

/**
 * Dashboard storage configuration.
 */
export type DashboardStorageConfig = {
  /** Maximum events per file */
  maxEventsPerFile: number;
  /** Maximum age of events in milliseconds (default: 24 hours) */
  maxEventAge: number;
  /** Storage directory */
  storageDir: string;
};

const DEFAULT_CONFIG: DashboardStorageConfig = {
  maxEventsPerFile: 10000,
  maxEventAge: 24 * 60 * 60 * 1000, // 24 hours
  storageDir: join(resolveStateDir(), "dashboard"),
};

let config = { ...DEFAULT_CONFIG };
let eventIdCounter = 0;

/**
 * Initialize dashboard storage.
 */
export function initDashboardStorage(customConfig?: Partial<DashboardStorageConfig>): void {
  config = { ...DEFAULT_CONFIG, ...customConfig };

  // Ensure storage directory exists
  if (!existsSync(config.storageDir)) {
    mkdirSync(config.storageDir, { recursive: true });
  }

  // Clean up old events on startup
  cleanupOldEvents();
}

/**
 * Generate unique event ID.
 */
function generateEventId(): string {
  eventIdCounter++;
  return `evt-${Date.now()}-${eventIdCounter}`;
}

/**
 * Get current event file path.
 */
function getCurrentEventFile(): string {
  const date = new Date().toISOString().split("T")[0];
  return join(config.storageDir, `dashboard-${date}.jsonl`);
}

/**
 * Store a dashboard event.
 */
export function storeDashboardEvent(event: Omit<DashboardEvent, "id">): DashboardEvent {
  const fullEvent: DashboardEvent = {
    id: generateEventId(),
    ...event,
  };

  const filePath = getCurrentEventFile();
  const line = JSON.stringify(fullEvent) + "\n";

  try {
    appendFileSync(filePath, line, "utf-8");
  } catch (err) {
    console.error("[dashboard-storage] Failed to store event:", err);
  }

  return fullEvent;
}

/**
 * Store a task event.
 */
export function storeTaskEvent(
  runId: string,
  sessionKey: string | undefined,
  taskData: TaskEventData,
): DashboardEvent {
  return storeDashboardEvent({
    ts: Date.now(),
    runId,
    sessionKey,
    stream: "task",
    phase: taskData.action,
    data: taskData,
  });
}

/**
 * Query options for retrieving events.
 */
export type DashboardQueryOptions = {
  /** Filter by run ID */
  runId?: string;
  /** Filter by session key */
  sessionKey?: string;
  /** Filter by stream type */
  stream?: DashboardEventType;
  /** Start timestamp (inclusive) */
  startTs?: number;
  /** End timestamp (inclusive) */
  endTs?: number;
  /** Maximum number of events to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
};

/**
 * Query result.
 */
export type DashboardQueryResult = {
  events: DashboardEvent[];
  total: number;
  hasMore: boolean;
};

/**
 * Query dashboard events.
 */
export function queryDashboardEvents(options: DashboardQueryOptions = {}): DashboardQueryResult {
  const { runId, sessionKey, stream, startTs, endTs, limit = 100, offset = 0 } = options;

  const allEvents: DashboardEvent[] = [];

  // Read all event files
  try {
    const files = readdirSync(config.storageDir)
      .filter((f) => f.startsWith("dashboard-") && f.endsWith(".jsonl"))
      .sort()
      .reverse(); // Newest first

    for (const file of files) {
      const filePath = join(config.storageDir, file);
      const content = readFileSync(filePath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const event = JSON.parse(line) as DashboardEvent;

          // Apply filters
          if (runId && event.runId !== runId) continue;
          if (sessionKey && event.sessionKey !== sessionKey) continue;
          if (stream && event.stream !== stream) continue;
          if (startTs && event.ts < startTs) continue;
          if (endTs && event.ts > endTs) continue;

          allEvents.push(event);
        } catch {
          // Skip invalid lines
        }
      }
    }
  } catch (err) {
    console.error("[dashboard-storage] Failed to query events:", err);
  }

  // Sort by timestamp descending (newest first)
  allEvents.sort((a, b) => b.ts - a.ts);

  const total = allEvents.length;
  const events = allEvents.slice(offset, offset + limit);
  const hasMore = offset + events.length < total;

  return { events, total, hasMore };
}

/**
 * Get events for a specific run.
 */
export function getRunEvents(runId: string): DashboardEvent[] {
  return queryDashboardEvents({ runId, limit: 1000 }).events;
}

/**
 * Get recent events.
 */
export function getRecentEvents(limit = 100): DashboardEvent[] {
  return queryDashboardEvents({ limit }).events;
}

/**
 * Clean up old event files.
 */
export function cleanupOldEvents(): void {
  try {
    const files = readdirSync(config.storageDir).filter(
      (f) => f.startsWith("dashboard-") && f.endsWith(".jsonl"),
    );

    const now = Date.now();

    for (const file of files) {
      const filePath = join(config.storageDir, file);
      const stat = statSync(filePath);
      const age = now - stat.mtimeMs;

      if (age > config.maxEventAge) {
        unlinkSync(filePath);
        console.log(`[dashboard-storage] Cleaned up old file: ${file}`);
      }
    }
  } catch (err) {
    console.error("[dashboard-storage] Failed to cleanup old events:", err);
  }
}

/**
 * Get storage statistics.
 */
export function getStorageStats(): {
  fileCount: number;
  totalEvents: number;
  oldestEvent: number | null;
  newestEvent: number | null;
} {
  let fileCount = 0;
  let totalEvents = 0;
  let oldestEvent: number | null = null;
  let newestEvent: number | null = null;

  try {
    const files = readdirSync(config.storageDir).filter(
      (f) => f.startsWith("dashboard-") && f.endsWith(".jsonl"),
    );

    fileCount = files.length;

    for (const file of files) {
      const filePath = join(config.storageDir, file);
      const content = readFileSync(filePath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);

      totalEvents += lines.length;

      for (const line of lines) {
        try {
          const event = JSON.parse(line) as DashboardEvent;
          if (oldestEvent === null || event.ts < oldestEvent) {
            oldestEvent = event.ts;
          }
          if (newestEvent === null || event.ts > newestEvent) {
            newestEvent = event.ts;
          }
        } catch {
          // Skip invalid lines
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return { fileCount, totalEvents, oldestEvent, newestEvent };
}
