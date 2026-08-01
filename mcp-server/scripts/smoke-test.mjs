import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const serverEntryPoint = path.join(rootDir, "build", "bundle.js");

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverEntryPoint],
  env: {
    ...process.env,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "smoke-test-api-key",
    GEMINI_REQUEST_TIMEOUT_MS: process.env.GEMINI_REQUEST_TIMEOUT_MS || "2000",
    IMAGE_OUTPUT_DIR:
      process.env.IMAGE_OUTPUT_DIR || path.join(rootDir, "generated-images-smoke"),
    MEDIA_PIPELINE_LOG_LEVEL: process.env.MEDIA_PIPELINE_LOG_LEVEL || "error",
  },
});

const client = new Client({
  name: "media-pipeline-smoke-test",
  version: "1.1.2",
});

try {
  await client.connect(transport);

  const toolList = await client.listTools();
  const createAssetTool = toolList.tools.find((tool) => tool.name === "create_asset");

  assert.ok(createAssetTool, "create_asset tool should be listed");
  assert.equal(createAssetTool.inputSchema.type, "object");
  assert.equal(createAssetTool.outputSchema?.type, "object");
  assert.equal(createAssetTool.outputSchema?.properties?.success?.type, "boolean");

  const invalidModelResult = await client.callTool({
    name: "create_asset",
    arguments: {
      prompt: "Smoke test prompt",
      model: "definitely-not-a-valid-model",
    },
  });

  assert.equal(invalidModelResult.isError, true, "invalid model should return an error result");
  assert.equal(invalidModelResult.structuredContent?.success, false);
  assert.equal(invalidModelResult.structuredContent?.errorCode, "INVALID_MODEL");

  const firstContent = invalidModelResult.content?.[0];
  assert.equal(firstContent?.type, "text");
  assert.match(firstContent?.text || "", /Invalid model:/);

  console.log("Smoke test passed.");
} finally {
  await client.close();
}
