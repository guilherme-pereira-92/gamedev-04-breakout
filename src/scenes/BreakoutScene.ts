import Phaser from "phaser";
import { COLORS, COLOR_HEX, TEXT_PRESETS } from "../theme";
import { drawDiagonalScanlines, createPulsingDot, addCornerLabel } from "../ui";
import { takeScreenshot } from "../screenshot";
import { playTone } from "../audio";
import { CAMPAIGN_PHASE_KEY, type GameMode } from "./MenuScene";

const WIDTH = 800;
const HEIGHT = 600;
const PADDLE_W = 120;
const PADDLE_W_WIDE = 180;
const PADDLE_H = 14;
const PADDLE_Y = HEIGHT - 56;
const PADDLE_SPEED = 520;
const BALL_SIZE = 12;
const BALL_BASE_SPEED = 340;
const MAX_BOUNCE_ANGLE = Math.PI / 3;

const BRICK_COLS = 10;
const BRICK_W = 64;
const BRICK_H = 22;
const BRICK_GAP = 4;
const BRICK_AREA_TOP = 84;
const BRICK_AREA_LEFT = (WIDTH - (BRICK_COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP)) / 2;

const POWERUP_W = 28;
const POWERUP_H = 18;
const POWERUP_FALL_SPEED = 180;
const POWERUP_CHANCE = 0.22;
const POWERUP_DURATION_MS = 8000;

const STARTING_LIVES = 3;
const SCORE_PER_BRICK = 10;

interface LevelDef {
  rows: string[];
  legend: Record<string, { hp: number }>;
  ballSpeed: number;
}

// Tipo H = "hard" (2 hits), B = "normal" (1 hit), I = "indestructible".
const LEVELS: LevelDef[] = [
  {
    rows: [
      "..........",
      ".BBBBBBBB.",
      ".BBBBBBBB.",
      ".BBBBBBBB.",
      "..........",
    ],
    legend: { B: { hp: 1 } },
    ballSpeed: 320,
  },
  {
    rows: [
      "HBHBHBHBHB",
      "BHBHBHBHBH",
      "HBHBHBHBHB",
      "BHBHBHBHBH",
    ],
    legend: { B: { hp: 1 }, H: { hp: 2 } },
    ballSpeed: 340,
  },
  {
    rows: [
      "....BB....",
      "...BBBB...",
      "..BBBBBB..",
      ".BBBBBBBB.",
      "BBBBBBBBBB",
      ".BBBBBBBB.",
      "..BBBBBB..",
      "...BBBB...",
    ],
    legend: { B: { hp: 1 } },
    ballSpeed: 360,
  },
  {
    rows: [
      "IBBBBBBBBI",
      "B........B",
      "B.HHHHHH.B",
      "B.H.II.H.B",
      "B.HHHHHH.B",
      "B........B",
      "IBBBBBBBBI",
    ],
    legend: { B: { hp: 1 }, H: { hp: 2 }, I: { hp: -1 } },
    ballSpeed: 380,
  },
  {
    rows: [
      "HHHHHHHHHH",
      "HBBBBBBBBH",
      "HBHHHHHHBH",
      "HBHIIIIHBH",
      "HBHIBBIHBH",
      "HBHIIIIHBH",
      "HBHHHHHHBH",
      "HBBBBBBBBH",
      "HHHHHHHHHH",
    ],
    legend: { B: { hp: 1 }, H: { hp: 2 }, I: { hp: -1 } },
    ballSpeed: 420,
  },
];

type PowerupType = "wide" | "slow" | "multi" | "life";
type GameState = "ready" | "playing" | "paused" | "lifelost" | "levelclear" | "gameover" | "campaigncomplete";

interface SceneInitData {
  mode?: GameMode;
  phase?: number;
}

export class BreakoutScene extends Phaser.Scene {
  private mode: GameMode = "campaign";
  private phase = 1;
  private level!: LevelDef;

  private paddle!: Phaser.GameObjects.Rectangle;
  private balls!: Phaser.Physics.Arcade.Group;
  private bricks!: Phaser.Physics.Arcade.StaticGroup;
  private powerups!: Phaser.Physics.Arcade.Group;
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;

