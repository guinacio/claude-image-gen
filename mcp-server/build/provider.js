const OPENAI_MODEL_PREFIXES = ["gpt-image", "dall-e"];
export function resolveProviderForModel(model) {
    const normalized = model.trim().toLowerCase();
    return OPENAI_MODEL_PREFIXES.some((prefix) => normalized.startsWith(prefix))
        ? "openai"
        : "gemini";
}
export function getApiKeyForProvider(config, provider) {
    return provider === "openai" ? config.openaiApiKey : config.geminiApiKey;
}
export function getDefaultModelForProvider(config, provider) {
    return provider === "openai"
        ? config.openaiDefaultModel
        : config.geminiDefaultModel;
}
export function getApiKeyEnvVarForProvider(provider) {
    return provider === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY";
}
