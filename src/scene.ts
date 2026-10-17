import Phaser from "phaser";
import { stages, type Preferences } from "./demo";
import { AudioFeedback } from "./audio";
import { createTextures } from "./textures";

type Card = Phaser.GameObjects.Container & {
  faceIndex?: number;
  revealed?: boolean;
};
type Hooks = {
  state: (stage: number, busy: boolean) => void;
  metrics: (fps: number, p95: number) => void;
  ready: () => void;
};
const gold = "#d7bd87";
const serif = '"Songti SC", "STSong", serif';
const seats = [
  { x: 210, y: 53, name: "沈听澜", sect: "云隐宗" },
  { x: 53, y: 163, name: "顾长风", sect: "磐石宗" },
  { x: 367, y: 163, name: "苏照月", sect: "长春谷" },
  { x: 53, y: 349, name: "陆知微", sect: "千机阁" },
  { x: 367, y: 349, name: "江临雪", sect: "清霄门" },
];

export class TableScene extends Phaser.Scene {
  private stageIndex = 0;
  private busy = false;
  private generation = 0;
  private cards: Card[] = [];
  private hero: Card[] = [];
  private board: Card[] = [];
  private ephemeral: Phaser.GameObjects.GameObject[] = [];
  private motes: Phaser.GameObjects.Image[] = [];
  private heroLifted = false;
  private potText!: Phaser.GameObjects.Text;
  private centerTitle!: Phaser.GameObjects.Text;
  private centerSub!: Phaser.GameObjects.Text;
  private heroLabel!: Phaser.GameObjects.Text;
  private floatLabel!: Phaser.GameObjects.Text;
  private cue!: Phaser.GameObjects.Text;
  private samples: number[] = [];
  private frameCount = 0;
  private previousFrame = 0;
  readonly feedback = new AudioFeedback();

  constructor(
    public preferences: Preferences,
    private hooks: Hooks,
  ) {
    super("table");
  }

  create() {
    this.cameras.main.setZoom(2).setScroll(-210, -275);
    createTextures(this);
    this.add.image(210, 267, "table").setDisplaySize(360, 460);
    const decoration = this.add.graphics();
    decoration.lineStyle(1, 0xd8bd80, 0.1);
    decoration.strokeCircle(210, 277, 60);
    decoration.strokeCircle(210, 277, 67);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      decoration.lineBetween(
        210 + Math.cos(a) * 62,
        277 + Math.sin(a) * 62,
        210 + Math.cos(a) * 66,
        277 + Math.sin(a) * 66,
      );
    }
    this.add
      .text(210, 325, "以 牌 入 道 · 以 心 观 局", {
        fontFamily: serif,
        fontSize: "10px",
        color: "#9dad8c",
      })
      .setOrigin(0.5)
      .setAlpha(0.33);
    this.add
      .text(210, 179, "灵 石 池", {
        fontFamily: serif,
        fontSize: "10px",
        color: "#a7ba9d",
      })
      .setOrigin(0.5);
    this.potText = this.add
      .text(210, 204, "—", {
        fontFamily: "Georgia, serif",
        fontSize: "25px",
        color: gold,
      })
      .setOrigin(0.5);
    this.centerTitle = this.add
      .text(210, 263, "静 心 入 局", {
        fontFamily: serif,
        fontSize: "23px",
        color: "#d5c49e",
      })
      .setOrigin(0.5);
    this.centerSub = this.add
      .text(210, 291, "云隐试炼 · 第一章", {
        fontFamily: serif,
        fontSize: "10px",
        color: "#8fa997",
      })
      .setOrigin(0.5);
    seats.forEach((seat, index) => {
      this.add.image(seat.x, seat.y, `avatar-${index}`).setDisplaySize(57, 57);
      this.add
        .text(seat.x, seat.y + 38, seat.name, {
          fontFamily: serif,
          fontSize: "12px",
          color: "#d8d8c6",
        })
        .setOrigin(0.5);
      this.add
        .text(seat.x, seat.y - 39, seat.sect, {
          fontFamily: serif,
          fontSize: "9px",
          color: "#8eaa9a",
        })
        .setOrigin(0.5);
    });
    this.add.circle(242, 69, 8, 0xd4bc83).setStrokeStyle(1, 0xf3daa2, 0.5);
    this.add
      .text(242, 69, "庄", {
        fontFamily: serif,
        fontSize: "9px",
        color: "#293c30",
      })
      .setOrigin(0.5);
    this.heroLabel = this.add
      .text(210, 511, "你 · 炼气初境", {
        fontFamily: serif,
        fontSize: "13px",
        color: "#c4c9ac",
      })
      .setOrigin(0.5);
    this.add
      .text(210, 532, "修 行 者", {
        fontFamily: serif,
        fontSize: "8px",
        color: "#738f80",
      })
      .setOrigin(0.5);
    this.cue = this.add
      .text(210, 421, "你的第一手牌，始于此处", {
        fontFamily: serif,
        fontSize: "11px",
        color: "#88a38f",
      })
      .setOrigin(0.5);
    this.floatLabel = this.add
      .text(210, 369, "", {
        fontFamily: serif,
        fontSize: "20px",
        color: "#f0d597",
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0);
    for (let i = 0; i < 14; i++) {
      const mote = this.add
        .image(65 + ((i * 61) % 290), 90 + ((i * 43) % 380), "mote")
        .setDisplaySize(5 + (i % 3) * 2, 5 + (i % 3) * 2)
        .setAlpha(0.12 + (i % 4) * 0.06)
        .setDepth(0);
      this.motes.push(mote);
    }
    this.applyPreferences();
    this.children.list.forEach((object) => {
      if (object instanceof Phaser.GameObjects.Text) object.setResolution(2);
    });
    this.game.events.on(Phaser.Core.Events.VISIBLE, this.clearSamples, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.game.events.off(Phaser.Core.Events.VISIBLE, this.clearSamples, this),
    );
    this.hooks.state(0, false);
    this.hooks.ready();
  }

