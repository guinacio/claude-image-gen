#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { GeminiImageClient } from "./gemini-client.js";
import { ImageStorage } from "./image-storage.js";
import type { GeminiModel } from "./types.js";

// Configuration from environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = (process.env.GEMINI_DEFAULT_MODEL ||
  "gemini-3-pro-image-preview") as GeminiModel;
const OUTPUT_DIR = process.env.IMAGE_OUTPUT_DIR || "./generated-images";

if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable is required");
  process.exit(1);
}

// Initialize services
const geminiClient = new GeminiImageClient({
  apiKey: GEMINI_API_KEY,
  defaultModel: DEFAULT_MODEL,
  outputDirectory: OUTPUT_DIR,
});

const imageStorage = new ImageStorage(OUTPUT_DIR);

// Input schema for validation
const generateImageSchema = z.object({
  prompt: z.string().describe("Detailed description of the image to generate"),
  outputPath: z
    .string()
    .optional()
    .describe("Custom output file path (optional)"),
  aspectRatio: z
    .enum(["1:1", "2:3", "3:2", "3:4", "4:3", "16:9", "9:16"])
    .optional()
    .describe("Image aspect ratio (default: 1:1)"),
  model: z
    .enum(["gemini-3-pro-image-preview", "gemini-2.5-flash-image"])
    .optional()
    .describe("Model to use for generation"),
});

// Create MCP server
const server = new Server(
  {
    name: "media-pipeline",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_asset",
        description: `Generate an image using Google Gemini AI. Provide a detailed prompt describing the desired image. The image will be saved to disk and the file path returned. Default model: ${DEFAULT_MODEL}`,
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Detailed description of the image to generate. Be specific about style, composition, colors, subject matter, and atmosphere for best results.",
            },
            outputPath: {
              type: "string",
              description:
                "Optional custom file path for the output. If not provided, a unique filename will be generated in the output directory.",
            },
            aspectRatio: {
              type: "string",
              enum: ["1:1", "2:3", "3:2", "3:4", "4:3", "16:9", "9:16"],
              description:
                "Aspect ratio for the generated image. Use 16:9 for hero images/headers, 1:1 for thumbnails/social, 9:16 for mobile/stories. Default: 1:1",
            },
            model: {
              type: "string",
              enum: ["gemini-3-pro-image-preview", "gemini-2.5-flash-image"],
              description:
                "Model to use. gemini-3-pro-image-preview for higher quality, gemini-2.5-flash-image for faster generation.",
            },
          },
          required: ["prompt"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "create_asset") {
    try {
      const args = generateImageSchema.parse(request.params.arguments);

      // Generate image using Gemini
      const result = await geminiClient.generateImage({
        prompt: args.prompt,
        aspectRatio: args.aspectRatio,
        model: args.model,
      });

      if (!result.success || !result.base64Data) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Image generation failed: ${result.error || "Unknown error"}`,
            },
          ],
        };
      }

      // Save image to disk
      const saveResult = imageStorage.saveImage(
        result.base64Data,
        args.outputPath,
        result.mimeType
      );

      if (!saveResult.success || !saveResult.filePath) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Failed to save image: ${saveResult.error || "Unknown error"}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Image generated successfully!\n\nFile saved to: ${saveResult.filePath}\n\nPrompt: "${args.prompt}"\nAspect ratio: ${args.aspectRatio || "1:1"}\nModel: ${args.model || DEFAULT_MODEL}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error generating image: ${errorMessage}`,
          },
        ],
      };
    }
  }

  return {
    isError: true,
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Media Pipeline MCP Server started");
  console.error(`Default model: ${DEFAULT_MODEL}`);
  console.error(`Output directory: ${imageStorage.getOutputDirectory()}`);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
