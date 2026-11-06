import { flag, num } from "./format";
import { missingEnv, supabase } from "./supabase";
import type {
  Agency,
  Anomaly,
  Bundle,
  GoalOutcome,
  GoalSpend,
  IndicatorRow,
  Proposal,
  ResourceRow,
} from "./types";

const PAGE = 1000;

async function pages<T>(table: string, columns: string): Promise<T[]> {
  if (!supabase) throw new Error(missingEnv() ?? "Supabase is not configured.");
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

export async function loadBundle(): Promise<Bundle> {
  const [agencies, resources, goals, outcomes, anomalies, proposals, metaRows] = await Promise.all([
    pages<Record<string, unknown>>("ops_agencies", "agency,agency_name,search_text"),
    pages<Record<string, unknown>>("ops_resource_series", "agency,fiscal_year,expenditures,overtime,personnel,ot_share_pct"),
    pages<Record<string, unknown>>(
      "ops_goal_spend",
      "agency,fiscal_year,goal,goal_label,ps,otps,prior_expenditures,financial_plan,mapped,shared_units,unit_count,spend_change_pct",
    ),
    pages<Record<string, unknown>>(
      "ops_goal_outcomes",
      "agency,goal,fiscal_year,indicator_count,improving_count,share_with_direction",
    ),
    pages<Record<string, unknown>>(
      "ops_anomalies",
      "agency,fiscal_year,kind,goal,goal_label,spend_change_pct,outcome_share_against,indicator_count,question,lever",
    ),
    pages<Record<string, unknown>>(
      "ops_metric_proposals",
      "agency,goal,indicator,desired_direction,critical,value_start,value_end,change_pct,lever,note",
    ),
    pages<Record<string, unknown>>("ops_meta", "key,value"),
  ]);

  const meta: Record<string, string> = {};
  for (const row of metaRows) meta[String(row.key)] = String(row.value ?? "");

  return {
    agencies: agencies.map(
      (row): Agency => ({
        agency: String(row.agency),
        agency_name: String(row.agency_name),
        search_text: String(row.search_text ?? "").toLowerCase(),
      }),
    ),
    resources: resources.map(
      (row): ResourceRow => ({
        agency: String(row.agency),
        fiscal_year: num(row.fiscal_year) ?? 0,
        expenditures: num(row.expenditures),
        overtime: num(row.overtime),
        personnel: num(row.personnel),
        ot_share_pct: num(row.ot_share_pct),
      }),
    ),
    goals: goals.map(
      (row): GoalSpend => ({
        agency: String(row.agency),
        fiscal_year: num(row.fiscal_year) ?? 0,
        goal: String(row.goal),
        goal_label: row.goal_label == null ? null : String(row.goal_label),
        ps: num(row.ps),
        otps: num(row.otps),
        prior_expenditures: num(row.prior_expenditures),
        financial_plan: num(row.financial_plan),
        mapped: flag(row.mapped),
        shared_units: num(row.shared_units) ?? 0,
        unit_count: num(row.unit_count) ?? 0,
        spend_change_pct: num(row.spend_change_pct),
      }),
    ),
    outcomes: outcomes.map(
      (row): GoalOutcome => ({
        agency: String(row.agency),
        goal: String(row.goal),
        fiscal_year: num(row.fiscal_year) ?? 0,
        indicator_count: num(row.indicator_count) ?? 0,
        improving_count: num(row.improving_count) ?? 0,
        share_with_direction: num(row.share_with_direction),
      }),
    ),
    anomalies: anomalies.map(
      (row): Anomaly => ({
        agency: String(row.agency),
        fiscal_year: num(row.fiscal_year) ?? 0,
        kind: String(row.kind),
        goal: row.goal == null ? null : String(row.goal),
        goal_label: row.goal_label == null ? null : String(row.goal_label),
        spend_change_pct: num(row.spend_change_pct),
        outcome_share_against: num(row.outcome_share_against),
        indicator_count: num(row.indicator_count),
        question: String(row.question),
        lever: String(row.lever),
      }),
    ),
    proposals: proposals.map(
      (row): Proposal => ({
        agency: String(row.agency),
        goal: String(row.goal),
        indicator: String(row.indicator),
        desired_direction: row.desired_direction == null ? null : String(row.desired_direction),
        critical: flag(row.critical),
        value_start: num(row.value_start),
        value_end: num(row.value_end),
        change_pct: num(row.change_pct),
        lever: String(row.lever),
        note: String(row.note),
      }),
    ),
    meta,
  };
}

export async function loadIndicators(agency: string): Promise<IndicatorRow[]> {
  if (!supabase) throw new Error(missingEnv() ?? "Supabase is not configured.");
  const rows: IndicatorRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("ops_indicators")
      .select("agency,goal,goal_code,indicator,fiscal_year,value,desired_direction,critical")
      .eq("agency", agency)
      .order("goal")
      .order("indicator")
      .order("fiscal_year")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const row of batch) {
      rows.push({
        agency: String(row.agency),
        goal: String(row.goal),
        goal_code: row.goal_code == null ? null : String(row.goal_code),
        indicator: String(row.indicator),
        fiscal_year: num(row.fiscal_year) ?? 0,
        value: num(row.value),
        desired_direction: row.desired_direction == null ? null : String(row.desired_direction),
        critical: flag(row.critical),
      });
    }
    if (batch.length < PAGE) break;
  }
  return rows;
}
