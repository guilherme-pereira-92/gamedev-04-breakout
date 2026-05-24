// Identidade visual derivada de guilherme-pereira.dev.
// Idêntico nos projetos 01 / 02 / 03 — quando mudar aqui, propagar nos outros.
// Princípios:
//   - laranja accent #ff4500 é EXTREMAMENTE restrito: dots pulsantes, numerais,
//     palavras de destaque, micro-glow. Nunca em fills grandes ou backgrounds.
//   - texto display em outline-stroke quando hero-scale (estilo do site).
//   - bordas crisp 1px, sem soft shadows. Glow só em micro-dots.

export const COLORS = {
  bg: "#0a0a0a",
  bgSoft: "#141414",
  fg: "#f5f1ea",
  accent: "#ff4500",
  accentGlow: "rgba(255, 69, 0, 0.35)",
  secondary: "#00d4ff",
  amber: "#fbbf24",
  success: "#7ad17a",
  danger: "#ef4444",
  muted: "#8a857c",
  border: "#1f1f1f",
} as const;

export const COLOR_HEX = {
  bg: 0x0a0a0a,
  bgSoft: 0x141414,
  fg: 0xf5f1ea,
  accent: 0xff4500,
  secondary: 0x00d4ff,
  amber: 0xfbbf24,
  success: 0x7ad17a,
  danger: 0xef4444,
  muted: 0x8a857c,
  border: 0x1f1f1f,
} as const;

export const FONTS = {
  display: '"Bricolage Grotesque", system-ui, sans-serif',
  mono: '"Geist Mono", "JetBrains Mono", monospace',
} as const;

export const FONT_NAMES = {
  display: "Bricolage Grotesque",
  mono: "Geist Mono",
} as const;

// Presets de estilo de texto que podem ser passados direto ao add.text(...)
// (são plain objects — sem dependência de Phaser no theme.ts).
export const TEXT_PRESETS = {
  // Hero outlined (estilo do site: fill = bg, stroke = fg)
  heroOutline: {
    fontFamily: FONTS.display,
    fontSize: "112px",
    color: COLORS.bg,
    stroke: COLORS.fg,
    strokeThickness: 2,
    fontStyle: "500",
  },
  // Hero filled (display grande, peso 500)
  hero: {
    fontFamily: FONTS.display,
    fontSize: "112px",
    color: COLORS.fg,
    fontStyle: "500",
  },
  // Título médio
  display: {
    fontFamily: FONTS.display,
    fontSize: "72px",
    color: COLORS.fg,
    fontStyle: "500",
  },
  // Labels mono small, uppercase tracked (use .setText em UPPER no caller)
  monoLabel: {
    fontFamily: FONTS.mono,
    fontSize: "12px",
    color: COLORS.muted,
  },
  monoLabelFg: {
    fontFamily: FONTS.mono,
    fontSize: "12px",
    color: COLORS.fg,
  },
  monoLabelAccent: {
    fontFamily: FONTS.mono,
    fontSize: "12px",
    color: COLORS.accent,
  },
  // Body texto secundário
  body: {
    fontFamily: FONTS.mono,
    fontSize: "15px",
    color: COLORS.muted,
  },
  bodyFg: {
    fontFamily: FONTS.mono,
    fontSize: "15px",
    color: COLORS.fg,
  },
  // Hint super-small, rodapé
  hint: {
    fontFamily: FONTS.mono,
    fontSize: "11px",
    color: COLORS.muted,
  },
} as const;
