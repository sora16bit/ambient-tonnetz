// ============================================================
//  src/ui/canvas.js  —  メイン描画モジュール
//  オリジナル index.html.bak の frame(ts) 内部 + 補助関数を抽出
// ============================================================
import {
  HEX_SIZE, FPS,
  COLOR_SPACE_DEEP, COLOR_SPACE_VOID, COLOR_ACCENT, COLOR_TEXT,
  KEY_MAP, KEY_NAMES, NOTE_COLORS, NOTE_NAMES,
  WAVE_COLORS, WAVE_TYPES, SCALES, SCALE_KEYS,
  PRESETS, PRESET_COLORS,
  POS_TO_KEY, getMidiNote, isInScale,
} from '../core/constants.js';
import { state } from '../core/state.js';
import { t } from '../i18n/strings.js';
import {
  initStarSprites, initStars, stars,
  StarDust, DeepRipple, NeighborGlow, Particle,
} from './effects.js';
import {
  drawSmallButtons, drawSectionLabel,
  getTapButton, getScaleButtons, getRootButtons, getOctaveButtons, getPresetButtons,
} from './buttons.js';
import { drawLayerQueue } from './layerqueue.js';
import { drawPresetPanel } from './presetpanel.js';

// ── Module-level canvas geometry ──────────────────────────
export let W = 0;
export let H = 0;
export let OFFSET_X = 0;
export let OFFSET_Y = 0;
let bgGradient = null;
let _hexPath = null;

export function isMobile() {
  return window.matchMedia('(max-width: 900px)').matches && (
    navigator.maxTouchPoints > 0 && !/Win/i.test(navigator.platform || navigator.userAgentData?.platform || '')
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}

export function isPortrait() {
  return W < H;
}

// モバイル横向き：上部ステータス40px + 下部UIバー44px を除いた領域にグリッドを収める
const MOBILE_UI_TOP = 40;
const MOBILE_UI_BOTTOM = 48; // 1行: コントロール行

export function effectiveHexSize() {
  if (!isMobile()) return HEX_SIZE;
  const availW = W;
  const availH = H - MOBILE_UI_TOP - MOBILE_UI_BOTTOM;
  const hw = Math.sqrt(3);
  const hh = 1.5;
  const xs = Object.values(KEY_MAP).map(([x, y]) => x * hw + y * hw / 2);
  const ys = Object.values(KEY_MAP).map(([x, y]) => y * hh);
  const gridW = Math.max(...xs) - Math.min(...xs);
  const gridH = Math.max(...ys) - Math.min(...ys);
  const sizeByW = (availW * 0.96) / (gridW + 1);
  const sizeByH = (availH * 0.92) / (gridH + 1.5);
  return Math.floor(Math.min(sizeByW, sizeByH));
}

// ── Effects arrays (module-level) ─────────────────────────
export const ripples = [];
export const neighborGlows = [];
export const particles = [];
export const MAX_PARTICLES = 100;

// ── Frame timing ──────────────────────────────────────────
let lastFrameTime = -1;

// ── Geometry helpers ──────────────────────────────────────
function calcOffsets() {
  const hs = effectiveHexSize();
  const hw = Math.sqrt(3) * hs;
  const hh = 1.5 * hs;
  const xs = Object.values(KEY_MAP).map(([x, y]) => x * hw + y * hw / 2);
  const ys = Object.values(KEY_MAP).map(([x, y]) => y * hh);
  OFFSET_X = (W - (Math.max(...xs) - Math.min(...xs))) / 2 - Math.min(...xs);
  if (isMobile()) {
    const availH = H - MOBILE_UI_TOP - MOBILE_UI_BOTTOM;
    OFFSET_Y = MOBILE_UI_TOP + (availH - (Math.max(...ys) - Math.min(...ys))) / 2 - Math.min(...ys);
  } else {
    OFFSET_Y = (H - (Math.max(...ys) - Math.min(...ys))) / 2 - Math.min(...ys) - 15;
  }
}

export function getHexPos(x, y) {
  const hs = effectiveHexSize();
  const hw = Math.sqrt(3) * hs;
  const hh = 1.5 * hs;
  return [OFFSET_X + x * hw + y * hw / 2, OFFSET_Y + y * hh];
}

export function getHexPath() {
  const hs = effectiveHexSize();
  _hexPath = new Path2D();
  for (let i = 0; i < 6; i++) {
    const ang = (60 * i - 30) * Math.PI / 180;
    const px = hs * Math.cos(ang);
    const py = hs * Math.sin(ang);
    if (i === 0) _hexPath.moveTo(px, py);
    else _hexPath.lineTo(px, py);
  }
  _hexPath.closePath();
  return _hexPath;
}

export function getHexKeyAtPos(px, py) {
  const hs = effectiveHexSize();
  for (const [key, [x, y]] of Object.entries(KEY_MAP)) {
    const [cx, cy] = getHexPos(x, y);
    if (Math.hypot(px - cx, py - cy) < hs * 0.9) return key;
  }
  return null;
}

// ── Background gradient ───────────────────────────────────
function buildBG(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, `rgb(${COLOR_SPACE_DEEP.join(',')})`);
  grad.addColorStop(1, `rgb(${COLOR_SPACE_VOID.join(',')})`);
  bgGradient = grad;
}

