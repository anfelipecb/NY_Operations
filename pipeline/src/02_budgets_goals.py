"""Build FY2022–FY2026 budget, goal, outcome, anomaly, and proposal tables.

Rules, in the order a flag has to pass them:

- Spending units with applicable_mmr_goals of NA, blank, or * stay Unmapped.
  Units tagged All stay on their own line. Neither is spread across numbered goals.
- A numbered goal is flagged when prior-year spending is at least $10 million,
  a majority of at least three scored indicators moved against desireddirection
  from FY2025 to FY2026, and the plan move is sharp: at least 10 points, or at
  least 5 points and a modified z-score of 3.5 against that agency's other goals.
- Overtime is flagged when it rose, rose faster than expenditures, the gap is at
  least 5 points, and FY2026 overtime is at least $1 million. The five-year
  window is preferred; the latest year is used when the window does not qualify.
- Proposed metrics are existing public indicators. No savings dollar is invented.
"""

from __future__ import annotations

import json
import re
from difflib import SequenceMatcher

import pandas as pd

from utils import (
    CHAPTERS,
    EXPENDITURE_LABEL,
    FY_END,
    FY_LATEST,
    FY_PREV,
    FY_START,
    MAD_Z,
    MIN_GOALS_FOR_MAD,
    MIN_INDICATORS,
    OT_FLAG_MIN_MILLIONS,
    OT_MILLIONS_LABEL,
    OT_THOUSANDS_LABEL,
    OUT,
    PERSONNEL_CIVILIAN,
    PERSONNEL_FTE,
    PERSONNEL_LABEL,
    PERSONNEL_TOTAL,
    PERSONNEL_UNIFORMED,
    PRIOR_MIN_MILLIONS,
    RAW,
    SPEND_MOVE_FLOOR,
    SPEND_MOVE_FLOOR_MAD,
    YEARS,
    ensure_dirs,
    norm_text,
    overtime_to_millions,
    parse_number,
    pct_change,
)

GOAL_LINE = re.compile(r"^\s*Goal\s+(\d+[a-z])\s+(.+?)\s*$", re.IGNORECASE)
CODE_TOKEN = re.compile(r"^\d+[a-z]$", re.IGNORECASE)


def load_resources() -> pd.DataFrame:
    path = RAW / "mmr_agency_resources.csv"
    frame = pd.read_csv(path, dtype=str)
    frame["reporting_fiscal_year"] = frame["reporting_fiscal_year"].astype(int)
    frame["amount"] = frame["current_fy_projected_actual"].map(parse_number)
    return frame


def resource_slice(resources: pd.DataFrame, label: str) -> pd.DataFrame:
    part = resources[
        (resources["resource_indicators"] == label)
        & resources["reporting_fiscal_year"].between(FY_START, FY_END)
    ].copy()
    return part[["reporting_fiscal_year", "agency", "agency_name", "amount"]]


def build_resources(resources: pd.DataFrame) -> pd.DataFrame:
    exp = resource_slice(resources, EXPENDITURE_LABEL).rename(columns={"amount": "expenditures"})
    exp = exp.drop_duplicates(["reporting_fiscal_year", "agency"], keep="first")
    names = (
        resources.dropna(subset=["agency_name"])
        .drop_duplicates("agency")
        .set_index("agency")["agency_name"]
    )

    ot = resources[
        resources["resource_indicators"].isin([OT_MILLIONS_LABEL, OT_THOUSANDS_LABEL])
        & resources["reporting_fiscal_year"].between(FY_START, FY_END)
    ].copy()
    ot["overtime"] = ot.apply(
        lambda row: overtime_to_millions(row["amount"], row["resource_indicators"]),
        axis=1,
    )
    # Prefer the millions label when an agency publishes both units.
    ot["unit_rank"] = ot["resource_indicators"].map(lambda label: 0 if OT_MILLIONS_LABEL in label else 1)
    ot = ot.sort_values("unit_rank").drop_duplicates(["reporting_fiscal_year", "agency"], keep="first")
    ot = ot[["reporting_fiscal_year", "agency", "overtime"]]

    personnel = build_personnel(resources)

    merged = exp.merge(ot, on=["reporting_fiscal_year", "agency"], how="outer")
    merged = merged.merge(personnel, on=["reporting_fiscal_year", "agency"], how="left")
    merged["agency_name"] = merged["agency"].map(names)
    merged = merged.sort_values(["agency", "reporting_fiscal_year"]).drop_duplicates(
        ["agency", "reporting_fiscal_year"], keep="first"
    )
    merged["ot_share_pct"] = merged.apply(
        lambda row: (row["overtime"] / row["expenditures"] * 100.0)
        if row["expenditures"] not in (None, 0) and pd.notna(row["expenditures"]) and pd.notna(row["overtime"])
        else None,
        axis=1,
    )
    merged = merged.rename(columns={"reporting_fiscal_year": "fiscal_year"})
    return merged[
        ["agency", "agency_name", "fiscal_year", "expenditures", "overtime", "personnel", "ot_share_pct"]
    ]


