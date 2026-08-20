import test from "node:test";
import assert from "node:assert/strict";
import {
  getApiKeyEnvVarForProvider,
  getDefaultModelForProvider,
  resolveProviderForModel,
} from "../build/provider.js";
import { createRuntimeConfig, parseImageProvider } from "../build/runtime.js";

test("resolveProviderForModel routes OpenAI model families to openai", () => {
  assert.equal(resolveProviderForModel("gpt-image-2"), "openai");
  assert.equal(resolveProviderForModel("gpt-image-1-mini"), "openai");
  assert.equal(resolveProviderForModel("dall-e-3"), "openai");
  assert.equal(resolveProviderForModel("  GPT-Image-2  "), "openai");
  assert.equal(resolveProviderForModel("DALL-E-2"), "openai");
});

test("resolveProviderForModel defaults everything else to gemini", () => {
  assert.equal(resolveProviderForModel("gemini-3-pro-image-preview"), "gemini");
  assert.equal(resolveProviderForModel("gemini-2.5-flash-image"), "gemini");
  assert.equal(resolveProviderForModel(" Gemini-3-Pro-Image-Preview "), "gemini");
  assert.equal(resolveProviderForModel("some-unknown-model"), "gemini");
});

test("resolveProviderForModel routes namespaced models to Atlas Cloud", () => {
  assert.equal(resolveProviderForModel("google/nano-banana-2-lite/text-to-image-developer"), "atlas");
  assert.equal(resolveProviderForModel(" Provider/Model "), "atlas");
});

test("getApiKeyEnvVarForProvider names the provider env var", () => {
  assert.equal(getApiKeyEnvVarForProvider("openai"), "OPENAI_API_KEY");
  assert.equal(getApiKeyEnvVarForProvider("gemini"), "GEMINI_API_KEY");
  assert.equal(getApiKeyEnvVarForProvider("atlas"), "ATLASCLOUD_API_KEY");
});

test("getDefaultModelForProvider picks the provider-specific default", () => {
  const config = createRuntimeConfig({
    GEMINI_API_KEY: "gemini-key",
    GEMINI_DEFAULT_MODEL: "gemini-custom-image",
    OPENAI_DEFAULT_MODEL: "gpt-image-custom",
    ATLASCLOUD_DEFAULT_MODEL: "provider/atlas-custom",
  });

  assert.equal(getDefaultModelForProvider(config, "gemini"), "gemini-custom-image");
  assert.equal(getDefaultModelForProvider(config, "openai"), "gpt-image-custom");
  assert.equal(getDefaultModelForProvider(config, "atlas"), "provider/atlas-custom");
});

test("parseImageProvider honours explicit values case-insensitively", () => {
  assert.equal(parseImageProvider("openai", "gemini-key", ""), "openai");
  assert.equal(parseImageProvider("  OpenAI  ", "", ""), "openai");
  assert.equal(parseImageProvider("GEMINI", "", "openai-key"), "gemini");
  assert.equal(parseImageProvider("ATLAS", "", "", "atlas-key"), "atlas");
});

test("parseImageProvider infers the provider from available keys when unset", () => {
  assert.equal(parseImageProvider(undefined, "gemini-key", ""), "gemini");
  assert.equal(parseImageProvider(undefined, "", "openai-key"), "openai");
  assert.equal(parseImageProvider(undefined, "gemini-key", "openai-key"), "gemini");
  assert.equal(parseImageProvider(undefined, "", ""), "gemini");
  assert.equal(parseImageProvider("nonsense", "", "openai-key"), "openai");
  assert.equal(parseImageProvider(undefined, "", "", "atlas-key"), "atlas");
});

test("createRuntimeConfig reads Atlas Cloud environment variables", () => {
  const config = createRuntimeConfig({
    ATLASCLOUD_API_KEY: "  atlas-key  ",
    ATLASCLOUD_DEFAULT_MODEL: "  provider/atlas-model  ",
    IMAGE_PROVIDER: "atlas",
  });

  assert.equal(config.atlasApiKey, "atlas-key");
  assert.equal(config.atlasDefaultModel, "provider/atlas-model");
  assert.equal(config.defaultProvider, "atlas");
});

test("createRuntimeConfig reads OpenAI environment variables", () => {
  const config = createRuntimeConfig({
    OPENAI_API_KEY: "  openai-key  ",
    OPENAI_DEFAULT_MODEL: "  gpt-image-2  ",
    IMAGE_PROVIDER: "openai",
  });

  assert.equal(config.openaiApiKey, "openai-key");
  assert.equal(config.openaiDefaultModel, "gpt-image-2");
  assert.equal(config.geminiApiKey, "");
  assert.equal(config.defaultProvider, "openai");
});

test("createRuntimeConfig falls back to built-in defaults", () => {
  const config = createRuntimeConfig({ GEMINI_API_KEY: "gemini-key" });

  assert.equal(config.openaiApiKey, "");
  assert.equal(config.atlasApiKey, "");
  assert.equal(config.openaiDefaultModel, "gpt-image-2");
  assert.equal(config.geminiDefaultModel, "gemini-3-pro-image-preview");
  assert.equal(config.atlasDefaultModel, "google/nano-banana-2-lite/text-to-image-developer");
  assert.equal(config.defaultProvider, "gemini");
});
