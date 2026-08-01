#!/usr/bin/env node
/**
 * Standalone CLI for generating images using Google Gemini or OpenAI.
 * This path does not require the MCP server or stdio transport.
 *
 * Usage:
 *   node build/cli.bundle.js --prompt "..." --output "./image.png" --aspect-ratio "16:9"
 */

import { parseArgs } from "node:util";
import { MediaPipelineService } from "./media-pipeline-service.js";
import { createAssetArgsSchema } from "./schemas.js";
import { createLogger, createRuntimeConfig, hasAnyApiKey } from "./runtime.js";
import { ASPECT_RATIOS } from "./types.js";

function printHelp(): void {
  console.log(`
Usage: node build/cli.bundle.js [options]

Options:
  -p, --prompt <text>        Image description (required)
  -o, --output <path>        Output file path (optional, auto-generated if not provided)
  -a, --aspect-ratio <ratio> Aspect ratio: ${ASPECT_RATIOS.join(", ")} (default: 1:1)
  -m, --model <model>        Model to use (gpt-image*/dall-e* → OpenAI, others → Gemini; validated dynamically)
  -r, --reference-images <paths>  Reference image paths (PNG/JPEG/WebP, repeatable or comma-separated, max 5)
  -d, --output-dir <dir>     Output directory (default: current directory)
  -t, --timeout-ms <ms>      Gemini request timeout in milliseconds
  -l, --log-level <level>    Logging level: error, warn, info, debug
  -h, --help                 Show this help message

Environment:
  GEMINI_API_KEY             Your Gemini API key (at least one required)
  OPENAI_API_KEY             Your OpenAI API key (at least one required)
  GEMINI_DEFAULT_MODEL       Preferred default model (optional)
  OPENAI_DEFAULT_MODEL       Preferred default OpenAI model (optional, default gpt-image-2)
  IMAGE_PROVIDER             gemini or openai — provider used when --model is omitted (optional)
  GEMINI_REQUEST_TIMEOUT_MS  Request timeout in milliseconds (optional)
  MEDIA_PIPELINE_LOG_LEVEL   Logging level for stderr diagnostics (optional)

Examples:
  node build/cli.bundle.js -p "A sunset over mountains" -o "./sunset.png"
  node build/cli.bundle.js --prompt "Hero image for tech startup" --aspect-ratio "16:9"
  node build/cli.bundle.js -p "Product photo" --model gpt-image-2 -o "./product.png"
  node build/cli.bundle.js -p "Logo variant" -r "./ref1.png,./ref2.png" -r "./ref3.png"
`);
}

async function main(): Promise<void> {
  try {
    const { values } = parseArgs({
      options: {
        prompt: { type: "string", short: "p" },
        output: { type: "string", short: "o" },
        "aspect-ratio": { type: "string", short: "a", default: "1:1" },
        model: { type: "string", short: "m" },
        "reference-images": { type: "string", short: "r", multiple: true },
        "output-dir": { type: "string", short: "d", default: process.cwd() },
        "timeout-ms": { type: "string", short: "t" },
        "log-level": { type: "string", short: "l" },
        help: { type: "boolean", short: "h", default: false },
      },
      strict: true,
    });

    // Show help if requested
    if (values.help) {
      printHelp();
      process.exit(0);
    }

    const referenceImagesRaw = values["reference-images"] as string[] | undefined;
    const referenceImages = referenceImagesRaw
      ?.flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    const parsedArgs = createAssetArgsSchema.safeParse({
      prompt: values.prompt,
      outputPath: values.output,
      aspectRatio: values["aspect-ratio"],
      model: values.model,
      referenceImages: referenceImages && referenceImages.length > 0 ? referenceImages : undefined,
    });

    if (!parsedArgs.success) {
      console.log(JSON.stringify({
        success: false,
        errorCode: "VALIDATION_ERROR",
        error: parsedArgs.error.issues[0]?.message || "Invalid CLI arguments",
      }));
      process.exit(1);
    }

    const runtimeConfig = createRuntimeConfig({
      ...process.env,
      IMAGE_OUTPUT_DIR:
        (values["output-dir"] as string | undefined) || process.env.IMAGE_OUTPUT_DIR,
      GEMINI_REQUEST_TIMEOUT_MS:
        (values["timeout-ms"] as string | undefined) ||
        process.env.GEMINI_REQUEST_TIMEOUT_MS,
      MEDIA_PIPELINE_LOG_LEVEL:
        (values["log-level"] as string | undefined) ||
        process.env.MEDIA_PIPELINE_LOG_LEVEL,
    });

    const logger = createLogger("cli", runtimeConfig.logLevel);

    if (!hasAnyApiKey(runtimeConfig)) {
      console.log(JSON.stringify({
        success: false,
        errorCode: "CONFIG_ERROR",
        error: "No provider API key set: set GEMINI_API_KEY and/or OPENAI_API_KEY",
      }));
      process.exit(1);
    }

    const service = new MediaPipelineService(runtimeConfig, logger);
    const result = await service.createAsset(parsedArgs.data);

    console.log(JSON.stringify(result));

    if (!result.success) {
      process.exit(1);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify({
      success: false,
      errorCode: "CLI_ERROR",
      error: `CLI error: ${errorMessage}`
    }));
    process.exit(1);
  }
}

main();

