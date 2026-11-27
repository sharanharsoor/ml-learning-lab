"""Export the metrics lesson from UCI Bike Sharing's original hour.csv."""

import argparse
import csv
import io
import json
import math
import zipfile
from collections import defaultdict
from pathlib import Path
from urllib.request import urlopen

SOURCE = "https://archive.ics.uci.edu/static/public/275/bike+sharing+dataset.zip"
TEST_START = "2012-11-01"
LESSON_HOURS = range(7, 12)
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "bikeshare_metrics.json"


def score(actual, forecast):
    assert len(actual) == len(forecast)
    residuals = [y - guess for y, guess in zip(actual, forecast)]
    n = len(actual)
    mean = sum(actual) / n
    sse = sum(e * e for e in residuals)
    sst = math.fsum((y - mean) ** 2 for y in actual)
    return {
        "mae": sum(abs(e) for e in residuals) / n,
        "mse": sse / n,
        "rmse": math.sqrt(sse / n),
        "r2": 1 - sse / sst,
    }


def build(archive):
    with zipfile.ZipFile(io.BytesIO(archive)) as source:
        with source.open("hour.csv") as file:
            records = [
                (row["dteday"], int(row["hr"]), int(row["workingday"]), int(row["cnt"]))
                for row in csv.DictReader(io.TextIOWrapper(file, encoding="utf-8"))
            ]
    records.sort()
    assert len(records) == 17379
    assert len({(date, hour) for date, hour, _, _ in records}) == len(records)
    train = [row for row in records if row[0] < TEST_START]
    test = [row for row in records if row[0] >= TEST_START]

    groups = defaultdict(list)
    for _, hour, workingday, actual in train:
        groups[hour, workingday].append(actual)

    def predict(hour, workingday):
        group = groups[hour, workingday]
        return round(sum(group) / len(group))

    rows = []
    for date, hour, workingday, actual in test:
        if date == TEST_START and hour in LESSON_HOURS:
            group = groups[hour, workingday]
            rows.append({
                "case_id": f"{hour:02d}:00",
                "date": date,
                "hour": hour,
                "workingday": workingday,
                "actual": actual,
                "predicted": predict(hour, workingday),
                "train_group_count": len(group),
                "train_group_total": sum(group),
            })
    assert [row["hour"] for row in rows] == list(LESSON_HOURS)

    baseline = round(sum(actual for _, _, _, actual in train) / len(train))
    return {
        "source": {
            "citation": "Fanaee-T, H. (2013). Bike Sharing [Dataset]. UCI Machine Learning Repository.",
            "doi": "https://doi.org/10.24432/C5W894",
            "archive": SOURCE,
            "license": "https://creativecommons.org/licenses/by/4.0/",
        },
        "train": {"start": train[0][0], "end": train[-1][0], "n": len(train)},
        "test": {"start": test[0][0], "end": test[-1][0], "n": len(test)},
        "rows": rows,
        "baseline": baseline,
        "metric_full_test": {
            "calendar_model": score(
                [row[3] for row in test],
                [predict(hour, workingday) for _, hour, workingday, _ in test],
            ),
            "training_mean": score([row[3] for row in test], [baseline] * len(test)),
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, help="Read an already downloaded UCI ZIP")
    options = parser.parse_args()
    if options.archive:
        archive = options.archive.read_bytes()
    else:
        with urlopen(SOURCE, timeout=30) as response:
            archive = response.read()
    OUTPUT.write_text(json.dumps(build(archive), indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
