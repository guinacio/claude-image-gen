import test from "node:test";
import assert from "node:assert/strict";
import {
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
