"""Extract the source rows shown at the start of ML Foundations."""

import argparse
import csv
import io
import json
import zipfile
from pathlib import Path

DESTINATION = Path(__file__).resolve().parents[1] / "data/unit-1.json"
HISTORY_IDS = [15724, 15772, 15820, 15844, 15868, 15904]
FORECAST_ID = 15928


def read_rows(archive):
    with zipfile.ZipFile(archive) as source:
        with source.open("hour.csv") as hourly:
            return list(csv.DictReader(io.TextIOWrapper(hourly, encoding="utf-8")))


def select(rows):
    indexed = {int(row["instant"]): row for row in rows}

    def entry(row_id):
        row = indexed[row_id]
        return {
            "row_id": row_id,
            "date": row["dteday"],
            "hour": int(row["hr"]),
            "workingday": int(row["workingday"]),
            "rentals": int(row["cnt"]),
        }

    history = [entry(row_id) for row_id in HISTORY_IDS]
    target = entry(FORECAST_ID)
    assert all(row["date"] < target["date"] and row["hour"] == target["hour"] for row in history)
    return {"history": history, "forecast": target}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--output", type=Path, default=DESTINATION)
    args = parser.parse_args()
    args.output.write_text(json.dumps(select(read_rows(args.archive)), indent=2) + "\n", encoding="utf-8")
