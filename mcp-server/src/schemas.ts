import { z } from "zod";
import {
  ASPECT_RATIOS,
  GIF_FRAME_COUNT_RANGE,
  GIF_FRAME_DURATION_MS_RANGE,
  explainInvalidOpenAISize,
  IMAGE_BACKGROUNDS,
  IMAGE_COMPLEXITIES,
  IMAGE_OUTPUT_FORMATS,
  OPENAI_SIZE_PATTERN,
  SVG_REASONING_EFFORTS,
} from "./types.js";

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
      .array(
        z
          .string()
          .trim()
          .min(1, "Reference image path cannot be empty")
          .max(1024, "Reference image path must be at most 1024 characters long")
      )
      .max(5, "Maximum 5 reference images")
      .optional()
      .describe("Absolute file paths to PNG, JPEG, or WebP reference images to include with the prompt for style/character consistency"),
    mask: z
      .string()
      .trim()
      .min(1, "Mask path cannot be empty")
      .max(1024, "Mask path must be at most 1024 characters long")
      .optional()
      .describe(
        "Absolute path to a PNG mask with an alpha channel marking the region to repaint. OpenAI models only, and only alongside referenceImages"
      ),
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
      .describe("Encoding of the returned image; gif is animated, svg is vector. OpenAI models only"),
    complexity: z
      .enum(IMAGE_COMPLEXITIES)
      .optional()
      .describe("How much planning the model spends on the image, separate from quality. OpenAI models only"),
    frameCount: z
      .number()
      .int("frameCount must be a whole number")
      .min(GIF_FRAME_COUNT_RANGE.min, `frameCount must be at least ${GIF_FRAME_COUNT_RANGE.min}`)
      .max(GIF_FRAME_COUNT_RANGE.max, `frameCount must be at most ${GIF_FRAME_COUNT_RANGE.max}`)
      .optional()
      .describe("Number of frames in an animated GIF. Requires outputFormat gif"),
    frameDurationMs: z
      .number()
      .int("frameDurationMs must be a whole number")
      .min(GIF_FRAME_DURATION_MS_RANGE.min, `frameDurationMs must be at least ${GIF_FRAME_DURATION_MS_RANGE.min}`)
      .max(GIF_FRAME_DURATION_MS_RANGE.max, `frameDurationMs must be at most ${GIF_FRAME_DURATION_MS_RANGE.max}`)
      .optional()
      .describe("Delay per animated GIF frame, in milliseconds. Requires outputFormat gif"),
    svgModel: z
      .string()
      .trim()
      .min(1, "svgModel cannot be empty")
      .max(256, "svgModel must be at most 256 characters long")
      .optional()
      .describe("Model that authors the SVG. Requires outputFormat svg and SVG model selection on the account"),
    svgReasoningEffort: z
      .enum(SVG_REASONING_EFFORTS)
      .optional()
      .describe("Reasoning effort of svgModel. Requires svgModel"),
    size: z
      .string()
      .trim()
      .superRefine((value, context) => {
        const message = explainInvalidOpenAISize(value);
        if (message) {
          context.addIssue({ code: "custom", message });
        }
      })
      .optional()
      .describe("Exact output size, overriding aspectRatio. OpenAI models only"),
    model: z
      .string()
      .trim()
      .min(1, "model cannot be empty")
      .max(256, "model must be at most 256 characters long")
      .optional()
      .describe(
        "Model to use for generation (gpt-image* routes to OpenAI, others to Gemini). dall-e models were shut down on 2026-05-12 and are rejected."
      ),
  });

