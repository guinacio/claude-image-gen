import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

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

  const client = new Client(
    {
      name: "media-pipeline-protocol-v2-test",
      version: "1.1.0",
    },
    {
      // The v2 client defaults to the legacy handshake; pin the modern
      // revision so this suite exercises the 2026-07-28 wire (the legacy
      // path is covered by tests/protocol.test.mjs with the v1 client).
      versionNegotiation: { mode: { pin: "2026-07-28" } },
    }
  );

  return { client, transport };
}

test("v2: tools/list returns static metadata plus the configured cache hints", async () => {
  const { client, transport } = createClient();

  try {
    await client.connect(transport);
    const toolList = await client.listTools();

    assert.equal(toolList.tools.length, 1);
    assert.equal(toolList.tools[0].name, "create_asset");
    assert.equal(toolList.tools[0].title, "Create Asset");
    assert.equal(toolList.tools[0].inputSchema.additionalProperties, false);
    assert.equal(toolList.tools[0].outputSchema.additionalProperties, false);
    assert.equal(toolList.tools[0].execution, undefined);

    // ServerOptions.cacheHints['tools/list'] is emitted on the 2026-07-28 wire.
    assert.equal(toolList.ttlMs, 300000);
    assert.equal(toolList.cacheScope, "public");

    // `resultType` is not asserted: the v2 client's wire codec consumes the
    // discriminator while lifting the result, so it never reaches callers.
  } finally {
    await client.close();
  }
});

test("v2: unknown tools are surfaced as protocol errors", async () => {
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
        assert.match(error.message, /Tool unknown_tool not found/);
        return true;
      }
    );
  } finally {
    await client.close();
  }
});

test("v2: validation failures return sanitized JSON tool results", async () => {
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
