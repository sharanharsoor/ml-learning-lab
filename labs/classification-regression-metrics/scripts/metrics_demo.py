# %% [markdown]
# # Is this dispatched order on track to arrive on time?
# ## A hands-on lab in regression and classification metrics
# 
# **The guiding question:** An accepted order already has a fixed arrival deadline. At dispatch, a delivery team forecasts whether it is **On track** or **Likely late**. How trustworthy are its On track forecasts, and how many actual on-time orders receive that forecast?
# 
# The main demonstration uses 20 invented orders with saved scores and later observed outcomes. No training algorithm is needed. We count outcomes, derive metrics, change a score cutoff, evaluate ranking, then compare numerical ETA errors with a baseline.
# 
# **Suggested use:** sections 1 to 7 are the main classification activity, sections 8 and 9 cover ROC-AUC and R², and section 10 contains optional boundary cases. Pause at each **Predict first** prompt before running the next cell. Every matrix places **P before N on both axes**.

# %% [markdown]
# ### 1. Setup: observe the events in the right order
# 
# 1. **Order accepted:** the arrival deadline is fixed, for example 12:40.
# 2. **Dispatch at 12:00:** the team produces its forecast. In a real system, the address, dispatch time, courier position, and current traffic could be known inputs at this point.
# 3. **Arrival later:** 12:35 is actually on time; 12:50 is actually late relative to that same 12:40 deadline.
# 
# The forecast is made after acceptance and at dispatch. It does not guarantee arrival, accept or cancel the order, or change its deadline. Every order is delivered regardless of the prediction. Moving the score cutoff changes only the forecast label; it does not change the accepted deadline or observed arrival.
# 
# The toy classification data below contain **only case IDs, saved scores, and outcomes**. They do not store addresses, traffic, courier positions, dispatch timestamps, or other features, and no real model is trained.
# 
# The same service has two separate prediction tasks:
# 
# - **Classification:** forecast P, **On track**, or N, **Likely late**, at dispatch. Actual P=1 means arrival at or before the fixed deadline; actual N=0 means arrival after it.
# - **Regression:** predict the numerical duration in minutes from dispatch to arrival. This uses a different five-order example.
# 
# The four classification outcomes are:
# 
# - TP: On track forecast, actual on-time arrival.
# - FN: Likely late forecast, actual on-time arrival.
# - FP: On track forecast, actual late arrival. This is a false optimistic forecast.
# - TN: Likely late forecast, actual late arrival.
# 
# Higher on-time scores indicate greater confidence in on-time arrival. The synthetic values are not demonstrated calibrated probabilities. A score of 0.90 does not establish a 90% chance of success. A mean duration also does not, by itself, determine an on-time probability.
# 
# **Run instructions:** Use Python 3.9 or newer with NumPy, matplotlib, and scikit-learn. Run all cells in order. The core data are embedded below, so uploading this notebook to Jupyter or Colab needs no data download. `requirements.txt` also includes JupyterLab.

# %%
import math
import numpy as np
import matplotlib.pyplot as plt
import sklearn

from sklearn.metrics import (
    accuracy_score, confusion_matrix, f1_score, precision_score,
    recall_score, roc_auc_score, roc_curve, r2_score,
    mean_absolute_error, mean_squared_error,
)

plt.rcParams.update({
    "figure.dpi": 120,
    "font.size": 11,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.titleweight": "bold",
})
NAVY = "#15324f"
TEAL = "#007f78"
CORAL = "#c45145"
GOLD = "#ad741d"

print(f"NumPy {np.__version__}; scikit-learn {sklearn.__version__}")

# %%
# Frozen evaluation predictions. Higher score means greater on-time confidence.
on_time_scores = np.array([
    .98, .96, .94, .92, .90, .85, .80, .75, .70, .65,
    .60, .55, .50, .45, .40, .30, .20, .15, .10, .05,
])
y_true = np.array([
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 0, 1, 1, 0, 0, 1, 0,
])
case_ids = [f"D{i:02d}" for i in range(1, len(on_time_scores) + 1)]

assert len(on_time_scores) == len(y_true) == 20
assert int(y_true.sum()) == 16
assert np.all(np.diff(on_time_scores) < 0)

print("Case   On-time score   Actual outcome")
for case_id, score, label in zip(case_ids, on_time_scores, y_true):
    print(f"{case_id:5s}  {score:10.2f}      {'P: On time' if label else 'N: Late'}")

# %% [markdown]
# ### 2. Predict first: is 80% accuracy enough?
# 
# Sixteen of the 20 deliveries arrive on time. Imagine forecasting **On track for every dispatched order**. Count the correct forecasts. What happens for the four deliveries that later arrive after their fixed deadlines?