def build_personnel(resources: pd.DataFrame) -> pd.DataFrame:
    window = resources[resources["reporting_fiscal_year"].between(FY_START, FY_END)]
    rows: list[dict] = []
    keys = window.groupby(["reporting_fiscal_year", "agency"], sort=False)
    for (year, agency), group in keys:
        by_label = {
            label: group.loc[group["resource_indicators"] == label, "amount"].dropna()
            for label in (
                PERSONNEL_LABEL,
                PERSONNEL_CIVILIAN,
                PERSONNEL_UNIFORMED,
                PERSONNEL_TOTAL,
                PERSONNEL_FTE,
            )
        }

        def first(label: str) -> float | None:
            series = by_label[label]
            if series.empty:
                return None
            return float(series.iloc[0])

        exact = first(PERSONNEL_LABEL)
        if exact is not None:
            value = exact
        else:
            civilian = first(PERSONNEL_CIVILIAN)
            uniformed = first(PERSONNEL_UNIFORMED)
            if civilian is not None or uniformed is not None:
                value = (civilian or 0.0) + (uniformed or 0.0)
            else:
                value = first(PERSONNEL_TOTAL)
                if value is None:
                    value = first(PERSONNEL_FTE)
        rows.append({"reporting_fiscal_year": year, "agency": agency, "personnel": value})
    return pd.DataFrame(rows)


def split_goal_codes(raw: str | None) -> list[str]:
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return ["Unmapped"]
    text = str(raw).strip()
    if text in {"", "NA", "N/A", "*", "None"}:
        return ["Unmapped"]
    if text.lower() == "all":
        return ["All"]
    codes = []
    for part in re.split(r"\s*,\s*", text):
        token = part.strip().lower()
        if CODE_TOKEN.match(token):
            codes.append(token)
        elif token:
            codes.append("Unmapped")
    return codes or ["Unmapped"]


def spend_bucket(label: str | None) -> str:
    text = (label or "").lower()
    if "other than personal" in text:
        return "otps"
    if "personal" in text:
        return "ps"
    return "other"


