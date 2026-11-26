"""Build the standalone Bagging lesson using the collection's teaching styles."""

import argparse
import base64
import json
import re
from pathlib import Path

LABS = Path(__file__).resolve().parents[2]
SOURCE = LABS / "bagging" / "src"
TREE = LABS / "decision-trees" / "src"
FAVICON = LABS.parent / "site/assets/favicon.png"


def build():
    variance, oob = (SOURCE / "later.html").read_text().split("<!-- BAGGING_IMPLEMENTATION -->")
    parts = {
        "CSS": [TREE / "lesson.css", TREE / "tree-diagram.css", SOURCE / "bagging.css", SOURCE / "later.css"],
        "SHARED_JS": [TREE / "engine.js", TREE / "tree-diagram.js"],
        "LAB_JS": [SOURCE / "bagging.js", SOURCE / "later.js", SOURCE / "tuning.js"],
    }
    replacements = {key: "\n".join(path.read_text() for path in paths) for key, paths in parts.items()}
    replacements["FAVICON"] = base64.b64encode(FAVICON.read_bytes()).decode("ascii")
    for marker, filename in {"DATA": "intuition-data.json", "TUNING_DATA": "tuning-data.json"}.items():
        data = json.loads((SOURCE / filename).read_text())
        replacements[marker] = json.dumps(data, separators=(",", ":")).replace("<", "\\u003c")
    images = {
        "EMAIL_DESK_IMAGE": "email-desk.jpg",
        "BOOTSTRAP_IMAGE": "scene-bootstrap.jpg",
        "FOREST_IMAGE": "scene-forest.jpg",
        "DIVERSITY_IMAGE": "scene-diversity.jpg",
        "OOB_IMAGE": "scene-oob.jpg",
    }
    for marker, filename in images.items():
        encoded = base64.b64encode((SOURCE / filename).read_bytes()).decode("ascii")
        replacements[marker] = "data:image/jpeg;base64," + encoded
    template = (SOURCE / "index.html").read_text().replace("{{VARIANCE}}", variance.strip()).replace("{{OOB}}", oob.strip())
    return re.sub(r"\{\{([A-Z_]+)\}\}", lambda match: replacements[match[1]], template).encode("utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    expected = build()
    if args.check:
        if not args.output.is_file() or args.output.read_bytes() != expected:
            raise SystemExit("Generated Bagging lab is out of date.")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(expected)


if __name__ == "__main__":
    main()
