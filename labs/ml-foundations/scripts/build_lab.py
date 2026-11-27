"""Build the ML Foundations units as one offline-ready page."""

import argparse
import base64
import csv
import io
import json
import re
from pathlib import Path

LAB = Path(__file__).resolve().parents[1]
ROOT = LAB.parents[1]
SOURCE = LAB / "src"
DATA = LAB / "data"
UNITS = {
    1: ("Make a first prediction", "01-first-prediction.ipynb"),
    2: ("Python and Colab", "02-python-and-colab.ipynb"),
    3: ("Understand the data", "03-understand-the-data.ipynb"),
    4: ("Test on unseen data", "04-testing-on-unseen-data.ipynb"),
    5: ("Linear regression", "05-linear-regression.ipynb"),
    6: ("Logistic regression", "06-logistic-regression.ipynb"),
    7: ("Classification metrics", "07-classification-metrics.ipynb"),
}
COLAB = ("https://colab.research.google.com/github/sharanharsoor/ml-learning-lab/"
         "blob/main/labs/ml-foundations/notebooks/")


def encode(data):
    return base64.b64encode(data).decode("ascii")


def compact_json(value):
    return json.dumps(value, separators=(",", ":")).replace("<", "\\u003c")


def data_file(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def notebook_actions(name):
    return (
        f'<a class="button primary" href="{COLAB}{name}" target="_blank" rel="noopener noreferrer">Open in Colab</a>'
        f'<button class="button" type="button" data-download="{name}">Download notebook</button>'
    )


def starter_csv(unit_one):
    text = io.StringIO(newline="")
    rows = [*unit_one["history"], unit_one["forecast"]]
    writer = csv.DictWriter(text, fieldnames=[*rows[0], "role"], lineterminator="\n")
    writer.writeheader()
    for row in unit_one["history"]:
        writer.writerow({**row, "role": "training_example"})
    writer.writerow({**unit_one["forecast"], "role": "held_out_example"})
    return text.getvalue().encode("utf-8")


def build():
    units = []
    notes = []
    downloads = {}
    styles = [(SOURCE / "foundations.css").read_text(), (ROOT / "site/quiz.css").read_text()]
    scripts = [(SOURCE / "foundations.js").read_text()]
    unit_one = data_file("unit-1.json")
    for number, (title, notebook) in UNITS.items():
        unit_id = f"unit-{number}"
        content = (SOURCE / f"{unit_id}.html").read_text()
        actions = notebook_actions(notebook)
        hidden = "" if number == 1 else " hidden"
        units.append(
            f'<section class="course-page" id="{unit_id}" aria-labelledby="{unit_id}-title"{hidden}>'
            f'{content}<div class="actions unit-notebook">{actions}</div></section>'
        )
        notes.append(f'<div><strong>Unit {number} · {title}</strong>{actions}</div>')
        notebook_bytes = (LAB / "notebooks" / notebook).read_bytes()
        downloads[notebook] = {"data": encode(notebook_bytes), "type": "application/x-ipynb+json"}
        styles.append((SOURCE / f"{unit_id}.css").read_text())
        scripts.append((SOURCE / f"{unit_id}.js").read_text())
    downloads["bike-share-starter-rows.csv"] = {"data": encode(starter_csv(unit_one)), "type": "text/csv;charset=utf-8"}
    assets = ROOT / "site/assets"
    shared_bike = LAB.parent / "classification-regression-metrics/data/bikeshare_metrics.json"
    replacements = {
        "UNITS": "\n".join(units),
        "NOTEBOOK_LIST": '<div class="notebook-list">' + "\n".join(notes) + "</div>",
        "FAVICON": encode((assets / "favicon.png").read_bytes()),
        "HERO_IMAGE": "data:image/jpeg;base64," + encode((assets / "ml-foundations.jpg").read_bytes()),
        "STYLES": "\n".join(styles),
        "SCRIPTS": "\n".join(f"<script>{script}</script>" for script in scripts),
        "BIKE_DATA": compact_json(json.loads(shared_bike.read_text())),
        "UNIT_1_DATA": compact_json(unit_one),
        "UNIT_3_DATA": compact_json(data_file("unit-3.json")),
        "UNIT_5_DATA": compact_json(data_file("unit-5.json")),
        "UNIT_6_DATA": compact_json(data_file("unit-6.json")),
        "DOWNLOADS": compact_json(downloads),
        "EXTRA_DATA": '<script id="foundations-unit-4-data" type="application/json">'
                      + compact_json(data_file("unit-4.json")) + "</script>",
    }
    page = (SOURCE / "index.html").read_text()
    pattern = re.compile(r"\{\{([A-Z0-9_]+)\}\}")
    # Unit fragments contain their own image and data slots.
    page = pattern.sub(lambda slot: replacements[slot[1]], page)
    return pattern.sub(lambda slot: replacements[slot[1]], page).encode("utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    expected = build()
    if args.check:
        if not args.output.is_file() or args.output.read_bytes() != expected:
            raise SystemExit("Generated ML Foundations page is out of date")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(expected)
