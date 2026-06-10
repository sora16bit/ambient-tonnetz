// ============================================================
//  src/main.js  —  アプリケーション結線 (Vite エントリーポイント)
// ============================================================
import { state } from './core/state.js';
import {
  WAVE_TYPES, WAVE_COLORS, COLOR_ACCENT,
  KEY_MAP, NOTE_COLORS, NOTE_NAMES, POS_TO_KEY,
  getMidiNote, SCALE_KEYS, PRESETS,
} from './core/constants.js';
import {
  getAudioCtx, playKeyTarget, releaseVoice,
  applyMasterVolume, syncWeights, tapTempo, masterGain,
} from './audio/engine.js';
import {
  createLayer, addLayer, removeLayer,
  startRecording, stopRecording,
  clearLayer, pauseLayer, resumeLayer,
  updateLayerLoopPoints, exportLayerAudio,
} from './audio/recorder.js';
import {
  resize, renderFrame,
  getHexPos, getHexKeyAtPos,
  addRipple, addParticles, addNeighborGlow,
  MAX_PARTICLES,
} from './ui/canvas.js';
import * as CanvasMod from './ui/canvas.js';
import {
  getPinButton, getQueueMetrics, getLayerRowY,
} from './ui/layerqueue.js';
import { getPresetPanelMetrics } from './ui/presetpanel.js';
import {
  getTapButton, getScaleButtons, getRootButtons,
  getOctaveButtons, getPresetButtons,
} from './ui/buttons.js';
import { initStarSprites, initStars } from './ui/effects.js';
import { MinimalSlider } from './ui/slider.js';
import { stepAutoGeneration } from './core/auto.js';
import { encodeURL, decodeURL } from './pro/url-share.js';
import { savePreset, deletePreset, renamePreset, loadSavedPresets } from './pro/presets.js';
import { toggleHelp, hideHelp, showLangPickerIfFirstVisit, showHelpIfFirstPlay } from './ui/help.js';
import { t } from './i18n/strings.js';

// ── Initial layer ─────────────────────────────────────────
state.layers.push(createLayer());

// ── Canvas setup ──────────────────────────────────────────
const canvas = document.getElementById('c');
resize(canvas);
initStarSprites();
initStars(CanvasMod.W, CanvasMod.H);

// ── Sliders ───────────────────────────────────────────────
let slider_intensity, sliders_wave, slider_volume, slider_bpm;
let slider_reverb, slider_delay, slider_attack, slider_release;

function buildSliderPositions() {
  const W = CanvasMod.W;
  const H = CanvasMod.H;

  // Wave sliders (bottom row)
  const waveSlotW = window.innerWidth > 900 ? 130 : (W - 20) / WAVE_TYPES.length;
  const waveSliderW = waveSlotW * 0.75;
  const waveTotal = WAVE_TYPES.length * waveSlotW;
  const waveStart = Math.max(10, Math.floor((W - waveTotal) / 2));

  // Row 1: REVERB, DELAY, ATTACK, RELEASE
  const kbBottom = Math.floor(H / 2) + 136;
  const row1Y = Math.max(kbBottom + 30, H - 140);
  const row1Gap = 20;
  const row1SliderW = Math.min(195, Math.floor((W - 60 - row1Gap * 3) / 4));
  const row1TotalW = 4 * row1SliderW + 3 * row1Gap;
  const row1X = Math.floor((W - row1TotalW) / 2);

  slider_reverb  = new MinimalSlider(row1X,                              row1Y, row1SliderW, 0,    100, slider_reverb  ? slider_reverb.val  : 40,   'REVERB',  [100,180,255]);
  slider_delay   = new MinimalSlider(row1X + (row1SliderW + row1Gap),     row1Y, row1SliderW, 0,    100, slider_delay   ? slider_delay.val   : 0,    'DELAY',   [255,160,80]);
  slider_attack  = new MinimalSlider(row1X + (row1SliderW + row1Gap) * 2, row1Y, row1SliderW, 0.01, 2.0, slider_attack  ? slider_attack.val  : 0.15, 'ATTACK',  [180,255,120]);
  slider_release = new MinimalSlider(row1X + (row1SliderW + row1Gap) * 3, row1Y, row1SliderW, 0.1,  4.0, slider_release ? slider_release.val : 1.2,  'RELEASE', [255,120,200]);

  // Row 2: [TAP] INTENSITY, BPM, VOLUME
  const row2Y = Math.max(row1Y + 52, H - 88);
  const row2Gap = 20;
  const tapW = 52;
  const row2SliderW = Math.min(175, Math.floor((W - 60 - tapW - row2Gap * 3) / 3));
  const row2TotalW = tapW + row2Gap + 3 * row2SliderW + 2 * row2Gap;
  const row2X = Math.floor((W - row2TotalW) / 2);

  slider_intensity = new MinimalSlider(row2X + tapW + row2Gap,                               row2Y, row2SliderW, 0,   100, slider_intensity ? slider_intensity.val : 30, 'INTENSITY', COLOR_ACCENT);
  slider_bpm       = new MinimalSlider(row2X + tapW + row2Gap + (row2SliderW + row2Gap),     row2Y, row2SliderW, 40,  200, slider_bpm       ? slider_bpm.val       : 80, 'BPM',       [255,180,0]);
  slider_volume    = new MinimalSlider(row2X + tapW + row2Gap + (row2SliderW + row2Gap) * 2, row2Y, row2SliderW, 0,   100, slider_volume    ? slider_volume.val    : 70, 'VOLUME',    [100,200,255]);

  // Wave sliders
  const oldVals = {};
  if (sliders_wave) for (const wt of WAVE_TYPES) oldVals[wt] = sliders_wave[wt].val;
  sliders_wave = {};
  WAVE_TYPES.forEach((wt, i) => {
    const offsetX = waveStart + i * waveSlotW + (waveSlotW - waveSliderW) / 2;
    sliders_wave[wt] = new MinimalSlider(
      offsetX, H - 28, waveSliderW, 0, 100,
      oldVals[wt] !== undefined ? oldVals[wt] : (wt === 'sine' ? 100 : 0),
      wt.toUpperCase(), WAVE_COLORS[wt],
    );
  });
}
buildSliderPositions();