  private state: GameState = "ready";
  private lives = STARTING_LIVES;
  private score = 0;
  private brickCount = 0;
  private currentBallSpeed = BALL_BASE_SPEED;
  private slowEndAt = 0;
  private wideEndAt = 0;

  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private metaLabel!: Phaser.GameObjects.Text;
  private overlayBg!: Phaser.GameObjects.Rectangle;
  private overlayTitle!: Phaser.GameObjects.Text;
  private overlaySubtitle!: Phaser.GameObjects.Text;
  private overlayHint!: Phaser.GameObjects.Text;

  private keys!: Record<
    "LEFT" | "RIGHT" | "A" | "D" | "SPACE" | "R" | "P" | "ESC" | "K",
    Phaser.Input.Keyboard.Key
  >;

  constructor() {
    super("breakout");
  }

  init(data: SceneInitData) {
    this.mode = data.mode ?? "campaign";
    this.phase = data.phase ?? 1;
    this.level = this.mode === "campaign"
      ? LEVELS[Math.min(this.phase, LEVELS.length) - 1]
      : LEVELS[(this.phase - 1) % LEVELS.length];
    this.lives = STARTING_LIVES;
    this.score = 0;
    this.brickCount = 0;
    this.currentBallSpeed = this.level.ballSpeed;
    this.slowEndAt = 0;
    this.wideEndAt = 0;
    this.state = "ready";
  }

  preload() {
    // Textura procedural pra partículas (1° contato com generateTexture).
    // No #05 vamos carregar PNGs de verdade; aqui mantenho 100% procedural.
    const g = this.add.graphics();
    g.fillStyle(COLOR_HEX.accent, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture("particle", 4, 4);
    g.destroy();
  }

  create() {
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, COLOR_HEX.bg);
    drawDiagonalScanlines(this, WIDTH, HEIGHT, 18, 0.04);

    this.particles = this.add.particles(0, 0, "particle", {
      speed: { min: 60, max: 180 },
      lifespan: 380,
      scale: { start: 1, end: 0 },
      alpha: { start: 0.9, end: 0 },
      blendMode: "ADD",
      emitting: false,
    });

    this.paddle = this.add.rectangle(WIDTH / 2, PADDLE_Y, PADDLE_W, PADDLE_H, COLOR_HEX.fg);
    this.physics.add.existing(this.paddle);
    const paddleBody = this.paddle.body as Phaser.Physics.Arcade.Body;
    paddleBody.setImmovable(true);
    paddleBody.setAllowGravity(false);
    paddleBody.setCollideWorldBounds(true);

    this.bricks = this.physics.add.staticGroup();
    this.balls = this.physics.add.group();
    this.powerups = this.physics.add.group({
      allowGravity: false,
    });

    this.physics.world.setBounds(0, 0, WIDTH, HEIGHT);
    this.physics.world.checkCollision.down = false; // bola pode sair pelo bottom

    this.buildLevel();
    this.spawnBall(true);

    this.physics.add.collider(this.balls, this.paddle, this.onPaddleHit, undefined, this);
    this.physics.add.collider(this.balls, this.bricks, this.onBrickHit, undefined, this);
    this.physics.add.overlap(this.powerups, this.paddle, this.onPowerupCaught, undefined, this);

    this.drawChrome();
    this.drawOverlay();

    const kb = this.input.keyboard!;
    this.keys = {
      LEFT: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      RIGHT: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SPACE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      R: kb.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      P: kb.addKey(Phaser.Input.Keyboard.KeyCodes.P),
      ESC: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      K: kb.addKey(Phaser.Input.Keyboard.KeyCodes.K),
    };

    this.showReadyOverlay();
  }

  update(time: number, delta: number) {
    if (Phaser.Input.Keyboard.JustDown(this.keys.K)) {
      takeScreenshot(this.game, `gamedev-04-breakout-${this.mode}`);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.scene.start("menu");
      return;
    }

    this.handleStateInput();

    if (this.state === "playing") {
      this.updatePaddle(delta);
      this.updatePowerupExpirations(time);
      this.checkLostBalls();
    }
  }

  // ---------- input ----------

