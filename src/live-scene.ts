import { tableSerif } from "./fonts";
import Phaser from "phaser";
import { createTextures, ensureCardTexture } from "./textures";
import { type Preferences } from "./preferences";
import { AudioFeedback } from "./audio";
import { type Observation } from "./core/poker";
import { type Card } from "./core/cards";

const serif = tableSerif;
export const seatPositions = [
  { x: 210, y: 420 },
  { x: 53, y: 330 },
  { x: 53, y: 140 },
  { x: 210, y: 47 },
  { x: 367, y: 140 },
  { x: 367, y: 330 },
];
const sects = ["修行者", "磐石宗", "长春谷", "云隐宗", "千机阁", "清霄门"];
type SpriteCard = Phaser.GameObjects.Container & { shown?: Card };
export class LiveScene extends Phaser.Scene {
  readonly feedback = new AudioFeedback();
  private view: Observation | null = null;
  private hands: SpriteCard[][] = [];
  private board: SpriteCard[] = [];
  private nameLabels: Phaser.GameObjects.Text[] = [];
  private stackLabels: Phaser.GameObjects.Text[] = [];
  private actionLabels: Phaser.GameObjects.Text[] = [];
  private avatars: Phaser.GameObjects.Image[] = [];
  private pot!: Phaser.GameObjects.Text;
  private center!: Phaser.GameObjects.Text;
  private winner!: Phaser.GameObjects.Text;
  private ring!: Phaser.GameObjects.Graphics;
  private button!: Phaser.GameObjects.Container;
  private heroLifted = false;
  private motes: Phaser.GameObjects.Image[] = [];
  private selected = false;
  private samples: number[] = [];
  private lastTime = 0;
  private frames = 0;

  constructor(
    public preferences: Preferences,
    private hooks: {
      ready: () => void;
      metrics: (fps: number, p95: number) => void;
    },
  ) {
    super("live-table");
  }

