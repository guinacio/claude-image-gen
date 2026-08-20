const OPENAI_MODEL_PREFIXES = ["gpt-image", "dall-e"];
export function resolveProviderForModel(model) {
    const normalized = model.trim().toLowerCase();
    if (OPENAI_MODEL_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
        return "openai";
    }
    return normalized.includes("/") ? "atlas" : "gemini";
}
export function getApiKeyForProvider(config, provider) {
    if (provider === "openai")
        return config.openaiApiKey;
    if (provider === "atlas")
        return config.atlasApiKey;
    return config.geminiApiKey;
}
export function getDefaultModelForProvider(config, provider) {
    if (provider === "openai")
        return config.openaiDefaultModel;
    if (provider === "atlas")
        return config.atlasDefaultModel;
    return config.geminiDefaultModel;
}
export function getApiKeyEnvVarForProvider(provider) {
    if (provider === "openai")
        return "OPENAI_API_KEY";
    if (provider === "atlas")
        return "ATLASCLOUD_API_KEY";
    return "GEMINI_API_KEY";
}
