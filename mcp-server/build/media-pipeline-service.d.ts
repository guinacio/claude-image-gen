import type { Logger } from "./runtime.js";
import type { CreateAssetRequest, CreateAssetResponse, RuntimeConfig } from "./types.js";
interface ModelContext {
    availableModels: string[];
    defaultModel: string;
    warnings: string[];
}
export declare class MediaPipelineService {
    private readonly config;
    private readonly logger;
    private readonly modelCacheTtlMs;
    private readonly geminiClient;
    private readonly imageStorage;
    private cachedModelContext;
    constructor(config: RuntimeConfig, logger: Logger, modelCacheTtlMs?: number);
    getOutputDirectory(): string;
    getModelContext(): Promise<ModelContext>;
    createAsset(request: CreateAssetRequest): Promise<CreateAssetResponse>;
}
export {};
