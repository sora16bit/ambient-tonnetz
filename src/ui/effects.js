// src/ui/effects.js
import { HEX_SIZE, KEY_MAP, RING_DEFS } from '../core/constants.js';

// ── Star sprites ───────────────────────────────────────────
const STAR_TINTS = [
  [255,230,110],[255,215,80],[255,248,160],[240,220,100],[255,255,190],
];
export const starSprites = [];

export function initStarSprites() {
  if (starSprites.length > 0) return;
  STAR_TINTS.forEach(tint => {
    const [r,g,b] = tint;
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const sctx = c.getContext('2d');
    const grad = sctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, `rgb(${r},${g},${b})`);
    grad.addColorStop(1, 'transparent');
    sctx.fillStyle = grad;
    sctx.fillRect(0,0,16,16);
    starSprites.push(c);
  });
}

// ── StarDust ───────────────────────────────────────────────
export class StarDust {
  constructor(w, h) { this.reset(w, h); }
  reset(w, h) {
    this.x = Math.random() * (w || 0);
    this.y = Math.random() * (h || 0);
    this.scale = 0.3 + Math.random() * 0.7;
    this.baseAlpha = 20 + Math.random() * 55;
    this.phase = Math.random() * Math.PI * 2;
    this.twinkle = 0.006 + Math.random() * 0.014;
    this.tintIndex = Math.floor(Math.random() * starSprites.length);
    this.vx = (Math.random() - 0.5) * 0.02;
    this.vy = (Math.random() - 0.5) * 0.02;
  }
  update(w, h) {
    this.x = (this.x + this.vx + w) % w;
    this.y = (this.y + this.vy + h) % h;
    this.phase += this.twinkle;
  }
  draw(ctx) {
    const s = Math.sin(this.phase);
    const a = Math.max(0, Math.min(1, this.baseAlpha * (0.2 + 0.8*s*s) / 255));
    if (a < 0.01) return;
    const sz = Math.max(1, this.scale * 3);
    ctx.globalAlpha = a;
    ctx.drawImage(starSprites[this.tintIndex], this.x - sz, this.y - sz, sz*2, sz*2);
  }
}

export const stars = [];
export function initStars(w, h) {
  stars.length = 0;
  for (let i = 0; i < 1140; i++) stars.push(new StarDust(w, h));
}

// ── DeepRipple ─────────────────────────────────────────────
export class DeepRipple {
  constructor(pos, color) {
    this.pos = pos;
    this.color = color;
    this.dark = color.map(c => Math.floor(c / 5));
    this.frame = 0;
    this.rings = RING_DEFS.map(d => ({
      radius: HEX_SIZE * 0.4,
      alpha: 0,
      speed: d.speed,
      decay: d.decay,
      hasFill: d.hasFill,
      delay: d.delay,
      startAlpha: d.startAlpha,
    }));
  }
  get maxAlpha() { return Math.max(...this.rings.map(r => r.alpha)); }
  update() {
    for (const ring of this.rings) {
      if (this.frame === ring.delay) ring.alpha = ring.startAlpha;
      if (ring.alpha > 0) {
        ring.radius += ring.speed;
        ring.alpha -= ring.decay;
      }
    }
    this.frame++;
  }
  draw(ctx) {
    const [cx, cy] = this.pos;
    const [r, g, b] = this.color;
    const [dr, dg, db] = this.dark;

    // Initial Flash
    if (this.frame < 10) {
      const fa = 200 * (1 - this.frame / 10);
      const fr = HEX_SIZE * 0.8;
      ctx.save();
      ctx.globalAlpha = fa / 255;
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, fr);
      grad.addColorStop(0, `rgb(${r},${g},${b})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, fr, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    const ring0 = this.rings[0];
    if (ring0.alpha > 0) {
      ctx.save();
      ctx.globalAlpha = (ring0.alpha * 0.95) / 255;
      ctx.fillStyle = `rgb(${dr},${dg},${db})`;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, ring0.radius - 1), 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    for (const ring of this.rings) {
      if (ring.alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = ring.alpha / 255;
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, ring.radius, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ── NeighborGlow ───────────────────────────────────────────
export class NeighborGlow {
  constructor(key, color) {
    this.key = key;
    this.color = color; // [r, g, b]
    this.alpha = 0.28;
  }
  update() {
    this.alpha -= 0.0046; // ~60フレーム(1秒)でフェード
  }
  get isDead() { return this.alpha <= 0; }
  draw(ctx, getHexPos, getHexPath) {
    if (!KEY_MAP[this.key]) return;
    const [kx, ky] = KEY_MAP[this.key];
    const [cx, cy] = getHexPos(kx, ky);
    const [r, g, b] = this.color;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = this.alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.lineWidth = 2;
    ctx.stroke(getHexPath());
    ctx.restore();
  }
}

// ── Particle ───────────────────────────────────────────────
export class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 1.6;
    this.vy = -(Math.random() * 1.5 + 0.4);
    this.color = color; // [r, g, b]
    this.alpha = 0.7 + Math.random() * 0.25;
    this.decay = 0.007 + Math.random() * 0.005;
    this.radius = 1.5 + Math.random() * 2;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.985;
    this.vy *= 0.985;
    this.alpha -= this.decay;
  }
  get isDead() { return this.alpha <= 0; }
  draw(ctx) {
    const [r, g, b] = this.color;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
