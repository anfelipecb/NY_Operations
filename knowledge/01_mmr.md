# Knowledge card: Mayor's Management Report

**In one line:** the City Charter's performance report for city agencies, published twice a year, and the public source for this repo.

## What it is

- Required by Section 12 of the New York City Charter. The Mayor reports to the public and the City Council twice a year on how agencies deliver services.
- Published by the Mayor's Office of Operations since 1977.
- Two editions. The MMR, every September, covers the full fiscal year, July through June. The PMMR, early in the calendar year, covers July through October.
- The Fiscal 2026 MMR covers July 1, 2025 through June 30, 2026. It reports on 45 agencies and organizations and more than 2,000 indicators.

## What each agency chapter contains

- Services and goals. Numbered codes such as `1a` and `2b`, each with a sentence that says what the agency is trying to do.
- Performance indicators. Five fiscal years, a desired direction, and a mark on critical indicators.
- Agency resources. Expenditures, revenues, personnel, overtime paid, and capital commitments.
- Spending and budget. Spending by unit of appropriation, mapped to goal codes where the City mapped them.
- Noteworthy changes. Restatements of earlier numbers.

## Where this repo reads it

- Printable reports: [nyc.gov/mmr](https://www.nyc.gov/site/operations/reports/mmr.page)
- Fiscal 2026 book: [2026 MMR (PDF)](https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/2026_mmr.pdf)
- Agency chapters, used to attach a sentence to each goal code: `https://www.nyc.gov/assets/operations/downloads/pdf/mmr2026/{agency}.pdf`
- [Agency Resources](https://data.cityofnewyork.us/City-Government/Mayor-s-Management-Report-Agency-Resources/4qmi-txnk) `4qmi-txnk`
- [Performance Indicators](https://data.cityofnewyork.us/City-Government/Mayor-s-Management-Report-Agency-Performance-Indic/rbed-zzin) `rbed-zzin`
- [Spending and Budget](https://data.cityofnewyork.us/City-Government/Preliminary-Mayor-s-Management-Report-Spending-and/w4ne-9ea9) `w4ne-9ea9`

The window in this repo is FY2022–FY2026. Those years are on the open datasets. The indicator extract keeps citywide rows only (`geo` null or `No`) and drops retired rows.

## Traps

- Later editions restate earlier years. This pipeline keeps `current_fy_projected_actual` on the row for that `reporting_fiscal_year`, so a restatement in the FY2026 book does not overwrite the FY2025 row. Name the edition when you quote a figure.
- Overtime is in millions for some agencies (`Overtime paid ($000,000)`) and thousands for others (`Overtime paid ($000)`). Thousands are divided by 1,000 before any comparison.
- Join agencies on the agency code, not the name. Names differ across tables, and some spending names are misspelled in the source.
- `desireddirection` is part of the result. Up is good for some indicators and bad for others.
- Goal codes live on the spending table. Goal sentences live on the indicator table and in the chapter PDFs. The pipeline matches those sentences. It does not invent a code for a goal the chapter did not number.
- Many indicators are monthly. `acceptedvalue` on those rows is one month. The annual number in the MMR is `acceptedvalueytd` on the latest `valuedate` in the fiscal year. This pipeline uses that year-to-date, and uses `acceptedvalue` only when the year-to-date is blank.
- The extract has `desireddirection` and no numeric target column. Directional arrows in the PDF are not stored as targets.

## How it is used here

The budgets-and-goals pane treats the MMR as the shared public scoreboard: dollars tagged to a goal, and the indicators under that goal. Internal data can explain a flag. It is not required to see one.
