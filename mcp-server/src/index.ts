#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { MediaPipelineService } from "./media-pipeline-service.js";
import {
  createLogger,
  createRuntimeConfig,
  formatErrorMessage,
  hasAnyApiKey,
} from "./runtime.js";
import { registerCreateAssetTool } from "./server-handlers.js";

const runtimeConfig = createRuntimeConfig();
const logger = createLogger("server", runtimeConfig.logLevel);

if (!hasAnyApiKey(runtimeConfig)) {
  logger.error(
    "At least one provider API key is required: set GEMINI_API_KEY and/or OPENAI_API_KEY"
  );
  process.exit(1);
}

const mediaPipelineService = new MediaPipelineService(runtimeConfig, logger);

/**
 * Builds one MCP server instance. `serveStdio` calls this once per
 * connection, after the opening exchange has selected the protocol era, so
 * the same registrations serve both modern (2026-07-28) and legacy
 * (2025-era) clients such as Claude Code / Claude Desktop.
 */
function createServer(): McpServer {
  const server = new McpServer(
    {
      name: "media-pipeline",
      version: "1.1.2",
    },
    {
      capabilities: {
        tools: {},
      },
      cacheHints: {
        "tools/list": {
          ttlMs: 300000,
          cacheScope: "public",
        },
      },
    }
  );

  registerCreateAssetTool(server, {
    mediaPipelineService,
    logger,
  });

  return server;
}

// Start server
function main() {
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", { error: formatErrorMessage(error) });
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", { error: formatErrorMessage(reason) });
  });

  const handle = serveStdio(createServer, {
    onerror: (error) => {
      logger.error("Transport error", { error: formatErrorMessage(error) });
    },
  });

  process.on("SIGINT", () => {
    void handle
      .close()
      .catch((error) => {
        logger.error("Server shutdown failed", { error: formatErrorMessage(error) });
      })
      .finally(() => {
        process.exit(0);
      });
  });

  logger.info("Media Pipeline MCP Server started", {
    defaultProvider: runtimeConfig.defaultProvider,
    geminiDefaultModel: runtimeConfig.geminiDefaultModel,
    openaiDefaultModel: runtimeConfig.openaiDefaultModel,
    outputDirectory: mediaPipelineService.getOutputDirectory(),
    requestTimeoutMs: runtimeConfig.requestTimeoutMs,
  });
}

try {
  main();
} catch (error) {
  logger.error("Server startup failed", { error: formatErrorMessage(error) });
  process.exit(1);
}
