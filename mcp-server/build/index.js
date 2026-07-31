#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { MediaPipelineService } from "./media-pipeline-service.js";
import { createLogger, createRuntimeConfig, formatErrorMessage, } from "./runtime.js";
import { handleCreateAssetToolCall, listTools, } from "./server-handlers.js";
const runtimeConfig = createRuntimeConfig();
const logger = createLogger("server", runtimeConfig.logLevel);
if (!runtimeConfig.apiKey) {
    logger.error("GEMINI_API_KEY environment variable is required");
    process.exit(1);
}
const mediaPipelineService = new MediaPipelineService(runtimeConfig, logger);
// Create MCP server
const server = new Server({
    name: "media-pipeline",
    version: "1.0.2",
}, {
    capabilities: {
        tools: {},
    },
});
// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return listTools();
});
// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handleCreateAssetToolCall(request, {
        mediaPipelineService,
        logger,
    });
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
