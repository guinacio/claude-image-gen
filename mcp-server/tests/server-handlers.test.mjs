import test from "node:test";
import assert from "node:assert/strict";
import { basename } from "node:path";
import {
  CREATE_ASSET_TOOL_CONFIG,
  CREATE_ASSET_TOOL_NAME,
  createToolCallResult,
} from "../build/server-handlers.js";

test("tool config keeps its title, annotations, and strict hand-written schemas", () => {
  assert.equal(CREATE_ASSET_TOOL_NAME, "create_asset");
  assert.equal(CREATE_ASSET_TOOL_CONFIG.title, "Create Asset");
  assert.match(CREATE_ASSET_TOOL_CONFIG.description, /Google Gemini, OpenAI, or Atlas Cloud/);

  assert.deepEqual(CREATE_ASSET_TOOL_CONFIG.annotations, {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  });

  const inputSchema = CREATE_ASSET_TOOL_CONFIG.inputSchema["~standard"].jsonSchema.input();
  const outputSchema = CREATE_ASSET_TOOL_CONFIG.outputSchema["~standard"].jsonSchema.output();

  assert.equal(inputSchema.type, "object");
  assert.equal(inputSchema.additionalProperties, false);
  assert.deepEqual(inputSchema.required, ["prompt"]);
  assert.equal(outputSchema.type, "object");
  assert.equal(outputSchema.additionalProperties, false);
});

test("the registered input schema defers validation to the handler", () => {
  // The SDK pre-validates tools/call arguments against inputSchema; our
  // pass-through validator must accept everything so the zod safeParse in the
  // handler stays the single source of validation errors.
  const validation = CREATE_ASSET_TOOL_CONFIG.inputSchema["~standard"].validate({});

  assert.equal(validation.issues, undefined);
  assert.deepEqual(validation.value, {});
});

test("successful tool results include JSON text fallback and a resource_link", () => {
  const structuredContent = {
    success: true,
    filePath: "C:\\generated-images\\hero.png",
    resourceUri: "file:///C:/generated-images/hero.png",
    mimeType: "image/png",
    prompt: "Hero image",
    aspectRatio: "16:9",
    model: "gemini-test-image",
    outputDirectory: "C:\\generated-images",
  };

  const result = createToolCallResult(structuredContent);

  assert.equal(result.isError, false);
  assert.deepEqual(JSON.parse(result.content[0].text), structuredContent);
  assert.equal(result.content[1].type, "resource_link");
  assert.equal(result.content[1].uri, structuredContent.resourceUri);
  assert.equal(result.content[1].name, basename(structuredContent.filePath));
  assert.equal(result.content[1].mimeType, structuredContent.mimeType);
});

test("error tool results keep the JSON fallback without a resource link", () => {
  const structuredContent = {
    success: false,
    errorCode: "VALIDATION_ERROR",
    error: "Invalid arguments: prompt is required.",
    outputDirectory: "C:\\generated-images",
  };

  const result = createToolCallResult(structuredContent);

  assert.equal(result.isError, true);
  assert.equal(result.content.length, 1);
  assert.deepEqual(JSON.parse(result.content[0].text), structuredContent);
});
