import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import type { SavedImageResult } from "./types.js";

export class ImageStorage {
  private readonly outputDir: string;
  private readonly outputDirRealPath: string;
  private static readonly OUTPUT_PATH_NOT_ALLOWED_MESSAGE =
    "outputPath must stay within the configured output directory";
  private static readonly MIME_EXTENSIONS: Record<string, string[]> = {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
    "image/gif": [".gif"],
  };

  constructor(outputDir: string) {
    this.outputDir = path.resolve(outputDir);
    this.ensureDirectory(this.outputDir);
    this.outputDirRealPath = this.getRealPath(this.outputDir);
  }

  private ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  saveImage(
    base64Data: string,
    customPath?: string,
    mimeType: string = "image/png"
  ): SavedImageResult {
    try {
      const filePath = this.resolveFilePath(customPath, mimeType);

      // Ensure parent directory exists
      const parentDir = path.dirname(filePath);
      this.ensureDirectory(parentDir);

      // Decode base64 and write to file
      const buffer = Buffer.from(base64Data, "base64");
      if (buffer.length === 0) {
        throw new Error("Generated image payload was empty");
      }
      fs.writeFileSync(filePath, buffer);

      return {
        success: true,
        filePath,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage === ImageStorage.OUTPUT_PATH_NOT_ALLOWED_MESSAGE) {
        return {
          success: false,
          errorCode: "OUTPUT_PATH_NOT_ALLOWED",
          error: ImageStorage.OUTPUT_PATH_NOT_ALLOWED_MESSAGE,
          internalError: errorMessage,
        };
      }

      return {
        success: false,
        errorCode: "FILE_SAVE_FAILED",
        error: "Failed to save generated image.",
        internalError: errorMessage,
      };
    }
  }

  private resolveFilePath(customPath: string | undefined, mimeType: string): string {
    const extension = this.getExtensionFromMimeType(mimeType);

    if (!customPath) {
      return path.join(this.outputDir, `generated-${randomUUID()}${extension}`);
    }

    const endsWithSeparator = /[\\/]$/.test(customPath);
    let resolvedPath = path.isAbsolute(customPath)
      ? path.normalize(customPath)
      : path.resolve(this.outputDir, customPath);
    this.assertPathWithinOutputDirectory(resolvedPath);

    const pathIsDirectory =
      endsWithSeparator ||
      (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory());

    if (pathIsDirectory) {
      resolvedPath = path.join(
        resolvedPath,
        `generated-${randomUUID()}${extension}`
      );
    } else {
      resolvedPath = this.applyExtensionForMimeType(resolvedPath, mimeType, extension);
    }

    this.assertPathWithinOutputDirectory(resolvedPath);
    return resolvedPath;
  }

  /**
   * Ensures the file extension reflects the actual image format. A missing
   * extension is appended; an extension that is invalid for the mime type is
   * replaced (e.g. `photo.png` for image/jpeg data becomes `photo.jpg`).
   * Equivalent extensions (`.jpg`/`.jpeg`) and unknown mime types keep the
   * caller-provided extension.
   */
  private applyExtensionForMimeType(
    filePath: string,
    mimeType: string,
    extension: string
  ): string {
    const currentExtension = path.extname(filePath);
    if (!currentExtension) {
      return `${filePath}${extension}`;
    }

    const allowedExtensions = ImageStorage.MIME_EXTENSIONS[mimeType];
    if (
      allowedExtensions &&
      !allowedExtensions.includes(currentExtension.toLowerCase())
    ) {
      return `${filePath.slice(0, -currentExtension.length)}${extension}`;
    }

    return filePath;
  }

  private assertPathWithinOutputDirectory(targetPath: string): void {
    const nearestExistingPath = this.findNearestExistingPath(targetPath);
    const resolvedRoot = this.getRealPath(nearestExistingPath);
    const relativeToOutput = path.relative(this.outputDirRealPath, resolvedRoot);

    if (
      relativeToOutput.startsWith("..") ||
      path.isAbsolute(relativeToOutput)
    ) {
      throw new Error(ImageStorage.OUTPUT_PATH_NOT_ALLOWED_MESSAGE);
    }
  }

  private findNearestExistingPath(targetPath: string): string {
    let currentPath = path.resolve(targetPath);

    while (!fs.existsSync(currentPath)) {
      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        break;
      }
      currentPath = parentPath;
    }

    return currentPath;
  }

  private getRealPath(targetPath: string): string {
    return fs.realpathSync.native?.(targetPath) ?? fs.realpathSync(targetPath);
  }

  private getExtensionFromMimeType(mimeType: string): string {
    return ImageStorage.MIME_EXTENSIONS[mimeType]?.[0] || ".png";
  }

  getOutputDirectory(): string {
    return this.outputDir;
  }
}
