"""Build the learning-lab collection and each registered static playground."""

import argparse
import html
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
OUTPUT = ROOT / "docs"
GITHUB_URL = "https://github.com/sharanharsoor/ml-learning-lab"
PAGES_URL = "https://sharanharsoor.github.io/ml-learning-lab/"


def write_or_check(path, content, check):
    expected = content.encode("utf-8") if isinstance(content, str) else content
    if check:
        if not path.is_file() or path.read_bytes() != expected:
            raise SystemExit(f"Generated file is out of date: {path.relative_to(ROOT)}")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(expected)


def local_path(directory, relative):
    path = (directory / relative).resolve()
    if not path.is_relative_to(directory.resolve()):
        raise SystemExit(f"Path leaves its lab directory: {relative}")
    return path


def load_labs():
    labs = []
    seen = set()
    for manifest in sorted((ROOT / "labs").glob("*/lab.json")):
        lab = json.loads(manifest.read_text())
        slug = lab.get("slug", "")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
            raise SystemExit(f"Invalid lab slug in {manifest}")
        if slug != manifest.parent.name or slug in seen:
            raise SystemExit(f"Lab directory and unique slug must match: {manifest}")
        for field in ("title", "description"):
            if not isinstance(lab.get(field), str) or not lab[field].strip():
                raise SystemExit(f"Missing {field} in {manifest}")
        if bool(lab.get("builder")) == bool(lab.get("entry")):
            raise SystemExit(f"Specify exactly one builder or entry in {manifest}")
        links = lab.get("lesson_links", {})
        if not isinstance(links, dict) or not all(
            re.fullmatch(r"[a-z0-9-]+", anchor) and isinstance(label, str) and label.strip()
            for anchor, label in links.items()
        ):
            raise SystemExit(f"Invalid lesson links in {manifest}")
        seen.add(slug)
        lab["directory"] = manifest.parent
        labs.append(lab)
    if not labs:
        raise SystemExit("Add at least one labs/<slug>/lab.json manifest.")
    return labs


def render_card(lab):
    slug = lab["slug"]
    title = html.escape(lab["title"])
    description = html.escape(lab["description"])
    tags = "".join(f"<span>{html.escape(tag)}</span>" for tag in lab.get("topics", []))
    preview = lab.get("preview")
    if preview:
        preview_path = local_path(SITE, preview)
        if not preview_path.is_file():
            raise SystemExit(f"Missing lab preview: {preview_path}")
        artwork = f'<img src="./{html.escape(preview, quote=True)}" alt="{title} playground preview" width="1280" height="720">'
    else:
        artwork = '<div class="preview-placeholder" aria-hidden="true"><span>∑</span><i></i><i></i><i></i><i></i></div>'
    notebook_link = ""
    if (lab["directory"] / "notebooks").is_dir():
        notebook_link = f'<a class="text-link" href="{GITHUB_URL}/tree/main/labs/{slug}/notebooks">Python notebooks ↗</a>'
    lesson_links = lab.get("lesson_links", {})
    if lesson_links:
        actions = "".join(
            f'<a class="button{" primary" if index == 0 else ""}" href="./{slug}/#{anchor}">{html.escape(label)}</a>'
            for index, (anchor, label) in enumerate(lesson_links.items())
        )
    else:
        actions = f'<a class="button primary" href="./{slug}/">Open playground <span aria-hidden="true">→</span></a>'
    return f'''<article class="lab-card">
<a class="lab-preview" href="./{slug}/" aria-label="Open {title}">{artwork}</a>
<div class="lab-copy"><div class="topic-tags">{tags}</div><h2>{title}</h2><p>{description}</p>
<div class="card-actions">{actions}{notebook_link}</div></div>
</article>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify generated pages without changing files")
    args = parser.parse_args()
    labs = load_labs()
    for lab in labs:
        destination = OUTPUT / lab["slug"] / "index.html"
        if lab.get("builder"):
            builder = local_path(lab["directory"], lab["builder"])
            command = [sys.executable, str(builder), "--output", str(destination)]
            if args.check:
                command.append("--check")
            subprocess.run(command, cwd=ROOT, check=True)
        else:
            entry = local_path(lab["directory"], lab["entry"])
            write_or_check(destination, entry.read_bytes(), args.check)

    assets = SITE / "assets"
    if assets.is_dir():
        for source in sorted(assets.rglob("*")):
            if source.is_symlink():
                raise SystemExit(f"Site assets must be regular files: {source}")
            if source.is_file():
                write_or_check(OUTPUT / "assets" / source.relative_to(assets), source.read_bytes(), args.check)

    template = (SITE / "index.template.html").read_text()
    replacements = {
        "{{LAB_CARDS}}": "\n".join(render_card(lab) for lab in labs),
        "{{LAB_COUNT}}": str(len(labs)),
        "{{LAB_NOUN}}": "lab" if len(labs) == 1 else "labs",
        "{{FIRST_LAB}}": labs[0]["slug"],
        "{{GITHUB_URL}}": GITHUB_URL,
        "{{PAGES_URL}}": PAGES_URL,
    }
    for marker, value in replacements.items():
        template = template.replace(marker, value)
    if re.search(r"\{\{[A-Z_]+\}\}", template):
        raise SystemExit("Unresolved collection template marker")
    write_or_check(OUTPUT / "index.html", template, args.check)
    write_or_check(OUTPUT / ".nojekyll", b"", args.check)
    not_found = f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lab not found | ML Learning Lab</title><style>body{{font:18px/1.7 system-ui,sans-serif;max-width:650px;margin:12vh auto;padding:24px;background:#f4f2eb;color:#193330}}a{{color:#087669}}</style><h1>That lab could not be found.</h1><p><a href="{PAGES_URL}">Explore the available learning labs</a> or <a href="{GITHUB_URL}">visit the source repository</a>.</p></html>\n'''
    write_or_check(OUTPUT / "404.html", not_found, args.check)
    print(f"{'Verified' if args.check else 'Built'} collection with {len(labs)} lab(s) in docs/.")


if __name__ == "__main__":
    main()
