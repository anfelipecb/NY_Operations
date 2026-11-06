import { rampGradient, toneVars } from "./color";
import { seriesChart, spark } from "./chart";
import { loadBundle, loadIndicators } from "./data";
import { aim, esc, indicatorValue, leverLabel, moneyMillions, pct, people, share } from "./format";
import { missingEnv } from "./supabase";
import type { Anomaly, Bundle, GoalOutcome, IndicatorRow, Proposal, ResourceRow } from "./types";

const YEARS = [2022, 2023, 2024, 2025, 2026];

type State = {
  bundle: Bundle | null;
  selected: string | null;
  query: string;
  highlight: number;
  suggestOpen: boolean;
  indicators: IndicatorRow[] | null;
  indicatorAgency: string | null;
  indicatorError: string | null;
  loadingIndicators: boolean;
};

const state: State = {
  bundle: null,
  selected: null,
  query: "",
  highlight: 0,
  suggestOpen: false,
  indicators: null,
  indicatorAgency: null,
  indicatorError: null,
  loadingIndicators: false,
};

export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
    <div class="backdrop" aria-hidden="true"></div>
    <div class="stage">
      <header class="mast" id="mast"></header>
      <div class="work" id="work">
        <section class="reading" aria-label="Flags">
          <div id="anomalies"></div>
        </section>
        <aside id="zoom" class="zoom" aria-label="Agency"></aside>
        <details id="method" class="method"></details>
        <footer class="colophon" id="colophon"></footer>
      </div>
    </div>
  `;
  const envError = missingEnv();
  if (envError) {
    showStatus(envError);
    return;
  }
  showStatus("Loading the public tables.");
  loadBundle()
    .then((bundle) => {
      state.bundle = bundle;
      renderMast();
      renderAnomalies();
      renderZoom();
      renderMethod();
      renderColophon();
      const fromHash = decodeURIComponent(location.hash.replace(/^#/, ""));
      if (fromHash && bundle.agencies.some((agency) => agency.agency === fromHash)) {
        void selectAgency(fromHash);
      }
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "The tables did not load.";
      showStatus(message);
    });

  window.addEventListener("hashchange", () => {
    const code = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!state.bundle) return;
    if (!code) {
      state.selected = null;
      renderAnomalies();
      renderZoom();
      renderBand();
      return;
    }
    if (state.bundle.agencies.some((agency) => agency.agency === code) && code !== state.selected) {
      void selectAgency(code);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.selected) {
      event.preventDefault();
      clearSelection();
    }
  });
}

function showStatus(message: string): void {
  const mast = document.querySelector("#mast");
  if (!mast) return;
  mast.innerHTML = `<div class="mast-copy"><h1>Budgets and goals</h1><p>${esc(message)}</p></div>`;
}

function agencyName(code: string): string {
  return state.bundle?.agencies.find((agency) => agency.agency === code)?.agency_name ?? code;
}

function resourcesFor(code: string): ResourceRow[] {
  return (state.bundle?.resources ?? [])
    .filter((row) => row.agency === code)
    .sort((a, b) => a.fiscal_year - b.fiscal_year);
}

function spend2026(code: string): number | null {
  return resourcesFor(code).find((row) => row.fiscal_year === 2026)?.expenditures ?? null;
}

function bandAgencies(): Array<{ agency: string; spend: number }> {
  const rows = state.bundle?.agencies ?? [];
  return rows
    .map((agency) => ({ agency: agency.agency, spend: spend2026(agency.agency) }))
    .filter((row): row is { agency: string; spend: number } => row.spend != null && row.spend > 0)
    .sort((a, b) => b.spend - a.spend);
}

function flaggedAgencies(): Set<string> {
  return new Set((state.bundle?.anomalies ?? []).map((row) => row.agency));
}

function matches(): Array<{ agency: string; agency_name: string }> {
  const query = state.query.trim().toLowerCase();
  if (!query || !state.bundle) return [];
  const tokens = query.split(/\s+/);
  return state.bundle.agencies
    .filter((agency) => tokens.every((token) => agency.search_text.includes(token) || agency.agency.toLowerCase().includes(token)))
    .sort((a, b) => rank(a.agency, a.agency_name, query) - rank(b.agency, b.agency_name, query))
    .slice(0, 8);
}

function rank(code: string, name: string, query: string): number {
  const acronym = code.toLowerCase();
  const full = name.toLowerCase();
  if (acronym === query) return 0;
  if (acronym.startsWith(query)) return 1;
  if (full.startsWith(query)) return 2;
  return 3;
}

function renderMast(): void {
  const bundle = state.bundle;
  if (!bundle) return;
  const exp2026 = sumYear(2026, "expenditures");
  const ot2026 = sumYear(2026, "overtime");
  const flags = bundle.anomalies.length;
  const agencies = bandAgencies();
  const mast = document.querySelector("#mast");
  if (!mast) return;
  mast.innerHTML = `
    <div class="mode" role="group" aria-label="Theme">
      <button type="button" data-theme-set="light" aria-pressed="${document.documentElement.dataset.theme === "dark" ? "false" : "true"}">Light</button>
      <button type="button" data-theme-set="dark" aria-pressed="${document.documentElement.dataset.theme === "dark" ? "true" : "false"}">Dark</button>
    </div>
    <div class="mast-copy">
      <h1>Budgets and goals</h1>
      <p>Fiscal 2022 to 2026 from the Mayor's Management Report. Fiscal 2026 is the year in front. ${flags} flags, each one a question for an agency.</p>
    </div>
    <div class="total">
      <p class="total-value">${esc(moneyMillions(exp2026))}</p>
      <p class="total-label">spent in FY2026, with ${esc(moneyMillions(ot2026))} in overtime</p>
    </div>
    <div class="strip" id="strip" role="list"></div>
    <div class="ramp">
      <span>${esc(moneyMillions(agencies.length ? agencies[agencies.length - 1].spend : null))}</span>
      <i class="ramp-bar" style="--ramp-l:${rampGradient("light")};--ramp-d:${rampGradient("dark")}"></i>
      <span>${esc(moneyMillions(agencies.length ? agencies[0].spend : null))}</span>
      <p>Width is FY2026 expenditures. Color runs from smaller to larger. A corner mark is a flag.</p>
    </div>
    <form class="finder" id="finder" role="search" autocomplete="off">
      <label for="agency-query">Agency</label>
      <input id="agency-query" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="suggest" placeholder="Name or acronym" />
      <ul id="suggest" role="listbox" hidden></ul>
    </form>
  `;
  renderBand();
  wireMast();
}

function sumYear(year: number, field: "expenditures" | "overtime"): number | null {
  const values = (state.bundle?.resources ?? [])
    .filter((row) => row.fiscal_year === year)
    .map((row) => row[field])
    .filter((value): value is number => value != null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function renderBand(): void {
  const strip = document.querySelector("#strip");
  if (!strip) return;
  const agencies = bandAgencies();
  const spends = agencies.map((row) => row.spend);
  const min = Math.min(...spends);
  const max = Math.max(...spends);
  const total = spends.reduce((sum, value) => sum + value, 0);
  const flags = flaggedAgencies();
  strip.innerHTML = agencies
    .map((row, index) => {
      const share = total > 0 ? row.spend / total : 0;
      const label = share >= 0.03 ? esc(row.agency) : "";
      const selected = row.agency === state.selected ? " is-selected" : "";
      const flagged = flags.has(row.agency) ? " is-flagged" : "";
      return `<button type="button" class="seg${selected}${flagged}" role="listitem" data-agency="${esc(row.agency)}" style="flex-grow:${row.spend};--i:${index};${toneVars(row.spend, min, max)}" aria-pressed="${row.agency === state.selected}" aria-label="${esc(row.agency)}, ${esc(moneyMillions(row.spend))}${flags.has(row.agency) ? ", flagged" : ""}"><span>${label}</span></button>`;
    })
    .join("");
  strip.querySelectorAll<HTMLButtonElement>(".seg").forEach((button) => {
    button.addEventListener("click", () => {
      const code = button.dataset.agency;
      if (code) void selectAgency(code);
    });
  });
}

function wireMast(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-theme-set]").forEach((button) => {
    button.addEventListener("click", () => {
      const theme = button.dataset.themeSet === "dark" ? "dark" : "light";
      if (theme === "dark") document.documentElement.dataset.theme = "dark";
      else delete document.documentElement.dataset.theme;
      try {
        localStorage.setItem("theme", theme);
      } catch {
        /* ignore */
      }
      document.querySelectorAll<HTMLButtonElement>("[data-theme-set]").forEach((other) => {
        other.setAttribute("aria-pressed", String(other === button));
      });
    });
  });

  const input = document.querySelector<HTMLInputElement>("#agency-query");
  const form = document.querySelector("#finder");
  input?.addEventListener("input", () => {
    state.query = input.value;
    state.highlight = 0;
    state.suggestOpen = input.value.trim().length > 0;
    renderSuggest();
    renderAnomalies();
  });
  input?.addEventListener("keydown", (event) => {
    const list = matches();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      state.suggestOpen = true;
      state.highlight = Math.min(state.highlight + 1, Math.max(list.length - 1, 0));
      renderSuggest();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      state.highlight = Math.max(state.highlight - 1, 0);
      renderSuggest();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const pick = list[state.highlight] ?? list[0];
      if (pick) void selectAgency(pick.agency);
    } else if (event.key === "Escape") {
      state.suggestOpen = false;
      renderSuggest();
    }
  });
  form?.addEventListener("submit", (event) => event.preventDefault());
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node) || form?.contains(event.target)) return;
    state.suggestOpen = false;
    renderSuggest();
  });
}

function renderSuggest(): void {
  const list = document.querySelector<HTMLElement>("#suggest");
  const input = document.querySelector<HTMLInputElement>("#agency-query");
  if (!list || !input) return;
  const items = state.suggestOpen ? matches() : [];
  input.setAttribute("aria-expanded", String(items.length > 0));
  if (!items.length) {
    list.hidden = true;
    list.innerHTML = "";
    return;
  }
  list.hidden = false;
  list.innerHTML = items
    .map((item, index) => {
      const active = index === state.highlight ? "true" : "false";
      return `<li role="option" id="opt-${index}" aria-selected="${active}"><button type="button" data-pick="${esc(item.agency)}" class="${index === state.highlight ? "is-active" : ""}"><strong>${esc(item.agency)}</strong> ${esc(item.agency_name)}</button></li>`;
    })
    .join("");
  if (items[state.highlight]) input.setAttribute("aria-activedescendant", `opt-${state.highlight}`);
  list.querySelectorAll<HTMLButtonElement>("[data-pick]").forEach((button) => {
    button.addEventListener("click", () => {
      const code = button.dataset.pick;
      if (code) void selectAgency(code);
    });
  });
}

function visibleAnomalies(): Anomaly[] {
  const rows = state.bundle?.anomalies ?? [];
  const query = state.query.trim().toLowerCase();
  const filtered = !query
    ? rows
    : rows.filter((row) => {
        const name = agencyName(row.agency).toLowerCase();
        return row.agency.toLowerCase().includes(query) || name.includes(query);
      });
  return [...filtered].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "overtime_outpacing" ? -1 : 1;
    return Math.abs(b.spend_change_pct ?? 0) - Math.abs(a.spend_change_pct ?? 0);
  });
}

function renderAnomalies(): void {
  const host = document.querySelector("#anomalies");
  if (!host || !state.bundle) return;
  const rows = visibleAnomalies();
  if (!rows.length) {
    host.innerHTML = `<p class="empty">${state.query.trim() ? "No flag for that search. Open the agency anyway. The five-year record is still there." : "No agency cleared the flag rule in this run."}</p>`;
    return;
  }
  host.innerHTML = `<ol class="flags">${rows
    .map((row) => {
      const selected = row.agency === state.selected ? " is-selected" : "";
      const kind = row.kind === "overtime_outpacing" ? "Overtime" : `Goal ${row.goal ?? ""}`;
      const move =
        row.kind === "overtime_outpacing"
          ? `Gap ${pct(row.spend_change_pct)}`
          : `Plan ${pct(row.spend_change_pct)}`;
      return `<li><button type="button" class="flag${selected}" data-agency="${esc(row.agency)}">
        <span class="flag-kicker"><span>${esc(row.agency)}</span><span>${esc(kind)}</span></span>
        <span class="flag-move">${esc(move)}</span>
        <span class="flag-q">${esc(row.question)}</span>
        <span class="flag-lever">${esc(leverLabel(row.lever))}</span>
      </button></li>`;
    })
    .join("")}</ol>`;
  host.querySelectorAll<HTMLButtonElement>(".flag").forEach((button) => {
    button.addEventListener("click", () => {
      const code = button.dataset.agency;
      if (code) void selectAgency(code);
    });
  });
}

async function selectAgency(code: string): Promise<void> {
  state.selected = code;
  state.suggestOpen = false;
  state.query = code;
  const input = document.querySelector<HTMLInputElement>("#agency-query");
  if (input) input.value = code;
  if (location.hash !== `#${encodeURIComponent(code)}`) {
    history.replaceState(null, "", `#${encodeURIComponent(code)}`);
  }
  renderSuggest();
  renderBand();
  renderAnomalies();
  state.loadingIndicators = true;
  state.indicatorError = null;
  state.indicators = state.indicatorAgency === code ? state.indicators : null;
  renderZoom();
  document.querySelector(".work")?.classList.add("has-zoom");
  if (state.indicatorAgency === code && state.indicators) {
    state.loadingIndicators = false;
    renderZoom();
    return;
  }
  try {
    const rows = await loadIndicators(code);
    if (state.selected !== code) return;
    state.indicators = rows;
    state.indicatorAgency = code;
    state.loadingIndicators = false;
    renderZoom();
  } catch (error: unknown) {
    if (state.selected !== code) return;
    state.loadingIndicators = false;
    state.indicatorError = error instanceof Error ? error.message : "Indicators did not load.";
    renderZoom();
  }
}

