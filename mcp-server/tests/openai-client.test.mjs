import test from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import {
  OpenAIImageClient,
  checkFormatSpecificOptions,
  describeOpenAIFailure,
  findObservedRejection,
  mapAspectRatioToOpenAISize,
  resolveOutputOptions,
} from "../build/openai-client.js";

test("mapAspectRatioToOpenAISize maps exact ratios without warnings", () => {
  const exactCases = [
    [undefined, "1024x1024"],
    ["1:1", "1024x1024"],
    ["3:2", "1536x1024"],
    ["2:3", "1024x1536"],
  ];

  for (const [aspectRatio, expectedSize] of exactCases) {
    const result = mapAspectRatioToOpenAISize(aspectRatio);
    assert.equal(result.size, expectedSize, `size for ${aspectRatio}`);
    assert.equal(result.warning, undefined, `warning for ${aspectRatio}`);
  }
});

test("mapAspectRatioToOpenAISize maps landscape approximations with a warning", () => {
  for (const aspectRatio of ["4:3", "16:9"]) {
    const result = mapAspectRatioToOpenAISize(aspectRatio);

    assert.equal(result.size, "1536x1024");
    assert.ok(result.warning, `expected warning for ${aspectRatio}`);
    assert.ok(
      result.warning.includes(aspectRatio),
      "warning names the requested ratio"
    );
    assert.ok(result.warning.includes("3:2"), "warning names the delivered ratio");
    assert.ok(
      result.warning.includes("1536x1024"),
      "warning names the delivered size"
    );
  }
});

test("mapAspectRatioToOpenAISize maps portrait approximations with a warning", () => {
  for (const aspectRatio of ["3:4", "9:16"]) {
    const result = mapAspectRatioToOpenAISize(aspectRatio);

    assert.equal(result.size, "1024x1536");
    assert.ok(result.warning, `expected warning for ${aspectRatio}`);
    assert.ok(
      result.warning.includes(aspectRatio),
      "warning names the requested ratio"
    );
    assert.ok(result.warning.includes("2:3"), "warning names the delivered ratio");
    assert.ok(
      result.warning.includes("1024x1536"),
      "warning names the delivered size"
    );
  }
});

test("mapAspectRatioToOpenAISize warning explains the OpenAI limitation", () => {
  const result = mapAspectRatioToOpenAISize("16:9");

  assert.equal(
    result.warning,
    "Aspect ratio 16:9 is not supported by OpenAI image models; generated at 3:2 (1536x1024) instead."
  );
});

test("resolveOutputOptions passes non-transparent requests through untouched", () => {
  for (const background of [undefined, "auto", "opaque"]) {
    for (const outputFormat of [undefined, "png", "jpeg", "webp"]) {
      const result = resolveOutputOptions(background, outputFormat);

      assert.equal(result.background, background);
      assert.equal(result.outputFormat, outputFormat);
      assert.equal(result.error, undefined);
    }
  }
});

test("resolveOutputOptions defaults a transparent background to png", () => {
  const result = resolveOutputOptions("transparent", undefined);

  assert.equal(result.background, "transparent");
  assert.equal(result.outputFormat, "png");
  assert.equal(result.error, undefined);
});

test("resolveOutputOptions keeps an explicit alpha-capable format", () => {
  for (const outputFormat of ["png", "webp"]) {
    const result = resolveOutputOptions("transparent", outputFormat);

    assert.equal(result.background, "transparent");
    assert.equal(result.outputFormat, outputFormat);
    assert.equal(result.error, undefined);
  }
});

test("resolveOutputOptions rejects transparency on a format without alpha", () => {
  const result = resolveOutputOptions("transparent", "jpeg");

  assert.ok(result.error, "expected an error");
  assert.ok(result.error.includes("jpeg"), "error names the offending format");
  assert.ok(result.error.includes("png"), "error names an accepted format");
  assert.equal(result.background, undefined);
  assert.equal(result.outputFormat, undefined);
});

