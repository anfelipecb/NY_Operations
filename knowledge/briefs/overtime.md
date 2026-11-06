# Brief: overtime as an efficiency zoom

Use this in a separate chat. Read [01_mmr.md](../01_mmr.md) and [02_eo12_cso.md](../02_eo12_cso.md) first.

## Question

Where did overtime rise faster than expenditures from FY2022 to FY2026, and does the latest year (FY2025 to FY2026) agree? Stay with public Agency Resources (`4qmi-txnk`).

## Rules

- Public data only. Do not commit `data/`, `.env`, or secrets.
- Overtime in `$000` must be divided by 1,000 before it is compared with `$000,000` expenditures.
- Quote `reporting_fiscal_year` and `current_fy_projected_actual`. A later MMR can restate a year; say which row you used.
- Do not convert a gap into a savings dollar.
- Write the checked note as `knowledge/findings/overtime.md` with the agencies, the two percent changes, and the sentence a Chief Savings Officer could ask. The pipeline's own flags live in `ops_anomalies` where `kind` is `overtime_outpacing`.

## Already decided in code

`pipeline/src/02_budgets_goals.py` flags an agency when overtime rose, rose at least 5 points faster than expenditures, and FY2026 overtime is at least $1 million. Five-year change wins; the latest year is the fallback. Extend the note. Do not silently change that rule.
