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

// Tamanhos de texto responsivos baseados no menor lado do viewport.
// Usar isso em vez de tamanhos hardcoded no TEXT_PRESETS quando o texto for
// dominante visualmente (hero outlined title, display number) — garante que
// "SEQUENCE" não sai do canvas em portrait 360px.
//
// kind:
//   hero    — título principal das cenas (clamp 48–112)
//   display — score grande / FIM (clamp 36–80)
//   title   — número de fase, label médio (clamp 24–56)
export type ResponsiveTextKind = "hero" | "display" | "title";

export function getResponsiveTextSize(scene: Phaser.Scene, kind: ResponsiveTextKind): string {
  const min = Math.min(scene.scale.width, scene.scale.height);
  let px: number;
  switch (kind) {
    case "hero":
      px = Math.max(48, Math.min(112, Math.floor(min * 0.13)));
      break;
    case "display":
      px = Math.max(36, Math.min(80, Math.floor(min * 0.10)));
      break;
    case "title":
      px = Math.max(24, Math.min(56, Math.floor(min * 0.075)));
      break;
  }
  return `${px}px`;
}

// Dual-camera responsive: main camera renderiza GAMEPLAY com zoom pra caber
// no viewport (mantém coords lógicas 800×600); UI camera renderiza CHROME em
// coords reais do viewport. Resolve "true mobile feel" sem refatorar lógica
// do jogo nem container scaling (que quebra com Phaser Arcade physics).
//
// Uso:
//   const { uiCam, registerWorld, registerUi, worldPoint, onResize } =
//     setupResponsiveCameras(this, 800, 600);
//   const ball = this.add.rectangle(400, 300, ...); registerWorld(ball);
//   const score = this.add.text(this.scale.width - 22, 22, ...); registerUi(score);
//   onResize(() => score.setPosition(this.scale.width - 22, 22));
export function setupResponsiveCameras(
  scene: Phaser.Scene,
  logicalWidth: number,
  logicalHeight: number,
): {
  uiCam: Phaser.Cameras.Scene2D.Camera;
  registerWorld: (obj: Phaser.GameObjects.GameObject) => void;
  registerUi: (obj: Phaser.GameObjects.GameObject) => void;
  worldPoint: (vx: number, vy: number) => { x: number; y: number };
  onResize: (cb: () => void) => void;
} {
  const main = scene.cameras.main;
  const resizeCallbacks: Array<() => void> = [];

  const updateZoom = () => {
    const W = scene.scale.width;
    const H = scene.scale.height;
    const zoom = Math.min(W / logicalWidth, H / logicalHeight);
    main.setZoom(zoom);
    main.centerOn(logicalWidth / 2, logicalHeight / 2);
  };
  updateZoom();

  const uiCam = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height);
  uiCam.setScroll(0, 0);
  uiCam.setZoom(1);

  const registerWorld = (obj: Phaser.GameObjects.GameObject) => {
    uiCam.ignore(obj);
  };
  const registerUi = (obj: Phaser.GameObjects.GameObject) => {
    main.ignore(obj);
  };

  const onResize = (cb: () => void) => { resizeCallbacks.push(cb); };

  const handleResize = () => {
    updateZoom();
    uiCam.setSize(scene.scale.width, scene.scale.height);
    for (const cb of resizeCallbacks) cb();
  };
  scene.scale.on("resize", handleResize);
  scene.events.once("shutdown", () => scene.scale.off("resize", handleResize));

  const worldPoint = (vx: number, vy: number) => {
    const W = scene.scale.width;
    const H = scene.scale.height;
    const zoom = main.zoom;
    return {
      x: logicalWidth / 2 + (vx - W / 2) / zoom,
      y: logicalHeight / 2 + (vy - H / 2) / zoom,
    };
  };

  return { uiCam, registerWorld, registerUi, worldPoint, onResize };
}

// Cria um container "playfield" que escala+centraliza um conteúdo de tamanho
// lógico fixo (ex.: 800×600) pra caber no viewport real (Scale.RESIZE).
// Use pra jogos com gameplay em grid/coordenadas fixas que precisa adaptar a
// qualquer tela mantendo a lógica intacta.
export function makeResponsivePlayfield(
  scene: Phaser.Scene,
  logicalWidth: number,
  logicalHeight: number,
  options: { topMargin?: number; bottomMargin?: number } = {},
): {
  container: Phaser.GameObjects.Container;
  localPoint: (worldX: number, worldY: number) => { x: number; y: number };
  onResize: (cb: () => void) => void;
} {
  const topMargin = options.topMargin ?? 0;
  const bottomMargin = options.bottomMargin ?? 0;
  const container = scene.add.container(0, 0);
  const resizeCallbacks: Array<() => void> = [];

  const reposition = () => {
    const W = scene.scale.width;
    const H = scene.scale.height - topMargin - bottomMargin;
    const scale = Math.min(W / logicalWidth, H / logicalHeight);
    container.setScale(scale);
    container.setPosition(
      (W - logicalWidth * scale) / 2,
      topMargin + (H - logicalHeight * scale) / 2,
    );
    for (const cb of resizeCallbacks) cb();
  };
  reposition();
  scene.scale.on("resize", reposition);
  scene.events.once("shutdown", () => scene.scale.off("resize", reposition));

  // Converte coord do viewport (pointer.x/y) pra coord local do container.
  const localPoint = (worldX: number, worldY: number) => ({
    x: (worldX - container.x) / container.scaleX,
    y: (worldY - container.y) / container.scaleY,
  });

  const onResize = (cb: () => void) => { resizeCallbacks.push(cb); };

  return { container, localPoint, onResize };
}
