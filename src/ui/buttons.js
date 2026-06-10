// ============================================================
//  src/ui/buttons.js  —  ボタン描画・設定 (index.html.bak から抽出)
// ============================================================
import { SCALES, SCALE_KEYS, NOTE_NAMES, PRESETS, NOTE_COLORS,
         SCALE_COLORS, PRESET_COLORS, COLOR_ACCENT, WAVE_TYPES } from '../core/constants.js';
import { state } from '../core/state.js';

// ── Shared button renderer ─────────────────────────────────
export function drawSmallButtons(ctx, buttons, alpha) {
  for (const btn of buttons) {
    const [r, g, b] = btn.color || COLOR_ACCENT;
    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.beginPath(); // ← パスを必ずリセット（これがないと前のボタン枠が残る）
    if (btn.active) {
      ctx.strokeStyle = `rgba(${r},${g},${b},0.65)`;
      ctx.lineWidth = 1.5;
      if (ctx.roundRect) ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 2);
      else ctx.rect(btn.x, btn.y, btn.w, btn.h);
      ctx.stroke();
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.letterSpacing = '1px';
      ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
      ctx.fillText(btn.label, btn.x + btn.w/2, btn.y + btn.h/2);
      ctx.letterSpacing = '0px';
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      if (ctx.roundRect) ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 2);
      else ctx.rect(btn.x, btn.y, btn.w, btn.h);
      ctx.stroke();
      ctx.font = '12px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.letterSpacing = '1px';
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillText(btn.label, btn.x + btn.w/2, btn.y + btn.h/2);
      ctx.letterSpacing = '0px';
    }
    ctx.restore();
  }
}

// セクションラベル
export function drawSectionLabel(ctx, text, x, y, uAlpha) {
  ctx.save();
  ctx.globalAlpha = uAlpha * 0.45;
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '2px';
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y);
  ctx.letterSpacing = '0px';
  ctx.restore();
}

// ── TAP ボタン設定
export function getTapButton(sliderIntensity, tapTempoFn) {
  if (!sliderIntensity) return null;
  return {
    label: 'TAP',
    x: sliderIntensity.x - 52 - 20,
    y: sliderIntensity.y - 8,
    w: 52, h: 20,
    active: false, clickable: true,
    color: [255, 180, 0],
    action: tapTempoFn,
  };
}

// ── Scale buttons
export function getScaleButtons(W) {
  const bw = 54, bh = 24, margin = 4, baseX = 12, baseY = 24;
  return SCALE_KEYS.map((sk, i) => ({
    label: SCALES[sk].label,
    x: baseX + i * (bw + margin), y: baseY, w: bw, h: bh,
    active: state.currentScale === sk,
    color: SCALE_COLORS[sk],
    action: () => { state.currentScale = sk; },
  }));
}

// ── Key (root note) buttons
export function getRootButtons() {
  const bw = 28, bh = 24, margin = 3, baseX = 12, baseY = 68;
  const disabled = state.currentScale === 'chromatic';
  return NOTE_NAMES.map((name, i) => ({
    label: name,
    x: baseX + i * (bw + margin), y: baseY, w: bw, h: bh,
    active: !disabled && state.currentRoot === i,
    color: disabled ? [60, 65, 85] : NOTE_COLORS[i],
    action: disabled ? null : () => { state.currentRoot = i; },
  }));
}

// ── Octave buttons
export function getOctaveButtons(W) {
  const sign = state.octaveShift > 0 ? '+' : '';
  const baseY = 68, baseX = W - 162;
  const col = [255, 220, 80];
  return [
    { label: '–', x: baseX,       y: baseY, w: 34, h: 24,
      active: state.octaveShift < 0, clickable: true, color: col,
      action: () => { state.octaveShift = Math.max(-2, state.octaveShift - 1); } },
    { label: `OCT ${sign}${state.octaveShift}`, x: baseX + 38, y: baseY, w: 84, h: 24,
      active: false, clickable: true, color: col,
      action: () => { state.octaveShift = 0; } },
    { label: '+', x: baseX + 126, y: baseY, w: 34, h: 24,
      active: state.octaveShift > 0, clickable: true, color: col,
      action: () => { state.octaveShift = Math.min(2, state.octaveShift + 1); } },
  ];
}

// ── Preset buttons
export function getPresetButtons(W) {
  const bw = 58, bh = 24, margin = 4;
  const keys = Object.keys(PRESETS);
  const totalW = keys.length * (bw + margin) - margin;
  const baseX = W - totalW - 12;
  const baseY = 24;
  return keys.map((pk, i) => ({
    label: PRESETS[pk].label,
    x: baseX + i * (bw + margin), y: baseY, w: bw, h: bh,
    active: state.currentPreset === pk,
    color: PRESET_COLORS[pk],
    action: () => {
      state.currentPreset = pk;
      const weights = PRESETS[pk].weights;
      for (const wt of WAVE_TYPES) {
        state.waveWeights[wt] = weights[wt];
      }
    },
  }));
}
