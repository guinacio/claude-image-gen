#!/usr/bin/env python3
"""Turn a single image into a 3D model with the Tripo API.

Standard library only -- no pip install needed.

    python tripo.py sneaker.png                 # dry run: plan and cost, spends nothing
    python tripo.py sneaker.png --yes           # actually runs it
    python tripo.py sneaker.png --yes --direct  # cheaper single-image path

By default it runs Tripo's two-step multiview pipeline, which produces better
geometry than feeding one image straight to the reconstructor: Tripo first
generates four consistent views of the object, then reconstructs from those.
You supply one image -- generating the extra views yourself is not needed and
not wanted, since separately generated views disagree with each other.

Nothing is spent without --yes. A run without it prints the plan, the credit
cost and the account balance, and stops.

Input that works best, per Tripo's own guidance: a front view on a clean
background. Side views reduce quality.

Credit costs come from the published pricing table (1 credit = $0.01 USD):

    image-to-multiview                    10
    multiview-to-model  textured          30   plain  20
    image-to-model      textured          30   plain  20   (--direct)

so the default pipeline is 40 credits, about $0.40 per piece.
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


def run(image_path, args):
    textured = not args.no_texture
    name = args.name or image_path.stem
    output_dir = Path(args.output_dir).expanduser()

    if args.direct:
        steps = [("image-to-model", COST_TO_MODEL[textured])]
    else:
        steps = [
            ("image-to-multiview", COST_IMAGE_TO_MULTIVIEW),
            ("multiview-to-model", COST_TO_MODEL[textured]),
        ]

    total = sum(cost for _, cost in steps)

    print(f"Image:    {image_path}")
    print(f"Pipeline: {' -> '.join(step for step, _ in steps)}")
    print(f"Texture:  {'yes' if textured else 'no'}")
    print(f"Output:   {output_dir / (name + '.glb')}")
    print(f"Cost:     {total} credits (about ${total / 100:.2f})")
    show_balance()

    if not args.yes:
        print("\nDry run — nothing was submitted. Pass --yes to spend the credits.")
        return 0

    print("\nUploading...")
    file_token = upload(image_path)

    if args.direct:
        print("Reconstructing from the single image...")
        body = {
            "file_token": file_token,
            "model": RECONSTRUCTION_MODEL,
            "texture": textured,
            "pbr": textured,
        }
        if args.face_limit:
            body["face_limit"] = args.face_limit
        model_task = post("/generation/image-to-model", body)["task_id"]
    else:
        print("Generating the four views...")
        multiview_task = post(
            "/generation/image-to-multiview", {"file_token": file_token}
        )["task_id"]
        poll(multiview_task, args.timeout)

        print("Reconstructing from the views...")
        body = {
            "input": multiview_task,
            "model": RECONSTRUCTION_MODEL,
            "texture": textured,
            "pbr": textured,
        }
        if args.face_limit:
            body["face_limit"] = args.face_limit
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
    parser.add_argument("image", type=Path, help="PNG or JPEG, up to 20 MB")
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
        "--no-texture", action="store_true", help="geometry only, 10 credits cheaper"
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

    if not args.image.is_file():
        print(f"No such image: {args.image}", file=sys.stderr)
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
