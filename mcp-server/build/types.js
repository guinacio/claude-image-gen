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
/** "auto" or WIDTHxHEIGHT; the API checks the model-specific limits. */
export const OPENAI_SIZE_PATTERN = /^(auto|[1-9]\d{1,4}x[1-9]\d{1,4})$/;
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
