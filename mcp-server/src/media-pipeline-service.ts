import * as fs from "fs";
import * as path from "path";
import { GeminiImageClient, fetchImageModels } from "./gemini-client.js";
import { ImageStorage } from "./image-storage.js";
import {
  formatErrorMessage,
  getFallbackImageModels,
  resolveDefaultModel,
} from "./runtime.js";
import type { Logger } from "./runtime.js";
import type {
  CreateAssetRequest,
  CreateAssetResponse,
  ReferenceImage,
  RuntimeConfig,
} from "./types.js";

interface ModelContext {
  availableModels: string[];
  defaultModel: string;
  warnings: string[];
}

export class MediaPipelineService {
  private readonly geminiClient: GeminiImageClient;
  private readonly imageStorage: ImageStorage;
  private cachedModelContext: { value: ModelContext; expiresAt: number } | null =
    null;

  constructor(
    private readonly config: RuntimeConfig,
    private readonly logger: Logger,
    private readonly modelCacheTtlMs: number = 15 * 60 * 1000
  ) {
    this.geminiClient = new GeminiImageClient({
      apiKey: config.apiKey,
      defaultModel: config.defaultModel,
      outputDirectory: config.outputDirectory,
      requestTimeoutMs: config.requestTimeoutMs,
    });
    this.imageStorage = new ImageStorage(config.outputDirectory);
  }

  getOutputDirectory(): string {
    return this.imageStorage.getOutputDirectory();
  }

  async getModelContext(): Promise<ModelContext> {
    const now = Date.now();
    if (this.cachedModelContext && this.cachedModelContext.expiresAt > now) {
      return this.cachedModelContext.value;
    }

    const warnings: string[] = [];
    let availableModels: string[];

    try {
      this.logger.debug("Refreshing image model list from Gemini API");
      const discoveredModels = await fetchImageModels(
        this.config.apiKey,
        this.config.requestTimeoutMs
      );
      availableModels =
        discoveredModels.length > 0
          ? discoveredModels
          : getFallbackImageModels(this.config.defaultModel);

      if (discoveredModels.length === 0) {
        warnings.push(
          "Gemini model discovery returned no image-capable models; using fallback defaults."
        );
      }
    } catch (error) {
      const errorMessage = formatErrorMessage(error);
      this.logger.warn("Failed to refresh image model list; using fallback defaults", {
        error: errorMessage,
      });
      warnings.push(
        `Gemini model discovery failed; using fallback defaults. ${errorMessage}`
      );
      availableModels = getFallbackImageModels(this.config.defaultModel);
    }

    const defaultModel = resolveDefaultModel(
      availableModels,
      this.config.defaultModel
    );

    if (defaultModel !== this.config.defaultModel) {
      warnings.push(
        `Configured default model \"${this.config.defaultModel}\" is unavailable; using \"${defaultModel}\" instead.`
      );
    }

    const context: ModelContext = {
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

  async createAsset(request: CreateAssetRequest): Promise<CreateAssetResponse> {
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

    // Load reference images from disk if provided
    let referenceImages: ReferenceImage[] | undefined;
    if (request.referenceImages && request.referenceImages.length > 0) {
      referenceImages = [];
      for (const filePath of request.referenceImages) {
        try {
          const resolved = path.resolve(filePath);
          if (!fs.existsSync(resolved)) {
            return {
              success: false,
              errorCode: "REFERENCE_IMAGE_NOT_FOUND",
              error: `Reference image not found: ${resolved}`,
              outputDirectory: this.imageStorage.getOutputDirectory(),
              warnings,
            };
          }
          const data = fs.readFileSync(resolved);
          const ext = path.extname(resolved).toLowerCase();
          const mimeType =
            ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : ext === ".png"
                ? "image/png"
                : ext === ".webp"
                  ? "image/webp"
                  : "image/jpeg";
          referenceImages.push({
            filePath: resolved,
            base64Data: data.toString("base64"),
            mimeType,
          });
          this.logger.debug("Loaded reference image", { filePath: resolved, mimeType });
        } catch (error) {
          return {
            success: false,
            errorCode: "REFERENCE_IMAGE_READ_ERROR",
            error: `Failed to read reference image ${filePath}: ${formatErrorMessage(error)}`,
            outputDirectory: this.imageStorage.getOutputDirectory(),
            warnings,
          };
        }
      }
    }

    const generated = await this.geminiClient.generateImage({
      prompt: request.prompt,
      referenceImages,
      aspectRatio: request.aspectRatio,
      model: selectedModel,
      timeoutMs: this.config.requestTimeoutMs,
    });

    if (!generated.success || !generated.base64Data || !generated.mimeType) {
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

    const saved = this.imageStorage.saveImage(
      generated.base64Data,
      request.outputPath,
      generated.mimeType
    );

    if (!saved.success || !saved.filePath) {
      return {
        success: false,
        errorCode: "FILE_SAVE_FAILED",
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
      mimeType: generated.mimeType,
      prompt: request.prompt,
      aspectRatio: request.aspectRatio || "1:1",
      model: selectedModel,
      outputDirectory: this.imageStorage.getOutputDirectory(),
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}
