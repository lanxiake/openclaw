/**
 * Dashboard RPC methods.
 */
import { ErrorCodes, errorShape } from "../protocol/index.js";
import {
  queryDashboardEvents,
  getRecentEvents,
  getRunEvents,
  getStorageStats,
  type DashboardQueryOptions,
} from "../dashboard-storage.js";
import type { GatewayRequestHandlers } from "./types.js";

export const dashboardHandlers: GatewayRequestHandlers = {
  /**
   * Query dashboard events.
   */
  "dashboard.events": async ({ respond, params }) => {
    try {
      const result = queryDashboardEvents(params as DashboardQueryOptions);
      respond(true, result);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Get recent dashboard events.
   */
  "dashboard.recent": async ({ respond, params }) => {
    try {
      const limit = typeof params?.limit === "number" ? params.limit : undefined;
      const events = getRecentEvents(limit);
      respond(true, { events });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Get events for a specific run.
   */
  "dashboard.run": async ({ respond, params }) => {
    const runId = params?.runId;
    if (typeof runId !== "string" || !runId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "runId is required"));
      return;
    }
    try {
      const events = getRunEvents(runId);
      respond(true, { events });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Get storage statistics.
   */
  "dashboard.stats": async ({ respond }) => {
    try {
      const stats = getStorageStats();
      respond(true, stats);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