  private handleStateInput() {
    const justDown = Phaser.Input.Keyboard.JustDown;

    if (this.state === "ready" && justDown(this.keys.SPACE)) {
      this.launchAllBalls();
      this.state = "playing";
      this.hideOverlay();
    } else if (this.state === "playing" && justDown(this.keys.P)) {
      this.state = "paused";
      this.physics.pause();
      this.showOverlay("PAUSADO", "", "P CONTINUAR  ·  ESC MENU");
    } else if (this.state === "paused" && justDown(this.keys.P)) {
      this.state = "playing";
      this.physics.resume();
      this.hideOverlay();
    } else if (this.state === "lifelost" && justDown(this.keys.SPACE)) {
      this.launchAllBalls();
      this.state = "playing";
      this.hideOverlay();
    } else if (this.state === "gameover" && justDown(this.keys.R)) {
      this.scene.restart({ mode: this.mode, phase: this.phase });
    } else if (this.state === "levelclear" && justDown(this.keys.SPACE)) {
      const nextPhase = this.phase + 1;
      if (this.mode === "campaign" && nextPhase > LEVELS.length) {
        // não deveria chegar aqui — campaigncomplete já tratou
        this.scene.start("menu");
      } else {
        this.scene.start("breakout", { mode: this.mode, phase: nextPhase });
      }
    } else if (this.state === "campaigncomplete" && justDown(this.keys.SPACE)) {
      this.scene.start("menu");
    }
  }

  private updatePaddle(delta: number) {
    const left = this.keys.LEFT.isDown || this.keys.A.isDown;
    const right = this.keys.RIGHT.isDown || this.keys.D.isDown;
    const body = this.paddle.body as Phaser.Physics.Arcade.Body;
    const dt = delta / 1000;

    if (left && !right) this.paddle.x -= PADDLE_SPEED * dt;
    else if (right && !left) this.paddle.x += PADDLE_SPEED * dt;

    // mantém dentro dos bounds (cálculo manual porque setImmovable + manual move)
    const halfW = this.paddle.width / 2;
    this.paddle.x = Phaser.Math.Clamp(this.paddle.x, halfW, WIDTH - halfW);
    body.updateFromGameObject();
  }

  // ---------- spawn ----------

