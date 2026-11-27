"""Build the self-contained decision-tree lesson."""

import argparse
import base64
from pathlib import Path


SOURCE = Path(__file__).resolve().parents[1] / "src"
FAVICON = SOURCE.parents[2] / "site/assets/favicon.png"
QUIZ_CSS = SOURCE.parents[2] / "site/quiz.css"
OPENER_IMAGE = SOURCE.parents[1] / "bagging/src/email-desk.jpg"
PARTS = {
    "{{CSS}}": "lesson.css",
    "{{COURSE_CSS}}": "course.css",
    "{{MULTIWAY_JS}}": "multiway.js",
    "{{TREE_DIAGRAM_CSS}}": "tree-diagram.css",
    "{{DEEP_GRAPH_CSS}}": "deep-graph.css",
    "{{IMPORTANCE_CSS}}": "deep-importance.css",
    "{{REGRESSION_CSS}}": "deep-regression.css",
    "{{GINI_CSS}}": "gini-chapter.css",
    "{{BOUNDARY_CSS}}": "boundary.css",
    "{{BOUNDARY_CHAPTER}}": "boundary.html",
    "{{BOUNDARY_MODEL}}": "boundary-model.js",
    "{{BOUNDARY_PLOT}}": "boundary-plot.js",
    "{{BOUNDARY_JS}}": "boundary.js",
    "{{GINI_CHAPTER}}": "gini-chapter.html",
    "{{DEEP_EXAMPLE}}": "deep-example.html",
    "{{IMPORTANCE_EXAMPLE}}": "deep-importance.html",
    "{{REGRESSION_EXAMPLE}}": "deep-regression.html",
    "{{DATASETS}}": "datasets.js",
    "{{ENGINE}}": "engine.js",
    "{{TREE_DIAGRAM_JS}}": "tree-diagram.js",
    "{{DEEP_GRAPH_JS}}": "deep-graph.js",
    "{{DEEP_EXAMPLE_JS}}": "deep-example.js",
    "{{IMPORTANCE_JS}}": "deep-importance.js",
    "{{REGRESSION_JS}}": "deep-regression.js",
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
    favicon = base64.b64encode(FAVICON.read_bytes()).decode("ascii")
    page = page.replace("{{FAVICON}}", favicon, 1)
    for marker, filename in PARTS.items():
        if page.count(marker) != 1:
            raise SystemExit(f"Expected one occurrence of {marker} in index.html")
        page = page.replace(marker, (SOURCE / filename).read_text(encoding="utf-8"), 1)
    page = page.replace("{{QUIZ_CSS}}", QUIZ_CSS.read_text(encoding="utf-8"), 1)
    if page.count("{{COURSE_IMAGE}}") != 1:
        raise SystemExit("Expected one course image slot")
    opener_data = base64.b64encode(OPENER_IMAGE.read_bytes()).decode("ascii")
    opener = (
        f'<figure class="course-opener"><img src="data:image/jpeg;base64,{opener_data}" '
        'alt="A highlighted email on a monitor beside an inbox and spam tray." '
        'width="1450" height="816"></figure>'
    )
    page = page.replace("{{COURSE_IMAGE}}", opener, 1)
    expected = page.encode("utf-8")

    if args.check:
        if not args.output.is_file() or args.output.read_bytes() != expected:
            raise SystemExit("Generated decision-tree lab is out of date.")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(expected)


if __name__ == "__main__":
    main()
