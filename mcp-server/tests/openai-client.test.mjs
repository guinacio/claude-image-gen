import test from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import {
  OpenAIImageClient,
  describeOpenAIFailure,
  findObservedRejection,
  mapAspectRatioToOpenAISize,
  resolveOutputOptions,
} from "../build/openai-client.js";

test("mapAspectRatioToOpenAISize maps exact ratios without warnings", () => {
  const exactCases = [
    [undefined, "1024x1024"],
    ["1:1", "1024x1024"],
    ["3:2", "1536x1024"],
    ["2:3", "1024x1536"],
  ];

  for (const [aspectRatio, expectedSize] of exactCases) {
    const result = mapAspectRatioToOpenAISize(aspectRatio);
    assert.equal(result.size, expectedSize, `size for ${aspectRatio}`);
    assert.equal(result.warning, undefined, `warning for ${aspectRatio}`);
  }
});

test("mapAspectRatioToOpenAISize maps landscape approximations with a warning", () => {
  for (const aspectRatio of ["4:3", "16:9"]) {
    const result = mapAspectRatioToOpenAISize(aspectRatio);

    assert.equal(result.size, "1536x1024");
    assert.ok(result.warning, `expected warning for ${aspectRatio}`);
    assert.ok(
      result.warning.includes(aspectRatio),
      "warning names the requested ratio"
    );
    assert.ok(result.warning.includes("3:2"), "warning names the delivered ratio");
    assert.ok(
      result.warning.includes("1536x1024"),
      "warning names the delivered size"
    );
  }
});

test("mapAspectRatioToOpenAISize maps portrait approximations with a warning", () => {
  for (const aspectRatio of ["3:4", "9:16"]) {
    const result = mapAspectRatioToOpenAISize(aspectRatio);

    assert.equal(result.size, "1024x1536");
    assert.ok(result.warning, `expected warning for ${aspectRatio}`);
    assert.ok(
      result.warning.includes(aspectRatio),
      "warning names the requested ratio"
    );
    assert.ok(result.warning.includes("2:3"), "warning names the delivered ratio");
    assert.ok(
      result.warning.includes("1024x1536"),
      "warning names the delivered size"
    );
  }
});

test("mapAspectRatioToOpenAISize warning explains the OpenAI limitation", () => {
  const result = mapAspectRatioToOpenAISize("16:9");

  assert.equal(
    result.warning,
    "Aspect ratio 16:9 is not supported by OpenAI image models; generated at 3:2 (1536x1024) instead."
  );
});

test("resolveOutputOptions passes non-transparent requests through untouched", () => {
  for (const background of [undefined, "auto", "opaque"]) {
    for (const outputFormat of [undefined, "png", "jpeg", "webp"]) {
      const result = resolveOutputOptions(background, outputFormat);

      assert.equal(result.background, background);
      assert.equal(result.outputFormat, outputFormat);
      assert.equal(result.error, undefined);
    }
  }
});

test("resolveOutputOptions defaults a transparent background to png", () => {
  const result = resolveOutputOptions("transparent", undefined);

  assert.equal(result.background, "transparent");
  assert.equal(result.outputFormat, "png");
  assert.equal(result.error, undefined);
});

test("resolveOutputOptions keeps an explicit alpha-capable format", () => {
  for (const outputFormat of ["png", "webp"]) {
    const result = resolveOutputOptions("transparent", outputFormat);

    assert.equal(result.background, "transparent");
    assert.equal(result.outputFormat, outputFormat);
    assert.equal(result.error, undefined);
  }
});

test("resolveOutputOptions rejects transparency on a format without alpha", () => {
  const result = resolveOutputOptions("transparent", "jpeg");

  assert.ok(result.error, "expected an error");
  assert.ok(result.error.includes("jpeg"), "error names the offending format");
  assert.ok(result.error.includes("png"), "error names an accepted format");
  assert.equal(result.background, undefined);
  assert.equal(result.outputFormat, undefined);
});

test("findObservedRejection reports the recorded gpt-image-2 transparency refusal", () => {
  const rejection = findObservedRejection("gpt-image-2", {
    background: "transparent",
  });

  assert.ok(rejection, "expected a recorded rejection");
  assert.match(rejection.option, /transparent/);
  assert.equal(
    rejection.apiMessage,
    "Transparent background is not supported for this model."
  );
});

test("findObservedRejection stays silent for backgrounds that were never seen to fail", () => {
  for (const background of [undefined, "auto", "opaque"]) {
    assert.equal(
      findObservedRejection("gpt-image-2", { background }),
      undefined,
      `background ${background}`
    );
  }
});

test("findObservedRejection does not generalise to unrecorded models", () => {
  for (const model of ["gpt-image-1", "dall-e-3", undefined]) {
    assert.equal(
      findObservedRejection(model, { background: "transparent" }),
      undefined,
      `model ${model}`
    );
  }
});

test("describeOpenAIFailure passes a 4xx refusal through to the caller", () => {
  const apiError = new OpenAI.APIError(
    400,
    undefined,
    "400 Transparent background is not supported for this model.",
    undefined
  );

  const described = describeOpenAIFailure(apiError);

  assert.match(described.error, /Transparent background is not supported/);
  assert.match(described.internalError, /Transparent background is not supported/);
});

test("describeOpenAIFailure keeps server-side failures generic", () => {
  const apiError = new OpenAI.APIError(503, undefined, "503 upstream boom", undefined);

  const described = describeOpenAIFailure(apiError);

  assert.equal(described.error, "OpenAI image generation failed.");
  assert.match(described.internalError, /upstream boom/);
});

test("describeOpenAIFailure keeps transport failures generic", () => {
  const described = describeOpenAIFailure(new Error("ECONNRESET at 10.0.0.1"));

  assert.equal(described.error, "OpenAI image generation failed.");
  assert.match(described.internalError, /ECONNRESET/);
});

test("generateImage uses the requested format when the response omits output_format", async () => {
  for (const [outputFormat, expectedMimeType] of [
    ["jpeg", "image/jpeg"],
    ["webp", "image/webp"],
  ]) {
    const client = new OpenAIImageClient({
      apiKey: "test-key",
      requestTimeoutMs: 1000,
    });

    client.client = {
      images: {
        generate: async (request) => {
          assert.equal(request.output_format, outputFormat);
          return { data: [{ b64_json: "aW1hZ2U=" }] };
        },
      },
    };

    const result = await client.generateImage({
      prompt: "a test image",
      model: "gpt-image-1",
      outputFormat,
    });

    assert.equal(result.success, true);
    assert.equal(result.mimeType, expectedMimeType);
  }
});
