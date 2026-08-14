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
    outputFormat: "gif",
  });

  assert.equal(parsed.success, false);
});

test("createAssetArgsSchema rejects an empty mask path", () => {
  const parsed = createAssetArgsSchema.safeParse({ ...basePrompt, mask: "   " });

  assert.equal(parsed.success, false);
});
