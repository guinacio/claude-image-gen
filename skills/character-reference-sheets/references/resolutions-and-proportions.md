# Resolutions and proportions for AI-generated references

A general guide — it applies to any character or 3D prop. It complements the
prompt recipe, which lives in `prompt-template.md`.

---

## 1. What each provider actually delivers

**OpenAI (`gpt-image-2`) — only three sizes exist:**

| Aspect ratio | Pixels | Use |
|---|---|---|
| `1:1` | 1024 × 1024 | props, isolated pieces, hardware |
| `3:2` | 1536 × 1024 | lying down / horizontal |
| `2:3` | 1024 × 1536 | **standing character — the default** |

There is no 4K and no 2K. There is no 16:9. Any other ratio requested is
substituted with the closest one on the list.

**Gemini** honours the requested ratio natively and (on Pro versions) delivers
higher resolution. When fine detail matters more than composition, it is the
stronger side.

## 2. How the `create_asset` tool maps

The `aspectRatio` parameter accepts 7 values, but on OpenAI only **three are
exact**. The others are converted and the frame is recomposed — which breaks
alignment between views.

| You request | OpenAI delivers | Exact? |
|---|---|---|
| `1:1` | 1024 × 1024 | yes |
| `3:2` | 1536 × 1024 | yes |
| `2:3` | 1024 × 1536 | yes |
| `4:3` | 1536 × 1024 (3:2) | no, substituted |
| `16:9` | 1536 × 1024 (3:2) | no, substituted |
| `3:4` | 1024 × 1536 (2:3) | no, substituted |
| `9:16` | 1024 × 1536 (2:3) | no, substituted |

**Rule:** on OpenAI use only `1:1`, `3:2` or `2:3`. On Gemini, any of them.

## 3. Which ratio to use, by subject

| Subject | Ratio | Why |
|---|---|---|
| Standing biped (human, anthro) | `2:3` | the silhouette is tall and narrow |
| Quadruped, or long horizontal tail | `3:2` | the body is wider than it is tall |
| Isolated garment (vest, shorts, boot) | `2:3` | keeps the proportion of the view it came from |
| Small prop or hardware (buckle, crucifix, stud, link) | `1:1` | it is compact, a square wastes nothing |
| Long weapon, vehicle, environment | `3:2` | same as quadruped |

**Never request a full turnaround sheet** (front + side + back in a single
image). The model splits its pixel budget across the three and each view comes
out with a third of the detail. One view per call, always.

## 4. Margin — the subject has to fit **clothed**

This is the easiest mistake to make, because the base render looks perfect.

Clothing **grows outward past the nude silhouette**:

| Piece | Grows toward | How much (1.80 m character) |
|---|---|---|
| Shoulder spike | sides and up | 8-10 cm each side |
| Fur collar | up and around the neck | 5-8 cm |
| Hanging chain | down | 10-20 cm below the hem |
| Thick lug sole | down | 4-6 cm |
| Cargo pocket, thigh strap | sides | 3-5 cm |

Framed tight to the nude body, none of that has anywhere to go: the model either
crops at the edge or squeezes the piece to fit.

**But margin is not a fixed number — it is per edge, and it depends on the
outfit.** Reserving 12% at the top is pointless if the character wears no hat:
it is wasted pixels, and the body shrinks for nothing.

The method: for each edge, ask **what part of that outfit passes the nude
silhouette in that direction**, and reserve that plus a safety band of ~3%.

| Edge | Question | Typical |
|---|---|---|
| Sides | is the widest point the shoulder or the hand? | arms out → the hand rules, and a glove barely grows: **5-6%** |
| Bottom | thick sole, heel, hanging chain? | combat boot: **10%** · long chain: 15% |
| Top | hat, hood, horn, crest, collar rising past the head? | none of those: **4%** · with a hat: 15% |

Only reserve 12-15% on an edge when something really grows a lot there.
Symmetric margin by default is waste; **asymmetric is correct** when only one
edge needs it (e.g. 4% top, 16% bottom, for combat boots).

If the base render already has the character filling 95% of the height, it is
*wrong for this purpose*, however well framed it looks.

### A-pose or T-pose: width is what rules

With the arms out, what limits the framing **is not the height, it is the arm
span** — and only in the front and back views, because from the side the arms
disappear behind the body.

Practical consequence: **the front view sets the scale for all the others.**
Adjust Ortho Scale until the hands fit with 12% of slack in the front view, then
use exactly that value for the sides and the back, even if a lot of empty space
is left on the sides of the side view. Empty space is the price of alignment.

