"""Download public MMR tables and Fiscal 2026 agency chapters.

Datasets land in data/raw/, which is gitignored. Nothing here is a secret;
it is still kept out of git so the repo stays code and notes, not a data dump.
"""

from __future__ import annotations

import io
import re
import subprocess
import time

import pandas as pd
import requests

from utils import CHAPTERS, RAW, ensure_dirs

BASE = "https://data.cityofnewyork.us/resource"
MMR_PAGE = "https://www.nyc.gov/site/operations/reports/mmr.page"
PDF_HOST = "https://www.nyc.gov"
LIMIT = 50_000

SKIP_PDFS = {
    "2026_mmr.pdf",
    "2026_additional_tables.pdf",
    "2026_idf.pdf",
    "agency_internal_controls.pdf",
    "agency_procurement_actions_by_method.pdf",
    "agency_rulemaking.pdf",
    "citywide_statement_of_needs.pdf",
    "bus_action_plan.pdf",
    "block_by_block.pdf",
    "child_care_for_all.pdf",
}

SESSION = requests.Session()
SESSION.headers["User-Agent"] = "ny-operations-public-mmr/0.1 (civic research; public data only)"


def fetch_csv(dataset_id: str, name: str, where: str | None = None, select: str | None = None) -> pd.DataFrame:
    path = RAW / f"{name}.csv"
    if path.exists() and path.stat().st_size > 0:
        print(f"  keeping {path.name}")
        return pd.read_csv(path, low_memory=False)
    frames: list[pd.DataFrame] = []
    offset = 0
    while True:
        params: dict[str, str | int] = {"$limit": LIMIT, "$offset": offset}
        if where:
            params["$where"] = where
        if select:
            params["$select"] = select
        print(f"  {dataset_id} offset {offset:,}", flush=True)
        response = None
        for attempt in range(4):
            response = SESSION.get(f"{BASE}/{dataset_id}.csv", params=params, timeout=180)
            if response.status_code < 500:
                break
            print(f"  retry {attempt + 1} after {response.status_code}", flush=True)
            time.sleep(2 * (attempt + 1))
        if response is None:
            raise RuntimeError(f"No response for {dataset_id}")
        response.raise_for_status()
        frame = pd.read_csv(io.StringIO(response.text), low_memory=False)
        if frame.empty:
            break
        frames.append(frame)
        if len(frame) < LIMIT:
            break
        offset += LIMIT
    out = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    path = RAW / f"{name}.csv"
    out.to_csv(path, index=False)
    print(f"  -> {path} ({len(out):,} rows)")
    return out


def chapter_links() -> list[str]:
    response = SESSION.get(MMR_PAGE, timeout=60)
    response.raise_for_status()
    found = sorted(set(re.findall(r"/assets/operations/downloads/pdf/mmr2026/[A-Za-z0-9_]+\.pdf", response.text)))
    kept = []
    for rel in found:
        name = rel.rsplit("/", 1)[-1]
        if name.endswith("_idf.pdf") or name in SKIP_PDFS:
            continue
        kept.append(rel)
    return kept


def download_chapters() -> None:
    links = chapter_links()
    print(f"Agency chapters: {len(links)}")
    for rel in links:
        name = rel.rsplit("/", 1)[-1]
        dest = CHAPTERS / name
        text_path = dest.with_suffix(".txt")
        if not dest.exists():
            file_response = SESSION.get(PDF_HOST + rel, timeout=90)
            file_response.raise_for_status()
            dest.write_bytes(file_response.content)
        if not text_path.exists() or text_path.stat().st_mtime < dest.stat().st_mtime:
            subprocess.run(
                ["pdftotext", "-layout", str(dest), str(text_path)],
                check=True,
                capture_output=True,
            )
    print(f"  -> {CHAPTERS}")


def main() -> None:
    ensure_dirs()
    fetch_csv("4qmi-txnk", "mmr_agency_resources")
    fetch_csv(
        "rbed-zzin",
        "mmr_performance_indicators",
        where=(
            "fiscalyear >= '2022' AND fiscalyear <= '2026' "
            "AND (geo IS NULL OR geo = 'No') "
            "AND (retired IS NULL OR retired != 'Yes')"
        ),
        select=(
            "agency,agency_name,fiscalyear,indicator,goal,service,"
            "desireddirection,critical,acceptedvalue,acceptedvalueytd,valuedate,geo,retired"
        ),
    )
    fetch_csv("w4ne-9ea9", "pmmr_spending_budget")
    download_chapters()
    print("Done.")


if __name__ == "__main__":
    main()
