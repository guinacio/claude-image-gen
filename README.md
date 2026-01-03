# Gemini Image Generation - Claude Skill + MCP

AI-powered image generation using Google Gemini, integrated with Claude Code.

## Features

- Generate images from text prompts using Gemini AI
- Proactive Claude skill suggests images for websites, presentations, and more
- **Two execution modes**: CLI script (skill-only) or MCP server (protocol-based)
- Configurable aspect ratios (1:1, 16:9, 9:16, etc.)
- Multiple model support (quality vs speed)
- Images saved to disk with file paths returned

## Prerequisites

- Google Gemini API key ([Get one here](https://aistudio.google.com/apikey))
- Node.js 18+ (only for manual installation)

## Installation

### Quick Install (Claude Code Plugin)

The plugin installs **skill + CLI + MCP server** in one step—no separate configuration needed.

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
- **Skill** uses the bundled CLI script (no MCP overhead)
- **MCP server** is also available for direct tool calls

---

### Quick Install (Claude Desktop Extension)

For Claude Desktop users, install the pre-built extension:

1. Download `media-pipeline.mcpb` from [Releases](https://github.com/guinacio/claude-image-gen/releases)
2. Open Claude Desktop
3. Go to **Settings** → **Extensions** → **Advanced settings**
4. Click **Install Extension** and select the `.mcpb` file
5. Enter your Gemini API key when prompted

---

### Manual Installation

For developers who want to customize or build from source:

#### 1. Build the MCP Server

```bash
cd mcp-server
npm install
npm run build
```

#### 2. Add to Claude Code

**Option A: Using CLI (recommended)**

```bash
claude mcp add --transport stdio media-pipeline \
  --env GEMINI_API_KEY=your-api-key-here \
  -- node /path/to/claude-image-gen/mcp-server/build/index.js
```

The `--` separates Claude CLI flags from the server command.

**Option B: Manual config**

Add to your Claude Code config (`~/.claude.json`):

```json
{
  "mcpServers": {
    "media-pipeline": {
      "command": "node",
      "args": ["/path/to/claude-image-gen/mcp-server/build/index.js"],
      "env": {
        "GEMINI_API_KEY": "${GEMINI_API_KEY}",
        "GEMINI_DEFAULT_MODEL": "${GEMINI_DEFAULT_MODEL:-gemini-3-pro-image-preview}",
        "IMAGE_OUTPUT_DIR": "${IMAGE_OUTPUT_DIR:-./generated-images}"
      }
    }
  }
}
```

The `${VAR:-default}` syntax uses environment variables with fallback defaults.

#### 3. Install Skill Manually (Optional)

If not using the plugin:

```bash
cp -r skills/image-generation ~/.claude/skills/
```

#### 4. Build Extension from Source (Optional)

To create your own `.mcpb` extension for Claude Desktop:

```bash
cd mcp-server
npm install -g @anthropic-ai/mcpb
mcpb pack
```

This creates a `media-pipeline.mcpb` file.

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
| `GEMINI_API_KEY` | Yes | - | Your Gemini API key |
| `GEMINI_DEFAULT_MODEL` | No | `gemini-3-pro-image-preview` | Default model to use |
| `IMAGE_OUTPUT_DIR` | No | `./generated-images` | Where to save images |

### Models

| Model | Description |
|-------|-------------|
| `gemini-3-pro-image-preview` | Higher quality, better style interpretation |
| `gemini-2.5-flash-image` | Faster generation, good for prototyping |

### Aspect Ratios

| Ratio | Best For |
|-------|----------|
| `1:1` | Social media, thumbnails |
| `16:9` | Hero images, presentations |
| `9:16` | Mobile stories, vertical banners |
| `4:3` | Blog posts, general web |
| `3:2` | Photography-style images |

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
Claude → Skill → Bash → CLI script → Gemini API
```
- No MCP protocol overhead
- Skill runs bundled CLI directly
- All dependencies bundled in single file

**MCP Mode (Optional)** - For direct tool calls:
```
Claude → MCP Tool → MCP Server → Gemini API
```
- Standard MCP protocol
- Useful for non-skill workflows
- Same bundled dependencies

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
│   │   ├── image-storage.ts
│   │   └── types.ts
│   ├── build/
│   │   ├── bundle.js     # Bundled MCP server
│   │   └── cli.bundle.js # Bundled CLI (all deps included)
│   ├── manifest.json     # MCPB extension manifest
│   ├── icon.png          # Extension icon
│   ├── package.json
│   └── tsconfig.json
├── skills/               # Claude skills
│   └── image-generation/
│       ├── SKILL.md      # Skill instructions (uses CLI)
│       └── references/
├── .mcp.json            # MCP configuration
└── README.md
```

## License

MIT