# %%
all_on_time_predictions = np.ones_like(y_true)
baseline_correct = int(np.sum(all_on_time_predictions == y_true))
print(f"Predict On track for every order: {baseline_correct}/20 = {baseline_correct / 20:.0%} accuracy")
print("Actual on-time orders forecast On track: 16 of 16")
print("Actual late orders incorrectly forecast On track: 4 of 4")

# %% [markdown]
# **Checkpoint answer:** All 16 actual on-time deliveries are forecast On track, giving recall 100% and accuracy 80%. The four late deliveries are also forecast On track. Precision reveals those false optimistic forecasts. Accuracy answers the fraction-correct question; it does not separately describe the trustworthiness of an On track forecast.

# %% [markdown]
# ### 3. Live activity 1: count the four outcomes by hand
# 
# Use **predict P, On track, when score ≥ cutoff**. Otherwise predict N, Likely late. At the default cutoff **0.25**, the first 16 orders receive On track forecasts. D14 is one of them but actually arrives late. D19 receives a Likely late forecast but actually arrives on time.
# 
# **Predict first:** Write TP, FN, FP, and TN before running the next cell. Which denominator answers each question?
# 
# - Of the orders forecast On track, how many actually arrived on time?
# - Of the orders that actually arrived on time, how many were forecast On track?
# 
# Both matrix axes use **[P=1, N=0]**. Rows are actual outcomes and columns are predictions: **[[TP, FN], [FP, TN]]**. The accepted deadlines and later outcomes stay fixed.

# %%
def confusion_counts(actual, predicted):
    # P=1 is on time. N=0 is late.
    if len(actual) != len(predicted) or len(actual) == 0:
        raise ValueError("Use equal, nonempty label sequences.")
    counts = {"TP": 0, "FN": 0, "FP": 0, "TN": 0}
    for observed, guessed in zip(actual, predicted):
        if observed not in (0, 1) or guessed not in (0, 1):
            raise ValueError("Labels must be 0 or 1.")
        if observed == 1 and guessed == 1:
            counts["TP"] += 1
        elif observed == 1 and guessed == 0:
            counts["FN"] += 1
        elif observed == 0 and guessed == 1:
            counts["FP"] += 1
        else:
            counts["TN"] += 1
    return counts


predicted_025 = (on_time_scores >= 0.25).astype(int)
counts_025 = confusion_counts(y_true, predicted_025)
print(counts_025)
assert counts_025 == {"TP": 15, "FN": 1, "FP": 1, "TN": 3}

# %%
# Rows: actual [P=1, N=0]. Columns: predicted [P=1, N=0].
matrix_025 = np.array([
    [counts_025["TP"], counts_025["FN"]],
    [counts_025["FP"], counts_025["TN"]],
])

fig, ax = plt.subplots(figsize=(6.6, 5.1))
ax.imshow(matrix_025, cmap="Blues", vmin=0, vmax=20)
names = np.array([["TP", "FN"], ["FP", "TN"]])
for row in range(2):
    for column in range(2):
        value = matrix_025[row, column]
        ax.text(column, row, f"{names[row, column]}\n{value}",
                ha="center", va="center", fontsize=17,
                color="white" if value > 10 else NAVY)
ax.set(xticks=[0, 1], yticks=[0, 1],
       xticklabels=["P: On track (1)", "N: Likely late (0)"],
       yticklabels=["P: On time (1)", "N: Late (0)"],
       xlabel="Dispatch-time forecast [P, N]", ylabel="Actual outcome [P, N]",
       title="Forecast outcomes at cutoff 0.25")
fig.tight_layout()
plt.show()

# %% [markdown]
# ### 4. Give each question its own denominator
# 
# At cutoff 0.25:
# 
# - **Precision:** Of 16 On track forecasts, 15 were actually on time: $P=TP/(TP+FP)=15/16=0.9375$.
# - **Recall:** Of 16 actual on-time orders, 15 were forecast On track: $R=TP/(TP+FN)=15/16=0.9375$.
# - **Accuracy:** 18 of 20 forecasts were correct: $(TP+TN)/N=18/20=0.90$.
# 
# Precision measures trust in On track forecasts. Recall measures their coverage among actual on-time orders. The ratios match here because their denominators happen to match, although they ask different questions.
# 
# **F1** is their harmonic mean:
# 
# $$F_1=\frac{2PR}{P+R}=\frac{2TP}{2TP+FP+FN}.$$
# 
# If precision is 1 and recall is 0.1, their arithmetic mean is 0.55, but F1 is about 0.182. The harmonic mean is pulled toward the smaller input. F1 omits true negatives and does not encode the consequences of a false optimistic forecast or a false late forecast.

# %%
def ratio_or_nan(numerator, denominator):
    # An absent denominator is undefined, not evidence of perfect performance.
    return numerator / denominator if denominator else float("nan")


