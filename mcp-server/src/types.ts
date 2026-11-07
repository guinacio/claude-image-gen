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

export const IMAGE_BACKGROUNDS = ["auto", "transparent", "opaque"] as const;

export type ImageBackground = (typeof IMAGE_BACKGROUNDS)[number];

export const IMAGE_OUTPUT_FORMATS = ["png", "jpeg", "webp", "gif", "svg"] as const;

export type ImageOutputFormat = (typeof IMAGE_OUTPUT_FORMATS)[number];

/**
 * Formats that can carry an alpha channel, and therefore a transparent
 * background. OpenAI documents transparent backgrounds as needing png or webp,
 * so gif and svg stay out even though both can express transparency.
 */
export const ALPHA_CAPABLE_OUTPUT_FORMATS: readonly ImageOutputFormat[] = [
  "png",
  "webp",
];

/** How much planning the model spends on an image, separate from rendering quality. */
export const IMAGE_COMPLEXITIES = ["low", "medium", "high"] as const;

export type ImageComplexity = (typeof IMAGE_COMPLEXITIES)[number];

/** Reasoning effort for the model that authors SVG output. Which ones work depends on that model. */
export const SVG_REASONING_EFFORTS = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export type SvgReasoningEffort = (typeof SVG_REASONING_EFFORTS)[number];

/** "auto" or WIDTHxHEIGHT; the API checks the model-specific limits. */
export const OPENAI_SIZE_PATTERN = /^(auto|[1-9]\d{1,4}x[1-9]\d{1,4})$/;

/** Frame limits for animated GIF output, as documented for the OpenAI Image API. */
export const GIF_FRAME_COUNT_RANGE = { min: 2, max: 16 } as const;
export const GIF_FRAME_DURATION_MS_RANGE = { min: 20, max: 2000 } as const;

// Used only when Gemini model discovery fails. These are current GA image
// models: gemini-3-pro-image-preview shut down on 2026-06-25, and
// gemini-2.5-flash-image is scheduled to shut down on 2027-03-15.
// https://ai.google.dev/gemini-api/docs/deprecations
export const FALLBACK_IMAGE_MODELS = [
  "gemini-3-pro-image",
  "gemini-3.1-flash-lite-image",
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
  /** Alpha mask marking the region to repaint. Only meaningful alongside referenceImages. */
  mask?: ReferenceImage;
  aspectRatio?: AspectRatio;
  background?: ImageBackground;
  outputFormat?: ImageOutputFormat;
  complexity?: ImageComplexity;
  /** Number of frames in an animated GIF. Only valid with outputFormat "gif". */
  frameCount?: number;
  /** Delay per animated GIF frame, in milliseconds. Only valid with outputFormat "gif". */
  frameDurationMs?: number;
  /** Model that authors the SVG from the image model's reference. Only valid with outputFormat "svg". */
  svgModel?: string;
  /** Reasoning effort for svgModel. Requires svgModel. */
  svgReasoningEffort?: SvgReasoningEffort;
  /** Exact OpenAI size ("auto" or WIDTHxHEIGHT). Overrides the aspectRatio mapping. */
  size?: string;
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
  mask?: string;
  outputPath?: string;
  aspectRatio?: AspectRatio;
  background?: ImageBackground;
  outputFormat?: ImageOutputFormat;
  complexity?: ImageComplexity;
  frameCount?: number;
  frameDurationMs?: number;
  svgModel?: string;
  svgReasoningEffort?: SvgReasoningEffort;
  size?: string;
  model?: GeminiModel;
}

export interface CreateAssetResponse {
  success: boolean;
  filePath?: string;
  resourceUri?: string;
  mimeType?: string;
  prompt?: string;
  aspectRatio?: AspectRatio;
  /** Set instead of aspectRatio when the request named an exact size. */
  size?: string;
  model?: GeminiModel;
  outputDirectory?: string;
  error?: string;
  errorCode?: string;
  warnings?: string[];
}