  private clearSamples() {
    this.previousFrame = 0;
    this.samples = [];
  }

  update(_time: number, delta: number) {
    const now = performance.now();
    if (
      !document.hidden &&
      this.previousFrame &&
      now - this.previousFrame < 1000
    ) {
      this.samples.push(now - this.previousFrame);
      if (this.samples.length > 600) this.samples.shift();
    }
    this.previousFrame = now;
    if (++this.frameCount % 60 === 0 && this.samples.length >= 60) {
      const sorted = [...this.samples].sort((a, b) => a - b);
      this.hooks.metrics(
        1000 / (this.samples.reduce((a, b) => a + b, 0) / this.samples.length),
        sorted[Math.floor(sorted.length * 0.95)],
      );
    }
    if (!this.preferences.reducedMotion)
      this.motes.forEach((mote, index) => {
        if (!mote.visible) return;
        mote.y -= Math.min(delta, 50) * (0.003 + (index % 3) * 0.002);
        if (mote.y < 70) mote.y = 470;
      });
  }

  applyPreferences() {
    this.feedback.enabled = this.preferences.sound;
    this.motes.forEach((mote, i) =>
      mote.setVisible(
        !this.preferences.reducedMotion &&
          (this.preferences.quality === "fine" || i < 5),
      ),
    );
  }

  private duration(ms: number) {
    return this.preferences.reducedMotion ? Math.min(ms, 60) : ms;
  }

  private animate(
    targets: object | object[],
    properties: Record<string, unknown>,
    duration = 400,
    delay = 0,
  ): Promise<void> {
    return new Promise((resolve) =>
      this.tweens.add({
        targets,
        ...properties,
        duration: this.duration(duration),
        delay: this.preferences.reducedMotion ? 0 : delay,
        ease: "Cubic.Out",
        onComplete: () => resolve(),
        onStop: () => resolve(),
      }),
    );
  }

  private makeCard(
    x: number,
    y: number,
    scale: number,
    faceIndex?: number,
  ): Card {
    const image = this.add.image(0, 0, "back").setDisplaySize(88, 126);
    const card = this.add.container(x, y, [image]).setScale(scale) as Card;
    card.faceIndex = faceIndex;
    card.setSize(88, 126);
    this.cards.push(card);
    return card;
  }