def metrics_from_counts(counts):
    tp, fp = counts["TP"], counts["FP"]
    fn, tn = counts["FN"], counts["TN"]
    return {
        "accuracy": ratio_or_nan(tp + tn, tp + fp + fn + tn),
        "precision": ratio_or_nan(tp, tp + fp),
        "recall": ratio_or_nan(tp, tp + fn),
        "f1": ratio_or_nan(2 * tp, 2 * tp + fp + fn),
        "fpr": ratio_or_nan(fp, fp + tn),
    }


metrics_025 = metrics_from_counts(counts_025)
for name, value in metrics_025.items():
    print(f"{name:10s}: {value:.4f}")

print(f"F1 for precision=1 and recall=0.1: {2 * 1 * 0.1 / (1 + 0.1):.4f}")

# %% [markdown]
# ### 5. Continue activity 1: relax the forecast cutoff
# 
# Change the cutoff from **0.25 to 0.10**. Before running the experiment, predict:
# 
# 1. Which additional orders are forecast On track?
# 2. Will coverage among actual on-time orders increase or decrease?
# 3. Will every additional On track forecast be correct?
# 
# For fixed scores, lowering the cutoff can only add positive predictions. Recall cannot decrease. Precision can increase or decrease because the newly included cases can have different proportions of actual on-time orders. The cutoff does not change any order's acceptance, delivery, deadline, or observed outcome.

# %%
# Live edit: try 0.25, 0.10, 0.00, and 1.01, then rerun this cell.
threshold = 0.25
predicted = (on_time_scores >= threshold).astype(int)
counts = confusion_counts(y_true, predicted)
metrics = metrics_from_counts(counts)

print(f"Threshold: {threshold:.2f}")
print("Forecast On track:", ", ".join(np.array(case_ids)[predicted == 1]) or "None")
print(counts)
for name in ["precision", "recall", "f1", "accuracy"]:
    print(f"{name:10s}: {metrics[name]:.6f}")

# %% [markdown]
# **Checkpoint answer for 0.10:** TP=16, FN=0, FP=3, TN=1. Precision is 16/19≈0.8421, recall is 16/16=1, F1 is 32/35≈0.9143, and accuracy is 17/20=0.85. All actual on-time orders are forecast On track, but three late deliveries also receive that optimistic forecast.
# 
# At the default 0.25 cutoff, precision=recall=F1=0.9375 and accuracy=0.90. Predicting On track for every order gives precision=0.80, recall=1, F1=8/9, and accuracy=0.80. The team must decide how it values forecast trust and coverage. F1 alone does not specify the consequences of the two error types.

# %%
threshold_grid = np.sort(np.unique(np.r_[0.0, on_time_scores, 0.25, 1.01]))
precision_values, recall_values = [], []
for cutoff in threshold_grid:
    result = metrics_from_counts(confusion_counts(y_true, (on_time_scores >= cutoff).astype(int)))
    precision_values.append(result["precision"])
    recall_values.append(result["recall"])

fig, ax = plt.subplots(figsize=(7.4, 4.4))
ax.plot(threshold_grid, precision_values, marker="o", ms=3, drawstyle="steps-pre",
        label="Precision: on time among On track forecasts", color=TEAL)
ax.plot(threshold_grid, recall_values, marker="s", ms=3, drawstyle="steps-pre",
        label="Recall: On track among actual on-time orders", color=CORAL)
for cutoff in [0.10, 0.25]:
    ax.axvline(cutoff, color=NAVY, alpha=0.25, linestyle=":")
ax.set(xlabel="On-time score cutoff (predict P at or above this value)",
       ylabel="Metric", ylim=(-0.03, 1.05),
       title="A cutoff changes the forecast labels")
ax.legend(loc="lower left", frameon=False, fontsize=9)
ax.grid(alpha=0.15)
fig.tight_layout()
plt.show()
print("At cutoff 1.01 every forecast is Likely late, so precision for P is undefined and omitted.")

# %% [markdown]
# ### 6. Supporting verification: compare with scikit-learn
# 
# The library checks the reasoning. We specify **actual on time=1** as positive throughout precision, recall, F1, the confusion matrix, and ROC-AUC. Predicted P=1 is the dispatch-time On track forecast.
# 
# `confusion_matrix(..., labels=[1, 0])` uses actual outcomes on rows and predictions on columns. With **P before N on both axes**, the layout is `[[TP, FN], [FP, TN]]`, and unpacking is `tp, fn, fp, tn = matrix.ravel()`.

