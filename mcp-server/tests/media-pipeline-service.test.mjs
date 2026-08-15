import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MediaPipelineService } from "../build/media-pipeline-service.js";
import { createRuntimeConfig } from "../build/runtime.js";

const PNG_BASE64 = Buffer.from("fake-png-bytes").toString("base64");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function createPngChunk(type, data) {
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length, 0);
  // The mask check does not verify CRCs, so a zeroed placeholder is enough.
  return Buffer.concat([header, Buffer.from(type, "ascii"), data, Buffer.alloc(4)]);
}

// Colour type 6 is truecolour + alpha, 2 is truecolour without one.
function createPngBytes(colorType, { transparencyChunk = false } = {}) {
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0); // width
  ihdrData.writeUInt32BE(1, 4); // height
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(colorType, 9);

  return Buffer.concat([
    PNG_SIGNATURE,
    createPngChunk("IHDR", ihdrData),
    ...(transparencyChunk ? [createPngChunk("tRNS", Buffer.from([0x00]))] : []),
    createPngChunk("IDAT", Buffer.from("fake-pixels")),
    createPngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createTempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "media-pipeline-service-test-"));
}

function writeFile(directory, name, contents) {
  const filePath = path.join(directory, name);
  fs.writeFileSync(filePath, contents);
  return filePath;
}