test("findObservedRejection reports the recorded gpt-image-2 transparency refusal", () => {
  for (const model of ["gpt-image-2", "gpt-image-2-2026-04-21"]) {
    const rejection = findObservedRejection(model, {
      background: "transparent",
    });

    assert.ok(rejection, `expected a recorded rejection for ${model}`);
    assert.match(rejection.option, /transparent/);
    assert.equal(
      rejection.apiMessage,
      "Transparent background is not supported for this model."
    );
  }
});

test("findObservedRejection stays silent for backgrounds that were never seen to fail", () => {
  for (const background of [undefined, "auto", "opaque"]) {
    assert.equal(
      findObservedRejection("gpt-image-2", { background }),
      undefined,
      `background ${background}`
    );
  }
});

test("findObservedRejection does not generalise to unrecorded models", () => {
  for (const model of [
    "gpt-image-1",
    "dall-e-3",
    "gpt-image-2.5-sunburst",
    "gpt-image-2.5-flare",
    "gpt-image-2.5-flare-2026-09-08",
    undefined,
  ]) {
    assert.equal(
      findObservedRejection(model, { background: "transparent" }),
      undefined,
      `model ${model}`
    );
  }
});

test("describeOpenAIFailure passes a 4xx refusal through to the caller", () => {
  const apiError = new OpenAI.APIError(
    400,
    undefined,
    "400 Transparent background is not supported for this model.",
    undefined
  );

  const described = describeOpenAIFailure(apiError);

  assert.match(described.error, /Transparent background is not supported/);
  assert.match(described.internalError, /Transparent background is not supported/);
});

test("describeOpenAIFailure keeps server-side failures generic", () => {
  const apiError = new OpenAI.APIError(503, undefined, "503 upstream boom", undefined);

  const described = describeOpenAIFailure(apiError);

  assert.equal(described.error, "OpenAI image generation failed.");
  assert.match(described.internalError, /upstream boom/);
});

test("describeOpenAIFailure keeps transport failures generic", () => {
  const described = describeOpenAIFailure(new Error("ECONNRESET at 10.0.0.1"));

  assert.equal(described.error, "OpenAI image generation failed.");
  assert.match(described.internalError, /ECONNRESET/);
});

test("generateImage uses the requested format when the response omits output_format", async () => {
  for (const [outputFormat, expectedMimeType] of [
    ["jpeg", "image/jpeg"],
    ["webp", "image/webp"],
    ["gif", "image/gif"],
    ["svg", "image/svg+xml"],
  ]) {
    const client = new OpenAIImageClient({
      apiKey: "test-key",
      requestTimeoutMs: 1000,
    });

    client.client = {
      images: {
        generate: async (request) => {
          assert.equal(request.output_format, outputFormat);
          return { data: [{ b64_json: "aW1hZ2U=" }] };
        },
      },
    };

    const result = await client.generateImage({
      prompt: "a test image",
      model: "gpt-image-1",
      outputFormat,
    });

    assert.equal(result.success, true);
    assert.equal(result.mimeType, expectedMimeType);
  }
});

test("generateImage rejects a mask that has no base image to repaint", async () => {
  const client = new OpenAIImageClient({
    apiKey: "test-key",
    requestTimeoutMs: 1000,
  });

  client.client = {
    images: {
      generate: async () => {
        throw new Error("the request must not reach the API");
      },
    },
  };

  const result = await client.generateImage({
    prompt: "repaint the sky",
    model: "gpt-image-2",
    mask: { filePath: "mask.png", base64Data: "bWFzaw==", mimeType: "image/png" },
  });

  assert.equal(result.success, false);
  assert.equal(result.errorCode, "MASK_WITHOUT_REFERENCE_IMAGE");
  assert.match(result.error, /referenceImages/);
});