// Apply URL params on load
const urlParams = decodeURL();
if (urlParams.currentScale) state.currentScale = urlParams.currentScale;
if (urlParams.currentRoot !== null) state.currentRoot = urlParams.currentRoot;
if (urlParams.bpm !== null) {
  state.bpm = urlParams.bpm;
  if (slider_bpm) slider_bpm.val = urlParams.bpm;
}
if (urlParams.octaveShift !== null) state.octaveShift = urlParams.octaveShift;
for (const [wt, val] of Object.entries(urlParams.waveWeights)) {
  if (val !== null) {
    state.waveWeights[wt] = val;
    if (sliders_wave && sliders_wave[wt]) sliders_wave[wt].val = val;
  }
}

function showToast(msg, ms = 2000) {
  state.toastMessage = msg;
  state.shareToastDuration = ms;
  state.shareToastUntil = Date.now() + ms;
}

function openTextInput(mode, defaultVal, renameIdx) {
  state.textInput = { mode, value: defaultVal || '', renameIdx: renameIdx ?? null };
  state.textInputRect = null;
}

function commitTextInput() {
  const inp = state.textInput;
  if (!inp) return;
  const val = inp.value.trim();
  state.textInput = null;

  if (inp.mode === 'preset-save') {
    const name = val || `Preset ${new Date().toISOString().slice(0,16).replace('T',' ')}`;
    savePreset(state, name);
    showToast('PRESET SAVED');
  } else if (inp.mode === 'preset-rename') {
    if (val && inp.renameIdx !== null) {
      renamePreset(inp.renameIdx, val);
    }
  }
}

function loadPreset(preset) {
  state.currentScale = preset.currentScale;
  state.currentRoot = preset.currentRoot;
  state.bpm = preset.bpm;
  state.octaveShift = preset.octaveShift;
  Object.assign(state.waveWeights, preset.waveWeights);
  state.sliderIntensityVal = preset.sliderIntensityVal ?? state.sliderIntensityVal;
  state.sliderReverbVal = preset.sliderReverbVal ?? state.sliderReverbVal;
  state.sliderDelayVal = preset.sliderDelayVal ?? state.sliderDelayVal;
  state.attackTime = preset.attackTime ?? state.attackTime;
  state.releaseTime = preset.releaseTime ?? state.releaseTime;
  showToast('PRESET LOADED', 1500);
}

showLangPickerIfFirstVisit();

state._onPlayingStart = () => { showHelpIfFirstPlay(); };

