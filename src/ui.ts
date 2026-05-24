import Phaser from "phaser";
import { COLOR_HEX, COLORS, TEXT_PRESETS } from "./theme";

// Scanlines diagonais 45° a 5% de opacidade — overlay sutil que dá vida sem distrair.
// Espelha o padrão `repeating-linear-gradient(45deg, ...)` usado no portrait do site.
export function drawDiagonalScanlines(
  scene: Phaser.Scene,
  width: number,
  height: number,
  spacing = 15,
  alpha = 0.045,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(1, COLOR_HEX.fg, alpha);
  for (let i = -height; i < width; i += spacing) {
    g.lineBetween(i, 0, i + height, height);
  }
  return g;
}

// Dot pulsante (status / live indicator).
// 2 círculos: um nítido por cima, um glow maior por baixo. Tween infinito.
export function createPulsingDot(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius = 4,
  color = COLOR_HEX.accent,
): { dot: Phaser.GameObjects.Arc; glow: Phaser.GameObjects.Arc } {
  const glow = scene.add.circle(x, y, radius * 2.4, color, 0.32);
  const dot = scene.add.circle(x, y, radius, color);
  scene.tweens.add({
    targets: [dot, glow],
    scale: { from: 1, to: 1.45 },
    alpha: { from: 1, to: 0.4 },
    duration: 1300,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  return { dot, glow };
}

// Cluster mono no canto: label opcional accent + label principal muted.
// Usado em todos os cantos: "/ 01" + "SEQUENCE", "FASE 03 — MELHOR 07", etc.
export function addCornerLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  accent: string | null,
  main: string,
  alignRight = false,
): { accentText: Phaser.GameObjects.Text | null; mainText: Phaser.GameObjects.Text } {
  const origin: [number, number] = alignRight ? [1, 0] : [0, 0];

  let accentText: Phaser.GameObjects.Text | null = null;
  let mainX = x;

  if (accent) {
    accentText = scene.add.text(x, y, accent.toUpperCase(), TEXT_PRESETS.monoLabelAccent).setOrigin(...origin);
    const offset = accentText.width + 8;
    mainX = alignRight ? x - offset : x + offset;
  }

  const mainText = scene.add.text(mainX, y, main.toUpperCase(), TEXT_PRESETS.monoLabel).setOrigin(...origin);

  return { accentText, mainText };
}

// Atalho: estiliza uma cor laranja no número dentro de um label mono.
// Ex.: "FASE 03 — MELHOR 07" com "03" e "07" laranja seria mais trabalhoso de fazer
// (Phaser text não suporta inline color sem rope/bitmap text). Por ora exibimos tudo muted
// e usamos o accent só onde está separado.
export function styleHelpers() {
  return { COLORS, COLOR_HEX, TEXT_PRESETS };
}
