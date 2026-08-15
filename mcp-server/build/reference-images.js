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
// OpenAI caps the mask at 4MB unconditionally, unlike the image itself, whose
// limit depends on the model (50MB on the GPT image models, 4MB on dall-e-2).
// https://developers.openai.com/api/reference/python/resources/images/methods/edit
export const MAX_MASK_BYTES = 4 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const RIFF_SIGNATURE = Buffer.from("RIFF", "ascii");
const WEBP_SIGNATURE = Buffer.from("WEBP", "ascii");
const IHDR_CHUNK_TYPE = Buffer.from("IHDR", "ascii");
const TRNS_CHUNK_TYPE = Buffer.from("tRNS", "ascii");
const IDAT_CHUNK_TYPE = Buffer.from("IDAT", "ascii");
// Bit 2 of the IHDR colour type marks the formats that store an alpha sample
// per pixel: 4 (greyscale + alpha) and 6 (truecolour + alpha).
const PNG_COLOR_TYPE_ALPHA_BIT = 0b100;
// Offsets inside a PNG: the 8-byte signature is followed by the IHDR chunk,
// whose 4-byte length and 4-byte type precede its 13 bytes of data. The colour
// type is the 10th of those data bytes.
const PNG_IHDR_TYPE_OFFSET = 12;
const PNG_IHDR_COLOR_TYPE_OFFSET = 25;
const PNG_CHUNK_OVERHEAD_BYTES = 12;
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
/**
 * Walks the chunk list looking for a tRNS chunk, which is how greyscale,
 * truecolour and indexed PNGs carry transparency instead of an alpha sample.
 * The spec places tRNS after PLTE and before the first IDAT, so the walk stops
 * at IDAT rather than reading the whole file.
 */
function pngHasTransparencyChunk(data) {
    let offset = PNG_SIGNATURE.length;
    while (offset + 8 <= data.length) {
        const chunkLength = data.readUInt32BE(offset);
        const chunkType = data.subarray(offset + 4, offset + 8);
        if (chunkType.equals(TRNS_CHUNK_TYPE)) {
            return true;
        }
        if (chunkType.equals(IDAT_CHUNK_TYPE)) {
            return false;
        }
        offset += PNG_CHUNK_OVERHEAD_BYTES + chunkLength;
    }
    return false;
}
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
export function detectPngTransparency(data) {
    if (data.length <= PNG_IHDR_COLOR_TYPE_OFFSET ||
        !data.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) ||
        !data
            .subarray(PNG_IHDR_TYPE_OFFSET, PNG_IHDR_TYPE_OFFSET + 4)
            .equals(IHDR_CHUNK_TYPE)) {
        return null;
    }
    const colorType = data.readUInt8(PNG_IHDR_COLOR_TYPE_OFFSET);
    if ((colorType & PNG_COLOR_TYPE_ALPHA_BIT) !== 0) {
        return "alpha-channel";
    }
    return pngHasTransparencyChunk(data) ? "transparency-chunk" : "none";
}
const IMAGE_KIND_LABELS = {
    "reference-image": { noun: "Reference image", errorCodePrefix: "REFERENCE_IMAGE" },
    mask: { noun: "Mask", errorCodePrefix: "MASK" },
};
export function loadReferenceImages(filePaths, logger, options = {}) {
    const { noun, errorCodePrefix } = IMAGE_KIND_LABELS[options.kind ?? "reference-image"];
    const maxBytes = options.maxBytes ?? MAX_REFERENCE_IMAGE_BYTES;
    const images = [];
    for (const filePath of filePaths) {
        const resolved = path.resolve(filePath);
        const extensionMimeType = REFERENCE_IMAGE_MIME_TYPES[path.extname(resolved).toLowerCase()];
        if (!extensionMimeType) {
            logger.warn(`Rejected ${noun.toLowerCase()} with unsupported extension`, {
                filePath: resolved,
            });
            return {
                success: false,
                errorCode: `${errorCodePrefix}_UNSUPPORTED_TYPE`,
                error: `${noun} "${filePath}" must be a ${SUPPORTED_REFERENCE_IMAGE_FORMATS} file.`,
            };
        }
        if (!fs.existsSync(resolved)) {
            logger.warn(`${noun} not found`, { filePath: resolved });
            return {
                success: false,
                errorCode: `${errorCodePrefix}_NOT_FOUND`,
                error: `${noun} not found: ${filePath}`,
            };
        }
        try {
            const fileSize = fs.statSync(resolved).size;
            if (fileSize > maxBytes) {
                logger.warn(`Rejected ${noun.toLowerCase()} exceeding the size limit`, {
                    filePath: resolved,
                    fileSize,
                    maxBytes,
                });
                return {
                    success: false,
                    errorCode: `${errorCodePrefix}_TOO_LARGE`,
                    error: `${noun} "${filePath}" exceeds the ${Math.floor(maxBytes / (1024 * 1024))}MB size limit.`,
                };
            }
            const data = fs.readFileSync(resolved);
            const detectedMimeType = sniffImageMimeType(data);
            if (!detectedMimeType) {
                logger.warn(`Rejected ${noun.toLowerCase()} with non-image content`, {
                    filePath: resolved,
                });
                return {
                    success: false,
                    errorCode: `${errorCodePrefix}_UNSUPPORTED_TYPE`,
                    error: `${noun} "${filePath}" must be a ${SUPPORTED_REFERENCE_IMAGE_FORMATS} file.`,
                };
            }
            images.push({
                filePath: resolved,
                base64Data: data.toString("base64"),
                mimeType: detectedMimeType,
            });
            logger.debug(`Loaded ${noun.toLowerCase()}`, {
                filePath: resolved,
                mimeType: detectedMimeType,
            });
        }
        catch (error) {
            logger.warn(`Failed to read ${noun.toLowerCase()}`, {
                filePath: resolved,
                error: formatErrorMessage(error),
            });
            return {
                success: false,
                errorCode: `${errorCodePrefix}_READ_ERROR`,
                error: `Failed to read ${noun.toLowerCase()}: ${filePath}`,
            };
        }
    }
    return { success: true, images };
}