def build_goal_spend(crosswalk: pd.DataFrame) -> pd.DataFrame:
    frame = pd.read_csv(RAW / "pmmr_spending_budget.csv", dtype=str)
    frame["fiscal_year"] = frame["reporting_fiscal_year"].astype(int)
    frame = frame[frame["fiscal_year"].between(FY_START, FY_END)].copy()
    frame["prior"] = frame["expenditures_previous_fy"].map(parse_number)
    frame["plan"] = frame["financial_plan_current_fy"].map(parse_number)
    frame["bucket"] = frame["ps_otps_ind"].map(spend_bucket)
    frame["codes"] = frame["applicable_mmr_goals"].map(split_goal_codes)
    frame["shared"] = frame["codes"].map(lambda codes: len([c for c in codes if c not in {"All", "Unmapped"}]) > 1)
    labels = {}
    if not crosswalk.empty:
        labels = {
            (row.agency, row.goal_code): row.goal_label
            for row in crosswalk.itertuples(index=False)
        }

    long = frame.explode("codes").rename(columns={"codes": "goal"})
    records = []
    grouped = long.groupby(["agency", "fiscal_year", "goal"], sort=False)
    for (agency, year, goal), group in grouped:
        def total(bucket: str, column: str) -> float | None:
            series = group.loc[group["bucket"] == bucket, column].dropna()
            if series.empty:
                return None
            return float(series.sum())

        prior_parts = [total(b, "prior") for b in ("ps", "otps", "other")]
        plan_parts = [total(b, "plan") for b in ("ps", "otps", "other")]
        prior = None if all(part is None for part in prior_parts) else float(sum(p or 0 for p in prior_parts))
        plan = None if all(part is None for part in plan_parts) else float(sum(p or 0 for p in plan_parts))
        shared_units = int(group.loc[group["shared"], "unit_of_appropriation"].nunique())
        records.append(
            {
                "agency": agency,
                "fiscal_year": int(year),
                "goal": goal,
                "goal_label": labels.get((agency, goal)),
                "ps": total("ps", "plan"),
                "otps": total("otps", "plan"),
                "prior_expenditures": prior,
                "financial_plan": plan,
                "mapped": goal not in {"All", "Unmapped"},
                "shared_units": shared_units,
                "unit_count": int(group["unit_of_appropriation"].nunique()),
                "spend_change_pct": pct_change(plan, prior),
            }
        )
    return pd.DataFrame.from_records(records)


def load_indicators() -> pd.DataFrame:
    frame = pd.read_csv(RAW / "mmr_performance_indicators.csv", low_memory=False)
    frame["fiscal_year"] = pd.to_numeric(frame["fiscalyear"], errors="coerce")
    # Monthly rows store one month in acceptedvalue. The MMR annual column is acceptedvalueytd
    # on the latest date in the fiscal year. Fall back to acceptedvalue when YTD is blank.
    ytd = frame["acceptedvalueytd"].map(parse_number) if "acceptedvalueytd" in frame.columns else None
    month = frame["acceptedvalue"].map(parse_number)
    frame["value"] = month if ytd is None else ytd.where(ytd.notna(), month)
    frame["valuedate"] = pd.to_datetime(frame["valuedate"], errors="coerce")
    frame["_has_ytd"] = False if ytd is None else ytd.notna()
    frame = frame[frame["fiscal_year"].between(FY_START, FY_END)].copy()
    frame["goal"] = frame["goal"].fillna("").astype(str).str.strip()
    frame["indicator"] = frame["indicator"].fillna("").astype(str).str.strip()
    frame["agency"] = frame["agency"].astype(str).str.strip()
    frame = frame[(frame["goal"] != "") & (frame["indicator"] != "")]
    frame["critical"] = frame["critical"].astype(str).str.strip().str.lower().eq("yes")
    frame["desired_direction"] = frame["desireddirection"].fillna("").astype(str).str.strip()
    frame = frame.sort_values(["_has_ytd", "valuedate"]).drop_duplicates(
        ["agency", "goal", "indicator", "fiscal_year"], keep="last"
    )
    return frame


def extract_chapter_goals(text: str) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    seen: set[str] = set()
    for line in text.splitlines():
        match = GOAL_LINE.match(line)
        if not match:
            continue
        code = match.group(1).lower()
        if code in seen:
            continue
        label = re.sub(r"\s+", " ", match.group(2)).strip(" .")
        if ". " in label and len(label) > 180:
            label = label.split(". ")[0]
        if len(label) < 8:
            continue
        seen.add(code)
        found.append((code, label))
    return found


