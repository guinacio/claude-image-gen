import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import type { SavedImageResult } from "./types.js";

export class ImageStorage {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = path.resolve(outputDir);
    this.ensureDirectory(this.outputDir);
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
      // Determine file extension from mime type
      const extension = this.getExtensionFromMimeType(mimeType);
      const filePath = this.resolveFilePath(customPath, extension);

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
        filePath: filePath,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to save image: ${errorMessage}`,
      };
    }
  }

  private resolveFilePath(customPath: string | undefined, extension: string): string {
    if (!customPath) {
      return path.join(this.outputDir, `generated-${randomUUID()}${extension}`);
    }

    const endsWithSeparator = /[\\/]$/.test(customPath);
    let resolvedPath = path.isAbsolute(customPath)
      ? path.normalize(customPath)
      : path.resolve(this.outputDir, customPath);

    if (!path.isAbsolute(customPath)) {
      const relativeToOutput = path.relative(this.outputDir, resolvedPath);
      if (
        relativeToOutput.startsWith("..") ||
        path.isAbsolute(relativeToOutput)
      ) {
        throw new Error(
          "Relative outputPath cannot escape the configured output directory"
        );
      }
    }

    const pathIsDirectory =
      endsWithSeparator ||
      (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory());

    if (pathIsDirectory) {
      resolvedPath = path.join(
        resolvedPath,
        `generated-${randomUUID()}${extension}`
      );
    } else if (!path.extname(resolvedPath)) {
      resolvedPath = `${resolvedPath}${extension}`;
    }

    return resolvedPath;
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/webp": ".webp",
      "image/gif": ".gif",
    };
    return mimeToExt[mimeType] || ".png";
  }

  getOutputDirectory(): string {
    return this.outputDir;
  }
}
