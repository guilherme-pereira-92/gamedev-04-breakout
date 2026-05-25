// input.ts — helpers de input multi-device (mouse, touch, swipe).
// Compartilhado entre os projetos da jornada gamedev — copiado pra cada um.

import Phaser from "phaser";

// Detecta se o dispositivo primário é touch (mobile/tablet).
// Não é 100% — laptops com touchscreen retornam true também. Pra esses casos,
// o jogo deve aceitar AMBOS os modos de input (teclado E touch funcionam juntos).
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  if ("ontouchstart" in window) return true;
  if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return true;
  return false;
}

// Detecta se devemos usar LAYOUT mobile (fullscreen Scale.RESIZE) ou
// desktop (canvas centrado 800×600 Scale.FIT). Combinação de touch +
// largura: tablet landscape (>= 900px) usa layout desktop mesmo sendo touch.
export function isMobileLayout(): boolean {
  if (typeof window === "undefined") return false;
  return isTouchDevice() && window.innerWidth < 900;
}

export type SwipeDirection = "up" | "down" | "left" | "right";

interface SwipeOptions {
  minDistance?: number; // distância mínima em px pra contar como swipe (default 35)
  maxDuration?: number; // tempo máximo em ms (default 600)
}

// Detecta swipes em uma cena. Útil pro Snake.
// Listeners são removidos automaticamente no scene.shutdown (sem memory leak).
export function onSwipe(
  scene: Phaser.Scene,
  callback: (dir: SwipeDirection) => void,
  options: SwipeOptions = {},
): void {
  const minDistance = options.minDistance ?? 35;
  const maxDuration = options.maxDuration ?? 600;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let tracking = false;

  const downHandler = (pointer: Phaser.Input.Pointer) => {
    startX = pointer.x;
    startY = pointer.y;
    startTime = scene.time.now;
    tracking = true;
  };

  const upHandler = (pointer: Phaser.Input.Pointer) => {
    if (!tracking) return;
    tracking = false;
    const dx = pointer.x - startX;
    const dy = pointer.y - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = scene.time.now - startTime;
    if (dist < minDistance || duration > maxDuration) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      callback(dx > 0 ? "right" : "left");
    } else {
      callback(dy > 0 ? "down" : "up");
    }
  };

  scene.input.on("pointerdown", downHandler);
  scene.input.on("pointerup", upHandler);
  scene.events.once("shutdown", () => {
    scene.input.off("pointerdown", downHandler);
    scene.input.off("pointerup", upHandler);
  });
}

interface DragOptions {
  axis?: "x" | "y" | "both"; // default both
}

// Drag handler: callback continuamente enquanto pointer está down.
// Útil pra mover paddle no Pong e Breakout.
export function onDrag(
  scene: Phaser.Scene,
  callback: (worldX: number, worldY: number, isPressed: boolean) => void,
  _options: DragOptions = {},
): void {
  let pressed = false;

  const downHandler = (pointer: Phaser.Input.Pointer) => {
    pressed = true;
    callback(pointer.x, pointer.y, true);
  };
  const moveHandler = (pointer: Phaser.Input.Pointer) => {
    if (!pressed) return;
    callback(pointer.x, pointer.y, true);
  };
  const upHandler = (pointer: Phaser.Input.Pointer) => {
    if (!pressed) return;
    pressed = false;
    callback(pointer.x, pointer.y, false);
  };

  scene.input.on("pointerdown", downHandler);
  scene.input.on("pointermove", moveHandler);
  scene.input.on("pointerup", upHandler);
  scene.events.once("shutdown", () => {
    scene.input.off("pointerdown", downHandler);
    scene.input.off("pointermove", moveHandler);
    scene.input.off("pointerup", upHandler);
  });
}

interface TapOptions {
  maxDuration?: number; // default 300ms
  maxDistance?: number; // default 18px
}

// Tap: pointer down + up no mesmo lugar e tempo curto.
// Útil pra "começar jogo", "lançar bola", etc.
export function onTap(
  scene: Phaser.Scene,
  callback: (x: number, y: number) => void,
  options: TapOptions = {},
): void {
  const maxDuration = options.maxDuration ?? 300;
  const maxDistance = options.maxDistance ?? 18;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let tracking = false;

  const downHandler = (pointer: Phaser.Input.Pointer) => {
    startX = pointer.x;
    startY = pointer.y;
    startTime = scene.time.now;
    tracking = true;
  };
  const upHandler = (pointer: Phaser.Input.Pointer) => {
    if (!tracking) return;
    tracking = false;
    const dx = pointer.x - startX;
    const dy = pointer.y - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = scene.time.now - startTime;
    if (dist > maxDistance || duration > maxDuration) return;
    callback(pointer.x, pointer.y);
  };

  scene.input.on("pointerdown", downHandler);
  scene.input.on("pointerup", upHandler);
  scene.events.once("shutdown", () => {
    scene.input.off("pointerdown", downHandler);
    scene.input.off("pointerup", upHandler);
  });
}

// Coordenadas do canvas via Phaser são em "espaço da cena" (800×600 fixo),
// mesmo que o canvas visualmente esteja escalado por Scale.FIT. Logo
// pointer.x/y já está no espaço lógico — não precisa converter.
