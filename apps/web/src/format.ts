export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char] ?? char;
  });
}

export function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function flag(value: unknown): boolean {
  return value === true || value === "true" || value === "t" || value === 1;
}

export function moneyMillions(value: number | null): string {
  if (value == null) return "—";
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const billions = abs / 1000;
    const digits = billions >= 10 ? 1 : 2;
    return `${sign}$${billions.toFixed(digits)} billion`;
  }
  if (abs >= 10) return `${sign}$${abs.toFixed(0)} million`;
  if (abs >= 1) return `${sign}$${abs.toFixed(1)} million`;
  return `${sign}$${Math.round(abs * 1000)} thousand`;
}

export function share(value: number | null): string {
  if (value == null) return "—";
  return `${Math.abs(value).toFixed(1)}%`;
}

export function pct(value: number | null, digits = 0): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

export function indicatorValue(value: number | null): string {
  if (value == null) return "—";
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function people(value: number | null): string {
  if (value == null) return "—";
  return Math.round(value).toLocaleString("en-US");
}

export function aim(direction: string | null): string {
  if (direction === "Up") return "Higher is the aim";
  if (direction === "Down") return "Lower is the aim";
  return "No aim published";
}

export function leverLabel(lever: string): string {
  const labels: Record<string, string> = {
    efficiency: "Efficiency",
    consolidation: "Consolidation",
    insourcing: "Insourcing",
    sunsetting: "Sunsetting",
  };
  return labels[lever] ?? lever;
}