  private async flip(card: Card, delay = 0) {
    const token = this.generation;
    const scale = card.scaleY;
    await this.animate(
      card,
      { scaleX: 0.025, angle: card.angle * 0.4 },
      170,
      delay,
    );
    if (token !== this.generation || !card.active) return;
    (card.first as Phaser.GameObjects.Image)
      .setTexture(`face-${card.faceIndex}`)
      .setDisplaySize(88, 126);
    card.revealed = true;
    this.feedback.play("card");
    await this.animate(card, { scaleX: scale }, 230);
  }

  async advance() {
    if (this.busy) return;
    this.feedback.unlock();
    if (this.stageIndex === 5) {
      this.reset();
      return;
    }
    this.busy = true;
    this.hooks.state(this.stageIndex, true);
    const token = this.generation;
    try {
      if (this.stageIndex === 0) await this.deal();
      else if (this.stageIndex === 1) {
        await this.contribute(150);
        await this.revealBoard([2, 3, 4]);
      } else if (this.stageIndex === 2) {
        await this.contribute(270);
        await this.revealBoard([5]);
      } else if (this.stageIndex === 3) {
        await this.revealBoard([6]);
        await this.illuminate();
      } else await this.settle();
      if (token !== this.generation) return;
      this.stageIndex++;
      this.potText.setText(
        stages[this.stageIndex].pot
          ? stages[this.stageIndex].pot.toLocaleString()
          : "—",
      );
    } finally {
      if (token === this.generation) {
        this.busy = false;
        this.hooks.state(this.stageIndex, false);
      }
    }
  }

