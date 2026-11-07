import { z } from "zod";
export declare const createAssetArgsSchema: z.ZodObject<{
    prompt: z.ZodString;
    referenceImages: z.ZodOptional<z.ZodArray<z.ZodString>>;
    mask: z.ZodOptional<z.ZodString>;
    outputPath: z.ZodOptional<z.ZodString>;
    aspectRatio: z.ZodOptional<z.ZodEnum<{
        "1:1": "1:1";
        "2:3": "2:3";
        "3:2": "3:2";
        "3:4": "3:4";
        "4:3": "4:3";
        "16:9": "16:9";
        "9:16": "9:16";
    }>>;
    background: z.ZodOptional<z.ZodEnum<{
        auto: "auto";
        transparent: "transparent";
        opaque: "opaque";
    }>>;
    outputFormat: z.ZodOptional<z.ZodEnum<{
        png: "png";
        jpeg: "jpeg";
        webp: "webp";
        gif: "gif";
        svg: "svg";
    }>>;
    complexity: z.ZodOptional<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>>;
    frameCount: z.ZodOptional<z.ZodNumber>;
    frameDurationMs: z.ZodOptional<z.ZodNumber>;
    svgModel: z.ZodOptional<z.ZodString>;
    svgReasoningEffort: z.ZodOptional<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        none: "none";
        minimal: "minimal";
        xhigh: "xhigh";
        max: "max";
    }>>;
    size: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const createAssetInputSchema: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly properties: {
        readonly prompt: {
            readonly type: "string";
            readonly description: "Detailed description of the image to generate. Be specific about style, composition, colors, subject matter, and atmosphere for best results.";
            readonly minLength: 1;
            readonly maxLength: 10000;
        };
        readonly referenceImages: {
            readonly type: "array";
            readonly description: "Absolute file paths to reference images to include with the prompt. Useful for character/style consistency — the model sees these images alongside the text prompt. Supported formats: PNG, JPEG, WebP. Maximum 5 images.";
            readonly items: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 1024;
            };
            readonly maxItems: 5;
        };
        readonly mask: {
            readonly type: "string";
            readonly description: "Optional absolute path to a PNG mask. Transparent areas of the mask are the areas the model repaints; everything else is preserved from the base image. Requires referenceImages, and OpenAI documents the mask as needing an alpha channel and matching dimensions. Checked locally: the file really is a PNG, it is under the API's 4MB mask limit, and it is not fully opaque (an opaque mask marks nothing and is rejected before the request is sent). Not checked locally and left to the API: the dimension match, and whether a PNG carrying transparency in a tRNS chunk instead of an alpha channel is accepted — that case is sent with a warning. OpenAI models only — Gemini models reject it. Not verified against a live API on any model; if a model refuses it, the API's own reason is returned.";
            readonly minLength: 1;
            readonly maxLength: 1024;
        };
        readonly outputPath: {
            readonly type: "string";
            readonly description: "Optional custom output file path inside the configured output directory. Both relative and absolute paths must stay within that directory.";
            readonly minLength: 1;
            readonly maxLength: 1024;
        };
        readonly aspectRatio: {
            readonly type: "string";
            readonly enum: readonly ["1:1", "2:3", "3:2", "3:4", "4:3", "16:9", "9:16"];
            readonly description: "Aspect ratio for the generated image. Use 16:9 for hero images/headers, 1:1 for thumbnails/social, 9:16 for mobile/stories. Default: 1:1.";
        };
        readonly background: {
            readonly type: "string";
            readonly enum: readonly ["auto", "transparent", "opaque"];
            readonly description: "Background handling for the generated image. Use transparent to get a cut-out subject with an alpha channel, which requires a png or webp outputFormat; when outputFormat is omitted, png is selected automatically. OpenAI models only — Gemini models reject it. Verified: gpt-image-2 refuses transparent (400 \"Transparent background is not supported for this model\"), and that combination is rejected before the request is sent. Whether other models accept transparent, and whether any model accepts auto or opaque, has not been verified.";
        };
        readonly outputFormat: {
            readonly type: "string";
            readonly enum: readonly ["png", "jpeg", "webp", "gif", "svg"];
            readonly description: "Encoding of the returned image. Defaults to the provider default. jpeg, gif and svg cannot be combined with a transparent background (OpenAI documents transparency as png or webp only). gif returns an animated GIF, tuned with frameCount and frameDurationMs; describe the motion and how it loops in the prompt. GIF output does not support masks. svg returns a vector image and is generation-only, so it cannot be combined with referenceImages; it may need svgModel, and one verified run took about 2.5 minutes, well past the 60 s default timeout. OpenAI documents gif and svg for the gpt-image-2.6 models (gpt-image-2.6-flare, gpt-image-2.6-sunburst), and GIF may require preview access. OpenAI models only — Gemini models reject it. Not verified against a live API on any model; if a model refuses it, the API's own reason is returned.";
        };
        readonly complexity: {
            readonly type: "string";
            readonly enum: readonly ["low", "medium", "high"];
            readonly description: "How much computation the model spends planning the image, independently of rendering quality. The gpt-image-2.6 models default to high; higher values can add latency and unwanted changes in edits. OpenAI documents no separate fee for it. OpenAI models only — Gemini models reject it. Not verified against a live API on any model; if a model refuses it, the API's own reason is returned.";
        };
        readonly frameCount: {
            readonly type: "integer";
            readonly minimum: 2;
            readonly maximum: 16;
            readonly description: "Number of frames in an animated GIF (OpenAI default: 9). Only valid with outputFormat gif. OpenAI models only — Gemini models reject it.";
        };
        readonly frameDurationMs: {
            readonly type: "integer";
            readonly minimum: 20;
            readonly maximum: 2000;
            readonly description: "Delay per animated GIF frame in milliseconds, rounded by OpenAI to the nearest 10 ms (OpenAI default: 200). Only valid with outputFormat gif. OpenAI models only — Gemini models reject it.";
        };
        readonly svgModel: {
            readonly type: "string";
            readonly description: "Model that authors the SVG, such as a GPT text model; the image model in `model` only creates the reference image it works from. Only valid with outputFormat svg. On accounts with SVG model selection the API requires it: verified on 2026-11-07, gpt-image-2.6-sunburst refused svg output without it (400 \"SVG generation requires 'svg.model'\") and produced the SVG with gpt-5.5. OpenAI documents that accounts without SVG model selection must leave it out. OpenAI models only — Gemini models reject it.";
            readonly minLength: 1;
            readonly maxLength: 256;
        };
        readonly svgReasoningEffort: {
            readonly type: "string";
            readonly enum: readonly ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
            readonly description: "Reasoning effort of svgModel, independent of complexity. Requires svgModel; omitted, the author model's default is used. Which efforts work depends on svgModel. OpenAI models only — Gemini models reject it.";
        };
        readonly size: {
            readonly type: "string";
            readonly pattern: string;
            readonly description: "Exact output size as WIDTHxHEIGHT (for example 1536x864) or auto, overriding the aspectRatio mapping to the three standard sizes. OpenAI documents arbitrary sizes for gpt-image-2 and later: both sides divisible by 16, aspect ratio between 1:3 and 3:1, at most 3840x2160. For GIF, the frames are laid out on one sheet that must fit within 3840 px on its longest edge and within the pixel budget of 3840x2160. Verified on 2026-11-07 with gpt-image-2.6-sunburst: 16 frames were refused at 1024x1024 (4096x4096 sheet) and at 960x960 (3840x3840 sheet, over the pixel budget) and worked at 720x720. OpenAI models only — Gemini models reject it.";
        };
        readonly model: {
            readonly type: "string";
            readonly description: "Optional model name for image generation. gpt-image*/dall-e* models route to OpenAI; all other models route to Gemini. If omitted, the configured default provider's default model is used when available.";
            readonly minLength: 1;
            readonly maxLength: 256;
        };
    };
    readonly required: readonly ["prompt"];
};
export declare const createAssetOutputSchema: {
    readonly type: "object";
    readonly additionalProperties: false;
    readonly properties: {
        readonly success: {
            readonly type: "boolean";
            readonly description: "Whether the image generation request completed successfully.";
        };
        readonly filePath: {
            readonly type: "string";
            readonly description: "Absolute path to the saved image file.";
        };
        readonly resourceUri: {
            readonly type: "string";
            readonly description: "Resource URI for the generated file returned in a resource_link content block.";
        };
        readonly mimeType: {
            readonly type: "string";
            readonly description: "MIME type of the generated image.";
        };
        readonly prompt: {
            readonly type: "string";
            readonly description: "Prompt used for the generation request.";
        };
        readonly aspectRatio: {
            readonly type: "string";
            readonly enum: readonly ["1:1", "2:3", "3:2", "3:4", "4:3", "16:9", "9:16"];
            readonly description: "Aspect ratio used for the image. Omitted when the request named an exact size.";
        };
        readonly size: {
            readonly type: "string";
            readonly description: "Exact size sent to the provider, when the request named one instead of relying on aspectRatio.";
        };
        readonly model: {
            readonly type: "string";
            readonly description: "Model used for generation (Gemini or OpenAI).";
        };
        readonly outputDirectory: {
            readonly type: "string";
            readonly description: "Configured base output directory for relative file paths.";
        };
        readonly error: {
            readonly type: "string";
            readonly description: "Human-readable error message when success is false.";
        };
        readonly errorCode: {
            readonly type: "string";
            readonly description: "Stable error code for machine-readable handling.";
        };
        readonly warnings: {
            readonly type: "array";
            readonly description: "Non-fatal warnings associated with the request.";
            readonly items: {
                readonly type: "string";
            };
        };
    };
    readonly required: readonly ["success"];
};
