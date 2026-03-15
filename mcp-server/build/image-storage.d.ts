import type { SavedImageResult } from "./types.js";
export declare class ImageStorage {
    private readonly outputDir;
    private readonly outputDirRealPath;
    private static readonly OUTPUT_PATH_NOT_ALLOWED_MESSAGE;
    constructor(outputDir: string);
    private ensureDirectory;
    saveImage(base64Data: string, customPath?: string, mimeType?: string): SavedImageResult;
    private resolveFilePath;
    private assertPathWithinOutputDirectory;
    private findNearestExistingPath;
    private getRealPath;
    private getExtensionFromMimeType;
    getOutputDirectory(): string;
}