function clearSelection(): void {
  state.selected = null;
  state.query = "";
  const input = document.querySelector<HTMLInputElement>("#agency-query");
  if (input) input.value = "";
  history.replaceState(null, "", location.pathname);
  document.querySelector(".work")?.classList.remove("has-zoom");
  renderSuggest();
  renderBand();
  renderAnomalies();
  renderZoom();
}

function renderZoom(): void {
  const zoom = document.querySelector("#zoom");
  if (!zoom || !state.bundle) return;
  const code = state.selected;
  zoom.classList.toggle("is-open", Boolean(code));
  if (!code) {
    zoom.innerHTML = `<p class="zoom-prompt">Type an agency, or choose one from the band, to open five years of spending, overtime, and indicators.</p>`;
    return;
  }
  const series = resourcesFor(code);
  const byYear = new Map(series.map((row) => [row.fiscal_year, row]));
  const latest = byYear.get(2026);
  const early = byYear.get(2022);
  const goals = state.bundle.goals
    .filter((row) => row.agency === code && row.fiscal_year === 2026)
    .sort((a, b) => Number(b.mapped) - Number(a.mapped) || Math.abs(b.spend_change_pct ?? 0) - Math.abs(a.spend_change_pct ?? 0));
  const outcomes = state.bundle.outcomes.filter((row) => row.agency === code && row.fiscal_year === 2026);
  const proposals = state.bundle.proposals.filter((row) => row.agency === code);
  const shared = goals.some((row) => row.shared_units > 0);
  zoom.innerHTML = `
    <div class="zoom-head">
      <p class="chip">${esc(code)}</p>
      <button type="button" class="close" id="close-zoom" aria-label="Close">Close</button>
    </div>
    <h2>${esc(agencyName(code))}</h2>
    <p class="zoom-figure">${esc(moneyMillions(latest?.expenditures ?? null))}</p>
    <p class="zoom-sub">FY2026 expenditures. Overtime ${esc(moneyMillions(latest?.overtime ?? null))}${latest?.ot_share_pct != null ? `, ${esc(share(latest.ot_share_pct))} of expenditures` : ""}.</p>
    <div class="charts">
      ${seriesChart(YEARS.map((year) => ({ year, value: byYear.get(year)?.expenditures ?? null })), "Expenditures, millions")}
      ${seriesChart(YEARS.map((year) => ({ year, value: byYear.get(year)?.overtime ?? null })), "Overtime, millions")}
    </div>
    <p class="fact">Personnel ${esc(people(early?.personnel ?? null))} in FY2022 and ${esc(people(latest?.personnel ?? null))} in FY2026. These are actuals from Agency Resources. The goal lines below are the financial plan against prior-year spending, not the adopted budget.</p>
    <h3>Goals in the FY2026 plan</h3>
    ${shared ? `<p class="fact">Some units are tagged to more than one goal. Those dollars sit in each goal they name, so the lines do not add up to the agency total.</p>` : ""}
    <div class="goal-table">${goals.map((row) => goalLine(row, outcomes)).join("") || `<p class="empty">No spending rows for FY2026.</p>`}</div>
    <h3>Metrics to take to the agency</h3>
    ${proposals.length ? `<ul class="proposals">${proposals.map(proposalLine).join("")}</ul>` : `<p class="empty">No proposed metric. This agency did not clear a flag.</p>`}
    <h3>Outcomes</h3>
    <p class="fact">A goal is on track only when every scored indicator moved with its published aim from FY2025 to FY2026. There is no numeric target in the open extract.</p>
    ${state.loadingIndicators ? `<p class="empty">Loading indicators.</p>` : ""}
    ${state.indicatorError ? `<p class="empty">${esc(state.indicatorError)}</p>` : ""}
    ${state.indicators && state.indicatorAgency === code ? outcomeGroups(code, state.indicators, outcomes) : ""}
  `;
  document.querySelector("#close-zoom")?.addEventListener("click", clearSelection);
}

