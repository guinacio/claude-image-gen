import type { ImageProvider, RuntimeConfig } from "./types.js";
export declare function resolveProviderForModel(model: string): ImageProvider;
export declare function getApiKeyForProvider(config: RuntimeConfig, provider: ImageProvider): string;
export declare function getDefaultModelForProvider(config: RuntimeConfig, provider: ImageProvider): string;
export declare function getApiKeyEnvVarForProvider(provider: ImageProvider): string;
