---
name: image-generation
description: Generates professional AI images using Google Gemini. ALWAYS invoke this skill when building websites, landing pages, slide decks, presentations, or any task needing visual content. Invoke IMMEDIATELY when you detect image needs - don't wait for the user to ask. This skill handles prompt optimization and aspect ratio selection.
---

# Image Generation Skill

Generate professional AI images using Google Gemini via the bundled CLI script.

## When to Invoke This Skill

Invoke immediately when:

**Web Development**
- Hero sections without images
- Feature illustrations needed
- Placeholder images in code (`placeholder.jpg`, `stock-photo.png`)
- Empty visual sections (`<section class="hero">` without images)
- Landing pages and marketing sites

**Presentations & Documents**
- Cover images and headers
- Conceptual diagrams
- Section dividers

**Applications**
- Onboarding illustrations
- Empty state graphics
- Error page visuals

## Using the CLI

Run the bundled CLI script via bash:

```bash
node "${CLAUDE_PLUGIN_ROOT}/mcp-server/build/cli.bundle.js" \
  --prompt "Your detailed image description" \
  --output "./path/to/output.png" \
  --aspect-ratio "16:9"
```

`CLAUDE_PLUGIN_ROOT` is only set when the skill comes from the plugin. When the skill was copied into `~/.claude/skills` instead, run the `media-pipeline-cli` command with the same flags; it is installed with `npm install -g ./mcp-server` from a clone of the repository:

```bash
media-pipeline-cli --prompt "Your detailed image description" --output "./path/to/output.png"
```

### Parameters

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| --prompt, -p | Yes | - | Detailed image description |
| --output, -o | No | auto-generated | Output file path |
| --aspect-ratio, -a | No | 1:1 | 1:1, 16:9, 9:16, 4:3, 3:4, 2:3, 3:2 |
| --model, -m | No | provider default | Model to use; routes the provider (gpt-image* → OpenAI, others → Gemini). dall-e* shut down on 2026-05-12 and is rejected |
| --reference-images, -r | No | - | Reference image paths (PNG/JPEG/WebP, repeatable or comma-separated, max 5) |
| --mask | No | - | PNG mask marking the region to repaint; OpenAI only, requires --reference-images |
| --background, -b | No | provider default | auto, transparent or opaque; OpenAI only. `gpt-image-2` refuses `transparent` and is rejected before the request is sent |
| --output-format, -f | No | provider default | png, jpeg, webp, gif (animated) or svg (vector); OpenAI only. Only png and webp take a transparent background; svg cannot be combined with --reference-images, and gif cannot be combined with --mask |
| --complexity | No | model default | low, medium or high planning effort, separate from quality; OpenAI only. The 2.6 models default to high |
| --frame-count | No | 9 | GIF frames, 2–16; requires --output-format gif. The frames share one sheet limited to 3840 px per edge and to 3840x2160 worth of pixels, so 16 frames need --size 720x720 or smaller (1024x1024 and 960x960 were refused, 720x720 worked) |
| --size | No | from --aspect-ratio | Exact OpenAI size, WIDTHxHEIGHT or auto, overriding --aspect-ratio. Refused unless both sides are multiples of 16, neither edge exceeds 3840, and the ratio is between 1:3 and 3:1 |
| --frame-duration-ms | No | 200 | Delay per GIF frame, 20–2000 ms; requires --output-format gif |
| --svg-model | Depends on the account | - | Model that turns the reference image into the SVG, such as `gpt-5.5`; requires --output-format svg. Accounts with SVG model selection must pass it (the API answers "SVG generation requires 'svg.model'"); accounts without it must leave it out. SVG took about 2.5 minutes in testing, so pass `--timeout-ms 180000`. Claude Desktop stops a tool call at 240 seconds |
| --svg-reasoning-effort | No | author model default | none, minimal, low, medium, high, xhigh or max; requires --svg-model |
| --output-dir, -d | No | current directory | Output directory |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| GEMINI_API_KEY | At least one of GEMINI_API_KEY / OPENAI_API_KEY | Your Gemini API key |
| OPENAI_API_KEY | At least one of GEMINI_API_KEY / OPENAI_API_KEY | Your OpenAI API key |
| GEMINI_DEFAULT_MODEL | No | Preferred default Gemini model |
| OPENAI_DEFAULT_MODEL | No | Preferred default OpenAI model (default: gpt-image-2) |
| IMAGE_PROVIDER | No | gemini or openai — provider used when --model is omitted |
| REQUEST_TIMEOUT_MS | No | Request timeout in milliseconds for both providers (default 60000). GEMINI_REQUEST_TIMEOUT_MS is still read when this is unset. Use 180000 for SVG |
| MEDIA_PIPELINE_LOG_LEVEL | No | Logging level for stderr diagnostics |

### Output

The CLI outputs JSON:
```json
{"success": true, "filePath": "/path/to/generated-image.png"}
```

Or on error:
```json
{"success": false, "error": "Error message"}
```

### Aspect Ratio Selection

- **16:9** - Hero images, website headers, presentations
- **1:1** - Social media, thumbnails, profile images
- **9:16** - Mobile stories, vertical banners
- **4:3** - Blog posts, general web content
- **3:2** - Photography-style images

## Prompt Crafting

Use this formula for effective prompts:

```
[Style] [Subject] [Composition] [Context/Atmosphere]
```

### Examples

**Hero Image for Tech Startup**
```
Minimalist 3D illustration of abstract geometric shapes floating in space,
soft gradient background from deep purple to electric blue, subtle glow effects,
modern professional aesthetic, wide composition for website header
```

**E-commerce Product**
```
Clean product photography of modern wireless headphones on white marble surface,
soft studio lighting from left, subtle shadows, high-end minimalist aesthetic,
centered composition
```

