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
export const MAX_REFERENCE_IMAGE_BYTES = 20 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const RIFF_SIGNATURE = Buffer.from("RIFF", "ascii");
const WEBP_SIGNATURE = Buffer.from("WEBP", "ascii");
/**
 * Determines the actual image format from the file's magic bytes. Returns the
 * detected mime type, or null when the content is not one of the supported
 * formats. The detected type is authoritative over the file extension so that
 * non-image bytes behind an image-named file are rejected, and a mislabeled
 * extension (e.g. JPEG data in a .png) is sent with its true mime type.
 */
export function sniffImageMimeType(data) {
    if (data.length >= 8 && data.subarray(0, 8).equals(PNG_SIGNATURE)) {
        return "image/png";
    }
    if (data.length >= 3 && data.subarray(0, 3).equals(JPEG_SIGNATURE)) {
        return "image/jpeg";
    }
    if (data.length >= 12 &&
        data.subarray(0, 4).equals(RIFF_SIGNATURE) &&
        data.subarray(8, 12).equals(WEBP_SIGNATURE)) {
        return "image/webp";
    }
    return null;
}
export function loadReferenceImages(filePaths, logger) {
    const images = [];
    for (const filePath of filePaths) {
        const resolved = path.resolve(filePath);
        const extensionMimeType = REFERENCE_IMAGE_MIME_TYPES[path.extname(resolved).toLowerCase()];
        if (!extensionMimeType) {
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
            const fileSize = fs.statSync(resolved).size;
            if (fileSize > MAX_REFERENCE_IMAGE_BYTES) {
                logger.warn("Rejected reference image exceeding the size limit", {
                    filePath: resolved,
                    fileSize,
                });
                return {
                    success: false,
                    errorCode: "REFERENCE_IMAGE_TOO_LARGE",
                    error: `Reference image "${filePath}" exceeds the ${Math.floor(MAX_REFERENCE_IMAGE_BYTES / (1024 * 1024))}MB size limit.`,
                };
            }
            const data = fs.readFileSync(resolved);
            const detectedMimeType = sniffImageMimeType(data);
            if (!detectedMimeType) {
                logger.warn("Rejected reference image with non-image content", {
                    filePath: resolved,
                });
                return {
                    success: false,
                    errorCode: "REFERENCE_IMAGE_UNSUPPORTED_TYPE",
                    error: `Reference image "${filePath}" must be a ${SUPPORTED_REFERENCE_IMAGE_FORMATS} file.`,
                };
            }
            images.push({
                filePath: resolved,
                base64Data: data.toString("base64"),
                mimeType: detectedMimeType,
            });
            logger.debug("Loaded reference image", {
                filePath: resolved,
                mimeType: detectedMimeType,
            });
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
