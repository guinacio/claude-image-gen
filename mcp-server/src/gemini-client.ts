import { GoogleGenAI } from "@google/genai";
import { DEFAULT_REQUEST_TIMEOUT_MS } from "./types.js";
import type {
  GenerateImageInput,
  GenerateImageResult,
  GeminiConfig,
  ReferenceImage,
} from "./types.js";

/**
 * Fetches all image-capable Gemini models from the API.
 * The SDK returns a pager, so we iterate the full result set instead of
 * relying on the first page only.
 */
export async function fetchImageModels(
  apiKey: string,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const pager = await ai.models.list({
      config: {
        abortSignal: controller.signal,
        httpOptions: {
          timeout: timeoutMs,
        },
      },
    });
    const imageModels = new Set<string>();

    for await (const model of pager) {
      if (
        model.name &&
        model.name.includes("image") &&
        model.supportedActions?.includes("generateContent")
      ) {
        imageModels.add(model.name.replace(/^models\//, ""));
      }
    }

    return [...imageModels].sort((left, right) => left.localeCompare(right));
  } finally {
    clearTimeout(timeoutId);
  }
}

export class GeminiImageClient {
  private ai: GoogleGenAI;
  private config: GeminiConfig;

  constructor(config: GeminiConfig) {
    this.ai = new GoogleGenAI({ apiKey: config.apiKey });
    this.config = config;
  }

  async generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
    const timeoutMs = input.timeoutMs || this.config.requestTimeoutMs;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const modelName = input.model || this.config.defaultModel;

      // Build generation config
      const generationConfig: Record<string, unknown> = {
        responseModalities: ["TEXT", "IMAGE"],
        abortSignal: controller.signal,
        httpOptions: {
          timeout: timeoutMs,
        },
      };

      // Add image config if aspect ratio is specified
      if (input.aspectRatio) {
        generationConfig.imageConfig = {
          aspectRatio: input.aspectRatio,
        };
      }

      // Build contents: if reference images provided, create multi-part content
      let contents: string | { role: string; parts: Record<string, unknown>[] }[];
      if (input.referenceImages && input.referenceImages.length > 0) {
        const parts: Record<string, unknown>[] = [];
        for (const ref of input.referenceImages) {
          parts.push({
            inlineData: {
              mimeType: ref.mimeType,
              data: ref.base64Data,
            },
          });
        }
        parts.push({ text: input.prompt });
        contents = [{ role: "user", parts }];
      } else {
        contents = input.prompt;
      }

      const response = await this.ai.models.generateContent({
        model: modelName,
        contents,
        config: generationConfig,
      });

      // Extract image from response
      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        return {
          success: false,
          error: "No candidates in response",
        };
      }

      const parts = candidates[0].content?.parts;
      if (!parts) {
        return {
          success: false,
          error: "No content parts in response",
        };
      }

      // Find the image part in the response
      for (const part of parts) {
        if ("inlineData" in part && part.inlineData) {
          return {
            success: true,
            base64Data: part.inlineData.data,
            mimeType: part.inlineData.mimeType || "image/png",
          };
        }
      }

      return {
        success: false,
        error: "No image data found in response",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        errorCode: controller.signal.aborted ? "REQUEST_TIMEOUT" : "GEMINI_API_ERROR",
        error: controller.signal.aborted
          ? `Gemini request timed out after ${timeoutMs}ms`
          : `Gemini API error: ${errorMessage}`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
