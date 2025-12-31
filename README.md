# Gemini Image Generation MCP + Claude Skill

AI-powered image generation using Google Gemini, integrated with Claude Code via MCP (Model Context Protocol).

## Features

- Generate images from text prompts using Gemini AI
- Proactive Claude skill suggests images for websites, presentations, and more
- Configurable aspect ratios (1:1, 16:9, 9:16, etc.)
- Multiple model support (quality vs speed)
- Images saved to disk with file paths returned

## Prerequisites

- Node.js 18+
- Google Gemini API key ([Get one here](https://aistudio.google.com/apikey))

## Installation

### 1. Build the MCP Server

```bash
cd mcp-server
npm install
npm run build
```

### 2. Configure Environment

Set your Gemini API key:

```bash
# Windows
set GEMINI_API_KEY=your-api-key-here

# Linux/macOS
export GEMINI_API_KEY=your-api-key-here
```

### 3. Add to Claude Code

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "media-pipeline": {
      "command": "node",
      "args": ["/path/to/claude-image-gen/mcp-server/build/index.js"],
      "env": {
        "GEMINI_API_KEY": "your-api-key-here",
        "GEMINI_DEFAULT_MODEL": "gemini-3-pro-image-preview",
        "IMAGE_OUTPUT_DIR": "./generated-images"
      }
    }
  }
}
```

### 4. Install the Skill (Optional)

Copy the skill to your Claude Code skills directory:

```bash
cp -r skills/image-generation ~/.claude/skills/
```

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

## Design: Abstract MCP Naming

The MCP server uses intentionally abstract naming (`media-pipeline` / `create_asset`) rather than image-specific names (`gemini-image-gen` / `generate_image`).

**Why?** When tool names directly match intent (e.g., "I need to generate an image" → `generate_image`), AI assistants tend to call the MCP tool directly, bypassing the skill layer. By using generic names:

- The **skill** (`image-generation`) becomes the semantically obvious choice for image tasks
- The **MCP tool** doesn't immediately register as the solution
- The skill's prompt optimization and aspect ratio selection are properly utilized

This is a form of prompt engineering for tool selection—making the abstraction layer the natural choice while the underlying implementation has a name that doesn't invite direct use.

## Project Structure

```
claude-image-gen/
├── mcp-server/           # MCP server implementation
│   ├── src/
│   │   ├── index.ts      # Server entry point
│   │   ├── gemini-client.ts
│   │   ├── image-storage.ts
│   │   └── types.ts
│   ├── package.json
│   └── tsconfig.json
├── skills/               # Claude skills
│   └── image-generation/
│       ├── SKILL.md
│       └── references/
├── .mcp.json            # MCP configuration
└── README.md
```

## License

MIT
