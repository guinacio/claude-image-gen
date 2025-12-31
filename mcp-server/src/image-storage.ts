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

      // Generate filename if not provided
      const filename = customPath || `generated-${randomUUID()}${extension}`;

      // Resolve full path
      const filePath = path.isAbsolute(filename)
        ? filename
        : path.join(this.outputDir, filename);

      // Ensure parent directory exists
      const parentDir = path.dirname(filePath);
      this.ensureDirectory(parentDir);

      // Decode base64 and write to file
      const buffer = Buffer.from(base64Data, "base64");
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
