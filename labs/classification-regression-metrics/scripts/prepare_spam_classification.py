"""Prepare the held-out Spambase examples used in the Classification Metrics lab."""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


SOURCE = "https://archive.ics.uci.edu/ml/machine-learning-databases/spambase/spambase.data"
SEED = 37
DEFAULT_THRESHOLD = 0.5
RELAXED_THRESHOLD = 0.20
STRICT_THRESHOLD = 0.75
SCORE_DECIMALS = 4


def classify(labels, scores, threshold):
    predicted = scores >= threshold
    actual_spam = labels == 1
    return {
        "tp": int((actual_spam & predicted).sum()),
        "fn": int((actual_spam & ~predicted).sum()),
        "fp": int((~actual_spam & predicted).sum()),
        "tn": int((~actual_spam & ~predicted).sum()),
    }


def build(source):
    records = pd.read_csv(source, header=None)
    features = records.iloc[:, :-1]
    actual = records.iloc[:, -1]
    group = features.groupby(features.columns.tolist(), sort=False, dropna=False).ngroup()
    split = StratifiedGroupKFold(n_splits=4, shuffle=True, random_state=SEED)
    training, test = next(split.split(features, actual, group))
    assert set(group.iloc[training]).isdisjoint(group.iloc[test])
    model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1500))
    model.fit(features.iloc[training], actual.iloc[training])
    score = model.predict_proba(features.iloc[test])[:, list(model.classes_).index(1)]
    test_frame = pd.DataFrame({
        "row_number": test + 1,
        "score": np.round(score, SCORE_DECIMALS),
        "actual": actual.iloc[test].to_numpy(),
    })

    # Keep one evenly spaced set of score ranks per recorded class for classroom counting.
    chosen = []
    for label in (0, 1):
        group_scores = test_frame[test_frame["actual"] == label].sort_values(["score", "row_number"])
        positions = np.rint(np.linspace(0, len(group_scores) - 1, 10)).astype(int)
        chosen.append(group_scores.iloc[positions])
    examples = pd.concat(chosen).sort_values(["score", "row_number"], ascending=[False, True])
    rows = [{"id": f"E{row.row_number}", "score": row.score, "actual": row.actual}
            for row in examples.itertuples(index=False)]
    return {
        "default_threshold": DEFAULT_THRESHOLD,
        "relaxed_threshold": RELAXED_THRESHOLD,
        "strict_threshold": STRICT_THRESHOLD,
        "score_decimals": SCORE_DECIMALS,
        "rows": rows,
        "model": "StandardScaler + LogisticRegression(max_iter=1500)",
        "sklearn_version": sklearn.__version__,
        "seed": SEED,
        "training_rows": len(training),
        "full_test": {
            "rows": len(test),
            "spam": int(test_frame["actual"].sum()),
            "counts": {
                str(value): classify(test_frame["actual"], test_frame["score"], value)
                for value in (DEFAULT_THRESHOLD, RELAXED_THRESHOLD, STRICT_THRESHOLD)
            },
            "auc": float(roc_auc_score(test_frame["actual"], test_frame["score"])),
        },
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default=SOURCE, help="Official UCI data URL or local copy")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "data/spam_classification.json")
    args = parser.parse_args()
    args.output.write_text(json.dumps(build(args.source), indent=2) + "\n")
