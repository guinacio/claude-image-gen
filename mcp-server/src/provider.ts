import type { ImageProvider, RuntimeConfig } from "./types.js";

const OPENAI_MODEL_PREFIXES = ["gpt-image", "dall-e"] as const;

export function resolveProviderForModel(model: string): ImageProvider {
  const normalized = model.trim().toLowerCase();
  return OPENAI_MODEL_PREFIXES.some((prefix) => normalized.startsWith(prefix))
    ? "openai"
    : "gemini";
}

export function getApiKeyForProvider(
  config: RuntimeConfig,
  provider: ImageProvider
): string {
  return provider === "openai" ? config.openaiApiKey : config.geminiApiKey;
}

export function getDefaultModelForProvider(
  config: RuntimeConfig,
  provider: ImageProvider
): string {
  return provider === "openai"
    ? config.openaiDefaultModel
    : config.geminiDefaultModel;
}

export function getApiKeyEnvVarForProvider(provider: ImageProvider): string {
  return provider === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY";
}
