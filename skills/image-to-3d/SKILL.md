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
| `--texture` | also generate texture maps, 10 more credits (default: geometry only) |
| `--face-limit N` | cap the polygon count |
| `--geometry-quality detailed` | Tripo's Ultra mode, extra credits |
| `--name`, `--output-dir` | naming and destination |

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

Add-ons exist and stack on the base (HD texture +10, HD geometry +20, quad mesh
+5, smart low-poly +10); the script requests none of them except
`--geometry-quality detailed`.

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
