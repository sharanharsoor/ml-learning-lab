"""Prepare two-feature spam models on the Unit 6 Spambase folds."""

import argparse
import csv
from dataclasses import dataclass
from hashlib import sha256
import json
from math import exp, fsum, log1p
from pathlib import Path

from prepare_unit_6 import sigmoid


DATA = Path(__file__).resolve().parents[1] / "data"
FEATURES = (
    {"key": "x", "column": 51, "label": "Exclamation marks", "unit": "%"},
    {"key": "uppercase", "column": 55, "label": "Longest uppercase run", "unit": "characters"},
)
DEPTHS = range(1, 5)
UPPERCASE_SCALE = 100


def load_folds(raw, unit_6):
    records = list(csv.reader(raw.decode("ascii").splitlines()))
    if sha256(raw).hexdigest() != unit_6["source_sha256"]:
        raise ValueError("The source data do not match the Unit 6 fixture")
    folds = {}
    for split, rows in unit_6["rows"].items():
        folds[split] = []
        for row in rows:
            record = records[int(row["id"][1:]) - 1]
            if float(record[FEATURES[0]["column"]]) != row["x"] or int(record[-1]) != row["y"]:
                raise ValueError(f"Unexpected source row {row['id']}")
            folds[split].append({**row, "uppercase": int(record[FEATURES[1]["column"]])})
    return folds


def summarize(n, spam):
    legitimate = n - spam
    return {
        "n": n,
        "spam": spam,
        "legitimate": legitimate,
        "impurity": 2 * spam * legitimate / n ** 2,
    }


@dataclass(frozen=True)
class Split:
    feature: str
    threshold: float
    left_n: int
    left_spam: int
    numerator: int
    denominator: int

    def improves(self, other):
        # Compare exact ratios before the final division, including ties.
        return self.numerator * other.denominator < other.numerator * self.denominator


def best_for_feature(rows, spam, feature):
    ordered = sorted(rows, key=lambda row: row[feature])
    n = len(ordered)
    left_spam = 0
    best = None
    for left_n, (left_row, right_row) in enumerate(zip(ordered, ordered[1:]), 1):
        left_spam += left_row["y"]
        lo, hi = left_row[feature], right_row[feature]
        if lo == hi:
            continue
        right_n = n - left_n
        right_spam = spam - left_spam
        # The weighted Gini is 2/n times this ratio.
        numerator = (left_spam * (left_n - left_spam) * right_n
                     + right_spam * (right_n - right_spam) * left_n)
        split = Split(feature, (lo + hi) / 2, left_n, left_spam, numerator, left_n * right_n)
        if best is None or split.improves(best):
            best = split
    return best


def candidates_for(rows, spam):
    return [candidate for feature in FEATURES
            if (candidate := best_for_feature(rows, spam, feature["key"])) is not None]


def split_details(candidate, n, spam):
    left = summarize(candidate.left_n, candidate.left_spam)
    right = summarize(n - candidate.left_n, spam - candidate.left_spam)
    weighted = 2 * candidate.numerator / (n * candidate.denominator)
    return {
        "feature": candidate.feature,
        "threshold": candidate.threshold,
        "left": left,
        "right": right,
        "weightedImpurity": weighted,
        "gain": summarize(n, spam)["impurity"] - weighted,
    }


def divide(rows, feature, threshold):
    left, right = [], []
    for row in rows:
        (left if row[feature] <= threshold else right).append(row)
    return left, right


def grow(rows, depth, node_id="root"):
    n = len(rows)
    spam = sum(row["y"] for row in rows)
    node = {"id": node_id, **summarize(n, spam), "score": spam / n, "prediction": int(2 * spam >= n)}
    if depth == 0 or spam in (0, n):
        return node

    best = None
    for candidate in candidates_for(rows, spam):
        if best is None or candidate.improves(best):
            best = candidate
    if best is None or best.numerator * n >= spam * (n - spam) * best.denominator:
        return node

    left, right = divide(rows, best.feature, best.threshold)
    split = split_details(best, n, spam)
    return {
        **node,
        **{key: split[key] for key in ("feature", "threshold", "weightedImpurity", "gain")},
        "left": grow(left, depth - 1, node_id + "L"),
        "right": grow(right, depth - 1, node_id + "R"),
    }


def prune(node, remaining_depth):
    if "feature" not in node:
        return node
    if remaining_depth == 0:
        return {key: node[key] for key in ("id", "n", "spam", "legitimate", "impurity", "score", "prediction")}
    return {
        **node,
        "left": prune(node["left"], remaining_depth - 1),
        "right": prune(node["right"], remaining_depth - 1),
    }


def leaf(node, row):
    while "feature" in node:
        branch = "left" if row[node["feature"]] <= node["threshold"] else "right"
        node = node[branch]
    return node


def metrics(rows, predict):
    cells = {"tn": 0, "fp": 0, "fn": 0, "tp": 0}
    labels = (("tn", "fp"), ("fn", "tp"))
    for row in rows:
        cells[labels[row["y"]][predict(row)]] += 1
    tp, fp, fn, tn = (cells[key] for key in ("tp", "fp", "fn", "tn"))
    return {
        **cells,
        "accuracy": (tp + tn) / len(rows),
        "precision": tp / (tp + fp) if tp + fp else None,
        "recall": tp / (tp + fn) if tp + fn else None,
        "f1": 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else None,
    }


def logistic_terms(row):
    return (1, row["x"], row["uppercase"] / UPPERCASE_SCALE)


def dot(a, b):
    return fsum(x * y for x, y in zip(a, b))