# %%
def verify_with_sklearn(cutoff):
    guessed = (on_time_scores >= cutoff).astype(int)
    hand_counts = confusion_counts(y_true, guessed)
    hand = metrics_from_counts(hand_counts)
    library = {
        "accuracy": accuracy_score(y_true, guessed),
        "precision": precision_score(y_true, guessed, pos_label=1, zero_division=0),
        "recall": recall_score(y_true, guessed, pos_label=1, zero_division=0),
        "f1": f1_score(y_true, guessed, pos_label=1, zero_division=0),
    }
    expected_matrix = [
        [hand_counts["TP"], hand_counts["FN"]],
        [hand_counts["FP"], hand_counts["TN"]],
    ]
    matrix = confusion_matrix(y_true, guessed, labels=[1, 0])
    np.testing.assert_array_equal(matrix, expected_matrix)
    tp, fn, fp, tn = matrix.ravel()
    assert (tp, fn, fp, tn) == tuple(hand_counts[name] for name in ["TP", "FN", "FP", "TN"])
    for name, value in library.items():
        np.testing.assert_allclose(hand[name], value)
    print(f"Threshold {cutoff:.2f}: hand counts and all four library metrics agree.")


verify_with_sklearn(0.25)
verify_with_sklearn(0.10)
assert confusion_counts(y_true, (on_time_scores >= .10).astype(int)) == {
    "TP": 16, "FN": 0, "FP": 3, "TN": 1,
}

# %% [markdown]
# ### 7. A short decision checkpoint
# 
# **Discuss before continuing:** Would you prefer cutoff 0.25 when On track forecasts need to be trustworthy? Would you accept cutoff 0.10 to cover every actual on-time order, while labeling more late orders On track?
# 
# **One reasonable answer:** At 0.25, 15 of 16 On track forecasts are correct, covering 15 of 16 actual on-time orders. At 0.10, 16 of 19 On track forecasts are correct, covering all 16 actual on-time orders. These 20 invented outcomes do not determine the true consequences or establish future performance. Every order is delivered under either forecast rule.

# %% [markdown]
# ### 8. Live activity 2: ROC-AUC across thresholds
# 
# One cutoff gives one confusion matrix. The ROC curve sweeps every distinct score, plus a starting cutoff above all scores:
# 
# $$TPR=\frac{TP}{TP+FN}\quad\text{and}\quad FPR=\frac{FP}{FP+TN}.$$
# 
# TPR is recall: the fraction of actual on-time orders forecast On track. FPR is the fraction of actual late orders incorrectly forecast On track. Their denominators are **16 actual on-time orders** and **4 actual late orders**.
# 
# At 0.25, TPR=15/16 and FPR=1/4. At 0.10, TPR=1 and FPR=3/4. Neither cutoff changes the accepted deadlines or observed arrivals.
# 
# **Predict first:** If only the selected operating cutoff changes, should ROC-AUC of the same scores change?

# %%
# Include every distinct score threshold, not just 0.25 and 0.10.
roc_thresholds = np.r_[np.inf, np.sort(np.unique(on_time_scores))[::-1]]
hand_fpr, hand_tpr = [], []
for cutoff in roc_thresholds:
    result = metrics_from_counts(confusion_counts(y_true, (on_time_scores >= cutoff).astype(int)))
    hand_fpr.append(result["fpr"])
    hand_tpr.append(result["recall"])

hand_fpr = np.array(hand_fpr)
hand_tpr = np.array(hand_tpr)
auc_by_area = sum(
    (hand_fpr[i] - hand_fpr[i - 1]) * (hand_tpr[i] + hand_tpr[i - 1]) / 2
    for i in range(1, len(hand_fpr))
)

print("Threshold     FPR     TPR")
for cutoff, false_rate, true_rate in zip(roc_thresholds, hand_fpr, hand_tpr):
    print(f"{cutoff:9.2f}   {false_rate:5.3f}   {true_rate:5.3f}")
print(f"Area under all ROC points: {auc_by_area:.6f}")

# %%
# Compare every actual on-time/late pair. On time is the positive class.
positive_scores = on_time_scores[y_true == 1]
negative_scores = on_time_scores[y_true == 0]
favorable = 0.0
for positive_score in positive_scores:
    for negative_score in negative_scores:
        if positive_score > negative_score:
            favorable += 1
        elif positive_score == negative_score:
            favorable += 0.5

total_pairs = len(positive_scores) * len(negative_scores)
auc_by_pairs = favorable / total_pairs

library_fpr, library_tpr, library_thresholds = roc_curve(
    y_true, on_time_scores, pos_label=1, drop_intermediate=False,
)
library_auc = roc_auc_score(y_true, on_time_scores)
np.testing.assert_allclose(hand_fpr, library_fpr)
np.testing.assert_allclose(hand_tpr, library_tpr)
np.testing.assert_allclose(roc_thresholds, library_thresholds)
np.testing.assert_allclose([auc_by_area, auc_by_pairs, library_auc], 0.921875)
assert favorable == 59 and total_pairs == 64
print(f"Favorable pairs: {favorable:g}/{total_pairs} = {auc_by_pairs:.6f}")
print(f"scikit-learn ROC-AUC: {library_auc:.6f}")