function goalLine(row: Bundle["goals"][number], outcomes: GoalOutcome[]): string {
  const outcome = outcomes.find((item) => item.goal === row.goal);
  const label = row.goal_label ? `${row.goal} ${row.goal_label}` : row.goal;
  const score = outcome
    ? `${outcome.improving_count} of ${outcome.indicator_count} with their aim`
    : row.mapped
      ? "No scored indicators"
      : "Not a numbered goal";
  return `<div class="goal-line">
    <p class="goal-name">${esc(label)}</p>
    <p class="goal-nums">Plan ${esc(moneyMillions(row.financial_plan))} <span>Prior year ${esc(moneyMillions(row.prior_expenditures))}</span> <span>${esc(pct(row.spend_change_pct))}</span></p>
    <p class="goal-score">${esc(score)}</p>
  </div>`;
}

function proposalLine(row: Proposal): string {
  const critical = row.critical ? " Critical in the MMR." : "";
  return `<li>
    <p class="proposal-name">${esc(row.indicator)}</p>
    <p class="proposal-meta">${esc(aim(row.desired_direction))} ${esc(leverLabel(row.lever))}.${critical} FY2022 ${esc(indicatorValue(row.value_start))} to FY2026 ${esc(indicatorValue(row.value_end))}${row.goal === "Overtime" ? `, change ${esc(pct(row.change_pct, 1))}` : ""}.</p>
    <p>${esc(row.note)}</p>
  </li>`;
}