  private buildLevel() {
    this.brickCount = 0;
    for (let r = 0; r < this.level.rows.length; r++) {
      const row = this.level.rows[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === "." || ch === " ") continue;
        const def = this.level.legend[ch];
        if (!def) continue;

        const x = BRICK_AREA_LEFT + c * (BRICK_W + BRICK_GAP) + BRICK_W / 2;
        const y = BRICK_AREA_TOP + r * (BRICK_H + BRICK_GAP) + BRICK_H / 2;

        const indestructible = def.hp === -1;
        const brick = this.add.rectangle(x, y, BRICK_W, BRICK_H, this.brickFillColor(def.hp), 1);
        brick.setStrokeStyle(1, this.brickStrokeColor(def.hp), 1);
        this.bricks.add(brick);

        brick.setData("hp", def.hp);
        brick.setData("indestructible", indestructible);
        if (!indestructible) this.brickCount++;
      }
    }
  }

  private brickFillColor(hp: number): number {
    if (hp === -1) return COLOR_HEX.border;       // indestrutível
    if (hp === 2) return COLOR_HEX.bgSoft;        // duro
    return COLOR_HEX.bgSoft;                       // normal
  }

  private brickStrokeColor(hp: number): number {
    if (hp === -1) return COLOR_HEX.muted;
    if (hp === 2) return COLOR_HEX.fg;
    return COLOR_HEX.muted;
  }

  private spawnBall(restPaddle: boolean): Phaser.GameObjects.Rectangle {
    const ball = this.add.rectangle(WIDTH / 2, PADDLE_Y - 16, BALL_SIZE, BALL_SIZE, COLOR_HEX.accent);
    this.physics.add.existing(ball);
    const body = ball.body as Phaser.Physics.Arcade.Body;
    body.setBounce(1, 1);
    body.setCollideWorldBounds(true);
    body.setCircle(BALL_SIZE / 2, (ball.width - BALL_SIZE) / 2, (ball.height - BALL_SIZE) / 2);
    body.setMaxSpeed(900);
    if (restPaddle) {
      ball.setData("attached", true);
    }
    this.balls.add(ball);
    return ball;
  }

  private launchAllBalls() {
    this.balls.children.iterate((b) => {
      const ball = b as Phaser.GameObjects.Rectangle;
      const body = ball.body as Phaser.Physics.Arcade.Body;
      ball.setData("attached", false);
      const angle = Phaser.Math.FloatBetween(-Math.PI / 6, Math.PI / 6) - Math.PI / 2;
      body.setVelocity(Math.cos(angle) * this.currentBallSpeed, Math.sin(angle) * this.currentBallSpeed);
      return true;
    });
  }

  // ---------- collisions ----------

  private onPaddleHit(ballObj: unknown, _paddleObj: unknown) {
    const ball = ballObj as Phaser.GameObjects.Rectangle;
    const body = ball.body as Phaser.Physics.Arcade.Body;
    const offset = Phaser.Math.Clamp((ball.x - this.paddle.x) / (this.paddle.width / 2), -1, 1);
    const angle = offset * MAX_BOUNCE_ANGLE - Math.PI / 2;
    const speed = body.velocity.length();
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    playTone(440, 60, "square", 0.10);
  }

  private onBrickHit(ballObj: unknown, brickObj: unknown) {
    const brick = brickObj as Phaser.GameObjects.Rectangle & { getData: (k: string) => unknown };
    const indestructible = brick.getData("indestructible") as boolean;
    if (indestructible) {
      playTone(220, 60, "square", 0.10);
      this.cameras.main.shake(40, 0.002);
      return;
    }

    let hp = (brick.getData("hp") as number) - 1;
    brick.setData("hp", hp);

    if (hp <= 0) {
      this.score += SCORE_PER_BRICK;
      this.brickCount--;
      this.refreshChrome();
      this.particles.emitParticleAt(brick.x, brick.y, 10);
      playTone(660, 80, "triangle", 0.12);
      this.maybeSpawnPowerup(brick.x, brick.y);
      brick.destroy();

      if (this.brickCount <= 0) this.levelCleared();
    } else {
      // visualizou batida — engrossa borda
      brick.setStrokeStyle(1.5, COLOR_HEX.accent, 1);
      playTone(330, 60, "square", 0.10);
    }

    // garante velocidade mínima (Arcade pode reduzir após múltiplas colisões em sequência)
    const ball = ballObj as Phaser.GameObjects.Rectangle;
    const body = ball.body as Phaser.Physics.Arcade.Body;
    const speed = body.velocity.length();
    const target = this.currentBallSpeed;
    if (speed < target * 0.9) {
      body.velocity.scale(target / speed);
    }
  }

  private onPowerupCaught(_paddleObj: unknown, powerupObj: unknown) {
    const powerup = powerupObj as Phaser.GameObjects.Rectangle & { getData: (k: string) => unknown };
    const type = powerup.getData("type") as PowerupType;
    this.applyPowerup(type);
    powerup.destroy();
    playTone(880, 100, "triangle", 0.13);
    this.cameras.main.flash(80, 245, 100, 30, false);
  }

  // ---------- powerups ----------

  private maybeSpawnPowerup(x: number, y: number) {
    if (Math.random() > POWERUP_CHANCE) return;
    const types: PowerupType[] = ["wide", "slow", "multi", "life"];
    const type = types[Phaser.Math.Between(0, types.length - 1)];
    this.spawnPowerup(x, y, type);
  }

  private spawnPowerup(x: number, y: number, type: PowerupType) {
    const letter = { wide: "W", slow: "S", multi: "M", life: "+" }[type];
    const color = COLOR_HEX.bgSoft;

    const container = this.add.rectangle(x, y, POWERUP_W, POWERUP_H, color, 1);
    container.setStrokeStyle(1, COLOR_HEX.fg, 1);
    this.physics.add.existing(container);
    const body = container.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(POWERUP_FALL_SPEED);
    body.setAllowGravity(false);
    container.setData("type", type);

    // letra interna
    const text = this.add.text(x, y, letter, {
      fontFamily: TEXT_PRESETS.monoLabelFg.fontFamily,
      fontSize: "12px",
      color: COLORS.fg,
    }).setOrigin(0.5);

    // sincroniza letra com container
    const sync = () => {
      if (!container.active) {
        text.destroy();
        return;
      }
      text.setPosition(container.x, container.y);
    };
    this.events.on("update", sync);
    container.on("destroy", () => {
      this.events.off("update", sync);
      text.destroy();
    });

    this.powerups.add(container);
  }

  private applyPowerup(type: PowerupType) {
    const now = this.time.now;
    switch (type) {
      case "wide":
        this.paddle.setSize(PADDLE_W_WIDE, PADDLE_H);
        (this.paddle.body as Phaser.Physics.Arcade.Body).setSize(PADDLE_W_WIDE, PADDLE_H, true);
        this.wideEndAt = now + POWERUP_DURATION_MS;
        break;
      case "slow":
        this.currentBallSpeed = this.level.ballSpeed * 0.7;
        this.slowEndAt = now + POWERUP_DURATION_MS;
        this.rescaleAllBalls();
        break;
      case "multi":
        this.spawnExtraBalls(2);
        break;
      case "life":
        this.lives++;
        break;
    }
    this.refreshChrome();
  }

  private updatePowerupExpirations(now: number) {
    if (this.wideEndAt > 0 && now >= this.wideEndAt) {
      this.paddle.setSize(PADDLE_W, PADDLE_H);
      (this.paddle.body as Phaser.Physics.Arcade.Body).setSize(PADDLE_W, PADDLE_H, true);
      this.wideEndAt = 0;
    }
    if (this.slowEndAt > 0 && now >= this.slowEndAt) {
      this.currentBallSpeed = this.level.ballSpeed;
      this.slowEndAt = 0;
      this.rescaleAllBalls();
    }
  }

  private spawnExtraBalls(count: number) {
    // pega uma bola existente como referência de posição/velocidade
    const existing = this.balls.getChildren()[0] as Phaser.GameObjects.Rectangle | undefined;
    if (!existing) return;
    for (let i = 0; i < count; i++) {
      const extra = this.add.rectangle(existing.x, existing.y, BALL_SIZE, BALL_SIZE, COLOR_HEX.accent);
      this.physics.add.existing(extra);
      const body = extra.body as Phaser.Physics.Arcade.Body;
      body.setBounce(1, 1);
      body.setCollideWorldBounds(true);
      body.setMaxSpeed(900);
      const angle = Math.PI * (-0.3 + 0.6 * (i + 1) / (count + 1));
      body.setVelocity(Math.cos(angle - Math.PI / 2) * this.currentBallSpeed, Math.sin(angle - Math.PI / 2) * this.currentBallSpeed);
      this.balls.add(extra);
    }
  }

  private rescaleAllBalls() {
    this.balls.children.iterate((b) => {
      const ball = b as Phaser.GameObjects.Rectangle;
      const body = ball.body as Phaser.Physics.Arcade.Body;
      const current = body.velocity.length();
      if (current < 1) return true;
      body.velocity.scale(this.currentBallSpeed / current);
      return true;
    });
  }

  // ---------- vida / nível ----------

  private checkLostBalls() {
    const alive: Phaser.GameObjects.Rectangle[] = [];
    this.balls.children.iterate((b) => {
      const ball = b as Phaser.GameObjects.Rectangle;
      if (ball.y > HEIGHT + BALL_SIZE) {
        ball.destroy();
      } else {
        alive.push(ball);
      }
      return true;
    });

    if (alive.length === 0) {
      this.loseLife();
    }
  }

  private loseLife() {
    this.lives--;
    this.refreshChrome();
    this.cameras.main.shake(180, 0.008);
    playTone(180, 350, "sawtooth", 0.16);

    // limpa powerups soltos
    this.powerups.clear(true, true);

    if (this.lives <= 0) {
      this.gameOver();
      return;
    }

    this.state = "lifelost";
    this.spawnBall(true);
    this.balls.children.iterate((b) => {
      const ball = b as Phaser.GameObjects.Rectangle;
      ball.setPosition(WIDTH / 2, PADDLE_Y - 16);
      (ball.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      ball.setData("attached", true);
      return true;
    });
    this.paddle.setSize(PADDLE_W, PADDLE_H);
    (this.paddle.body as Phaser.Physics.Arcade.Body).setSize(PADDLE_W, PADDLE_H, true);
    this.wideEndAt = 0;
    this.slowEndAt = 0;
    this.currentBallSpeed = this.level.ballSpeed;
    this.showOverlay("VIDA PERDIDA", `restam ${this.lives}`, "ESPAÇO LANÇAR  ·  ESC MENU");
  }

  private levelCleared() {
    if (this.mode === "campaign" && this.phase >= LEVELS.length) {
      this.state = "campaigncomplete";
      this.saveCampaignPhase(5);
      playTone(660, 120, "triangle", 0.14);
      this.time.delayedCall(140, () => playTone(880, 150, "triangle", 0.14));
      this.time.delayedCall(320, () => playTone(1175, 220, "triangle", 0.14));
      this.showOverlay("CAMPANHA", `5 fases · ${this.score} pontos`, "ESPAÇO VOLTAR AO MENU");
      return;
    }
    this.state = "levelclear";
    if (this.mode === "campaign") {
      this.saveCampaignPhase(Math.max(this.phase + 1, this.loadCampaignPhase()));
    }
    playTone(660, 100, "triangle", 0.14);
    this.time.delayedCall(120, () => playTone(880, 160, "triangle", 0.14));
    this.showOverlay(`FASE ${String(this.phase).padStart(2, "0")}`, `score ${this.score} · vidas ${this.lives}`, "ESPAÇO PRÓXIMA  ·  ESC MENU");
  }

  private gameOver() {
    this.state = "gameover";
    this.balls.clear(true, true);
    this.powerups.clear(true, true);
    this.physics.pause();
    this.time.delayedCall(450, () => {
      this.showOverlay("FIM", `fase ${this.phase} · ${this.score} pontos`, "R TENTAR DE NOVO  ·  ESC MENU");
    });
  }

  // ---------- chrome ----------

  private drawChrome() {
    addCornerLabel(this, 22, 22, "/ 04", "BREAKOUT", false);
    createPulsingDot(this, WIDTH - 22 - 4, 22 + 6, 4, COLOR_HEX.accent);
    this.metaLabel = this.add
      .text(WIDTH - 38, 22, "", TEXT_PRESETS.monoLabel)
      .setOrigin(1, 0);

    this.scoreText = this.add
      .text(WIDTH / 2, 22, "", { ...TEXT_PRESETS.monoLabelFg, fontSize: "16px" })
      .setOrigin(0.5, 0);

    this.livesText = this.add
      .text(WIDTH / 2, 44, "", TEXT_PRESETS.monoLabel)
      .setOrigin(0.5, 0);

    this.add.text(22, HEIGHT - 22, this.bottomLeftChrome(), TEXT_PRESETS.hint).setOrigin(0, 1);
    this.add.text(WIDTH - 22, HEIGHT - 22, "← → · ESPAÇO · P PAUSAR · ESC MENU · K", TEXT_PRESETS.hint).setOrigin(1, 1);

    this.refreshChrome();
  }

  private bottomLeftChrome(): string {
    if (this.mode === "campaign") return `GAMEDEV.04 · CAMPANHA F${this.phase}`;
    return `GAMEDEV.04 · MODO LIVRE F${this.phase}`;
  }

  private refreshChrome() {
    this.scoreText.setText(`SCORE  ${String(this.score).padStart(4, "0")}`);
    this.livesText.setText(`VIDAS  ${"♦".repeat(Math.max(0, this.lives))}`);

    const bits: string[] = [`TIJOLOS ${this.brickCount}`];
    if (this.wideEndAt > 0) bits.push("WIDE");
    if (this.slowEndAt > 0) bits.push("SLOW");
    this.metaLabel.setText(bits.join(" · "));
  }

  // ---------- overlay ----------

  private drawOverlay() {
    this.overlayBg = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, COLOR_HEX.bg, 0.82);
    this.overlayTitle = this.add
      .text(WIDTH / 2, HEIGHT / 2 - 70, "", TEXT_PRESETS.heroOutline)
      .setOrigin(0.5)
      .setFontSize("76px");
    this.overlaySubtitle = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 6, "", TEXT_PRESETS.body)
      .setOrigin(0.5);
    this.overlayHint = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 56, "", TEXT_PRESETS.hint)
      .setOrigin(0.5);
  }

  private showReadyOverlay() {
    let title = `FASE ${String(this.phase).padStart(2, "0")}`;
    let subtitle = `${this.brickCount} tijolos · ${this.lives} vidas · bola ${this.level.ballSpeed}px/s`;
    this.showOverlay(title, subtitle, "ESPAÇO LANÇAR  ·  ESC MENU");
  }

  private showOverlay(title: string, subtitle: string, hint: string) {
    this.overlayBg.setVisible(true);
    this.overlayTitle.setVisible(true).setText(title);
    this.overlaySubtitle.setVisible(true).setText(subtitle);
    this.overlayHint.setVisible(true).setText(hint);
  }

  private hideOverlay() {
    this.overlayBg.setVisible(false);
    this.overlayTitle.setVisible(false);
    this.overlaySubtitle.setVisible(false);
    this.overlayHint.setVisible(false);
  }

  // ---------- persistência ----------

  private loadCampaignPhase(): number {
    try {
      const raw = localStorage.getItem(CAMPAIGN_PHASE_KEY);
      const n = raw ? parseInt(raw, 10) : 1;
      return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 1;
    } catch {
      return 1;
    }
  }

  private saveCampaignPhase(phase: number) {
    try {
      localStorage.setItem(CAMPAIGN_PHASE_KEY, String(Math.min(5, phase)));
    } catch {}
  }
}
