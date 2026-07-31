import type { Logger } from "./runtime.js";
import type { CreateAssetRequest, CreateAssetResponse } from "./types.js";
type ToolContent = {
    type: "text";
    text: string;
} | {
    type: "resource_link";
    uri: string;
    name: string;
    title: string;
    description: string;
    mimeType?: string;
};
export interface MediaPipelineServiceLike {
    createAsset(request: CreateAssetRequest): Promise<CreateAssetResponse>;
    getOutputDirectory(): string;
}
export declare const CREATE_ASSET_TOOL: {
    readonly name: "create_asset";
    readonly description: "Generate an image using Google Gemini AI, save it within the configured output directory, and return the saved file path plus structured metadata.";
    readonly inputSchema: {
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
            readonly model: {
                readonly type: "string";
                readonly description: "Optional Gemini model name for image generation. If omitted, the configured default model is used when available.";
                readonly minLength: 1;
                readonly maxLength: 256;
            };
        };
        readonly required: readonly ["prompt"];
    };
    readonly outputSchema: {
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
    readonly annotations: {
        readonly title: "Create Asset";
        readonly readOnlyHint: false;
        readonly destructiveHint: false;
        readonly idempotentHint: false;
        readonly openWorldHint: true;
    };
    readonly execution: {
        readonly taskSupport: "forbidden";
    };
};
export declare function listTools(): {
    tools: {
        readonly name: "create_asset";
        readonly description: "Generate an image using Google Gemini AI, save it within the configured output directory, and return the saved file path plus structured metadata.";
        readonly inputSchema: {
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
                readonly model: {
                    readonly type: "string";
                    readonly description: "Optional Gemini model name for image generation. If omitted, the configured default model is used when available.";
                    readonly minLength: 1;
                    readonly maxLength: 256;
                };
            };
            readonly required: readonly ["prompt"];
        };
        readonly outputSchema: {
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
        readonly annotations: {
            readonly title: "Create Asset";
            readonly readOnlyHint: false;
            readonly destructiveHint: false;
            readonly idempotentHint: false;
            readonly openWorldHint: true;
        };
        readonly execution: {
            readonly taskSupport: "forbidden";
        };
    }[];
};
export declare function createToolCallResult(result: CreateAssetResponse): {
    isError: boolean;
    structuredContent: CreateAssetResponse;
    content: ToolContent[];
};
export declare function handleCreateAssetToolCall(request: {
    params: {
        name: string;
        arguments?: unknown;
    };
}, dependencies: {
    mediaPipelineService: MediaPipelineServiceLike;
    logger: Logger;
}): Promise<{
    isError: boolean;
    structuredContent: CreateAssetResponse;
    content: ToolContent[];
}>;
export {};