# %%
fig, ax = plt.subplots(figsize=(6.7, 5.5))
ax.plot(hand_fpr, hand_tpr, color=TEAL, marker="o", ms=3,
        label=f"On-time scores: AUC = {library_auc:.6f}")
ax.fill_between(hand_fpr, hand_tpr, color=TEAL, alpha=0.08)
ax.plot([0, 1], [0, 1], linestyle="--", color="#777777", label="AUC=0.5 reference")
for cutoff, color, offset in [(0.25, CORAL, (12, -34)), (0.10, NAVY, (-100, -28))]:
    result = metrics_from_counts(confusion_counts(y_true, (on_time_scores >= cutoff).astype(int)))
    ax.scatter(result["fpr"], result["recall"], color=color, s=65, zorder=3)
    ax.annotate(f"Threshold {cutoff:.2f}", (result["fpr"], result["recall"]),
                xytext=offset, textcoords="offset points", color=color)
ax.set(xlabel="False positive rate: On track among actual late orders",
       ylabel="True positive rate: On track among actual on-time orders",
       title="The same ranking supports many forecast cutoffs",
       xlim=(-0.03, 1.03), ylim=(-0.03, 1.07))
ax.legend(loc="lower right", frameon=False, fontsize=10)
ax.grid(alpha=0.15)
fig.tight_layout()
plt.show()

# %% [markdown]
# **Checkpoint answer:** Changing only the operating cutoff changes forecast labels, not score ordering, so it does not change ROC-AUC. Among all 16×4=64 actual on-time/late pairs, the on-time order has the higher score in 59 pairs. There are no ties. AUC is 59/64=0.921875.
# 
# Use scores for ROC-AUC. Passing only binary forecasts discards most ranking information. AUC does not measure calibration or choose the forecast cutoff. Inspect precision and recall at useful cutoffs as well.

# %% [markdown]
# ### 9. Live activity 3: delivery errors in minutes, then R²
# 
# Now evaluate the separate numerical forecast made at dispatch. The orders are already accepted, and their deadlines stay fixed. For these five separate cases, actual durations are **20, 30, 40, 50, 60** minutes and predictions are **25, 35, 45, 55, 65** minutes. No predictor is trained here.
# 
# The customer first asks, **"By how many minutes does the estimate miss?"** Define a residual as actual minus predicted: $e_i=y_i-\hat y_i$. For E01, $20-25=-5$ minutes. Its absolute error is $5$ minutes and its squared error is $(-5)^2=25$ minutes².
# 
# - **MAE, Mean Absolute Error:** average the error magnitudes. It answers the average size of the miss in minutes: $\mathrm{MAE}=\frac{1}{n}\sum_i|e_i|$.
# - **Mean residual:** average the signed errors: $\bar e=\frac{1}{n}\sum_i e_i$. With actual minus predicted, a negative mean means estimates are too long on average. Opposite errors can cancel, so zero does not imply accurate predictions.
# 
# The operations team then asks, **"What if one delivery has a much larger miss?"**
# 
# - **MSE, Mean Squared Error:** average the squared errors, giving large misses more weight: $\mathrm{MSE}=\frac{1}{n}\sum_i e_i^2$. Its unit is minutes².
# - **RMSE, Root Mean Squared Error:** take $\sqrt{\mathrm{MSE}}$ to return to minutes. It preserves the emphasis on larger misses. RMSE is not the arithmetic mean of the error magnitudes.
# 
# Here all residuals are -5 minutes: MAE=5 minutes, mean residual=-5 minutes, MSE=25 minutes², and RMSE=5 minutes.
# 
# Finally Asha asks, **"Is the numerical forecast better than answering 40 minutes every time?"** The evaluation-target mean is 40. Standard R² compares total squared model error with that mean reference:
# 
# $$SSE=\sum_i(y_i-\hat y_i)^2,\qquad SST=\sum_i(y_i-\bar y)^2,$$
# 
# $$R^2=1-\frac{SSE}{SST}.$$
# 
# SSE is the **Sum of Squared Errors**; SST is the **Total Sum of Squares** around the actual mean. Both have units minutes². Their ratio and R² are unitless. The evaluation-target mean is a scoring reference, not a model trained with future outcomes.
# 
# **Predict first:** calculate one absolute error and one squared error. Then predict which metrics retain minutes as their unit and which reveal systematic overprediction.

# %%
def regression_error_metrics(actual, predicted):
    # Signed residual is actual minus prediction throughout this notebook.
    residuals = np.asarray(actual, dtype=float) - np.asarray(predicted, dtype=float)
    sse = float(np.sum(residuals ** 2))
    mse = sse / len(residuals)
    return {
        "mae": float(np.mean(np.abs(residuals))),
        "mse": mse,
        "rmse": math.sqrt(mse),
        "mean_residual": float(np.mean(residuals)),
        "sse": sse,
    }