  create() {
    this.cameras.main.setZoom(2).setScroll(-210, -250);
    createTextures(this);
    this.add.image(210, 250, "table").setDisplaySize(360, 430);
    const ornament = this.add.graphics().lineStyle(1, 0xd8bd80, 0.1);
    ornament.strokeCircle(210, 251, 61);
    ornament.strokeCircle(210, 251, 67);
    this.add
      .text(210, 300, "以 牌 入 道 · 以 心 观 局", {
        fontFamily: serif,
        fontSize: "9px",
        color: "#9dad8c",
      })
      .setOrigin(0.5)
      .setAlpha(0.3);
    this.add
      .text(210, 163, "灵 石 池", {
        fontFamily: serif,
        fontSize: "10px",
        color: "#a7ba9d",
      })
      .setOrigin(0.5);
    this.pot = this.add
      .text(210, 188, "—", {
        fontFamily: "Georgia,serif",
        fontSize: "25px",
        color: "#d7bd87",
      })
      .setOrigin(0.5);
    this.center = this.add
      .text(210, 245, "静 心 入 局", {
        fontFamily: serif,
        fontSize: "22px",
        color: "#d5c49e",
      })
      .setOrigin(0.5);
    this.winner = this.add
      .text(210, 329, "", {
        fontFamily: serif,
        fontSize: "14px",
        color: "#eed295",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(35);
    seatPositions.forEach((position, i) => {
      if (i > 0)
        this.avatars[i] = this.add
          .image(position.x, position.y, `avatar-${i - 1}`)
          .setDisplaySize(50, 50);
      this.nameLabels[i] = this.add
        .text(
          position.x,
          position.y + (i === 0 ? 60 : 33),
          ["你 · 炼气初境", "顾长风", "苏照月", "沈听澜", "陆知微", "江临雪"][
            i
          ],
          {
            fontFamily: serif,
            fontSize: i === 0 ? "12px" : "13px",
            color: "#d8d8c6",
          },
        )
        .setOrigin(0.5);
      this.stackLabels[i] = this.add
        .text(
          position.x,
          position.y + (i === 0 ? 77 : -34),
          i === 0 ? "1,000 灵石" : sects[i],
          {
            fontFamily: i === 0 ? "Georgia,serif" : serif,
            fontSize: "11px",
            color: "#a1b395",
          },
        )
        .setOrigin(0.5);
      this.actionLabels[i] = this.add
        .text(position.x, position.y + 89, "", {
          fontFamily: serif,
          fontSize: "11px",
          color: "#ddc388",
          backgroundColor: "#172e24",
          padding: { x: 4, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(32)
        .setVisible(false);
    });
    this.ring = this.add.graphics().setDepth(5);
    const disc = this.add
      .circle(0, 0, 8, 0xd4bc83)
      .setStrokeStyle(1, 0xf3daa2, 0.5);
    const mark = this.add
      .text(0, 0, "庄", {
        fontFamily: serif,
        fontSize: "9px",
        color: "#293c30",
      })
      .setOrigin(0.5);
    this.button = this.add.container(244, 63, [disc, mark]).setDepth(34);
    for (let i = 0; i < 12; i++)
      this.motes.push(
        this.add
          .image(65 + ((i * 61) % 290), 65 + ((i * 43) % 380), "mote")
          .setDisplaySize(5 + (i % 3) * 2, 5 + (i % 3) * 2)
          .setAlpha(0.16),
      );
    this.children.list.forEach((object) => {
      if (object instanceof Phaser.GameObjects.Text) object.setResolution(2);
    });
    this.applyPreferences();
    this.game.events.on(
      Phaser.Core.Events.HIDDEN,
      this.resetFrameSamples,
      this,
    );
    this.game.events.on(
      Phaser.Core.Events.VISIBLE,
      this.resetFrameSamples,
      this,
    );
    this.scale.on(Phaser.Scale.Events.RESIZE, this.refreshTypography, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.refreshTypography, this);
      this.game.events.off(
        Phaser.Core.Events.HIDDEN,
        this.resetFrameSamples,
        this,
      );
      this.game.events.off(
        Phaser.Core.Events.VISIBLE,
        this.resetFrameSamples,
        this,
      );
    });
    this.refreshTypography();
    this.hooks.ready();
  }

  private resetFrameSamples() {
    this.lastTime = 0;
    this.samples = [];
  }

  private refreshTypography() {
    // Keep labels legible when a short phone gives the canvas less vertical space.
    const ratio = Math.max(
      0.5,
      this.game.canvas.getBoundingClientRect().width / 420,
    );
    this.nameLabels.forEach((label) =>
      label.setFontSize(Math.min(18, Math.max(13, 11 / ratio))),
    );
    this.stackLabels.forEach((label, i) =>
      label
        .setVisible(i !== 0)
        .setFontSize(Math.min(16, Math.max(11, 10 / ratio))),
    );
    this.actionLabels.forEach((label) =>
      label.setFontSize(Math.min(15, Math.max(11, 10 / ratio))),
    );
  }

  update(_time: number, delta: number) {
    const now = performance.now();
    if (!document.hidden && this.lastTime) {
      this.samples.push(now - this.lastTime);
      if (this.samples.length > 600) this.samples.shift();
    }
    this.lastTime = now;
    if (++this.frames % 60 === 0 && this.samples.length >= 60) {
      const sorted = [...this.samples].sort((a, b) => a - b);
      this.hooks.metrics(
        1000 / (this.samples.reduce((a, b) => a + b, 0) / this.samples.length),
        sorted[Math.floor(sorted.length * 0.95)],
      );
    }
    if (!this.preferences.reducedMotion)
      this.motes.forEach((m, i) => {
        if (m.visible) {
          m.y -= Math.min(delta, 50) * (0.003 + (i % 3) * 0.002);
          if (m.y < 60) m.y = 460;
        }
      });
  }

  applyPreferences() {
    this.feedback.enabled = this.preferences.sound;
    this.motes.forEach((m, i) =>
      m.setVisible(
        !this.preferences.reducedMotion &&
          (this.preferences.quality === "fine" || i < 4),
      ),
    );
  }
  private async tween(
    targets: object | object[],
    props: Record<string, unknown>,
    duration = 300,
    delay = 0,
  ) {
    if (Array.isArray(targets) && !targets.length) return;
    await new Promise<void>((resolve) =>
      this.tweens.add({
        targets,
        ...props,
        duration: this.preferences.reducedMotion
          ? Math.min(duration, 40)
          : duration,
        delay: this.preferences.reducedMotion ? 0 : delay,
        ease: "Cubic.Out",
        onComplete: () => resolve(),
        onStop: () => resolve(),
      }),
    );
  }
  private card(x: number, y: number, scale: number): SpriteCard {
    return this.add
      .container(x, y, [this.add.image(0, 0, "back").setDisplaySize(88, 126)])
      .setScale(scale)
      .setSize(88, 126) as SpriteCard;
  }
  private async flip(
    sprite: SpriteCard,
    card: Card,
    animated: boolean,
    delay = 0,
  ) {
    if (sprite.shown === card) return;
    const scale = sprite.scaleY;
    if (animated) await this.tween(sprite, { scaleX: 0.02 }, 130, delay);
    (sprite.first as Phaser.GameObjects.Image)
      .setTexture(ensureCardTexture(this, card))
      .setDisplaySize(88, 126);
    sprite.shown = card;
    if (animated) {
      this.feedback.play("card");
      await this.tween(sprite, { scaleX: scale }, 190);
    } else sprite.scaleX = scale;
  }

  setSelectable(value: boolean) {
    this.selected = value;
  }
  liftHand() {
    if (!this.selected || !this.hands[0]?.length) return;
    this.heroLifted = !this.heroLifted;
    this.feedback.unlock();
    this.feedback.play("card");
    this.hands[0].forEach((card, i) => {
      this.tweens.killTweensOf(card);
      void this.tween(
        card,
        {
          y: this.heroLifted ? 403 : 420,
          scale: this.heroLifted ? 0.86 : 0.78,
          angle: (i === 0 ? -1 : 1) * (this.heroLifted ? 2 : 5),
        },
        180,
      );
    });
  }

  async present(view: Observation, animated = true) {
    const previous = this.view;
    const newHand = !previous || previous.handNumber !== view.handNumber;
    if (newHand) {
      this.tweens.killAll();
      this.hands.flat().forEach((c) => c.destroy());
      this.board.forEach((c) => c.destroy());
      this.hands = [];
      this.board = [];
      this.heroLifted = false;
      this.winner.setText("");
      this.center.setVisible(false);
      const flights: Promise<void>[] = [];
      view.players.forEach((p, seat) => {
        this.hands[seat] = [];
        if (p.startingStack === 0) return;
        for (let j = 0; j < 2; j++) {
          const pos = seatPositions[seat],
            target = {
              x: pos.x + (seat === 0 ? (j === 0 ? -33 : 33) : j === 0 ? -8 : 8),
              y: seat === 0 ? 420 : pos.y + 68,
              scale: seat === 0 ? 0.78 : 0.22,
              angle: (j === 0 ? -1 : 1) * (seat === 0 ? 5 : 10),
              alpha: 1,
            };
          const card = this.card(
            animated ? 210 : target.x,
            animated ? 90 : target.y,
            animated ? 0.2 : target.scale,
          ).setDepth(seat === 0 ? 22 : 12);
          this.hands[seat].push(card);
          if (animated) {
            card.setAlpha(0);
            flights.push(this.tween(card, target, 370, (j * 6 + seat) * 40));
          } else card.setAngle(target.angle);
          if (seat === 0)
            card
              .setInteractive({ useHandCursor: true })
              .on("pointerdown", () => this.liftHand());
        }
      });
      if (animated) this.feedback.play("card");
      await Promise.all(flights);
    }
    // Animate only public contribution deltas; no rules live inside animation callbacks.
    if (previous && !newHand) {
      const paying = view.players.flatMap((p, i) =>
        p.totalBet > previous.players[i].totalBet ? [i] : [],
      );
      await Promise.all(
        paying.map((i) =>
          this.moveChips(seatPositions[i], { x: 210, y: 203 }, animated),
        ),
      );
    }
    await Promise.all(
      view.players.flatMap((p, seat) =>
        (p.hole || []).map((card, i) =>
          this.flip(this.hands[seat][i], card, animated, i * 60),
        ),
      ),
    );
    const incoming = view.board.slice(this.board.length);
    await Promise.all(
      incoming.map(async (card, i) => {
        const index = this.board.length; // Array slots are reserved synchronously before the first await.
        const sprite = this.card(
          animated ? 210 : 96 + index * 57,
          animated ? 95 : 254,
          animated ? 0.24 : 0.61,
        ).setDepth(20);
        this.board.push(sprite);
        if (animated)
          await this.tween(
            sprite,
            { x: 96 + index * 57, y: 254, scale: 0.61 },
            350,
            i * 85,
          );
        await this.flip(sprite, card, animated, i * 60);
      }),
    );
    view.players.forEach((p, i) => {
      this.nameLabels[i].setText(i === 0 ? "你 · 修行者" : p.name);
      this.stackLabels[i].setText(
        `${p.stack.toLocaleString()}${i === 0 ? " 灵石" : ""}`,
      );
      this.actionLabels[i]
        .setText(
          p.lastAction.replace("全下跟注", "全下").replace("加注至", "加至"),
        )
        .setVisible(i !== 0 && !!p.lastAction);
      this.avatars[i]?.setAlpha(p.folded ? 0.4 : 1);
      this.hands[i]?.forEach((card) => card.setAlpha(p.folded ? 0.25 : 1));
    });
    this.pot.setText(
      view.pot
        ? view.pot.toLocaleString()
        : view.result
          ? view.result.total.toLocaleString()
          : "—",
    );
    this.ring.clear();
    if (view.actor !== null) {
      const pos = seatPositions[view.actor];
      this.ring.lineStyle(1.5, 0xd8bd80, 0.8);
      if (view.actor === 0) this.ring.strokeRoundedRect(132, 365, 156, 108, 10);
      else this.ring.strokeCircle(pos.x, pos.y, 28);
    }
    const dealer = seatPositions[view.dealer];
    this.button.setPosition(
      dealer.x + (view.dealer === 0 ? 85 : 32),
      dealer.y + 14,
    );
    if (view.result) {
      const winners = view.result.payouts.flatMap((n, i) =>
        n > view.players[i].totalBet ? [i] : [],
      );
      this.winner.setText(
        winners.includes(0)
          ? "灵石归位 · 心境自明"
          : winners.length
            ? `${view.players[winners[0]].name} 得胜`
            : "平分底池 · 各有所得",
      );
      if (previous && !previous.result && animated) {
        this.feedback.play(winners.includes(0) ? "win" : "chip");
        await Promise.all(
          winners.map((i) =>
            this.moveChips({ x: 210, y: 203 }, seatPositions[i], true),
          ),
        );
      }
    }
    this.view = view;
  }

  private async moveChips(
    from: { x: number; y: number },
    to: { x: number; y: number },
    animated: boolean,
  ) {
    if (!animated) return;
    const chips = Array.from({ length: 4 }, (_, i) =>
      this.add
        .image(from.x + i * 2, from.y - i * 2, "chip")
        .setDisplaySize(18, 18)
        .setDepth(40),
    );
    this.feedback.play("chip");
    await Promise.all(
      chips.map((chip, i) =>
        this.tween(
          chip,
          { x: to.x + (i % 2) * 4, y: to.y - i * 2, angle: 120, alpha: 0.2 },
          300,
          i * 30,
        ),
      ),
    );
    chips.forEach((chip) => chip.destroy());
  }
}
