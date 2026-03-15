import { GoogleGenAI } from "@google/genai";
import { DEFAULT_REQUEST_TIMEOUT_MS } from "./types.js";
/**
 * Fetches all image-capable Gemini models from the API.
 * The SDK returns a pager, so we iterate the full result set instead of
 * relying on the first page only.
 */
export async function fetchImageModels(apiKey, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
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
        const imageModels = new Set();
        for await (const model of pager) {
            if (model.name &&
                model.name.includes("image") &&
                model.supportedActions?.includes("generateContent")) {
                imageModels.add(model.name.replace(/^models\//, ""));
            }
        }
        return [...imageModels].sort((left, right) => left.localeCompare(right));
    }
    finally {
        clearTimeout(timeoutId);
    }
}
export class GeminiImageClient {
    ai;
    config;
    constructor(config) {
        this.ai = new GoogleGenAI({ apiKey: config.apiKey });
        this.config = config;
    }
    async generateImage(input) {
        const timeoutMs = input.timeoutMs || this.config.requestTimeoutMs;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const modelName = input.model || this.config.defaultModel;
            // Build generation config
            const generationConfig = {
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
            const response = await this.ai.models.generateContent({
                model: modelName,
                contents: input.prompt,
                config: generationConfig,
            });
            // Extract image from response
            const candidates = response.candidates;
            if (!candidates || candidates.length === 0) {
                return {
                    success: false,
                    errorCode: "GEMINI_EMPTY_RESPONSE",
                    error: "Gemini did not return a generated image.",
                };
            }
            const parts = candidates[0].content?.parts;
            if (!parts) {
                return {
                    success: false,
                    errorCode: "GEMINI_EMPTY_RESPONSE",
                    error: "Gemini did not return a generated image.",
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
                errorCode: "GEMINI_EMPTY_RESPONSE",
                error: "Gemini did not return a generated image.",
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                errorCode: controller.signal.aborted ? "REQUEST_TIMEOUT" : "GEMINI_API_ERROR",
                error: controller.signal.aborted
                    ? `Image generation timed out after ${timeoutMs}ms.`
                    : "Gemini image generation failed.",
                internalError: errorMessage,
            };
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
}
