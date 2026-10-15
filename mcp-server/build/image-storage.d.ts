import type { SavedImageResult } from "./types.js";
export declare class ImageStorage {
    private readonly outputDir;
    private readonly outputDirRealPath;
    private static readonly OUTPUT_PATH_NOT_ALLOWED_MESSAGE;
    private static readonly MIME_EXTENSIONS;
    constructor(outputDir: string);
    private ensureDirectory;
    /**
     * Checks that a custom output path stays within the output directory without
     * writing anything. Callers run it before a paid generation request, so a bad
     * path fails up front instead of discarding the generated image at save time.
     * saveImage still runs the same check, since the filesystem can change between
     * the two calls.
     */
    checkOutputPath(customPath?: string): {
        success: true;
    } | {
        success: false;
        errorCode: string;
        error: string;
    };
    saveImage(base64Data: string, customPath?: string, mimeType?: string): SavedImageResult;
    private resolveFilePath;
    private resolveCustomPath;
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
