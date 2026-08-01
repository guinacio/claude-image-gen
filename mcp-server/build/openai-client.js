import { basename } from "node:path";
import OpenAI, { toFile } from "openai";
import { DEFAULT_REQUEST_TIMEOUT_MS } from "./types.js";
const OPENAI_IMAGE_MODEL_PATTERN = /^(gpt-image|dall-e)/;
const ASPECT_RATIO_SIZES = {
    "1:1": { size: "1024x1024", deliveredRatio: "1:1" },
    "3:2": { size: "1536x1024", deliveredRatio: "3:2" },
    "4:3": { size: "1536x1024", deliveredRatio: "3:2" },
    "16:9": { size: "1536x1024", deliveredRatio: "3:2" },
    "2:3": { size: "1024x1536", deliveredRatio: "2:3" },
    "3:4": { size: "1024x1536", deliveredRatio: "2:3" },
    "9:16": { size: "1024x1536", deliveredRatio: "2:3" },
};
/**
 * Maps a requested aspect ratio onto the closest size supported by OpenAI image
 * models. When the mapping is inexact a warning describing the substitution is
 * returned alongside the size.
 */
export function mapAspectRatioToOpenAISize(aspectRatio) {
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
/**
 * Fetches the image-capable model ids exposed by the OpenAI API.
 * Throws on failure so callers can decide how to fall back.
 */
export async function fetchOpenAIImageModels(apiKey, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
    const client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 0 });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const page = await client.models.list({
            timeout: timeoutMs,
            signal: controller.signal,
        });
        const imageModels = new Set();
        for await (const model of page) {
            if (model.id && OPENAI_IMAGE_MODEL_PATTERN.test(model.id)) {
                imageModels.add(model.id);
            }
        }
        return [...imageModels].sort((left, right) => left.localeCompare(right));
    }
    finally {
        clearTimeout(timeoutId);
    }
}
function mimeTypeForOutputFormat(outputFormat) {
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
export class OpenAIImageClient {
    client;
    config;
    constructor(config) {
        this.client = new OpenAI({
            apiKey: config.apiKey,
            timeout: config.requestTimeoutMs,
        });
        this.config = config;
    }
    async generateImage(input) {
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
            // gpt-image models always return base64 payloads, so response_format is
            // never sent. input_fidelity is left to the model default as well.
            let response;
            if (input.referenceImages && input.referenceImages.length > 0) {
                const image = await Promise.all(input.referenceImages.map((ref) => toFile(Buffer.from(ref.base64Data, "base64"), basename(ref.filePath), {
                    type: ref.mimeType,
                })));
                response = await this.client.images.edit({
                    model: modelName,
                    image,
                    prompt: input.prompt,
                    size,
                }, requestOptions);
            }
            else {
                response = await this.client.images.generate({
                    model: modelName,
                    prompt: input.prompt,
                    size,
                }, requestOptions);
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                errorCode: controller.signal.aborted ? "REQUEST_TIMEOUT" : "OPENAI_API_ERROR",
                error: controller.signal.aborted
                    ? `Image generation timed out after ${timeoutMs}ms.`
                    : "OpenAI image generation failed.",
                internalError: errorMessage,
            };
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
}