def match_label(label: str, choices: dict[str, str]) -> tuple[str, float] | None:
    key = norm_text(label)
    if not key:
        return None
    if key in choices:
        return choices[key], 1.0
    best: tuple[str, float] | None = None
    for choice_key, original in choices.items():
        if not choice_key:
            continue
        score = 0.0
        if key in choice_key or choice_key in key:
            shorter, longer = sorted((key, choice_key), key=len)
            if longer and len(shorter) / len(longer) >= 0.72:
                score = len(shorter) / len(longer)
        ratio = SequenceMatcher(None, key, choice_key).ratio()
        score = max(score, ratio if ratio >= 0.84 else 0.0)
        if score and (best is None or score > best[1]):
            best = (original, score)
    return best


def build_crosswalk(indicators: pd.DataFrame) -> pd.DataFrame:
    by_agency: dict[str, dict[str, str]] = {}
    for agency, group in indicators.groupby("agency"):
        choices: dict[str, str] = {}
        for goal in group["goal"].dropna().unique():
            key = norm_text(goal)
            if key and key not in choices:
                choices[key] = goal
        by_agency[str(agency)] = choices

    candidates: list[tuple[float, str, list[tuple[str, str, float]], str]] = []
    for path in sorted(CHAPTERS.glob("*.txt")):
        goals = extract_chapter_goals(path.read_text(errors="replace"))
        if len(goals) < 2:
            continue
        for agency, choices in by_agency.items():
            ranked: list[tuple[float, str, str]] = []
            for code, label in goals:
                hit = match_label(label, choices)
                if hit:
                    ranked.append((hit[1], code, hit[0]))
            ranked.sort(reverse=True)
            pairs: list[tuple[str, str, float]] = []
            used: set[str] = set()
            for score, code, prose in ranked:
                if prose in used:
                    continue
                used.add(prose)
                pairs.append((code, prose, score))
            if len(pairs) < 2:
                continue
            coverage = len(pairs) / len(goals)
            if coverage >= 0.45:
                candidates.append((coverage, agency, pairs, path.stem))

    # One chapter per agency, highest coverage first, so a topical PDF cannot overwrite a real chapter.
    candidates.sort(key=lambda item: item[0], reverse=True)
    used_agencies: set[str] = set()
    used_chapters: set[str] = set()
    rows = []
    for _coverage, agency, pairs, chapter in candidates:
        if agency in used_agencies or chapter in used_chapters:
            continue
        used_agencies.add(agency)
        used_chapters.add(chapter)
        for code, prose, score in pairs:
            rows.append(
                {
                    "agency": agency,
                    "goal_code": code,
                    "goal_label": prose,
                    "match_score": round(score, 3),
                    "chapter": chapter,
                }
            )
    crosswalk = pd.DataFrame(rows)
    if crosswalk.empty:
        return crosswalk
    return crosswalk.sort_values("match_score", ascending=False).drop_duplicates(
        ["agency", "goal_code"], keep="first"
    )


def indicator_moves(indicators: pd.DataFrame) -> pd.DataFrame:
    wide = indicators.pivot_table(
        index=["agency", "goal", "indicator", "desired_direction", "critical"],
        columns="fiscal_year",
        values="value",
        aggfunc="last",
    )
    frames = []
    for year in range(FY_START + 1, FY_END + 1):
        if year not in wide.columns or (year - 1) not in wide.columns:
            continue
        part = wide[[year - 1, year]].dropna().reset_index()
        part = part[part["desired_direction"].isin(["Up", "Down"])]
        part = part[part[year - 1] != 0]
        part["change_pct"] = (part[year] / part[year - 1] - 1.0) * 100.0
        part["with_direction"] = part.apply(
            lambda row: row["change_pct"] > 0 if row["desired_direction"] == "Up" else row["change_pct"] < 0,
            axis=1,
        )
        part["fiscal_year"] = year
        frames.append(part)
    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)


