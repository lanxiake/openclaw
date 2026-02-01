import { type Static, Type } from "@sinclair/typebox";

import { NonEmptyString } from "./primitives.js";

// Task status enum
export const TaskStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("active"),
  Type.Literal("completed"),
  Type.Literal("failed"),
  Type.Literal("cancelled"),
]);
export type TaskStatus = Static<typeof TaskStatusSchema>;

// Task priority enum
export const TaskPrioritySchema = Type.Union([
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
]);
export type TaskPriority = Static<typeof TaskPrioritySchema>;

// Task change event type
export const TaskChangeTypeSchema = Type.Union([
  Type.Literal("created"),
  Type.Literal("updated"),
  Type.Literal("deleted"),
]);
export type TaskChangeType = Static<typeof TaskChangeTypeSchema>;

// Core Task schema
export const TaskSchema = Type.Object(
  {
    id: NonEmptyString,
    title: NonEmptyString,
    description: Type.Optional(Type.String()),
    status: TaskStatusSchema,
    priority: Type.Optional(TaskPrioritySchema),
    progress: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
    runId: Type.Optional(NonEmptyString),
    sessionKey: Type.Optional(NonEmptyString),
    parentId: Type.Optional(NonEmptyString),
    tags: Type.Optional(Type.Array(NonEmptyString)),
    metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    createdAt: Type.Number(),
    updatedAt: Type.Number(),
    completedAt: Type.Optional(Type.Number()),
  },
  { additionalProperties: false },
);
export type Task = Static<typeof TaskSchema>;

// Create task params
export const TaskCreateParamsSchema = Type.Object(
  {
    title: NonEmptyString,
    description: Type.Optional(Type.String()),
    status: Type.Optional(TaskStatusSchema),
    priority: Type.Optional(TaskPrioritySchema),
    progress: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
    runId: Type.Optional(NonEmptyString),
    sessionKey: Type.Optional(NonEmptyString),
    parentId: Type.Optional(NonEmptyString),
    tags: Type.Optional(Type.Array(NonEmptyString)),
    metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false },
);
export type TaskCreateParams = Static<typeof TaskCreateParamsSchema>;

// Update task params
export const TaskUpdateParamsSchema = Type.Object(
  {
    id: NonEmptyString,
    title: Type.Optional(NonEmptyString),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    status: Type.Optional(TaskStatusSchema),
    priority: Type.Optional(Type.Union([TaskPrioritySchema, Type.Null()])),
    progress: Type.Optional(
      Type.Union([Type.Number({ minimum: 0, maximum: 100 }), Type.Null()]),
    ),
    runId: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
    sessionKey: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
    parentId: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
    tags: Type.Optional(Type.Union([Type.Array(NonEmptyString), Type.Null()])),
    metadata: Type.Optional(
      Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()]),
    ),
  },
  { additionalProperties: false },
);
export type TaskUpdateParams = Static<typeof TaskUpdateParamsSchema>;

// Delete task params
export const TaskDeleteParamsSchema = Type.Object(
  {
    id: NonEmptyString,
  },
  { additionalProperties: false },
);
export type TaskDeleteParams = Static<typeof TaskDeleteParamsSchema>;

// Get task params
export const TaskGetParamsSchema = Type.Object(
  {
    id: NonEmptyString,
  },
  { additionalProperties: false },
);
export type TaskGetParams = Static<typeof TaskGetParamsSchema>;

// List tasks params
export const TaskListParamsSchema = Type.Object(
  {
    status: Type.Optional(TaskStatusSchema),
    priority: Type.Optional(TaskPrioritySchema),
    runId: Type.Optional(NonEmptyString),
    sessionKey: Type.Optional(NonEmptyString),
    parentId: Type.Optional(NonEmptyString),
    tags: Type.Optional(Type.Array(NonEmptyString)),
    search: Type.Optional(Type.String()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
    offset: Type.Optional(Type.Integer({ minimum: 0 })),
    sortBy: Type.Optional(
      Type.Union([
        Type.Literal("createdAt"),
        Type.Literal("updatedAt"),
        Type.Literal("priority"),
        Type.Literal("status"),
      ]),
    ),
    sortOrder: Type.Optional(
      Type.Union([Type.Literal("asc"), Type.Literal("desc")]),
    ),
  },
  { additionalProperties: false },
);
export type TaskListParams = Static<typeof TaskListParamsSchema>;

// List tasks result
export const TaskListResultSchema = Type.Object(
  {
    tasks: Type.Array(TaskSchema),
    total: Type.Integer({ minimum: 0 }),
    hasMore: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type TaskListResult = Static<typeof TaskListResultSchema>;

// Task stats result
export const TaskStatsResultSchema = Type.Object(
  {
    total: Type.Integer({ minimum: 0 }),
    byStatus: Type.Object({
      pending: Type.Integer({ minimum: 0 }),
      active: Type.Integer({ minimum: 0 }),
      completed: Type.Integer({ minimum: 0 }),
      failed: Type.Integer({ minimum: 0 }),
      cancelled: Type.Integer({ minimum: 0 }),
    }),
    byPriority: Type.Object({
      low: Type.Integer({ minimum: 0 }),
      medium: Type.Integer({ minimum: 0 }),
      high: Type.Integer({ minimum: 0 }),
      unset: Type.Integer({ minimum: 0 }),
    }),
  },
  { additionalProperties: false },
);
export type TaskStatsResult = Static<typeof TaskStatsResultSchema>;

// Task change event for WebSocket
export const TaskChangeEventSchema = Type.Object(
  {
    type: TaskChangeTypeSchema,
    task: Type.Optional(TaskSchema),
    taskId: NonEmptyString,
    timestamp: Type.Number(),
  },
  { additionalProperties: false },
);
export type TaskChangeEvent = Static<typeof TaskChangeEventSchema>;
