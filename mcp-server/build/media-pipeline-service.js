import { GeminiImageClient, fetchImageModels } from "./gemini-client.js";
import { OpenAIImageClient, fetchOpenAIImageModels } from "./openai-client.js";
import { ImageStorage } from "./image-storage.js";
import { loadReferenceImages } from "./reference-images.js";
import { pathToFileURL } from "node:url";
import { getApiKeyEnvVarForProvider, getDefaultModelForProvider, resolveProviderForModel, } from "./provider.js";
import { formatErrorMessage, getFallbackImageModels, resolveDefaultModel, } from "./runtime.js";
import { FALLBACK_OPENAI_IMAGE_MODELS } from "./types.js";
export class MediaPipelineService {
    config;
    logger;
    modelCacheTtlMs;
    clients;
    fetchGeminiModels;
    fetchOpenAIModels;
    imageStorage;
    cachedModelContext = null;
    constructor(config, logger, modelCacheTtlMs = 15 * 60 * 1000, overrides) {
        this.config = config;
        this.logger = logger;
        this.modelCacheTtlMs = modelCacheTtlMs;
        const clients = {};
        if (config.geminiApiKey) {
            clients.gemini = new GeminiImageClient({
                apiKey: config.geminiApiKey,
                defaultModel: config.geminiDefaultModel,
                requestTimeoutMs: config.requestTimeoutMs,
            });
        }
        if (config.openaiApiKey) {
            clients.openai = new OpenAIImageClient({
                apiKey: config.openaiApiKey,
                requestTimeoutMs: config.requestTimeoutMs,
            });
        }
        this.clients = { ...clients, ...overrides?.clients };
        this.fetchGeminiModels = overrides?.fetchGeminiModels ?? fetchImageModels;
        this.fetchOpenAIModels =
            overrides?.fetchOpenAIModels ?? fetchOpenAIImageModels;
        this.imageStorage = new ImageStorage(config.outputDirectory);
    }
    getOutputDirectory() {
        return this.imageStorage.getOutputDirectory();
    }
    async discoverGeminiModels() {
        const warnings = [];
        try {
            this.logger.debug("Refreshing image model list from Gemini API");
            const discoveredModels = await this.fetchGeminiModels(this.config.geminiApiKey, this.config.requestTimeoutMs);
            if (discoveredModels.length === 0) {
                warnings.push("Gemini model discovery returned no image-capable models; using fallback defaults.");
                return {
                    models: getFallbackImageModels(this.config.geminiDefaultModel),
                    warnings,
                };
            }
            return { models: discoveredModels, warnings };
        }
        catch (error) {
            const errorMessage = formatErrorMessage(error);
            this.logger.warn("Failed to refresh image model list; using fallback defaults", {
                provider: "gemini",
                error: errorMessage,
            });
            warnings.push("Gemini model discovery failed; using fallback defaults.");
            return {
                models: getFallbackImageModels(this.config.geminiDefaultModel),
                warnings,
            };
        }
    }
    getOpenAIFallbackModels() {
        return [
            ...new Set([
                this.config.openaiDefaultModel,
                ...FALLBACK_OPENAI_IMAGE_MODELS,
            ]),
        ];
    }
    async discoverOpenAIModels() {
        const warnings = [];
        try {
            this.logger.debug("Refreshing image model list from OpenAI API");
            const discoveredModels = await this.fetchOpenAIModels(this.config.openaiApiKey, this.config.requestTimeoutMs);
            if (discoveredModels.length === 0) {
                warnings.push("OpenAI model discovery returned no image-capable models; using fallback defaults.");
                return { models: this.getOpenAIFallbackModels(), warnings };
            }
            return { models: discoveredModels, warnings };
        }
        catch (error) {
            const errorMessage = formatErrorMessage(error);
            this.logger.warn("Failed to refresh image model list; using fallback defaults", {
                provider: "openai",
                error: errorMessage,
            });
            warnings.push("OpenAI model discovery failed; using fallback defaults.");
            return { models: this.getOpenAIFallbackModels(), warnings };
        }
    }
    async getModelContext() {
        const now = Date.now();
        if (this.cachedModelContext && this.cachedModelContext.expiresAt > now) {
            return this.cachedModelContext.value;
        }
        const warnings = [];
        const modelsByProvider = {};
        if (this.config.geminiApiKey) {
            const discovery = await this.discoverGeminiModels();
            modelsByProvider.gemini = discovery.models;
            warnings.push(...discovery.warnings);
        }
        if (this.config.openaiApiKey) {
            const discovery = await this.discoverOpenAIModels();
            modelsByProvider.openai = discovery.models;
            warnings.push(...discovery.warnings);
        }
        const availableModels = [
            ...new Set([
                ...(modelsByProvider.gemini ?? []),
                ...(modelsByProvider.openai ?? []),
            ]),
        ];
        const defaultProvider = this.config.defaultProvider;
        const configuredDefaultModel = getDefaultModelForProvider(this.config, defaultProvider);
        const defaultProviderModels = modelsByProvider[defaultProvider] ?? [];
        const defaultModel = resolveDefaultModel(defaultProviderModels, configuredDefaultModel);
        if (defaultModel !== configuredDefaultModel) {
            warnings.push(`Configured default model \"${configuredDefaultModel}\" is unavailable; using \"${defaultModel}\" instead.`);
        }
        const context = {
            availableModels,
            defaultModel,
            warnings,
        };
        this.cachedModelContext = {
            value: context,
            expiresAt: now + this.modelCacheTtlMs,
        };
        return context;
    }
    async createAsset(request) {
        const startedAt = Date.now();
        const modelContext = await this.getModelContext();
        const warnings = [...modelContext.warnings];
        if (request.model && !modelContext.availableModels.includes(request.model)) {
            return {
                success: false,
                errorCode: "INVALID_MODEL",
                error: `Invalid model: ${request.model}. Available image models: ${modelContext.availableModels.join(", ")}`,
                outputDirectory: this.imageStorage.getOutputDirectory(),
                warnings,
            };
        }
        const selectedModel = request.model || modelContext.defaultModel;
        const provider = resolveProviderForModel(selectedModel);
        const client = this.clients[provider];
        if (!client) {
            return {
                success: false,
                errorCode: "PROVIDER_NOT_CONFIGURED",
                error: `Model ${selectedModel} requires ${provider} but ${getApiKeyEnvVarForProvider(provider)} is not set.`,
                prompt: request.prompt,
                aspectRatio: request.aspectRatio || "1:1",
                model: selectedModel,
                outputDirectory: this.imageStorage.getOutputDirectory(),
                warnings,
            };
        }
        this.logger.info("Generating image", {
            provider,
            model: selectedModel,
            aspectRatio: request.aspectRatio || "1:1",
            hasCustomOutputPath: Boolean(request.outputPath),
        });
        // Load reference images from disk if provided
        let referenceImages;
        if (request.referenceImages && request.referenceImages.length > 0) {
            const loaded = loadReferenceImages(request.referenceImages, this.logger);
            if (!loaded.success) {
                return {
                    success: false,
                    errorCode: loaded.errorCode,
                    error: loaded.error,
                    outputDirectory: this.imageStorage.getOutputDirectory(),
                    warnings,
                };
            }
            referenceImages = loaded.images;
        }
        const generated = await client.generateImage({
            prompt: request.prompt,
            referenceImages,
            aspectRatio: request.aspectRatio,
            model: selectedModel,
            timeoutMs: this.config.requestTimeoutMs,
        });
        if (generated.warnings && generated.warnings.length > 0) {
            warnings.push(...generated.warnings);
        }
        if (!generated.success || !generated.base64Data || !generated.mimeType) {
            if (generated.internalError) {
                this.logger.warn("Image generation failed", {
                    provider,
                    error: generated.internalError,
                    errorCode: generated.errorCode,
                });
            }
            return {
                success: false,
                errorCode: generated.errorCode || "IMAGE_GENERATION_FAILED",
                error: generated.error || "Image generation failed",
                prompt: request.prompt,
                aspectRatio: request.aspectRatio || "1:1",
                model: selectedModel,
                outputDirectory: this.imageStorage.getOutputDirectory(),
                warnings,
            };
        }
        const saved = this.imageStorage.saveImage(generated.base64Data, request.outputPath, generated.mimeType);
        if (!saved.success || !saved.filePath) {
            if (saved.internalError) {
                this.logger.warn("Saving generated image failed", {
                    error: saved.internalError,
                    errorCode: saved.errorCode,
                });
            }
            return {
                success: false,
                errorCode: saved.errorCode || "FILE_SAVE_FAILED",
                error: saved.error || "Failed to save generated image",
                prompt: request.prompt,
                aspectRatio: request.aspectRatio || "1:1",
                model: selectedModel,
                mimeType: generated.mimeType,
                outputDirectory: this.imageStorage.getOutputDirectory(),
                warnings,
            };
        }
        const durationMs = Date.now() - startedAt;
        this.logger.info("Image generated successfully", {
            filePath: saved.filePath,
            provider,
            model: selectedModel,
            durationMs,
        });
        return {
            success: true,
            filePath: saved.filePath,
            resourceUri: pathToFileURL(saved.filePath).href,
            mimeType: generated.mimeType,
            prompt: request.prompt,
            aspectRatio: request.aspectRatio || "1:1",
            model: selectedModel,
            outputDirectory: this.imageStorage.getOutputDirectory(),
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    }
}
