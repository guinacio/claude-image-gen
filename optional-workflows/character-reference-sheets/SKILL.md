---
name: character-reference-sheets
description: Dress 3D character base renders with AI-generated clothing while preserving the body, pose and framing, so each garment can be cut out and sent to image-to-3D generators. Use when the request involves a Blender base render in A-pose or T-pose, a character visual sheet, a turnaround, generating clothing over a nude body mesh, or preparing garment pieces for Tripo, Meshy, Rodin, Hunyuan3D or Trellis. Do not use for website, banner or presentation imagery — the image-generation skill covers that.
---

# Character reference sheets

Pipeline: a nude body render comes out of Blender, the model dresses that body,
each garment is cut out, it goes to an image-to-3D generator, and the mesh comes
back into Blender.

The goal of the generation is **not a beautiful image**. It is the *same body*
as the render, now clothed, with every piece legible and cuttable. Everything
below exists to protect that.

## Cost rule, before anything else

**Never call `create_asset` without asking first.** Every generation spends the
user's API credit. Write the full prompt, surface the decisions that change the
image, and wait for an explicit go-ahead. This applies to each retry after a bad
result too — do not silently fix and re-run.

## Workflow

1. **Measure the input renders** with `scripts/measure.py`. If any criterion in
   section 8 of `references/resolutions-and-proportions.md` fails, say so and ask
   for a re-export from Blender. Cheaper than discovering the problem after the
   image is paid for.
2. **Flatten alpha onto white** if the PNG is RGBA. Alpha often becomes black on
   upload and contaminates the result.
3. **Build the prompt** using the architecture in `references/prompt-template.md`.
4. **Ask for permission to generate.**
5. **Generate**, one view per call.
6. **Measure the output** and compare against the input (thresholds below).
7. **Copy** from `IMAGE_OUTPUT_DIR` into the character project's own output
   folder, with a descriptive versioned name: `character_outfit_front_v2.png`.

## Measurement dependency

`scripts/measure.py` requires Python and Pillow. Before first use, ask before
installing the dependency, then run:

```bash
python -m pip install -r /path/to/character-reference-sheets/requirements.txt
```

If Pillow is unavailable and cannot be installed, do not generate: report that
the mandatory pre-flight measurement could not be completed.

## The rule that matters most

**Never describe the body in the prompt.** Not the build, not shoulder width,
not head size, not height. Describing anatomy makes the model *draw a new body
from the text* instead of preserving the one in the image.

Recorded case: a prompt opening with "heavyset bara-build, very broad shoulders,
thick muscular arms, wide barrel chest, heavy thighs, small head" collapsed the
character's arm span from 88.9% to 74.3% of the frame width — **14.6 points**.
Same character, same render, same model, rebuilt with the correct architecture
and zero body description: 89.2%, a 0.3 point deviation.

The prompt says **what to add** and **what to preserve**. Never what the body is.

## Parameters

| | |
|---|---|
| Model | `gpt-image-2` |
| Aspect ratio | `2:3` for a standing character · `1:1` for an isolated garment or prop |
| Quality | Provider default — the current `create_asset` client does not expose `quality` |
| `input_fidelity` | Provider default — the current client does not expose this option. [OpenAI documents GPT Image 2](https://developers.openai.com/api/docs/models/gpt-image-2) as supporting high-fidelity image inputs, but this workflow does not explicitly request `high` |
| References | 2 to 4, base image **first** |
| Turnarounds | never in a single image — one view per call |

## Verification after generating

Run `scripts/measure.py` on the input and the output and compare **horizontal
occupancy** (`ocup_h`):

| `ocup_h` deviation | Reading |
|---|---|
| within ±2 points | normal, accept |
| beyond ±2 points | the prompt let the model redraw the body — regenerate |

Empirical basis: crocodile character +1.6 / −1.4 across three generations; tiger
v2 +0.3; tiger v1 (wrong prompt) −14.6.

Vertical occupancy usually rises 2 to 4 points even when everything is right. On
its own it is not a failure signal.

## Known residual: limbs get thinner

In **every** recorded generation so far — three of one character, two of another
— arms and thighs came out with less volume than the base render. The `PRESERVE`
block fixes framing and scale; it does **not** fix muscle mass.

Do not treat this as a new bug on each character. Practical consequences:

- Leg and foot pieces (pants, boots, sneakers) — safe to cut out, limb volume
  does not drive the garment's shape.
- **Torso pieces** (shirt, vest, jacket) — they were modelled over a narrower
  torso than the original mesh. The generated 3D tends to come out tight. Warn
  the user before they send it to an image-to-3D generator.

## Where output lands

The server writes to `IMAGE_OUTPUT_DIR` (an MCP environment variable) and
rejects any `outputPath` outside it. Pass a bare filename and copy the result
into the character's folder afterwards.

## References

- `references/prompt-template.md` — the prompt architecture, with a real example
- `references/resolutions-and-proportions.md` — aspect ratios, per-edge margins,
  Blender export settings, the mandatory pre-flight check, and what to feed an
  image-to-3D generator
- `scripts/measure.py` — bounding box, occupancy and margins
