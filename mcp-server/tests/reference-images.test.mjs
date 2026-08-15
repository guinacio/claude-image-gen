import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  detectPngTransparency,
  loadReferenceImages,
  sniffImageMimeType,
  MAX_MASK_BYTES,
  MAX_REFERENCE_IMAGE_BYTES,
} from "../build/reference-images.js";

const silentLogger = {
  error() {},
  warn() {},
  info() {},
  debug() {},
};

const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("fake-png-body"),
]);
const JPEG_BYTES = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from("fake-jpeg-body"),
]);
const WEBP_BYTES = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP", "ascii"),
  Buffer.from("fake-webp-body"),
]);

// PNG colour types: 0 greyscale, 2 truecolour, 3 indexed, 4 greyscale+alpha,
// 6 truecolour+alpha.
function createPngChunk(type, data) {
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length, 0);
  // pngHasAlphaChannel does not verify CRCs, so a zeroed placeholder is enough.
  return Buffer.concat([header, Buffer.from(type, "ascii"), data, Buffer.alloc(4)]);
}

function createPng(colorType, { transparencyChunk = false } = {}) {
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0); // width
  ihdrData.writeUInt32BE(1, 4); // height
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(colorType, 9);

  return Buffer.concat([
    PNG_BYTES.subarray(0, 8),
    createPngChunk("IHDR", ihdrData),
    ...(transparencyChunk ? [createPngChunk("tRNS", Buffer.from([0x00]))] : []),
    createPngChunk("IDAT", Buffer.from("fake-pixels")),
    createPngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createTempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "media-pipeline-ref-test-"));
}

