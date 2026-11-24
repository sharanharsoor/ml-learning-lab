"""Build the self-contained decision-tree lesson."""

import argparse
from pathlib import Path


SOURCE = Path(__file__).resolve().parents[1] / "src"
PARTS = {
    "{{CSS}}": "lesson.css",
    "{{TREE_DIAGRAM_CSS}}": "tree-diagram.css",
    "{{DEEP_GRAPH_CSS}}": "deep-graph.css",
    "{{GINI_CSS}}": "gini-chapter.css",
    "{{GINI_CHAPTER}}": "gini-chapter.html",
    "{{DEEP_EXAMPLE}}": "deep-example.html",
    "{{ENGINE}}": "engine.js",
    "{{TREE_DIAGRAM_JS}}": "tree-diagram.js",
    "{{DEEP_GRAPH_JS}}": "deep-graph.js",
    "{{DEEP_EXAMPLE_JS}}": "deep-example.js",
    "{{GINI_JS}}": "gini-chapter.js",
    "{{JS}}": "lesson.js",
    "{{PYTHON_PANEL}}": "python-demo.html",
    "{{PYTHON_JS}}": "python-demo.js",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    page = (SOURCE / "index.html").read_text(encoding="utf-8")
    for marker, filename in PARTS.items():
        if page.count(marker) != 1:
            raise SystemExit(f"Expected one occurrence of {marker} in index.html")
        page = page.replace(marker, (SOURCE / filename).read_text(encoding="utf-8"), 1)
    expected = page.encode("utf-8")

    if args.check:
        if not args.output.is_file() or args.output.read_bytes() != expected:
            raise SystemExit("Generated decision-tree lab is out of date.")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(expected)


if __name__ == "__main__":
    main()
