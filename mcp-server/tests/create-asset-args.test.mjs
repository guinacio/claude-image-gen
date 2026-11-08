import test from "node:test";
import assert from "node:assert/strict";
import { createAssetArgsSchema } from "../build/schemas.js";

const basePrompt = { prompt: "a tiger in a white shirt" };

test("createAssetArgsSchema accepts mask, background and outputFormat", () => {
  const parsed = createAssetArgsSchema.safeParse({
    ...basePrompt,
    referenceImages: ["/tmp/base.png"],
    mask: "/tmp/mask.png",
    background: "transparent",
    outputFormat: "png",
  });

  assert.ok(parsed.success, parsed.error?.issues?.[0]?.message);
  assert.equal(parsed.data.mask, "/tmp/mask.png");
  assert.equal(parsed.data.background, "transparent");
  assert.equal(parsed.data.outputFormat, "png");
});

test("createAssetArgsSchema leaves the new options undefined when omitted", () => {
  const parsed = createAssetArgsSchema.safeParse(basePrompt);

  assert.ok(parsed.success);
  assert.equal(parsed.data.mask, undefined);
  assert.equal(parsed.data.background, undefined);
  assert.equal(parsed.data.outputFormat, undefined);
});

test("createAssetArgsSchema rejects an unknown background", () => {
  const parsed = createAssetArgsSchema.safeParse({
    ...basePrompt,
    background: "see-through",
  });

  assert.equal(parsed.success, false);
});

test("createAssetArgsSchema rejects an unknown output format", () => {
  const parsed = createAssetArgsSchema.safeParse({
    ...basePrompt,
    outputFormat: "bmp",
  });

  assert.equal(parsed.success, false);
});

test("createAssetArgsSchema accepts animated GIF options and complexity", () => {
  const parsed = createAssetArgsSchema.safeParse({
    ...basePrompt,
    outputFormat: "gif",
    frameCount: 12,
    frameDurationMs: 150,
    complexity: "medium",
  });

  assert.ok(parsed.success, parsed.error?.issues?.[0]?.message);
  assert.equal(parsed.data.outputFormat, "gif");
  assert.equal(parsed.data.frameCount, 12);
  assert.equal(parsed.data.frameDurationMs, 150);
  assert.equal(parsed.data.complexity, "medium");
});

test("createAssetArgsSchema accepts svg output", () => {
  const parsed = createAssetArgsSchema.safeParse({
    ...basePrompt,
    outputFormat: "svg",
  });

  assert.ok(parsed.success, parsed.error?.issues?.[0]?.message);
});

test("createAssetArgsSchema enforces the documented GIF frame ranges", () => {
  const invalidCases = [
    { frameCount: 1 },
    { frameCount: 17 },
    { frameCount: 4.5 },
    { frameCount: Number.NaN },
    { frameDurationMs: 10 },
    { frameDurationMs: 2001 },
  ];

  for (const options of invalidCases) {
    const parsed = createAssetArgsSchema.safeParse({
      ...basePrompt,
      outputFormat: "gif",
      ...options,
    });
    assert.equal(parsed.success, false, JSON.stringify(options));
  }
});

test("createAssetArgsSchema rejects an unknown complexity", () => {
  const parsed = createAssetArgsSchema.safeParse({
    ...basePrompt,
    complexity: "extreme",
  });

  assert.equal(parsed.success, false);
});

test("createAssetArgsSchema rejects an empty mask path", () => {
  const parsed = createAssetArgsSchema.safeParse({ ...basePrompt, mask: "   " });

  assert.equal(parsed.success, false);
});

test("createAssetArgsSchema accepts the SVG author options", () => {
  const parsed = createAssetArgsSchema.safeParse({
    ...basePrompt,
    outputFormat: "svg",
    svgModel: "svg-author",
    svgReasoningEffort: "xhigh",
  });

  assert.ok(parsed.success, parsed.error?.issues?.[0]?.message);
  assert.equal(parsed.data.svgModel, "svg-author");
  assert.equal(parsed.data.svgReasoningEffort, "xhigh");
});

test("createAssetArgsSchema rejects an empty svgModel and an unknown effort", () => {
  for (const options of [{ svgModel: "  " }, { svgModel: "svg-author", svgReasoningEffort: "extreme" }]) {
    const parsed = createAssetArgsSchema.safeParse({
      ...basePrompt,
      outputFormat: "svg",
      ...options,
    });
    assert.equal(parsed.success, false, JSON.stringify(options));
  }
});

test("createAssetArgsSchema accepts auto and documented OpenAI sizes only", () => {
  for (const size of ["auto", "720x720", "960x960", "1536x864", "3840x1280", "1280x3840"]) {
    const parsed = createAssetArgsSchema.safeParse({ ...basePrompt, size });
    assert.ok(parsed.success, parsed.error?.issues?.[0]?.message ?? size);
  }

  for (const size of [
    "960",
    "960X960",
    "0x960",
    "big",
    "960x960x2",
    "10x10",
    "1000x1000",
    "4000x1024",
    "3840x1024",
  ]) {
    const parsed = createAssetArgsSchema.safeParse({ ...basePrompt, size });
    assert.equal(parsed.success, false, size);
  }
});
