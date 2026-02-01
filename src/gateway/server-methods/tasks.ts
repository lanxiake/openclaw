/**
 * Task RPC methods.
 */
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateTaskCreateParams,
  validateTaskUpdateParams,
  validateTaskDeleteParams,
  validateTaskGetParams,
  validateTaskListParams,
} from "../protocol/index.js";
import {
  createTask,
  updateTask,
  deleteTask,
  getTask,
  listTasks,
  getTaskStats,
} from "../task-storage.js";
import type { GatewayRequestHandlers } from "./types.js";

export const taskHandlers: GatewayRequestHandlers = {
  /**
   * Create a new task.
   */
  "task.create": async ({ respond, params }) => {
    if (!validateTaskCreateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          formatValidationErrors(validateTaskCreateParams.errors),
        ),
      );
      return;
    }

    try {
      const task = createTask(params);
      respond(true, { task });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Update an existing task.
   */
  "task.update": async ({ respond, params }) => {
    if (!validateTaskUpdateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          formatValidationErrors(validateTaskUpdateParams.errors),
        ),
      );
      return;
    }

    try {
      const task = updateTask(params);
      if (!task) {
        respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Task not found: ${params.id}`));
        return;
      }
      respond(true, { task });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Delete a task.
   */
  "task.delete": async ({ respond, params }) => {
    if (!validateTaskDeleteParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          formatValidationErrors(validateTaskDeleteParams.errors),
        ),
      );
      return;
    }

    try {
      const deleted = deleteTask(params.id);
      if (!deleted) {
        respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Task not found: ${params.id}`));
        return;
      }
      respond(true, { deleted: true });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Get a task by ID.
   */
  "task.get": async ({ respond, params }) => {
    if (!validateTaskGetParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          formatValidationErrors(validateTaskGetParams.errors),
        ),
      );
      return;
    }

    try {
      const task = getTask(params.id);
      if (!task) {
        respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Task not found: ${params.id}`));
        return;
      }
      respond(true, { task });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * List tasks with filtering and pagination.
   */
  "task.list": async ({ respond, params }) => {
    if (params && !validateTaskListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          formatValidationErrors(validateTaskListParams.errors),
        ),
      );
      return;
    }

    try {
      const result = listTasks(params ?? {});
      respond(true, result);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  /**
   * Get task statistics.
   */
  "task.stats": async ({ respond }) => {
    try {
      const stats = getTaskStats();
      respond(true, stats);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
