# Brief: outcome tracking

Use this in a separate chat. Read [01_mmr.md](../01_mmr.md) first.

## Question

For the agencies already flagged on budgets versus goals, which citywide indicators moved against `desireddirection` from FY2025 to FY2026, and which of those does the MMR mark critical?

## Rules

- Public data only. Dataset `rbed-zzin`. Keep `geo` null or `No`, and drop retired rows.
- Do not commit `data/`, `.env`, or secrets.
- Do not invent a numeric target. The extract has `acceptedvalue` and `desireddirection`, not a target column.
- A zero baseline makes a percent change undefined. Drop it.
- Up and Down are the only aims that score. Other directions stay visible and unscored.
- A goal is on track only when every scored indicator's latest move matches its aim. Say the count either way ("4 of 9").
- Write the checked note as `knowledge/findings/outcomes.md`. Name the agency, the goal code, the indicator, both years, and the aim.

The app already loads `ops_indicators` into the agency zoom. This brief is for reading the flags, not for a second dashboard.
