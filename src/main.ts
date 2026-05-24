import Phaser from "phaser";
import { MenuScene } from "./scenes/MenuScene";
import { BreakoutScene } from "./scenes/BreakoutScene";
import { COLORS, FONT_NAMES } from "./theme";

async function bootstrap() {
  try {
    await Promise.all([
      document.fonts.load(`16px "${FONT_NAMES.mono}"`),
      document.fonts.load(`64px "${FONT_NAMES.display}"`),
    ]);
  } catch {
    // sem rede — segue com fontes do sistema
  }

  new Phaser.Game({
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: COLORS.bg,
    parent: "game",
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [MenuScene, BreakoutScene],
  });
}

void bootstrap();
