import type { AspectRatio, GenerateImageInput, GenerateImageResult, ImageBackground, ImageOutputFormat, ImageProviderClient, SvgReasoningEffort } from "./types.js";
export type OpenAIImageSize = "1024x1024" | "1536x1024" | "1024x1536";
export interface OpenAIConfig {
    apiKey: string;
    requestTimeoutMs: number;
}
/**
 * Maps a requested aspect ratio onto the closest size supported by OpenAI image
 * models. When the mapping is inexact a warning describing the substitution is
 * returned alongside the size.
 */
export declare function mapAspectRatioToOpenAISize(aspectRatio: AspectRatio | undefined): {
    size: OpenAIImageSize;
    warning?: string;
};
export interface ResolvedOutputOptions {
    background?: ImageBackground;
    outputFormat?: ImageOutputFormat;
    error?: string;
}
/**
 * Reconciles the requested background with the requested output format.
 *
 * A transparent background needs an alpha channel, which JPEG cannot carry. An
 * explicit JPEG request is a contradiction and is rejected rather than silently
 * flattened; when no format was requested at all, PNG is selected so that
 * asking for transparency is enough to actually get it.
 */
export declare function resolveOutputOptions(background: ImageBackground | undefined, outputFormat: ImageOutputFormat | undefined): ResolvedOutputOptions;
/**
 * Rejects option combinations that the OpenAI Image API documents as invalid,
 * so they fail locally with a clear reason instead of as an API error:
 * - frameCount and frameDurationMs only exist for GIF output;
 * - SVG output is generation-only (the edit endpoint has no SVG format), and
 *   referenceImages always go to the edit endpoint;
 * - GIF output does not support masks;
 * - svgModel and svgReasoningEffort only exist for SVG output, and the API's
 *   svg object requires a model, so an effort alone has nowhere to go.
 * Returns undefined when the combination is valid.
 */
export declare function checkFormatSpecificOptions(input: {
    outputFormat?: ImageOutputFormat;
    frameCount?: number;
    frameDurationMs?: number;
    svgModel?: string;
    svgReasoningEffort?: SvgReasoningEffort;
    hasReferenceImages: boolean;
    hasMask: boolean;
}): string | undefined;
export interface ObservedRejection {
    /** Model ids this rejection was actually observed on. */
    models: RegExp;
    /** The option, written the way a caller passes it. */
    option: string;
    /** What the API answered, verbatim, when this was observed. */
    apiMessage: string;
}
/**
 * Returns the recorded rejection for a model/option pair, when there is one.
 * A miss means "not known to fail", never "known to work".
 */
export declare function findObservedRejection(model: string | undefined, options: {
    background?: ImageBackground;
}): ObservedRejection | undefined;
/**
 * Turns a thrown request failure into a caller-facing message.
 *
 * Client-side (4xx) failures describe what was wrong with the caller's own
 * request -- which option a model refused, and why -- so that text is passed
 * through. Server-side and transport failures stay generic, because their
 * wording describes infrastructure rather than anything the caller can act on.
 */
export declare function describeOpenAIFailure(error: unknown): {
    error: string;
    internalError: string;
};
/**
 * Fetches the image-capable model ids exposed by the OpenAI API.
 * Throws on failure so callers can decide how to fall back.
 */
export declare function fetchOpenAIImageModels(apiKey: string, timeoutMs?: number): Promise<string[]>;
export declare class OpenAIImageClient implements ImageProviderClient {
    private readonly client;
    private readonly config;
    constructor(config: OpenAIConfig);
    generateImage(input: GenerateImageInput): Promise<GenerateImageResult>;
}
