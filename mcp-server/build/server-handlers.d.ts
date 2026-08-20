import type { McpServer } from "@modelcontextprotocol/server";
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
export interface CreateAssetToolDependencies {
    mediaPipelineService: MediaPipelineServiceLike;
    logger: Logger;
}
export declare const CREATE_ASSET_TOOL_NAME = "create_asset";
export declare const CREATE_ASSET_TOOL_CONFIG: {
    readonly title: "Create Asset";
    readonly description: "Generate an image with Google Gemini, OpenAI, or Atlas Cloud, save it within the configured output directory, and return the saved file path plus structured metadata. The model name selects the provider: gpt-image*/dall-e* models route to OpenAI, namespaced provider/model IDs route to Atlas Cloud, and all others route to Gemini.";
    readonly inputSchema: import("@modelcontextprotocol/server").StandardSchemaWithJSON<unknown, unknown>;
    readonly outputSchema: import("@modelcontextprotocol/server").StandardSchemaWithJSON<CreateAssetResponse, CreateAssetResponse>;
    readonly annotations: {
        readonly readOnlyHint: false;
        readonly destructiveHint: false;
        readonly idempotentHint: false;
        readonly openWorldHint: true;
    };
};
export declare function createToolCallResult(result: CreateAssetResponse): {
    isError: boolean;
    structuredContent: CreateAssetResponse;
    content: ToolContent[];
};
export declare function registerCreateAssetTool(server: McpServer, dependencies: CreateAssetToolDependencies): import("@modelcontextprotocol/server").RegisteredTool;
export declare function handleCreateAssetToolCall(args: unknown, dependencies: CreateAssetToolDependencies): Promise<{
    isError: boolean;
    structuredContent: CreateAssetResponse;
    content: ToolContent[];
}>;
export {};
