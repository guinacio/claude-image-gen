#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { MediaPipelineService } from "./media-pipeline-service.js";
import { createAssetArgsSchema, createAssetInputSchema, createAssetOutputSchema, } from "./schemas.js";
import { createLogger, createRuntimeConfig, formatErrorMessage, } from "./runtime.js";
const runtimeConfig = createRuntimeConfig();
const logger = createLogger("server", runtimeConfig.logLevel);
if (!runtimeConfig.apiKey) {
    logger.error("GEMINI_API_KEY environment variable is required");
    process.exit(1);
}
const mediaPipelineService = new MediaPipelineService(runtimeConfig, logger);
function buildToolText(result) {
    if (!result.success) {
        return result.error || "Unknown error";
    }
    const lines = [
        "Image generated successfully!",
        "",
        `File saved to: ${result.filePath}`,
        `Aspect ratio: ${result.aspectRatio}`,
        `Model: ${result.model}`,
    ];
    if (result.warnings && result.warnings.length > 0) {
        lines.push("", `Warnings: ${result.warnings.join(" | ")}`);
    }
    return lines.join("\n");
}
// Create MCP server
const server = new Server({
    name: "media-pipeline",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    const modelContext = await mediaPipelineService.getModelContext();
    return {
        tools: [
            {
                name: "create_asset",
                description: `Generate an image using Google Gemini AI, save it locally, and return the absolute output path. Default model: ${modelContext.defaultModel}`,
                inputSchema: createAssetInputSchema,
                outputSchema: createAssetOutputSchema,
            },
        ],
    };
});
// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "create_asset") {
        try {
            const args = createAssetArgsSchema.parse(request.params.arguments);
            const result = await mediaPipelineService.createAsset(args);
            return {
                isError: !result.success,
                structuredContent: result,
                content: [
                    {
                        type: "text",
                        text: result.success
                            ? buildToolText(result)
                            : `Image generation failed: ${result.error || "Unknown error"}`,
                    },
                ],
            };
        }
        catch (error) {
            const errorMessage = formatErrorMessage(error);
            logger.warn("Tool execution failed", { error: errorMessage });
            const structuredContent = {
                success: false,
                errorCode: "VALIDATION_ERROR",
                error: `Error generating image: ${errorMessage}`,
                outputDirectory: mediaPipelineService.getOutputDirectory(),
            };
            return {
                isError: true,
                structuredContent,
                content: [
                    {
                        type: "text",
                        text: structuredContent.error,
                    },
                ],
            };
        }
    }
    return {
        isError: true,
        structuredContent: {
            success: false,
            errorCode: "UNKNOWN_TOOL",
            error: `Unknown tool: ${request.params.name}`,
            outputDirectory: mediaPipelineService.getOutputDirectory(),
        },
        content: [
            {
                type: "text",
                text: `Unknown tool: ${request.params.name}`,
            },
        ],
    };
});
// Start server
async function main() {
    process.on("uncaughtException", (error) => {
        logger.error("Uncaught exception", { error: formatErrorMessage(error) });
        process.exit(1);
    });
    process.on("unhandledRejection", (reason) => {
        logger.error("Unhandled promise rejection", { error: formatErrorMessage(reason) });
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("Media Pipeline MCP Server started", {
        defaultModel: runtimeConfig.defaultModel,
        outputDirectory: mediaPipelineService.getOutputDirectory(),
        requestTimeoutMs: runtimeConfig.requestTimeoutMs,
    });
}
main().catch((error) => {
    logger.error("Server startup failed", { error: formatErrorMessage(error) });
    process.exit(1);
});
