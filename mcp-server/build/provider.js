const OPENAI_MODEL_PREFIXES = ["gpt-image"];
/**
 * DALL·E snapshots shut down on 2026-05-12. They stay out of the prefix list
 * so a retired name cannot be sent to OpenAI or misread as a Gemini model
 * choice. Callers refuse them with `retiredOpenAIModelError` first.
 */
const RETIRED_OPENAI_MODEL_PREFIXES = ["dall-e"];
export function retiredOpenAIModelError(model) {
    const normalized = model.trim().toLowerCase();
    if (!RETIRED_OPENAI_MODEL_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
        return undefined;
    }
    return `Model ${model.trim()} was shut down by OpenAI on 2026-05-12. Use a gpt-image model such as gpt-image-2.`;
}
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