def build_goal_outcomes(moves: pd.DataFrame, crosswalk: pd.DataFrame) -> pd.DataFrame:
    if moves.empty or crosswalk.empty:
        return pd.DataFrame(
            columns=[
                "agency",
                "goal",
                "fiscal_year",
                "indicator_count",
                "improving_count",
                "share_with_direction",
            ]
        )
    lookup = crosswalk.copy()
    lookup["goal_key"] = lookup["goal_label"].map(norm_text)
    merged = moves.copy()
    merged["goal_key"] = merged["goal"].map(norm_text)
    merged = merged.merge(
        lookup[["agency", "goal_key", "goal_code"]],
        on=["agency", "goal_key"],
        how="inner",
    )
    grouped = (
        merged.groupby(["agency", "goal_code", "fiscal_year"], as_index=False)
        .agg(
            indicator_count=("indicator", "nunique"),
            improving_count=("with_direction", "sum"),
        )
    )
    grouped["improving_count"] = grouped["improving_count"].astype(int)
    grouped["share_with_direction"] = grouped["improving_count"] / grouped["indicator_count"]
    return grouped.rename(columns={"goal_code": "goal"})


def build_indicator_rows(indicators: pd.DataFrame, crosswalk: pd.DataFrame) -> pd.DataFrame:
    rows = indicators[
        ["agency", "goal", "indicator", "fiscal_year", "value", "desired_direction", "critical"]
    ].copy()
    if crosswalk.empty:
        rows["goal_code"] = None
        return rows
    lookup = crosswalk.copy()
    lookup["goal_key"] = lookup["goal_label"].map(norm_text)
    rows["goal_key"] = rows["goal"].map(norm_text)
    rows = rows.merge(lookup[["agency", "goal_key", "goal_code"]], on=["agency", "goal_key"], how="left")
    return rows.drop(columns=["goal_key"])


def lever_for(text: str) -> str:
    lowered = text.lower()
    if any(word in lowered for word in ("contract", "vendor", "consultant", "insource")):
        return "insourcing"
    if "consolidat" in lowered:
        return "consolidation"
    if any(word in lowered for word in ("sunset", "eliminat", "phase out")):
        return "sunsetting"
    return "efficiency"


