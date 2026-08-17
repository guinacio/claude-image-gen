---
name: image-to-3d
description: Turn a generated or photographed image of a single object into a 3D mesh with the Tripo API, and download the GLB. Use when the request involves image-to-3D, photogrammetry-style reconstruction, turning a product shot or an isolated garment, prop or piece of hardware into a model for Blender, Unity or Unreal, or when Tripo, GLB output or 3D reconstruction credits come up. Not for generating the source image itself — the image-generation and character-reference-sheets skills cover that.
---

# Image to 3D with Tripo

One image of one isolated object goes in, a GLB comes out. The script in
`scripts/tripo.py` handles upload, submission, polling and download.

## Cost rule, before anything else

**Never submit a Tripo job without asking first.** Every run spends the user's
credits. The script enforces this: without `--yes` it prints the plan, the cost
and the account balance, and stops. Show that dry run, then wait for an explicit
go-ahead before adding `--yes`.

## Usage

```bash
python scripts/tripo.py piece.png --name sneaker --output-dir ./models
python scripts/tripo.py piece.png --name sneaker --output-dir ./models --yes
```

Needs `TRIPO_API_KEY` in the environment. Standard library only, no install.

| Flag | Effect |
|---|---|
| `--yes` | actually submit and spend |
| `--left`, `--back`, `--right` | supply your own views instead of letting Tripo invent them |
| `--direct` | single-image path, skips multiview: cheaper, least accurate geometry |
| `--model-version` | `v3.1-20260211` (default) or `v3.0-20250812` |
| `--name`, `--output-dir` | naming and destination |

Texture — all inert unless `--texture` is passed:

| Flag | Effect |
|---|---|
| `--texture` | also generate texture maps, 10 more credits (default: geometry only) |
| `--texture-quality detailed` | +10 credits |
| `--texture-alignment` | `original_image` (default) favours visual fidelity, `geometry` favours structure |
| `--texture-seed N` | repeatable texture |

Mesh:

| Flag | Effect |
|---|---|
| `--face-limit N` | cap the polygon count |
| `--geometry-quality detailed` | Tripo's Ultra mode, +20 credits |
| `--smart-low-poly` | the Smart Mesh of the web UI: built topology instead of a collapsed dense mesh, +10 credits |
| `--quad` | quads instead of triangles, +5 credits |
| `--generate-parts` | model split into parts, +20 credits; refuses to combine with textures or `--quad` |
| `--no-export-uv` | faster, but the mesh arrives with no UVs |
| `--compress geometry` | geometry compression instead of the default meshopt |

Other:

| Flag | Effect |
|---|---|
| `--auto-size` | scale to real-world metres; requires `--texture` |
| `--orientation align_image` | rotate the model to match the input image |
| `--model-seed N` | repeatable geometry |
| `--image-autofix` | let Tripo pre-process the input; slower |

## Low poly: build it or collapse it

Two ways to get a light mesh, and they are not equivalent.

**Collapse it afterwards.** Decimate the dense GLB you already have, in Blender
or any DCC. Free, keeps the shape you already approved, and preserves the UVs
well enough that the baked texture still lands. On a reconstruction of an
armoured character, 1.42M triangles came down to 150k with no visible
difference at all, and 50k held up with only the plate edges softening. What it
does *not* produce is topology: no deformation loops at shoulder, elbow or
knee, so it stays a static prop or a sculpting block rather than something to
rig.

**Have Tripo build it.** `--smart-low-poly` is a different reconstruction, not
a simplification of the previous one — a new `model_seed`, a new mesh from the
same views. It costs 10 credits, 5 more with `--quad`, and it constrains
`face_limit` to 1000-20000 (500-10000 with `--quad`), which is exactly the
budget of a riggable game character. Tripo's own warning applies: *"Inputs with
less complexity work best. There is a possibility of failure for complex
models."* Fine detail and clean topology compete at that polygon count —
expect separated fingers to merge and spikes to round off.

