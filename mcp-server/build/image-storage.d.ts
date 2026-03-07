import type { SavedImageResult } from "./types.js";
export declare class ImageStorage {
    private outputDir;
    constructor(outputDir: string);
    private ensureDirectory;
    saveImage(base64Data: string, customPath?: string, mimeType?: string): SavedImageResult;
    private resolveFilePath;
    private getExtensionFromMimeType;
    getOutputDirectory(): string;
}
