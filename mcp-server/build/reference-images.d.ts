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
/**
 * How a PNG carries transparency, if at all:
 * - "alpha-channel": an alpha sample per pixel (colour types 4 and 6)
 * - "transparency-chunk": a tRNS chunk, the only mechanism available to colour
 *   types 0, 2 and 3, which the PNG spec forbids for types 4 and 6
 * - "none": fully opaque, nothing for a mask to mark
 */
export type PngTransparency = "alpha-channel" | "transparency-chunk" | "none";
/**
 * Reports how a PNG carries transparency, by reading the IHDR colour type and,
 * for the colour types without an alpha sample, checking for a tRNS chunk.
 * Returns null when the buffer is not a PNG whose IHDR can be read, so callers
 * can tell "opaque" apart from "could not tell".
 *
 * The two transparent results are kept apart because OpenAI documents a mask as
 * needing an alpha channel specifically, so a tRNS-only PNG is transparent by
 * the PNG spec yet outside what the API says it accepts.
 */
export declare function detectPngTransparency(data: Buffer): PngTransparency | null;
export declare function loadReferenceImages(filePaths: string[], logger: Logger): LoadReferenceImagesResult;
