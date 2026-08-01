import path from "node:path";
import { fromJsonSchema } from "@modelcontextprotocol/server";
import type {
  JsonSchemaType,
  JsonSchemaValidator,
  McpServer,
  jsonSchemaValidator,
} from "@modelcontextprotocol/server";
import { ZodError } from "zod";
import {
  createAssetArgsSchema,
  createAssetInputSchema,
  createAssetOutputSchema,
} from "./schemas.js";
import { formatErrorMessage } from "./runtime.js";
import type { Logger } from "./runtime.js";
import type {
  CreateAssetRequest,
  CreateAssetResponse,
} from "./types.js";

type ToolContent =
  | { type: "text"; text: string }
  | {
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

/**
 * Pass-through JSON Schema validator provider.
 *
 * The SDK validates `tools/call` arguments against the registered
 * `inputSchema` before the handler runs and answers a protocol error
 * (`-32602`) on failure. This server's contract is different: every
 * argument problem must come back as a sanitized `isError` tool result with
 * a stable `errorCode`, produced by the single zod `safeParse` inside the
 * handler. Handing `fromJsonSchema` a validator that accepts everything
 * keeps our hand-written JSON Schemas on the wire (`tools/list` still
 * advertises `additionalProperties: false`, `required`, lengths, enums)
 * while leaving validation authority with the handler.
 */
const passThroughJsonSchemaValidator: jsonSchemaValidator = {
  getValidator<T>(): JsonSchemaValidator<T> {
    return (input: unknown) => ({
      valid: true,
      data: input as T,
      errorMessage: undefined,
    });
  },
};

export const CREATE_ASSET_TOOL_NAME = "create_asset";

export const CREATE_ASSET_TOOL_CONFIG = {
  title: "Create Asset",
  description:
    "Generate an image using Google Gemini AI, save it within the configured output directory, and return the saved file path plus structured metadata.",
  inputSchema: fromJsonSchema<unknown>(
    createAssetInputSchema as unknown as JsonSchemaType,
    passThroughJsonSchemaValidator
  ),
  outputSchema: fromJsonSchema<CreateAssetResponse>(
    createAssetOutputSchema as unknown as JsonSchemaType,
    passThroughJsonSchemaValidator
  ),
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
} as const;

export function createToolCallResult(result: CreateAssetResponse) {
  return {
    isError: !result.success,
    structuredContent: result,
    content: buildToolContent(result),
  };
}

export function registerCreateAssetTool(
  server: McpServer,
  dependencies: CreateAssetToolDependencies
) {
  return server.registerTool(
    CREATE_ASSET_TOOL_NAME,
    CREATE_ASSET_TOOL_CONFIG,
    async (args: unknown) => handleCreateAssetToolCall(args, dependencies)
  );
}

export async function handleCreateAssetToolCall(
  args: unknown,
  dependencies: CreateAssetToolDependencies
) {
  const parsedArgs = createAssetArgsSchema.safeParse(args ?? {});

  if (!parsedArgs.success) {
    return createToolCallResult(
      createValidationErrorResponse(
        parsedArgs.error,
        dependencies.mediaPipelineService.getOutputDirectory()
      )
    );
  }

  try {
    const result = await dependencies.mediaPipelineService.createAsset(parsedArgs.data);
    return createToolCallResult(result);
  } catch (error) {
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

function buildToolContent(result: CreateAssetResponse): ToolContent[] {
  const content: ToolContent[] = [
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

function createValidationErrorResponse(
  error: ZodError,
  outputDirectory: string
): CreateAssetResponse {
  return {
    success: false,
    errorCode: "VALIDATION_ERROR",
    error: formatValidationError(error),
    outputDirectory,
  };
}

function formatValidationError(error: ZodError): string {
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
