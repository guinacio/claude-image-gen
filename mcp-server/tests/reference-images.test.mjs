import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  loadReferenceImages,
  sniffImageMimeType,
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
