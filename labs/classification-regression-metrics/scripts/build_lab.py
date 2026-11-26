"""Build the self-contained classification and regression metrics playground."""

import argparse
import base64
import io
import json
import zipfile
from pathlib import Path
from export_demo import render_demo

LAB = Path(__file__).resolve().parents[1]
SOURCE = LAB / "src"
FAVICON = LAB.parents[1] / "site/assets/favicon.png"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", type=Path, default=LAB.parents[1] / "docs" / LAB.name / "index.html")
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
output = args.output.resolve()
script_path = LAB / "scripts/metrics_demo.py"
expected_script = render_demo()
if args.check:
    if not script_path.is_file() or script_path.read_text() != expected_script:
        raise SystemExit("Generated Python script is out of date")
else:
    script_path.write_text(expected_script)
favicon = base64.b64encode(FAVICON.read_bytes()).decode("ascii")
template = (SOURCE / "studio.html").read_text().replace("{{FAVICON}}", favicon, 1)
guide = (SOURCE / "guide.html").read_text()
toc = '''<nav class="guide-toc" aria-label="Learning guide contents"><strong>Learning reference</strong>
<a href="#guide-tools">Using the tools</a><a href="#guide-data">Data and labels</a>
<a href="#guide-math">Metric definitions</a><a href="#guide-hands-on">Python examples</a>
<a href="#guide-sources">References</a><a href="#downloads">Downloads</a></nav>'''

