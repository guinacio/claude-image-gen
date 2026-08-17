#!/usr/bin/env python3
"""Turn a single image into a 3D model with the Tripo API.

Standard library only -- no pip install needed.

    python tripo.py front.png                          # dry run, spends nothing
    python tripo.py front.png --yes                    # one image, Tripo invents the rest
    python tripo.py front.png --back b.png --left l.png --yes   # your own views
    python tripo.py front.png --yes --texture          # also generate texture maps
    python tripo.py front.png --yes --smart-low-poly --face-limit 10000 --quad

Two ways in, and the difference matters.

With only a front image, Tripo generates four views itself and reconstructs
from those. It is cheap and needs nothing from you, but the sides and back are
invented -- which shows up as detail from the front smeared around onto faces
the model never saw.

Supplying your own views fixes exactly that. The front view is required;
left, back and right are optional, and at least two images total are needed.
All views must show the same object under consistent lighting, so generate
them with the front image as a reference rather than from scratch.

The API takes the views as a list of exactly four slots in the order
[front, left, back, right], and a view is omitted by leaving its slot without a
file token rather than by shortening the list. This script always sends four
slots, so a run passing only --back cannot silently have its back view read as
a left view.

Nothing is spent without --yes. A run without it prints the plan, the credit
cost and the account balance, and stops.

Geometry only is the default. Reconstruction textures are baked from the input
views and are usually replaced in the DCC anyway, so paying for them is opt-in
via --texture.

Credit costs come from the published pricing table (1 credit = $0.01 USD):

    image-to-multiview                    10   (only when views are invented)
    multiview-to-model  plain  20   textured  30
    image-to-model      plain  20   textured  30   (--direct)

    add-ons, stacking on that base:
        --texture-quality detailed        +10
        --geometry-quality detailed       +20
        --smart-low-poly                  +10
        --quad                             +5
        --generate-parts                  +20
"""

import argparse
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

API_BASE = "https://openapi.tripo3d.ai/v3"
POLL_SECONDS = 2
DEFAULT_TIMEOUT_SECONDS = 600

MODEL_VERSIONS = ["v3.1-20260211", "v3.0-20250812"]
DEFAULT_MODEL_VERSION = MODEL_VERSIONS[0]

# The four view slots, in the order the API expects them.
VIEW_ORDER = ["front", "left", "back", "right"]

COST_IMAGE_TO_MULTIVIEW = 10
COST_TO_MODEL = {True: 30, False: 20}  # keyed by "textured"
COST_TEXTURE_DETAILED = 10
COST_GEOMETRY_DETAILED = 20
COST_SMART_LOW_POLY = 10
COST_QUAD = 5
COST_GENERATE_PARTS = 20

# Tripo narrows face_limit when it is building topology rather than collapsing it.
FACE_LIMIT_SMART = (1000, 20000)
FACE_LIMIT_SMART_QUAD = (500, 10000)
FACE_LIMIT_QUAD_ADVISED = 150000

TERMINAL_FAILURES = {"failed", "cancelled"}


class TripoError(RuntimeError):
    """An error the API reported, or a transport failure talking to it."""


def api_key():
    key = os.environ.get("TRIPO_API_KEY", "").strip()
    if not key:
        raise TripoError(
            "TRIPO_API_KEY is not set. Create a key at "
            "https://developers.tripo3d.ai/en/keys and put it in that "
            "environment variable."
        )
    return key


def _send(request):
    """Send a prepared request and unwrap Tripo's {code, data} envelope."""
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            raise TripoError(f"HTTP {error.code}: {body[:400]}") from error
        raise TripoError(_describe(parsed)) from error
    except urllib.error.URLError as error:
        raise TripoError(f"Could not reach the Tripo API: {error.reason}") from error

    if payload.get("code") != 0:
        raise TripoError(_describe(payload))

    return payload.get("data", {})


