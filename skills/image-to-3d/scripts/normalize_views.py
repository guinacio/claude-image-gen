#!/usr/bin/env python3
"""Bring a set of multiview images to a common subject scale.

    python normalize_views.py front.png back.png left.png --output-dir ./norm

Generated views drift in scale even when the prompt asks for identical
framing, because each view is framed by whichever axis constrains it. A side
profile that has to fit a long object across the frame gets shrunk, and its
subject ends up shorter than the same object in the front view -- although
height is the one dimension every view of a standing object shares.

This rescales each image so the subject occupies the same height in all of
them, then recentres it on a square canvas painted in that image's own
background colour. Sizes are matched to the smallest subject in the set, so
nothing is ever scaled up past its own resolution.

On a sneaker this pulled a 15-point height spread down to zero and, as a side
effect, corrected a front view that was too wide: matching the heights also
fixed the width-to-length ratio, since both derive from the same scale error.

Requires Pillow and NumPy: pip install pillow numpy
"""

import argparse
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
except ImportError as error:  # pragma: no cover - environment guidance
    print(
        f"Missing dependency: {error.name}. Install with: pip install pillow numpy",
        file=sys.stderr,
    )
    raise SystemExit(2) from error

DEFAULT_CANVAS = 1024
BACKGROUND_TOLERANCE = 18


def background_value(grey):
    """The background is whatever colour dominates the frame border."""
    border = np.concatenate([grey[0, :], grey[-1, :], grey[:, 0], grey[:, -1]])
    return int(np.median(border))


def subject_box(image):
    """Bounding box of everything that is not background."""
    grey = np.asarray(image.convert("L")).astype(int)
    background = background_value(grey)
    rows, columns = np.where(np.abs(grey - background) > BACKGROUND_TOLERANCE)

    if rows.size == 0:
        return None, background

    return (
        int(columns.min()),
        int(rows.min()),
        int(columns.max()) + 1,
        int(rows.max()) + 1,
    ), background


def background_colour(image, grey_value):
    """Sample the actual RGB of the background rather than assuming neutrality."""
    pixels = np.asarray(image)
    corners = [pixels[0, 0], pixels[0, -1], pixels[-1, 0], pixels[-1, -1]]
    return tuple(int(channel) for channel in np.median(corners, axis=0))


def main(argv):
    parser = argparse.ArgumentParser(
        description="Rescale multiview images so the subject is the same height in each."
    )
    parser.add_argument("images", nargs="+", type=Path, help="two or more views")
    parser.add_argument(
        "--output-dir", type=Path, default=Path("normalized"), help="where to write"
    )
    parser.add_argument(
        "--canvas",
        type=int,
        default=DEFAULT_CANVAS,
        help=f"side of the square output (default: {DEFAULT_CANVAS})",
    )
    args = parser.parse_args(argv)

    if len(args.images) < 2:
        print("Give at least two views — one image has nothing to match.", file=sys.stderr)
        return 2

    loaded = []
    for path in args.images:
        if not path.is_file():
            print(f"No such image: {path}", file=sys.stderr)
            return 2
        image = Image.open(path).convert("RGB")
        box, grey = subject_box(image)
        if box is None:
            print(f"{path.name}: no subject found against the background", file=sys.stderr)
            return 1
        loaded.append((path, image, box, background_colour(image, grey)))

    target_height = min(box[3] - box[1] for _, _, box, _ in loaded)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Matching every subject to {target_height} px tall\n")
    for path, image, box, colour in loaded:
        left, top, right, bottom = box
        scale = target_height / (bottom - top)
        cropped = image.crop(box)
        resized = cropped.resize(
            (max(1, round(cropped.width * scale)), target_height), Image.LANCZOS
        )

        if resized.width > args.canvas:
            print(
                f"{path.name}: subject is {resized.width}px wide and does not fit a "
                f"{args.canvas}px canvas. Raise --canvas.",
                file=sys.stderr,
            )
            return 1

        canvas = Image.new("RGB", (args.canvas, args.canvas), colour)
        canvas.paste(
            resized,
            ((args.canvas - resized.width) // 2, (args.canvas - resized.height) // 2),
        )
        destination = args.output_dir / path.name
        canvas.save(destination)

        print(
            f"{path.name:<28} scale {scale:5.3f}  "
            f"height {100 * target_height / args.canvas:5.1f}%  "
            f"width {100 * resized.width / args.canvas:5.1f}%  -> {destination}"
        )

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
