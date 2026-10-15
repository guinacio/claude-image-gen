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

### Parameters

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| --prompt, -p | Yes | - | Detailed image description |
| --output, -o | No | auto-generated | Output file path |
| --aspect-ratio, -a | No | 1:1 | 1:1, 16:9, 9:16, 4:3, 3:4, 2:3, 3:2 |
| --model, -m | No | provider default | Model to use; routes the provider (gpt-image*/dall-e* → OpenAI, others → Gemini) |
| --reference-images, -r | No | - | Reference image paths (PNG/JPEG/WebP, repeatable or comma-separated, max 5) |
| --mask | No | - | PNG mask marking the region to repaint; OpenAI only, requires --reference-images |
| --background, -b | No | provider default | auto, transparent or opaque; OpenAI only. `gpt-image-2` refuses `transparent` and is rejected before the request is sent |
| --output-format, -f | No | provider default | png, jpeg or webp; OpenAI only |
| --output-dir, -d | No | current directory | Output directory |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| GEMINI_API_KEY | At least one of GEMINI_API_KEY / OPENAI_API_KEY | Your Gemini API key |
| OPENAI_API_KEY | At least one of GEMINI_API_KEY / OPENAI_API_KEY | Your OpenAI API key |
| GEMINI_DEFAULT_MODEL | No | Preferred default Gemini model |
| OPENAI_DEFAULT_MODEL | No | Preferred default OpenAI model (default: gpt-image-2) |
| IMAGE_PROVIDER | No | gemini or openai — provider used when --model is omitted |
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

The CLI is dual-provider: the `--model` value routes the request — model names starting with `gpt-image` or `dall-e` go to OpenAI, everything else goes to Gemini. When `--model` is omitted, `IMAGE_PROVIDER` picks which provider's default model is used.

- **Gemini** (`GEMINI_DEFAULT_MODEL`, e.g. `gemini-3-pro-image`) — models are fetched dynamically from the Gemini API; the CLI falls back to the first discovered image-capable model if no default is set. Prefer Gemini for iterative creative work and when relying on the dynamically discovered model catalog.
- **OpenAI** (`OPENAI_DEFAULT_MODEL`, default `gpt-image-2`) — use when you specifically need an OpenAI model, or when only an OpenAI API key is configured. Note the CLI limits OpenAI image sizes to `1024x1024`/`1536x1024`/`1024x1536`; non-matching aspect ratios are mapped to the nearest supported size with a warning.

The default is not the only OpenAI choice. Any `gpt-image*` name is passed through, and a key often lists several (`GET https://api.openai.com/v1/models`). Per OpenAI's [image prompting guide](https://developers.openai.com/api/docs/guides/image-prompting) and [models page](https://developers.openai.com/api/docs/models):

| Model | What it is |
|---|---|
| `gpt-image-2.5-sunburst` | Base model, optimized for quality: higher image quality than `gpt-image-2`; OpenAI's most capable for generation and editing |
| `gpt-image-2.5-flare` | Small model, optimized for speed, with quality comparable to `gpt-image-2` |
| `gpt-image-2` | The CLI default |
| `gpt-image-1.5`, `gpt-image-1` | Deprecated; OpenAI lists shutdown on 2026-12-01 and 2026-10-23 |

Names ending in a date (`gpt-image-2.5-flare-2026-09-08`) are snapshots that pin one version so results stay reproducible. OpenAI suggests Flare when `gpt-image-2` quality is already enough and Sunburst where it falls short, and warns that speed and price differences depend on the workload. Tell the user which model you plan to use, and why, as part of the Confirm step.

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

Parameters: `prompt`, `outputPath`, `aspectRatio`, `model` (routes to Gemini or OpenAI by name), `referenceImages` (up to 5 absolute paths, PNG/JPEG/WebP), `mask`, `background`, `outputFormat` (the last three are OpenAI-only)

