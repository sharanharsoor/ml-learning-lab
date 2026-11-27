"""Prepare the Unit 5 lagged rental pairs from UCI Bike Sharing's hour.csv."""

import argparse
import csv
from datetime import date, timedelta
import hashlib
import io
import json
from pathlib import Path
from statistics import mean
from zipfile import ZipFile

HOUR = 8
VALIDATION_START = date(2012, 10, 1)
TEST_START = date(2012, 11, 1)
OUTPUT = Path(__file__).resolve().parents[1] / "data/unit-5.json"


def period(day):
    if day < VALIDATION_START:
        return "train"
    if day < TEST_START:
        return "validation"
    return "test"


def fit(pairs, calendar_counts):
    x_values = [pair["previousRentals"] for pair in pairs]
    y_values = [pair["rentals"] for pair in pairs]
    mean_x, mean_y = mean(x_values), mean(y_values)
    cross_products = sum((x - mean_x) * (y - mean_y) for x, y in zip(x_values, y_values))
    squared_x_deviations = sum((x - mean_x) ** 2 for x in x_values)
    slope = cross_products / squared_x_deviations
    calendar_mean = mean(calendar_counts)
    return {
        "n": len(pairs),
        "sumRentals": sum(y_values),
        "meanX": mean_x,
        "meanY": mean_y,
        "intercept": mean_y - slope * mean_x,
        "slope": slope,
        "crossProducts": cross_products,
        "squaredXDeviations": squared_x_deviations,
        "calendarMean": calendar_mean,
        "calendarCount": len(calendar_counts),
        "calendarTotal": sum(calendar_counts),
        "calendarPrediction": round(calendar_mean),
    }


def evaluate(pairs, fitted):
    errors = {"baseline": [], "linear": []}
    for pair in pairs:
        linear_prediction = fitted["intercept"] + fitted["slope"] * pair["previousRentals"]
        errors["baseline"].append(pair["rentals"] - fitted["calendarPrediction"])
        errors["linear"].append(pair["rentals"] - linear_prediction)
    return {
        name: {
            "mae": mean(abs(error) for error in residuals),
            "mse": mean(error ** 2 for error in residuals),
            "absoluteErrorTotal": sum(abs(error) for error in residuals),
        }
        for name, residuals in errors.items()
    }


def prepare(archive_path):
    with ZipFile(archive_path) as archive:
        raw = archive.read("hour.csv")
    morning_rows = [
        row for row in csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
        if int(row["hr"]) == HOUR
    ]
    by_day = {date.fromisoformat(row["dteday"]): row for row in morning_rows}
    if len(morning_rows) != len(by_day):
        raise ValueError("The source has multiple 08:00 rows for the same date")

    paired = {"train": [], "validation": [], "test": []}
    calendar_counts = {"train": [], "validation": [], "test": []}
    missing_previous = []
    for day, target in sorted(by_day.items()):
        if target["workingday"] != "1":
            continue
        split = period(day)
        target_count = int(target["cnt"])
        # The calendar rule can fit on all observed target hours because it needs no lag.
        calendar_counts[split].append(target_count)
        previous = by_day.get(day - timedelta(days=1))
        if previous is None:
            missing_previous.append(target["dteday"])
            continue
        paired[split].append({
            "date": target["dteday"],
            "previousDate": previous["dteday"],
            "previousRentals": int(previous["cnt"]),
            "rentals": target_count,
            "previousRowId": int(previous["instant"]),
            "rowId": int(target["instant"]),
            "previousWorkday": int(previous["workingday"]),
        })

    train = fit(paired["train"], calendar_counts["train"])
    refit = fit(
        paired["train"] + paired["validation"],
        calendar_counts["train"] + calendar_counts["validation"],
    )
    return {
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "hour": HOUR,
        "validationStart": VALIDATION_START.isoformat(),
        "testStart": TEST_START.isoformat(),
        "rows": paired,
        "fits": {"train": train, "refit": refit},
        "scores": {
            "train": evaluate(paired["train"], train),
            "validation": evaluate(paired["validation"], train),
            "test": evaluate(paired["test"], refit),
        },
        "focalDate": "2012-11-01",
        "sampleDates": ["2012-09-17", "2012-09-19", "2012-09-28"],
        "demoLine": {"intercept": 350, "slope": 0.5},
        "excludedMissingPrevious": missing_previous,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="Path to the official UCI Bike Sharing ZIP")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    args.output.write_text(json.dumps(prepare(args.archive), separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