export const createAssetInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    prompt: {
      type: "string",
      description:
        "Detailed description of the image to generate. Be specific about style, composition, colors, subject matter, and atmosphere for best results.",
      minLength: 1,
      maxLength: 10000,
    },
    referenceImages: {
      type: "array",
      description:
        "Absolute file paths to reference images to include with the prompt. Useful for character/style consistency — the model sees these images alongside the text prompt. Supported formats: PNG, JPEG, WebP. Maximum 5 images.",
      items: {
        type: "string",
        minLength: 1,
        maxLength: 1024,
      },
      maxItems: 5,
    },
    mask: {
      type: "string",
      description:
        "Optional absolute path to a PNG mask. Transparent areas of the mask are the areas the model repaints; everything else is preserved from the base image. Requires referenceImages, and OpenAI documents the mask as needing an alpha channel and matching dimensions. Checked locally: the file really is a PNG, it is under the API's 4MB mask limit, and it is not fully opaque (an opaque mask marks nothing and is rejected before the request is sent). Not checked locally and left to the API: the dimension match, and whether a PNG carrying transparency in a tRNS chunk instead of an alpha channel is accepted — that case is sent with a warning. OpenAI models only — Gemini models reject it. Not verified against a live API on any model; if a model refuses it, the API's own reason is returned.",
      minLength: 1,
      maxLength: 1024,
    },
    outputPath: {
      type: "string",
      description:
        "Optional custom output file path inside the configured output directory. Both relative and absolute paths must stay within that directory.",
      minLength: 1,
      maxLength: 1024,
    },
    aspectRatio: {
      type: "string",
      enum: [...ASPECT_RATIOS],
      description:
        "Aspect ratio for the generated image. Use 16:9 for hero images/headers, 1:1 for thumbnails/social, 9:16 for mobile/stories. Default: 1:1.",
    },
    background: {
      type: "string",
      enum: [...IMAGE_BACKGROUNDS],
      description:
        "Background handling for the generated image. Use transparent to get a cut-out subject with an alpha channel, which requires a png or webp outputFormat; when outputFormat is omitted, png is selected automatically. OpenAI models only — Gemini models reject it. Verified: gpt-image-2 refuses transparent (400 \"Transparent background is not supported for this model\"), and that combination is rejected before the request is sent. Whether other models accept transparent, and whether any model accepts auto or opaque, has not been verified.",
    },
    outputFormat: {
      type: "string",
      enum: [...IMAGE_OUTPUT_FORMATS],
      description:
        "Encoding of the returned image. Defaults to the provider default. jpeg, gif and svg cannot be combined with a transparent background (OpenAI documents transparency as png or webp only). gif returns an animated GIF, tuned with frameCount and frameDurationMs; describe the motion and how it loops in the prompt. GIF output does not support masks, and reference images for a GIF go to the edit endpoint. svg returns a vector image and is generation-only, so it cannot be combined with referenceImages; it may need svgModel. One verified SVG run took about 2.5 minutes, past the 60 s default timeout and under Claude Desktop's 240 s tool-call limit, so raise REQUEST_TIMEOUT_MS (the CLI flag is --timeout-ms) to 180000 for SVG. OpenAI documents gif and svg for gpt-image-2.6-flare and gpt-image-2.6-sunburst, and GIF may require preview access. Verified on 2026-11-07 with gpt-image-2.6-sunburst. OpenAI models only — Gemini models reject it. If a model refuses a format, the API's own reason is returned.",
    },
    complexity: {
      type: "string",
      enum: [...IMAGE_COMPLEXITIES],
      description:
        "How much computation the model spends planning the image, independently of rendering quality. The gpt-image-2.6 models default to high; higher values can add latency and unwanted changes in edits. OpenAI documents no separate fee for it. OpenAI models only — Gemini models reject it. Not verified against a live API on any model; if a model refuses it, the API's own reason is returned.",
    },
    frameCount: {
      type: "integer",
      minimum: GIF_FRAME_COUNT_RANGE.min,
      maximum: GIF_FRAME_COUNT_RANGE.max,
      description:
        "Number of frames in an animated GIF (OpenAI default: 9). Only valid with outputFormat gif. OpenAI models only — Gemini models reject it.",
    },
    frameDurationMs: {
      type: "integer",
      minimum: GIF_FRAME_DURATION_MS_RANGE.min,
      maximum: GIF_FRAME_DURATION_MS_RANGE.max,
      description:
        "Delay per animated GIF frame in milliseconds, rounded by OpenAI to the nearest 10 ms (OpenAI default: 200). Only valid with outputFormat gif. OpenAI models only — Gemini models reject it.",
    },
    svgModel: {
      type: "string",
      description:
        "Model that authors the SVG, such as a GPT text model; the image model in `model` only creates the reference image it works from. Only valid with outputFormat svg. On accounts with SVG model selection the API requires it: verified on 2026-11-07, gpt-image-2.6-sunburst refused svg output without it (400 \"SVG generation requires 'svg.model'\") and produced the SVG with gpt-5.5. OpenAI documents that accounts without SVG model selection must leave it out. OpenAI models only — Gemini models reject it.",
      minLength: 1,
      maxLength: 256,
    },
    svgReasoningEffort: {
      type: "string",
      enum: [...SVG_REASONING_EFFORTS],
      description:
        "Reasoning effort of svgModel, independent of complexity. Requires svgModel; omitted, the author model's default is used. Which efforts work depends on svgModel. OpenAI models only — Gemini models reject it.",
    },
    size: {
      type: "string",
      pattern: OPENAI_SIZE_PATTERN.source,
      description:
        "Exact output size as WIDTHxHEIGHT (for example 1536x864) or auto, overriding the aspectRatio mapping to the three standard sizes. Refused locally unless both sides are multiples of 16, neither edge exceeds 3840, and the ratio is between 1:3 and 3:1. For GIF, the frames share one sheet that must also fit within 3840 px on its longest edge and within the pixel budget of 3840x2160; that sheet limit is left to the API because it depends on the frame count. Verified on 2026-11-07 with gpt-image-2.6-sunburst: 16 frames were refused at 1024x1024 (4096x4096 sheet) and at 960x960 (3840x3840 sheet, over the pixel budget) and worked at 720x720. OpenAI models only — Gemini models reject it.",
    },
    model: {
      type: "string",
      description:
        "Optional model name for image generation. gpt-image* models route to OpenAI; all other models route to Gemini. dall-e-2 and dall-e-3 were shut down on 2026-05-12 and are rejected. If omitted, the configured default provider's default model is used when available.",
      minLength: 1,
      maxLength: 256,
    },
  },
  required: ["prompt"],
} as const;

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
      description: "Aspect ratio used for the image. Omitted when the request named an exact size.",
    },
    size: {
      type: "string",
      description: "Exact size sent to the provider, when the request named one instead of relying on aspectRatio.",
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
} as const;