// ── Canvas resize ─────────────────────────────────────────
export function resize(canvas) {
  const vv = window.visualViewport;
  W = canvas.width  = vv ? Math.floor(vv.width)  : window.innerWidth;
  H = canvas.height = vv ? Math.floor(vv.height) : window.innerHeight;
  calcOffsets();
  const ctx = canvas.getContext('2d', { alpha: false });
  buildBG(ctx);
  // Rebuild stars so they cover the new viewport
  initStars(W, H);
}

// ── Effect spawners ───────────────────────────────────────
export function addRipple(pos, color) {
  ripples.push(new DeepRipple(pos, color));
  if (ripples.length > 50) ripples.shift();
}

export function addParticles(x, y, color, count) {
  for (let pi = 0; pi < count && particles.length < MAX_PARTICLES; pi++) {
    particles.push(new Particle(x, y, color));
  }
}

export function addNeighborGlow(key, color) {
  neighborGlows.push(new NeighborGlow(key, color));
}

// ── Main render frame ─────────────────────────────────────
/**
 * 1フレーム分を描画する。ts は requestAnimationFrame が渡すタイムスタンプ(ms)。
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} ts
 * @param {object} sliders { intensity, volume, bpm, reverb, delay, attack, release, wave }
 */
export function renderFrame(canvas, ctx, ts, sliders) {
  const dt = lastFrameTime < 0 ? 1000 / FPS : ts - lastFrameTime;
  if (dt < 1000 / FPS - 2) return;
  lastFrameTime = ts;
  // dtScale: フレーム落ちや高リフレッシュレートに対してティッカーを補正
  const dtScale = Math.min(dt, 50) / (1000 / FPS);

  const now = ts / 1000;

  // Background
  ctx.fillStyle = bgGradient || 'rgb(2,4,15)';
  ctx.fillRect(0, 0, W, H);

  // Pre-init sprites if needed
  initStarSprites();

  // Stars
  for (const s of stars) { s.update(W, H); s.draw(ctx); }

  // ── Portrait overlay ──────────────────────────────────────
  if (isMobile() && isPortrait()) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,8,0.88)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = 'rgb(255,220,0)';
    ctx.fillText('Rotate to landscape', W / 2, H / 2 - 14);
    ctx.font = '13px monospace';
    ctx.fillStyle = 'rgba(120,130,160,0.8)';
    ctx.fillText('横向きにして使ってね', W / 2, H / 2 + 18);
    ctx.restore();
    return;
  }

  // ── Title Screen ──────────────────────────────────────────
  if (state.appState === 'title' || state.titleExiting) {
    if (state.titleExiting) {
      state.titleAlpha = Math.max(0, state.titleAlpha - 0.05);
      if (state.titleAlpha <= 0) {
        state.appState = 'playing';
        state.titleExiting = false;
        state.lastMouseMove = Date.now();
        state._onPlayingStart?.();
      }
    } else {
      state.titleAlpha = Math.min(1, state.titleAlpha + 0.018);
    }

    ctx.save();
    ctx.globalAlpha = state.titleAlpha;

    // 半透明オーバーレイ
    ctx.fillStyle = 'rgba(0,0,8,0.55)';
    ctx.fillRect(0, 0, W, H);

    // AMBIENT TONNETZ タイトル（ネオン）
    const mobile = isMobile();
    const titleText = 'AMBIENT TONNETZ';

    const drawHexAt = (cx, cy, r, strokeStyle, fillStyle) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (60 * i - 30) * Math.PI / 180;
        i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
                : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      ctx.closePath();
      if (fillStyle)   { ctx.fillStyle = fillStyle; ctx.fill(); }
      if (strokeStyle) { ctx.strokeStyle = strokeStyle; ctx.lineWidth = 2.5; ctx.stroke(); }
    };

    if (mobile) {
      // ── スマホ：六角形（上）＋テキスト（下）縦積み
      const hexR = 28;
      const hexCY = H / 2 - 55;
      const titleFontSize = Math.min(32, Math.floor(W / 11));
      const textY = hexCY + hexR + 22;

      ctx.shadowColor = 'rgb(255,220,0)';
      ctx.shadowBlur = 28; drawHexAt(W / 2, hexCY, hexR, null, 'rgba(255,220,0,0.08)');
      ctx.shadowBlur = 14; drawHexAt(W / 2, hexCY, hexR, 'rgba(255,220,0,0.55)', null);
      ctx.shadowBlur = 4;  drawHexAt(W / 2, hexCY, hexR * 0.55, null, 'rgba(255,240,120,0.9)');
      ctx.shadowBlur = 2;  drawHexAt(W / 2, hexCY, hexR, 'rgba(255,255,200,0.85)', null);
      ctx.shadowBlur = 0;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${titleFontSize}px monospace`;
      ctx.shadowColor = 'rgb(255,220,0)';
      ctx.shadowBlur = 28; ctx.fillStyle = 'rgba(255,220,0,0.10)'; ctx.fillText(titleText, W / 2, textY);
      ctx.shadowBlur = 10; ctx.fillStyle = 'rgba(255,220,0,0.55)'; ctx.fillText(titleText, W / 2, textY);
      ctx.shadowBlur = 3;  ctx.fillStyle = 'rgba(255,255,210,0.92)'; ctx.fillText(titleText, W / 2, textY);
      ctx.shadowBlur = 0;

      ctx.font = `bold ${Math.round(titleFontSize * 0.32)}px monospace`;
      ctx.fillStyle = 'rgba(255,220,0,0.5)';
      ctx.fillText('MOBILE', W / 2, textY + titleFontSize + 6);

      ctx.font = `${Math.round(titleFontSize * 0.28)}px monospace`;
      ctx.fillStyle = 'rgba(180,190,220,0.38)';
      ctx.fillText('AMBIENT · GENERATIVE · HARMONIC', W / 2, textY + titleFontSize * 1.5 + 10);

      if (Math.sin(Date.now() / 600) > 0) {
        ctx.font = '12px monospace';
        ctx.fillStyle = 'rgba(90,100,130,0.8)';
        ctx.fillText('Tap to start', W / 2, H / 2 + 60);
      }
    } else {
      // ── デスクトップ：六角形（左）＋テキスト（右）横並び
      const titleY = H / 2 - 60;
      const titleFontSize = Math.min(64, Math.floor(W / 14));
      ctx.font = `bold ${titleFontSize}px monospace`;
      ctx.textBaseline = 'middle';
      const titleW = ctx.measureText(titleText).width;
      const hexR = Math.round(titleFontSize * 0.52);
      const gap = Math.round(hexR * 0.9);
      const blockW = hexR * 2 + gap + titleW;
      const titleX = Math.floor((W - blockW) / 2) + hexR * 2 + gap;
      const hexCX = Math.floor((W - blockW) / 2) + hexR;

      ctx.shadowColor = 'rgb(255,220,0)';
      ctx.shadowBlur = 28; drawHexAt(hexCX, titleY, hexR, null, 'rgba(255,220,0,0.08)');
      ctx.shadowBlur = 14; drawHexAt(hexCX, titleY, hexR, 'rgba(255,220,0,0.55)', null);
      ctx.shadowBlur = 4;  drawHexAt(hexCX, titleY, hexR * 0.55, null, 'rgba(255,240,120,0.9)');
      ctx.shadowBlur = 2;  drawHexAt(hexCX, titleY, hexR, 'rgba(255,255,200,0.85)', null);
      ctx.shadowBlur = 0;

      ctx.textAlign = 'left';
      ctx.font = `bold ${titleFontSize}px monospace`;
      ctx.shadowColor = 'rgb(255,220,0)';
      ctx.shadowBlur = 32; ctx.fillStyle = 'rgba(255,220,0,0.10)'; ctx.fillText(titleText, titleX, titleY);
      ctx.shadowBlur = 12; ctx.fillStyle = 'rgba(255,220,0,0.55)'; ctx.fillText(titleText, titleX, titleY);
      ctx.shadowBlur = 3;  ctx.fillStyle = 'rgba(255,255,210,0.92)'; ctx.fillText(titleText, titleX, titleY);
      ctx.shadowBlur = 0;

      ctx.textAlign = 'center';
      ctx.font = `${Math.round(titleFontSize * 0.22)}px monospace`;
      ctx.fillStyle = 'rgba(180,190,220,0.5)';
      ctx.fillText('AMBIENT  ·  GENERATIVE  ·  HARMONIC', W / 2, titleY + hexR + 28);

      if (Math.sin(Date.now() / 600) > 0) {
        ctx.font = '14px monospace';
        ctx.fillStyle = 'rgba(90,100,130,0.8)';
        ctx.fillText('Press any key or click to start', W / 2, H / 2 + 70);
      }
    }

    ctx.restore();

    // タイトル表示中（フェードアウト前）はグリッド・UI描画をスキップ
    if (state.appState === 'title' && !state.titleExiting) {
      return;
    }
  }

  // Keyboard
  const hexPath = getHexPath();

  for (const [k, [kx, ky]] of Object.entries(KEY_MAP)) {
    const [cx, cy] = getHexPos(kx, ky);
    const midiNote = getMidiNote(kx, ky);
    const noteIdx = ((midiNote % 12) + 12) % 12;
    const [nr, ng, nb] = NOTE_COLORS[noteIdx];
    const inScale = isInScale(midiNote, state.currentScale, state.currentRoot);
    const hexAlpha = inScale ? 1.0 : 0.25;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = hexAlpha;

    // 常時：薄い音程カラーのアウトライン（アクティブ時に差が出るよう暗め）
    ctx.strokeStyle = inScale ? `rgba(${nr},${ng},${nb},0.22)` : `rgba(${nr},${ng},${nb},0.08)`;
    ctx.lineWidth = 1;
    ctx.stroke(hexPath);

    // 押下時：音程カラーで強くグロウ
    if (state.pressedKeys.has(k)) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = `rgb(${nr},${ng},${nb})`;
      ctx.lineWidth = 3;
      ctx.stroke(hexPath);
      ctx.fillStyle = `rgba(${nr},${ng},${nb},0.15)`;
      ctx.fill(hexPath);
    }
    ctx.restore();

    // キーラベル + 音名
    const noteNameStr = NOTE_NAMES[noteIdx];
    ctx.save();
    ctx.globalAlpha = hexAlpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const hs = effectiveHexSize();
    const labelScale = isMobile() ? 1.0 : hs / HEX_SIZE;
    const keyFontSize = Math.max(8, Math.round(14 * labelScale));
    const noteFontSize = Math.max(7, Math.round(11 * labelScale));
    const labelOffY = Math.round(9 * (hs / HEX_SIZE));
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    if (!isMobile()) {
      ctx.font = `bold ${keyFontSize}px Arial`;
      ctx.strokeText(KEY_NAMES[k], cx, cy - labelOffY);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(KEY_NAMES[k], cx, cy - labelOffY);
    }
    // 音名（モバイルは音名のみ表示）
    ctx.font = `bold ${noteFontSize}px Arial`;
    ctx.strokeText(noteNameStr, cx, isMobile() ? cy : cy + labelOffY);
    ctx.fillStyle = `rgb(${nr},${ng},${nb})`;
    ctx.fillText(noteNameStr, cx, isMobile() ? cy : cy + labelOffY);
    ctx.restore();
  }

  // Ripples
  for (let i = ripples.length - 1; i >= 0; i--) {
    ripples[i].update();
    ripples[i].draw(ctx);
    if (ripples[i].maxAlpha <= 0) ripples.splice(i, 1);
  }

  // Neighbor Glows
  for (let i = neighborGlows.length - 1; i >= 0; i--) {
    neighborGlows[i].update();
    neighborGlows[i].draw(ctx, getHexPos, getHexPath);
    if (neighborGlows[i].isDead) neighborGlows.splice(i, 1);
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].draw(ctx);
    if (particles[i].isDead) particles.splice(i, 1);
  }

  // Note ticker — キーボード直下で右→左にドリフト
  {
    state.tickerSpeed = Math.max(1.2, state.tickerSpeed * Math.pow(0.955, dtScale));
    const _tickerMinX = isMobile()
      ? Math.floor(getHexPos(...KEY_MAP['w'])[0])
      : Math.floor(getHexPos(...KEY_MAP['t'])[0]);
    const hasActiveItems = state.noteTicker.some(item => item.x > _tickerMinX);
    state.noteTickerMasterAlpha = (state.pressedKeys.size > 0 || hasActiveItems)
      ? Math.min(1, state.noteTickerMasterAlpha + 0.14 * dtScale)
      : Math.max(0, state.noteTickerMasterAlpha - 0.02 * dtScale);
    for (let i = state.noteTicker.length - 1; i >= 0; i--) {
      state.noteTicker[i].x -= state.tickerSpeed * dtScale;
      const pastLeft = state.noteTicker[i].x < _tickerMinX;
      state.noteTicker[i].alpha -= (pastLeft ? 0.12 : 0.003) * dtScale;
      if (state.noteTicker[i].alpha <= 0) state.noteTicker.splice(i, 1);
    }
    if (state.noteTickerMasterAlpha > 0.01 && state.noteTicker.length > 0) {
      const tickerY = Math.floor((90 + (Math.floor(H / 2) - 155)) / 2) - 5;
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const item of state.noteTicker) {
        const [r, g, b] = item.color;
        const a = state.noteTickerMasterAlpha * item.alpha;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.shadowColor = `rgb(${r},${g},${b})`;
        ctx.shadowBlur = 4;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillText(item.note, item.x, tickerY);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(item.note, item.x, tickerY);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  // UI autohide (uiPinned = force hidden until toggled off)
  if (state.uiPinned) {
    state.uiAlpha = Math.max(0, state.uiAlpha - 0.03);
  } else {
    state.uiAlpha = Math.min(1, state.uiAlpha + 0.12);
  }

  // UI
  if (state.uiAlpha > 0.01) {
    const scaleLabel = SCALES[state.currentScale].label;
    const keyLabel   = NOTE_NAMES[state.currentRoot];
    const scaleInfo  = state.currentScale === 'chromatic' ? '' : `  ${scaleLabel}-${keyLabel}`;
    const statusText = state.genMode
      ? `AUTO: ON  ${state.bpm}BPM${scaleInfo}`
      : `AUTO: OFF${scaleInfo}`;
    const [sr, sg, sb] = state.genMode ? COLOR_ACCENT : COLOR_TEXT;
    ctx.save();
    ctx.globalAlpha = state.uiAlpha;

    // ステータステキスト（中央）
    const statusY = isMobile() ? 22 : 40;
    ctx.font = isMobile() ? 'bold 13px monospace' : 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '2px';
    ctx.fillStyle = `rgba(${sr},${sg},${sb},0.85)`;
    ctx.fillText(statusText, W / 2, statusY);
    ctx.letterSpacing = '0px';

    // AUTO トグルボタン（ステータステキスト右）
    {
      ctx.font = isMobile() ? 'bold 13px monospace' : 'bold 16px monospace';
      ctx.letterSpacing = '2px';
      const textW = ctx.measureText(statusText).width;
      const abw = isMobile() ? 52 : 64, abh = isMobile() ? 22 : 28;
      const abx = Math.floor(W / 2 + textW / 2 + 10);
      const aby = Math.floor(statusY - abh / 2);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(abx, aby, abw, abh, 4);
      else ctx.rect(abx, aby, abw, abh);
      if (state.genMode) {
        ctx.fillStyle = `rgba(${sr},${sg},${sb},0.18)`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${sr},${sg},${sb},0.7)`;
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      }
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.letterSpacing = '1px';
      ctx.fillStyle = state.genMode ? `rgba(${sr},${sg},${sb},0.9)` : 'rgba(255,255,255,0.35)';
      ctx.fillText('AUTO', abx + abw / 2, aby + abh / 2);
      ctx.letterSpacing = '0px';
      state.autoBtnRect = { x: abx, y: aby, w: abw, h: abh };
    }


    if (isMobile()) {
      drawMobileUI(ctx, state.uiAlpha, sliders);
    } else {
      drawDesktopUI(ctx, state.uiAlpha, sliders);
    }

    ctx.restore();
  }

  // Toast notification — large centered flash
  if (state.shareToastUntil && Date.now() < state.shareToastUntil) {
    const remaining = state.shareToastUntil - Date.now();
    const total = state.shareToastDuration || 2000;
    const elapsed = total - remaining;
    // fade in 120ms, blink at ~4Hz, fade out last 350ms
    const fadeIn  = Math.min(1, elapsed / 120);
    const fadeOut = Math.min(1, remaining / 350);
    const blink   = elapsed < 120 ? 1 : (Math.sin(elapsed / 130) > 0 ? 1 : 0.35);
    const alpha   = fadeIn * fadeOut * blink;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const msg = state.toastMessage || 'DONE';
    // glow halo
    ctx.font = 'bold 52px "Courier New", monospace';
    ctx.shadowColor = 'rgba(60,255,180,0.9)';
    ctx.shadowBlur = 32;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(msg, W / 2, H / 2);
    // main text
    ctx.shadowBlur = 18;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 6;
    ctx.strokeText(msg, W / 2, H / 2);
    ctx.fillStyle = 'rgb(60,255,180)';
    ctx.fillText(msg, W / 2, H / 2);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  if (!isMobile()) {
    // Queue always visible so LOCK button remains clickable
    drawLayerQueue(ctx, state.uiAlpha, W, H);
    drawPresetPanel(ctx, state.uiAlpha, W, H);

    // ? help button
    const hbx = W - 36, hby = 130, hbw = 34, hbh = 24;
    ctx.save();
    ctx.globalAlpha = state.uiAlpha * 0.7;
    ctx.strokeStyle = 'rgba(120,130,160,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(hbx, hby, hbw, hbh, 4);
    else ctx.rect(hbx, hby, hbw, hbh);
    ctx.stroke();
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(120,130,160,0.8)';
    ctx.fillText('?', hbx + hbw / 2, hby + hbh / 2 + 5);
    ctx.restore();
    state.helpBtnRect = { x: hbx, y: hby, w: hbw, h: hbh };
  } else {
    state.helpBtnRect = null;
    state.savePresetBtnRect = null;
  }

  // Custom hex cursor (desktop only)
  if (!isMobile() && state.cursorX > 0) {
    const cx = state.cursorX, cy = state.cursorY;
    ctx.save();
    ctx.globalAlpha = 0.75;
    // outer hex
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (60 * i - 30) * Math.PI / 180;
      i === 0 ? ctx.moveTo(cx + 10 * Math.cos(a), cy + 10 * Math.sin(a))
              : ctx.lineTo(cx + 10 * Math.cos(a), cy + 10 * Math.sin(a));
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgb(255,220,0)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // inner hex
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (60 * i - 30) * Math.PI / 180;
      i === 0 ? ctx.moveTo(cx + 5 * Math.cos(a), cy + 5 * Math.sin(a))
              : ctx.lineTo(cx + 5 * Math.cos(a), cy + 5 * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,220,0,0.6)';
    ctx.fill();
    ctx.restore();
  }

  // Inline text input overlay
  if (state.textInput) {
    const inp = state.textInput;
    const bw = Math.min(420, W - 60), bh = 130;
    const bx = (W - bw) / 2, by = (H - bh) / 2;
    state.textInputRect = { x: bx, y: by, w: bw, h: bh };

    ctx.save();
    ctx.globalAlpha = 0.97;
    ctx.fillStyle = 'rgb(8,12,26)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 10);
    else ctx.rect(bx, by, bw, bh);
    ctx.fill();
    ctx.strokeStyle = 'rgb(255,220,0)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgb(180,190,210)';
    ctx.font = '13px "Courier New", monospace';
    const label = inp.mode === 'preset-save' ? 'PRESET NAME'
                : 'RENAME PRESET';
    ctx.fillText(label, W / 2, by + 26);

    // input field
    const fx = bx + 20, fy = by + 44, fw = bw - 40, fh = 32;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(fx, fy, fw, fh, 4);
    else ctx.rect(fx, fy, fw, fh);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,0,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = '15px "Courier New", monospace';
    ctx.fillStyle = 'rgb(232,239,255)';
    const displayVal = inp.value || '';
    ctx.fillText(displayVal, fx + 10, fy + fh / 2);
    // blinking cursor
    if (Math.floor(Date.now() / 500) % 2 === 0) {
      const tw = ctx.measureText(displayVal).width;
      ctx.fillStyle = 'rgb(255,220,0)';
      ctx.fillRect(fx + 10 + tw + 2, fy + 6, 2, fh - 12);
    }

    // OK button
    const okx = bx + bw / 2 - 55, oky = by + 90, okw = 50, okh = 26;
    ctx.fillStyle = 'rgb(255,220,0)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(okx, oky, okw, okh, 4);
    else ctx.rect(okx, oky, okw, okh);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillStyle = 'rgb(0,0,0)';
    ctx.fillText('OK', okx + okw / 2, oky + okh / 2);
    state.textInputRect.ok = { x: okx, y: oky, w: okw, h: okh };

    // Cancel button
    const cx2 = bx + bw / 2 + 5, cky = by + 90, ckw = 60, ckh = 26;
    ctx.strokeStyle = 'rgba(180,190,210,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx2, cky, ckw, ckh, 4);
    else ctx.rect(cx2, cky, ckw, ckh);
    ctx.stroke();
    ctx.font = '12px "Courier New", monospace';
    ctx.fillStyle = 'rgb(120,130,160)';
    ctx.fillText('CANCEL', cx2 + ckw / 2, cky + ckh / 2);
    state.textInputRect.cancel = { x: cx2, y: cky, w: ckw, h: ckh };

    ctx.restore();
  }
}

