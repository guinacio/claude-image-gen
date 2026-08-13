"""Measure subject occupancy and margins in base renders and generations.

Usage:
    python measure.py input.png output.png ...

Reads the alpha channel when one exists; otherwise treats anything that is not
near-white as subject. Prints one line per file with vertical and horizontal
occupancy plus the four margins, all as a percentage of the frame.

Criteria (see SKILL.md and resolutions-and-proportions.md):
  - input vertical occupancy: 75-85%, or 65-70% in A-pose/T-pose
  - per-edge margin: how far the clothing grows past the nude silhouette
    on that edge, plus roughly 3%
  - ocup_h deviation between input and output: within +-2 points is normal;
    beyond that the prompt let the model redraw the body
"""

import os
import sys

from PIL import Image, ImageOps


def measure(path):
    image = Image.open(path)
    if image.mode in ("RGBA", "LA"):
        bbox = image.split()[-1].getbbox()
    else:
        grey = ImageOps.invert(image.convert("L"))
        bbox = grey.point(lambda v: 255 if v > 12 else 0).getbbox()

    if bbox is None:
        return None

    width, height = image.size
    left, top, right, bottom = bbox
    return {
        "name": os.path.basename(path),
        "dimensions": f"{width}x{height}",
        "ocup_v": 100 * (bottom - top) / height,
        "ocup_h": 100 * (right - left) / width,
        "top": 100 * top / height,
        "bottom": 100 * (height - bottom) / height,
        "left": 100 * left / width,
        "right": 100 * (width - right) / width,
    }


def main(paths):
    if not paths:
        print(__doc__)
        return 1

    results = []
    for path in paths:
        result = measure(path)
        if result is None:
            print(f"{os.path.basename(path)}: empty frame, nothing measured")
            continue
        results.append(result)
        print(
            f"{result['name'][:34]:<36}{result['dimensions']:>10}"
            f"  ocup_v={result['ocup_v']:5.1f}%  ocup_h={result['ocup_h']:5.1f}%"
            f"  top={result['top']:4.1f}%  bottom={result['bottom']:4.1f}%"
            f"  left={result['left']:4.1f}%  right={result['right']:4.1f}%"
        )

    if len(results) >= 2:
        source, generated = results[0], results[-1]
        drift_h = generated["ocup_h"] - source["ocup_h"]
        drift_v = generated["ocup_v"] - source["ocup_v"]
        verdict = "ok" if abs(drift_h) <= 2 else "REGENERATE - the body was redrawn"
        print(
            f"\n{source['name'][:24]} -> {generated['name'][:24]}: "
            f"drift_h={drift_h:+.1f}  drift_v={drift_v:+.1f}  [{verdict}]"
        )

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
