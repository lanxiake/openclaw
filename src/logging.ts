import {
  enableConsoleCapture,
  getConsoleSettings,
  getResolvedConsoleSettings,
  routeLogsToStderr,
  setConsoleSubsystemFilter,
  setConsoleTimestampPrefix,
  shouldLogSubsystemToConsole,
} from "./shared/logging/console.js";
import type { ConsoleLoggerSettings, ConsoleStyle } from "./shared/logging/console.js";
import { ALLOWED_LOG_LEVELS, levelToMinLevel, normalizeLogLevel } from "./shared/logging/levels.js";
import type { LogLevel } from "./shared/logging/levels.js";
import {
  DEFAULT_LOG_DIR,
  DEFAULT_LOG_FILE,
  getChildLogger,
  getLogger,
  getResolvedLoggerSettings,
  isFileLogLevelEnabled,
  resetLogger,
  setLoggerOverride,
  toPinoLikeLogger,
} from "./shared/logging/logger.js";
import type {
  LoggerResolvedSettings,
  LoggerSettings,
  PinoLikeLogger,
} from "./shared/logging/logger.js";
import {
  createSubsystemLogger,
  createSubsystemRuntime,
  runtimeForLogger,
  stripRedundantSubsystemPrefixForConsole,
} from "./shared/logging/subsystem.js";
import type { SubsystemLogger } from "./shared/logging/subsystem.js";

export {
  enableConsoleCapture,
  getConsoleSettings,
  getResolvedConsoleSettings,
  routeLogsToStderr,
  setConsoleSubsystemFilter,
  setConsoleTimestampPrefix,
  shouldLogSubsystemToConsole,
  ALLOWED_LOG_LEVELS,
  levelToMinLevel,
  normalizeLogLevel,
  DEFAULT_LOG_DIR,
  DEFAULT_LOG_FILE,
  getChildLogger,
  getLogger,
  getResolvedLoggerSettings,
  isFileLogLevelEnabled,
  resetLogger,
  setLoggerOverride,
  toPinoLikeLogger,
  createSubsystemLogger,
  createSubsystemRuntime,
  runtimeForLogger,
  stripRedundantSubsystemPrefixForConsole,
};

export type {
  ConsoleLoggerSettings,
  ConsoleStyle,
  LogLevel,
  LoggerResolvedSettings,
  LoggerSettings,
  PinoLikeLogger,
  SubsystemLogger,
};