def logistic_loss(samples, weights):
    score_targets = [(dot(x, weights), y) for x, y in samples]
    return fsum(max(z, 0) - y * z + log1p(exp(-abs(z))) for z, y in score_targets) / len(samples)


def solve_system(matrix, vector):
    augmented = [row + [value] for row, value in zip(matrix, vector)]
    size = len(vector)
    for index in range(size):
        pivot = max(range(index, size), key=lambda row: abs(augmented[row][index]))
        augmented[index], augmented[pivot] = augmented[pivot], augmented[index]
        divisor = augmented[index][index]
        if divisor == 0:
            raise ValueError("The training curvature does not identify all coefficients")
        augmented[index] = [value / divisor for value in augmented[index]]
        for row in range(size):
            if row != index:
                multiplier = augmented[row][index]
                augmented[row] = [a - multiplier * b for a, b in zip(augmented[row], augmented[index])]
    return [row[-1] for row in augmented]


def fit_logistic(rows):
    samples = [(logistic_terms(row), row["y"]) for row in rows]
    weights = [0.0, 0.0, 0.0]
    history = [logistic_loss(samples, weights)]
    for step in range(1, 31):
        weighted = [(x, y, sigmoid(dot(x, weights))) for x, y in samples]
        gradient = [fsum((p - y) * x[i] for x, y, p in weighted) for i in range(len(weights))]
        hessian = [
            [fsum(p * (1 - p) * x[i] * x[j] for x, _, p in weighted)
             for j in range(len(weights))]
            for i in range(len(weights))
        ]
        step_size = solve_system(hessian, gradient)
        weights = [weight - move for weight, move in zip(weights, step_size)]
        history.append(logistic_loss(samples, weights))
        if max(abs(move) for move in step_size) < 1e-10:
            return {
                "intercept": weights[0],
                "weights": {"x": weights[1], "uppercase": weights[2] / UPPERCASE_SCALE},
                "lossBefore": history[0],
                "lossAfter": history[-1],
                "steps": step,
            }
    raise ValueError("Two-feature logistic regression did not converge")


def logistic_score(model, row):
    return sigmoid(model["intercept"] + fsum(weight * row[key] for key, weight in model["weights"].items()))


def worked_split(node, rows):
    n, spam = node["n"], node["spam"]
    choices = [split_details(candidate, n, spam) for candidate in candidates_for(rows, spam)]
    choices.sort(key=lambda choice: choice["feature"] != node["feature"])
    sample_ids = []
    for choice in choices:
        left, right = divide(rows, choice["feature"], choice["threshold"])
        near = lambda row: abs(row[choice["feature"]] - choice["threshold"])
        for side in (left, right):
            for row in sorted(side, key=near)[:2]:
                if row["id"] not in sample_ids:
                    sample_ids.append(row["id"])
    return {
        "nodeId": node["id"],
        "parent": summarize(n, spam),
        "candidates": choices,
        "sampleIds": sample_ids,
    }


def prepare(raw, unit_6):
    rows = load_folds(raw, unit_6)
    full_tree = grow(rows["train"], max(DEPTHS))
    trees = {}
    for depth in DEPTHS:
        root = prune(full_tree, depth)
        trees[str(depth)] = {
            "root": root,
            "train": metrics(rows["train"], lambda row: leaf(root, row)["prediction"]),
            "validation": metrics(rows["validation"], lambda row: leaf(root, row)["prediction"]),
        }
    selected_depth = max(DEPTHS, key=lambda depth: trees[str(depth)]["validation"]["accuracy"])
    selected_root = trees[str(selected_depth)]["root"]

    logistic = fit_logistic(rows["train"])

    def predict_logistic(row):
        return int(logistic_score(logistic, row) >= 0.5)

    logistic["validation"] = metrics(rows["validation"], predict_logistic)
    training_left, training_right = divide(rows["train"], full_tree["feature"], full_tree["threshold"])
    children = [(full_tree["left"], training_left), (full_tree["right"], training_right)]
    # Prefer a branch that asks about the other feature, so both appear in the lesson.
    children.sort(key=lambda case: case[0].get("feature") == full_tree["feature"])
    child, child_rows = next((node, subset) for node, subset in children if "feature" in node)
    examples = ["E8", "E3383", "E17", "E3027"]
    # Include one correction and one new mistake when growing past the chosen depth.
    for correct_at_depth_four in (True, False):
        changed = next(row for row in rows["validation"]
                       if leaf(selected_root, row)["prediction"] != leaf(full_tree, row)["prediction"]
                       and (leaf(full_tree, row)["prediction"] == row["y"]) == correct_at_depth_four)
        examples.append(changed["id"])

    return {
        "source_sha256": unit_6["source_sha256"],
        "features": FEATURES,
        "rows": rows,
        "trees": trees,
        "selectedDepth": selected_depth,
        "test": {
            "tree": metrics(rows["test"], lambda row: leaf(selected_root, row)["prediction"]),
            "logistic": metrics(rows["test"], predict_logistic),
        },
        "logistic": logistic,
        "examples": examples,
        "splitExamples": [worked_split(full_tree, rows["train"]), worked_split(child, child_rows)],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Path to the official UCI spambase.data file")
    parser.add_argument("--unit6", type=Path, default=DATA / "unit-6.json", help="Reference Unit 6 fixture")
    parser.add_argument("--output", type=Path, default=DATA / "unit-8.json")
    args = parser.parse_args()
    fixture = prepare(args.source.read_bytes(), json.loads(args.unit6.read_text()))
    args.output.write_text(json.dumps(fixture, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
