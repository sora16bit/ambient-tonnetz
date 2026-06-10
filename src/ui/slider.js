// src/ui/slider.js

export class MinimalSlider {
  constructor(x, y, w, minVal, maxVal, initVal, label, color) {
    this.x = x; this.y = y; this.w = w;
    this.minVal = minVal; this.maxVal = maxVal; this.val = initVal;
    this.label = label; this.color = color;
    this.draggingId = null; // PointerId
  }
  get hitRect() { return { x: this.x, y: this.y-15, w: this.w, h: 30 }; } // スマホでも押しやすいように判定を拡大
  hitTest(mx, my) {
    const r = this.hitRect;
    return mx >= r.x && mx <= r.x+r.w && my >= r.y && my <= r.y+r.h;
  }
  updateVal(mx) {
    const ratio = Math.max(0, Math.min(1, (mx - this.x) / this.w));
    this.val = this.minVal + ratio * (this.maxVal - this.minVal);
  }
  draw(ctx, alpha) {
    const ratio = (this.val - this.minVal) / (this.maxVal - this.minVal);
    const hx = this.x + ratio * this.w;
    const [r,g,b] = this.val > 0 ? this.color : [60, 65, 80];
    ctx.save();
    ctx.globalAlpha = alpha;

    // トラックを少し太く
    ctx.fillStyle = 'rgb(40,45,60)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(this.x, this.y - 1, this.w, 3, 2);
    else ctx.rect(this.x, this.y - 1, this.w, 3);
    ctx.fill();

    // ハンドル（つまみ）— 細い暗いリングでぼやけ感を抑える
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.arc(hx, this.y + 0.5, 6, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ラベル
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '1px';
    const labelX = this.x + this.w / 2;
    ctx.fillStyle = `rgba(${r},${g},${b},0.65)`;
    ctx.fillText(`${this.label} ${Math.round(this.val)}`, labelX, this.y - 20);
    ctx.textAlign = 'left';
    ctx.letterSpacing = '0px';

    ctx.restore();
  }
}
