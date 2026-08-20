import test from "node:test";
import assert from "node:assert/strict";
import { AtlasImageClient, fetchAtlasImageModels } from "../build/atlas-client.js";

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function createClient(fetchImpl, sleep = async () => {}) {
  return new AtlasImageClient(
    {
      apiKey: "atlas-key",
      defaultModel: "google/nano-banana-2-lite/text-to-image-developer",
      requestTimeoutMs: 5_000,
    },
    { fetch: fetchImpl, sleep }
  );
}

test("fetchAtlasImageModels keeps visible text-to-image models", async () => {
  const models = await fetchAtlasImageModels("unused", 5_000, async () =>
    jsonResponse({
      code: 200,
      data: [
        {
          model: "provider/visible/text-to-image",
          type: "Image",
          categories: ["TEXT-TO-IMAGE"],
          display_console: true,
        },
        {
          model: "provider/hidden/text-to-image",
          type: "Image",
          categories: ["TEXT-TO-IMAGE"],
          display_console: false,
        },
        {
          model: "provider/visible/image-to-image",
          type: "Image",
          categories: ["IMAGE-TO-IMAGE"],
          display_console: true,
        },
      ],
    })
  );

  assert.deepEqual(models, ["provider/visible/text-to-image"]);
});

test("generateImage submits once, polls, and downloads the image", async () => {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/generateImage")) {
      return jsonResponse({ code: 200, data: { id: "prediction-1", status: "created" } });
    }
    if (url.endsWith("/prediction/prediction-1")) {
      return jsonResponse({
        code: 200,
        data: { id: "prediction-1", status: "completed", outputs: ["https://cdn.example/image.png"] },
      });
    }
    return new Response(Buffer.from("image-bytes"), {
      status: 200,
      headers: { "content-type": "image/png" },
    });
  };

  const result = await createClient(fetchImpl).generateImage({
    prompt: "a paper crane",
    aspectRatio: "16:9",
    model: "google/nano-banana-2-lite/text-to-image-developer",
  });

  assert.equal(result.success, true, result.error);
  assert.equal(result.base64Data, Buffer.from("image-bytes").toString("base64"));
  assert.equal(result.mimeType, "image/png");
  assert.equal(calls.filter((call) => call.init.method === "POST").length, 1);
  const post = calls[0];
  assert.equal(post.init.headers.Authorization, "Bearer atlas-key");
  assert.equal(post.init.headers["User-Agent"], "media-pipeline-mcp/atlas-provider");
  assert.deepEqual(JSON.parse(post.init.body), {
    model: "google/nano-banana-2-lite/text-to-image-developer",
    prompt: "a paper crane",
    aspect_ratio: "16:9",
    thinking_level: "default",
    resolution: "1k",
    enable_sync_mode: false,
    enable_base64_output: false,
  });
});

test("generateImage retries only transient prediction GET requests", async () => {
  let predictionCalls = 0;
  const delays = [];
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    if (init.method === "POST") {
      return jsonResponse({ code: 200, data: { id: "prediction-2", status: "created" } });
    }
    if (url.includes("/prediction/")) {
      predictionCalls += 1;
      if (predictionCalls === 1) {
        return jsonResponse({ message: "busy" }, { status: 503 });
      }
      return jsonResponse({
        code: 200,
        data: { id: "prediction-2", status: "completed", outputs: ["https://cdn.example/image.png"] },
      });
    }
    return new Response(Buffer.from("image"), { status: 200, headers: { "content-type": "image/png" } });
  };

  const result = await createClient(fetchImpl, async (delay) => delays.push(delay)).generateImage({
    prompt: "a lighthouse",
  });

  assert.equal(result.success, true, result.error);
  assert.equal(predictionCalls, 2);
  assert.deepEqual(delays, [1_000]);
});

test("generateImage never retries the generation POST", async () => {
  let postCalls = 0;
  const result = await createClient(async (_input, init = {}) => {
    if (init.method === "POST") postCalls += 1;
    return jsonResponse({ message: "service unavailable" }, { status: 503 });
  }).generateImage({ prompt: "a lighthouse" });

  assert.equal(result.success, false);
  assert.equal(result.errorCode, "ATLAS_API_ERROR");
  assert.equal(postCalls, 1);
});

test("generateImage rejects unsupported Atlas options before network access", async () => {
  let calls = 0;
  const result = await createClient(async () => {
    calls += 1;
    throw new Error("network must not be called");
  }).generateImage({
    prompt: "edit this image",
    referenceImages: [{ filePath: "/tmp/ref.png", base64Data: "AA==", mimeType: "image/png" }],
  });

  assert.equal(result.success, false);
  assert.equal(result.errorCode, "UNSUPPORTED_BY_PROVIDER");
  assert.equal(calls, 0);
});
