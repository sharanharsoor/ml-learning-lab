# Contributing a learning lab

A lab should explain one coherent concept through experiments that connect inputs, calculations, and interpretation. Put the teaching sequence, definitions, and worked steps in the learner interface. Keep rehearsal logistics and private platform reminders in the presenter notes.

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

- Start with a real decision a learner can picture. Review how trustworthy teaching sources motivate it, then use attributable data with a clear outcome and a practical reason to predict it.
- Follow the same identifiable observations, units, and model outputs from the first visual through the formulas, code, downloads, and presenter notes. Label any what-if edits or small illustrations where they appear.
- Show the steps in order. Establish what the model knows at prediction time, what becomes known afterward, which quantities enter the formula, and what the result means in the original problem. Put likely follow-up questions in clearly titled disclosures beside the relevant visual.
- Keep the formula, numeric substitution, and interpretation on screen for each key calculation. Define the denominator, boundaries, units, and calculation scope where a learner first needs them.
- Put each quiz at the point where it becomes answerable. Show the full question, then use nested disclosures labeled **Show options**, **What is the right answer?**, and **Show explanation**. Use the same wording in the presenter notes so it can be copied into a classroom poll.
- Attribute public datasets separately from the code license. Separate selected teaching cases from model results on a complete held-out set.
- Verify formulas independently, including boundary cases that change the interpretation. Execute the notebooks using the same data as the browser lesson. Keep notebook sources free of saved execution outputs, credentials, and machine-specific paths.
- Keep offline HTML copies functional. Check published lessons under the collection subpath and verify their navigation, controls, and quiz reveal order.