function removeDirectory(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

function createSilentLogger() {
  return {
    error() {},
    warn() {},
    info() {},
    debug() {},
  };
}

function createFakeClient(result) {
  const calls = [];
  return {
    calls,
    async generateImage(input) {
      calls.push(input);
      return (
        result ?? {
          success: true,
          base64Data: PNG_BASE64,
          mimeType: "image/png",
        }
      );
    },
  };
}

function createService(outputDirectory, env, overrides) {
  const config = createRuntimeConfig({
    IMAGE_OUTPUT_DIR: outputDirectory,
    MEDIA_PIPELINE_LOG_LEVEL: "error",
    ...env,
  });

  return new MediaPipelineService(config, createSilentLogger(), 60_000, overrides);
}

test("createAsset routes Gemini models to the Gemini client", async () => {
  const outputDirectory = createTempDirectory();
  const geminiClient = createFakeClient();
  const openaiClient = createFakeClient();

  try {
    const service = createService(
      outputDirectory,
      { GEMINI_API_KEY: "gemini-key", OPENAI_API_KEY: "openai-key" },
      {
        clients: { gemini: geminiClient, openai: openaiClient },
        fetchGeminiModels: async () => ["gemini-3-pro-image-preview"],
        fetchOpenAIModels: async () => ["gpt-image-2"],
      }
    );

    const response = await service.createAsset({
      prompt: "a friendly robot",
      model: "gemini-3-pro-image-preview",
    });

    assert.equal(response.success, true, response.error);
    assert.equal(response.model, "gemini-3-pro-image-preview");
    assert.equal(geminiClient.calls.length, 1);
    assert.equal(openaiClient.calls.length, 0);
    assert.equal(geminiClient.calls[0].model, "gemini-3-pro-image-preview");
    assert.ok(fs.existsSync(response.filePath));
  } finally {
    removeDirectory(outputDirectory);
  }
});

test("createAsset routes OpenAI models to the OpenAI client", async () => {
  const outputDirectory = createTempDirectory();
  const geminiClient = createFakeClient();
  const openaiClient = createFakeClient();

  try {
    const service = createService(
      outputDirectory,
      { GEMINI_API_KEY: "gemini-key", OPENAI_API_KEY: "openai-key" },
      {
        clients: { gemini: geminiClient, openai: openaiClient },
        fetchGeminiModels: async () => ["gemini-3-pro-image-preview"],
        fetchOpenAIModels: async () => ["gpt-image-2"],
      }
    );

    const response = await service.createAsset({
      prompt: "a friendly robot",
      model: "gpt-image-2",
      aspectRatio: "1:1",
    });

    assert.equal(response.success, true, response.error);
    assert.equal(response.model, "gpt-image-2");
    assert.equal(openaiClient.calls.length, 1);
    assert.equal(geminiClient.calls.length, 0);
    assert.equal(openaiClient.calls[0].model, "gpt-image-2");
    assert.ok(fs.existsSync(response.filePath));
  } finally {
    removeDirectory(outputDirectory);
  }
});

test("createAsset merges both providers into the available model list", async () => {
  const outputDirectory = createTempDirectory();

  try {
    const service = createService(
      outputDirectory,
      { GEMINI_API_KEY: "gemini-key", OPENAI_API_KEY: "openai-key" },
      {
        clients: { gemini: createFakeClient(), openai: createFakeClient() },
        fetchGeminiModels: async () => ["gemini-3-pro-image-preview"],
        fetchOpenAIModels: async () => ["gpt-image-2"],
      }
    );

    const modelContext = await service.getModelContext();

    assert.deepEqual(modelContext.availableModels, [
      "gemini-3-pro-image-preview",
      "gpt-image-2",
    ]);
    assert.equal(modelContext.defaultModel, "gemini-3-pro-image-preview");
    assert.deepEqual(modelContext.warnings, []);
  } finally {
    removeDirectory(outputDirectory);
  }
});

test("createAsset reports PROVIDER_NOT_CONFIGURED when the OpenAI key is missing", async () => {
  const outputDirectory = createTempDirectory();
  const geminiClient = createFakeClient();

  try {
    const service = createService(
      outputDirectory,
      { GEMINI_API_KEY: "gemini-key", IMAGE_PROVIDER: "openai" },
      {
        clients: { gemini: geminiClient },
        fetchGeminiModels: async () => ["gemini-3-pro-image-preview"],
        fetchOpenAIModels: async () => {
          throw new Error("OpenAI discovery must not run without a key");
        },
      }
    );

    const response = await service.createAsset({ prompt: "a friendly robot" });

    assert.equal(response.success, false);
    assert.equal(response.errorCode, "PROVIDER_NOT_CONFIGURED");
    assert.equal(
      response.error,
      "Model gpt-image-2 requires openai but OPENAI_API_KEY is not set."
    );
    assert.equal(response.model, "gpt-image-2");
    assert.equal(response.outputDirectory, service.getOutputDirectory());
    assert.equal(geminiClient.calls.length, 0);
  } finally {
    removeDirectory(outputDirectory);
  }
});

test("createAsset surfaces provider client warnings in the response", async () => {
  const outputDirectory = createTempDirectory();
  const aspectWarning =
    "Aspect ratio 16:9 is not supported by OpenAI image models; generated at 3:2 (1536x1024) instead.";
  const openaiClient = createFakeClient({
    success: true,
    base64Data: PNG_BASE64,
    mimeType: "image/png",
    warnings: [aspectWarning],
  });

  try {
    const service = createService(
      outputDirectory,
      { OPENAI_API_KEY: "openai-key" },
      {
        clients: { openai: openaiClient },
        fetchOpenAIModels: async () => ["gpt-image-2"],
        fetchGeminiModels: async () => {
          throw new Error("Gemini discovery must not run without a key");
        },
      }
    );

    const response = await service.createAsset({
      prompt: "a wide landscape",
      model: "gpt-image-2",
      aspectRatio: "16:9",
    });

    assert.equal(response.success, true, response.error);
    assert.ok(response.warnings, "expected warnings on the response");
    assert.ok(response.warnings.includes(aspectWarning));
  } finally {
    removeDirectory(outputDirectory);
  }
});

test("createAsset still rejects unknown models across both providers", async () => {
  const outputDirectory = createTempDirectory();

  try {
    const service = createService(
      outputDirectory,
      { GEMINI_API_KEY: "gemini-key", OPENAI_API_KEY: "openai-key" },
      {
        clients: { gemini: createFakeClient(), openai: createFakeClient() },
        fetchGeminiModels: async () => ["gemini-3-pro-image-preview"],
        fetchOpenAIModels: async () => ["gpt-image-2"],
      }
    );

    const response = await service.createAsset({
      prompt: "a friendly robot",
      model: "not-a-real-model",
    });

    assert.equal(response.success, false);
    assert.equal(response.errorCode, "INVALID_MODEL");
    assert.match(response.error, /gemini-3-pro-image-preview, gpt-image-2/);
  } finally {
    removeDirectory(outputDirectory);
  }
});

function createMaskService(outputDirectory, openaiClient) {
  return createService(
    outputDirectory,
    { OPENAI_API_KEY: "openai-key" },
    {
      clients: { openai: openaiClient },
      fetchOpenAIModels: async () => ["gpt-image-2"],
      fetchGeminiModels: async () => {
        throw new Error("Gemini discovery must not run without a key");
      },
    }
  );
}

test("createAsset forwards a mask with an alpha channel to the client", async () => {
  const outputDirectory = createTempDirectory();
  const openaiClient = createFakeClient();

  try {
    const basePath = writeFile(outputDirectory, "base.png", createPngBytes(6));
    const maskPath = writeFile(outputDirectory, "mask.png", createPngBytes(6));

    const response = await createMaskService(outputDirectory, openaiClient).createAsset({
      prompt: "repaint the sky",
      model: "gpt-image-2",
      referenceImages: [basePath],
      mask: maskPath,
    });

    assert.equal(response.success, true, response.error);
    assert.equal(openaiClient.calls.length, 1);
    assert.equal(openaiClient.calls[0].mask.filePath, path.resolve(maskPath));
    assert.equal(openaiClient.calls[0].mask.mimeType, "image/png");
  } finally {
    removeDirectory(outputDirectory);
  }
});

test("createAsset rejects a mask that is not a PNG", async () => {
  const outputDirectory = createTempDirectory();
  const openaiClient = createFakeClient();

  try {
    const basePath = writeFile(outputDirectory, "base.png", createPngBytes(6));
    // JPEG content behind a .png name: the extension passes, the sniffed type does not.
    const maskPath = writeFile(
      outputDirectory,
      "mask.png",
      Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("body")])
    );

    const response = await createMaskService(outputDirectory, openaiClient).createAsset({
      prompt: "repaint the sky",
      model: "gpt-image-2",
      referenceImages: [basePath],
      mask: maskPath,
    });

    assert.equal(response.success, false);
    assert.equal(response.errorCode, "MASK_UNSUPPORTED_TYPE");
    assert.equal(openaiClient.calls.length, 0);
  } finally {
    removeDirectory(outputDirectory);
  }
});

