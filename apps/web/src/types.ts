export type Agency = {
  agency: string;
  agency_name: string;
  search_text: string;
};

export type ResourceRow = {
  agency: string;
  fiscal_year: number;
  expenditures: number | null;
  overtime: number | null;
  personnel: number | null;
  ot_share_pct: number | null;
};

export type GoalSpend = {
  agency: string;
  fiscal_year: number;
  goal: string;
  goal_label: string | null;
  ps: number | null;
  otps: number | null;
  prior_expenditures: number | null;
  financial_plan: number | null;
  mapped: boolean;
  shared_units: number;
  unit_count: number;
  spend_change_pct: number | null;
};

export type GoalOutcome = {
  agency: string;
  goal: string;
  fiscal_year: number;
  indicator_count: number;
  improving_count: number;
  share_with_direction: number | null;
};

export type IndicatorRow = {
  agency: string;
  goal: string;
  goal_code: string | null;
  indicator: string;
  fiscal_year: number;
  value: number | null;
  desired_direction: string | null;
  critical: boolean;
};

export type Anomaly = {
  agency: string;
  fiscal_year: number;
  kind: string;
  goal: string | null;
  goal_label: string | null;
  spend_change_pct: number | null;
  outcome_share_against: number | null;
  indicator_count: number | null;
  question: string;
  lever: string;
};

export type Proposal = {
  agency: string;
  goal: string;
  indicator: string;
  desired_direction: string | null;
  critical: boolean;
  value_start: number | null;
  value_end: number | null;
  change_pct: number | null;
  lever: string;
  note: string;
};

export type Bundle = {
  agencies: Agency[];
  resources: ResourceRow[];
  goals: GoalSpend[];
  outcomes: GoalOutcome[];
  anomalies: Anomaly[];
  proposals: Proposal[];
  meta: Record<string, string>;
};
