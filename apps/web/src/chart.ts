import { esc, indicatorValue } from "./format";

type Point = { year: number; value: number | null };

export function seriesChart(points: Point[], label: string): string {
  const usable = points.filter((point): point is { year: number; value: number } => point.value != null);
  if (usable.length === 0) {
    return `<figure class="chart"><figcaption>${esc(label)}</figcaption><p class="chart-empty">No public figure in this window.</p></figure>`;
  }
  const width = 320;
  const height = 112;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 22;
  const min = Math.min(...usable.map((point) => point.value));
  const max = Math.max(...usable.map((point) => point.value));
  const span = max - min || Math.abs(max) || 1;
  const x = (index: number) =>
    padL + (points.length === 1 ? (width - padL - padR) / 2 : (index / (points.length - 1)) * (width - padL - padR));
  const y = (value: number) => padT + (1 - (value - min) / span) * (height - padT - padB);
  const coords = points
    .map((point, index) => (point.value == null ? null : `${x(index).toFixed(1)},${y(point.value).toFixed(1)}`))
    .filter((coord): coord is string => coord != null);
  const last = usable[usable.length - 1];
  const lastIndex = points.findIndex((point) => point.year === last.year && point.value === last.value);
  const dots = points
    .map((point, index) =>
      point.value == null
        ? ""
        : `<circle cx="${x(index).toFixed(1)}" cy="${y(point.value).toFixed(1)}" r="2.5" />`,
    )
    .join("");
  const years = points
    .map(
      (point, index) =>
        `<text x="${x(index).toFixed(1)}" y="${height - 4}" text-anchor="middle">${point.year}</text>`,
    )
    .join("");
  return `<figure class="chart">
    <figcaption>${esc(label)}</figcaption>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">
      <polyline points="${coords.join(" ")}" />
      ${dots}
      <text class="chart-end" x="${x(lastIndex).toFixed(1)}" y="${Math.max(12, y(last.value) - 8).toFixed(1)}" text-anchor="end">${esc(indicatorValue(last.value))}</text>
      ${years}
    </svg>
  </figure>`;
}

export function spark(values: Array<number | null>): string {
  const usable = values.filter((value): value is number => value != null);
  if (usable.length < 2) return "";
  const min = Math.min(...usable);
  const max = Math.max(...usable);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      if (value == null) return null;
      const x = (index / (values.length - 1)) * 72;
      const y = 18 - ((value - min) / span) * 16;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter((point): point is string => point != null);
  return `<svg class="spark" viewBox="0 0 72 22" aria-hidden="true"><polyline points="${points.join(" ")}" /></svg>`;
}
