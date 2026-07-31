import * as fs from "node:fs";
import * as path from "node:path";
import { formatErrorMessage } from "./runtime.js";
const REFERENCE_IMAGE_MIME_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
};
export const SUPPORTED_REFERENCE_IMAGE_FORMATS = "PNG, JPEG, or WebP";
export function loadReferenceImages(filePaths, logger) {
    const images = [];
    for (const filePath of filePaths) {
        const resolved = path.resolve(filePath);
        const mimeType = REFERENCE_IMAGE_MIME_TYPES[path.extname(resolved).toLowerCase()];
        if (!mimeType) {
            logger.warn("Rejected reference image with unsupported extension", {
                filePath: resolved,
            });
            return {
                success: false,
                errorCode: "REFERENCE_IMAGE_UNSUPPORTED_TYPE",
                error: `Reference image "${filePath}" must be a ${SUPPORTED_REFERENCE_IMAGE_FORMATS} file.`,
            };
        }
        if (!fs.existsSync(resolved)) {
            logger.warn("Reference image not found", { filePath: resolved });
            return {
                success: false,
                errorCode: "REFERENCE_IMAGE_NOT_FOUND",
                error: `Reference image not found: ${filePath}`,
            };
        }
        try {
            const data = fs.readFileSync(resolved);
            images.push({
                filePath: resolved,
                base64Data: data.toString("base64"),
                mimeType,
            });
            logger.debug("Loaded reference image", { filePath: resolved, mimeType });
        }
        catch (error) {
            logger.warn("Failed to read reference image", {
                filePath: resolved,
                error: formatErrorMessage(error),
            });
            return {
                success: false,
                errorCode: "REFERENCE_IMAGE_READ_ERROR",
                error: `Failed to read reference image: ${filePath}`,
            };
        }
    }
    return { success: true, images };
}
