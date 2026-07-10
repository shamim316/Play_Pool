import type { Ball, Vec } from './types';
import {
  TABLE_W, TABLE_H, BALL_R, RAIL_W, HEAD_X, BALL_COLORS,
} from './constants';
import { POCKETS } from './table';
import { rayHit } from './physics';
import { norm, scale, sub, add, v } from './math';
import type { App } from './game';

/**
 * Draws the world. In portrait windows (phones) the table is rotated 90°
 * so it fills the screen; w2s/s2w hide the rotation from the input code.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private cw = 0;
  private ch = 0;
  rotated = false;
  s = 1; // world meters -> css px
  private tx = 0;
  private ty = 0;

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

    this.rotated = this.ch > this.cw;
    const wExt = (this.rotated ? TABLE_H : TABLE_W) + 2 * RAIL_W;
    const hExt = (this.rotated ? TABLE_W : TABLE_H) + 2 * RAIL_W;
    // margins leave room for the HUD (top) and the power/spin controls
    const mL = this.rotated ? 10 : 20;
    const mR = this.rotated ? 62 : 66;
    const mT = this.rotated ? 56 : 60;
    const mB = this.rotated ? 120 : 88;

    this.s = Math.min((this.cw - mL - mR) / wExt, (this.ch - mT - mB) / hExt);
    const tw = (this.rotated ? TABLE_H : TABLE_W) * this.s;
    const th = (this.rotated ? TABLE_W : TABLE_H) * this.s;
    const lx = mL + (this.cw - mL - mR - tw) / 2;
    const tyE = mT + (this.ch - mT - mB - th) / 2;
    if (this.rotated) {
      this.tx = lx + TABLE_H * this.s;
      this.ty = tyE;
    } else {
      this.tx = lx;
      this.ty = tyE;
    }
  }

  w2s(p: Vec): Vec {
    return this.rotated
      ? v(this.tx - p.y * this.s, this.ty + p.x * this.s)
      : v(this.tx + p.x * this.s, this.ty + p.y * this.s);
  }

  s2w(q: Vec): Vec {
    return this.rotated
      ? v((q.y - this.ty) / this.s, (this.tx - q.x) / this.s)
      : v((q.x - this.tx) / this.s, (q.y - this.ty) / this.s);
  }

  /** world -> local table coords (used inside the rotated canvas transform) */
  private lp(p: Vec): Vec {
    return v(p.x * this.s, p.y * this.s);
  }

  render(app: App): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cw, this.ch);

    ctx.save();
    ctx.translate(this.tx, this.ty);
    if (this.rotated) ctx.rotate(Math.PI / 2);

    this.drawTable();
    if (app.screen !== 'menu') {
      const game = app.game;

      if (game.ballInHand === 'kitchen' && game.current === 0 && !app.simRunning) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.fillRect(0, 0, HEAD_X * this.s, TABLE_H * this.s);
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
    ctx.restore();
  }

  private drawTable(): void {
    const ctx = this.ctx;
    const s = this.s;
    const rw = RAIL_W * s;

    // wooden rail
    roundRect(ctx, -rw, -rw, TABLE_W * s + 2 * rw, TABLE_H * s + 2 * rw, rw * 0.55);
    const wood = ctx.createLinearGradient(0, -rw, 0, TABLE_H * s + rw);
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
    ctx.fillRect(0, 0, TABLE_W * s, TABLE_H * s);
    const vg = ctx.createRadialGradient(
      TABLE_W * s / 2, TABLE_H * s / 2, TABLE_H * s * 0.3,
      TABLE_W * s / 2, TABLE_H * s / 2, TABLE_W * s * 0.7
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, TABLE_W * s, TABLE_H * s);

    // head string
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(HEAD_X * s, 0);
    ctx.lineTo(HEAD_X * s, TABLE_H * s);
    ctx.stroke();

    // pockets
    for (const pk of POCKETS) {
      const p = this.lp(pk.pos);
      ctx.beginPath();
      ctx.arc(p.x, p.y, pk.r * s, 0, Math.PI * 2);
      const pg = ctx.createRadialGradient(p.x, p.y, pk.r * s * 0.2, p.x, p.y, pk.r * s);
      pg.addColorStop(0, '#000');
      pg.addColorStop(1, '#151515');
      ctx.fillStyle = pg;
      ctx.fill();
    }
  }

  private drawBall(b: Ball): void {
    const ctx = this.ctx;
    const p = this.lp(b.pos);
    const r = BALL_R * this.s;
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

    // number circle (kept upright even when the table is rotated)
    if (b.id > 0) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.52, 0, Math.PI * 2);
      ctx.fillStyle = '#f4f0e4';
      ctx.fill();
      if (r > 6.5) {
        ctx.save();
        ctx.translate(p.x, p.y);
        if (this.rotated) ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#222';
        ctx.font = `bold ${Math.max(7, r * 0.62)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(b.id), 0, r * 0.04);
        ctx.restore();
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

    const a = this.lp(cue.pos);
    const b = this.lp(hitPoint);
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
    ctx.arc(b.x, b.y, BALL_R * this.s, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (hit.ball) {
      const obDir = norm(sub(hit.ball.pos, hitPoint));
      const o1 = this.lp(hit.ball.pos);
      const o2 = this.lp(add(hit.ball.pos, scale(obDir, 0.28)));
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

    const a = this.lp(tip);
    const b = this.lp(butt);
    const lw = Math.max(3.5, BALL_R * this.s * 0.55);

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
    const t2 = this.lp(sub(tip, scale(dir, -0.02)));
    ctx.lineTo(t2.x, t2.y);
    ctx.stroke();
    ctx.restore();
  }

  private drawBallInHandRing(pos: Vec): void {
    const ctx = this.ctx;
    const p = this.lp(pos);
    const r = BALL_R * this.s;
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
