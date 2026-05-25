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
  } catch {}

  new Phaser.Game({
    type: Phaser.AUTO,
    backgroundColor: COLORS.bg,
    parent: "game",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 800, height: 600 },
    input: { activePointers: 3 },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    scene: [MenuScene, BreakoutScene],
  });
}

void bootstrap();