const onResize = () => { resize(canvas); buildSliderPositions(); };
window.addEventListener('resize', onResize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

// ── Helpers ──────────────────────────────────────────────
function allSliders() {
  return [
    slider_intensity, slider_volume, slider_bpm,
    slider_reverb, slider_delay, slider_attack, slider_release,
    ...(sliders_wave ? Object.values(sliders_wave) : []),
  ].filter(Boolean);
}

function doTap() {
  tapTempo(slider_bpm);
}

function startPlaying() {
  if (state.appState !== 'title' || state.titleExiting) return;
  state.titleExiting = true;
  getAudioCtx();
}

// ── Note lifecycle (replaces startKey/stopKey) ───────────
function startKey(k) {
  if (state.pressedKeys.has(k)) return;
  state.pressedKeys.add(k);

  const [x, y] = KEY_MAP[k];
  const pos = getHexPos(x, y);
  const note = getMidiNote(x, y);
  const color = NOTE_COLORS[((note % 12) + 12) % 12];

  addRipple(pos, color);

  // Note ticker
  const noteName = NOTE_NAMES[((note % 12) + 12) % 12];
  const W = CanvasMod.W;
  const tickerMaxX = CanvasMod.isMobile()
    ? Math.floor(CanvasMod.getHexPos(...KEY_MAP['r'])[0])
    : Math.floor(CanvasMod.getHexPos(...KEY_MAP['u'])[0]);
  const now = Date.now();
  const tickerMinX = CanvasMod.isMobile()
    ? Math.floor(CanvasMod.getHexPos(...KEY_MAP['w'])[0])
    : Math.floor(CanvasMod.getHexPos(...KEY_MAP['t'])[0]);
  const last = state.noteTicker.length > 0 ? state.noteTicker[state.noteTicker.length - 1] : null;
  const minSpacing = 32;
  if (last) {
    const gap = tickerMaxX - last.x;
    if (gap < minSpacing) {
      const wantShift = minSpacing - gap;
      // 既存アイテムの最左xがtickerMinXを下回らない範囲でシフト
      const minX = Math.min(...state.noteTicker.map(item => item.x));
      const maxShift = Math.max(0, minX - tickerMinX);
      const shift = Math.min(wantShift, maxShift);
      if (shift > 0) for (const item of state.noteTicker) item.x -= shift;
    }
    const interval = now - last.t;
    const targetSpeed = Math.max(1.2, Math.min(8, 280 / Math.max(interval, 25)));
    state.tickerSpeed = Math.min(8, Math.max(state.tickerSpeed, targetSpeed));
  }
  state.noteTicker.push({ note: noteName, color, x: tickerMaxX, alpha: 1.0, t: now });
  if (state.noteTicker.length > 20) state.noteTicker.shift();

  // 隣接ヘックスにグロウ伝播
  const dirs6 = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
  for (const [dx, dy] of dirs6) {
    const nk = POS_TO_KEY[`${x + dx},${y + dy}`];
    if (nk) addNeighborGlow(nk, color);
  }

  // パーティクル放出
  const pCount = 10 + Math.floor(Math.random() * 6);
  addParticles(pos[0], pos[1], color, pCount);

  playKeyTarget(x, y);
}

function stopKey(k) {
  if (!state.pressedKeys.has(k)) return;
  state.pressedKeys.delete(k);
  const [x, y] = KEY_MAP[k];
  releaseVoice(`${x},${y}`);
}

function triggerKeyAuto(k) {
  startKey(k);
  setTimeout(() => {
    if (!state.physicalKeys.has(k) && ![...state.activeTouches.values()].includes(k)) {
      stopKey(k);
    }
  }, 400 + Math.random() * 600);
}

// ── Layer queue hit tests ────────────────────────────────
function isLayerRowVisible(idx) {
  const { visibleRows } = getQueueMetrics(CanvasMod.W, CanvasMod.H);
  const vi = idx - state.layerScrollOffset;
  return vi >= 0 && vi < visibleRows;
}
function hitTestLayerCard(px, py) {
  const metrics = getQueueMetrics(CanvasMod.W, CanvasMod.H);
  const { rowH, queueX, queueW } = metrics;
  for (let i = 0; i < state.layers.length; i++) {
    if (!isLayerRowVisible(i)) continue;
    const ry = getLayerRowY(i, metrics);
    if (px >= queueX && px <= queueX + queueW && py >= ry && py <= ry + rowH) return i;
  }
  return -1;
}
function hitTestLayerButtons(px, py, idx) {
  const layer = state.layers[idx];
  const metrics = getQueueMetrics(CanvasMod.W, CanvasMod.H);
  const { rowH, queueX, queueW } = metrics;
  const ry = getLayerRowY(idx, metrics);
  const btnAreaX = queueX + 5, btnAreaW = queueW - 10;
  const btnY = ry + rowH - 17, btnH = 14;
  if (state.deleteConfirmLayerIdx === idx) {
    const hw = Math.floor((btnAreaW - 4) / 2);
    if (py >= ry + 28 && py <= ry + 42) {
      if (px >= btnAreaX && px <= btnAreaX + hw) return 'delete';
      if (px >= btnAreaX + hw + 4 && px <= btnAreaX + hw * 2 + 4) return 'cancel';
    }
    return 'overlay';
  }
  if (py < btnY || py > btnY + btnH || px < btnAreaX || px > btnAreaX + btnAreaW) return null;
  if (layer.state === 'idle')      return 'rec';
  if (layer.state === 'recording') return 'stop';
  if (layer.state === 'playing' || layer.state === 'paused') {
    const tw = Math.floor((btnAreaW - 6) / 3);
    if (px < btnAreaX + tw)           return layer.state === 'playing' ? 'pause' : 'play';
    if (px < btnAreaX + (tw + 3) * 2) return 'clear';
    return 'dl';
  }
  return null;
}
function hitTestLoopHandle(px, py, idx) {
  const layer = state.layers[idx];
  if (layer.state !== 'playing') return null;
  const metrics = getQueueMetrics(CanvasMod.W, CanvasMod.H);
  const { queueX, queueW } = metrics;
  const ry = getLayerRowY(idx, metrics);
  const barX = queueX + 6, barW = queueW - 12, barY = ry + 24;
  if (Math.hypot(px - (barX + layer.loopStart * barW), py - (barY + 1)) <= 8) return 'start';
  if (Math.hypot(px - (barX + layer.loopEnd   * barW), py - (barY + 1)) <= 8) return 'end';
  return null;
}
function hitTestAddButton(px, py) {
  const { queueW, queueX, addBtnY, addBtnH } = getQueueMetrics(CanvasMod.W, CanvasMod.H);
  return px >= queueX && px <= queueX + queueW && py >= addBtnY && py <= addBtnY + addBtnH;
}

// ── Pointer events ───────────────────────────────────────
canvas.addEventListener('pointerdown', e => {
  getAudioCtx();
  state.lastMouseMove = Date.now();

  if (state.appState === 'title') {
    startPlaying();
    return;
  }

  // Inline text input overlay
  if (state.textInput && state.textInputRect) {
    const r = state.textInputRect;
    const x = e.clientX, y = e.clientY;
    if (r.ok && x >= r.ok.x && x <= r.ok.x + r.ok.w && y >= r.ok.y && y <= r.ok.y + r.ok.h) {
      commitTextInput();
      e.preventDefault(); return;
    }
    if (r.cancel && x >= r.cancel.x && x <= r.cancel.x + r.cancel.w && y >= r.cancel.y && y <= r.cancel.y + r.cancel.h) {
      state.textInput = null;
      e.preventDefault(); return;
    }
    e.preventDefault(); return;
  }


  // AUTO button
  const ab = state.autoBtnRect;
  if (ab && e.clientX >= ab.x && e.clientX <= ab.x + ab.w &&
      e.clientY >= ab.y && e.clientY <= ab.y + ab.h) {
    state.genMode = !state.genMode;
    state.lastMouseMove = Date.now();
    return;
  }

  // Hex key — ヘックスを最優先で判定（モバイルUIボタンより先）
  {
    const k = getHexKeyAtPos(e.clientX, e.clientY);
    if (k) {
      startKey(k);
      state.activeTouches.set(e.pointerId, k);
      if (!state.scanMode) {
        state.scanPressTimer = setTimeout(() => {
          state.scanMode = true;
          state.scanPointerId = e.pointerId;
        }, 150);
      }
      return;
    }
  }

  // Mobile: preset cycle
  const presetKeys = Object.keys(PRESETS);
  // null = ALL（プリセットなし）、それ以外はプリセット名
  const cyclePreset = (delta) => {
    const cur = state.currentPreset;
    // ALL → preset[0] → preset[1] → ... → ALL の循環
    const extKeys = [null, ...presetKeys]; // null=ALL
    const idx = extKeys.indexOf(cur);
    const next = extKeys[(idx + delta + extKeys.length) % extKeys.length];
    state.currentPreset = next;
    if (next) {
      const weights = PRESETS[next].weights;
      for (const wt of WAVE_TYPES) state.waveWeights[wt] = weights[wt] ?? 0;
    }
    if (sliders_wave) {
      for (const wt of WAVE_TYPES) {
        if (sliders_wave[wt]) sliders_wave[wt].val = state.waveWeights[wt];
      }
    }
  };
  // Layer scroll arrow clicks
  const lsup = state.layerScrollUpBtn;
  if (lsup && e.clientX >= lsup.x && e.clientX <= lsup.x + lsup.w &&
      e.clientY >= lsup.y && e.clientY <= lsup.y + lsup.h) {
    state.layerScrollOffset = Math.max(0, state.layerScrollOffset - 1);
    return;
  }
  const lsdn = state.layerScrollDownBtn;
  if (lsdn && e.clientX >= lsdn.x && e.clientX <= lsdn.x + lsdn.w &&
      e.clientY >= lsdn.y && e.clientY <= lsdn.y + lsdn.h) {
    const { visibleRows } = getQueueMetrics(CanvasMod.W, CanvasMod.H);
    state.layerScrollOffset = Math.min(Math.max(0, state.layers.length - visibleRows), state.layerScrollOffset + 1);
    return;
  }

  const mpl = state.mobilePresetLeft;
  if (mpl && e.clientX >= mpl.x && e.clientX <= mpl.x + mpl.w &&
      e.clientY >= mpl.y && e.clientY <= mpl.y + mpl.h) {
    cyclePreset(-1); return;
  }
  const mpr = state.mobilePresetRight;
  if (mpr && e.clientX >= mpr.x && e.clientX <= mpr.x + mpr.w &&
      e.clientY >= mpr.y && e.clientY <= mpr.y + mpr.h) {
    cyclePreset(+1); return;
  }

  // Mobile: scale cycle
  const msl = state.mobileScaleLeft;
  if (msl && e.clientX >= msl.x && e.clientX <= msl.x + msl.w &&
      e.clientY >= msl.y && e.clientY <= msl.y + msl.h) {
    const keys = SCALE_KEYS;
    state.currentScale = keys[(keys.indexOf(state.currentScale) - 1 + keys.length) % keys.length];
    return;
  }
  const msr = state.mobileScaleRight;
  if (msr && e.clientX >= msr.x && e.clientX <= msr.x + msr.w &&
      e.clientY >= msr.y && e.clientY <= msr.y + msr.h) {
    const keys = SCALE_KEYS;
    state.currentScale = keys[(keys.indexOf(state.currentScale) + 1) % keys.length];
    return;
  }

  // Mobile: key (root) cycle
  const mkl = state.mobileKeyLeft;
  if (mkl && e.clientX >= mkl.x && e.clientX <= mkl.x + mkl.w &&
      e.clientY >= mkl.y && e.clientY <= mkl.y + mkl.h) {
    state.currentRoot = (state.currentRoot - 1 + 12) % 12;
    return;
  }
  const mkr = state.mobileKeyRight;
  if (mkr && e.clientX >= mkr.x && e.clientX <= mkr.x + mkr.w &&
      e.clientY >= mkr.y && e.clientY <= mkr.y + mkr.h) {
    state.currentRoot = (state.currentRoot + 1) % 12;
    return;
  }

  // SAVE PRESET button
  const spb = state.savePresetBtnRect;
  if (spb && e.clientX >= spb.x && e.clientX <= spb.x + spb.w &&
      e.clientY >= spb.y && e.clientY <= spb.y + spb.h) {
    openTextInput('preset-save', '');
    return;
  }

  // Preset panel scroll arrow clicks
  const psup = state.presetScrollUpBtn;
  if (psup && e.clientX >= psup.x && e.clientX <= psup.x + psup.w &&
      e.clientY >= psup.y && e.clientY <= psup.y + psup.h) {
    state.presetScrollOffset = Math.max(0, state.presetScrollOffset - 1);
    return;
  }
  const psdn = state.presetScrollDownBtn;
  if (psdn && e.clientX >= psdn.x && e.clientX <= psdn.x + psdn.w &&
      e.clientY >= psdn.y && e.clientY <= psdn.y + psdn.h) {
    const presets = loadSavedPresets();
    const { visibleRows } = getPresetPanelMetrics(CanvasMod.W, CanvasMod.H);
    state.presetScrollOffset = Math.min(Math.max(0, presets.length - visibleRows), state.presetScrollOffset + 1);
    return;
  }

  // Preset panel LOAD / DEL buttons + name click to rename
  for (const r of state.presetPanelRects || []) {
    if (e.clientX >= r.load.x && e.clientX <= r.load.x + r.load.w &&
        e.clientY >= r.load.y && e.clientY <= r.load.y + r.load.h) {
      const presets = loadSavedPresets();
      if (presets[r.idx]) loadPreset(presets[r.idx]);
      return;
    }
    if (e.clientX >= r.del.x && e.clientX <= r.del.x + r.del.w &&
        e.clientY >= r.del.y && e.clientY <= r.del.y + r.del.h) {
      deletePreset(r.idx);
      state.presetScrollOffset = Math.max(0, Math.min(
        state.presetScrollOffset, loadSavedPresets().length - 1
      ));
      return;
    }
    if (r.name && e.clientX >= r.name.x && e.clientX <= r.name.x + r.name.w &&
        e.clientY >= r.name.y && e.clientY <= r.name.y + r.name.h) {
      const presets = loadSavedPresets();
      openTextInput('preset-rename', presets[r.idx]?.name || '', r.idx);
      return;
    }
  }

  // ? help button
  const hb = state.helpBtnRect;
  if (hb && e.clientX >= hb.x && e.clientX <= hb.x + hb.w &&
      e.clientY >= hb.y && e.clientY <= hb.y + hb.h) {
    toggleHelp();
    return;
  }

  // Pin button
  const pinBtn = getPinButton(CanvasMod.W, CanvasMod.H);
  if (e.clientX >= pinBtn.x && e.clientX <= pinBtn.x + pinBtn.w &&
      e.clientY >= pinBtn.y && e.clientY <= pinBtn.y + pinBtn.h) {
    state.uiPinned = !state.uiPinned;
    return;
  }
  // [+] button
  if (hitTestAddButton(e.clientX, e.clientY)) {
    addLayer();
    state.lastMouseMove = Date.now();
    return;
  }
  // Layer card
  const hitCardIdx = hitTestLayerCard(e.clientX, e.clientY);
  if (hitCardIdx >= 0) {
    state.lastMouseMove = Date.now();
    const btnHit = hitTestLayerButtons(e.clientX, e.clientY, hitCardIdx);
    if (btnHit) {
      if (btnHit === 'rec')    startRecording(hitCardIdx);
      if (btnHit === 'stop')   stopRecording(hitCardIdx);
      if (btnHit === 'pause')  pauseLayer(hitCardIdx);
      if (btnHit === 'play')   resumeLayer(hitCardIdx);
      if (btnHit === 'clear')  clearLayer(hitCardIdx);
      if (btnHit === 'dl')     exportLayerAudio(hitCardIdx);
      if (btnHit === 'delete') { removeLayer(hitCardIdx); state.deleteConfirmLayerIdx = null; }
      if (btnHit === 'cancel') { state.deleteConfirmLayerIdx = null; }
      return;
    }
    const handleHit = hitTestLoopHandle(e.clientX, e.clientY, hitCardIdx);
    if (handleHit) {
      state.loopSliderDrags.set(e.pointerId, { layerIdx: hitCardIdx, handle: handleHit });
      return;
    }
    state.longPressTimer = setTimeout(() => {
      state.deleteConfirmLayerIdx = hitCardIdx;
      state.longPressTimer = null;
      state.longPressLayerIdx = null;
    }, 500);
    state.longPressLayerIdx = hitCardIdx;
    return;
  }

  // Scale / root / preset / octave buttons (desktop only)
  if (!CanvasMod.isMobile()) {
    for (const btn of getScaleButtons(CanvasMod.W)) {
      if (e.clientX >= btn.x && e.clientX <= btn.x + btn.w &&
          e.clientY >= btn.y && e.clientY <= btn.y + btn.h) {
        btn.action(); state.lastMouseMove = Date.now(); return;
      }
    }
    for (const btn of getRootButtons()) {
      if (e.clientX >= btn.x && e.clientX <= btn.x + btn.w &&
          e.clientY >= btn.y && e.clientY <= btn.y + btn.h) {
        if (btn.action) { btn.action(); state.lastMouseMove = Date.now(); }
        return;
      }
    }
    for (const btn of getPresetButtons(CanvasMod.W)) {
      if (e.clientX >= btn.x && e.clientX <= btn.x + btn.w &&
          e.clientY >= btn.y && e.clientY <= btn.y + btn.h) {
        btn.action();
        if (sliders_wave) {
          for (const wt of WAVE_TYPES) {
            if (sliders_wave[wt]) sliders_wave[wt].val = state.waveWeights[wt];
          }
        }
        state.lastMouseMove = Date.now();
        return;
      }
    }
    for (const btn of getOctaveButtons(CanvasMod.W)) {
      if (btn.clickable &&
          e.clientX >= btn.x && e.clientX <= btn.x + btn.w &&
          e.clientY >= btn.y && e.clientY <= btn.y + btn.h) {
        btn.action(); state.lastMouseMove = Date.now(); return;
      }
    }
  }

  // TAP button + sliders (desktop only)
  if (!CanvasMod.isMobile()) {
    const tapBtnPD = getTapButton(slider_intensity, doTap);
    if (tapBtnPD && e.clientX >= tapBtnPD.x && e.clientX <= tapBtnPD.x + tapBtnPD.w &&
        e.clientY >= tapBtnPD.y && e.clientY <= tapBtnPD.y + tapBtnPD.h) {
      doTap(); state.lastMouseMove = Date.now(); return;
    }

    if (sliders_wave) {
      let uiHit = false;
      for (const sl of allSliders()) {
        if (sl && sl.hitTest(e.clientX, e.clientY)) {
          sl.draggingId = e.pointerId;
          sl.updateVal(e.clientX);
          uiHit = true;
        }
      }
      if (uiHit) return;
    }
  }

  // Long-press scan mode（ヘックス以外の場所でも有効にする）
  if (!state.scanMode) {
    state.scanPressTimer = setTimeout(() => {
      state.scanMode = true;
      state.scanPointerId = e.pointerId;
    }, 150);
  }
});

canvas.addEventListener('pointermove', e => {
  state.lastMouseMove = Date.now();
  state.cursorX = e.clientX;
  state.cursorY = e.clientY;

  // スキャンモード
  if (state.scanMode && e.pointerId === state.scanPointerId) {
    const k = getHexKeyAtPos(e.clientX, e.clientY);
    if (k && k !== state.scanLastKey) {
      if (state.scanLastKey &&
          !state.physicalKeys.has(state.scanLastKey) &&
          ![...state.activeTouches.values()].includes(state.scanLastKey)) {
        stopKey(state.scanLastKey);
      }
      state.scanLastKey = k;
      startKey(k);
      const capturedKey = k;
      setTimeout(() => {
        if (state.scanLastKey !== capturedKey &&
            !state.physicalKeys.has(capturedKey) &&
            ![...state.activeTouches.values()].includes(capturedKey)) {
          stopKey(capturedKey);
        }
      }, 350);
    }
    return;
  }

  if (state.loopSliderDrags.has(e.pointerId)) {
    const { layerIdx, handle } = state.loopSliderDrags.get(e.pointerId);
    const layer = state.layers[layerIdx];
    const { queueX, queueW } = getQueueMetrics(CanvasMod.W, CanvasMod.H);
    const barX = queueX + 6, barW = queueW - 12;
    const ratio = Math.max(0, Math.min(1, (e.clientX - barX) / barW));
    if (handle === 'start') layer.loopStart = Math.min(ratio, layer.loopEnd - 0.05);
    else                    layer.loopEnd   = Math.max(ratio, layer.loopStart + 0.05);
    updateLayerLoopPoints(layerIdx);
    state.lastMouseMove = Date.now();
    return;
  }

  if (!CanvasMod.isMobile() && sliders_wave) {
    for (const sl of allSliders()) {
      if (sl && sl.draggingId === e.pointerId) {
        sl.updateVal(e.clientX);
        return;
      }
    }
  }

  if (state.activeTouches.has(e.pointerId)) {
    const k = getHexKeyAtPos(e.clientX, e.clientY);
    const oldK = state.activeTouches.get(e.pointerId);
    if (k && k !== oldK) {
      state.activeTouches.delete(e.pointerId);
      if (!state.physicalKeys.has(oldK) && ![...state.activeTouches.values()].includes(oldK)) {
        stopKey(oldK);
      }
      startKey(k);
      state.activeTouches.set(e.pointerId, k);
    } else if (!k) {
      state.activeTouches.delete(e.pointerId);
      if (!state.physicalKeys.has(oldK) && ![...state.activeTouches.values()].includes(oldK)) {
        stopKey(oldK);
      }
    }
  }
});

function endPointer(e) {
  if (state.longPressLayerIdx !== null) {
    clearTimeout(state.longPressTimer);
    state.longPressTimer = null;
    state.longPressLayerIdx = null;
  }
  if (state.loopSliderDrags.has(e.pointerId)) state.loopSliderDrags.delete(e.pointerId);
  clearTimeout(state.scanPressTimer);
  if (state.scanMode && e.pointerId === state.scanPointerId) {
    state.scanMode = false;
    state.scanPointerId = null;
    if (state.scanLastKey &&
        !state.physicalKeys.has(state.scanLastKey) &&
        ![...state.activeTouches.values()].includes(state.scanLastKey)) {
      stopKey(state.scanLastKey);
    }
    state.scanLastKey = null;
  }
  if (sliders_wave) {
    for (const sl of allSliders()) {
      if (sl && sl.draggingId === e.pointerId) sl.draggingId = null;
    }
  }
  if (state.activeTouches.has(e.pointerId)) {
    const oldK = state.activeTouches.get(e.pointerId);
    state.activeTouches.delete(e.pointerId);
    if (!state.physicalKeys.has(oldK) && ![...state.activeTouches.values()].includes(oldK)) {
      stopKey(oldK);
    }
  }
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

canvas.addEventListener('wheel', e => {
  const { queueX, queueW, rowsY, lockBtnY, lockBtnH, visibleRows } =
    getQueueMetrics(CanvasMod.W, CanvasMod.H);
  if (e.clientX >= queueX && e.clientX <= queueX + queueW &&
      e.clientY >= rowsY && e.clientY <= lockBtnY + lockBtnH) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    state.layerScrollOffset = Math.max(
      0,
      Math.min(Math.max(0, state.layers.length - visibleRows), state.layerScrollOffset + delta),
    );
    state.lastMouseMove = Date.now();
    return;
  }

  // Preset panel scroll
  const pm = getPresetPanelMetrics(CanvasMod.W, CanvasMod.H);
  if (e.clientX >= pm.panelX && e.clientX <= pm.panelX + pm.panelW &&
      e.clientY >= pm.rowsY && e.clientY <= pm.rowsYEnd) {
    const presets = loadSavedPresets();
    const maxOffset = Math.max(0, presets.length - pm.visibleRows);
    state.presetScrollOffset = Math.max(0, Math.min(
      state.presetScrollOffset + (e.deltaY > 0 ? 1 : -1), maxOffset
    ));
    e.preventDefault();
  }
}, { passive: false });

// ── Keyboard ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();

  // Text input overlay captures all keys
  if (state.textInput) {
    e.preventDefault();
    if (e.key === 'Enter') { commitTextInput(); return; }
    if (e.key === 'Escape') { state.textInput = null; return; }
    if (e.key === 'Backspace') {
      state.textInput.value = state.textInput.value.slice(0, -1);
      return;
    }
    // Ctrl+V / Cmd+V paste
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      navigator.clipboard.readText().then(text => {
        if (text) state.textInput.value += text.trim();
      }).catch(() => {});
      return;
    }
    if (e.key.length === 1) {
      state.textInput.value += e.key;
    }
    return;
  }

  if (state.appState === 'title') {
    startPlaying();
    return;
  }

  if (e.key === 'F11') {
    e.preventDefault();
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
    return;
  }
  if (e.key === 'Escape') {
    if (state.showHelp) { hideHelp(); return; }
    if (document.fullscreenElement) document.exitFullscreen();
    return;
  }

  if (k === ' ') {
    e.preventDefault();
    state.genMode = !state.genMode;
    state.lastMouseMove = Date.now();
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    doTap();
    state.lastMouseMove = Date.now();
    return;
  }

  if (KEY_MAP[k] && !state.physicalKeys.has(k)) {
    getAudioCtx();
    state.physicalKeys.add(k);
    startKey(k);
    state.genCurrentKey = k;
    state.lastMouseMove = Date.now();
  }
});

document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (state.physicalKeys.has(k)) {
    state.physicalKeys.delete(k);
    if (![...state.activeTouches.values()].includes(k)) stopKey(k);
  }
});

// ── Main render loop ─────────────────────────────────────
const ctx = canvas.getContext('2d', { alpha: false });

function frame(ts) {
  requestAnimationFrame(frame);

  // Show native cursor when text input overlay is active
  canvas.style.cursor = state.textInput ? 'default' : 'none';

  // Sync slider → state
  if (slider_intensity) state.sliderIntensityVal = slider_intensity.val;
  syncWeights(sliders_wave, slider_volume, slider_bpm, slider_reverb, slider_delay, slider_attack, slider_release);

  const sliders = {
    intensity: slider_intensity,
    volume:    slider_volume,
    bpm:       slider_bpm,
    reverb:    slider_reverb,
    delay:     slider_delay,
    attack:    slider_attack,
    release:   slider_release,
    wave:      sliders_wave,
  };

  renderFrame(canvas, ctx, ts, sliders);

  // AUTO generation
  stepAutoGeneration(ts / 1000, triggerKeyAuto);
}
requestAnimationFrame(frame);