test("resolveOutputOptions rejects transparency on gif and svg", () => {
  for (const outputFormat of ["gif", "svg"]) {
    const result = resolveOutputOptions("transparent", outputFormat);
    assert.match(result.error, /png or webp/, outputFormat);
  }
});

test("checkFormatSpecificOptions accepts valid combinations", () => {
  const validCases = [
    { hasReferenceImages: false, hasMask: false },
    { outputFormat: "gif", frameCount: 4, frameDurationMs: 100, hasReferenceImages: true, hasMask: false },
    { outputFormat: "svg", hasReferenceImages: false, hasMask: false },
    { outputFormat: "png", hasReferenceImages: true, hasMask: true },
  ];

  for (const input of validCases) {
    assert.equal(checkFormatSpecificOptions(input), undefined, JSON.stringify(input));
  }
});

test("checkFormatSpecificOptions rejects frame options without gif output", () => {
  for (const outputFormat of [undefined, "png", "svg"]) {
    const error = checkFormatSpecificOptions({
      outputFormat,
      frameCount: 4,
      frameDurationMs: 100,
      hasReferenceImages: false,
      hasMask: false,
    });
    assert.match(error, /frameCount and frameDurationMs/, String(outputFormat));
  }
});

test("checkFormatSpecificOptions rejects svg edits and masked gifs", () => {
  assert.match(
    checkFormatSpecificOptions({
      outputFormat: "svg",
      hasReferenceImages: true,
      hasMask: false,
    }),
    /referenceImages/
  );
  assert.match(
    checkFormatSpecificOptions({
      outputFormat: "gif",
      hasReferenceImages: true,
      hasMask: true,
    }),
    /masks/
  );
});

test("generateImage sends GIF frame options and complexity to the API", async () => {
  const client = new OpenAIImageClient({
    apiKey: "test-key",
    requestTimeoutMs: 1000,
  });
  let sentRequest;

  client.client = {
    images: {
      generate: async (request) => {
        sentRequest = request;
        return { output_format: "gif", data: [{ b64_json: "R0lGODlh" }] };
      },
    },
  };

  const result = await client.generateImage({
    prompt: "a lantern swaying and returning to its starting pose",
    model: "gpt-image-2.6-sunburst",
    outputFormat: "gif",
    frameCount: 12,
    frameDurationMs: 150,
    complexity: "low",
  });

  assert.equal(result.success, true);
  assert.equal(result.mimeType, "image/gif");
  assert.equal(sentRequest.model, "gpt-image-2.6-sunburst");
  assert.equal(sentRequest.output_format, "gif");
  assert.equal(sentRequest.frame_count, 12);
  assert.equal(sentRequest.frame_duration_ms, 150);
  assert.equal(sentRequest.complexity, "low");
});

test("generateImage leaves the new options out of the request when omitted", async () => {
  const client = new OpenAIImageClient({
    apiKey: "test-key",
    requestTimeoutMs: 1000,
  });
  let sentRequest;

  client.client = {
    images: {
      generate: async (request) => {
        sentRequest = request;
        return { data: [{ b64_json: "aW1hZ2U=" }] };
      },
    },
  };

  await client.generateImage({ prompt: "a test image", model: "gpt-image-2" });

  for (const key of ["output_format", "frame_count", "frame_duration_ms", "complexity"]) {
    assert.equal(key in sentRequest, false, key);
  }
});

test("generateImage sends an animated GIF edit through the edit endpoint", async () => {
  const client = new OpenAIImageClient({
    apiKey: "test-key",
    requestTimeoutMs: 1000,
  });
  let sentRequest;

  client.client = {
    images: {
      edit: async (request) => {
        sentRequest = request;
        return { data: [{ b64_json: "R0lGODlh" }] };
      },
    },
  };

  const result = await client.generateImage({
    prompt: "make the character wave",
    model: "gpt-image-2.6-flare",
    outputFormat: "gif",
    frameCount: 6,
    referenceImages: [
      { filePath: "character.png", base64Data: "aW1hZ2U=", mimeType: "image/png" },
    ],
  });

  assert.equal(result.success, true);
  assert.equal(result.mimeType, "image/gif");
  assert.equal(sentRequest.output_format, "gif");
  assert.equal(sentRequest.frame_count, 6);
});

