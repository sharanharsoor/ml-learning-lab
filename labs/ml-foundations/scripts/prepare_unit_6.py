"""Prepare Unit 6's one-feature logistic regression from UCI Spambase."""

import argparse
import csv
from hashlib import sha256
import json
from math import exp, fsum, log1p
from pathlib import Path


FEATURE_COLUMN = 51
SPLIT_SEED = 37
OUTPUT = Path(__file__).resolve().parents[1] / "data/unit-6.json"


def split_rows(raw):
    partitions = {"train": [], "validation": [], "test": []}
    groups = set()
    for index, record in enumerate(csv.reader(raw.decode("ascii").splitlines()), 1):
        if len(record) != 58 or record[-1] not in {"0", "1"}:
            raise ValueError(f"Unexpected Spambase row {index}")
        # Hash predictors without the label so identical profiles stay together.
        profile = ",".join(record[:-1])
        groups.add(profile)
        digest = sha256(f"{SPLIT_SEED}:{profile}".encode("ascii")).hexdigest()
        bucket = int(digest[:8], 16) % 10
        split = "train" if bucket < 6 else "validation" if bucket < 8 else "test"
        partitions[split].append({
            "id": f"E{index}",
            "x": float(record[FEATURE_COLUMN]),
            "y": int(record[-1]),
        })
    return partitions, len(groups)


def sigmoid(score):
    if score >= 0:
        return 1 / (1 + exp(-score))
    odds = exp(score)
    return odds / (1 + odds)


def mean_loss(rows, intercept, weight):
    # Computing from scores avoids taking log(0) at saturated probabilities.
    scored = [(intercept + weight * row["x"], row["y"]) for row in rows]
    return fsum(max(z, 0) - y * z + log1p(exp(-abs(z))) for z, y in scored) / len(scored)


def newton_step(rows, intercept, weight):
    samples = [(row["x"], row["y"], sigmoid(intercept + weight * row["x"])) for row in rows]
    gradient_intercept = fsum(p - y for x, y, p in samples)
    gradient_weight = fsum((p - y) * x for x, y, p in samples)
    curvature = [(x, p * (1 - p)) for x, _, p in samples]
    h00 = fsum(v for x, v in curvature)
    h01 = fsum(v * x for x, v in curvature)
    h11 = fsum(v * x * x for x, v in curvature)
    determinant = h00 * h11 - h01 * h01
    if determinant <= 0:
        raise ValueError("The training curvature does not identify both coefficients")
    return (
        (h11 * gradient_intercept - h01 * gradient_weight) / determinant,
        (h00 * gradient_weight - h01 * gradient_intercept) / determinant,
    )


def fit(rows):
    intercept = weight = 0.0
    history = [mean_loss(rows, intercept, weight)]
    for step in range(1, 31):
        intercept_step, weight_step = newton_step(rows, intercept, weight)
        intercept -= intercept_step
        weight -= weight_step
        history.append(mean_loss(rows, intercept, weight))
        if max(abs(intercept_step), abs(weight_step)) < 1e-10:
            return {
                "intercept": intercept,
                "weight": weight,
                "lossBefore": history[0],
                "lossAfter": history[-1],
                "steps": step,
                "lossHistory": history,
            }
    raise ValueError("Spambase logistic regression did not converge")


def prepare(raw):
    rows, groups = split_rows(raw)
    examples = {
        "focal": "E17",
        "validation": ["E17", "E3383", "E8", "E1365", "E3027"],
        "worked": ["E574", "E1748", "E4447"],
        "test": ["E4415", "E19"],
    }
    for split, key in (("validation", "validation"), ("train", "worked"), ("test", "test")):
        ids = {row["id"] for row in rows[split]}
        if not ids.issuperset(examples[key]):
            raise ValueError(f"Unexpected teaching row assignment in {split}")
    return {
        "source_sha256": sha256(raw).hexdigest(),
        "feature": {"column": FEATURE_COLUMN, "name": "char_freq_!", "unit": "percentage points"},
        "split": {"seed": SPLIT_SEED, "groups": groups},
        "rows": rows,
        "fit": fit(rows["train"]),
        "examples": examples,
        "thresholds": {"default": 0.5, "presets": [0.35, 0.5, 0.65]},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Path to the official UCI spambase.data file")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    fixture = prepare(args.source.read_bytes())
    args.output.write_text(json.dumps(fixture, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
