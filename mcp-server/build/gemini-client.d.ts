import type { GenerateImageInput, GenerateImageResult, GeminiConfig } from "./types.js";
export declare class GeminiImageClient {
    private ai;
    private config;
    constructor(config: GeminiConfig);
    generateImage(input: GenerateImageInput): Promise<GenerateImageResult>;
}