test("generateImage refuses incompatible format options before calling the API", async () => {
  const cases = [
    { outputFormat: "png", frameCount: 4 },
    {
      outputFormat: "svg",
      referenceImages: [
        { filePath: "logo.png", base64Data: "aW1hZ2U=", mimeType: "image/png" },
      ],
    },
  ];

  for (const options of cases) {
    const client = new OpenAIImageClient({
      apiKey: "test-key",
      requestTimeoutMs: 1000,
    });

    client.client = {
      images: {
        generate: async () => {
          throw new Error("the request must not reach the API");
        },
        edit: async () => {
          throw new Error("the request must not reach the API");
        },
      },
    };

    const result = await client.generateImage({
      prompt: "a test image",
      model: "gpt-image-2.6-sunburst",
      ...options,
    });

    assert.equal(result.success, false, JSON.stringify(options));
    assert.equal(result.errorCode, "INCOMPATIBLE_OUTPUT_OPTIONS");
  }
});

test("checkFormatSpecificOptions rejects SVG author options without svg output", () => {
  for (const outputFormat of [undefined, "png", "gif"]) {
    const error = checkFormatSpecificOptions({
      outputFormat,
      svgModel: "svg-author",
      svgReasoningEffort: "high",
      hasReferenceImages: false,
      hasMask: false,
    });
    assert.match(error, /svgModel and svgReasoningEffort/, String(outputFormat));
  }
});

test("checkFormatSpecificOptions requires svgModel for svgReasoningEffort", () => {
  const error = checkFormatSpecificOptions({
    outputFormat: "svg",
    svgReasoningEffort: "high",
    hasReferenceImages: false,
    hasMask: false,
  });

  assert.match(error, /needs svgModel/);
});

test("generateImage sends the svg author object only when svgModel is set", async () => {
  const cases = [
    [{}, undefined],
    [{ svgModel: "svg-author" }, { model: "svg-author" }],
    [
      { svgModel: "svg-author", svgReasoningEffort: "low" },
      { model: "svg-author", reasoning: { effort: "low" } },
    ],
  ];

  for (const [options, expectedSvg] of cases) {
    const client = new OpenAIImageClient({
      apiKey: "test-key",
      requestTimeoutMs: 1000,
    });
    let sentRequest;

    client.client = {
      images: {
        generate: async (request) => {
          sentRequest = request;
          return { output_format: "svg", data: [{ b64_json: "PHN2Zy8+" }] };
        },
      },
    };

    const result = await client.generateImage({
      prompt: "a flat lantern logo",
      model: "gpt-image-2.6-flare",
      outputFormat: "svg",
      ...options,
    });

    assert.equal(result.success, true, JSON.stringify(options));
    assert.equal(result.mimeType, "image/svg+xml");
    assert.equal(sentRequest.output_format, "svg");
    assert.deepEqual(sentRequest.svg, expectedSvg, JSON.stringify(options));
  }
});

test("generateImage sends an explicit size instead of the aspect ratio mapping", async () => {
  const client = new OpenAIImageClient({
    apiKey: "test-key",
    requestTimeoutMs: 1000,
  });
  let sentRequest;

  client.client = {
    images: {
      generate: async (request) => {
        sentRequest = request;
        return { data: [{ b64_json: "R0lGODlh" }] };
      },
    },
  };

  const result = await client.generateImage({
    prompt: "a walking knight",
    model: "gpt-image-2.6-sunburst",
    aspectRatio: "16:9",
    size: "960x960",
    outputFormat: "gif",
    frameCount: 16,
  });

  assert.equal(result.success, true);
  assert.equal(sentRequest.size, "960x960");
  assert.equal(result.warnings, undefined);
});
