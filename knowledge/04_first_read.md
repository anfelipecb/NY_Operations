# First read: FY2022–FY2026

Pulled November 6, 2026 from NYC Open Data and the Fiscal 2026 agency chapters. Figures below are `current_fy_projected_actual` on the reporting-year row in Agency Resources (`4qmi-txnk`), after overtime in thousands was divided by 1,000. They are the pipeline output in `pipeline/src/02_budgets_goals.py`, not a second estimate.

## Resources, FY2026

| Agency | Expenditures | Overtime | Overtime share | Personnel |
|---|---|---|---|---|
| NYPD | $6,909.1 million | $965.7 million | 14.0% | 48,344 |
| DSNY | $2,361.1 million | $322.7 million | 13.7% | 10,103 |
| DOC | $1,379.9 million | $369.1 million | 26.7% | 7,361 |

NYPD overtime is under $1 billion in FY2026. It was $1,135.6 million on the FY2025 reporting-year row. Across FY2022–FY2026 it still rose faster than expenditures, from $659.2 million to $965.7 million. DOC overtime rose from $227.7 million to $369.1 million. DSNY overtime fell to $158.3 million in FY2024 and then rose to $322.7 million in FY2026.

## What the flag rule kept

Indicator moves use `acceptedvalueytd` on the latest date in the fiscal year. NYPD major felony crime is 119,748 in FY2022 and 118,866 in FY2026, the annual columns in the chapter, not a single month.

Thirteen goals cleared the budget-and-outcome rule. Prior-year spending on the goal was at least $10 million, at least three scored indicators moved mostly against their aim, and the FY2026 financial plan moved at least 10 points. DEP 4a (8.8% from $89.8 million, 1 of 4 with its aim) and DPR 1b (8.2% from $516.5 million, 0 of 3) are the two that cleared on the agency's own spread instead of the 10-point floor.

- DCLA 1a, grant payments, plan up 17% from $248.5 million. 1 of 3 with their aim.
- DCWP 1b and 2a, plan up 20% from $16.4 million. The two lines share units, so do not add them. 5 of 12 and 2 of 6 with their aim.
- DEP 1a, drinking water quality, plan up 13% from $1,289.6 million. 1 of 5 with their aim.
- DOT 1a, bridges and tunnels, plan up 11% from $112.4 million. 1 of 3 with their aim.
- DYCD 4a, community anti-poverty, plan up 21% from $294.2 million. 2 of 5 with their aim.
- DYCD 2b, runaway and homeless youth, plan up 19% from $53.4 million. 5 of 11 with their aim.
- HPD 1a, maintenance complaints, plan down 20% from $217.9 million. 0 of 10 with their aim.
- NYPD 1c, emergency response, plan up 84% from $1,134.8 million. 2 of 8 with their aim.
- NYPD 2a, traffic collisions, plan up 386% from $254.3 million. 2 of 7 with their aim. Units tagged to more than one goal are counted in full on each line.
- NYPD 3a, quality-of-life violations, plan up 113% from $836.0 million. 2 of 5 with their aim.

Eleven agencies had overtime that rose, and rose at least 5 points faster than expenditures, with FY2026 overtime of at least $1 million: DOC, DOE, DOHMH, DOP, DPR, DSNY, FDNY, LAW, NYPD, OCME, OTI. DOE, DOHMH, DOP, DPR, DSNY, and LAW are latest-year moves. OTI overtime went from under $1 million to $2.7 million. NYPD's five-year rise is real, and FY2026 itself was a decline.

## Join

Goal codes were read from 41 Fiscal 2026 chapters and matched to indicator sentences. 262 codes matched. A goal with no matched sentence can still show its dollars. It cannot be flagged, because the outcome test has nothing to score.

The spending columns are `expenditures_previous_fy` and `financial_plan_current_fy` in `w4ne-9ea9`. They are not the adopted budget.
