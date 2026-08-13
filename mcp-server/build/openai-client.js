import { basename } from "node:path";
import OpenAI, { toFile } from "openai";
import { ALPHA_CAPABLE_OUTPUT_FORMATS, DEFAULT_REQUEST_TIMEOUT_MS, } from "./types.js";
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
 * Reconciles the requested background with the requested output format.
 *
 * A transparent background needs an alpha channel, which JPEG cannot carry. An
 * explicit JPEG request is a contradiction and is rejected rather than silently
 * flattened; when no format was requested at all, PNG is selected so that
 * asking for transparency is enough to actually get it.
 */
export function resolveOutputOptions(background, outputFormat) {
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
 * Options that a given model is known to reject, recorded from real API
 * responses.
 *
 * This is deliberately a list of *observed failures*, not a capability matrix.
 * Declaring what each model supports would mean maintaining a table that goes
 * stale the moment a model ships, and silently disabling options on models that
 * do support them. Recording only what was seen to fail keeps unknown
 * combinations flowing through to the API, which is the authority on them --
 * and when the API refuses, describeOpenAIFailure passes its reason back.
 *
 * Verified as of 2026-08:
 *   gpt-image-2  background: "transparent"  -> 400, entry below
 *   gpt-image-2  no background/outputFormat -> works, on both generate and edit
 * Not verified on any model: mask, outputFormat, background auto/opaque, and
 * every option on gpt-image-1 and dall-e models.
 */
const OBSERVED_MODEL_REJECTIONS = [
    {
        models: /^gpt-image-2/,
        option: 'background: "transparent"',
        apiMessage: "Transparent background is not supported for this model.",
    },
];
/**
 * Returns the recorded rejection for a model/option pair, when there is one.
 * A miss means "not known to fail", never "known to work".
 */
export function findObservedRejection(model, options) {
    if (!model || options.background !== "transparent") {
        return undefined;
    }
    return OBSERVED_MODEL_REJECTIONS.find((rejection) => rejection.option === 'background: "transparent"' &&
        rejection.models.test(model));
}
/**
 * Turns a thrown request failure into a caller-facing message.
 *
 * Client-side (4xx) failures describe what was wrong with the caller's own
 * request -- which option a model refused, and why -- so that text is passed
 * through. Server-side and transport failures stay generic, because their
 * wording describes infrastructure rather than anything the caller can act on.
 */
export function describeOpenAIFailure(error) {
    const internalError = error instanceof Error ? error.message : String(error);
    const status = error instanceof OpenAI.APIError ? error.status : undefined;
    if (typeof status === "number" && status >= 400 && status < 500) {
        return {
            error: `OpenAI rejected the request: ${internalError}`,
            internalError,
        };
    }
    return { error: "OpenAI image generation failed.", internalError };
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
            const hasReferenceImages = Boolean(input.referenceImages && input.referenceImages.length > 0);
            // A mask marks which region of the base image to repaint, so it only has
            // meaning when there is a base image to edit.
            if (input.mask && !hasReferenceImages) {
                return {
                    success: false,
                    errorCode: "MASK_WITHOUT_REFERENCE_IMAGE",
                    error: "A mask can only be used together with referenceImages, since it marks the region of the base image to repaint.",
                    warnings,
                };
            }
            const outputOptions = resolveOutputOptions(input.background, input.outputFormat);
            if (outputOptions.error) {
                return {
                    success: false,
                    errorCode: "INCOMPATIBLE_OUTPUT_OPTIONS",
                    error: outputOptions.error,
                    warnings,
                };
            }
            const rejection = findObservedRejection(modelName, {
                background: outputOptions.background,
            });
            if (rejection) {
                return {
                    success: false,
                    errorCode: "OPTION_UNSUPPORTED_BY_MODEL",
                    error: `${rejection.option} is not supported by ${modelName}. The API answers: "${rejection.apiMessage}". Whether other models accept this option has not been verified.`,
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
                const image = await Promise.all(input.referenceImages.map((ref) => toFile(Buffer.from(ref.base64Data, "base64"), basename(ref.filePath), {
                    type: ref.mimeType,
                })));
                const mask = input.mask
                    ? await toFile(Buffer.from(input.mask.base64Data, "base64"), basename(input.mask.filePath), { type: input.mask.mimeType })
                    : undefined;
                response = await this.client.images.edit({
                    ...sharedOptions,
                    image,
                    ...(mask ? { mask } : {}),
                }, requestOptions);
            }
            else {
                response = await this.client.images.generate(sharedOptions, requestOptions);
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
            if (controller.signal.aborted) {
                return {
                    success: false,
                    errorCode: "REQUEST_TIMEOUT",
                    error: `Image generation timed out after ${timeoutMs}ms.`,
                    internalError: error instanceof Error ? error.message : String(error),
                };
            }
            const described = describeOpenAIFailure(error);
            return {
                success: false,
                errorCode: "OPENAI_API_ERROR",
                error: described.error,
                internalError: described.internalError,
            };
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
}
