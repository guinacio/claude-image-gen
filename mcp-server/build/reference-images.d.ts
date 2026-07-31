import type { Logger } from "./runtime.js";
import type { ReferenceImage } from "./types.js";
export declare const SUPPORTED_REFERENCE_IMAGE_FORMATS = "PNG, JPEG, or WebP";
export type LoadReferenceImagesResult = {
    success: true;
    images: ReferenceImage[];
} | {
    success: false;
    errorCode: string;
    error: string;
};
export declare function loadReferenceImages(filePaths: string[], logger: Logger): LoadReferenceImagesResult;
