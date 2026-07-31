import test from "node:test";
import assert from "node:assert/strict";
import { basename } from "node:path";
import {
  CREATE_ASSET_TOOL,
  createToolCallResult,
  listTools,
} from "../build/server-handlers.js";

test("tools/list metadata stays static and strict", () => {
  const toolList = listTools();

  assert.equal(toolList.tools.length, 1);
  assert.deepEqual(toolList.tools[0], CREATE_ASSET_TOOL);
  assert.equal(toolList.tools[0].inputSchema.additionalProperties, false);
  assert.equal(toolList.tools[0].outputSchema.additionalProperties, false);
  assert.equal(toolList.tools[0].execution.taskSupport, "forbidden");
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
