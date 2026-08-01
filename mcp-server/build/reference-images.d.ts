import type { Logger } from "./runtime.js";
import type { ReferenceImage } from "./types.js";
export declare const SUPPORTED_REFERENCE_IMAGE_FORMATS = "PNG, JPEG, or WebP";
export declare const MAX_REFERENCE_IMAGE_BYTES: number;
export type LoadReferenceImagesResult = {
    success: true;
    images: ReferenceImage[];
} | {
    success: false;
    errorCode: string;
    error: string;
};
/**
 * Determines the actual image format from the file's magic bytes. Returns the
 * detected mime type, or null when the content is not one of the supported
 * formats. The detected type is authoritative over the file extension so that
 * non-image bytes behind an image-named file are rejected, and a mislabeled
 * extension (e.g. JPEG data in a .png) is sent with its true mime type.
 */
export declare function sniffImageMimeType(data: Buffer): string | null;
export declare function loadReferenceImages(filePaths: string[], logger: Logger): LoadReferenceImagesResult;
