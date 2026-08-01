export const ASPECT_RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "16:9",
  "9:16",
] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const FALLBACK_IMAGE_MODELS = [
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image",
] as const;

export const FALLBACK_OPENAI_IMAGE_MODELS = ["gpt-image-2"] as const;

export type ImageProvider = "gemini" | "openai";

export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
export const DEFAULT_LOG_LEVEL = "info";

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
  internalError?: string;
  warnings?: string[];
}

export interface ImageProviderClient {
  generateImage(input: GenerateImageInput): Promise<GenerateImageResult>;
}

export interface SavedImageResult {
  success: boolean;
  filePath?: string;
  error?: string;
  errorCode?: string;
  internalError?: string;
}

export interface GeminiConfig {
  apiKey: string;
  defaultModel: GeminiModel;
  requestTimeoutMs: number;
}

export interface RuntimeConfig {
  geminiApiKey: string;
  openaiApiKey: string;
  geminiDefaultModel: GeminiModel;
  openaiDefaultModel: string;
  defaultProvider: ImageProvider;
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
  resourceUri?: string;
  mimeType?: string;
  prompt?: string;
  aspectRatio?: AspectRatio;
  model?: GeminiModel;
  outputDirectory?: string;
  error?: string;
  errorCode?: string;
  warnings?: string[];
}
