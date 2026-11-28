# ML Foundations

The ML Foundations course opens with one held-out hour from the Capital Bikeshare records. The class forecasts 470 rentals for 08:00 on November 1, 2012, then compares it with the recorded count of 680. The course continues with a spam filter trained on measured features from real emails.

1. **Make a first prediction.** Read a row, identify the inputs and target, and calculate the miss on one hour.
2. **Python and Colab.** Follow the three cells, filter historical rows, and reproduce the forecast.
3. **Understand the data.** Inspect real records, investigate data quality, and work through distributions and summary calculations.
4. **Test on unseen data.** Compare two rules on validation and test periods, explain split choices, and trace leakage.
5. **Linear regression.** Drag a line through real pairs of hourly counts, work through squared errors, and compare the fitted rule with the calendar baseline.
6. **Logistic regression.** Follow a real email from measurement to probability, calculate log loss, and lock a spam threshold before opening the test fold.
7. **Classification metrics.** Place emails in a confusion matrix, choose a cutoff under a validation constraint, and trace ROC and AUC with the same model and scores from Unit 6.
8. **Decision trees.** Trace a spam prediction, calculate Gini for competing splits, and compare the fitted tree with logistic regression on the same inputs and test fold.

Each unit has a Colab notebook and a downloadable copy on the course page. The starter CSV contains a few observed past rows and one held-out row for practice. The fitted group uses the full training period.

The fixtures preserve source row IDs and derivation details. Bike counts come from Fanaee-T (2013). Spambase measurements and labels come from Hopkins, Reeber, Forman, and Suermondt (1999). [UCI Bike Sharing](https://doi.org/10.24432/C5W894) · [UCI Spambase](https://doi.org/10.24432/C53G6X) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

The preparation scripts derive the bike fixtures from `hour.csv` inside the source archive and the logistic regression fixture from `spambase.data`. The browser build also embeds the existing Regression Metrics fixture so the established calendar and baseline results stay aligned.

Build and check from the repository root.

```sh
python3 scripts/build_site.py
node labs/ml-foundations/tests/check_foundations.mjs
python3 scripts/build_site.py --check
```