function removeDirectory(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

test("loadReferenceImages loads supported image files with the correct mime type", () => {
  const directory = createTempDirectory();
  const imagePath = path.join(directory, "reference.png");
  fs.writeFileSync(imagePath, PNG_BYTES);

  try {
    const result = loadReferenceImages([imagePath], silentLogger);

    assert.equal(result.success, true);
    assert.equal(result.images.length, 1);
    assert.equal(result.images[0].mimeType, "image/png");
    assert.equal(result.images[0].filePath, path.resolve(imagePath));
    assert.equal(result.images[0].base64Data, PNG_BYTES.toString("base64"));
  } finally {
    removeDirectory(directory);
  }
});

test("loadReferenceImages rejects files without a supported image extension", () => {
  const directory = createTempDirectory();
  const secretPath = path.join(directory, "secrets.env");
  fs.writeFileSync(secretPath, "API_KEY=super-secret");

  try {
    const result = loadReferenceImages([secretPath], silentLogger);

    assert.equal(result.success, false);
    assert.equal(result.errorCode, "REFERENCE_IMAGE_UNSUPPORTED_TYPE");
    assert.match(result.error, /PNG, JPEG, or WebP/);
  } finally {
    removeDirectory(directory);
  }
});

test("loadReferenceImages rejects non-image content behind an image extension", () => {
  const directory = createTempDirectory();
  const disguisedPath = path.join(directory, "secrets.png");
  fs.writeFileSync(disguisedPath, "API_KEY=super-secret");

  try {
    const result = loadReferenceImages([disguisedPath], silentLogger);

    assert.equal(result.success, false);
    assert.equal(result.errorCode, "REFERENCE_IMAGE_UNSUPPORTED_TYPE");
    assert.match(result.error, /PNG, JPEG, or WebP/);
  } finally {
    removeDirectory(directory);
  }
});

test("loadReferenceImages uses the detected content type over a mislabeled extension", () => {
  const directory = createTempDirectory();
  const mislabeledPath = path.join(directory, "actually-jpeg.png");
  fs.writeFileSync(mislabeledPath, JPEG_BYTES);

  try {
    const result = loadReferenceImages([mislabeledPath], silentLogger);

    assert.equal(result.success, true);
    assert.equal(result.images[0].mimeType, "image/jpeg");
  } finally {
    removeDirectory(directory);
  }
});

test("loadReferenceImages rejects files exceeding the size limit", () => {
  const directory = createTempDirectory();
  const oversizedPath = path.join(directory, "huge.png");
  const file = fs.openSync(oversizedPath, "w");
  try {
    fs.writeSync(file, PNG_BYTES, 0, PNG_BYTES.length, 0);
    fs.ftruncateSync(file, MAX_REFERENCE_IMAGE_BYTES + 1);
  } finally {
    fs.closeSync(file);
  }

  try {
    const result = loadReferenceImages([oversizedPath], silentLogger);

    assert.equal(result.success, false);
    assert.equal(result.errorCode, "REFERENCE_IMAGE_TOO_LARGE");
    assert.match(result.error, /size limit/);
  } finally {
    removeDirectory(directory);
  }
});

test("loadReferenceImages reports mask failures under the mask's own limit and wording", () => {
  const directory = createTempDirectory();
  const maskPath = path.join(directory, "mask.png");
  // Comfortably under the 20MB reference image allowance, over the 4MB mask cap.
  fs.writeFileSync(maskPath, Buffer.concat([PNG_BYTES, Buffer.alloc(MAX_MASK_BYTES)]));

  try {
    assert.equal(
      loadReferenceImages([maskPath], silentLogger).success,
      true,
      "the same file passes as a reference image"
    );

    const result = loadReferenceImages([maskPath], silentLogger, {
      kind: "mask",
      maxBytes: MAX_MASK_BYTES,
    });

    assert.equal(result.success, false);
    assert.equal(result.errorCode, "MASK_TOO_LARGE");
    assert.match(result.error, /^Mask ".*" exceeds the 4MB size limit\.$/);
  } finally {
    removeDirectory(directory);
  }
});

test("loadReferenceImages reports missing files using the caller-provided path", () => {
  const directory = createTempDirectory();
  const missingPath = path.join(directory, "missing.png");

  try {
    const result = loadReferenceImages([missingPath], silentLogger);

    assert.equal(result.success, false);
    assert.equal(result.errorCode, "REFERENCE_IMAGE_NOT_FOUND");
    assert.equal(result.error, `Reference image not found: ${missingPath}`);
  } finally {
    removeDirectory(directory);
  }
});

test("loadReferenceImages read failures do not leak filesystem error details", () => {
  const directory = createTempDirectory();
  const directoryAsImagePath = path.join(directory, "folder.png");
  fs.mkdirSync(directoryAsImagePath);

  try {
    const result = loadReferenceImages([directoryAsImagePath], silentLogger);

    assert.equal(result.success, false);
    assert.equal(result.errorCode, "REFERENCE_IMAGE_READ_ERROR");
    assert.equal(
      result.error,
      `Failed to read reference image: ${directoryAsImagePath}`
    );
  } finally {
    removeDirectory(directory);
  }
});

test("sniffImageMimeType detects each supported format and rejects others", () => {
  assert.equal(sniffImageMimeType(PNG_BYTES), "image/png");
  assert.equal(sniffImageMimeType(JPEG_BYTES), "image/jpeg");
  assert.equal(sniffImageMimeType(WEBP_BYTES), "image/webp");
  assert.equal(sniffImageMimeType(Buffer.from("GIF89a")), null);
  assert.equal(sniffImageMimeType(Buffer.from("RIFF1234WAVE")), null);
  assert.equal(sniffImageMimeType(Buffer.alloc(0)), null);
});

test("detectPngTransparency reports an alpha sample for colour types 4 and 6", () => {
  assert.equal(detectPngTransparency(createPng(4)), "alpha-channel", "greyscale + alpha");
  assert.equal(detectPngTransparency(createPng(6)), "alpha-channel", "truecolour + alpha");
});

test("detectPngTransparency reports opaque colour types without a tRNS chunk", () => {
  assert.equal(detectPngTransparency(createPng(0)), "none", "greyscale");
  assert.equal(detectPngTransparency(createPng(2)), "none", "truecolour");
  assert.equal(detectPngTransparency(createPng(3)), "none", "indexed");
});

test("detectPngTransparency distinguishes tRNS transparency from an alpha channel", () => {
  // The PNG spec allows tRNS only for colour types 0, 2 and 3; it is forbidden
  // for the two types that already carry an alpha sample.
  for (const colorType of [0, 2, 3]) {
    assert.equal(
      detectPngTransparency(createPng(colorType, { transparencyChunk: true })),
      "transparency-chunk",
      `colour type ${colorType} with tRNS`
    );
  }
});

test("detectPngTransparency ignores a tRNS chunk placed after the pixel data", () => {
  const png = Buffer.concat([
    createPng(2),
    createPngChunk("tRNS", Buffer.from([0x00])),
  ]);

  assert.equal(detectPngTransparency(png), "none");
});

test("detectPngTransparency returns null when the PNG header cannot be read", () => {
  assert.equal(detectPngTransparency(PNG_BYTES), null, "no IHDR chunk");
  assert.equal(detectPngTransparency(JPEG_BYTES), null, "not a PNG");
  assert.equal(detectPngTransparency(Buffer.alloc(0)), null, "empty buffer");
  assert.equal(
    detectPngTransparency(createPng(6).subarray(0, 20)),
    null,
    "truncated before the colour type"
  );
});
