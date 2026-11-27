# ML Foundations

The first four units of the ML Learning Lab course follow one test hour from the Capital Bikeshare records. The class forecasts 470 rentals for 08:00 on November 1, 2012, then compares it with the recorded count of 680.

1. **Make a first prediction.** Read a row, identify the inputs and target, and calculate the miss on one hour.
2. **Python and Colab.** Follow the three cells, filter historical rows, and reproduce the forecast.
3. **Understand the data.** Inspect real records, investigate data quality, and work through distributions and summary calculations.
4. **Test on unseen data.** Compare two rules on validation and test periods, explain split choices, and trace leakage.

Each unit has a Colab notebook and a downloadable copy on the course page. The starter CSV contains a few observed past rows and one held-out row for practice. The fitted group uses the full training period.

The records come from Fanaee-T (2013), UCI Bike Sharing, under CC BY 4.0. The lesson’s fixtures preserve row IDs and derivation details. [Dataset and citation](https://doi.org/10.24432/C5W894) · [Data license](https://creativecommons.org/licenses/by/4.0/)

The preparation scripts in this lab derive the fixtures from `hour.csv` inside the source archive. The browser build also embeds the existing Regression Metrics fixture so the established calendar and baseline results stay aligned.

Build and check from the repository root.

```sh
python3 scripts/build_site.py
node labs/ml-foundations/tests/check_foundations.mjs
python3 scripts/build_site.py --check
```
