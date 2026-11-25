"""Build the standalone Bagging lesson using the collection's teaching styles."""

import argparse
import base64
import json
import re
from pathlib import Path

LABS = Path(__file__).resolve().parents[2]
SOURCE = LABS / "bagging" / "src"
TREE = LABS / "decision-trees" / "src"


def build():
    variance, oob = (SOURCE / "later.html").read_text().split("<!-- BAGGING_IMPLEMENTATION -->")
    data = json.loads((SOURCE / "intuition-data.json").read_text())
    parts = {
        "CSS": [TREE / "lesson.css", TREE / "tree-diagram.css", SOURCE / "bagging.css", SOURCE / "later.css"],
        "SHARED_JS": [TREE / "engine.js", TREE / "tree-diagram.js"],
        "LAB_JS": [SOURCE / "bagging.js", SOURCE / "later.js"],
    }
    replacements = {key: "\n".join(path.read_text() for path in paths) for key, paths in parts.items()}
    replacements.update(VARIANCE=variance.strip(), OOB=oob.strip(),
                        DATA=json.dumps(data, separators=(",", ":")).replace("<", "\\u003c"))
    image = (SOURCE / "parcel-desk.jpg").read_bytes()
    replacements["PARCEL_DESK_IMAGE"] = "data:image/jpeg;base64," + base64.b64encode(image).decode("ascii")
    template = (SOURCE / "index.html").read_text()
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