function outcomeGroups(code: string, rows: IndicatorRow[], outcomes: GoalOutcome[]): string {
  const groups = new Map<string, { title: string; code: string | null; rows: IndicatorRow[] }>();
  for (const row of rows) {
    const key = row.goal_code ?? row.goal;
    const current = groups.get(key) ?? { title: row.goal, code: row.goal_code, rows: [] };
    current.rows.push(row);
    groups.set(key, current);
  }
  const flagged = new Set(
    (state.bundle?.anomalies ?? [])
      .filter((row) => row.agency === code && row.kind === "goal_spend_outcomes" && row.goal)
      .map((row) => row.goal as string),
  );
  const ordered = [...groups.entries()].sort((a, b) => {
    const aFlag = flagged.has(a[0]) ? 0 : 1;
    const bFlag = flagged.has(b[0]) ? 0 : 1;
    if (aFlag !== bFlag) return aFlag - bFlag;
    return a[0].localeCompare(b[0]);
  });
  if (!ordered.length) return `<p class="empty">No citywide indicators in the extract.</p>`;
  return ordered
    .map(([key, group]) => {
      const byIndicator = new Map<string, IndicatorRow[]>();
      for (const row of group.rows) {
        const list = byIndicator.get(row.indicator) ?? [];
        list.push(row);
        byIndicator.set(row.indicator, list);
      }
      const outcome = outcomes.find((item) => item.goal === (group.code ?? key));
      const onTrack =
        outcome != null && outcome.indicator_count > 0 && outcome.improving_count === outcome.indicator_count;
      const status = outcome
        ? onTrack
          ? "On track"
          : `${outcome.improving_count} of ${outcome.indicator_count} with their aim`
        : "No scored move from FY2025 to FY2026";
      const open = flagged.has(key) ? " open" : "";
      const items = [...byIndicator.entries()]
        .sort((a, b) => Number(b[1].some((row) => row.critical)) - Number(a[1].some((row) => row.critical)))
        .map(([name, series]) => indicatorLine(name, series))
        .join("");
      const heading = group.code ? `${group.code} ${group.title}` : group.title;
      return `<details class="outcome"${open}>
        <summary><span>${esc(heading)}</span><span class="goal-status">${esc(status)}</span></summary>
        <ul>${items}</ul>
      </details>`;
    })
    .join("");
}