actual_minutes = np.array([20, 30, 40, 50, 60], dtype=float)
good_predictions = np.array([25, 35, 45, 55, 65], dtype=float)
worse_predictions = np.full(5, 60.0)
outlier_predictions = np.array([20, 30, 40, 50, 85], dtype=float)
mean_minutes = actual_minutes.mean()
baseline_predictions = np.full_like(actual_minutes, mean_minutes)

model_residuals = actual_minutes - good_predictions
baseline_residuals = actual_minutes - baseline_predictions
good_errors = regression_error_metrics(actual_minutes, good_predictions)
model_sse = good_errors["sse"]
baseline_sse = float(np.sum(baseline_residuals ** 2))
manual_r2 = 1 - model_sse / baseline_sse

print("Case  Actual  Predicted  Residual  Abs error  Error^2  Baseline error^2")
for i, (observed, estimate, residual, base_residual) in enumerate(zip(
    actual_minutes, good_predictions, model_residuals, baseline_residuals,
), start=1):
    print(f"E{i:02d}   {observed:5.0f}  {estimate:9.0f}  {residual:8.0f}  "
          f"{abs(residual):9.0f}  {residual ** 2:7.0f}  {base_residual ** 2:16.0f}")

print(f"MAE = (5 + 5 + 5 + 5 + 5)/5 = {good_errors['mae']:.0f} minutes")
print(f"MSE = (25 + 25 + 25 + 25 + 25)/5 = {good_errors['mse']:.0f} minutes^2")
print(f"RMSE = sqrt(MSE) = {good_errors['rmse']:.0f} minutes")
print(f"Mean residual = {good_errors['mean_residual']:.0f} minutes: overprediction by 5 on average")
print(f"Model SSE: {model_sse:.0f}; mean-reference SST: {baseline_sse:.0f}")
print(f"R2 = 1 - {model_sse:.0f}/{baseline_sse:.0f} = {manual_r2:.3f}")

np.testing.assert_allclose(
    [good_errors[k] for k in ["mae", "mse", "rmse", "mean_residual"]],
    [5, 25, 5, -5],
)
np.testing.assert_allclose(good_errors["mae"], mean_absolute_error(actual_minutes, good_predictions))
np.testing.assert_allclose(good_errors["mse"], mean_squared_error(actual_minutes, good_predictions))
assert model_sse == 125 and baseline_sse == 1000
np.testing.assert_allclose(manual_r2, 0.875)
np.testing.assert_allclose(manual_r2, r2_score(actual_minutes, good_predictions))

# %% [markdown]
# **Checkpoint answer:** The forecast misses by 5 minutes on every order. MAE is 5 minutes and RMSE is also 5 minutes. MSE is 25 minutes². Mean residual is -5 minutes, identifying estimates that are consistently 5 minutes too long.
# 
# For comparison, the constant 40-minute reference has MAE 12 minutes, MSE 200 minutes², RMSE $\sqrt{200}\approx14.142$ minutes, and mean residual 0. Its signed errors cancel even though its estimates are imperfect.
# 
# The model's SSE is 125, versus the mean reference's SST of 1000, so R²=0.875: 87.5% less squared error than this reference on these five outcomes. That is not 87.5% of predictions correct. MAE/RMSE quantify numerical error size, mean residual exposes direction, and R² adds a relative comparison.
# 
# **Predict first:** What happens if every estimate is 60 minutes? Can R² become negative? As an optional contrast, compare five 5-minute misses with four exact estimates and one 25-minute miss. Both have MAE 5; should RMSE match too?

# %%
def r2_by_hand(actual, predicted):
    observed = np.asarray(actual, dtype=float)
    estimated = np.asarray(predicted, dtype=float)
    if observed.shape != estimated.shape or observed.ndim != 1:
        raise ValueError("Use equal one-dimensional sequences.")
    if len(observed) < 2:
        return float("nan")
    baseline_error = float(np.sum((observed - observed.mean()) ** 2))
    if baseline_error == 0:
        return float("nan")
    model_error = float(np.sum((observed - estimated) ** 2))
    return 1 - model_error / baseline_error


