import Phaser from "phaser";

// Captura o canvas e dispara download de PNG.
// Uso típico: bindar à tecla K dentro de uma cena Phaser.
export function takeScreenshot(game: Phaser.Game, prefix: string): void {
  game.renderer.snapshot((image) => {
    if (!(image instanceof HTMLImageElement)) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const link = document.createElement("a");
    link.download = `${prefix}-${stamp}.png`;
    link.href = image.src;
    link.click();
  });
}
