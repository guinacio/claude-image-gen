import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function createClient() {
  const serverEntryPoint = path.join(process.cwd(), "build", "index.js");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntryPoint],
    env: {
      ...process.env,
      GEMINI_API_KEY: "non-network-test-key",
      MEDIA_PIPELINE_LOG_LEVEL: "error",
    },
  });

  const client = new Client({
    name: "media-pipeline-protocol-test",
    version: "1.0.2",
  });

  return { client, transport };
}

test("tools/list succeeds without model discovery and returns static metadata", async () => {
  const { client, transport } = createClient();

  try {
    await client.connect(transport);
    const toolList = await client.listTools();

    assert.equal(toolList.tools.length, 1);
    assert.equal(toolList.tools[0].name, "create_asset");
    assert.equal(toolList.tools[0].inputSchema.additionalProperties, false);
  } finally {
    await client.close();
  }
});

test("unknown tools are surfaced as protocol errors", async () => {
  const { client, transport } = createClient();

  try {
    await client.connect(transport);

    await assert.rejects(
      client.callTool({
        name: "unknown_tool",
        arguments: {},
      }),
      (error) => {
        assert.equal(error.code, -32602);
        assert.match(error.message, /Unknown tool: unknown_tool/);
        return true;
      }
    );
  } finally {
    await client.close();
  }
});

test("validation failures return sanitized JSON tool results", async () => {
  const { client, transport } = createClient();

  try {
    await client.connect(transport);

    const result = await client.callTool({
      name: "create_asset",
      arguments: {},
    });

    assert.equal(result.isError, true);
    assert.equal(result.content[0].type, "text");
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    assert.equal(result.structuredContent.errorCode, "VALIDATION_ERROR");
    assert.equal(result.structuredContent.error, "Invalid arguments: prompt is required.");
  } finally {
    await client.close();
  }
});
