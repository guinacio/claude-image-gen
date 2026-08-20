import type { GenerateImageInput, GenerateImageResult, ImageProviderClient } from "./types.js";
type FetchLike = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;
export interface AtlasConfig {
    apiKey: string;
    defaultModel: string;
    requestTimeoutMs: number;
}
export interface AtlasClientOptions {
    fetch?: FetchLike;
    sleep?: Sleep;
    apiBase?: string;
}
/** Fetches the current Atlas Cloud text-to-image model catalog. */
export declare function fetchAtlasImageModels(_apiKey: string, timeoutMs?: number, fetchImpl?: FetchLike): Promise<string[]>;
export declare class AtlasImageClient implements ImageProviderClient {
    private readonly config;
    private readonly fetchImpl;
    private readonly sleep;
    private readonly apiBase;
    constructor(config: AtlasConfig, options?: AtlasClientOptions);
    generateImage(input: GenerateImageInput): Promise<GenerateImageResult>;
    private fetchPrediction;
}
export {};
