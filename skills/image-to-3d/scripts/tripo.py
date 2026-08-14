#!/usr/bin/env python3
"""Turn a single image into a 3D model with the Tripo API.

Standard library only -- no pip install needed.

    python tripo.py front.png                          # dry run, spends nothing
    python tripo.py front.png --yes                    # one image, Tripo invents the rest
    python tripo.py front.png --back b.png --left l.png --yes   # your own views
    python tripo.py front.png --yes --texture          # also generate texture maps

Two ways in, and the difference matters.

With only a front image, Tripo generates four views itself and reconstructs
from those. It is cheap and needs nothing from you, but the sides and back are
invented -- which shows up as detail from the front smeared around onto faces
the model never saw.

Supplying your own views fixes exactly that. The front view is required;
left, back and right are optional, and at least two images total are needed.
All views must show the same object under consistent lighting, so generate
them with the front image as a reference rather than from scratch.

Nothing is spent without --yes. A run without it prints the plan, the credit
cost and the account balance, and stops.

Geometry only is the default. Reconstruction textures are baked from the input
views and are usually replaced in the DCC anyway, so paying for them is opt-in
via --texture.

Credit costs come from the published pricing table (1 credit = $0.01 USD):

    image-to-multiview                    10   (only when views are invented)
    multiview-to-model  plain  20   textured  30
    image-to-model      plain  20   textured  30   (--direct)

so supplying your own views costs 20 credits, and letting Tripo invent them
costs 30. Add 10 to either with --texture.
"""

import argparse
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

API_BASE = "https://openapi.tripo3d.ai/v3"
POLL_SECONDS = 2
DEFAULT_TIMEOUT_SECONDS = 600
RECONSTRUCTION_MODEL = "v3.1-20260211"

COST_IMAGE_TO_MULTIVIEW = 10
COST_TO_MODEL = {True: 30, False: 20}  # keyed by "textured"

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


def reconstruction_body(args, textured):
    """The parameters shared by both reconstruction endpoints."""
    body = {
        "model": RECONSTRUCTION_MODEL,
        "texture": textured,
        "pbr": textured,
    }
    if args.face_limit:
        body["face_limit"] = args.face_limit
    if args.geometry_quality:
        body["geometry_quality"] = args.geometry_quality
    return body


def run(image_path, args):
    textured = args.texture
    name = args.name or image_path.stem
    output_dir = Path(args.output_dir).expanduser()

    # front is required by the API; the others are optional, minimum two total.
    supplied_views = {
        "left": args.left,
        "back": args.back,
        "right": args.right,
    }
    supplied_views = {view: path for view, path in supplied_views.items() if path}

    if args.direct and supplied_views:
        raise TripoError("--direct takes a single image; drop the extra views.")

    if supplied_views:
        steps = [("multiview-to-model", COST_TO_MODEL[textured])]
    elif args.direct:
        steps = [("image-to-model", COST_TO_MODEL[textured])]
    else:
        steps = [
            ("image-to-multiview", COST_IMAGE_TO_MULTIVIEW),
            ("multiview-to-model", COST_TO_MODEL[textured]),
        ]

    total = sum(cost for _, cost in steps)

    print(f"Front:    {image_path}")
    for view, path in supplied_views.items():
        print(f"{view.capitalize() + ':':<10}{path}")
    if not supplied_views and not args.direct:
        print("Views:    generated by Tripo (sides and back are invented)")
    print(f"Pipeline: {' -> '.join(step for step, _ in steps)}")
    print(f"Texture:  {'yes' if textured else 'no'}")
    if args.geometry_quality:
        print(f"Geometry: {args.geometry_quality} (detailed costs extra credits)")
    print(f"Output:   {output_dir / (name + '.glb')}")
    print(f"Cost:     {total} credits (about ${total / 100:.2f})")
    show_balance()

    if not args.yes:
        print("\nDry run — nothing was submitted. Pass --yes to spend the credits.")
        return 0

    print("\nUploading...")
    front_token = upload(image_path)

    if supplied_views:
        inputs = [{"front": front_token}]
        for view, path in supplied_views.items():
            inputs.append({view: upload(path)})

        print(f"Reconstructing from {len(inputs)} supplied views...")
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

    saved = download(model_url, output_dir / f"{name}.glb")
    print(f"\nSaved {saved} ({saved.stat().st_size // 1024} KB)")

    preview_url = output.get("rendered_image_url")
    if preview_url:
        preview = download(preview_url, output_dir / f"{name}_preview.png")
        print(f"Saved {preview}")

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
        "--geometry-quality",
        choices=["standard", "detailed"],
        help="detailed is Tripo's Ultra mode and costs extra credits",
    )
    parser.add_argument(
        "--texture",
        action="store_true",
        help="also generate texture maps; costs 10 more credits (default: geometry only)",
    )
    parser.add_argument("--name", help="base name for the output files")
    parser.add_argument(
        "--output-dir", default=".", help="where to write the .glb (default: here)"
    )
    parser.add_argument(
        "--face-limit", type=int, help="cap the polygon count of the result"
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT_SECONDS,
        help=f"seconds to wait per task (default: {DEFAULT_TIMEOUT_SECONDS})",
    )
    args = parser.parse_args(argv)

    for label, path in (
        ("front", args.image),
        ("left", args.left),
        ("back", args.back),
        ("right", args.right),
    ):
        if path and not path.is_file():
            print(f"No such {label} image: {path}", file=sys.stderr)
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
