import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MediaPipelineService } from "../build/media-pipeline-service.js";
import { createRuntimeConfig } from "../build/runtime.js";

const PNG_BASE64 = Buffer.from("fake-png-bytes").toString("base64");

function createTempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "media-pipeline-service-test-"));
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