Recorded result on the armoured character, `--smart-low-poly --quad
--face-limit 10000`: 9859 quads and 2386 triangles, 11k vertices, one UV map,
one material. Against the 15k decimation of the same subject the silhouette is
comparable, but the wireframes are not: the decimation is a spray of thin
slivers with the density landing wherever the collapse happened to leave it,
while the smart mesh runs even quads that follow the surface, with ring loops
around limbs. Only one of the two is editable.

**`--quad` returns FBX, not GLB.** glTF has no quads, so the model URL of a
quad job carries a `.fbx` file — `Kaydara FBX Binary` in the first bytes.
`tripo.py` takes the extension from the URL for that reason; saving it as
`.glb` yields a file no importer opens, and nothing reveals the mistake until
the import fails.

## Supply your own views when the sides matter

There are two ways in and the difference is visible in the mesh.

With only a front image, `image-to-multiview` invents the other three views and
`multiview-to-model` reconstructs from them. Cheap, needs nothing, and the sides
come out wrong in a specific way: detail from the front gets wrapped around onto
faces the model never saw. On a pair of cargo trousers that meant pockets and
buckles appearing on the outer leg where none exist.

`multiview-to-model` also accepts images directly, which fixes exactly that:

```
inputs: [ {front: <token>}, {left: <token>}, {back: <token>}, {right: <token>} ]
```

The front view is required, the rest are optional, and at least two images are
needed in total. It is also **cheaper**, since the `image-to-multiview` step is
skipped.

**The list is positional.** Querying a finished task shows the API stored those
views as `files`, a list of exactly four entries in the order
`[front, left, back, right]`, with the names gone. The documented way to omit a
view is to leave its slot without a file token, not to shorten the list — so a
request carrying only a front and a back view, sent as two entries, risks having
the back view read as a left view. `tripo.py` always sends four slots for that
reason.

The catch is consistency: Tripo asks that all views show the same object under
consistent lighting. Three rules earn their keep here.

**Anchor each view on a reference that shows what it must inherit.** Generate
the extra views from one existing image rather than in a chain, so error does
not accumulate — but the anchor has to actually contain the information the new
view needs. A sneaker's inner side generated from its *front* view came back
with a different colour-blocking from its outer side, because the front shows no
side panel at all and left the model free to invent one. Re-anchored on the
outer profile, with the instruction to mirror the same panels minus the graphic,
it matched to within a point.

**Normalise the scale before uploading.** Even with "same framing" in the
prompt, views drift, because each is framed by whichever axis constrains it: a
side profile squeezed to fit a long object across the frame comes back with a
shorter subject than the front view of the same object. Height is the one
dimension every view of a standing object shares, so `scripts/normalize_views.py`
rescales them all to a common subject height. On a sneaker that closed a
15-point spread, and fixed a too-wide front view as a side effect, since both
errors came from the same scale drift.

**Omit a view rather than fabricate one.** Mirroring the left view into the
right is free and correct when the object is symmetric about that axis — a pair
of cargo trousers was. It is wrong when it is not: a sneaker carries its emblem
on the outer face only, and a shirt's chest pocket turned out to be visible in
profile, so mirroring would have asserted a pocket on the side that does not
have one. With two views minimum and the front required, dropping a view is
allowed. Tripo handles missing information better than contradictory
information.

Then verify by measuring: heights should agree within a point or two after
normalisation, and front and back should agree in width.

## What makes a good input

From Tripo's own guidance: **a front view on a clean background. Side views
reduce quality** — meaning as the *front* input, not as supplementary views.

One object per image, no character wearing it, no floor, no cast shadow. Match
the background value to the object: a white garment on a white background leaves
a soft silhouette edge and the reconstruction eats it. Use mid-grey for pale
objects.

## Costs

1 credit = $0.01 USD.

| Step | Credits |
|---|---|
| image-to-multiview | 10 |
| multiview-to-model / image-to-model, geometry only | 20 |
| the same, textured | 30 |

