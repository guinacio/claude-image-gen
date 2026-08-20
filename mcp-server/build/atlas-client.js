import { Buffer } from "node:buffer";
import { DEFAULT_REQUEST_TIMEOUT_MS } from "./types.js";
const DEFAULT_API_BASE = "https://api.atlascloud.ai";
const USER_AGENT = "media-pipeline-mcp/atlas-provider";
const MAX_JSON_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_PREDICTION_RETRIES = 3;
const POLL_INTERVAL_MS = 2_000;
const PENDING_STATUSES = new Set(["created", "starting", "processing"]);
class AtlasRequestError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}
function defaultSleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
function normalizeApiBase(value) {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") {
        throw new Error("Atlas Cloud API base must use HTTPS.");
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
}
async function readJson(response) {
    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > MAX_JSON_BYTES) {
        throw new AtlasRequestError("Atlas Cloud returned an oversized JSON response.");
    }
    let payload;
    try {
        payload = JSON.parse(body);
    }
    catch {
        throw new AtlasRequestError("Atlas Cloud returned invalid JSON.", response.status);
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new AtlasRequestError("Atlas Cloud returned an invalid response object.");
    }
    return payload;
}
function errorMessage(payload, fallback) {
    return typeof payload.message === "string" && payload.message.trim()
        ? payload.message.trim()
        : fallback;
}
async function predictionData(response) {
    const payload = await readJson(response);
    if (!response.ok) {
        throw new AtlasRequestError(errorMessage(payload, `HTTP ${response.status}`), response.status);
    }
    if (payload.code !== undefined && payload.code !== 0 && payload.code !== 200) {
        throw new AtlasRequestError(errorMessage(payload, "Atlas Cloud API error."));
    }
    if (!payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
        throw new AtlasRequestError("Atlas Cloud response did not contain prediction data.");
    }
    return payload.data;
}
function predictionId(data) {
    if (typeof data.id !== "string" || !data.id) {
        throw new AtlasRequestError("Atlas Cloud response did not contain a prediction ID.");
    }
    return data.id;
}
function completedOutput(data) {
    const status = data.status;
    if (status === "completed") {
        if (!Array.isArray(data.outputs) ||
            data.outputs.length === 0 ||
            typeof data.outputs[0] !== "string") {
            throw new AtlasRequestError("Completed Atlas Cloud prediction did not contain an output URL.");
        }
        return data.outputs[0];
    }
    if (status === "failed" || status === "timeout") {
        const detail = typeof data.error === "string" && data.error
            ? data.error
            : `prediction ${status}`;
        throw new AtlasRequestError(`Atlas Cloud generation failed: ${detail}`);
    }
    if (typeof status !== "string" || !PENDING_STATUSES.has(status)) {
        throw new AtlasRequestError(`Atlas Cloud returned an unknown prediction status: ${String(status)}`);
    }
    return undefined;
}
function isTransientStatus(status) {
    return status === 429 || status >= 500;
}
function mimeTypeForResponse(response) {
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim();
    return contentType?.startsWith("image/") ? contentType : "image/png";
}
/** Fetches the current Atlas Cloud text-to-image model catalog. */
export async function fetchAtlasImageModels(_apiKey, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, fetchImpl = fetch) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetchImpl(`${DEFAULT_API_BASE}/api/v1/models`, {
            headers: { "User-Agent": USER_AGENT },
            signal: controller.signal,
        });
        const payload = await readJson(response);
        if (!response.ok) {
            throw new AtlasRequestError(errorMessage(payload, `HTTP ${response.status}`), response.status);
        }
        if (!Array.isArray(payload.data)) {
            throw new AtlasRequestError("Atlas Cloud model catalog did not contain a list.");
        }
        return payload.data
            .filter((item) => item.type === "Image" &&
            item.display_console === true &&
            Array.isArray(item.categories) &&
            item.categories.includes("TEXT-TO-IMAGE") &&
            typeof item.model === "string")
            .map((item) => item.model)
            .sort((left, right) => left.localeCompare(right));
    }
    finally {
        clearTimeout(timeoutId);
    }
}
export class AtlasImageClient {
    config;
    fetchImpl;
    sleep;
    apiBase;
    constructor(config, options = {}) {
        this.config = config;
        this.fetchImpl = options.fetch ?? fetch;
        this.sleep = options.sleep ?? defaultSleep;
        this.apiBase = normalizeApiBase(options.apiBase ?? DEFAULT_API_BASE);
    }
    async generateImage(input) {
        const unsupportedOptions = [
            input.referenceImages?.length ? "referenceImages" : undefined,
            input.mask ? "mask" : undefined,
            input.background ? "background" : undefined,
            input.outputFormat ? "outputFormat" : undefined,
        ].filter((option) => option !== undefined);
        if (unsupportedOptions.length > 0) {
            return {
                success: false,
                errorCode: "UNSUPPORTED_BY_PROVIDER",
                error: `${unsupportedOptions.join(", ")} ${unsupportedOptions.length === 1 ? "is" : "are"} not supported by Atlas Cloud text-to-image models.`,
            };
        }
        const timeoutMs = input.timeoutMs || this.config.requestTimeoutMs;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const deadline = Date.now() + timeoutMs;
        try {
            const model = input.model || this.config.defaultModel;
            const response = await this.fetchImpl(`${this.apiBase}/api/v1/model/generateImage`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.config.apiKey}`,
                    "Content-Type": "application/json",
                    "User-Agent": USER_AGENT,
                },
                body: JSON.stringify({
                    model,
                    prompt: input.prompt,
                    aspect_ratio: input.aspectRatio || "1:1",
                    thinking_level: "default",
                    resolution: "1k",
                    enable_sync_mode: false,
                    enable_base64_output: false,
                }),
                signal: controller.signal,
            });
            // The billable POST above is intentionally never retried.
            let data = await predictionData(response);
            const id = predictionId(data);
            let outputUrl = completedOutput(data);
            while (!outputUrl && Date.now() < deadline) {
                data = await this.fetchPrediction(id, controller.signal);
                outputUrl = completedOutput(data);
                if (!outputUrl) {
                    await this.sleep(Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())));
                }
            }
            if (!outputUrl) {
                throw new AtlasRequestError(`Image generation timed out after ${timeoutMs}ms.`);
            }
            const output = new URL(outputUrl);
            if (output.protocol !== "https:") {
                throw new AtlasRequestError("Atlas Cloud returned a non-HTTPS output URL.");
            }
            const imageResponse = await this.fetchImpl(output, {
                headers: {
                    Accept: "image/*",
                    "User-Agent": USER_AGENT,
                },
                signal: controller.signal,
            });
            if (!imageResponse.ok) {
                throw new AtlasRequestError(`Atlas Cloud image download failed with HTTP ${imageResponse.status}.`, imageResponse.status);
            }
            const contentLength = Number(imageResponse.headers.get("content-length"));
            if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
                throw new AtlasRequestError("Atlas Cloud image exceeds the 50MB limit.");
            }
            const image = Buffer.from(await imageResponse.arrayBuffer());
            if (image.length === 0) {
                throw new AtlasRequestError("Atlas Cloud returned an empty image.");
            }
            if (image.length > MAX_IMAGE_BYTES) {
                throw new AtlasRequestError("Atlas Cloud image exceeds the 50MB limit.");
            }
            return {
                success: true,
                base64Data: image.toString("base64"),
                mimeType: mimeTypeForResponse(imageResponse),
            };
        }
        catch (error) {
            const internalError = error instanceof Error ? error.message : String(error);
            if (controller.signal.aborted) {
                return {
                    success: false,
                    errorCode: "REQUEST_TIMEOUT",
                    error: `Image generation timed out after ${timeoutMs}ms.`,
                    internalError,
                };
            }
            const status = error instanceof AtlasRequestError ? error.status : undefined;
            return {
                success: false,
                errorCode: "ATLAS_API_ERROR",
                error: typeof status === "number" && status >= 400 && status < 500
                    ? `Atlas Cloud rejected the request: ${internalError}`
                    : "Atlas Cloud image generation failed.",
                internalError,
            };
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    async fetchPrediction(predictionIdValue, signal) {
        for (let attempt = 0; attempt <= MAX_PREDICTION_RETRIES; attempt += 1) {
            const response = await this.fetchImpl(`${this.apiBase}/api/v1/model/prediction/${encodeURIComponent(predictionIdValue)}`, {
                headers: {
                    Authorization: `Bearer ${this.config.apiKey}`,
                    "User-Agent": USER_AGENT,
                },
                signal,
            });
            if (response.ok || !isTransientStatus(response.status)) {
                return predictionData(response);
            }
            if (attempt === MAX_PREDICTION_RETRIES) {
                return predictionData(response);
            }
            await this.sleep(1_000 * 2 ** attempt);
        }
        throw new AtlasRequestError("Atlas Cloud prediction request exhausted retries.");
    }
}