function indicatorLine(name: string, series: IndicatorRow[]): string {
  const byYear = new Map(series.map((row) => [row.fiscal_year, row]));
  const sample = series[0];
  const previous = byYear.get(2025)?.value ?? null;
  const current = byYear.get(2026)?.value ?? null;
  let verdict = "Not scored";
  if (previous != null && current != null && previous !== 0 && (sample.desired_direction === "Up" || sample.desired_direction === "Down")) {
    const up = current > previous;
    const withAim = sample.desired_direction === "Up" ? up : !up && current !== previous;
    verdict = current === previous ? "Unchanged" : withAim ? "With the aim" : "Against the aim";
  }
  const values = YEARS.map((year) => byYear.get(year)?.value ?? null);
  const cells = values.map((value) => `<span>${esc(indicatorValue(value))}</span>`).join("");
  const star = sample.critical ? `<span class="star" aria-label="Critical indicator">★</span> ` : "";
  return `<li>
    <p>${star}${esc(name)}</p>
    <p class="ind-meta">${esc(aim(sample.desired_direction))} ${esc(verdict)}</p>
    <div class="ind-values">${cells}${spark(values)}</div>
  </li>`;
}

function renderMethod(): void {
  const host = document.querySelector("#method");
  const meta = state.bundle?.meta ?? {};
  if (!host) return;
  host.innerHTML = `
    <summary>About the data</summary>
    <div class="method-body">
      <section>
        <h3>Source</h3>
        <p>Mayor's Management Report, fiscal 2022 through 2026. Agency Resources <a href="https://data.cityofnewyork.us/City-Government/Mayor-s-Management-Report-Agency-Resources/4qmi-txnk">4qmi-txnk</a>. Performance indicators <a href="https://data.cityofnewyork.us/City-Government/Mayor-s-Management-Report-Agency-Performance-Indic/rbed-zzin">rbed-zzin</a>, citywide rows only, retired rows dropped. Spending and budget <a href="https://data.cityofnewyork.us/City-Government/Preliminary-Mayor-s-Management-Report-Spending-and/w4ne-9ea9">w4ne-9ea9</a>. Goal sentences come from the Fiscal 2026 agency chapters on nyc.gov.</p>
      </section>
      <section>
        <h3>Spending</h3>
        <p>The band and the two charts use <code>current_fy_projected_actual</code> on Expenditures ($000,000) and Overtime paid. Overtime published in thousands is divided by 1,000. Each reporting year keeps the value from that edition, so a later restatement does not replace it. Goal lines use <code>expenditures_previous_fy</code> and <code>financial_plan_current_fy</code> on units of appropriation. That is not the adopted budget. Units tagged NA or * stay Unmapped. Units tagged All stay on their own line. A unit tagged to several goals is counted in each of those goals.</p>
      </section>
      <section>
        <h3>Outcomes</h3>
        <p>An indicator scores when <code>desireddirection</code> is Up or Down and both FY2025 and FY2026 have a value, and the earlier value is not zero. The value is <code>acceptedvalueytd</code> on the latest date in the fiscal year, which is the annual figure the MMR prints. A month's <code>acceptedvalue</code> is used only when that year-to-date is blank. A goal is on track only when every scored indicator moved with its aim. The extract has no numeric target column, so none is shown. ${esc(meta.indicator_rows ?? "")} indicator rows are in the table.</p>
      </section>
      <section>
        <h3>Anomalies</h3>
        <p>${esc(meta.rule_spend ?? "A goal is flagged when the FY2026 plan moves sharply versus the agency's other goals and most scored indicators move against their aim.")} ${esc(meta.rule_overtime ?? "Overtime is flagged when it rises faster than expenditures.")} ${esc(meta.anomaly_count ?? "")} flags are in this run. A lever is a resemblance to Executive Order 12, not a savings estimate.</p>
      </section>
      <section>
        <h3>Color and size</h3>
        <p>Segment width is linear in FY2026 expenditures. Color is a log scale, interpolated in Lab, the same stops as NY Agencies. Text on a segment is white or ink by contrast. The corner mark is a flag, not a second scale.</p>
      </section>
      <section>
        <h3>Checks and limits</h3>
        <p>Goal codes are joined to indicator sentences by matching the Fiscal 2026 chapter text. ${esc(meta.crosswalk_agencies ?? "")} agencies matched, ${esc(meta.crosswalk_rows ?? "")} goal lines. Where the chapter and the indicator sentence do not meet, the goal still shows its dollars and is not flagged. Public rows can be revised. This pane does not see internal budgets.</p>
      </section>
    </div>
  `;
}

function renderColophon(): void {
  const host = document.querySelector("#colophon");
  if (!host) return;
  host.innerHTML = `<p>Fiscal 2022 to 2026. Made with public data.</p><p><a href="https://github.com/anfelipecb/NY_Operations">NY Operations</a> <a href="https://github.com/anfelipecb">anfelipecb</a></p>`;
}
