import type { SavedImageResult } from "./types.js";
export declare class ImageStorage {
    private readonly outputDir;
    private readonly outputDirRealPath;
    private static readonly OUTPUT_PATH_NOT_ALLOWED_MESSAGE;
    private static readonly MIME_EXTENSIONS;
    constructor(outputDir: string);
    private ensureDirectory;
    saveImage(base64Data: string, customPath?: string, mimeType?: string): SavedImageResult;
    private resolveFilePath;
    /**
     * Ensures the file extension reflects the actual image format. A missing
     * extension is appended; an extension that is invalid for the mime type is
     * replaced (e.g. `photo.png` for image/jpeg data becomes `photo.jpg`).
     * Equivalent extensions (`.jpg`/`.jpeg`) and unknown mime types keep the
     * caller-provided extension.
     */
    private applyExtensionForMimeType;
    private assertPathWithinOutputDirectory;
    private findNearestExistingPath;
    private getRealPath;
    private getExtensionFromMimeType;
    getOutputDirectory(): string;
}
