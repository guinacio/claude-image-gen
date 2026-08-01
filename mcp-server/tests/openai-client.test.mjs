import test from "node:test";
import assert from "node:assert/strict";
import { mapAspectRatioToOpenAISize } from "../build/openai-client.js";

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
