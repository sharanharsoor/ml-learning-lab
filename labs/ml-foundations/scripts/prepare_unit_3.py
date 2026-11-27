"""Extract the teaching rows from UCI Bike Sharing's hour.csv."""

import argparse
import csv
from datetime import date, timedelta
import hashlib
import io
import json
from pathlib import Path
import zipfile


def prepare(archive_path):
    with zipfile.ZipFile(archive_path) as archive:
        raw_csv = archive.read("hour.csv")
    rows = list(csv.DictReader(io.StringIO(raw_csv.decode("utf-8-sig"))))
    training = [row for row in rows if row["dteday"] < "2012-11-01"]
    hourly_keys = {(row["dteday"], int(row["hr"])) for row in training}
    start = date.fromisoformat(min(row["dteday"] for row in training))
    end = date.fromisoformat(max(row["dteday"] for row in training))
    days = (end - start).days + 1
    expected_keys = {
        ((start + timedelta(days=day)).isoformat(), hour)
        for day in range(days)
        for hour in range(24)
    }
    profile = [
        {
            "id": int(row["instant"]),
            "date": row["dteday"],
            "hour": int(row["hr"]),
            "workday": int(row["workingday"]),
            "weather": int(row["weathersit"]),
            "temperature": round(float(row["temp"]) * 41, 2),
            "count": int(row["cnt"]),
        }
        for row in training
        if row["dteday"] == "2012-10-25" and 7 <= int(row["hr"]) <= 11
    ]
    groups = {"workday": [], "nonWorkday": []}
    for row in training:
        if row["hr"] == "8":
            group = "workday" if row["workingday"] == "1" else "nonWorkday"
            groups[group].append([
                row["dteday"],
                int(row["cnt"]),
                round(float(row["temp"]) * 41, 2),
            ])
    return {
        "source_sha256": hashlib.sha256(raw_csv).hexdigest(),
        "profile": sorted(profile, key=lambda row: row["hour"]),
        "groups": groups,
        "audit": {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "rows": len(training),
            "blankCells": sum(value.strip() == "" for row in training for value in row.values()),
            "duplicateKeys": len(training) - len(hourly_keys),
            "expectedHours": len(expected_keys),
            "absentHours": len(expected_keys - hourly_keys),
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="Path to the official UCI Bike Sharing ZIP")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "data/unit-3.json")
    args = parser.parse_args()
    payload = prepare(args.archive)
    args.output.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
