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
export const IMAGE_OUTPUT_FORMATS = ["png", "jpeg", "webp"];
/** Formats that can carry an alpha channel, and therefore a transparent background. */
export const ALPHA_CAPABLE_OUTPUT_FORMATS = [
    "png",
    "webp",
];
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
