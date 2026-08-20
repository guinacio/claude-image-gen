import type { Logger } from "./runtime.js";
import type { CreateAssetRequest, CreateAssetResponse, ImageProvider, ImageProviderClient, RuntimeConfig } from "./types.js";
interface ModelContext {
    availableModels: string[];
    defaultModel: string;
    warnings: string[];
}
type ModelFetcher = (apiKey: string, timeoutMs?: number) => Promise<string[]>;
export interface MediaPipelineServiceOverrides {
    clients?: Partial<Record<ImageProvider, ImageProviderClient>>;
    fetchGeminiModels?: ModelFetcher;
    fetchOpenAIModels?: ModelFetcher;
    fetchAtlasModels?: ModelFetcher;
}
export declare class MediaPipelineService {
    private readonly config;
    private readonly logger;
    private readonly modelCacheTtlMs;
    private readonly clients;
    private readonly fetchGeminiModels;
    private readonly fetchOpenAIModels;
    private readonly fetchAtlasModels;
    private readonly imageStorage;
    private cachedModelContext;
    constructor(config: RuntimeConfig, logger: Logger, modelCacheTtlMs?: number, overrides?: MediaPipelineServiceOverrides);
    getOutputDirectory(): string;
    private discoverGeminiModels;
    private getOpenAIFallbackModels;
    private discoverOpenAIModels;
    private getAtlasFallbackModels;
    private discoverAtlasModels;
    getModelContext(): Promise<ModelContext>;
    createAsset(request: CreateAssetRequest): Promise<CreateAssetResponse>;
}
export {};
