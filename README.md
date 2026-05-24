# 04 — Breakout

Quarto projeto da jornada. Primeira aplicação com **física Arcade do Phaser**, múltiplos objetos do mesmo tipo, dados de fase, e power-ups.

**Como jogar:**
- `← / →` ou `A / D` move o paddle
- `ESPAÇO` lança a bola
- `P` pausa, `R` reinicia fase (no game over), `ESC` volta ao menu
- `K` baixa screenshot

**Stack:** TypeScript + Phaser 3 + Vite + Phaser Arcade Physics.

## Rodar

```bash
npm install
npm run dev
```

Porta `5176` (4° projeto, 4° porta).

## O que tem de novo (vs Pong/Snake)

### 1. Arcade Physics: o engine de física embutido

Em Pong eu escrevi `intersects(a, b)` na mão. Em Snake usei lógica de grid sem física. Aqui ativo o **Arcade Physics** do Phaser:

```ts
// main.ts
new Phaser.Game({
  // ...
  physics: {
    default: "arcade",
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
});
```

E agora qualquer `GameObject` pode ganhar um **body**:

```ts
this.physics.add.existing(this.paddle);
const body = this.paddle.body as Phaser.Physics.Arcade.Body;
body.setImmovable(true);    // paddle não é empurrada pela bola
body.setAllowGravity(false);
body.setCollideWorldBounds(true);
```

Arcade gerencia: **broad phase** (quadtree pra evitar testar todos pares), **collision resolution** (separa overlaps), e **callbacks**. É AABB rápido (sem rotação).

**Pong sem física → Breakout com física:** vê a diferença. Aqui não escrevo `intersects` em lugar nenhum — só configuro colliders e o engine resolve.

### 2. Static groups: muitos objetos do mesmo tipo

Mais de 60 tijolos numa fase. Cada um precisa colidir com a bola. Solução: **static group**.

```ts
this.bricks = this.physics.add.staticGroup();
const brick = this.add.rectangle(x, y, w, h, color);
this.bricks.add(brick);
// ...
this.physics.add.collider(this.balls, this.bricks, this.onBrickHit, undefined, this);
```

**Static** = corpo que não se move (não tem `velocity`). Phaser otimiza colisões contra static groups (broad phase espacial). Performance escalável pra centenas de objetos.

Tijolos guardam estado próprio usando `setData/getData`:

```ts
brick.setData("hp", 2);
brick.setData("indestructible", false);
// quando bate:
const hp = brick.getData("hp") as number - 1;
brick.setData("hp", hp);
if (hp <= 0) brick.destroy();
```

Alternativa: estender `Rectangle` numa classe `Brick`. Pra esse projeto, `setData` é mais leve. Pra projetos maiores, classes próprias são melhores.

### 3. Colliders e overlaps

```ts
this.physics.add.collider(this.balls, this.paddle, this.onPaddleHit, undefined, this);
this.physics.add.collider(this.balls, this.bricks, this.onBrickHit, undefined, this);
this.physics.add.overlap(this.powerups, this.paddle, this.onPowerupCaught, undefined, this);
```

- `collider` → registra colisão E **separa** os corpos. Use pra bola-paddle, bola-tijolo.
- `overlap` → só dispara o callback, não separa. Use pra power-up caindo no paddle: você só quer detectar, sem afetar movimento.

### 4. Reflexão custom em cima de física

Arcade default só inverte velocidade no eixo de colisão. Pra reproduzir o Pong style (ângulo depende da posição de impacto), eu **sobrescrevo** a velocidade no callback:

```ts
private onPaddleHit(ballObj, _paddleObj) {
  const ball = ballObj as Phaser.GameObjects.Rectangle;
  const body = ball.body as Phaser.Physics.Arcade.Body;
  const offset = Phaser.Math.Clamp((ball.x - this.paddle.x) / (this.paddle.width / 2), -1, 1);
  const angle = offset * MAX_BOUNCE_ANGLE - Math.PI / 2;
  const speed = body.velocity.length();
  body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
}
```

Mistura física automática com controle manual no momento certo. Esse padrão (`engine resolve, eu ajusto`) é muito comum.

### 5. Dados de fase como dados (não código)

Cada fase é uma string ASCII:

```ts
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
  // ...
];
```

`B` = tijolo normal (1 hit). `H` = duro (2 hits). `I` = indestrutível. `.` = vazio.

O método `buildLevel()` interpreta:

```ts
for (let r = 0; r < this.level.rows.length; r++) {
  const row = this.level.rows[r];
  for (let c = 0; c < row.length; c++) {
    const ch = row[c];
    if (ch === ".") continue;
    const def = this.level.legend[ch];
    // ... cria o tijolo
  }
}
```

**Por que isso importa:** designers podem criar fases sem tocar em código. Você poderia carregar de um JSON externo, de um servidor, ou ter um editor visual. O código fica burro, a fase fica esperta.

Em projetos sérios isso vira **tilemap** (formato Tiled), que o Phaser carrega diretamente. Aqui o "tilemap" é uma string ASCII inline — versão didática.

### 6. Power-ups com física + estado temporal

