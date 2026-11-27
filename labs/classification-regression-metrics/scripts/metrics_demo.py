# %% [markdown]
# # Classification and Regression Metrics
# 
# Two predictions, two ways to measure mistakes.
# 
# - **Email filtering** gives a Spam score. A cutoff assigns each email to the spam folder or inbox. Compare that decision to the recorded class.
# - **Bike rental demand** gives one numerical forecast before the hour starts. When the recorded hourly count is available, measure how far the forecast was from it.
# 
# This notebook uses the exact classroom examples in the [interactive lesson](https://sharanharsoor.github.io/ml-learning-lab/classification-regression-metrics/). The data are real held-out records. For the complete preparation and full evaluations, open the [Public Data notebook](https://colab.research.google.com/github/sharanharsoor/ml-learning-lab/blob/main/labs/classification-regression-metrics/notebooks/metrics_public_data.ipynb).

# %%
import json
import math
from pathlib import Path
from urllib.request import urlopen

RAW_DATA = (
    'https://raw.githubusercontent.com/sharanharsoor/ml-learning-lab/main/'
    'labs/classification-regression-metrics/data/'
)

def load_fixture(name):
    starts = [Path.cwd()]
    if '__file__' in globals():
        starts.append(Path(__file__).resolve().parent)
    for start in starts:
        for root in (start, *start.parents):
            paths = (root / 'data' / name, root / 'labs/classification-regression-metrics/data' / name)
            for path in paths:
                if path.is_file():
                    return json.loads(path.read_text(encoding='utf-8'))
    with urlopen(RAW_DATA + name, timeout=30) as response:
        return json.load(response)

spam = load_fixture('spam_classification.json')
bikes = load_fixture('bikeshare_metrics.json')

# %% [markdown]
# ## 1. Make one email decision and read the matrix
# 
# Spam is positive (1). Legitimate is negative (0). The stored score is a logistic regression estimate for Spam rounded to four decimals. At or above the cutoff, the filter predicts Spam. At 0.50, E4130 scores 0.5177 and gets flagged. The recorded label is Legitimate, so it contributes one false positive.
# 
# The scorer was fitted on 3,433 emails and used on a separate group of 1,168. The classroom uses ten examples from each recorded class across the score range. Those 20 emails make it easy to count. Their class proportions were selected for the demonstration.
# 
# **Rows are recorded labels. Columns are filter predictions.** The matrix uses positive, then negative on both axes, giving the layout `[[TP, FN], [FP, TN]]`.

# %%
def ratio(numerator, denominator):
    return numerator / denominator if denominator else None

def classification_metrics(rows, cutoff):
    counts = dict.fromkeys(('TP', 'FN', 'FP', 'TN'), 0)
    for row in rows:
        actual = bool(row['actual'])
        predicted = row['score'] >= cutoff
        cell = ('T' if actual == predicted else 'F') + ('P' if predicted else 'N')
        counts[cell] += 1

    tp, fn, fp, tn = counts.values()
    return counts | {
        'precision': ratio(tp, tp + fp),
        'recall': ratio(tp, tp + fn),
        'fpr': ratio(fp, fp + tn),
        'accuracy': ratio(tp + tn, len(rows)),
        'f1': ratio(2 * tp, 2 * tp + fn + fp),
    }

spam_rows = spam['rows']
class_baseline = classification_metrics(spam_rows, spam['default_threshold'])
print(class_baseline)

# %% [markdown]
# ## 2. Change the cutoff, keeping the scores fixed
# 
# At 0.50, read **precision** down the predicted Spam column, 9/11 ≈ 81.82%. Read **recall** across the actual Spam row, 9/10 = 90%. Accuracy counts 17/20 correct. F1 takes the harmonic mean of precision and recall, or 18/(18+2+1) ≈ 85.71%.
# 
# - At **0.75**, E4130 (Legitimate, 0.5177) changes FP → TN. E1809 (Spam, 0.5359) changes TP → FN. Accuracy is still 85%, with a different mix of mistakes.
# - At **0.20**, E4447 (Legitimate, 0.2220) changes TN → FP.
# - At **1.01**, nothing is flagged. Precision has a zero denominator and is undefined.

# %%
for threshold in (0.20, 0.50, 0.75, 1.01):
    outcome = classification_metrics(spam_rows, threshold)
    tp, fn, fp, tn = (outcome[key] for key in ('TP', 'FN', 'FP', 'TN'))
    precision = outcome['precision']
    precision_text = 'undefined' if precision is None else f'{precision:.2%}'
    print(f'{threshold:.2f}  TP={tp}, FN={fn}, FP={fp}, TN={tn}')
    print(f"      Precision {precision_text} · Recall {outcome['recall']:.2%} · Accuracy {outcome['accuracy']:.2%}")

# %% [markdown]
# ## 3. Read ROC and AUC
# 
# Each cutoff gives one point with **false-positive rate** across actual Legitimate emails and **recall** across actual Spam. At 0.50, that is (2/10, 9/10). Sweeping all distinct scores traces the receiver operating characteristic (ROC) curve. AUC is its area.
# 
# AUC can also be counted from the ranking. Compare each true Spam score with each true Legitimate score. Give a win 1, a tie 0.5 and a loss 0. Across 10 × 10 pairs there are 84 wins, 15 losses and one tie. The area is 0.845 regardless of the chosen cutoff.