comparison_predictions = {
    "Good: actual + 5": good_predictions,
    "Mean reference": baseline_predictions,
    "Always 60": worse_predictions,
    "Perfect": actual_minutes,
    "One large miss": outlier_predictions,
}
# Independent reference answers: MAE, MSE, RMSE, mean residual, R2.
expected_comparisons = {
    "Good: actual + 5": [5, 25, 5, -5, .875],
    "Mean reference": [12, 200, math.sqrt(200), 0, 0],
    "Always 60": [20, 600, math.sqrt(600), -20, -2],
    "Perfect": [0, 0, 0, 0, 1],
    "One large miss": [5, 125, math.sqrt(125), -5, .375],
}
comparison_metrics = {}
print("Forecast              MAE(min)  MSE(min^2)  RMSE(min)  Mean residual(min)     R2")
for name, estimates in comparison_predictions.items():
    errors = regression_error_metrics(actual_minutes, estimates)
    r2 = r2_by_hand(actual_minutes, estimates)
    comparison_metrics[name] = dict(errors, r2=r2)
    print(f"{name:22s} {errors['mae']:8.3f}  {errors['mse']:10.3f}  "
          f"{errors['rmse']:9.3f}  {errors['mean_residual']:18.3f}  {r2:6.3f}")
    observed = [errors[k] for k in ["mae", "mse", "rmse", "mean_residual"]] + [r2]
    np.testing.assert_allclose(observed, expected_comparisons[name])
    np.testing.assert_allclose(errors["mae"], mean_absolute_error(actual_minutes, estimates))
    np.testing.assert_allclose(errors["mse"], mean_squared_error(actual_minutes, estimates))
    np.testing.assert_allclose(r2, r2_score(actual_minutes, estimates))

worse_sse = comparison_metrics["Always 60"]["sse"]
worse_r2 = comparison_metrics["Always 60"]["r2"]
assert worse_sse == 3000 and worse_r2 == -2

# Optional contrast in the same activity, with the same five actual outcomes.
np.testing.assert_allclose(comparison_metrics["Good: actual + 5"]["mae"],
                           comparison_metrics["One large miss"]["mae"])
assert comparison_metrics["One large miss"]["rmse"] > comparison_metrics["Good: actual + 5"]["rmse"]
print("Same MAE = 5 minutes, but one large miss has RMSE about 11.180 instead of 5.")
print("Both mean residuals are -5; neither MAE nor signed bias describes the error concentration.")

# %%
# Optional visual contrast: the same MAE can hide very different large misses.
fig, axes = plt.subplots(1, 2, figsize=(10, 4.8), sharey=True)
positions = np.arange(1, 6)
for ax, estimates, title in [
    (axes[0], good_predictions, "Five 5-minute misses\nMAE=5, RMSE=5, R2=0.875"),
    (axes[1], outlier_predictions, "One 25-minute miss\nMAE=5, RMSE=11.180, R2=0.375"),
]:
    ax.scatter(positions, actual_minutes, color=NAVY, s=50, label="Actual duration", zorder=3)
    ax.scatter(positions, estimates, color=CORAL, marker="x", s=60, label="Predicted duration", zorder=3)
    ax.vlines(positions, actual_minutes, estimates, color=CORAL, alpha=0.55, label="Prediction residual")
    ax.axhline(mean_minutes, color=TEAL, linestyle="--", label="Mean reference: 40 min")
    ax.set(xticks=positions, xticklabels=[f"E{i:02d}" for i in positions],
           xlabel="Separate evaluation order", title=title)
    ax.grid(axis="y", alpha=0.15)
axes[0].set_ylabel("Duration from dispatch to arrival (minutes)")
handles, labels = axes[0].get_legend_handles_labels()
fig.legend(handles, labels, loc="lower center", ncol=2, frameon=False)
fig.tight_layout(rect=(0, 0.16, 1, 1))
plt.show()

# %% [markdown]
# **Checkpoint answer:** Always predicting 60 minutes gives MAE 20, MSE 600, RMSE $\sqrt{600}\approx24.495$ minutes, and mean residual -20 minutes. SSE is 3000, three times the reference's 1000, so R²=1-3000/1000=-2. Perfect predictions give zero error metrics and R²=1.
# 
# **Optional one-large-miss comparison:** predictions **20, 30, 40, 50, 85** produce residuals **0, 0, 0, 0, -25**. MAE is 25/5=5 minutes, the same as five 5-minute misses. However, MSE is 625/5=125 minutes² and RMSE is $\sqrt{125}\approx11.180$ minutes. Squaring makes the one large miss contribute much more. Its R² is 1-625/1000=0.375. Mean residual is still -5, so bias alone does not reveal how the errors are distributed.
# 
# Different metrics answer different questions. Use MAE for average magnitude, mean residual for direction, MSE/RMSE when large misses deserve greater numerical weight, and R² for the squared-error comparison with a mean reference. These metrics do not themselves specify the true business cost of an error.
# 
# R² has an upper limit of 1 for this definition and no finite lower bound. Zero matches the mean reference in total squared error; the individual predictions need not equal that reference.