  private async deal() {
    this.cue.setVisible(false);
    await this.animate([this.centerTitle, this.centerSub], { alpha: 0 }, 180);
    const destinations = seats.map((seat) => ({ x: seat.x, y: seat.y + 64 }));
    const flights: Promise<void>[] = [];
    for (let pass = 0; pass < 2; pass++) {
      destinations.forEach((seat, i) => {
        const card = this.makeCard(210, 120, 0.22).setAlpha(0).setAngle(-25);
        flights.push(
          this.animate(
            card,
            {
              x: seat.x + (pass === 0 ? -8 : 8),
              y: seat.y,
              angle: pass === 0 ? -10 : 10,
              alpha: 0.85,
            },
            380,
            (pass * 6 + i) * 65,
          ),
        );
      });
      const card = this.makeCard(210, 120, 0.22, pass).setAlpha(0).setDepth(20);
      this.hero.push(card);
      flights.push(
        this.animate(
          card,
          {
            x: pass === 0 ? 176 : 244,
            y: 448,
            scale: 0.84,
            angle: pass === 0 ? -8 : 8,
            alpha: 1,
          },
          520,
          (pass * 6 + 5) * 65,
        ),
      );
    }
    this.feedback.play("card");
    await Promise.all(flights);
    await Promise.all(this.hero.map((card, i) => this.flip(card, i * 110)));
    this.hero.forEach((card) =>
      card
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.liftHand()),
    );
  }

  liftHand() {
    if (this.busy || !this.hero.length || this.stageIndex === 5) return;
    this.heroLifted = !this.heroLifted;
    this.feedback.unlock();
    this.feedback.play("card");
    this.hero.forEach((card, i) => {
      this.tweens.killTweensOf(card);
      void this.animate(
        card,
        {
          y: this.heroLifted ? 427 : 448,
          scale: this.heroLifted ? 0.94 : 0.84,
          angle: (i === 0 ? -1 : 1) * (this.heroLifted ? 3 : 3.2),
        },
        220,
      );
    });
  }

  private async contribute(pot: number) {
    const from = [
      { x: 210, y: 430 },
      { x: 53, y: 222 },
      { x: 367, y: 222 },
    ];
    const flights = from.flatMap((point, player) =>
      Array.from({ length: 5 }, (_, i) => {
        const chip = this.add
          .image(point.x + i * 2, point.y - i * 2, "chip")
          .setDisplaySize(19, 19)
          .setDepth(35)
          .setAlpha(0);
        this.ephemeral.push(chip);
        return this.animate(
          chip,
          {
            x: 205 + (i % 3) * 5,
            y: 222 - i * 2,
            alpha: 1,
            angle: 130 + i * 20,
          },
          480,
          player * 90 + i * 35,
        );
      }),
    );
    this.feedback.play("chip");
    await Promise.all(flights);
    await this.animate(this.ephemeral, { alpha: 0 }, 120);
    this.ephemeral.forEach((object) => object.destroy());
    this.ephemeral = [];
    const value = { amount: stages[this.stageIndex].pot as number };
    await this.animate(
      value,
      {
        amount: pot,
        onUpdate: () =>
          this.potText.setText(Math.round(value.amount).toLocaleString()),
      },
      250,
    );
  }

  private async revealBoard(indices: number[]) {
    const start = this.board.length;
    const incoming = indices.map((faceIndex, i) => {
      const card = this.makeCard(210, 130, 0.32, faceIndex)
        .setAlpha(0)
        .setDepth(15);
      this.board.push(card);
      return { card, i };
    });
    await Promise.all(
      incoming.map(({ card, i }) =>
        this.animate(
          card,
          { x: 96 + (start + i) * 57, y: 276, scale: 0.61, alpha: 1 },
          420,
          i * 100,
        ),
      ),
    );
    await Promise.all(incoming.map(({ card, i }) => this.flip(card, i * 100)));
  }

  private async illuminate() {
    const flash = this.add.graphics().setDepth(14);
    flash.lineStyle(1.5, 0xe4c780, 0.8);
    [
      this.hero[0],
      this.hero[1],
      this.board[0],
      this.board[3],
      this.board[4],
    ].forEach((card) => {
      const width = 80 * card.scaleX,
        height = 116 * card.scaleY;
      flash.strokeRoundedRect(
        card.x - width / 2 - 2,
        card.y - height / 2 - 2,
        width + 4,
        height + 4,
        7,
      );
    });
    flash.setAlpha(0);
    this.ephemeral.push(flash);
    await this.animate(flash, { alpha: 0.8 }, 450);
    await this.animate(flash, { alpha: 0 }, 650);
    flash.destroy();
    this.ephemeral = this.ephemeral.filter((item) => item !== flash);
  }

  private async settle() {
    this.floatLabel.setText("皇家同花顺").setY(362).setAlpha(0);
    this.feedback.play("win");
    await this.animate(this.floatLabel, { y: 352, alpha: 1 }, 500);
    const particles = this.preferences.reducedMotion
      ? 0
      : this.preferences.quality === "fine"
        ? 24
        : 10;
    const flights: Promise<void>[] = [];
    for (let i = 0; i < particles; i++) {
      const a = (i / particles) * Math.PI * 2;
      const mote = this.add
        .image(210, 354, "mote")
        .setDisplaySize(8, 8)
        .setDepth(40);
      this.ephemeral.push(mote);
      flights.push(
        this.animate(
          mote,
          {
            x: 210 + Math.cos(a) * (50 + (i % 4) * 15),
            y: 354 + Math.sin(a) * 55,
            alpha: 0,
          },
          850,
        ),
      );
    }
    for (let i = 0; i < 9; i++) {
      const chip = this.add
        .image(205 + (i % 3) * 5, 208 - i * 2, "chip")
        .setDisplaySize(19, 19)
        .setDepth(35);
      this.ephemeral.push(chip);
      flights.push(
        this.animate(
          chip,
          { x: 210 + (i % 3) * 3, y: 492, alpha: 0, angle: 180 },
          580,
          i * 35,
        ),
      );
    }
    await Promise.all(flights);
    this.ephemeral.forEach((object) => object.destroy());
    this.ephemeral = [];
    this.heroLabel.setText("演示完成 · 灵石归位");
  }

  reset() {
    if (this.busy) return;
    this.generation++;
    this.tweens.killAll();
    this.cards.forEach((card) => card.destroy());
    this.cards = [];
    this.hero = [];
    this.board = [];
    this.ephemeral.forEach((object) => object.destroy());
    this.ephemeral = [];
    this.stageIndex = 0;
    this.heroLifted = false;
    this.potText.setText("—");
    this.centerTitle.setAlpha(1);
    this.centerSub.setAlpha(1);
    this.cue.setVisible(true);
    this.floatLabel.setAlpha(0);
    this.heroLabel.setText("你 · 炼气初境");
    this.hooks.state(0, false);
  }
}
