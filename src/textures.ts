import Phaser from "phaser";
import { rankOf, rankText, suitOf, suits, type Card } from "./core/cards";

const serif = '"Songti SC", "Noto Serif CJK SC", "STSong", serif';

function make(
  scene: Phaser.Scene,
  name: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  const texture = scene.textures.createCanvas(name, width * 2, height * 2)!;
  const ctx = texture.context;
  ctx.scale(2, 2);
  draw(ctx);
  texture.refresh();
}

function round(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Build only faces actually seen by this player, then reuse them across hands. */
export function ensureCardTexture(scene: Phaser.Scene, card: Card): string {
  const key = `card-${card}`;
  if (scene.textures.exists(key)) return key;
  const rank = rankText(rankOf(card)),
    suit = suits[suitOf(card)];
  make(scene, key, 88, 126, (ctx) => {
    ctx.save();
    ctx.shadowColor = "#0006";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;
    const paper = ctx.createLinearGradient(0, 0, 88, 126);
    paper.addColorStop(0, "#fffbed");
    paper.addColorStop(0.5, "#f3ecd8");
    paper.addColorStop(1, "#ded3b6");
    ctx.fillStyle = paper;
    round(ctx, 4, 3, 80, 116, 7);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "#e9d5a0";
    ctx.lineWidth = 1;
    round(ctx, 5, 4, 78, 114, 6);
    ctx.stroke();
    ctx.strokeStyle = "#9d87552a";
    round(ctx, 9, 8, 70, 106, 3);
    ctx.stroke();
    ctx.strokeStyle = "#9d875512";
    for (let y = 14; y < 112; y += 4) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(78, y);
      ctx.stroke();
    }
    ctx.fillStyle = suit === "♠" || suit === "♣" ? "#253d36" : "#a8443a";
    ctx.textAlign = "center";
    const corner = () => {
      ctx.font = `bold ${rank === "10" ? 20 : 23}px Georgia, serif`;
      ctx.fillText(rank, 20, 30);
      ctx.font = "17px Georgia, serif";
      ctx.fillText(suit, 20, 48);
    };
    corner();
    ctx.save();
    ctx.translate(88, 122);
    ctx.rotate(Math.PI);
    corner();
    ctx.restore();
    ctx.strokeStyle = "#b69a6040";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(44, 62, 21, 27, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = "42px Georgia, serif";
    ctx.fillText(suit, 44, 76);
    ctx.fillStyle = "#ad956543";
    ctx.font = `7px ${serif}`;
    ctx.fillText("问 道", 44, 103);
  });
  return key;
}

export function createTextures(scene: Phaser.Scene) {
  make(scene, "table", 360, 460, (ctx) => {
    const surface = ctx.createRadialGradient(180, 160, 10, 180, 230, 240);
    surface.addColorStop(0, "#22443d");
    surface.addColorStop(0.65, "#15352f");
    surface.addColorStop(1, "#0d2422");
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#0008";
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#0e2221";
    ctx.beginPath();
    ctx.ellipse(180, 230, 158, 207, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = surface;
    ctx.beginPath();
    ctx.ellipse(180, 230, 150, 199, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 460; i += 3) {
      ctx.strokeStyle = i % 9 === 0 ? "#b7c2a106" : "#00000009";
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(360, i);
      ctx.stroke();
    }
    // Delicate geometric cloud pattern, baked once into the table texture.
    ctx.strokeStyle = "#9dc1a80b";
    ctx.lineWidth = 0.6;
    for (let row = 0; row < 16; row++)
      for (let col = 0; col < 12; col++) {
        ctx.beginPath();
        ctx.arc(col * 34 + (row % 2) * 17, row * 32, 13, Math.PI, Math.PI * 2);
        ctx.stroke();
      }
    ctx.restore();
    [154, 149, 142].forEach((rx, i) => {
      ctx.lineWidth = i === 0 ? 2 : 0.7;
      ctx.strokeStyle = ["#b99b5d77", "#d2b87666", "#b99b5d25"][i];
      ctx.beginPath();
      ctx.ellipse(180, 230, rx, rx + 49, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.strokeStyle = "#d0b47720";
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(180 + Math.cos(a) * 128, 230 + Math.sin(a) * 177);
      ctx.lineTo(180 + Math.cos(a) * 132, 230 + Math.sin(a) * 181);
      ctx.stroke();
    }
  });

  make(scene, "back", 88, 126, (ctx) => {
    ctx.save();
    ctx.shadowColor = "#0007";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;
    const gradient = ctx.createLinearGradient(0, 0, 88, 126);
    gradient.addColorStop(0, "#42554a");
    gradient.addColorStop(0.55, "#193a34");
    gradient.addColorStop(1, "#28453b");
    ctx.fillStyle = gradient;
    round(ctx, 4, 3, 80, 116, 7);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "#d0b479";
    ctx.lineWidth = 0.8;
    round(ctx, 7, 6, 74, 110, 5);
    ctx.stroke();
    ctx.strokeStyle = "#bca46b55";
    round(ctx, 11, 10, 66, 102, 3);
    ctx.stroke();
    ctx.save();
    round(ctx, 13, 12, 62, 98, 2);
    ctx.clip();
    ctx.strokeStyle = "#bfa56b18";
    ctx.lineWidth = 0.8;
    for (let j = -100; j < 130; j += 10) {
      ctx.beginPath();
      ctx.moveTo(j, 0);
      ctx.lineTo(j + 126, 126);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(j + 126, 0);
      ctx.lineTo(j, 126);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "#24463d";
    ctx.beginPath();
    ctx.ellipse(44, 62, 22, 31, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d0b479aa";
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(44, 62, 18, 26, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#e3cb95";
    ctx.font = `26px ${serif}`;
    ctx.textAlign = "center";
    ctx.fillText("道", 44, 71);
    [19, 104].forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(44, y - 4);
      ctx.lineTo(48, y);
      ctx.lineTo(44, y + 4);
      ctx.closePath();
      ctx.fill();
    });
  });

  const cards = [
    ["A", "♥"],
    ["K", "♥"],
    ["Q", "♥"],
    ["7", "♣"],
    ["2", "♦"],
    ["J", "♥"],
    ["10", "♥"],
  ];
  cards.forEach(([rank, suit], index) =>
    make(scene, `face-${index}`, 88, 126, (ctx) => {
      ctx.save();
      ctx.shadowColor = "#0006";
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 3;
      const paper = ctx.createLinearGradient(0, 0, 88, 126);
      paper.addColorStop(0, "#fffbee");
      paper.addColorStop(0.5, "#f3ecd8");
      paper.addColorStop(1, "#ded3b6");
      ctx.fillStyle = paper;
      round(ctx, 4, 3, 80, 116, 7);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "#e9d5a0";
      ctx.lineWidth = 1;
      round(ctx, 5, 4, 78, 114, 6);
      ctx.stroke();
      ctx.strokeStyle = "#9d87552a";
      round(ctx, 9, 8, 70, 106, 3);
      ctx.stroke();
      ctx.strokeStyle = "#9d875512";
      for (let y = 14; y < 112; y += 4) {
        ctx.beginPath();
        ctx.moveTo(10, y);
        ctx.lineTo(78, y);
        ctx.stroke();
      }
      const ink = suit === "♣" ? "#253d36" : "#a8443a";
      ctx.fillStyle = ink;
      ctx.textAlign = "center";
      ctx.font = `bold ${rank === "10" ? 20 : 23}px Georgia, serif`;
      ctx.fillText(rank, 20, 30);
      ctx.font = "17px Georgia, serif";
      ctx.fillText(suit, 20, 48);
      ctx.save();
      ctx.translate(88, 122);
      ctx.rotate(Math.PI);
      ctx.font = `bold ${rank === "10" ? 20 : 23}px Georgia, serif`;
      ctx.fillText(rank, 20, 30);
      ctx.font = "17px Georgia, serif";
      ctx.fillText(suit, 20, 48);
      ctx.restore();
      ctx.strokeStyle = "#b69a6040";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.ellipse(44, 62, 21, 27, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "42px Georgia, serif";
      ctx.fillText(suit, 44, 76);
      ctx.fillStyle = "#ad956543";
      ctx.font = `7px ${serif}`;
      ctx.fillText("问 道", 44, 103);
    }),
  );

  make(scene, "chip", 24, 24, (ctx) => {
    const gradient = ctx.createRadialGradient(9, 7, 1, 12, 12, 11);
    gradient.addColorStop(0, "#f1d593");
    gradient.addColorStop(0.7, "#bc9650");
    gradient.addColorStop(1, "#6c562f");
    ctx.fillStyle = "#514327";
    ctx.beginPath();
    ctx.ellipse(12, 14, 10, 8, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(12, 11, 10, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "#f4dc9c";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(12, 11, 7.5, 0, 7);
    ctx.stroke();
    ctx.fillStyle = "#72592f";
    ctx.fillRect(9.5, 8.5, 5, 5);
  });

  make(scene, "mote", 32, 32, (ctx) => {
    const glow = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    glow.addColorStop(0, "#fff2be");
    glow.addColorStop(0.15, "#e0c67bcc");
    glow.addColorStop(1, "#e0c67b00");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 32, 32);
  });

  const colors = [
    ["#536d6b", "#abc3b5"],
    ["#765d4b", "#ccae86"],
    ["#526d59", "#b4cba6"],
    ["#625873", "#c1b4d0"],
    ["#526b7b", "#aac3ce"],
  ];
  colors.forEach(([bg, robe], index) =>
    make(scene, `avatar-${index}`, 70, 70, (ctx) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(35, 35, 31, 0, 7);
      ctx.clip();
      const ink = ctx.createLinearGradient(0, 0, 70, 70);
      ink.addColorStop(0, bg);
      ink.addColorStop(1, "#152624");
      ctx.fillStyle = ink;
      ctx.fillRect(0, 0, 70, 70);
      ctx.strokeStyle = `${robe}30`;
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 44 + i * 6);
        ctx.lineTo(16, 24 + i * 5);
        ctx.lineTo(43, 46 + i * 6);
        ctx.lineTo(57, 30 + i * 8);
        ctx.lineTo(70, 46 + i * 6);
        ctx.stroke();
      }
      ctx.fillStyle = "#102321";
      ctx.beginPath();
      ctx.ellipse(36, 31, 13, 19, -0.1, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(35, 14, 6, 6, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#c1b49b";
      ctx.beginPath();
      ctx.ellipse(35, 30, 8, 11, -0.1, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#182b28";
      ctx.beginPath();
      ctx.moveTo(24, 27);
      ctx.quadraticCurveTo(27, 10, 42, 19);
      ctx.lineTo(46, 34);
      ctx.quadraticCurveTo(40, 27, 36, 20);
      ctx.quadraticCurveTo(30, 27, 24, 27);
      ctx.fill();
      ctx.fillStyle = robe;
      ctx.beginPath();
      ctx.moveTo(30, 40);
      ctx.lineTo(14, 49);
      ctx.lineTo(7, 70);
      ctx.lineTo(64, 70);
      ctx.lineTo(55, 49);
      ctx.lineTo(41, 40);
      ctx.lineTo(35, 52);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = bg;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(29, 42);
      ctx.lineTo(40, 59);
      ctx.lineTo(39, 70);
      ctx.moveTo(41, 42);
      ctx.lineTo(31, 57);
      ctx.stroke();
      ctx.strokeStyle = "#dec48a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(25, 15);
      ctx.lineTo(47, 11);
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = "#cab38377";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(35, 35, 32, 0, 7);
      ctx.stroke();
    }),
  );
}
