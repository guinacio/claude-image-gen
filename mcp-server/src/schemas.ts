import { z } from "zod";
import { ASPECT_RATIOS } from "./types.js";

export const createAssetArgsSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, "Prompt is required")
    .max(10000, "Prompt must be at most 10000 characters long")
    .describe("Detailed description of the image to generate"),
  outputPath: z
    .string()
    .trim()
    .min(1, "outputPath cannot be empty")
    .max(1024, "outputPath must be at most 1024 characters long")
    .optional()
    .describe("Custom output file path (optional)"),
  aspectRatio: z
    .enum(ASPECT_RATIOS)
    .optional()
    .describe("Image aspect ratio (default: 1:1)"),
  model: z
    .string()
    .trim()
    .min(1, "model cannot be empty")
    .max(256, "model must be at most 256 characters long")
    .optional()
    .describe("Model to use for generation"),
});

export const createAssetInputSchema = {
  type: "object",
  properties: {
    prompt: {
      type: "string",
      description:
        "Detailed description of the image to generate. Be specific about style, composition, colors, subject matter, and atmosphere for best results.",
      minLength: 1,
      maxLength: 10000,
    },
    outputPath: {
      type: "string",
      description:
        "Optional custom output file path. Relative paths stay inside the configured output directory; absolute paths are allowed for local workflows.",
      minLength: 1,
      maxLength: 1024,
    },
    aspectRatio: {
      type: "string",
      enum: [...ASPECT_RATIOS],
      description:
        "Aspect ratio for the generated image. Use 16:9 for hero images/headers, 1:1 for thumbnails/social, 9:16 for mobile/stories. Default: 1:1.",
    },
    model: {
      type: "string",
      description:
        "Optional Gemini model name for image generation. If omitted, the configured default model is used when available.",
      minLength: 1,
      maxLength: 256,
    },
  },
  required: ["prompt"],
} as const;

export const createAssetOutputSchema = {
  type: "object",
  properties: {
    success: {
      type: "boolean",
      description: "Whether the image generation request completed successfully.",
    },
    filePath: {
      type: "string",
      description: "Absolute path to the saved image file.",
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
      description: "Gemini model used for generation.",
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
} as const;
