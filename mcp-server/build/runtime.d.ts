import type { GeminiModel, ImageProvider, LogLevel, RuntimeConfig } from "./types.js";
export interface Logger {
    error(message: string, meta?: unknown): void;
    warn(message: string, meta?: unknown): void;
    info(message: string, meta?: unknown): void;
    debug(message: string, meta?: unknown): void;
}
export declare function formatErrorMessage(error: unknown): string;
export declare function parseLogLevel(value?: string): LogLevel;
export declare function parseRequestTimeoutMs(value?: string): number;
export declare function getFallbackImageModels(configuredDefaultModel: GeminiModel): string[];
export declare function resolveDefaultModel(availableModels: string[], configuredDefaultModel: GeminiModel): GeminiModel;
export declare function parseImageProvider(value: string | undefined, geminiApiKey: string, openaiApiKey: string): ImageProvider;
export declare function hasAnyApiKey(config: RuntimeConfig): boolean;
export declare function createRuntimeConfig(env?: NodeJS.ProcessEnv): RuntimeConfig;
export declare function createLogger(component: string, configuredLevel?: string): Logger;
