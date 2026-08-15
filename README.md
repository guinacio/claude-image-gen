# AI Image Generation - Claude Skill + MCP

AI-powered image generation using Google Gemini or OpenAI (gpt-image-2), integrated with Claude Code.

## Features

- Generate images from text prompts using Google Gemini or OpenAI (gpt-image-2)
- **Dual-provider support**: model name routes the request automatically (gpt-image*/dall-e* → OpenAI, everything else → Gemini)
- Proactive Claude skill suggests images for websites, presentations, and more
- Opt-in specialized workflows for narrower production pipelines, without adding them to every installation
- **Two execution modes**: CLI script (skill-only) or MCP server (protocol-based)
- Configurable aspect ratios (1:1, 16:9, 9:16, etc.)
- Multiple model support (quality vs speed) across both providers
- Optional reference images to guide generation (up to 5, PNG/JPEG/WebP) on both providers
- Inpainting with a PNG mask, plus `background` and `outputFormat` control, on OpenAI models
- Images saved to disk within the configured output directory, with file paths returned
- MCP server speaks the MCP 2026-07-28 spec, with backward compatibility for older MCP clients

## Prerequisites

- Google Gemini API key ([Get one here](https://aistudio.google.com/apikey)) and/or an OpenAI API key ([Get one here](https://platform.openai.com/api-keys)) — at least one is required
- Node.js 20+ (only for manual installation)

## Installation

### Quick Install (Claude Code Plugin)

The plugin installs the **core image-generation skill + CLI + MCP server** in one step—no separate configuration needed. Specialized workflows are intentionally opt-in.

```bash
# Add the marketplace
/plugin marketplace add guinacio/claude-image-gen

# Install the plugin
/plugin install media-pipeline@media-pipeline-marketplace
```

Or install directly from GitHub:

```bash
/plugin install guinacio/claude-image-gen
```

Once installed:
- **Core skill** uses the bundled CLI script (no MCP overhead)
- **MCP server** is also available for direct tool calls
- **Specialized workflows** are not auto-installed; add only the ones you need

> **Tip:** Since the skill runs the CLI directly, you can disable the MCP server in Claude Code's MCP list to reduce startup overhead. The skill will continue to work without it.

---

### Quick Install (Claude Desktop Extension)

For Claude Desktop users, install the pre-built extension:

1. Download `media-pipeline.mcpb` from [Releases](https://github.com/guinacio/claude-image-gen/releases)
2. Open Claude Desktop
3. Go to **Settings** → **Extensions** → **Advanced settings**
4. Click **Install Extension** and select the `.mcpb` file
5. Enter your Gemini and/or OpenAI API key when prompted (at least one is required)

---

### Manual Installation

For developers who want to customize or build from source:

#### 1. Build the MCP Server

```bash
cd mcp-server
npm install
npm run bundle
```

#### 2. Use the Standalone CLI

```bash
cd mcp-server
GEMINI_API_KEY=your-api-key-here node build/cli.bundle.js \
  --prompt "Landing page hero image for a fintech startup" \
  --aspect-ratio "16:9"
```

The CLI routes to Gemini or OpenAI based on the model name and returns structured JSON on stdout. It does not require the MCP server layer.
Any custom output path must still remain inside the configured output directory.

#### 3. Add to Claude Code

**Option A: Using MCP server**

```bash
claude mcp add --transport stdio media-pipeline \
  --env GEMINI_API_KEY=your-api-key-here \
  -- node /path/to/claude-image-gen/mcp-server/build/bundle.js
```

The `--` separates Claude CLI flags from the server command.

**Option B: Manual config**

Add to your Claude Code config (`~/.claude.json`):

```json
{
  "mcpServers": {
    "media-pipeline": {
      "command": "node",
      "args": ["/path/to/claude-image-gen/mcp-server/build/bundle.js"],
      "env": {
        "GEMINI_API_KEY": "${GEMINI_API_KEY}",
        "GEMINI_DEFAULT_MODEL": "${GEMINI_DEFAULT_MODEL:-gemini-3-pro-image-preview}",
        "OPENAI_API_KEY": "${OPENAI_API_KEY}",
        "OPENAI_DEFAULT_MODEL": "${OPENAI_DEFAULT_MODEL:-gpt-image-2}",
        "IMAGE_PROVIDER": "${IMAGE_PROVIDER:-gemini}",
        "IMAGE_OUTPUT_DIR": "${IMAGE_OUTPUT_DIR:-./generated-images}",
        "GEMINI_REQUEST_TIMEOUT_MS": "${GEMINI_REQUEST_TIMEOUT_MS:-60000}",
        "MEDIA_PIPELINE_LOG_LEVEL": "${MEDIA_PIPELINE_LOG_LEVEL:-info}"
      }
    }
  }
}
```

The `${VAR:-default}` syntax uses environment variables with fallback defaults.

#### 4. Install Skill Manually (Optional)

If not using the plugin:

```bash
cp -r skills/image-generation ~/.claude/skills/
```

#### 5. Install a Specialized Workflow (Optional)

Specialized workflows live outside `skills/`, so the plugin does not discover
or install them automatically. The current character-reference workflow is for
dressing Blender character renders and preparing garments for image-to-3D tools.

From a cloned repository:

```bash
python -m pip install -r optional-workflows/character-reference-sheets/requirements.txt
cp -r optional-workflows/character-reference-sheets ~/.claude/skills/
```

#### 6. Build Extension from Source (Optional)

To create your own `.mcpb` extension for Claude Desktop:

```bash
cd mcp-server
npm install -g @anthropic-ai/mcpb
npm run pack:mcpb
```

This creates `mcp-server/media-pipeline.mcpb` using bundled runtime entry points for both the MCP server and the standalone CLI.

#### Versioning

`mcp-server/package.json` is the single source of truth for the version. `mcp-server/manifest.json`, `mcp-server/package-lock.json`, `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` are all derived from it — never edit their version fields by hand.

To bump:

```bash
cd mcp-server && npm version minor --no-git-tag-version
```

`npm version` updates `package.json` and the lockfile, then the `version` lifecycle script propagates it to the remaining manifests and stages them. `npm run sync:version` does the same propagation on its own, and `npm run check:version` reports drift without writing. Both `npm test` and `npm run pack:mcpb` fail on drift, so a release cannot ship with mismatched manifests.

## Usage

### Direct Tool Usage

```
Use create_asset to create a hero image for a tech startup website
```

### With the Skill

The skill will proactively suggest image generation when:
- Building websites with hero sections
- Creating presentations
- Working with placeholder images
- Developing marketing materials

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | At least one of `GEMINI_API_KEY` / `OPENAI_API_KEY` | - | Your Gemini API key |
| `GEMINI_DEFAULT_MODEL` | No | `gemini-3-pro-image-preview` | Default Gemini model to use |
| `OPENAI_API_KEY` | At least one of `GEMINI_API_KEY` / `OPENAI_API_KEY` | - | Your OpenAI API key |
| `OPENAI_DEFAULT_MODEL` | No | `gpt-image-2` | Default OpenAI model to use |
| `IMAGE_PROVIDER` | No | `gemini` | Provider (`gemini` or `openai`) used when a request omits `model` |
| `IMAGE_OUTPUT_DIR` | No | `~/generated-images` | Where to save images |
| `GEMINI_REQUEST_TIMEOUT_MS` | No | `60000` | Request timeout, applies to both Gemini and OpenAI requests |
| `MEDIA_PIPELINE_LOG_LEVEL` | No | `info` | Stderr logging level |

### Providers

The server is dual-provider: it routes each request to Google Gemini or OpenAI (`gpt-image-2`) automatically based on the `model` name — models starting with `gpt-image` or `dall-e` go to OpenAI, everything else goes to Gemini. When a request omits `model` entirely, `IMAGE_PROVIDER` selects which provider's default model is used.

- **Aspect ratios on OpenAI**: OpenAI image models only support `1024x1024`, `1536x1024`, and `1024x1536`. Requested aspect ratios are mapped to the nearest supported size, and if the mapping isn't exact the response includes a warning describing the substitution.
- **Reference images**: supported on both providers — pass up to 5 reference image paths to guide generation.
- **`mask`, `background`, `outputFormat`**: OpenAI models only — Gemini models reject them.
  - `mask` takes an absolute path to a PNG whose transparent areas are the region the model repaints; everything else is preserved from the base image. It requires `referenceImages`, and [OpenAI documents](https://developers.openai.com/api/docs/guides/image-generation) the mask as needing an alpha channel and the same dimensions as the base image. Checked locally: the file really is a PNG, and it is not fully opaque — an opaque mask marks nothing, so it is rejected before the request is sent. Left to the API: the dimension match, and whether a PNG carrying transparency in a `tRNS` chunk instead of an alpha channel is accepted — that case is sent with a warning rather than blocked.
  - `background` (`auto`, `transparent`, `opaque`) chooses how the background is handled. `transparent` needs an alpha-capable `outputFormat`, so `png` is selected automatically when `outputFormat` is omitted. `gpt-image-2` rejects `transparent`, and that combination is refused before the request is sent.
  - `outputFormat` (`png`, `jpeg`, `webp`) sets the encoding of the returned image; `jpeg` cannot carry transparency.

  Apart from the `gpt-image-2`/`transparent` case above, these three options have not been verified against a live API — when a model refuses one, the API's own reason is returned.

### Models

Gemini models are fetched dynamically from the Gemini API at runtime; the CLI and MCP tool validate Gemini model choices against the current image-capable model list, and `GEMINI_DEFAULT_MODEL` is used when available. For OpenAI, `gpt-image-2` is the default model (`OPENAI_DEFAULT_MODEL`); any `gpt-image*`/`dall-e*` model name routes to OpenAI.

### Aspect Ratios

| Ratio | Best For |
|-------|----------|
| `1:1` | Social media, thumbnails |
| `16:9` | Hero images, presentations |
| `9:16` | Mobile stories, vertical banners |
| `4:3` | Blog posts, general web |
| `3:2` | Photography-style images |

> On OpenAI models, aspect ratios other than `1:1`/`3:2`/`2:3`-equivalent are mapped to the nearest supported size (see [Providers](#providers)).

## Prompt Tips

Use this formula for effective prompts:

```
[Style] [Subject] [Composition] [Context/Atmosphere]
```

Example:
```
Minimalist 3D illustration of abstract geometric shapes floating in space,
soft gradient background from deep purple to electric blue, subtle glow effects,
modern professional aesthetic, wide composition for website header
```

See [skills/image-generation/references/prompt-crafting.md](skills/image-generation/references/prompt-crafting.md) for advanced techniques.

## Architecture

### Two Execution Modes

**CLI Mode (Default)** - Used by the skill:
```
Claude → Skill → Bash → bundled CLI → Gemini API / OpenAI API
```
- No MCP protocol overhead
- Skill runs bundled CLI directly
- All dependencies bundled in a single file

**MCP Mode (Optional)** - For direct tool calls:
```
Claude → MCP Tool → bundled MCP server → Gemini API / OpenAI API
```
- Speaks the MCP 2026-07-28 spec, with backward-compatible fallback for older MCP clients
- Useful for non-skill workflows
- Extension package only needs bundled entry points

### Abstract MCP Naming

The MCP server uses intentionally abstract naming (`media-pipeline` / `create_asset`) rather than image-specific names (`gemini-image-gen` / `generate_image`).

**Why?** When tool names directly match intent (e.g., "I need to generate an image" → `generate_image`), AI assistants tend to call the MCP tool directly, bypassing the skill layer. By using generic names:

- The **skill** (`image-generation`) becomes the semantically obvious choice for image tasks
- The **MCP tool** doesn't immediately register as the solution
- The skill's prompt optimization and aspect ratio selection are properly utilized

This is a form of prompt engineering for tool selection—making the abstraction layer the natural choice while the underlying implementation has a name that doesn't invite direct use.

## Project Structure

```
claude-image-gen/
├── .claude-plugin/       # Plugin configuration
│   ├── plugin.json       # Plugin manifest
│   └── marketplace.json  # Marketplace distribution
├── mcp-server/           # Server and CLI implementation
│   ├── src/
│   │   ├── index.ts      # MCP server entry point
│   │   ├── cli.ts        # CLI entry point (skill uses this)
│   │   ├── gemini-client.ts
│   │   ├── openai-client.ts
│   │   ├── provider.ts   # Routes requests to Gemini or OpenAI by model name
│   │   ├── image-storage.ts
│   │   └── types.ts
│   ├── build/
│   │   ├── bundle.js     # Bundled MCP server
│   │   └── cli.bundle.js # Bundled CLI (all deps included)
│   ├── .mcpbignore       # Package only the runtime files needed by the bundle
│   ├── manifest.json     # MCPB extension manifest
│   ├── icon.png          # Extension icon
│   ├── package.json
│   └── tsconfig.json
├── skills/               # Core skills installed with the plugin
│   └── image-generation/
│       ├── SKILL.md      # Skill instructions (uses CLI)
│       └── references/
├── optional-workflows/   # Specialized skills installed explicitly
│   └── character-reference-sheets/
│       ├── SKILL.md
│       ├── references/
│       ├── requirements.txt
│       └── scripts/
├── .mcp.json            # MCP configuration
└── README.md
```

## License

MIT
