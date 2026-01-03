#!/usr/bin/env node
/**
 * CLI for generating images using Google Gemini API.
 * This is a standalone script that reuses the GeminiImageClient and ImageStorage classes.
 *
 * Usage:
 *   node cli.js --prompt "..." --output "./image.png" --aspect-ratio "16:9"
 */
import { parseArgs } from "node:util";
import { GeminiImageClient } from "./gemini-client.js";
import { ImageStorage } from "./image-storage.js";
const VALID_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "16:9", "9:16"];
const VALID_MODELS = ["gemini-3-pro-image-preview", "gemini-2.5-flash-image"];
function printHelp() {
    console.log(`
Usage: node cli.js [options]

Options:
  -p, --prompt <text>        Image description (required)
  -o, --output <path>        Output file path (optional, auto-generated if not provided)
  -a, --aspect-ratio <ratio> Aspect ratio: 1:1, 16:9, 9:16, 4:3, 3:4, 2:3, 3:2 (default: 1:1)
  -m, --model <model>        Model: gemini-3-pro-image-preview, gemini-2.5-flash-image
  -d, --output-dir <dir>     Output directory (default: current directory)
  -h, --help                 Show this help message

Environment:
  GEMINI_API_KEY             Your Gemini API key (required)

Examples:
  node cli.js -p "A sunset over mountains" -o "./sunset.png"
  node cli.js --prompt "Hero image for tech startup" --aspect-ratio "16:9"
`);
}
async function main() {
    try {
        const { values } = parseArgs({
            options: {
                prompt: { type: "string", short: "p" },
                output: { type: "string", short: "o" },
                "aspect-ratio": { type: "string", short: "a", default: "1:1" },
                model: { type: "string", short: "m", default: "gemini-3-pro-image-preview" },
                "output-dir": { type: "string", short: "d", default: process.cwd() },
                help: { type: "boolean", short: "h", default: false },
            },
            strict: true,
        });
        // Show help if requested
        if (values.help) {
            printHelp();
            process.exit(0);
        }
        // Validate prompt
        if (!values.prompt) {
            console.log(JSON.stringify({
                success: false,
                error: "Missing required argument: --prompt"
            }));
            process.exit(1);
        }
        // Validate aspect ratio
        const aspectRatio = values["aspect-ratio"];
        if (!VALID_ASPECT_RATIOS.includes(aspectRatio)) {
            console.log(JSON.stringify({
                success: false,
                error: `Invalid aspect ratio: ${aspectRatio}. Valid options: ${VALID_ASPECT_RATIOS.join(", ")}`
            }));
            process.exit(1);
        }
        // Validate model
        const model = values.model;
        if (!VALID_MODELS.includes(model)) {
            console.log(JSON.stringify({
                success: false,
                error: `Invalid model: ${model}. Valid options: ${VALID_MODELS.join(", ")}`
            }));
            process.exit(1);
        }
        // Get API key from environment
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.log(JSON.stringify({
                success: false,
                error: "GEMINI_API_KEY environment variable not set"
            }));
            process.exit(1);
        }
        // Create client and generate image
        const client = new GeminiImageClient({
            apiKey,
            defaultModel: model,
            outputDirectory: values["output-dir"],
        });
        const result = await client.generateImage({
            prompt: values.prompt,
            aspectRatio: aspectRatio,
            model: model,
        });
        if (!result.success) {
            console.log(JSON.stringify({
                success: false,
                error: result.error
            }));
            process.exit(1);
        }
        // Save the image
        const storage = new ImageStorage(values["output-dir"]);
        const saved = storage.saveImage(result.base64Data, values.output, result.mimeType);
        if (!saved.success) {
            console.log(JSON.stringify({
                success: false,
                error: saved.error
            }));
            process.exit(1);
        }
        // Output success result
        console.log(JSON.stringify({
            success: true,
            filePath: saved.filePath,
        }));
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(JSON.stringify({
            success: false,
            error: `CLI error: ${errorMessage}`
        }));
        process.exit(1);
    }
}
main();
