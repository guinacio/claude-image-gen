import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
export class ImageStorage {
    outputDir;
    outputDirRealPath;
    static OUTPUT_PATH_NOT_ALLOWED_MESSAGE = "outputPath must stay within the configured output directory";
    constructor(outputDir) {
        this.outputDir = path.resolve(outputDir);
        this.ensureDirectory(this.outputDir);
        this.outputDirRealPath = this.getRealPath(this.outputDir);
    }
    ensureDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
    saveImage(base64Data, customPath, mimeType = "image/png") {
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
                filePath,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
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
    resolveFilePath(customPath, extension) {
        if (!customPath) {
            return path.join(this.outputDir, `generated-${randomUUID()}${extension}`);
        }
        const endsWithSeparator = /[\\/]$/.test(customPath);
        let resolvedPath = path.isAbsolute(customPath)
            ? path.normalize(customPath)
            : path.resolve(this.outputDir, customPath);
        this.assertPathWithinOutputDirectory(resolvedPath);
        const pathIsDirectory = endsWithSeparator ||
            (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory());
        if (pathIsDirectory) {
            resolvedPath = path.join(resolvedPath, `generated-${randomUUID()}${extension}`);
        }
        else if (!path.extname(resolvedPath)) {
            resolvedPath = `${resolvedPath}${extension}`;
        }
        this.assertPathWithinOutputDirectory(resolvedPath);
        return resolvedPath;
    }
    assertPathWithinOutputDirectory(targetPath) {
        const nearestExistingPath = this.findNearestExistingPath(targetPath);
        const resolvedRoot = this.getRealPath(nearestExistingPath);
        const relativeToOutput = path.relative(this.outputDirRealPath, resolvedRoot);
        if (relativeToOutput.startsWith("..") ||
            path.isAbsolute(relativeToOutput)) {
            throw new Error(ImageStorage.OUTPUT_PATH_NOT_ALLOWED_MESSAGE);
        }
    }
    findNearestExistingPath(targetPath) {
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
    getRealPath(targetPath) {
        return fs.realpathSync.native?.(targetPath) ?? fs.realpathSync(targetPath);
    }
    getExtensionFromMimeType(mimeType) {
        const mimeToExt = {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/webp": ".webp",
            "image/gif": ".gif",
        };
        return mimeToExt[mimeType] || ".png";
    }
    getOutputDirectory() {
        return this.outputDir;
    }
}