resources = {
    "metrics_core.ipynb": (LAB / "notebooks/metrics_core.ipynb").read_bytes(),
    "metrics_public_data.ipynb": (LAB / "notebooks/metrics_public_data.ipynb").read_bytes(),
    "classification-metrics-teaching.ipynb": (LAB / "notebooks/classification-metrics-teaching.ipynb").read_bytes(),
    "regression-metrics-teaching.ipynb": (LAB / "notebooks/regression-metrics-teaching.ipynb").read_bytes(),
    "metrics_demo.py": (LAB / "scripts/metrics_demo.py").read_bytes(),
    "data/delivery_classification.csv": (LAB / "data/delivery_classification.csv").read_bytes(),
    "data/delivery_regression.csv": (LAB / "data/delivery_regression.csv").read_bytes(),
    "data/delivery_metrics.json": (LAB / "data/delivery_metrics.json").read_bytes(),
    "data/winequality-red.csv": (LAB / "data/winequality-red.csv").read_bytes(),
    "data/winequality.names": (LAB / "data/winequality.names").read_bytes(),
}
resources["requirements.txt"] = (LAB / "requirements.txt").read_bytes()
resources["INSTRUCTOR_GUIDE.md"] = (LAB / "INSTRUCTOR_GUIDE.md").read_bytes()
resources["THIRD_PARTY_NOTICES.md"] = (LAB / "THIRD_PARTY_NOTICES.md").read_bytes()
resources["LICENSE"] = (LAB.parents[1] / "LICENSE").read_bytes()
resources["data/WINE_DATA_SOURCE.txt"] = (LAB / "data/WINE_DATA_SOURCE.txt").read_bytes()
readme = """CLASSIFICATION & REGRESSION METRICS | ML LEARNING LAB

Interactive site:
https://sharanharsoor.github.io/ml-learning-lab/classification-regression-metrics/
Source and learning-lab collection:
https://github.com/sharanharsoor/ml-learning-lab

These files are the runnable Python examples and datasets from the lab.
The browser playground also works as a self-contained offline HTML file.
The website calculates examples in JavaScript; Python runs separately.

From this extracted resource folder:
    python3 -m venv .venv
    source .venv/bin/activate
    python -m pip install -r requirements.txt
    python -m jupyterlab
On Windows, activate with .venv\\Scripts\\activate instead.

Start with classification-metrics-teaching.ipynb or
regression-metrics-teaching.ipynb for a guided walkthrough of one task.
Run all cells, then use the examples and controls beside the code. The
synthetic lessons include their own data. metrics_core.ipynb and
metrics_demo.py are the combined reference. INSTRUCTOR_GUIDE.md describes
a reusable workshop sequence.

metrics_public_data.ipynb is an optional fitted-model exercise. It uses the
bundled data/winequality-red.csv, removes exact duplicates before splitting,
and evaluates separate classification and regression targets on held-out data.

Core reference values:
    P = on time, N = late; forecasts occur at dispatch after order acceptance.
    An agreed deadline stays fixed; forecasts never confirm or cancel orders.
    Matrix rows actual[P,N], columns predicted[P,N]: [[TP,FN],[FP,TN]].
    cutoff .25: TP15 FN1 FP1 TN3; precision/recall/F1 .9375, accuracy .90
    cutoff .10: TP16 FN0 FP3 TN1; precision16/19, recall1, F1 32/35
    full-score AUC = 59/64 = .921875, unchanged by a decision cutoff.
    Actual durations [20,30,40,50,60], predictions actual+5:
        MAE5 minutes, MSE25 minutes^2, RMSE5 minutes, R2=.875.
    One large miss [20,30,40,50,85]:
        MAE5 minutes, MSE125 minutes^2, RMSE=sqrt(125) minutes, R2=.375.
    Mean-reference prediction40: MAE12 minutes, RMSE=sqrt(200) minutes.

Core delivery data are synthetic. Scores are illustrative rankings and are
not demonstrated calibrated probabilities. Results are educational examples,
not measured performance from a deployed delivery system.

Original code and teaching materials: MIT; see LICENSE.
UCI Wine Quality data and source description: CC BY 4.0, attributed to
Cortez, Cerdeira, Almeida, Matos, and Reis (2009), UCI Machine Learning Repository.
https://doi.org/10.24432/C56S3T
https://creativecommons.org/licenses/by/4.0/
See THIRD_PARTY_NOTICES.md and data/WINE_DATA_SOURCE.txt.
"""
resources["README.txt"] = readme.encode()
zip_buffer = io.BytesIO()
with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, content in resources.items():
        info = zipfile.ZipInfo(name, date_time=(2026, 11, 5, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, content)

download_assets = {
    "metrics-teaching-resources.zip": {"mime": "application/zip", "b64": base64.b64encode(zip_buffer.getvalue()).decode()},
}
for name, content in resources.items():
    basename = name.split("/")[-1]
    mime = "application/json" if name.endswith((".ipynb", ".json")) else "text/csv;charset=utf-8" if name.endswith(".csv") else "text/plain;charset=utf-8"
    download_assets[basename] = {"mime": mime, "b64": base64.b64encode(content).decode()}

downloads = '''<p>Get the two guided teaching notebooks, the combined reference, the optional public-data exercise, and their supporting files in one ZIP.</p>
<div class="button-row"><button class="button primary" data-kit-asset="metrics-teaching-resources.zip">Download notebooks and data ZIP</button><button class="button" id="save-offline-kit">Save an offline HTML copy</button></div>
<details class="individual-downloads"><summary>Download individual files</summary><div class="download-list">
<button class="button small" data-kit-asset="classification-metrics-teaching.ipynb">Classification teaching notebook</button>
<button class="button small" data-kit-asset="regression-metrics-teaching.ipynb">Regression teaching notebook</button>
<button class="button small" data-kit-asset="metrics_core.ipynb">Core notebook</button>
<button class="button small" data-kit-asset="metrics_public_data.ipynb">Public data notebook</button>
<button class="button small" data-kit-asset="metrics_demo.py">Core Python script</button>
<button class="button small" data-kit-asset="winequality-red.csv">UCI red wine CSV</button>
<button class="button small" data-kit-asset="delivery_regression.csv">Delivery minutes CSV</button>
<button class="button small" data-kit-asset="delivery_metrics.json">Canonical demo JSON</button>
<button class="button small" data-kit-asset="requirements.txt">Python requirements</button>
<button class="button small" data-kit-asset="INSTRUCTOR_GUIDE.md">Instructor guide</button>
<button class="button small" data-kit-asset="README.txt">Setup instructions</button>
</div></details>
<p class="downloads-hint">The files are embedded in this page and generated locally when you download. Python runs in Jupyter, rather than inside this browser page. Drawing marks last for the open tab; export board PNGs before closing.</p>'''

extra_style = '''<style id="learning-guide-style">
.guide-toc{display:flex;flex-wrap:wrap;gap:10px 20px;padding:24px 0 28px;border-bottom:1px solid var(--line);margin-bottom:30px;font-size:13px}
.guide-toc strong{flex-basis:100%;color:var(--ink)}.guide-toc a{white-space:nowrap}
.guide-section{padding:26px 0 36px;border-bottom:1px solid var(--line);scroll-margin-top:24px}
.guide-section:first-child{padding-top:0}.guide-content .guide-section h2{font-size:32px;margin-top:14px;max-width:850px}
.teacher-note{background:var(--teal-light);border-left:3px solid var(--teal);padding:20px 25px;margin:25px 0;font-size:14px}
.teacher-note h3{margin-top:0}.teacher-note p:last-child{margin-bottom:0}.script-step,.board-stage{padding:8px 0 24px}
.script-step+.script-step,.board-stage+.board-stage{border-top:1px solid var(--line)}.script-step blockquote{font-size:18px;line-height:1.8}
.action{font-size:14px;color:var(--muted)}.formula{font-size:19px;color:var(--ink);padding:16px 0;line-height:1.9}
.individual-downloads{margin:22px 0}.individual-downloads summary{cursor:pointer;font-size:14px;font-weight:600;margin-bottom:16px}
.guide-section table{display:block;overflow:auto}.guide-section table th{min-width:110px}.guide-section table td{min-width:150px}
.guide-content pre{line-height:1.75;border-radius:5px;white-space:pre;tab-size:4}.guide-content blockquote{margin-left:0;margin-right:0}
.projector-layout .topbar{display:none}.projector-layout .shell{max-width:1440px;padding-left:24px;padding-right:24px}
.projector-layout .view{padding-top:18px}.projector-layout .page-head{margin-bottom:14px;align-items:center}
.projector-layout .page-head h1{font-size:26px;line-height:1.2;letter-spacing:-.6px;margin:0}
.projector-layout .page-head h1 br{display:none}.projector-layout .page-head .eyebrow,.projector-layout .page-head p{display:none}
.projector-layout .studio-tabs{margin:10px 0 14px}.projector-layout .model-meta{margin-bottom:14px}
.projector-layout .positive-definition{padding:6px 12px;margin:0 0 12px;font-size:13px;line-height:1.4;max-width:none}
.projector-layout .positive-definition .definition-detail{display:none}
.projector-layout .threshold-bar{padding:14px 20px;margin-bottom:20px}.projector-layout .cm-grid{grid-template-rows:32px 84px 84px}
.projector-layout .roc-panel{padding:16px 20px}.projector-layout .roc-panel svg{max-height:310px}
.projector-layout .metric{padding-top:10px;padding-bottom:10px}.projector-layout .board-canvas{height:calc(100vh - 190px);min-height:340px;max-height:680px}
.projector-layout .board-layout{gap:22px}.projector-layout .board-step{padding:10px}.projector-layout .board-instructions{display:none}
@media(max-width:700px){.guide-content .guide-section h2{font-size:28px}.guide-toc{gap:12px 18px}.teacher-note{padding:17px}.script-step blockquote{font-size:16px}}
@media print{.guide-toc{display:none}.guide-section{padding:12pt 0}.guide-content .guide-section h2{font-size:20pt}.teacher-note{font-size:10pt}.script-step blockquote{font-size:11pt}.guide-section table{display:table;font-size:9pt}.guide-section table td,.guide-section table th{min-width:0}.individual-downloads{display:none}}
</style>'''
asset_script = '''<script id="kit-embedded-assets" type="application/json">''' + json.dumps(download_assets, separators=(",", ":")) + '''</script>
<script>
(() => {
  document.body.classList.remove('projector-layout');
  const assets = JSON.parse(document.getElementById('kit-embedded-assets').textContent);
  const focusButtons = Array.from(document.querySelectorAll('.focus-toggle'));
  function updateFocus() {
    const active = document.body.classList.contains('projector-layout');
    focusButtons.forEach(button => {
      button.textContent = active ? 'Exit projector layout' : 'Projector layout';
      button.setAttribute('aria-pressed', String(active));
    });
    window.dispatchEvent(new Event('resize'));
  }
  focusButtons.forEach(button => button.addEventListener('click', () => {
    document.body.classList.toggle('projector-layout'); updateFocus();
  }));
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-mode]');
    if (target && !['board','playground'].includes(target.dataset.mode)) {
      document.body.classList.remove('projector-layout'); updateFocus();
    }
  });
  window.addEventListener('hashchange', () => {
    if (!['#board','#playground','#classification','#regression'].includes(location.hash)) {
      document.body.classList.remove('projector-layout'); updateFocus();
    }
  });
  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name; document.body.appendChild(link);
    link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  document.querySelectorAll('[data-kit-asset]').forEach(button => button.addEventListener('click', () => {
    const name = button.dataset.kitAsset, item = assets[name];
    const bytes = Uint8Array.from(atob(item.b64), char => char.charCodeAt(0));
    saveBlob(new Blob([bytes], {type:item.mime}), name);
  }));
  document.getElementById('save-offline-kit').addEventListener('click', () => {
    const source = '<!doctype html>\\n' + document.documentElement.outerHTML;
    saveBlob(new Blob([source], {type:'text/html;charset=utf-8'}), 'classification-regression-metrics.html');
  });
  let printDetails = [];
  window.addEventListener('beforeprint', () => {
    printDetails = Array.from(document.querySelectorAll('#view-handbook details')).map(el => [el, el.open]);
    printDetails.forEach(([el]) => el.open = true);
  });
  window.addEventListener('afterprint', () => printDetails.forEach(([el, wasOpen]) => el.open = wasOpen));
})();
</script>'''

assert template.count("<!-- INSTRUCTOR_GUIDE_SLOT -->") == 1
assert template.count("<!-- DOWNLOADS_SLOT -->") == 1
result = template.replace("<!-- INSTRUCTOR_GUIDE_SLOT -->", toc + guide)
result = result.replace("<!-- DOWNLOADS_SLOT -->", downloads)
teaching_alts = {
    "classification": "A dispatcher checks a parcel label before a courier delivers the parcel to its recipient.",
    "regression": "A dispatcher holds a stopwatch as a courier arrives carrying a parcel.",
}
teaching_styles = []
teaching_scripts = []
for topic, alt in teaching_alts.items():
    slot = f"<!-- {topic.upper()}_TEACHING_SLOT -->"
    story_slot = f"<!-- {topic.upper()}_STORY_IMAGE -->"
    lesson = (SOURCE / f"{topic}-teaching.html").read_text()
    assert result.count(slot) == lesson.count(story_slot) == 1
    image = base64.b64encode((SOURCE / f"delivery-{topic}-teaching.jpg").read_bytes()).decode("ascii")
    figure = (f'<figure class="metric-lesson-art"><img src="data:image/jpeg;base64,{image}" '
              f'width="1440" height="810" alt="{alt}"></figure>')
    result = result.replace(slot, lesson.replace(story_slot, figure))
    teaching_styles.append((SOURCE / f"{topic}-teaching.css").read_text())
    teaching_scripts.append(f'<script id="{topic}-teaching-code">\n' +
                            (SOURCE / f"{topic}-teaching.js").read_text() + "</script>")
regression_slot = "<!-- REGRESSION_TEACHING_DATA -->"
regression_fixture = json.loads(resources["data/delivery_metrics.json"])["regression"]
assert result.count(regression_slot) == 1
result = result.replace(regression_slot, json.dumps(regression_fixture, separators=(",", ":")).replace("<", "\\u003c"))
projector_anchor = '<button class="button" data-mode="classroom">Classroom ↗</button>'
assert result.count(projector_anchor) == 1
result = result.replace(projector_anchor,
                        '<div class="button-row"><button class="button small focus-toggle" aria-pressed="false">Projector layout</button><button class="button small" data-mode="classroom">Classroom ↗</button></div>')
result = result.replace('<button class="button" id="download-board">Save board as PNG ↓</button>',
                        '<div class="button-row"><button class="button small focus-toggle" aria-pressed="false">Projector layout</button><button class="button small" id="download-board">Save board as PNG ↓</button></div>')
assert result.count('class="button small focus-toggle"') == 2
art_style = ".metric-lesson-art{margin:0}.metric-lesson-art img{display:block;width:100%;height:auto;border-radius:.75rem}"
result = result.replace("</head>", extra_style + "\n<style>\n" + "\n".join([art_style, *teaching_styles]) + "\n</style>\n</head>")
result = result.replace("</body>", "\n".join([*teaching_scripts, asset_script, "</body>"]))
assert "\u2014" not in result
if args.check:
    if not output.is_file() or output.read_text() != result:
        raise SystemExit("Generated lab page is out of date: " + str(output))
    print("Verified " + str(output))
else:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + ".tmp")
    temporary.write_text(result)
    temporary.replace(output)
    print(json.dumps({"output": str(output), "html_bytes": len(result.encode()), "embedded_downloads": len(download_assets)}))
