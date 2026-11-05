# Contributing a learning lab

A lab should explain one coherent concept through experiments that connect inputs, calculations, and interpretation. Keep the learner interface factual and put facilitator scripts in a separate instructor guide.

## Collection layout

```text
labs/
  classification-regression-metrics/
    lab.json
    src/
    notebooks/
    data/
    scripts/
    tests/
    INSTRUCTOR_GUIDE.md
site/
  index.template.html
  assets/
scripts/
  build_site.py
docs/
  index.html
  classification-regression-metrics/
    index.html
```

`labs/` contains editable projects. `site/` contains the collection homepage and shared images. `docs/` contains the generated GitHub Pages website.

## Add a simple static playground

1. Create `labs/<concept-slug>/src/index.html` with a working standalone page.
2. Add a `lab.json` manifest:

```json
{
  "slug": "your-concept",
  "title": "Your Concept",
  "description": "What learners can explore and understand.",
  "topics": ["Machine learning"],
  "entry": "src/index.html"
}
```

3. Run `python3 scripts/build_site.py`. The lab appears on the homepage and is copied to `docs/your-concept/index.html`.
4. Test its calculations and controls in a browser. Check links under the collection subpath, not only at the domain root.
5. Run `python3 scripts/build_site.py --check` and commit source and generated files together.

## Add a lab with a build step

For embedded downloads or generated content, replace `entry` with `builder`:

```json
{
  "slug": "your-concept",
  "title": "Your Concept",
  "description": "What learners can explore and understand.",
  "topics": ["Machine learning"],
  "builder": "scripts/build_lab.py"
}
```

The builder is a Python script inside that lab. It accepts `--output <absolute-index-path>` and optional `--check`. Normal execution writes the generated page. Check mode verifies that the generated output matches the committed page without modifying files.

The existing metrics lab demonstrates this interface. Its notebooks are editable source files; its Python script and downloadable bundle are regenerated during the build.

## Content and verification

- Use synthetic or properly attributed public data. Include dataset licenses separately from the code license.
- Define labels, units, score meaning, and evaluation assumptions explicitly.
- Verify formulas against independently calculated examples. Include boundary cases that affect the explanation.
- Keep notebooks free of saved execution outputs, local filesystem paths, credentials, and machine-specific kernel names.
- Use relative paths for collection navigation and static assets. An offline HTML copy should retain its learning functionality.
- Document which metric answers which question and what it leaves out.