// ── Cycle button helper (mobile) ──────────────────────────
function _drawCycleBtn(ctx, alpha, x, y, w, h, leftLabel, centerLabel, rightLabel, color) {
  const [r, g, b] = color;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 6);
  else ctx.rect(x, y, w, h);
  ctx.strokeStyle = `rgba(${r},${g},${b},0.5)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = `rgba(${r},${g},${b},0.08)`;
  ctx.fill();

  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
  ctx.fillText(leftLabel,  x + 16,     y + h / 2);
  ctx.fillText(rightLabel, x + w - 16, y + h / 2);
  ctx.fillStyle = `rgba(${r},${g},${b},0.95)`;
  ctx.font = 'bold 14px monospace';
  ctx.fillText(centerLabel, x + w / 2, y + h / 2);
  ctx.restore();
}

// ── Desktop UI ────────────────────────────────────────────
function drawDesktopUI(ctx, alpha, sliders) {
  if (sliders.intensity) sliders.intensity.draw(ctx, alpha);
  if (sliders.volume)    sliders.volume.draw(ctx, alpha);
  if (sliders.bpm)       sliders.bpm.draw(ctx, alpha);
  if (sliders.reverb)    sliders.reverb.draw(ctx, alpha);
  if (sliders.delay)     sliders.delay.draw(ctx, alpha);
  if (sliders.attack)    sliders.attack.draw(ctx, alpha);
  if (sliders.release)   sliders.release.draw(ctx, alpha);
  const tapBtn = getTapButton(sliders.intensity, () => {});
  if (tapBtn) drawSmallButtons(ctx, [tapBtn], alpha);
  if (sliders.wave) for (const sl of Object.values(sliders.wave)) sl.draw(ctx, alpha);

  const topAlpha = Math.max(0.25, alpha);
  drawSectionLabel(ctx, 'SCALE', 12, 15, topAlpha);
  drawSmallButtons(ctx, getScaleButtons(W), topAlpha);
  const keyAlpha = state.currentScale === 'chromatic' ? topAlpha * 0.35 : topAlpha;
  drawSectionLabel(ctx, 'KEY', 12, 59, keyAlpha);
  drawSmallButtons(ctx, getRootButtons(), keyAlpha);

  const presetBtns = getPresetButtons(W);
  if (presetBtns.length) drawSectionLabel(ctx, 'SOUND', presetBtns[0].x, 15, topAlpha);
  drawSmallButtons(ctx, presetBtns, topAlpha);
  drawSectionLabel(ctx, 'OCTAVE', W - 162, 59, topAlpha);
  drawSmallButtons(ctx, getOctaveButtons(W), topAlpha);

  const totalWeight = Object.values(state.waveWeights).reduce((a, b) => a + b, 0);
  const barW = Math.floor(Math.min(W * 0.5, 420));
  const barX = Math.floor((W - barW) / 2);
  const barY = 90;
  const barH = 12;
  const radius = Math.floor(barH / 2);

  ctx.font = '13px monospace';
  ctx.letterSpacing = '2px';
  ctx.fillStyle = `rgba(${COLOR_TEXT.join(',')},0.6)`;
  ctx.fillText('TOTAL WAVE MIX', W / 2, barY - 22);
  ctx.letterSpacing = '0px';

  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(barX, barY - radius, barW, barH, radius);
  else ctx.rect(barX, barY - radius, barW, barH);
  ctx.fillStyle = 'rgb(20,25,40)';
  ctx.fill();

  if (totalWeight > 0) {
    ctx.save();
    ctx.clip();
    let cx2 = barX;
    for (const wt of WAVE_TYPES) {
      const w = state.waveWeights[wt];
      if (w <= 0) continue;
      const segW = (w / totalWeight) * barW;
      const [r, g, b] = WAVE_COLORS[wt];
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(cx2, barY - radius, Math.ceil(segW), barH);
      if (cx2 > barX) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(cx2, barY - radius, 2, barH);
      }
      cx2 += segW;
    }
    ctx.restore();
  }

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.stroke();

  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  ctx.letterSpacing = '1px';
  ctx.fillStyle = 'rgba(120,130,160,0.6)';
  ctx.fillText('F11: Fullscreen  ESC: Exit', W - 8, H - 6);
  ctx.letterSpacing = '0px';
}

// ── Mobile UI ─────────────────────────────────────────────
function drawMobileUI(ctx, alpha, sliders) {
  // 1行に [PRESET◀▶][SCALE◀▶][KEY◀▶][BPM────][VOL────] を並べる
  const pad = 5;
  const rowH = MOBILE_UI_BOTTOM - 10;
  const btY = H - rowH - 5;
  const totalW = W - pad * 2;

  // 幅配分: PRESET 19% / SCALE 19% / KEY 13% / BPM 24% / VOL 残り
  const prW = Math.floor(totalW * 0.19);
  const prX = pad;
  const sbW = Math.floor(totalW * 0.19);
  const sbX = prX + prW + pad;
  const kbW = Math.floor(totalW * 0.13);
  const kbX = sbX + sbW + pad;
  const bpmW = Math.floor(totalW * 0.24);
  const bpmX = kbX + kbW + pad;
  const volW = W - pad - (bpmX + bpmW + pad);
  const volX = bpmX + bpmW + pad;

  // PRESET サイクルボタン
  const presetKeys = Object.keys(PRESETS);
  const presetIdx = state.currentPreset ? presetKeys.indexOf(state.currentPreset) : -1;
  const presetLabel = state.currentPreset ? PRESETS[state.currentPreset].label : 'ALL';
  const presetColor = state.currentPreset ? PRESET_COLORS[state.currentPreset] : [180, 180, 220];
  _drawCycleBtn(ctx, alpha, prX, btY, prW, rowH, '◀', presetLabel, '▶', presetColor);
  state.mobilePresetLeft  = { x: prX,                              y: btY, w: Math.floor(prW * 0.28), h: rowH };
  state.mobilePresetRight = { x: prX + prW - Math.floor(prW * 0.28), y: btY, w: Math.floor(prW * 0.28), h: rowH };
  // mobilePresetBtns は不要になるので空にしておく
  state.mobilePresetBtns = [];

  // SCALE サイクルボタン
  const scaleLabel = SCALES[state.currentScale].label;
  _drawCycleBtn(ctx, alpha, sbX, btY, sbW, rowH, '◀', scaleLabel, '▶', [80, 150, 255]);
  state.mobileScaleLeft  = { x: sbX,                              y: btY, w: Math.floor(sbW * 0.28), h: rowH };
  state.mobileScaleRight = { x: sbX + sbW - Math.floor(sbW * 0.28), y: btY, w: Math.floor(sbW * 0.28), h: rowH };

  // KEY サイクルボタン（chromaticのとき無効）
  const keyDisabled = state.currentScale === 'chromatic';
  const rootLabel = NOTE_NAMES[state.currentRoot];
  _drawCycleBtn(ctx, alpha * (keyDisabled ? 0.3 : 1), kbX, btY, kbW, rowH, '◀', rootLabel, '▶',
    keyDisabled ? [60, 65, 85] : NOTE_COLORS[state.currentRoot]);
  if (keyDisabled) {
    state.mobileKeyLeft  = null;
    state.mobileKeyRight = null;
  } else {
    state.mobileKeyLeft  = { x: kbX,                              y: btY, w: Math.floor(kbW * 0.32), h: rowH };
    state.mobileKeyRight = { x: kbX + kbW - Math.floor(kbW * 0.32), y: btY, w: Math.floor(kbW * 0.32), h: rowH };
  }

  // BPM スライダー
  if (sliders.bpm) {
    sliders.bpm.x = bpmX;
    sliders.bpm.y = btY + rowH / 2;
    sliders.bpm.w = bpmW;
    sliders.bpm.draw(ctx, alpha);
  }
  // VOLUME スライダー
  if (sliders.volume) {
    sliders.volume.x = volX;
    sliders.volume.y = btY + rowH / 2;
    sliders.volume.w = volW;
    sliders.volume.draw(ctx, alpha);
  }
}
