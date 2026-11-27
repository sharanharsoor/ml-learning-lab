"""Prepare the Unit 4 teaching excerpt from UCI Bike Sharing's hour.csv."""

import argparse
import csv
import io
import json
from pathlib import Path
from statistics import mean
from zipfile import ZipFile

VALIDATION_START = "2012-10-01"
TEST_START = "2012-11-01"
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "unit-4.json"


def fit_rules(rows):
    all_counts = []
    by_calendar = {}
    for row in rows:
        rentals = int(row["cnt"])
        all_counts.append(rentals)
        by_calendar.setdefault((row["hr"], row["workingday"]), []).append(rentals)
    return round(mean(all_counts)), {key: round(mean(counts)) for key, counts in by_calendar.items()}


def evaluate(rows, baseline, calendar):
    absolute_errors = {"training_mean": [], "calendar_model": []}
    for row in rows:
        actual = int(row["cnt"])
        expected = calendar[(row["hr"], row["workingday"])]
        absolute_errors["training_mean"].append(abs(actual - baseline))
        absolute_errors["calendar_model"].append(abs(actual - expected))
    return {
        name: {"mae": mean(errors), "absolute_error_total": sum(errors)}
        for name, errors in absolute_errors.items()
    }


def summarize(rows):
    return {"start": rows[0]["dteday"], "end": rows[-1]["dteday"], "n": len(rows)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path, help="Official UCI Bike Sharing ZIP")
    args = parser.parse_args()
    with ZipFile(args.archive) as archive:
        with archive.open("hour.csv") as stream:
            rows = sorted(csv.DictReader(io.TextIOWrapper(stream)), key=lambda row: (row["dteday"], int(row["hr"])))

    train = [row for row in rows if row["dteday"] < VALIDATION_START]
    validation = [row for row in rows if VALIDATION_START <= row["dteday"] < TEST_START]
    test = [row for row in rows if row["dteday"] >= TEST_START]
    train_mean, calendar = fit_rules(train)
    validation_scores = evaluate(validation, train_mean, calendar)
    refitted_baseline, refitted_calendar = fit_rules(train + validation)
    test_scores = evaluate(test, refitted_baseline, refitted_calendar)
    source_row, = [row for row in test if (row["dteday"], row["hr"]) == (TEST_START, "8")]
    assert int(source_row["cnt"]) == int(source_row["casual"]) + int(source_row["registered"])
    lesson = {
        "train": summarize(train),
        "validation": summarize(validation),
        "validation_baseline": train_mean,
        "validation_results": validation_scores,
        "test_results": test_scores,
        "case": {
            "record": int(source_row["instant"]),
            "casual": int(source_row["casual"]),
            "registered": int(source_row["registered"]),
        },
    }
    OUTPUT.write_text(json.dumps(lesson, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
