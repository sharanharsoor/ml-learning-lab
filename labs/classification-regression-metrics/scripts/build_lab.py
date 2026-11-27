"""Build the standalone metrics lessons and their downloadable Python kit."""

import argparse
import base64
import csv
import io
import json
import zipfile
from pathlib import Path

from export_demo import render_demo

LAB = Path(__file__).resolve().parents[1]
ROOT = LAB.parents[1]
SOURCE = LAB / "src"
TITLE = "Classification & Regression Metrics"
DATA = ("spam_classification.json", "bikeshare_metrics.json")
TOPICS = ("classification", "regression")


def encoded(data):
    return base64.b64encode(data).decode("ascii")


def inline_json(value):
    return json.dumps(value, separators=(",", ":")).replace("<", "\\u003c")


def replace_slot(page, slot, content):
    if page.count(slot) != 1:
        raise ValueError(f"Expected one occurrence of {slot}")
    return page.replace(slot, content, 1)


def csv_bytes(rows):
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=list(rows[0]), lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode()


def build_assets(fixtures, script):
    filenames = [
        "notebooks/metrics_core.ipynb", "notebooks/metrics_public_data.ipynb",
        "notebooks/classification-metrics-teaching.ipynb", "notebooks/regression-metrics-teaching.ipynb",
        "scripts/prepare_spam_classification.py", "scripts/prepare_bikeshare_metrics.py",
        "requirements.txt", "INSTRUCTOR_GUIDE.md", "THIRD_PARTY_NOTICES.md",
        *(f"data/{name}" for name in DATA),
    ]
    resources = {name: (LAB / name).read_bytes() for name in filenames}
    resources["metrics_demo.py"] = script.encode()
    resources["LICENSE"] = (ROOT / "LICENSE").read_bytes()
    resources["README.txt"] = f"""{TITLE} | ML Learning Lab

Lesson: https://sharanharsoor.github.io/ml-learning-lab/classification-regression-metrics/

Start with either teaching notebook in notebooks/. The core notebook and
metrics_demo.py walk through both teaching datasets. The public-data notebook
refits the models on the original UCI datasets over the internet.

Set up Python using: python -m pip install -r requirements.txt
Launch Jupyter using: python -m jupyterlab
Run the script from this directory using: python metrics_demo.py

The data folder contains the small worked examples and full test summaries.
See THIRD_PARTY_NOTICES.md for the original dataset attribution and licenses.
""".encode()
    for name, fixture in zip(DATA, fixtures):
        resources[f"data/{Path(name).stem}.csv"] = csv_bytes(fixture["rows"])

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, content in resources.items():
            member = zipfile.ZipInfo(name)
            archive.writestr(member, content, compress_type=zipfile.ZIP_DEFLATED)

    content_types = {
        ".ipynb": "application/json", ".json": "application/json",
        ".csv": "text/csv;charset=utf-8", ".zip": "application/zip",
    }
    resources["metrics-teaching-resources.zip"] = zip_buffer.getvalue()
    return {
        Path(name).name: {"mime": content_types.get(Path(name).suffix, "text/plain;charset=utf-8"), "b64": encoded(content)}
        for name, content in resources.items()
    }


DOWNLOADS = """<p>Save the interactive page for offline teaching, or use the two real datasets in Python.</p>
<div class="button-row">
  <button class="button primary" type="button" data-kit-asset="metrics-teaching-resources.zip">Download notebooks and data ZIP</button>
  <button class="button" type="button" id="save-offline-kit">Save offline HTML</button>
  <button class="button" type="button" id="print-guide">Print reference</button>
</div>
<details><summary>Download an individual file</summary>
  <div class="button-row">
    <button class="button small" type="button" data-kit-asset="classification-metrics-teaching.ipynb">Classification notebook</button>
    <button class="button small" type="button" data-kit-asset="regression-metrics-teaching.ipynb">Regression notebook</button>
    <button class="button small" type="button" data-kit-asset="metrics_core.ipynb">Combined notebook</button>
    <button class="button small" type="button" data-kit-asset="metrics_public_data.ipynb">Reproduce fitted models</button>
    <button class="button small" type="button" data-kit-asset="metrics_demo.py">Combined Python script</button>
    <button class="button small" type="button" data-kit-asset="spam_classification.csv">Spam teaching CSV</button>
    <button class="button small" type="button" data-kit-asset="bikeshare_metrics.csv">Bike-sharing teaching CSV</button>
    <button class="button small" type="button" data-kit-asset="INSTRUCTOR_GUIDE.md">Instructor guide</button>
  </div>
</details>"""


def build():
    fixtures = tuple(json.loads((LAB / "data" / name).read_text()) for name in DATA)
    script = render_demo()
    assets = build_assets(fixtures, script)
    page = (SOURCE / "studio.html").read_text()
    css_paths = (SOURCE / "studio.css", *(SOURCE / f"{topic}-teaching.css" for topic in TOPICS), ROOT / "site/quiz.css")
    page = replace_slot(page, "{{CSS}}", "\n".join(path.read_text() for path in css_paths))
    page = replace_slot(page, "{{FAVICON}}", encoded((ROOT / "site/assets/favicon.png").read_bytes()))
    for topic in TOPICS:
        lesson = (SOURCE / f"{topic}-teaching.html").read_text()
        if topic == "classification":
            image = encoded((LAB.parent / "bagging/src/email-desk.jpg").read_bytes())
            figure = (
                f'<figure class="metric-lesson-art"><img src="data:image/jpeg;base64,{image}" '
                'alt="An email arrives at an inbox with separate Inbox and Spam destinations."></figure>'
            )
            lesson = lesson.replace("<!-- CLASSIFICATION_STORY_IMAGE -->", figure)
        lesson = lesson.replace("<!-- REGRESSION_STORY_IMAGE -->", "")
        page = replace_slot(page, f"<!-- {topic.upper()}_TEACHING_SLOT -->", lesson)
    page = replace_slot(page, "<!-- CLASSIFICATION_DATA -->", inline_json(fixtures[0]))
    page = replace_slot(page, "<!-- REGRESSION_TEACHING_DATA -->", inline_json(fixtures[1]))
    page = replace_slot(page, "<!-- INSTRUCTOR_GUIDE_SLOT -->", (SOURCE / "guide.html").read_text())
    page = replace_slot(page, "<!-- DOWNLOADS_SLOT -->", DOWNLOADS)
    page = replace_slot(page, "<!-- EMBEDDED_ASSETS -->", inline_json(assets))
    scripts = ("metrics-core", "metrics-board", "metrics-studio", *(f"{topic}-teaching" for topic in TOPICS))
    return script, replace_slot(page, "<!-- SCRIPTS -->", "\n".join(
        f'<script id="{name}-code">\n{(SOURCE / f"{name}.js").read_text()}</script>'
        for name in scripts
    ))


def store(path, text, check):
    if check:
        if not path.is_file() or path.read_text() != text:
            raise SystemExit(f"Generated file is out of date: {path}")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "docs" / LAB.name / "index.html")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    script, page = build()
    store(LAB / "scripts/metrics_demo.py", script, args.check)
    store(args.output, page, args.check)


if __name__ == "__main__":
    main()
