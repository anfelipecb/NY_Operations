# NY Operations

A public-data reading of the Mayor's Management Report for people who have to act on it: agency budgets next to the goals they are tagged to, overtime next to expenditures, and the indicators a Chief Savings Officer can already track.

The window is fiscal 2022 through fiscal 2026. Fiscal 2026 leads. Every figure is from a public source. Raw downloads and the service-role key stay out of git.

This sits beside [NY Efficiency](https://github.com/anfelipecb/NY_Efficiency) and [NY Agencies](https://github.com/anfelipecb/NY_Agencies). It does not replace them. Tables on the shared Supabase project use the `ops_` prefix and do not alter the existing `ny_` tables.

## What the pane is for

Strategic Coordination and Operations supports mayoral priorities, Executive Order 12, and citywide operational reforms. The first pane asks a narrow question: when the money tagged to a goal moves sharply, did the public indicators for that goal move with it?

A flag is a question for an agency, not a savings estimate. Proposed metrics are indicators the City already publishes.

## Public data only

- Do not commit `data/`, `.env`, service-role keys, or private files.
- Do not invent a target the open dataset does not have.
- Cite the dataset id and the column when a number is written down.
- Local agent notes live in `AGENTS.md`, with `CLAUDE.md` symlinked to it. Both are gitignored.

## Sources

| Step | Question | Source |
|---|---|---|
| Resources | What did the agency spend, and what was overtime? | [MMR Agency Resources](https://data.cityofnewyork.us/City-Government/Mayor-s-Management-Report-Agency-Resources/4qmi-txnk) `4qmi-txnk` |
| Goals | Which units of appropriation did the City tag to which goal? | [PMMR Spending and Budget](https://data.cityofnewyork.us/City-Government/Preliminary-Mayor-s-Management-Report-Spending-and/w4ne-9ea9) `w4ne-9ea9` |
| Outcomes | Did the indicator move with its published aim? | [MMR Performance Indicators](https://data.cityofnewyork.us/City-Government/Mayor-s-Management-Report-Agency-Performance-Indic/rbed-zzin) `rbed-zzin` |
| Goal names | Which code (`1a`, `2b`) is which sentence? | Fiscal 2026 agency chapters on [nyc.gov/mmr](https://www.nyc.gov/site/operations/reports/mmr.page) |

Spending rows are `expenditures_previous_fy` and `financial_plan_current_fy`. They are not the adopted budget. Resource rows are `current_fy_projected_actual` for that reporting year, in millions of dollars where the label says `$000,000`. Overtime published in thousands is divided by 1,000.

## Layout

```
apps/web/             Vite + TypeScript + D3
pipeline/src/         download, analysis, Supabase export
supabase/migrations/  ops_ tables
knowledge/            public cards and briefs for other chats
data/                 gitignored
```

## Quickstart

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r pipeline/requirements.txt
python3 pipeline/src/01_download.py
python3 pipeline/src/02_budgets_goals.py
```

Export, after `ops_` migrations are applied and `SUPABASE_SERVICE_ROLE_KEY` is in `.env`:

```bash
python3 pipeline/src/03_export_supabase.py
```

Web:

```bash
cp apps/web/.env.example apps/web/.env
npm install
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `apps/web/.env`. Deploy from `apps/web` with `vercel --prod` on project `ny-operations`.

## Knowledge

Background cards and the briefs for parallel analysis chats are in [knowledge/README.md](knowledge/README.md).

## Author

Andrés Camacho · [github.com/anfelipecb](https://github.com/anfelipecb)
