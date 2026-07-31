import path from "node:path";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { createAssetArgsSchema, createAssetInputSchema, createAssetOutputSchema, } from "./schemas.js";
import { formatErrorMessage } from "./runtime.js";
export const CREATE_ASSET_TOOL = {
    name: "create_asset",
    description: "Generate an image using Google Gemini AI, save it within the configured output directory, and return the saved file path plus structured metadata.",
    inputSchema: createAssetInputSchema,
    outputSchema: createAssetOutputSchema,
    annotations: {
        title: "Create Asset",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
    },
    execution: {
        taskSupport: "forbidden",
    },
};
export function listTools() {
    return {
        tools: [CREATE_ASSET_TOOL],
    };
}
export function createToolCallResult(result) {
    return {
        isError: !result.success,
        structuredContent: result,
        content: buildToolContent(result),
    };
}
export async function handleCreateAssetToolCall(request, dependencies) {
    if (request.params.name !== CREATE_ASSET_TOOL.name) {
        throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${request.params.name}`);
    }
    const parsedArgs = createAssetArgsSchema.safeParse(request.params.arguments ?? {});
    if (!parsedArgs.success) {
        return createToolCallResult(createValidationErrorResponse(parsedArgs.error, dependencies.mediaPipelineService.getOutputDirectory()));
    }
    try {
        const result = await dependencies.mediaPipelineService.createAsset(parsedArgs.data);
        return createToolCallResult(result);
    }
    catch (error) {
        const errorMessage = formatErrorMessage(error);
        dependencies.logger.error("Tool execution failed", { error: errorMessage });
        return createToolCallResult({
            success: false,
            errorCode: "INTERNAL_ERROR",
            error: "Image generation failed due to an internal server error.",
            outputDirectory: dependencies.mediaPipelineService.getOutputDirectory(),
        });
    }
}
function buildToolContent(result) {
    const content = [
        {
            type: "text",
            text: JSON.stringify(result, null, 2),
        },
    ];
    if (result.success && result.resourceUri && result.filePath) {
        content.push({
            type: "resource_link",
            uri: result.resourceUri,
            name: path.basename(result.filePath),
            title: "Generated image",
            description: "Generated image saved to the configured output directory.",
            mimeType: result.mimeType,
        });
    }
    return content;
}
function createValidationErrorResponse(error, outputDirectory) {
    return {
        success: false,
        errorCode: "VALIDATION_ERROR",
        error: formatValidationError(error),
        outputDirectory,
    };
}
function formatValidationError(error) {
    const issue = error.issues[0];
    if (!issue) {
        return "Invalid arguments for create_asset.";
    }
    if (issue.code === "unrecognized_keys") {
        return "Invalid arguments: unexpected fields were provided.";
    }
    const field = issue.path.join(".");
    const fieldLabel = field ? `${field} ` : "";
    const detail = issue.message === "Required" ? "is required." : `${issue.message}.`;
    return `Invalid arguments: ${fieldLabel}${detail}`;
}
