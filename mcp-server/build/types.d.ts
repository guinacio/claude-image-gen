export declare const ASPECT_RATIOS: readonly ["1:1", "2:3", "3:2", "3:4", "4:3", "16:9", "9:16"];
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export declare const IMAGE_BACKGROUNDS: readonly ["auto", "transparent", "opaque"];
export type ImageBackground = (typeof IMAGE_BACKGROUNDS)[number];
export declare const IMAGE_OUTPUT_FORMATS: readonly ["png", "jpeg", "webp", "gif", "svg"];
export type ImageOutputFormat = (typeof IMAGE_OUTPUT_FORMATS)[number];
/**
 * Formats that can carry an alpha channel, and therefore a transparent
 * background. OpenAI documents transparent backgrounds as needing png or webp,
 * so gif and svg stay out even though both can express transparency.
 */
export declare const ALPHA_CAPABLE_OUTPUT_FORMATS: readonly ImageOutputFormat[];
/** How much planning the model spends on an image, separate from rendering quality. */
export declare const IMAGE_COMPLEXITIES: readonly ["low", "medium", "high"];
export type ImageComplexity = (typeof IMAGE_COMPLEXITIES)[number];
/** Reasoning effort for the model that authors SVG output. Which ones work depends on that model. */
export declare const SVG_REASONING_EFFORTS: readonly ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
export type SvgReasoningEffort = (typeof SVG_REASONING_EFFORTS)[number];
/**
 * Shape advertised on the tool schema. `explainInvalidOpenAISize` is the
 * check the handler actually enforces.
 */
export declare const OPENAI_SIZE_PATTERN: RegExp;
/** Longest edge OpenAI documents for a custom GPT Image size. */
export declare const OPENAI_MAX_EDGE_PX = 3840;
/**
 * Returns a reason to refuse `size` locally, or undefined when it matches the
 * limits OpenAI documents for gpt-image-2 and later: `auto`, or WIDTHxHEIGHT
 * with both sides multiples of 16, neither edge above 3840, and a ratio
 * between 1:3 and 3:1. The GIF sheet budget stays with the API, because it
 * depends on the frame count.
 */
export declare function explainInvalidOpenAISize(size: string): string | undefined;
/** Frame limits for animated GIF output, as documented for the OpenAI Image API. */
export declare const GIF_FRAME_COUNT_RANGE: {
    readonly min: 2;
    readonly max: 16;
};
export declare const GIF_FRAME_DURATION_MS_RANGE: {
    readonly min: 20;
    readonly max: 2000;
};
export declare const FALLBACK_IMAGE_MODELS: readonly ["gemini-3-pro-image", "gemini-3.1-flash-lite-image"];
export declare const FALLBACK_OPENAI_IMAGE_MODELS: readonly ["gpt-image-2"];
export type ImageProvider = "gemini" | "openai";
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
