# ML Learning Lab

Interactive lessons with worked calculations, annotated examples, quizzes, and runnable Python.

[Open the learning labs](https://sharanharsoor.github.io/ml-learning-lab/)

## Available lessons

- **ML Foundations.** Start with one real bike-share forecast, learn the Python that makes it, read and visualize the data, and test the model on future hours. [Start the course](https://sharanharsoor.github.io/ml-learning-lab/ml-foundations/#unit-1)
- **Classification Metrics.** Score real Spambase emails, trace the four confusion-matrix outcomes, change the cutoff, and work out precision, recall, F1, accuracy, and ROC-AUC. [Open the lesson](https://sharanharsoor.github.io/ml-learning-lab/classification-regression-metrics/#classification)
- **Regression Metrics.** Forecast hourly Capital Bikeshare rentals using historical calendar groups. Compare the real counts with forecasts, then work through residuals, MAE, MSE, RMSE, and R². [Open the lesson](https://sharanharsoor.github.io/ml-learning-lab/classification-regression-metrics/#regression)
- **Decision Trees.** Draw decisions on real email measurements, compare impurity criteria, trace deeper trees, and use squared error for rental-count predictions. [Open the lesson](https://sharanharsoor.github.io/ml-learning-lab/decision-trees/)
- **Bagging and Random Forests.** Follow a held-out Spambase email through several trees, bootstrap new training samples, explore feature subsampling and variance, then tune and evaluate a forest. [Open the lesson](https://sharanharsoor.github.io/ml-learning-lab/bagging/)

Each quiz shows its question first. Open the choices, correct answer, and explanation as the class reaches each step.

## Run the website and notebooks

The published website is static. To serve the committed site locally, run this from the repository root and open the local page.

```bash
python3 -m http.server 8000 --directory docs
```

[Open the local site](http://localhost:8000/)

Use the **Colab** link in each lesson or open the notebook from an installed Jupyter environment. The metrics lab's **Reference & downloads** view provides an offline HTML copy, a ZIP, selected data as CSV, and a combined Python script.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r labs/classification-regression-metrics/requirements.txt
python -m jupyterlab
```

On Windows, activate with `.venv\Scripts\activate`. The guided notebooks use the same rows as the lessons. The metrics lab also has a reproducible exercise that refits models from the original public datasets.

## Build and verify

```bash
python3 scripts/build_site.py
node labs/classification-regression-metrics/tests/check_metrics.mjs
node labs/decision-trees/tests/check_tree.mjs
node labs/ml-foundations/tests/check_foundations.mjs
python3 scripts/build_site.py --check
```

GitHub Pages publishes the generated `docs/` directory from `main`. Follow the teaching and verification conventions when adding a chapter. [Contributing](CONTRIBUTING.md)

## Data and attribution

The source code and original lesson materials are MIT licensed. Spambase and Bike Sharing observations are CC BY 4.0. Lessons distinguish selected teaching rows, hypothetical changes, and complete held-out evaluations. [Repository license](LICENSE) · [Dataset notices](labs/classification-regression-metrics/THIRD_PARTY_NOTICES.md)