def build_anomalies(
    resources: pd.DataFrame,
    goal_spend: pd.DataFrame,
    outcomes: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    anomalies: list[dict] = []
    proposals: list[dict] = []

    latest_spend = goal_spend[
        (goal_spend["fiscal_year"] == FY_LATEST) & goal_spend["mapped"] & goal_spend["spend_change_pct"].notna()
    ]
    latest_outcomes = outcomes[outcomes["fiscal_year"] == FY_LATEST] if not outcomes.empty else outcomes

    for agency, group in latest_spend.groupby("agency"):
        changes = group["spend_change_pct"]
        mad = None
        median = None
        if len(group) >= MIN_GOALS_FOR_MAD:
            median = float(changes.median())
            mad_value = float((changes - median).abs().median())
            if mad_value:
                mad = mad_value
        for row in group.itertuples(index=False):
            if row.prior_expenditures is None or pd.isna(row.prior_expenditures):
                continue
            if float(row.prior_expenditures) < PRIOR_MIN_MILLIONS:
                continue
            move = abs(float(row.spend_change_pct))
            z = None
            if mad is not None and median is not None:
                z = 0.6745 * (float(row.spend_change_pct) - median) / mad
            level_sharp = move >= SPEND_MOVE_FLOOR
            relative_sharp = z is not None and abs(z) >= MAD_Z and move >= SPEND_MOVE_FLOOR_MAD
            if not level_sharp and not relative_sharp:
                continue
            outcome = latest_outcomes[
                (latest_outcomes["agency"] == agency) & (latest_outcomes["goal"] == row.goal)
            ]
            if outcome.empty:
                continue
            outcome_row = outcome.iloc[0]
            count = int(outcome_row["indicator_count"])
            improving = int(outcome_row["improving_count"])
            share = float(outcome_row["share_with_direction"])
            if count < MIN_INDICATORS or (1 - share) <= 0.5:
                continue
            label = row.goal_label or row.goal
            direction = "up" if row.spend_change_pct > 0 else "down"
            against = count - improving
            question = (
                f"The FY2026 financial plan for {row.goal} ({label}) is {direction} "
                f"{abs(row.spend_change_pct):.0f}% from prior-year spending, while {against} of {count} "
                f"scored indicators moved against their aim. What should {agency} change in this goal "
                f"before the next Chief Savings Officer update?"
            )
            anomalies.append(
                {
                    "agency": agency,
                    "fiscal_year": FY_LATEST,
                    "kind": "goal_spend_outcomes",
                    "goal": row.goal,
                    "goal_label": row.goal_label,
                    "spend_change_pct": round(float(row.spend_change_pct), 2),
                    "outcome_share_against": round(1 - share, 4),
                    "indicator_count": count,
                    "question": question,
                    "lever": lever_for(f"{label}"),
                }
            )

    wide = resources.pivot(index="agency", columns="fiscal_year", values="overtime")
    exp = resources.pivot(index="agency", columns="fiscal_year", values="expenditures")
    for agency in wide.index:
        def cell(frame: pd.DataFrame, year: int) -> float | None:
            if agency not in frame.index or year not in frame.columns:
                return None
            value = frame.at[agency, year]
            if value is None or pd.isna(value):
                return None
            return float(value)

        ot_start, ot_prev, ot_end = cell(wide, FY_START), cell(wide, FY_PREV), cell(wide, FY_END)
        exp_start, exp_prev, exp_end = cell(exp, FY_START), cell(exp, FY_PREV), cell(exp, FY_END)
        if ot_end is None or ot_end < OT_FLAG_MIN_MILLIONS:
            continue
        window_ot = pct_change(ot_end, ot_start)
        window_exp = pct_change(exp_end, exp_start)
        latest_ot = pct_change(ot_end, ot_prev)
        latest_exp = pct_change(exp_end, exp_prev)
        window_hit = (
            window_ot is not None
            and window_exp is not None
            and window_ot > 0
            and window_ot > window_exp
            and window_ot - window_exp >= 5
        )
        latest_hit = (
            latest_ot is not None
            and latest_exp is not None
            and latest_ot > 0
            and latest_ot > latest_exp
            and latest_ot - latest_exp >= 5
        )
        if not window_hit and not latest_hit:
            continue
        if window_hit:
            latest_clause = ""
            if latest_ot is not None and latest_exp is not None:
                latest_clause = (
                    f" From FY2025 to FY2026 overtime moved {latest_ot:.0f}% and expenditures {latest_exp:.0f}%."
                )
            question = (
                f"Overtime rose {window_ot:.0f}% from FY2022 to FY2026 while expenditures moved {window_exp:.0f}%."
                f"{latest_clause} "
                f"Is this a recurring cost driver for the next Chief Savings Officer update?"
            )
            spend_change = window_ot - window_exp
        else:
            question = (
                f"Overtime rose {latest_ot:.0f}% from FY2025 to FY2026 while expenditures moved {latest_exp:.0f}%. "
                f"Is the latest year a recurring cost driver, or a one-year spike?"
            )
            spend_change = latest_ot - latest_exp
        anomalies.append(
            {
                "agency": agency,
                "fiscal_year": FY_LATEST,
                "kind": "overtime_outpacing",
                "goal": "Overtime",
                "goal_label": "Overtime paid",
                "spend_change_pct": round(float(spend_change), 2),
                "outcome_share_against": None,
                "indicator_count": None,
                "question": question,
                "lever": "efficiency",
            }
        )
        proposals.append(
            {
                "agency": agency,
                "goal": "Overtime",
                "indicator": "Overtime paid",
                "desired_direction": "Down",
                "critical": False,
                "value_start": None if ot_start is None else round(float(ot_start), 3),
                "value_end": round(float(ot_end), 3),
                "change_pct": None if window_ot is None else round(float(window_ot), 2),
                "lever": "efficiency",
                "note": (
                    "Overtime is already a line in Agency Resources. Watch the dollars and the share of "
                    "expenditures. The aim used here is lower overtime, which is the efficiency question, "
                    "not a target published as a performance indicator."
                ),
            }
        )

    anomaly_columns = [
        "agency",
        "fiscal_year",
        "kind",
        "goal",
        "goal_label",
        "spend_change_pct",
        "outcome_share_against",
        "indicator_count",
        "question",
        "lever",
    ]
    proposal_columns = [
        "agency",
        "goal",
        "indicator",
        "desired_direction",
        "critical",
        "value_start",
        "value_end",
        "change_pct",
        "lever",
        "note",
    ]
    anomaly_frame = pd.DataFrame(anomalies, columns=anomaly_columns)
    proposal_frame = pd.DataFrame(proposals, columns=proposal_columns)
    return anomaly_frame, proposal_frame


def build_goal_proposals(
    moves: pd.DataFrame,
    anomalies: pd.DataFrame,
    indicators: pd.DataFrame,
) -> pd.DataFrame:
    goal_flags = anomalies[anomalies["kind"] == "goal_spend_outcomes"] if not anomalies.empty else anomalies
    if goal_flags.empty or moves.empty:
        return pd.DataFrame()
    latest = moves[moves["fiscal_year"] == FY_LATEST].copy()
    lookup_codes = indicators[["agency", "goal"]].drop_duplicates()
    rows = []
    levels = indicators.pivot_table(
        index=["agency", "goal", "indicator"],
        columns="fiscal_year",
        values="value",
        aggfunc="last",
    )
    for flag in goal_flags.itertuples(index=False):
        prose = flag.goal_label
        if not prose:
            continue
        pool = latest[
            (latest["agency"] == flag.agency)
            & (latest["goal"] == prose)
            & (~latest["with_direction"])
        ].copy()
        if pool.empty:
            continue
        pool["adverse"] = pool["change_pct"].abs()
        pool = pool.sort_values(["critical", "adverse"], ascending=[False, False]).head(3)
        for item in pool.itertuples(index=False):
            start = None
            end = None
            if (flag.agency, prose, item.indicator) in levels.index:
                series = levels.loc[(flag.agency, prose, item.indicator)]
                if FY_START in series.index and pd.notna(series[FY_START]):
                    start = float(series[FY_START])
                if FY_END in series.index and pd.notna(series[FY_END]):
                    end = float(series[FY_END])
            aim = "up" if item.desired_direction == "Up" else "down"
            move = float(item.change_pct)
            if abs(move) < 0.05:
                movement = f"From FY2025 to FY2026 this was unchanged, so it did not follow an aim that it go {aim}."
            else:
                movement = f"From FY2025 to FY2026 this moved {move:+.1f}%, against an aim that it go {aim}."
            rows.append(
                {
                    "agency": flag.agency,
                    "goal": flag.goal,
                    "indicator": item.indicator,
                    "desired_direction": item.desired_direction,
                    "critical": bool(item.critical),
                    "value_start": None if start is None else round(start, 3),
                    "value_end": None if end is None else round(end, 3),
                    "change_pct": round(float(item.change_pct), 2),
                    "lever": lever_for(f"{prose} {item.indicator}"),
                    "note": (
                        f"{movement} "
                        f"It is already in the MMR. Ask how the FY2026 plan for {flag.goal} ({prose}) is supposed to move it."
                    ),
                }
            )
    _ = lookup_codes
    return pd.DataFrame(rows)


def agencies_table(
    resources: pd.DataFrame,
    goal_spend: pd.DataFrame,
    indicators: pd.DataFrame,
) -> pd.DataFrame:
    names = (
        resources.dropna(subset=["agency_name"])
        .drop_duplicates("agency")
        .set_index("agency")["agency_name"]
        .to_dict()
    )
    if "agency_name" in indicators.columns:
        for row in indicators.dropna(subset=["agency_name"]).drop_duplicates("agency").itertuples(index=False):
            names.setdefault(str(row.agency), str(row.agency_name))
    codes = set(names) | set(goal_spend["agency"].dropna()) | set(indicators["agency"].dropna())
    rows = []
    for code in sorted(codes, key=str):
        name = names.get(code) or str(code)
        compact = str(code).replace("-", "").replace(" ", "")
        rows.append(
            {
                "agency": code,
                "agency_name": name,
                "search_text": f"{code} {compact} {name}".lower(),
            }
        )
    return pd.DataFrame(rows)


def main() -> None:
    ensure_dirs()
    resources_raw = load_resources()
    resources = build_resources(resources_raw)
    indicators = load_indicators()
    crosswalk = build_crosswalk(indicators)
    goal_spend = build_goal_spend(crosswalk)
    moves = indicator_moves(indicators)
    outcomes = build_goal_outcomes(moves, crosswalk)
    indicator_rows = build_indicator_rows(indicators, crosswalk)
    anomalies, ot_proposals = build_anomalies(resources, goal_spend, outcomes)
    goal_proposals = build_goal_proposals(moves, anomalies, indicators)
    proposals = pd.concat([ot_proposals, goal_proposals], ignore_index=True) if not ot_proposals.empty or not goal_proposals.empty else pd.DataFrame()
    agencies = agencies_table(resources, goal_spend, indicators)

    resources = resources.drop(columns=["agency_name"])
    agencies.to_csv(OUT / "agencies.csv", index=False)
    resources.to_csv(OUT / "resource_series.csv", index=False)
    goal_spend.to_csv(OUT / "goal_spend.csv", index=False)
    outcomes.to_csv(OUT / "goal_outcomes.csv", index=False)
    indicator_rows.to_csv(OUT / "indicators.csv", index=False)
    anomalies.to_csv(OUT / "anomalies.csv", index=False)
    proposals.to_csv(OUT / "metric_proposals.csv", index=False)
    crosswalk.to_csv(OUT / "goal_crosswalk.csv", index=False)

    check = resources[(resources["agency"].isin(["NYPD", "DOC", "DSNY"])) & (resources["fiscal_year"] == FY_END)]
    print("FY2026 resource check")
    print(check.to_string(index=False))
    print(f"Crosswalk rows: {len(crosswalk)} agencies: {crosswalk['agency'].nunique() if not crosswalk.empty else 0}")
    print(f"Anomalies: {len(anomalies)}")
    if not anomalies.empty:
        print(anomalies["kind"].value_counts().to_string())
    print(f"Proposals: {len(proposals)}")
    print(f"Indicators: {len(indicator_rows):,}")
    print(f"Goal spend rows: {len(goal_spend):,}")

    meta = {
        "window": f"FY{FY_START}-FY{FY_END}",
        "pulled_at": "2026-11-06",
        "resources_dataset": "4qmi-txnk",
        "indicators_dataset": "rbed-zzin",
        "spending_dataset": "w4ne-9ea9",
        "chapter_source": "https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/",
        "agency_count": str(len(agencies)),
        "resource_rows": str(len(resources)),
        "goal_spend_rows": str(len(goal_spend)),
        "goal_outcome_rows": str(len(outcomes)),
        "indicator_rows": str(len(indicator_rows)),
        "anomaly_count": str(len(anomalies)),
        "proposal_count": str(len(proposals)),
        "crosswalk_rows": str(len(crosswalk)),
        "crosswalk_agencies": str(crosswalk["agency"].nunique() if not crosswalk.empty else 0),
        "rule_spend": (
            "FY2026 financial plan versus prior-year expenditures of at least $10 million. "
            "Sharp means a change of at least 10 points, or at least 5 points with a modified "
            "z-score of 3.5 on the agency median absolute deviation. A majority of at least 3 "
            "scored indicators must move against desireddirection."
        ),
        "rule_overtime": (
            "Overtime rose, rose at least 5 points faster than expenditures, and FY2026 overtime "
            "is at least $1 million. Five-year change is preferred; FY2025 to FY2026 is the fallback."
        ),
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"Wrote tables to {OUT}")


if __name__ == "__main__":
    main()