With the arms out, the body ends up occupying ~65-70% of the frame height, not
the 76% of the general rule. That is expected, not an error.

### On resolution: the gain is modest

A 1.80 m character filling the frame with correct margin:

| Framing | Body height | px per cm | 1 cm stud |
|---|---|---|---|
| 1024×1024, body at 96% of height | ~980 px | 5.4 | 5 px |
| 1024×1536, body at 76% of height | ~1170 px | 6.5 | 6-7 px |

That is ~22% of gain, not a game changer. Input fidelity matters more to fine
detail than this modest resolution increase. [OpenAI documents GPT Image
2](https://developers.openai.com/api/docs/models/gpt-image-2) as supporting
high-fidelity image inputs, but the current `create_asset` client does not
expose `input_fidelity`, so it uses the provider default. Do not claim that
`high` is enabled. Use `2:3` for the margin and for the subject's proportion,
not expecting a sharpness miracle.

## 5. Exporting from Blender

1. **Output Properties → Resolution X/Y**: set the final size directly —
   `1024 × 1536` for a standing character. Do not export square and crop later.
2. **Orthographic camera**, not perspective. Perspective distorts the silhouette
   and the views stop matching each other.
3. **Ortho Scale** adjusted so the body fills ~76% of the height, leaving 12-15%
   of slack top and bottom for the clothing to grow into.
4. **The same Ortho Scale in all views.** That is what guarantees front, side and
   back stay aligned and superimposable afterwards. To take a tail out of the
   frame in the side view, **move the camera**, do not change the scale.
5. **Flat white background** (white World) or transparent. No floor, no shadow,
   no HDRI — any gradient reads as "lighting" that the model tries to imitate.
6. **PNG**, never JPEG. Compression artefacts on a silhouette edge confuse the
   model and it reproduces the artefact.

**On the side view of a character with a long tail:** let the tail run out of
frame. Framing the whole tail forces a horizontal ratio and pushes the body —
which is where the clothing is — into a tiny corner.

## 6. Input images (the references)

- **Maximum 5** per call.
- Formats: PNG, JPEG, WebP.
- **They do not need to match the output size**, but they must match the
  **aspect ratio**. A square reference asking for a 2:3 output makes the model
  recompose, and the generated view stops aligning with the others.
- **Crop reference sheets** down to the relevant half only. A sheet with two
  views side by side and a caption makes the model reproduce a two-view layout
  instead of the object.
- A reference with a dark background and dramatic lighting (product photography)
  drags its style along. Either crop the background out, or state explicitly in
  the prompt that the image informs the design, not the appearance.

## 7. What to send to image-to-3D afterwards

The 3D generators (Tripo, Meshy, Rodin, Hunyuan3D, Trellis) want:

- **An isolated object**, no character, no mannequin, no floor
- **White or removed background**, flat
- **`1:1` works better** than 2:3 on most of them — reconstruction assumes a
  centred volume
- **Multi-view**: front and back of the **same** object, same framing, as
  separate images. Never the two glued into one image.

So: generate the clothed view at `2:3` to get detail, isolate the piece, and only
then reframe to `1:1` before sending it to the 3D generator.

## 8. Mandatory pre-flight check

**Measure the reference images before any `create_asset` call.** Generating from
a wrong base burns credit and produces an image that will be discarded.

Criteria, per image:

| Check | Pass | Fail → what to ask for |
|---|---|---|
| File aspect ratio | matches the requested `aspectRatio` | re-export at the correct ratio |
| Top margin | ≥ what the clothing grows there + 3% | see the per-edge table in section 4 |
| Bottom margin | ≥ what the clothing grows there + 3% | see the per-edge table in section 4 |
| Side margins | ≥ what the clothing grows there + 3% | see the per-edge table in section 4 |
| Body vertical occupancy | 75-85% | above 90% is too tight |
| Long tail or appendage in the side view | out of frame | "move the camera, do not change the scale" |
| Background | flat white or alpha | remove floor, shadow, gradient |
| Format | PNG | re-export without JPEG |
| Consistency between views | same Ortho Scale across all three | re-export the set |

If any item fails: **say so and ask for the fix, do not generate.** Re-exporting
from Blender is cheaper than discovering the crop after the image is finished.

Use `../scripts/measure.py` — it reports occupancy and margins for each render in
seconds.

## 9. One-line summary

Standing character → `2:3`, body at ~76% of the height with 12-15% of margin for
the clothing to grow into, orthographic, PNG, same Ortho Scale across all views.
Measure before generating. Isolated piece for 3D → `1:1`.
