import { z } from "zod";
import { ASPECT_RATIOS, IMAGE_BACKGROUNDS, IMAGE_OUTPUT_FORMATS, } from "./types.js";
export const createAssetArgsSchema = z
    .strictObject({
    prompt: z
        .string({
        error: (issue) => (issue.input === undefined ? "Required" : undefined),
    })
        .trim()
        .min(1, "Prompt is required")
        .max(10000, "Prompt must be at most 10000 characters long")
        .describe("Detailed description of the image to generate"),
    referenceImages: z
        .array(z
        .string()
        .trim()
        .min(1, "Reference image path cannot be empty")
        .max(1024, "Reference image path must be at most 1024 characters long"))
        .max(5, "Maximum 5 reference images")
        .optional()
        .describe("Absolute file paths to PNG, JPEG, or WebP reference images to include with the prompt for style/character consistency"),
    mask: z
        .string()
        .trim()
        .min(1, "Mask path cannot be empty")
        .max(1024, "Mask path must be at most 1024 characters long")
        .optional()
        .describe("Absolute path to a PNG mask marking the region to repaint. OpenAI models only, and only alongside referenceImages"),
    outputPath: z
        .string()
        .trim()
        .min(1, "outputPath cannot be empty")
        .max(1024, "outputPath must be at most 1024 characters long")
        .optional()
        .describe("Custom output file path inside the configured output directory"),
    aspectRatio: z
        .enum(ASPECT_RATIOS)
        .optional()
        .describe("Image aspect ratio (default: 1:1)"),
    background: z
        .enum(IMAGE_BACKGROUNDS)
        .optional()
        .describe("Background handling; transparent requires an alpha-capable format. OpenAI models only"),
    outputFormat: z
        .enum(IMAGE_OUTPUT_FORMATS)
        .optional()
        .describe("Encoding of the returned image. OpenAI models only"),
    model: z
        .string()
        .trim()
        .min(1, "model cannot be empty")
        .max(256, "model must be at most 256 characters long")
        .optional()
        .describe("Model to use for generation (gpt-image*/dall-e* route to OpenAI, others to Gemini)"),
});
export const createAssetInputSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        prompt: {
            type: "string",
            description: "Detailed description of the image to generate. Be specific about style, composition, colors, subject matter, and atmosphere for best results.",
            minLength: 1,
            maxLength: 10000,
        },
        referenceImages: {
            type: "array",
            description: "Absolute file paths to reference images to include with the prompt. Useful for character/style consistency — the model sees these images alongside the text prompt. Supported formats: PNG, JPEG, WebP. Maximum 5 images.",
            items: {
                type: "string",
                minLength: 1,
                maxLength: 1024,
            },
            maxItems: 5,
        },
        mask: {
            type: "string",
            description: "Optional absolute path to a PNG mask. Transparent areas of the mask are the areas the model repaints; everything else is preserved from the base image. Requires referenceImages, and must match their dimensions. OpenAI models only — Gemini models reject it. Not verified against a live API on any model; if a model refuses it, the API's own reason is returned.",
            minLength: 1,
            maxLength: 1024,
        },
        outputPath: {
            type: "string",
            description: "Optional custom output file path inside the configured output directory. Both relative and absolute paths must stay within that directory.",
            minLength: 1,
            maxLength: 1024,
        },
        aspectRatio: {
            type: "string",
            enum: [...ASPECT_RATIOS],
            description: "Aspect ratio for the generated image. Use 16:9 for hero images/headers, 1:1 for thumbnails/social, 9:16 for mobile/stories. Default: 1:1.",
        },
        background: {
            type: "string",
            enum: [...IMAGE_BACKGROUNDS],
            description: "Background handling for the generated image. Use transparent to get a cut-out subject with an alpha channel, which requires a png or webp outputFormat; when outputFormat is omitted, png is selected automatically. OpenAI models only — Gemini models reject it. Verified: gpt-image-2 refuses transparent (400 \"Transparent background is not supported for this model\"), and that combination is rejected before the request is sent. Whether other models accept transparent, and whether any model accepts auto or opaque, has not been verified.",
        },
        outputFormat: {
            type: "string",
            enum: [...IMAGE_OUTPUT_FORMATS],
            description: "Encoding of the returned image. Defaults to the provider default. jpeg cannot carry transparency. OpenAI models only — Gemini models reject it. Not verified against a live API on any model; if a model refuses it, the API's own reason is returned.",
        },
        model: {
            type: "string",
            description: "Optional model name for image generation. gpt-image*/dall-e* models route to OpenAI; all other models route to Gemini. If omitted, the configured default provider's default model is used when available.",
            minLength: 1,
            maxLength: 256,
        },
    },
    required: ["prompt"],
};
export const createAssetOutputSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        success: {
            type: "boolean",
            description: "Whether the image generation request completed successfully.",
        },
        filePath: {
            type: "string",
            description: "Absolute path to the saved image file.",
        },
        resourceUri: {
            type: "string",
            description: "Resource URI for the generated file returned in a resource_link content block.",
        },
        mimeType: {
            type: "string",
            description: "MIME type of the generated image.",
        },
        prompt: {
            type: "string",
            description: "Prompt used for the generation request.",
        },
        aspectRatio: {
            type: "string",
            enum: [...ASPECT_RATIOS],
            description: "Aspect ratio used for the image.",
        },
        model: {
            type: "string",
            description: "Model used for generation (Gemini or OpenAI).",
        },
        outputDirectory: {
            type: "string",
            description: "Configured base output directory for relative file paths.",
        },
        error: {
            type: "string",
            description: "Human-readable error message when success is false.",
        },
        errorCode: {
            type: "string",
            description: "Stable error code for machine-readable handling.",
        },
        warnings: {
            type: "array",
            description: "Non-fatal warnings associated with the request.",
            items: {
                type: "string",
            },
        },
    },
    required: ["success"],
};
