import type { GenerateImageInput, GenerateImageResult, GeminiConfig } from "./types.js";
/**
 * Fetches all image-capable Gemini models from the API.
 * The SDK returns a pager, so we iterate the full result set instead of
 * relying on the first page only.
 */
export declare function fetchImageModels(apiKey: string, timeoutMs?: number): Promise<string[]>;
export declare class GeminiImageClient {
    private ai;
    private config;
    constructor(config: GeminiConfig);
    generateImage(input: GenerateImageInput): Promise<GenerateImageResult>;
}
