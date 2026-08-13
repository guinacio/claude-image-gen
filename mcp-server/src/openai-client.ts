import { basename } from "node:path";
import OpenAI, { toFile } from "openai";
import {
  ALPHA_CAPABLE_OUTPUT_FORMATS,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from "./types.js";
import type {
  AspectRatio,
  GenerateImageInput,
  GenerateImageResult,
  ImageBackground,
  ImageOutputFormat,
  ImageProviderClient,
} from "./types.js";

const OPENAI_IMAGE_MODEL_PATTERN = /^(gpt-image|dall-e)/;

export type OpenAIImageSize = "1024x1024" | "1536x1024" | "1024x1536";

interface AspectRatioMapping {
  size: OpenAIImageSize;
  /** The aspect ratio that the delivered size actually represents. */
  deliveredRatio: AspectRatio;
}

const ASPECT_RATIO_SIZES: Record<AspectRatio, AspectRatioMapping> = {
  "1:1": { size: "1024x1024", deliveredRatio: "1:1" },
  "3:2": { size: "1536x1024", deliveredRatio: "3:2" },
  "4:3": { size: "1536x1024", deliveredRatio: "3:2" },
  "16:9": { size: "1536x1024", deliveredRatio: "3:2" },
  "2:3": { size: "1024x1536", deliveredRatio: "2:3" },
  "3:4": { size: "1024x1536", deliveredRatio: "2:3" },
  "9:16": { size: "1024x1536", deliveredRatio: "2:3" },
};

export interface OpenAIConfig {
  apiKey: string;
  requestTimeoutMs: number;
}

/**
 * Maps a requested aspect ratio onto the closest size supported by OpenAI image
 * models. When the mapping is inexact a warning describing the substitution is
 * returned alongside the size.
 */
export function mapAspectRatioToOpenAISize(
  aspectRatio: AspectRatio | undefined
): { size: OpenAIImageSize; warning?: string } {
  if (!aspectRatio) {
    return { size: "1024x1024" };
  }

  const mapping = ASPECT_RATIO_SIZES[aspectRatio];
  if (!mapping) {
    return { size: "1024x1024" };
  }

  if (mapping.deliveredRatio === aspectRatio) {
    return { size: mapping.size };
  }

  return {
    size: mapping.size,
    warning: `Aspect ratio ${aspectRatio} is not supported by OpenAI image models; generated at ${mapping.deliveredRatio} (${mapping.size}) instead.`,
  };
}

export interface ResolvedOutputOptions {
  background?: ImageBackground;
  outputFormat?: ImageOutputFormat;
  error?: string;
}

/**
 * Reconciles the requested background with the requested output format.
 *
 * A transparent background needs an alpha channel, which JPEG cannot carry. An
 * explicit JPEG request is a contradiction and is rejected rather than silently
 * flattened; when no format was requested at all, PNG is selected so that
 * asking for transparency is enough to actually get it.
 */
export function resolveOutputOptions(
  background: ImageBackground | undefined,
  outputFormat: ImageOutputFormat | undefined
): ResolvedOutputOptions {
  if (background !== "transparent") {
    return { background, outputFormat };
  }

  if (outputFormat && !ALPHA_CAPABLE_OUTPUT_FORMATS.includes(outputFormat)) {
    return {
      error: `A transparent background requires an output format with an alpha channel (${ALPHA_CAPABLE_OUTPUT_FORMATS.join(" or ")}); "${outputFormat}" cannot carry one.`,
    };
  }

  return { background, outputFormat: outputFormat ?? "png" };
}

/**
 * Fetches the image-capable model ids exposed by the OpenAI API.
 * Throws on failure so callers can decide how to fall back.
 */
export async function fetchOpenAIImageModels(
  apiKey: string,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<string[]> {
  const client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 0 });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const page = await client.models.list({
      timeout: timeoutMs,
      signal: controller.signal,
    });
    const imageModels = new Set<string>();

    for await (const model of page) {
      if (model.id && OPENAI_IMAGE_MODEL_PATTERN.test(model.id)) {
        imageModels.add(model.id);
      }
    }

    return [...imageModels].sort((left, right) => left.localeCompare(right));
  } finally {
    clearTimeout(timeoutId);
  }
}

function mimeTypeForOutputFormat(outputFormat?: string): string {
  switch (outputFormat) {
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "png":
      return "image/png";
    default:
      return "image/png";
  }
}

export class OpenAIImageClient implements ImageProviderClient {
  private readonly client: OpenAI;
  private readonly config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.requestTimeoutMs,
    });
    this.config = config;
  }

  async generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
    const timeoutMs = input.timeoutMs || this.config.requestTimeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const modelName = input.model;
      const { size, warning } = mapAspectRatioToOpenAISize(input.aspectRatio);
      const warnings = warning ? [warning] : undefined;
      const requestOptions = {
        timeout: timeoutMs,
        signal: controller.signal,
      };

      const hasReferenceImages = Boolean(
        input.referenceImages && input.referenceImages.length > 0
      );

      // A mask marks which region of the base image to repaint, so it only has
      // meaning when there is a base image to edit.
      if (input.mask && !hasReferenceImages) {
        return {
          success: false,
          errorCode: "MASK_WITHOUT_REFERENCE_IMAGE",
          error:
            "A mask can only be used together with referenceImages, since it marks the region of the base image to repaint.",
          warnings,
        };
      }

      const outputOptions = resolveOutputOptions(
        input.background,
        input.outputFormat
      );

      if (outputOptions.error) {
        return {
          success: false,
          errorCode: "INCOMPATIBLE_OUTPUT_OPTIONS",
          error: outputOptions.error,
          warnings,
        };
      }

      // gpt-image models always return base64 payloads, so response_format is
      // never sent. input_fidelity is left to the model default as well.
      const sharedOptions = {
        model: modelName,
        prompt: input.prompt,
        size,
        ...(outputOptions.background
          ? { background: outputOptions.background }
          : {}),
        ...(outputOptions.outputFormat
          ? { output_format: outputOptions.outputFormat }
          : {}),
      };

      let response;
      if (hasReferenceImages) {
        const image = await Promise.all(
          input.referenceImages!.map((ref) =>
            toFile(Buffer.from(ref.base64Data, "base64"), basename(ref.filePath), {
              type: ref.mimeType,
            })
          )
        );

        const mask = input.mask
          ? await toFile(
              Buffer.from(input.mask.base64Data, "base64"),
              basename(input.mask.filePath),
              { type: input.mask.mimeType }
            )
          : undefined;

        response = await this.client.images.edit(
          {
            ...sharedOptions,
            image,
            ...(mask ? { mask } : {}),
          },
          requestOptions
        );
      } else {
        response = await this.client.images.generate(
          sharedOptions,
          requestOptions
        );
      }

      const base64Data = response.data?.[0]?.b64_json;
      if (!base64Data) {
        return {
          success: false,
          errorCode: "OPENAI_EMPTY_RESPONSE",
          error: "OpenAI did not return a generated image.",
          warnings,
        };
      }

      return {
        success: true,
        base64Data,
        mimeType: mimeTypeForOutputFormat(response.output_format),
        warnings,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        errorCode: controller.signal.aborted ? "REQUEST_TIMEOUT" : "OPENAI_API_ERROR",
        error: controller.signal.aborted
          ? `Image generation timed out after ${timeoutMs}ms.`
          : "OpenAI image generation failed.",
        internalError: errorMessage,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