# %% [markdown]
# ### 10. Optional boundary cases and answer checks
# 
# Use this section for additional discussion and boundary-case exploration.
# 
# - At cutoff 0, every forecast is P/On track: TP=16, FN=0, FP=4, TN=0. Precision=0.8, recall=1, F1=8/9, accuracy=0.8. Four late deliveries receive false optimistic forecasts.
# - At cutoff 1.01, every forecast is N/Likely late: TP=0, FN=16, FP=0, TN=4. Precision is undefined because no positive predictions exist; recall=0, count-based F1=0, and accuracy=0.2.
# - With no actual positives, recall is undefined. Actual positive means on time. ROC-AUC needs both actual classes for its ranking interpretation.
# - With constant actual regression targets, the standard R² denominator is zero. Scikit-learn's default `force_finite=True` returns 1 for perfect constant predictions and 0 for imperfect ones. Our hand function returns `nan` to expose the undefined formula.
# 
# All orders remain accepted and are delivered. These extremes only change their forecast labels.

# %%
all_counts = confusion_counts(y_true, (on_time_scores >= 0).astype(int))
all_metrics = metrics_from_counts(all_counts)
assert all_counts == {"TP": 16, "FN": 0, "FP": 4, "TN": 0}
np.testing.assert_allclose([all_metrics[k] for k in ["precision", "recall", "f1", "accuracy"]],
                           [0.8, 1.0, 8 / 9, 0.8])

none_counts = confusion_counts(y_true, (on_time_scores >= 1.01).astype(int))
none_metrics = metrics_from_counts(none_counts)
assert none_counts == {"TP": 0, "FN": 16, "FP": 0, "TN": 4}
assert math.isnan(none_metrics["precision"])
np.testing.assert_allclose([none_metrics[k] for k in ["recall", "f1", "accuracy"]], [0.0, 0.0, 0.2])

library_none_precision = precision_score(y_true, np.zeros_like(y_true), zero_division=0)
assert library_none_precision == 0
print("All forecasts Likely late: precision for P is undefined; zero_division=0 reports 0 by convention.")

no_actual_positive = metrics_from_counts(confusion_counts([0, 0], [0, 1]))
assert math.isnan(no_actual_positive["recall"])
print("No actual on-time orders: recall is undefined. ROC-AUC also needs both actual classes.")

assert math.isnan(r2_by_hand([40, 40], [40, 45]))
assert r2_score([40, 40], [40, 45]) == 0
assert r2_score([40, 40], [40, 40]) == 1
print("Constant targets: hand R2 is undefined; sklearn's finite convention is explained above.")

np.testing.assert_allclose(roc_auc_score(y_true, np.full_like(on_time_scores, 0.5)), 0.5)
print("All equal on-time scores: ROC-AUC = 0.5.")

# Equality is included by the >= policy, even at an observed score.
assert int((on_time_scores >= 0.10).sum()) == 19
assert on_time_scores[18] == 0.10 and int((on_time_scores >= 0.10)[18]) == 1
print("Threshold 0.10 includes D19 with a score exactly equal to the cutoff.")

# %% [markdown]
# ### 11. Exit questions
# 
# 1. Why must the order and its fixed deadline exist before the dispatch-time forecast?
# 2. A colleague says, "Our forecasts are 80% accurate." What else would you ask?
# 3. How do precision and recall use different denominators when actual positive means on time?
# 4. Why can lowering the cutoff never reduce recall here, while precision need not move in one direction?
# 5. Why should ROC-AUC receive on-time scores rather than only binary forecast labels?
# 6. What does mean residual -5 minutes mean when residual is actual minus prediction?
# 7. How can two sets of forecasts both have MAE 5 minutes but different RMSE?
# 8. Which regression quantities have units minutes, minutes², or no unit?
# 9. If R²=-2, is the code necessarily broken?
# 
# **Answer guide:** Acceptance fixes the deadline; prediction then uses information available at dispatch and arrival supplies the later outcome. Ask about classes, baselines, counts, cutoff, consequences, and evaluation data. Precision counts actual on-time orders among On track forecasts; recall counts On track forecasts among actual on-time orders. Lower cutoffs retain prior positive predictions, while AUC concerns score ordering.
# 
# A mean residual of -5 means estimates are 5 minutes too long on average. Zero signed bias can conceal errors that cancel. Squaring gives large misses greater weight: five misses of 5 and one miss of 25 have equal MAE but RMSE 5 versus about 11.180. MAE, RMSE, and mean residual use minutes; MSE, SSE, and SST use minutes²; R² is unitless. Negative R² is valid when squared model error exceeds the mean reference's error.

# %% [markdown]
# ### What this demonstration establishes
# 
# You can explain and verify classification metrics, MAE, MSE, RMSE, mean residual, and R² without first learning a training algorithm. These carefully constructed samples support hand calculations. They do not establish model performance on real deliveries. A later real-data exercise should train on training data and evaluate on held-out data; if selecting a threshold, use validation data or a declared policy rather than optimizing it on the final test set.
# 
# The mathematical definitions and library behavior can be checked in the official [scikit-learn model evaluation guide](https://scikit-learn.org/stable/modules/model_evaluation.html), [ROC-AUC documentation](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.roc_auc_score.html), and [R² documentation](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.r2_score.html).