def _describe(payload):
    """Render an error envelope, keeping the suggestion the API offers."""
    code = payload.get("code", "?")
    message = payload.get("message", "unknown error")
    suggestion = payload.get("suggestion")
    described = f"Tripo error {code}: {message}"
    return f"{described} — {suggestion}" if suggestion else described


def get(path):
    request = urllib.request.Request(
        f"{API_BASE}{path}",
        headers={"Authorization": f"Bearer {api_key()}"},
        method="GET",
    )
    return _send(request)


def post(path, body):
    request = urllib.request.Request(
        f"{API_BASE}{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key()}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    return _send(request)


def upload(image_path):
    """Upload an image and return its file_token."""
    boundary = uuid.uuid4().hex
    mime = mimetypes.guess_type(image_path.name)[0] or "application/octet-stream"
    head = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{image_path.name}"\r\n'
        f"Content-Type: {mime}\r\n\r\n"
    ).encode("utf-8")
    tail = f"\r\n--{boundary}--\r\n".encode("utf-8")

    request = urllib.request.Request(
        f"{API_BASE}/files",
        data=head + image_path.read_bytes() + tail,
        headers={
            "Authorization": f"Bearer {api_key()}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    return _send(request)["file_token"]


def poll(task_id, timeout_seconds):
    """Wait for a task to finish. Tripo asks for no more than 1 request/second."""
    deadline = time.monotonic() + timeout_seconds
    last_progress = None

    while True:
        data = get(f"/tasks/{task_id}")
        status = data.get("status")

        if status == "success":
            print(f"  {task_id}: done")
            return data

        if status in TERMINAL_FAILURES:
            raise TripoError(f"Task {task_id} ended as {status}: {json.dumps(data)}")

        progress = data.get("progress")
        if progress != last_progress:
            print(f"  {task_id}: {status} {progress}%")
            last_progress = progress

        if time.monotonic() > deadline:
            raise TripoError(
                f"Task {task_id} still {status} after {timeout_seconds}s. "
                "It may yet finish; query it later with GET /v3/tasks/"
                f"{task_id}."
            )

        time.sleep(POLL_SECONDS)


def download(url, destination):
    """Fetch a result file. Tripo's URLs expire five minutes after the task
    succeeds, so this runs immediately rather than being left to the caller."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        with urllib.request.urlopen(url, timeout=300) as response:
            destination.write_bytes(response.read())
    except urllib.error.URLError as error:
        raise TripoError(
            f"Task succeeded but the download failed: {error.reason}. "
            "Result URLs expire five minutes after the task finishes."
        ) from error
    return destination


MODEL_SUFFIXES = {".glb", ".gltf", ".fbx", ".obj", ".usdz", ".zip"}


def model_suffix(url):
    """The extension Tripo actually returned, rather than an assumed .glb.

    glTF has no quads, so a job asking for --quad comes back as FBX. Naming
    that file .glb produces something no importer will open, and the mistake is
    invisible until the import fails."""
    suffix = Path(urllib.parse.urlparse(url).path).suffix.lower()
    return suffix if suffix in MODEL_SUFFIXES else ".glb"


def show_balance():
    """Print the account balance. The response shape is not documented on the
    pages this script was written against, so whatever comes back is shown."""
    try:
        data = get("/account/balance")
    except TripoError as error:
        print(f"Could not read the balance: {error}")
        return None

    print(f"Balance: {json.dumps(data)}")
    return data


def addon_costs(args, textured):
    """The extras that stack on top of the base reconstruction price."""
    addons = []
    if textured and args.texture_quality == "detailed":
        addons.append(("texture_quality=detailed", COST_TEXTURE_DETAILED))
    if args.geometry_quality == "detailed":
        addons.append(("geometry_quality=detailed", COST_GEOMETRY_DETAILED))
    if args.smart_low_poly:
        addons.append(("smart_low_poly", COST_SMART_LOW_POLY))
    if args.quad:
        addons.append(("quad", COST_QUAD))
    if args.generate_parts:
        addons.append(("generate_parts", COST_GENERATE_PARTS))
    return addons


def check_options(args, textured):
    """Reject the combinations the API refuses, before anything is spent.

    Cheaper to fail here than to have a submitted job rejected, and clearer
    than reading back Tripo's validation message."""
    if args.smart_low_poly:
        low, high = FACE_LIMIT_SMART_QUAD if args.quad else FACE_LIMIT_SMART
        with_quad = " (with --quad)" if args.quad else ""
        if args.face_limit is None:
            raise TripoError(
                f"--smart-low-poly needs --face-limit between {low} and {high}"
                f"{with_quad}."
            )
        if not low <= args.face_limit <= high:
            raise TripoError(
                f"--face-limit {args.face_limit} is outside {low}-{high}, the "
                f"range Tripo accepts with --smart-low-poly{with_quad}."
            )

    if args.generate_parts:
        conflicts = [
            flag
            for flag, on in (("--texture", textured), ("--quad", args.quad))
            if on
        ]
        if conflicts:
            raise TripoError(
                "--generate-parts cannot be combined with "
                + " or ".join(conflicts)
                + ": Tripo returns parts as untextured triangle meshes."
            )

    if args.auto_size and not textured:
        raise TripoError("--auto-size needs a textured model; add --texture.")

    if args.quad and args.face_limit and not args.smart_low_poly:
        if args.face_limit > FACE_LIMIT_QUAD_ADVISED:
            print(
                f"Note: --face-limit {args.face_limit} is above the "
                f"{FACE_LIMIT_QUAD_ADVISED} Tripo advises for quad output.",
                file=sys.stderr,
            )


def reconstruction_body(args, textured):
    """The parameters shared by both reconstruction endpoints."""
    body = {
        "model_version": args.model_version,
        "texture": textured,
        "pbr": textured,
    }

    if textured:
        body["texture_quality"] = args.texture_quality
        body["texture_alignment"] = args.texture_alignment
        if args.texture_seed is not None:
            body["texture_seed"] = args.texture_seed

    if args.face_limit:
        body["face_limit"] = args.face_limit
    if args.geometry_quality:
        body["geometry_quality"] = args.geometry_quality
    if args.smart_low_poly:
        body["smart_low_poly"] = True
    if args.quad:
        body["quad"] = True
    if args.generate_parts:
        body["generate_parts"] = True
    if args.auto_size:
        body["auto_size"] = True
    if args.orientation != "default":
        body["orientation"] = args.orientation
    if args.compress:
        body["compress"] = args.compress
    if args.no_export_uv:
        body["export_uv"] = False
    if args.model_seed is not None:
        body["model_seed"] = args.model_seed
    if args.image_autofix:
        body["enable_image_autofix"] = True

    return body


def view_slots(front_token, supplied_views):
    """Build the four positional slots the API expects.

    The API stores the views as a list of exactly four entries in the order
    [front, left, back, right], and a missing view is a slot without a token
    rather than a shorter list. Sending named keys works, but sending four
    slots means a run that supplies only --back cannot have that view land in
    the left position."""
    slots = [{"front": front_token}]
    for view in VIEW_ORDER[1:]:
        token = supplied_views.get(view)
        slots.append({view: token} if token else {})
    return slots


def run(image_path, args):
    textured = args.texture
    name = args.name or image_path.stem
    output_dir = Path(args.output_dir).expanduser()

    # front is required by the API; the others are optional, minimum two total.
    supplied_views = {
        view: getattr(args, view) for view in VIEW_ORDER[1:] if getattr(args, view)
    }

    if args.direct and supplied_views:
        raise TripoError("--direct takes a single image; drop the extra views.")

    check_options(args, textured)

    if supplied_views:
        steps = [("multiview-to-model", COST_TO_MODEL[textured])]
    elif args.direct:
        steps = [("image-to-model", COST_TO_MODEL[textured])]
    else:
        steps = [
            ("image-to-multiview", COST_IMAGE_TO_MULTIVIEW),
            ("multiview-to-model", COST_TO_MODEL[textured]),
        ]

    addons = addon_costs(args, textured)
    total = sum(cost for _, cost in steps) + sum(cost for _, cost in addons)

    print(f"Front:    {image_path}")
    for view, path in supplied_views.items():
        print(f"{view.capitalize() + ':':<10}{path}")
    if not supplied_views and not args.direct:
        print("Views:    generated by Tripo (sides and back are invented)")
    print(f"Pipeline: {' -> '.join(step for step, _ in steps)}")
    print(f"Model:    {args.model_version}")
    print(f"Texture:  {'yes' if textured else 'no'}")
    if textured:
        print(f"          quality {args.texture_quality}, aligned to {args.texture_alignment}")
    if args.geometry_quality:
        print(f"Geometry: {args.geometry_quality}")
    if addons:
        print("Add-ons:  " + ", ".join(f"{flag} (+{cost})" for flag, cost in addons))
    if args.face_limit:
        print(f"Faces:    capped at {args.face_limit}")
    # glTF cannot carry quads, so Tripo answers a --quad job with FBX.
    expected_suffix = ".fbx" if args.quad else ".glb"
    print(f"Output:   {output_dir / (name + expected_suffix)}")
    print(f"Cost:     {total} credits (about ${total / 100:.2f})")
    show_balance()

    if not args.yes:
        print("\nDry run — nothing was submitted. Pass --yes to spend the credits.")
        return 0

    print("\nUploading...")
    front_token = upload(image_path)

    if supplied_views:
        tokens = {view: upload(path) for view, path in supplied_views.items()}
        inputs = view_slots(front_token, tokens)

        print(f"Reconstructing from {1 + len(tokens)} supplied views...")
        body = reconstruction_body(args, textured)
        body["inputs"] = inputs
        model_task = post("/generation/multiview-to-model", body)["task_id"]
    elif args.direct:
        print("Reconstructing from the single image...")
        body = reconstruction_body(args, textured)
        body["file_token"] = front_token
        model_task = post("/generation/image-to-model", body)["task_id"]
    else:
        print("Generating the four views...")
        multiview_task = post(
            "/generation/image-to-multiview", {"file_token": front_token}
        )["task_id"]
        poll(multiview_task, args.timeout)

        print("Reconstructing from the views...")
        body = reconstruction_body(args, textured)
        body["inputs"] = [{"task_id": multiview_task}]
        model_task = post("/generation/multiview-to-model", body)["task_id"]

    result = poll(model_task, args.timeout)
    output = result.get("output", {})

    model_url = output.get("model_url")
    if not model_url:
        raise TripoError(f"Task succeeded without a model_url: {json.dumps(result)}")

    saved = download(model_url, output_dir / f"{name}{model_suffix(model_url)}")
    print(f"\nSaved {saved} ({saved.stat().st_size // 1024} KB)")

    preview_url = output.get("rendered_image_url")
    if preview_url:
        preview = download(preview_url, output_dir / f"{name}_preview.png")
        print(f"Saved {preview}")

    consumed = result.get("credits_consumed")
    if consumed is not None:
        print(f"Credits consumed: {consumed}")

    return 0


def main(argv):
    parser = argparse.ArgumentParser(
        description="Turn a single image into a 3D model with the Tripo API.",
        epilog="Without --yes this only prints the plan, the cost and the balance.",
    )
    parser.add_argument(
        "image", type=Path, help="the front view; PNG or JPEG, up to 20 MB"
    )
    parser.add_argument("--left", type=Path, help="left view of the same object")
    parser.add_argument("--back", type=Path, help="back view of the same object")
    parser.add_argument("--right", type=Path, help="right view of the same object")
    parser.add_argument(
        "--yes",
        action="store_true",
        help="actually submit the job and spend credits",
    )
    parser.add_argument(
        "--direct",
        action="store_true",
        help="skip the multiview step: cheaper, lower geometric accuracy",
    )
    parser.add_argument(
        "--model-version",
        choices=MODEL_VERSIONS,
        default=DEFAULT_MODEL_VERSION,
        help=f"reconstruction model (default: {DEFAULT_MODEL_VERSION})",
    )

    texture = parser.add_argument_group("texture")
    texture.add_argument(
        "--texture",
        action="store_true",
        help="also generate texture maps; costs 10 more credits (default: geometry only)",
    )
    texture.add_argument(
        "--texture-quality",
        choices=["standard", "detailed"],
        default="standard",
        help=f"detailed costs {COST_TEXTURE_DETAILED} more credits",
    )
    texture.add_argument(
        "--texture-alignment",
        choices=["original_image", "geometry"],
        default="original_image",
        help="original_image favours visual fidelity, geometry favours structure",
    )
    texture.add_argument(
        "--texture-seed", type=int, help="fix the texture seed for a repeatable result"
    )

    mesh = parser.add_argument_group("mesh")
    mesh.add_argument(
        "--geometry-quality",
        choices=["standard", "detailed"],
        help=f"detailed is Tripo's Ultra mode, {COST_GEOMETRY_DETAILED} more credits",
    )
    mesh.add_argument(
        "--face-limit", type=int, help="cap the polygon count of the result"
    )
    mesh.add_argument(
        "--smart-low-poly",
        action="store_true",
        help="Tripo's Smart Mesh: hand-crafted low-poly topology instead of a "
        f"collapsed dense mesh; {COST_SMART_LOW_POLY} more credits and requires "
        f"--face-limit between {FACE_LIMIT_SMART[0]} and {FACE_LIMIT_SMART[1]}",
    )
    mesh.add_argument(
        "--quad",
        action="store_true",
        help=f"quad mesh output instead of triangles; {COST_QUAD} more credits and "
        f"narrows the --face-limit range to {FACE_LIMIT_SMART_QUAD[0]}-"
        f"{FACE_LIMIT_SMART_QUAD[1]} when combined with --smart-low-poly",
    )
    mesh.add_argument(
        "--generate-parts",
        action="store_true",
        help=f"return the model split into parts; {COST_GENERATE_PARTS} more "
        "credits, and incompatible with textures and with --quad",
    )
    mesh.add_argument(
        "--no-export-uv",
        action="store_true",
        help="skip UV export; faster, but the mesh arrives without UVs",
    )
    mesh.add_argument(
        "--compress",
        choices=["geometry"],
        help="geometry-based compression instead of the default meshopt",
    )

    other = parser.add_argument_group("other")
    other.add_argument(
        "--auto-size",
        action="store_true",
        help="scale the result to real-world metres; needs --texture",
    )
    other.add_argument(
        "--orientation",
        choices=["default", "align_image"],
        default="default",
        help="align_image rotates the model to match the input image",
    )
    other.add_argument(
        "--model-seed", type=int, help="fix the geometry seed for a repeatable result"
    )
    other.add_argument(
        "--image-autofix",
        action="store_true",
        help="let Tripo pre-process the input image; extends processing time",
    )
    other.add_argument("--name", help="base name for the output files")
    other.add_argument(
        "--output-dir", default=".", help="where to write the .glb (default: here)"
    )
    other.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT_SECONDS,
        help=f"seconds to wait per task (default: {DEFAULT_TIMEOUT_SECONDS})",
    )

    args = parser.parse_args(argv)

    for label in ["image"] + VIEW_ORDER[1:]:
        path = getattr(args, label)
        if path and not path.is_file():
            name = "front" if label == "image" else label
            print(f"No such {name} image: {path}", file=sys.stderr)
            return 2

    try:
        return run(args.image, args)
    except TripoError as error:
        print(f"\n{error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nInterrupted. Any submitted task keeps running on Tripo's side.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
