"""Shared paths and parsing for the public MMR pipeline."""

from __future__ import annotations

import pathlib
import re

import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
CHAPTERS = RAW / "chapters"

FY_START = 2022
FY_END = 2026
FY_LATEST = 2026
FY_PREV = 2025
YEARS = list(range(FY_START, FY_END + 1))

EXPENDITURE_LABEL = "Expenditures ($000,000)"
OT_MILLIONS_LABEL = "Overtime paid ($000,000)"
OT_THOUSANDS_LABEL = "Overtime paid ($000)"
PERSONNEL_LABEL = "Personnel"
PERSONNEL_CIVILIAN = "Personnel (civilian)"
PERSONNEL_UNIFORMED = "Personnel (uniformed)"
PERSONNEL_TOTAL = "Personnel (Total FT and FTE)"
PERSONNEL_FTE = "Full-time equivalent (FTE) personnel"

# Overtime flags ignore amounts under $1 million so a tiny base cannot crowd the list.
OT_FLAG_MIN_MILLIONS = 1.0
# A goal is sharp at 10 points on its own, or at 5 points when it is an agency-level MAD outlier.
SPEND_MOVE_FLOOR = 10.0
SPEND_MOVE_FLOOR_MAD = 5.0
PRIOR_MIN_MILLIONS = 10.0
MAD_Z = 3.5
MIN_GOALS_FOR_MAD = 3
MIN_INDICATORS = 3


def ensure_dirs() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    CHAPTERS.mkdir(parents=True, exist_ok=True)


def parse_number(value: str | float | int | None) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text or text in {"*", "NA", "N/A", "-", "None"}:
        return None
    cleaned = re.sub(r"[$,%]", "", text).replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def overtime_to_millions(value: float | None, label: str) -> float | None:
    if value is None:
        return None
    if OT_MILLIONS_LABEL in label:
        return value
    if OT_THOUSANDS_LABEL in label:
        return value / 1000.0
    return value


def pct_change(new: float | None, old: float | None) -> float | None:
    if new is None or old is None or old == 0:
        return None
    return (new / old - 1.0) * 100.0


def norm_text(value: str | None) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    text = str(value).lower().replace("’", "'").replace("“", '"').replace("”", '"')
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()
