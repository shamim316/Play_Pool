import type { Ball, Vec } from './types';
import {
  TABLE_W, TABLE_H, BALL_R, RAIL_W, HEAD_X, BALL_COLORS,
} from './constants';
import { POCKETS } from './table';
import { rayHit } from './physics';
import { norm, scale, sub, add, v } from './math';
import type { App } from './game';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private cw = 0;
  private ch = 0;
  scale = 1;
  private ox = 0;
  private oy = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cw = window.innerWidth;
    this.ch = window.innerHeight;
    this.canvas.width = Math.round(this.cw * dpr);
    this.canvas.height = Math.round(this.ch * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const mx = 24;
    const myTop = 60;
    const myBot = 84;
    const availW = this.cw - 2 * mx;
    const availH = this.ch - myTop - myBot;
    this.scale = Math.min(
      availW / (TABLE_W + 2 * RAIL_W),
      availH / (TABLE_H + 2 * RAIL_W)
    );
    this.ox = (this.cw - TABLE_W * this.scale) / 2;
    this.oy = myTop + (availH - TABLE_H * this.scale) / 2;
  }

  w2s(p: Vec): Vec {
    return v(this.ox + p.x * this.scale, this.oy + p.y * this.scale);
  }

  s2w(p: Vec): Vec {
    return v((p.x - this.ox) / this.scale, (p.y - this.oy) / this.scale);
  }

  render(app: App): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cw, this.ch);
    this.drawTable(app);
    if (app.screen === 'menu') return;

    const game = app.game;

    // kitchen highlight during ball-in-hand-behind-the-line
    if (game.ballInHand === 'kitchen' && game.current === 0 && !app.simRunning) {
      const a = this.w2s(v(0, 0));
      const b = this.w2s(v(HEAD_X, TABLE_H));
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }

    for (const b of game.balls) {
      if (b.inPlay) this.drawBall(b);
    }

    const showAim =
      !app.simRunning && game.winner === null &&
      (app.canHumanAim() || app.aiAiming);

    if (showAim) {
      if (app.canHumanAim()) this.drawGuide(app);
      this.drawCueStick(app);
    }

    if (game.ballInHand !== 'none' && game.current === 0 && !app.simRunning) {
      this.drawBallInHandRing(game.cue.pos);
    }
  }

  private drawTable(app: App): void {
    const ctx = this.ctx;
    const s = this.scale;
    const tl = this.w2s(v(0, 0));

    // wooden rail
    const rw = RAIL_W * s;
    roundRect(ctx, tl.x - rw, tl.y - rw, TABLE_W * s + 2 * rw, TABLE_H * s + 2 * rw, rw * 0.55);
    const wood = ctx.createLinearGradient(0, tl.y - rw, 0, tl.y + TABLE_H * s + rw);
    wood.addColorStop(0, '#7c4a22');
    wood.addColorStop(0.5, '#5f3617');
    wood.addColorStop(1, '#7c4a22');
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.strokeStyle = '#3a2009';
    ctx.lineWidth = 2;
    ctx.stroke();

    // cloth
    ctx.fillStyle = '#1e7b4d';
    ctx.fillRect(tl.x, tl.y, TABLE_W * s, TABLE_H * s);
    // subtle vignette
    const vg = ctx.createRadialGradient(
      tl.x + TABLE_W * s / 2, tl.y + TABLE_H * s / 2, TABLE_H * s * 0.3,
      tl.x + TABLE_W * s / 2, tl.y + TABLE_H * s / 2, TABLE_W * s * 0.7
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = vg;
    ctx.fillRect(tl.x, tl.y, TABLE_W * s, TABLE_H * s);

    // head string
    const hs = this.w2s(v(HEAD_X, 0));
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hs.x, tl.y);
    ctx.lineTo(hs.x, tl.y + TABLE_H * s);
    ctx.stroke();

    // pockets
    for (const pk of POCKETS) {
      const p = this.w2s(pk.pos);
      ctx.beginPath();
      ctx.arc(p.x, p.y, pk.r * s, 0, Math.PI * 2);
      const pg = ctx.createRadialGradient(p.x, p.y, pk.r * s * 0.2, p.x, p.y, pk.r * s);
      pg.addColorStop(0, '#000');
      pg.addColorStop(1, '#151515');
      ctx.fillStyle = pg;
      ctx.fill();
    }
    void app;
  }

  private drawBall(b: Ball): void {
    const ctx = this.ctx;
    const p = this.w2s(b.pos);
    const r = BALL_R * this.scale;
    const color = BALL_COLORS[b.id];
    const isStripe = b.id >= 9;

    // shadow
    ctx.beginPath();
    ctx.ellipse(p.x + r * 0.12, p.y + r * 0.22, r, r * 0.92, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // base
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = isStripe ? '#f4f0e4' : color;
    ctx.fill();

    if (isStripe) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = color;
      ctx.fillRect(p.x - r, p.y - r * 0.55, r * 2, r * 1.1);
      ctx.restore();
    }

    // number circle
    if (b.id > 0) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.52, 0, Math.PI * 2);
      ctx.fillStyle = '#f4f0e4';
      ctx.fill();
      if (r > 7) {
        ctx.fillStyle = '#222';
        ctx.font = `bold ${Math.max(7, r * 0.62)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(b.id), p.x, p.y + r * 0.04);
      }
    }

    // gloss
    const g = ctx.createRadialGradient(
      p.x - r * 0.35, p.y - r * 0.45, r * 0.05,
      p.x - r * 0.35, p.y - r * 0.45, r * 1.1
    );
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.15)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  private drawGuide(app: App): void {
    const ctx = this.ctx;
    const game = app.game;
    const cue = game.cue;
    const dir = v(Math.cos(app.aim.angle), Math.sin(app.aim.angle));
    const hit = rayHit(cue.pos, dir, game.balls, 0);
    const hitPoint = add(cue.pos, scale(dir, hit.t));

    const a = this.w2s(cue.pos);
    const b = this.w2s(hitPoint);
    ctx.save();
    ctx.setLineDash([6, 7]);
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // ghost ball at the point of contact
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R * this.scale, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (hit.ball) {
      // object ball direction
      const obDir = norm(sub(hit.ball.pos, hitPoint));
      const o1 = this.w2s(hit.ball.pos);
      const o2 = this.w2s(add(hit.ball.pos, scale(obDir, 0.28)));
      ctx.strokeStyle = 'rgba(255, 215, 94, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(o1.x, o1.y);
      ctx.lineTo(o2.x, o2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCueStick(app: App): void {
    const ctx = this.ctx;
    const cue = app.game.cue;
    const dir = v(Math.cos(app.aim.angle), Math.sin(app.aim.angle));
    const pull = 0.045 + app.aim.power * 0.16;
    const tip = sub(cue.pos, scale(dir, pull));
    const butt = sub(cue.pos, scale(dir, pull + 1.35));

    const a = this.w2s(tip);
    const b = this.w2s(butt);
    const lw = Math.max(3.5, BALL_R * this.scale * 0.55);

    ctx.save();
    ctx.lineCap = 'round';
    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grad.addColorStop(0, '#d8b07a');
    grad.addColorStop(0.15, '#a8703a');
    grad.addColorStop(1, '#5e3a1a');
    ctx.strokeStyle = grad;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    // tip
    ctx.strokeStyle = '#7fb8d8';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    const t2 = this.w2s(sub(tip, scale(dir, -0.02)));
    ctx.lineTo(t2.x, t2.y);
    ctx.stroke();
    ctx.restore();
  }

  private drawBallInHandRing(pos: Vec): void {
    const ctx = this.ctx;
    const p = this.w2s(pos);
    const r = BALL_R * this.scale;
    const pulse = 1.4 + Math.sin(performance.now() / 260) * 0.18;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 215, 94, 0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
