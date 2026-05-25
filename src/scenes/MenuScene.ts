import Phaser from "phaser";
import { COLORS, COLOR_HEX, TEXT_PRESETS } from "../theme";
import { drawDiagonalScanlines, createPulsingDot, addCornerLabel, getResponsiveTextSize } from "../ui";
import { takeScreenshot } from "../screenshot";
import { unlockAudio } from "../audio";
import { isTouchDevice } from "../input";

const CAMPAIGN_PHASE_KEY = "gamedev-04-breakout-campaign-phase";

export type GameMode = "campaign" | "endless";

interface MenuOption {
  label: string;
  description: string;
  mode: GameMode;
}

const OPTIONS: MenuOption[] = [
  { label: "CAMPANHA",        description: "5 fases progressivas com obstáculos e power-ups", mode: "campaign" },
  { label: "MODO LIVRE",      description: "ciclo infinito de fases aleatórias",              mode: "endless" },
];

export class MenuScene extends Phaser.Scene {
  private selectedIndex = 0;
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private optionDescTexts: Phaser.GameObjects.Text[] = [];
  private campaignPhase = 1;

  private keys!: Record<
    "UP" | "DOWN" | "W" | "S" | "ENTER" | "SPACE" | "K",
    Phaser.Input.Keyboard.Key
  >;

  constructor() {
    super("menu");
  }

  create() {
    this.campaignPhase = this.loadCampaignPhase();

    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, COLOR_HEX.bg);
    drawDiagonalScanlines(this, this.scale.width, this.scale.height, 15, 0.045);

    addCornerLabel(this, 22, 22, "/ 04", "BREAKOUT", false);
    createPulsingDot(this, this.scale.width - 22 - 4, 22 + 6, 4, COLOR_HEX.accent);
    this.add
      .text(this.scale.width - 38, 22, `CAMPANHA · FASE ${String(this.campaignPhase).padStart(2, "0")} / 05`, TEXT_PRESETS.monoLabel)
      .setOrigin(1, 0);

    this.add.text(22, this.scale.height - 22, "GAMEDEV.04", TEXT_PRESETS.hint).setOrigin(0, 1);
    this.add.text(this.scale.width - 22, this.scale.height - 22, "BRICOLAGE · GEIST", TEXT_PRESETS.hint).setOrigin(1, 1);

    this.add
      .text(this.scale.width / 2, 120, "/ JORNADA GAMEDEV", { ...TEXT_PRESETS.monoLabel, color: COLORS.muted })
      .setOrigin(0.5);

    this.add
      .text(this.scale.width / 2, 180, "BREAKOUT", TEXT_PRESETS.heroOutline)
      .setOrigin(0.5)
      .setFontSize(getResponsiveTextSize(this, "hero"));

    this.add
      .text(this.scale.width / 2, 244, "quebre todos os tijolos · não deixe a bola cair", TEXT_PRESETS.body)
      .setOrigin(0.5);

    OPTIONS.forEach((opt, i) => {
      const y = 330 + i * 64;
      const labelText = this.add
        .text(this.scale.width / 2, y, opt.label, { ...TEXT_PRESETS.bodyFg, fontSize: "22px" })
        .setOrigin(0.5);
      this.optionTexts.push(labelText);

      const descText = this.add
        .text(this.scale.width / 2, y + 22, opt.description, { ...TEXT_PRESETS.hint, color: COLORS.muted })
        .setOrigin(0.5);
      this.optionDescTexts.push(descText);

      const hitArea = this.add.rectangle(this.scale.width / 2, y + 11, 600, 56, 0, 0).setInteractive({ useHandCursor: true });
      hitArea.on("pointerover", () => { this.selectedIndex = i; this.refreshHighlight(); });
      hitArea.on("pointerdown", () => { this.selectedIndex = i; this.refreshHighlight(); this.startSelected(); });
    });

    this.add
      .text(this.scale.width / 2, this.scale.height - 56, isTouchDevice()
        ? "TOQUE UMA OPÇÃO PRA JOGAR"
        : "↑ ↓ ESCOLHER  ·  ENTER JOGAR  ·  K SCREENSHOT", TEXT_PRESETS.hint)
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    this.keys = {
      UP: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      DOWN: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      ENTER: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      SPACE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      K: kb.addKey(Phaser.Input.Keyboard.KeyCodes.K),
    };
    kb.on("keydown", unlockAudio);

    this.refreshHighlight();

    // Auto-start via URL param (?autostart=1&phase=1) — usado pelos testes
    // automatizados. No game normal, parametros sao ignorados.
    const params = new URLSearchParams(window.location.search);
    if (params.has("autostart")) {
      const phase = Number(params.get("phase") ?? "1");
      this.time.delayedCall(50, () => {
        this.scene.start("breakout", {
          mode: "campaign",
          phase: Math.max(1, Math.min(5, phase)),
        });
      });
    }
  }

  update() {
    const justDown = Phaser.Input.Keyboard.JustDown;

    if (justDown(this.keys.K)) {
      takeScreenshot(this.game, "gamedev-04-breakout-menu");
    }

    if (justDown(this.keys.UP) || justDown(this.keys.W)) {
      this.selectedIndex = (this.selectedIndex - 1 + OPTIONS.length) % OPTIONS.length;
      this.refreshHighlight();
    } else if (justDown(this.keys.DOWN) || justDown(this.keys.S)) {
      this.selectedIndex = (this.selectedIndex + 1) % OPTIONS.length;
      this.refreshHighlight();
    } else if (justDown(this.keys.ENTER) || justDown(this.keys.SPACE)) {
      this.startSelected();
    }
  }

  private startSelected() {
    const opt = OPTIONS[this.selectedIndex];
    this.scene.start("breakout", {
      mode: opt.mode,
      phase: opt.mode === "campaign" ? this.campaignPhase : 1,
    });
  }

  private refreshHighlight() {
    this.optionTexts.forEach((text, i) => {
      const isSelected = i === this.selectedIndex;
      text.setColor(isSelected ? COLORS.accent : COLORS.fg);
      text.setText(`${isSelected ? "▸  " : "    "}${OPTIONS[i].label}`);
    });
    this.optionDescTexts.forEach((text, i) => {
      const isSelected = i === this.selectedIndex;
      text.setColor(isSelected ? COLORS.fg : COLORS.muted);
    });
  }

  private loadCampaignPhase(): number {
    try {
      const raw = localStorage.getItem(CAMPAIGN_PHASE_KEY);
      const n = raw ? parseInt(raw, 10) : 1;
      return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 1;
    } catch {
      return 1;
    }
  }
}

export { CAMPAIGN_PHASE_KEY };