test("createAsset warns but still sends a mask whose transparency comes from tRNS", async () => {
  const outputDirectory = createTempDirectory();
  const openaiClient = createFakeClient();

  try {
    const basePath = writeFile(outputDirectory, "base.png", createPngBytes(6));
    const maskPath = writeFile(
      outputDirectory,
      "mask.png",
      createPngBytes(3, { transparencyChunk: true })
    );

    const response = await createMaskService(outputDirectory, openaiClient).createAsset({
      prompt: "repaint the sky",
      model: "gpt-image-2",
      referenceImages: [basePath],
      mask: maskPath,
    });

    assert.equal(response.success, true, response.error);
    assert.equal(openaiClient.calls.length, 1, "the API still gets to decide");
    assert.ok(
      response.warnings.some((warning) => warning.includes("tRNS")),
      "expected a warning naming the tRNS chunk"
    );
  } finally {
    removeDirectory(outputDirectory);
  }
});

test("createAsset rejects a fully opaque PNG mask", async () => {
  const outputDirectory = createTempDirectory();
  const openaiClient = createFakeClient();

  try {
    const basePath = writeFile(outputDirectory, "base.png", createPngBytes(6));
    const maskPath = writeFile(outputDirectory, "mask.png", createPngBytes(2));

    const response = await createMaskService(outputDirectory, openaiClient).createAsset({
      prompt: "repaint the sky",
      model: "gpt-image-2",
      referenceImages: [basePath],
      mask: maskPath,
    });

    assert.equal(response.success, false);
    assert.equal(response.errorCode, "MASK_WITHOUT_ALPHA_CHANNEL");
    assert.match(response.error, /fully opaque/);
    assert.equal(openaiClient.calls.length, 0, "no paid round trip is attempted");
  } finally {
    removeDirectory(outputDirectory);
  }
});

test("createAsset reports a missing mask file through the reference image loader", async () => {
  const outputDirectory = createTempDirectory();
  const openaiClient = createFakeClient();

  try {
    const basePath = writeFile(outputDirectory, "base.png", createPngBytes(6));

    const response = await createMaskService(outputDirectory, openaiClient).createAsset({
      prompt: "repaint the sky",
      model: "gpt-image-2",
      referenceImages: [basePath],
      mask: path.join(outputDirectory, "absent.png"),
    });

    assert.equal(response.success, false);
    assert.equal(response.errorCode, "REFERENCE_IMAGE_NOT_FOUND");
    assert.equal(openaiClient.calls.length, 0);
  } finally {
    removeDirectory(outputDirectory);
  }
});