# %%
def ranking_auc(rows):
    positive = [row['score'] for row in rows if row['actual']]
    negative = [row['score'] for row in rows if not row['actual']]
    wins = sum(p > n for p in positive for n in negative)
    ties = sum(p == n for p in positive for n in negative)
    return ratio(wins + 0.5 * ties, len(positive) * len(negative))

score_cutoffs = [math.inf, *sorted({row['score'] for row in spam_rows}, reverse=True)]
operating_points = [classification_metrics(spam_rows, t) for t in score_cutoffs]
roc_area = sum(
    (right['fpr'] - left['fpr']) * (right['recall'] + left['recall']) / 2
    for left, right in zip(operating_points, operating_points[1:])
)
assert math.isclose(roc_area, ranking_auc(spam_rows))
print(f'Teaching AUC {roc_area:.3f}, full held-out fold AUC {spam["full_test"]["auc"]:.3f}')

# %% [markdown]
# ## 4. Measure how far a bike rental estimate missed
# 
# We forecast the total count of Capital Bikeshare rentals for each hour. The rule averages earlier counts for the same hour and day type, then rounds to a whole number. For 07:00 on a working day, the count totals 131,628 across 456 earlier hours of that type. 131,628/456 rounds to a forecast of **289**. The observed count is **420**, so the residual is **420 − 289 = +131 rentals**. A positive residual means the forecast was low.
# 
# The five hours shown are 07:00 to 11:00 on November 1, 2012. The training data end on October 31 and contain 15,919 hourly records. The full test period includes 1,460 later hourly observations through December 31.

# %%
def regression_metrics(actual, predicted):
    if not actual or len(actual) != len(predicted):
        raise ValueError('Supply one forecast for each recorded count.')
    n = len(actual)
    residuals = [y - forecast for y, forecast in zip(actual, predicted)]
    mae = math.fsum(abs(error) for error in residuals) / n
    sse = math.fsum(error ** 2 for error in residuals)
    mse = sse / n
    actual_mean = math.fsum(actual) / n
    sst = math.fsum((y - actual_mean) ** 2 for y in actual)
    return {
        'mae': mae, 'mse': mse, 'rmse': math.sqrt(mse),
        'mean_residual': math.fsum(residuals) / n,
        'r2': 1 - sse / sst if sst else None,
        'residuals': residuals, 'sse': sse, 'sst': sst,
    }

bike_rows = bikes['rows']
bike_actual = [row['actual'] for row in bike_rows]
bike_predictions = [row['predicted'] for row in bike_rows]
bike_result = regression_metrics(bike_actual, bike_predictions)
print('Hour   Recorded   Forecast   Residual')
for row, error in zip(bike_rows, bike_result['residuals']):
    print(f"{row['case_id']}  {row['actual']:8}   {row['predicted']:8}   {error:+8}")
print(bike_result)

# %% [markdown]
# ### From five residuals to four metrics
# 
# - **MAE** averages their absolute values. The average miss is **91.8 rentals**.
# - **MSE** averages their squares. The result is **14,044.6 rentals²**, so a 210-rental miss contributes much more than a 12-rental miss.
# - **RMSE** takes the square root, **118.51 rentals**. It returns to the units of the target while keeping the influence of large misses.
# - **R²** uses **1 − SSE/SST**, comparing the model’s squared errors with variation around the observed mean of the evaluation rows. Here **1 − 70,223/188,175.2 ≈ 0.627**. This describes a reduction in squared error relative to the evaluation-mean reference. A negative result means the model’s squared error was larger than that reference.
# 
# The constant forecast you could deploy without peeking at test outcomes is **189**, the rounded mean of historical training counts. The mean of observed evaluation counts is a separate reference used in the R² formula. The browser lets you compare the two forecasts for individual hours.
# 
# Over all 1,460 test hours, the calendar model gets MAE **63.52 rentals** and RMSE **98.04 rentals**. The training-mean baseline gets MAE **140.08 rentals** and RMSE **174.44 rentals**.

# %%
assert [class_baseline[key] for key in ('TP', 'FN', 'FP', 'TN')] == [9, 1, 2, 8]
assert classification_metrics(spam_rows, 1.01)['precision'] is None
assert math.isclose(ranking_auc(spam_rows), 0.845)
assert bike_result['residuals'] == [131, 210, 93, 12, 13]
assert math.isclose(bike_result['mae'], 91.8)
assert math.isclose(bike_result['mse'], 14044.6)
assert math.isclose(bike_result['r2'], 0.6268211751601698)

# %% [markdown]
# ## Sources
# 
# - [Hopkins, Reeber, Forman, and Suermondt (1999), Spambase, UCI Machine Learning Repository](https://doi.org/10.24432/C53G6X)
# - [Fanaee-T (2013), Bike Sharing, UCI Machine Learning Repository](https://doi.org/10.24432/C5W894)
# - Both datasets are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
