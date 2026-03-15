import { GeminiImageClient, fetchImageModels } from "./gemini-client.js";
import { ImageStorage } from "./image-storage.js";
import { pathToFileURL } from "node:url";
import { formatErrorMessage, getFallbackImageModels, resolveDefaultModel, } from "./runtime.js";
export class MediaPipelineService {
    config;
    logger;
    modelCacheTtlMs;
    geminiClient;
    imageStorage;
    cachedModelContext = null;
    constructor(config, logger, modelCacheTtlMs = 15 * 60 * 1000) {
        this.config = config;
        this.logger = logger;
        this.modelCacheTtlMs = modelCacheTtlMs;
        this.geminiClient = new GeminiImageClient({
            apiKey: config.apiKey,
            defaultModel: config.defaultModel,
            requestTimeoutMs: config.requestTimeoutMs,
        });
        this.imageStorage = new ImageStorage(config.outputDirectory);
    }
    getOutputDirectory() {
        return this.imageStorage.getOutputDirectory();
    }
    async getModelContext() {
        const now = Date.now();
        if (this.cachedModelContext && this.cachedModelContext.expiresAt > now) {
            return this.cachedModelContext.value;
        }
        const warnings = [];
        let availableModels;
        try {
            this.logger.debug("Refreshing image model list from Gemini API");
            const discoveredModels = await fetchImageModels(this.config.apiKey, this.config.requestTimeoutMs);
            availableModels =
                discoveredModels.length > 0
                    ? discoveredModels
                    : getFallbackImageModels(this.config.defaultModel);
            if (discoveredModels.length === 0) {
                warnings.push("Gemini model discovery returned no image-capable models; using fallback defaults.");
            }
        }
        catch (error) {
            const errorMessage = formatErrorMessage(error);
            this.logger.warn("Failed to refresh image model list; using fallback defaults", {
                error: errorMessage,
            });
            warnings.push("Gemini model discovery failed; using fallback defaults.");
            availableModels = getFallbackImageModels(this.config.defaultModel);
        }
        const defaultModel = resolveDefaultModel(availableModels, this.config.defaultModel);
        if (defaultModel !== this.config.defaultModel) {
            warnings.push(`Configured default model \"${this.config.defaultModel}\" is unavailable; using \"${defaultModel}\" instead.`);
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
        this.logger.info("Generating image", {
            model: selectedModel,
            aspectRatio: request.aspectRatio || "1:1",
            hasCustomOutputPath: Boolean(request.outputPath),
        });
        const generated = await this.geminiClient.generateImage({
            prompt: request.prompt,
            aspectRatio: request.aspectRatio,
            model: selectedModel,
            timeoutMs: this.config.requestTimeoutMs,
        });
        if (!generated.success || !generated.base64Data || !generated.mimeType) {
            if (generated.internalError) {
                this.logger.warn("Gemini image generation failed", {
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
