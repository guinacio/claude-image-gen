import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ImageStorage } from "../build/image-storage.js";

function createTempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "media-pipeline-test-"));
}

function removeDirectory(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

test("ImageStorage rejects absolute paths outside the configured output directory", () => {
  const outputDirectory = createTempDirectory();
  const storage = new ImageStorage(outputDirectory);
  const outsidePath = path.join(path.dirname(outputDirectory), "outside-image.png");

  try {
    const result = storage.saveImage(Buffer.from("image-bytes").toString("base64"), outsidePath);

    assert.equal(result.success, false);
    assert.equal(result.errorCode, "OUTPUT_PATH_NOT_ALLOWED");
    assert.equal(
      result.error,
      "outputPath must stay within the configured output directory"
    );
  } finally {
    removeDirectory(outputDirectory);
  }
});

test("ImageStorage rejects relative path traversal outside the configured output directory", () => {
  const outputDirectory = createTempDirectory();
  const storage = new ImageStorage(outputDirectory);

  try {
    const result = storage.saveImage(
      Buffer.from("image-bytes").toString("base64"),
      path.join("..", "escaped-image.png")
    );

    assert.equal(result.success, false);
    assert.equal(result.errorCode, "OUTPUT_PATH_NOT_ALLOWED");
    assert.equal(
      result.error,
      "outputPath must stay within the configured output directory"
    );
  } finally {
    removeDirectory(outputDirectory);
  }
});

test("ImageStorage corrects a file extension that does not match the image mime type", () => {
  const outputDirectory = createTempDirectory();
  const storage = new ImageStorage(outputDirectory);

  try {
    const result = storage.saveImage(
      Buffer.from("image-bytes").toString("base64"),
      "photo.png",
      "image/jpeg"
    );

    assert.equal(result.success, true);
    assert.equal(path.basename(result.filePath), "photo.jpg");
    assert.equal(fs.existsSync(result.filePath), true);
  } finally {
    removeDirectory(outputDirectory);
  }
});

test("ImageStorage keeps equivalent extensions for the same mime type", () => {
  const outputDirectory = createTempDirectory();
  const storage = new ImageStorage(outputDirectory);

  try {
    const result = storage.saveImage(
      Buffer.from("image-bytes").toString("base64"),
      "photo.JPEG",
      "image/jpeg"
    );

    assert.equal(result.success, true);
    assert.equal(path.basename(result.filePath), "photo.JPEG");
  } finally {
    removeDirectory(outputDirectory);
  }
});

test("ImageStorage keeps the caller extension for unknown mime types", () => {
  const outputDirectory = createTempDirectory();
  const storage = new ImageStorage(outputDirectory);

  try {
    const result = storage.saveImage(
      Buffer.from("image-bytes").toString("base64"),
      "photo.bin",
      "image/unknown-format"
    );

    assert.equal(result.success, true);
    assert.equal(path.basename(result.filePath), "photo.bin");
  } finally {
    removeDirectory(outputDirectory);
  }
});
