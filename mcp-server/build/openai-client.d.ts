import type { AspectRatio, GenerateImageInput, GenerateImageResult, ImageProviderClient } from "./types.js";
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