So supplying your own views costs **20 credits**, letting Tripo invent them
costs 30, and `--texture` adds 10 to either.

Geometry only is the default because reconstruction textures are baked from the
input views and tend to be replaced in the DCC anyway. The mesh is identical
either way — a model that arrived textured can simply have its material removed.

Add-ons stack on that base, and the script exposes all of them:

| Add-on | Credits |
|---|---|
| `--texture-quality detailed` | +10 |
| `--geometry-quality detailed` | +20 |
| `--smart-low-poly` | +10 |
| `--quad` | +5 |
| `--generate-parts` | +20 |

A dry run prints the add-ons it is about to request and the resulting total, and
a finished task reports `credits_consumed` — worth reading, since it is the only
confirmation of what was actually charged.

## What was verified, and what was only read

The parameters below all come from Tripo's published reference, and `tripo.py`
sends them under the documented names. That is not the same as having watched
each one change a result, so this is the split.

**Confirmed against the live API**, by reading back `GET /v3/tasks/{id}` after a
paid job and comparing `input` and `credits_consumed` with what was asked for:

| Parameter | What the run showed |
|---|---|
| `texture` + `pbr` | textured `multiview-to-model` billed exactly 30 credits |
| `smart_low_poly` + `quad` + `face_limit: 10000` | billed 45, and returned 9859 quads with 2386 triangles — inside the requested cap |
| `model_version` | echoed back as `v3.1-20260211`, so the field name is read |
| `inputs` with named views | stored as positional `files`, names discarded |
| `export_uv`, `geometry_quality: standard` | appear in the stored input as defaults, unset |

Also confirmed by inspecting the downloaded file: a `quad` job answers with
**FBX**, not glTF.

**Documented but not exercised here.** Each one was accepted by a dry run, which
only proves the flag parses and the cost adds up — not that Tripo honours it:
`texture_quality`, `texture_alignment`, `texture_seed`, `model_seed`,
`enable_image_autofix`, `auto_size`, `orientation`, `compress`, `export_uv:
false`, `generate_parts`, `geometry_quality: detailed`. The pricing for those
comes from the published table rather than from an observed
`credits_consumed`, and the single-image paths (`--direct` and the
`image-to-multiview` step) were not run either.

The local validation rules — the `face_limit` ranges, `generate_parts` refusing
textures and quads, `auto_size` needing a texture — are transcribed from the
documentation, not discovered by having a job rejected. They fail early on
purpose: cheaper than paying to find out.

## API shape

```
Base   https://openapi.tripo3d.ai/v3
Auth   Authorization: Bearer {api_key}
OK     {"code": 0, "data": {...}}
Error  {"code": 2010, "message": "Insufficient credits", "suggestion": "..."}
```

Generation is asynchronous: POST returns a `task_id`, then `GET /v3/tasks/{id}`
until `status` is `success`. Statuses are `queued`, `running`, `success`,
`failed`, `cancelled`. Poll every 2 seconds and stay under 1 request/second.

**Result URLs expire five minutes after the task succeeds**, which is why the
script downloads immediately instead of printing the URL. If a run is
interrupted between success and download, the task itself is still on Tripo's
side — query it again and resubmit nothing.

Other endpoints, not used by the script but available: `POST /v3/models/convert`
(format), `POST /v3/mesh/decimate` (retopology), `POST /v3/mesh/segment`
(semantic segmentation), `POST /v3/animations/rig-check` (free) and
`POST /v3/animations/rig`.

## After the GLB

Blender imports GLB directly, so no conversion step is needed. Treat the result
as a starting block, not a finished asset: expect to retopologise and to fix
hardware, which is where reconstruction is weakest.

## Scripts

- `scripts/tripo.py` — upload, submit, poll, download
- `scripts/normalize_views.py` — match the subject scale across a set of views

Both need Pillow; `normalize_views.py` also needs NumPy. See `requirements.txt`.

## Related

`character-reference-sheets` covers producing the isolated garment image that
feeds this skill.
