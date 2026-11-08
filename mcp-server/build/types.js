export const ASPECT_RATIOS = [
    "1:1",
    "2:3",
    "3:2",
    "3:4",
    "4:3",
    "16:9",
    "9:16",
];
export const IMAGE_BACKGROUNDS = ["auto", "transparent", "opaque"];
export const IMAGE_OUTPUT_FORMATS = ["png", "jpeg", "webp", "gif", "svg"];
/**
 * Formats that can carry an alpha channel, and therefore a transparent
 * background. OpenAI documents transparent backgrounds as needing png or webp,
 * so gif and svg stay out even though both can express transparency.
 */
export const ALPHA_CAPABLE_OUTPUT_FORMATS = [
    "png",
    "webp",
];
/** How much planning the model spends on an image, separate from rendering quality. */
export const IMAGE_COMPLEXITIES = ["low", "medium", "high"];
/** Reasoning effort for the model that authors SVG output. Which ones work depends on that model. */
export const SVG_REASONING_EFFORTS = [
    "none",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
];
/**
 * Shape advertised on the tool schema. `explainInvalidOpenAISize` is the
 * check the handler actually enforces.
 */
export const OPENAI_SIZE_PATTERN = /^(auto|[1-9]\d{1,4}x[1-9]\d{1,4})$/;
/** Longest edge OpenAI documents for a custom GPT Image size. */
export const OPENAI_MAX_EDGE_PX = 3840;
/**
 * Returns a reason to refuse `size` locally, or undefined when it matches the
 * limits OpenAI documents for gpt-image-2 and later: `auto`, or WIDTHxHEIGHT
 * with both sides multiples of 16, neither edge above 3840, and a ratio
 * between 1:3 and 3:1. The GIF sheet budget stays with the API, because it
 * depends on the frame count.
 */
export function explainInvalidOpenAISize(size) {
    if (size === "auto") {
        return undefined;
    }
    const match = /^([1-9]\d{1,4})x([1-9]\d{1,4})$/.exec(size);
    if (!match) {
        return 'size must be "auto" or WIDTHxHEIGHT, such as 720x720';
    }
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (width % 16 !== 0 || height % 16 !== 0) {
        return "size width and height must both be multiples of 16";
    }
    if (width > OPENAI_MAX_EDGE_PX || height > OPENAI_MAX_EDGE_PX) {
        return `size edges must be at most ${OPENAI_MAX_EDGE_PX} pixels`;
    }
    // Cross-multiply so a ratio of exactly 1:3 or 3:1 is accepted.
    if (width * 3 < height || height * 3 < width) {
        return "size aspect ratio must be between 1:3 and 3:1";
    }
    return undefined;
}
/** Frame limits for animated GIF output, as documented for the OpenAI Image API. */
export const GIF_FRAME_COUNT_RANGE = { min: 2, max: 16 };
export const GIF_FRAME_DURATION_MS_RANGE = { min: 20, max: 2000 };
// Used only when Gemini model discovery fails. These are current GA image
// models: gemini-3-pro-image-preview shut down on 2026-06-25, and
// gemini-2.5-flash-image is scheduled to shut down on 2027-03-15.
// https://ai.google.dev/gemini-api/docs/deprecations
export const FALLBACK_IMAGE_MODELS = [
    "gemini-3-pro-image",
    "gemini-3.1-flash-lite-image",
];
export const FALLBACK_OPENAI_IMAGE_MODELS = ["gpt-image-2"];
export const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
export const DEFAULT_LOG_LEVEL = "info";