**Blog Post Header**
```
Aerial photography of winding river through autumn forest, golden hour lighting,
warm color palette with oranges and reds, cinematic wide shot, serene atmosphere
```

**App Illustration**
```
Flat vector illustration of person organizing digital files on floating screens,
soft pastel colors, isometric perspective, clean lines, friendly approachable style
```

## Pattern Detection

**Automatically invoke this skill** when you see:

```html
<!-- Placeholder detection -->
<img src="placeholder.jpg" alt="Hero">
<!-- Action: Invoke skill and generate a custom hero image -->

<!-- Empty visual section -->
<section class="features">
  <h2>Our Features</h2>
  <!-- No images -->
</section>
<!-- Action: Invoke skill to create feature illustrations -->
```

```css
/* Generic stock reference */
.banner { background: url('stock-image.jpg'); }
/* Action: Invoke skill to create a unique background */
```

## Workflow

1. **Detect Need** - Identify visual content requirements (hero, illustrations, backgrounds)
2. **Invoke Skill** - Use the Skill tool with `skill: "image-generation"` immediately
3. **Analyze Context** - Understand project style and brand
4. **Craft Prompt** - Build detailed prompt using the formula above
5. **Confirm (iterative work)** - When the user is iterating on an image with you (concept art, edits, anything built from reference images), show them the full prompt, the model and each reference image with what it is for, and wait for their ok. Every generation is billed, and a wrong model or reference wastes one. Routine website imagery can skip this step.
6. **Generate** - Run the CLI script with optimized parameters
7. **Integrate** - Place image in project with proper references

## Model Selection

The CLI is dual-provider: the `--model` value routes the request — model names starting with `gpt-image` go to OpenAI, everything else goes to Gemini. `dall-e-2` and `dall-e-3` were shut down on 2026-05-12 and are rejected. When `--model` is omitted, `IMAGE_PROVIDER` picks which provider's default model is used.

- **Gemini** (`GEMINI_DEFAULT_MODEL`, e.g. `gemini-3-pro-image`) — models are fetched dynamically from the Gemini API; the CLI falls back to the first discovered image-capable model if no default is set. Prefer Gemini for iterative creative work and when relying on the dynamically discovered model catalog.
- **OpenAI** (`OPENAI_DEFAULT_MODEL`, default `gpt-image-2`) — use when you specifically need an OpenAI model, or when only an OpenAI API key is configured. Without `--size`, sizes are mapped to `1024x1024`, `1536x1024`, or `1024x1536`, and a non-matching aspect ratio comes back with a warning. `--size` sends an exact size instead.

The default is not the only OpenAI choice. Any `gpt-image*` name is passed through, and a key often lists several (`GET https://api.openai.com/v1/models`). Per OpenAI's [image prompting guide](https://developers.openai.com/api/docs/guides/image-prompting) and [models page](https://developers.openai.com/api/docs/models):

| Model | What it is |
|---|---|
| `gpt-image-2.6-sunburst` | Quality model, with more consistent details from one edit to the next. Supports animated GIF and SVG output |
| `gpt-image-2.6-flare` | Speed model, with images in as little as six seconds. Supports animated GIF and SVG output |
| `gpt-image-2.5-sunburst` | Base model, optimized for quality: higher image quality than `gpt-image-2` |
| `gpt-image-2.5-flare` | Small model, optimized for speed, with quality comparable to `gpt-image-2` |
| `gpt-image-2` | The CLI default |
| `gpt-image-1.5` | Deprecated; OpenAI lists shutdown on 2026-12-01 |
| `gpt-image-1` | Shut down by OpenAI on 2026-10-23; do not use |
| `dall-e-2`, `dall-e-3` | Shut down by OpenAI on 2026-05-12; rejected before the request is sent |

Names ending in a date (`gpt-image-2.5-flare-2026-09-08`) are snapshots that pin one version so results stay reproducible. OpenAI suggests Flare when `gpt-image-2` quality is already enough and Sunburst where it falls short, and warns that speed and price differences depend on the workload. OpenAI says the 2.6 models generate images 50% faster than the 2.5 models.

For an animated GIF, use a 2.6 model with `--output-format gif`, and describe in the prompt the subject, the motion and how the loop closes (for example "returns to its starting pose"). GIF output may need preview access on the account; if it is missing, the API's refusal is passed back.

SVG is generated from the prompt alone: it cannot take reference images, so to vectorize an existing picture, describe it in detail. Ask for flat shapes and a clean palette in the prompt, and check the result rendered, since the author model can leave pieces unfilled (black). Tell the user which model you plan to use, and why, as part of the Confirm step.

## Best Practices

**DO:**
- Include specific style keywords
- Match aspect ratio to intended use
- Describe mood and atmosphere
- Specify color palette for brand consistency

**DON'T:**
- Use vague prompts ("make it look good")
- Ignore where the image will be used
- Skip aspect ratio for specific layouts

## Reference

For advanced prompt techniques: [references/prompt-crafting.md](references/prompt-crafting.md)

For layout control with a blockout render and other uses of `--reference-images`: [references/reference-images.md](references/reference-images.md)

## Alternative: MCP Tool

If the MCP server is configured, you can also use:

```
mcp__media-pipeline__create_asset
```

Parameters match the CLI: `prompt`, `outputPath`, `aspectRatio`, `size`, `model` (gpt-image* routes to OpenAI), `referenceImages` (up to 5 absolute paths, PNG/JPEG/WebP), `mask`, `background`, `outputFormat` (`gif` and `svg` on gpt-image-2.6), `complexity`, `frameCount`, `frameDurationMs`, `svgModel`, `svgReasoningEffort`. The OpenAI-only options are rejected on Gemini.