Quando um tijolo é destruído, **18% de chance** de spawnar um power-up que cai:

```ts
const container = this.add.rectangle(x, y, 28, 18, ...);
this.physics.add.existing(container);
container.body.setVelocityY(POWERUP_FALL_SPEED);  // cai constante
```

Quando o paddle pega:

```ts
this.physics.add.overlap(this.powerups, this.paddle, (paddleObj, powerupObj) => {
  const type = powerupObj.getData("type");
  this.applyPowerup(type);
  powerupObj.destroy();
});
```

Efeitos:
- **W** (Wide) — paddle 50% maior por 8s
- **S** (Slow) — bola 30% mais lenta por 8s
- **M** (Multi) — spawna 2 bolas extra (sem expirar)
- **+** (Life) — +1 vida (instantâneo)

Os timed expiram em `update()`:

```ts
if (this.wideEndAt > 0 && now >= this.wideEndAt) {
  this.paddle.setSize(PADDLE_W, PADDLE_H);
  this.wideEndAt = 0;
}
```

Padrão **"end at" instead of "remaining time"** — mais simples: guardo o `time.now` em que expira, no `update` comparo com `now`. Não precisa decrementar nada.

### 7. Textura procedural via `generateTexture()`

Pra ter um efeito de partículas quando tijolo quebra, preciso de uma **textura**. Não quis carregar PNG externo (#05 vai introduzir asset loading "de verdade"). Solução: **gero a textura procedurally**:

```ts
preload() {
  const g = this.add.graphics();
  g.fillStyle(COLOR_HEX.accent, 1);
  g.fillRect(0, 0, 4, 4);
  g.generateTexture("particle", 4, 4);
  g.destroy();
}
```

Desenho num `Graphics`, chamo `generateTexture(key, w, h)` que cria uma textura nomeada no cache do Phaser. Depois uso a key normalmente:

```ts
this.particles = this.add.particles(0, 0, "particle", {
  speed: { min: 60, max: 180 },
  lifespan: 380,
  scale: { start: 1, end: 0 },
  blendMode: "ADD",
  emitting: false,
});

// quando tijolo quebra:
this.particles.emitParticleAt(brick.x, brick.y, 10);
```

`generateTexture` é uma técnica útil pra prototipar, gerar tiles dinâmicos, criar variações por código (cor diferente por inimigo, etc.).

### 8. Bola não bate no chão (custom world bounds)

Por padrão, `setCollideWorldBounds(true)` faz a bola bater nos 4 lados. Mas Breakout precisa que a bola caia se o paddle não pegar:

```ts
this.physics.world.checkCollision.down = false;
```

Só essa linha. A bola continua colidindo com top/left/right, mas atravessa o bottom. Eu detecto manualmente em `update()`:

```ts
if (ball.y > HEIGHT + BALL_SIZE) {
  ball.destroy();
}
```

E aí se acabou todas as bolas → perdeu vida.

## Estrutura

```
src/
├── main.ts                   # bootstrap async + config Phaser com physics arcade
├── theme.ts                  # idêntico aos outros projetos
├── audio.ts / screenshot.ts / ui.ts  # idem
└── scenes/
    ├── MenuScene.ts          # 2 modos: Campanha / Modo Livre
    └── BreakoutScene.ts      # toda a lógica + LEVELS inline
```

## Campanha

| Fase | Layout | Difer. | Bola |
|------|--------|--------|------|
| 1 | 8×3 grid simples | só normais | 320 |
| 2 | 10×4 alternado | + duros (2 hits) | 340 |
| 3 | Diamante | só normais (formato testa puntaria) | 360 |
| 4 | Frame + indestrutíveis | layout protegendo o core | 380 |
| 5 | Fortaleza | tudo combinado | 420 |

## Conceitos consolidados

| Conceito | Aplicação |
|----------|-----------|
| Arcade Physics | `physics.add.existing`, `body.setBounce` |
| Static groups | `physics.add.staticGroup()` pra tijolos |
| Collider vs Overlap | Collider separa; overlap só notifica |
| `getData/setData` | Estado por GameObject sem subclasse |
| Reflexão custom | Sobrescrever `velocity` no callback |
| Level data ASCII | String → grid de tijolos |
| Power-ups timed | "endAt" em vez de timer decrescente |
| `generateTexture` | Textura procedural em `preload` |
| World bounds parciais | `checkCollision.down = false` |

## Desafios

1. **Mais power-ups:** sticky paddle (bola gruda ao tocar, espaço relança), laser (paddle atira lasers que destroem tijolos).
2. **Boss fase 5:** um tijolo grande no centro que se move e exige 10 hits.
3. **High score por fase:** salvar melhor pontuação por fase em localStorage.
4. **Bola fica mais rápida** a cada hit em tijolo (aceleração contínua).
5. **Editor de fases:** página HTML separada onde você clica numa grade e exporta uma string ASCII pra colar em LEVELS.

## Próximo

**05 — Asteroids:** vetores, rotação, **primeiros assets PNG de verdade** (nave sprite atlas), sistema de cenas múltiplas (menu → jogo → game over como cenas separadas), áudio com .wav, partículas pesadas.
