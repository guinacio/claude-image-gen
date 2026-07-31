import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadReferenceImages } from "../build/reference-images.js";

const silentLogger = {
  error() {},
  warn() {},
  info() {},
  debug() {},
};

function createTempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "media-pipeline-ref-test-"));
}

function removeDirectory(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

test("loadReferenceImages loads supported image files with the correct mime type", () => {
  const directory = createTempDirectory();
  const imagePath = path.join(directory, "reference.png");
  fs.writeFileSync(imagePath, Buffer.from("image-bytes"));

  try {
    const result = loadReferenceImages([imagePath], silentLogger);

    assert.equal(result.success, true);
    assert.equal(result.images.length, 1);
    assert.equal(result.images[0].mimeType, "image/png");
    assert.equal(result.images[0].filePath, path.resolve(imagePath));
    assert.equal(
      result.images[0].base64Data,
      Buffer.from("image-bytes").toString("base64")
    );
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
