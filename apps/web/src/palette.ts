export type Mode = "light" | "dark";

export const PALETTES: Record<Mode, { ramp: string[]; inkDark: string }> = {
  light: { ramp: ["#e6f25a", "#9be07c", "#3fb8c9", "#3a5be0", "#1d1a8f"], inkDark: "#0b0c18" },
  dark: { ramp: ["#2b3a9e", "#7a3fe0", "#e0469c", "#ff8547", "#ffd25e"], inkDark: "#14101f" },
};

export const INK_LIGHT = "#ffffff";
