"""Upsert public aggregates into ops_ tables.

Requires SUPABASE_SERVICE_ROLE_KEY. Refuses to run without it, and never prints the key.
Does not write seed SQL into the repo.
"""

from __future__ import annotations

import json
import os
import sys

import pandas as pd
from dotenv import load_dotenv

from utils import OUT, ROOT, ensure_dirs

load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "apps" / "web" / ".env")

URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not URL or not KEY:
    print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env. The anon key cannot upsert.")
    sys.exit(1)

from supabase import create_client  # noqa: E402

client = create_client(URL, KEY)
ensure_dirs()


def frame(name: str) -> pd.DataFrame:
    return pd.read_csv(OUT / name)


def records(df: pd.DataFrame) -> list[dict]:
    if df.empty:
        return []
    clean = df.copy()
    for column in clean.columns:
        if clean[column].dtype == bool:
            continue
        clean[column] = clean[column].where(pd.notnull(clean[column]), None)
    payload = json.loads(clean.to_json(orient="records"))
    for row in payload:
        for key, value in list(row.items()):
            if value is None:
                continue
            if key in {"fiscal_year", "shared_units", "unit_count", "indicator_count", "improving_count"}:
                row[key] = int(value)
            if key in {"mapped", "critical"}:
                if isinstance(value, str):
                    row[key] = value.strip().lower() in {"true", "t", "1", "yes"}
                else:
                    row[key] = bool(value)
    return payload


def upsert(table: str, rows: list[dict], conflict: str, size: int = 200) -> None:
    if not rows:
        print(f"  {table}: 0")
        return
    for start in range(0, len(rows), size):
        client.table(table).upsert(rows[start : start + size], on_conflict=conflict).execute()
    print(f"  {table}: {len(rows)}")


def replace_all(table: str, rows: list[dict]) -> None:
    client.table(table).delete().gte("id", 0).execute()
    if not rows:
        print(f"  {table}: 0")
        return
    for start in range(0, len(rows), 200):
        client.table(table).insert(rows[start : start + 200]).execute()
    print(f"  {table}: {len(rows)}")


def main() -> None:
    agencies = records(frame("agencies.csv"))
    resources = records(frame("resource_series.csv"))
    goals = records(frame("goal_spend.csv"))
    outcomes = records(frame("goal_outcomes.csv"))
    indicators = records(frame("indicators.csv"))
    anomalies = records(frame("anomalies.csv"))
    proposals = records(frame("metric_proposals.csv"))
    meta = json.loads((OUT / "meta.json").read_text(encoding="utf-8"))
    meta_rows = [{"key": key, "value": str(value)} for key, value in meta.items()]

    upsert("ops_agencies", agencies, "agency")
    upsert("ops_resource_series", resources, "agency,fiscal_year")
    upsert("ops_goal_spend", goals, "agency,fiscal_year,goal")
    upsert("ops_goal_outcomes", outcomes, "agency,fiscal_year,goal")
    upsert("ops_indicators", indicators, "agency,goal,indicator,fiscal_year", size=150)
    replace_all("ops_anomalies", anomalies)
    replace_all("ops_metric_proposals", proposals)
    upsert("ops_meta", meta_rows, "key")
    print("Export finished.")


if __name__ == "__main__":
    main()
