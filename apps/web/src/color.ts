import * as d3 from "d3";
import { INK_LIGHT, PALETTES, type Mode } from "./palette";

export const RAMP_STOPS = [0, 0.28, 0.52, 0.76, 1];
const MODES: Mode[] = ["light", "dark"];

function relLum(hex: string): number {
  const color = d3.color(hex)?.rgb();
  if (!color) return 0;
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

function contrastRatio(fill: string, ink: string): number {
  const lighter = Math.max(relLum(fill), relLum(ink));
  const darker = Math.min(relLum(fill), relLum(ink));
  return (lighter + 0.05) / (darker + 0.05);
}

const ramps = Object.fromEntries(
  MODES.map((mode) => [
    mode,
    d3.scaleLinear<string>().domain(RAMP_STOPS).range(PALETTES[mode].ramp).interpolate(d3.interpolateLab),
  ]),
) as Record<Mode, d3.ScaleLinear<string, string>>;

export function rampColor(t: number, mode: Mode): string {
  return ramps[mode](Math.min(1, Math.max(0, t)));
}

export function rampGradient(mode: Mode): string {
  return `linear-gradient(90deg, ${RAMP_STOPS.map((stop) => `${rampColor(stop, mode)} ${stop * 100}%`).join(", ")})`;
}

export function inkFor(fill: string, mode: Mode): string {
  const dark = PALETTES[mode].inkDark;
  return contrastRatio(fill, dark) > contrastRatio(fill, INK_LIGHT) ? dark : INK_LIGHT;
}

export function toneVars(spend: number, min: number, max: number): string {
  const parts: string[] = [];
  for (const mode of MODES) {
    const t = min === max ? 1 : (Math.log10(spend) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
    const tone = rampColor(t, mode);
    const key = mode === "light" ? "l" : "d";
    parts.push(`--tone-${key}:${tone}`, `--ink-${key}:${inkFor(tone, mode)}`);
  }
  return parts.join(";");
}
