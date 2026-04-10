import { z } from "zod";
export declare const createAssetArgsSchema: z.ZodObject<{
    prompt: z.ZodString;
    referenceImages: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    outputPath: z.ZodOptional<z.ZodString>;
    aspectRatio: z.ZodOptional<z.ZodEnum<["1:1", "2:3", "3:2", "3:4", "4:3", "16:9", "9:16"]>>;
    model: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    aspectRatio?: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "16:9" | "9:16" | undefined;
    model?: string | undefined;
    referenceImages?: string[] | undefined;
    outputPath?: string | undefined;
}, {
    prompt: string;
    aspectRatio?: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "16:9" | "9:16" | undefined;
    model?: string | undefined;
    referenceImages?: string[] | undefined;
    outputPath?: string | undefined;
}>;
export declare const createAssetInputSchema: {
    readonly type: "object";
    readonly properties: {
        readonly prompt: {
            readonly type: "string";
            readonly description: "Detailed description of the image to generate. Be specific about style, composition, colors, subject matter, and atmosphere for best results.";
            readonly minLength: 1;
            readonly maxLength: 10000;
        };
        readonly referenceImages: {
            readonly type: "array";
            readonly description: "Absolute file paths to reference images to include with the prompt. Useful for character/style consistency — the model sees these images alongside the text prompt. Maximum 5 images.";
            readonly items: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 1024;
            };
            readonly maxItems: 5;
        };
        readonly outputPath: {
            readonly type: "string";
            readonly description: "Optional custom output file path. Relative paths stay inside the configured output directory; absolute paths are allowed for local workflows.";
            readonly minLength: 1;
            readonly maxLength: 1024;
        };
        readonly aspectRatio: {
            readonly type: "string";
            readonly enum: readonly ["1:1", "2:3", "3:2", "3:4", "4:3", "16:9", "9:16"];
            readonly description: "Aspect ratio for the generated image. Use 16:9 for hero images/headers, 1:1 for thumbnails/social, 9:16 for mobile/stories. Default: 1:1.";
        };
        readonly model: {
            readonly type: "string";
            readonly description: "Optional Gemini model name for image generation. If omitted, the configured default model is used when available.";
            readonly minLength: 1;
            readonly maxLength: 256;
        };
    };
    readonly required: readonly ["prompt"];
};
export declare const createAssetOutputSchema: {
    readonly type: "object";
    readonly properties: {
        readonly success: {
            readonly type: "boolean";
            readonly description: "Whether the image generation request completed successfully.";
        };
        readonly filePath: {
            readonly type: "string";
            readonly description: "Absolute path to the saved image file.";
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
            readonly description: "Aspect ratio used for the image.";
        };
        readonly model: {
            readonly type: "string";
            readonly description: "Gemini model used for generation.";
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
