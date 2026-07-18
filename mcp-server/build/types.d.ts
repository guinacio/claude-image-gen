export declare const ASPECT_RATIOS: readonly ["1:1", "2:3", "3:2", "3:4", "4:3", "16:9", "9:16"];
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export declare const FALLBACK_IMAGE_MODELS: readonly ["gemini-3-pro-image-preview", "gemini-2.5-flash-image"];
export declare const DEFAULT_REQUEST_TIMEOUT_MS = 60000;
export declare const DEFAULT_LOG_LEVEL = "info";
export type GeminiModel = string;
export type LogLevel = "error" | "warn" | "info" | "debug";
export interface ReferenceImage {
    filePath: string;
    base64Data: string;
    mimeType: string;
}
export interface GenerateImageInput {
    prompt: string;
    referenceImages?: ReferenceImage[];
    outputPath?: string;
    aspectRatio?: AspectRatio;
    model?: GeminiModel;
    timeoutMs?: number;
}
export interface GenerateImageResult {
    success: boolean;
    base64Data?: string;
    mimeType?: string;
    error?: string;
    errorCode?: string;
}
export interface SavedImageResult {
    success: boolean;
    filePath?: string;
    error?: string;
}
export interface GeminiConfig {
    apiKey: string;
    defaultModel: GeminiModel;
    outputDirectory: string;
    requestTimeoutMs: number;
}
export interface RuntimeConfig {
    apiKey: string;
    defaultModel: GeminiModel;
    outputDirectory: string;
    requestTimeoutMs: number;
    logLevel: LogLevel;
}
export interface CreateAssetRequest {
    prompt: string;
    referenceImages?: string[];
    outputPath?: string;
    aspectRatio?: AspectRatio;
    model?: GeminiModel;
}
export interface CreateAssetResponse {
    success: boolean;
    filePath?: string;
    mimeType?: string;
    prompt?: string;
    aspectRatio?: AspectRatio;
    model?: GeminiModel;
    outputDirectory?: string;
    error?: string;
    errorCode?: string;
    warnings?: string[];
}
