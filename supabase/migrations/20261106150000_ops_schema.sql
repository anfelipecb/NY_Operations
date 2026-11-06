-- Public aggregates for NY Operations. Does not alter ny_* tables.

CREATE TABLE IF NOT EXISTS ops_agencies (
  agency TEXT PRIMARY KEY,
  agency_name TEXT NOT NULL,
  search_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ops_resource_series (
  agency TEXT NOT NULL REFERENCES ops_agencies(agency),
  fiscal_year INTEGER NOT NULL,
  expenditures NUMERIC,
  overtime NUMERIC,
  personnel NUMERIC,
  ot_share_pct NUMERIC,
  PRIMARY KEY (agency, fiscal_year)
);

CREATE TABLE IF NOT EXISTS ops_goal_spend (
  agency TEXT NOT NULL REFERENCES ops_agencies(agency),
  fiscal_year INTEGER NOT NULL,
  goal TEXT NOT NULL,
  goal_label TEXT,
  ps NUMERIC,
  otps NUMERIC,
  prior_expenditures NUMERIC,
  financial_plan NUMERIC,
  mapped BOOLEAN NOT NULL,
  shared_units INTEGER NOT NULL DEFAULT 0,
  unit_count INTEGER NOT NULL DEFAULT 0,
  spend_change_pct NUMERIC,
  PRIMARY KEY (agency, fiscal_year, goal)
);

CREATE TABLE IF NOT EXISTS ops_goal_outcomes (
  agency TEXT NOT NULL REFERENCES ops_agencies(agency),
  goal TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  indicator_count INTEGER NOT NULL,
  improving_count INTEGER NOT NULL,
  share_with_direction NUMERIC,
  PRIMARY KEY (agency, goal, fiscal_year)
);

CREATE TABLE IF NOT EXISTS ops_indicators (
  agency TEXT NOT NULL REFERENCES ops_agencies(agency),
  goal TEXT NOT NULL,
  goal_code TEXT,
  indicator TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  value NUMERIC,
  desired_direction TEXT,
  critical BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (agency, goal, indicator, fiscal_year)
);

CREATE TABLE IF NOT EXISTS ops_anomalies (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agency TEXT NOT NULL REFERENCES ops_agencies(agency),
  fiscal_year INTEGER NOT NULL,
  kind TEXT NOT NULL,
  goal TEXT,
  goal_label TEXT,
  spend_change_pct NUMERIC,
  outcome_share_against NUMERIC,
  indicator_count INTEGER,
  question TEXT NOT NULL,
  lever TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ops_metric_proposals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agency TEXT NOT NULL REFERENCES ops_agencies(agency),
  goal TEXT NOT NULL,
  indicator TEXT NOT NULL,
  desired_direction TEXT,
  critical BOOLEAN NOT NULL DEFAULT FALSE,
  value_start NUMERIC,
  value_end NUMERIC,
  change_pct NUMERIC,
  lever TEXT NOT NULL,
  note TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ops_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ops_indicators_agency_idx ON ops_indicators (agency);
CREATE INDEX IF NOT EXISTS ops_goal_spend_agency_idx ON ops_goal_spend (agency, fiscal_year);
CREATE INDEX IF NOT EXISTS ops_anomalies_agency_idx ON ops_anomalies (agency);

ALTER TABLE ops_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_resource_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_goal_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_goal_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_metric_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read ops_agencies" ON ops_agencies;
DROP POLICY IF EXISTS "Public read ops_resource_series" ON ops_resource_series;
DROP POLICY IF EXISTS "Public read ops_goal_spend" ON ops_goal_spend;
DROP POLICY IF EXISTS "Public read ops_goal_outcomes" ON ops_goal_outcomes;
DROP POLICY IF EXISTS "Public read ops_indicators" ON ops_indicators;
DROP POLICY IF EXISTS "Public read ops_anomalies" ON ops_anomalies;
DROP POLICY IF EXISTS "Public read ops_metric_proposals" ON ops_metric_proposals;
DROP POLICY IF EXISTS "Public read ops_meta" ON ops_meta;

CREATE POLICY "Public read ops_agencies" ON ops_agencies FOR SELECT USING (true);
CREATE POLICY "Public read ops_resource_series" ON ops_resource_series FOR SELECT USING (true);
CREATE POLICY "Public read ops_goal_spend" ON ops_goal_spend FOR SELECT USING (true);
CREATE POLICY "Public read ops_goal_outcomes" ON ops_goal_outcomes FOR SELECT USING (true);
CREATE POLICY "Public read ops_indicators" ON ops_indicators FOR SELECT USING (true);
CREATE POLICY "Public read ops_anomalies" ON ops_anomalies FOR SELECT USING (true);
CREATE POLICY "Public read ops_metric_proposals" ON ops_metric_proposals FOR SELECT USING (true);
CREATE POLICY "Public read ops_meta" ON ops_meta FOR SELECT USING (true);

GRANT SELECT ON ops_agencies, ops_resource_series, ops_goal_spend, ops_goal_outcomes,
  ops_indicators, ops_anomalies, ops_metric_proposals, ops_meta
  TO anon, authenticated;
