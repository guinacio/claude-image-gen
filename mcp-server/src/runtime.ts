import os from "node:os";
import path from "node:path";
import {
  DEFAULT_LOG_LEVEL,
  DEFAULT_REQUEST_TIMEOUT_MS,
  FALLBACK_IMAGE_MODELS,
} from "./types.js";
import type { GeminiModel, LogLevel, RuntimeConfig } from "./types.js";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export interface Logger {
  error(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function parseLogLevel(value?: string): LogLevel {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === "error" ||
    normalized === "warn" ||
    normalized === "info" ||
    normalized === "debug"
  ) {
    return normalized;
  }

  return DEFAULT_LOG_LEVEL;
}

export function parseRequestTimeoutMs(value?: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  return Math.floor(parsed);
}

function resolveOutputDirectory(value?: string): string {
  const homeDirectory = os.homedir();
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return path.join(homeDirectory, "generated-images");
  }

  const expandedValue = trimmedValue
    .replace(/\$\{HOME\}/g, homeDirectory)
    .replace(/\$HOME/g, homeDirectory)
    .replace(/\$\{USERPROFILE\}/g, homeDirectory)
    .replace(/%USERPROFILE%/g, homeDirectory)
    .replace(/^~(?=[\\/]|$)/, homeDirectory);

  if (expandedValue.includes("${")) {
    return path.join(homeDirectory, "generated-images");
  }

  return path.isAbsolute(expandedValue)
    ? expandedValue
    : path.resolve(expandedValue);
}

export function getFallbackImageModels(
  configuredDefaultModel: GeminiModel
): string[] {
  return [...new Set([configuredDefaultModel, ...FALLBACK_IMAGE_MODELS])];
}

export function resolveDefaultModel(
  availableModels: string[],
  configuredDefaultModel: GeminiModel
): GeminiModel {
  if (availableModels.includes(configuredDefaultModel)) {
    return configuredDefaultModel;
  }

  return availableModels[0] || configuredDefaultModel;
}

export function createRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): RuntimeConfig {
  return {
    apiKey: env.GEMINI_API_KEY?.trim() ?? "",
    defaultModel: env.GEMINI_DEFAULT_MODEL?.trim() || FALLBACK_IMAGE_MODELS[0],
    outputDirectory: resolveOutputDirectory(env.IMAGE_OUTPUT_DIR),
    requestTimeoutMs: parseRequestTimeoutMs(env.GEMINI_REQUEST_TIMEOUT_MS),
    logLevel: parseLogLevel(env.MEDIA_PIPELINE_LOG_LEVEL),
  };
}

function serializeMeta(meta?: unknown): string {
  if (meta === undefined) {
    return "";
  }

  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return " [meta-unserializable]";
  }
}

export function createLogger(component: string, configuredLevel?: string): Logger {
  const level = parseLogLevel(configuredLevel);

  function emit(targetLevel: LogLevel, message: string, meta?: unknown): void {
    if (LOG_LEVEL_PRIORITY[targetLevel] > LOG_LEVEL_PRIORITY[level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    console.error(
      `[${timestamp}] [media-pipeline] [${component}] [${targetLevel}] ${message}${serializeMeta(meta)}`
    );
  }

  return {
    error(message, meta) {
      emit("error", message, meta);
    },
    warn(message, meta) {
      emit("warn", message, meta);
    },
    info(message, meta) {
      emit("info", message, meta);
    },
    debug(message, meta) {
      emit("debug", message, meta);
    },
  };
}
