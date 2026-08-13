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
| `--direct` | single-image path, skips multiview: 10 credits cheaper, less accurate geometry |
| `--no-texture` | geometry only, 10 credits cheaper |
| `--face-limit N` | cap the polygon count |
| `--name`, `--output-dir` | naming and destination |

## You supply one image, not four

Tripo's multiview pipeline generates the four views itself:

```
POST /v3/generation/image-to-multiview   { file_token }
POST /v3/generation/multiview-to-model   { input: <multiview task_id> }
```

Do **not** generate front/side/back views separately in an image model and feed
them in. Independently generated views disagree with each other — sole thickness
changes, details move — and a reconstructor asked to reconcile geometry that
does not close produces worse results than one clean view. Tripo's four views
come from an object it already reconstructed, so they agree by construction.

## What makes a good input

From Tripo's own guidance: **a front view on a clean background. Side views
reduce quality.**

That inverts the usual instinct of showing an object at three-quarters to convey
depth. When preparing the source image, frame the object front-on.

Also: one object per image, no character wearing it, no floor, no cast shadow.
Match the background value to the object — a white garment on a white background
leaves a soft silhouette edge and the reconstruction eats it. Use mid-grey for
pale objects.

## Costs

1 credit = $0.01 USD.

| Step | Credits |
|---|---|
| image-to-multiview | 10 |
| multiview-to-model, textured | 30 |
| multiview-to-model, geometry only | 20 |
| image-to-model (`--direct`), textured | 30 |

So the default pipeline is **40 credits, about $0.40** per piece; `--direct` is
30, and `--no-texture` takes 10 off either.

Add-ons exist and stack on the base (HD texture +10, HD geometry +20, quad mesh
+5, smart low-poly +10); the script does not request any of them.

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

## Related

`character-reference-sheets` covers producing the isolated garment image that
feeds this skill.
