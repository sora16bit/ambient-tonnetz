// ============================================================
//  src/core/auto.js  —  AUTO (自動生成) ロジック
//  オリジナルの render loop (index.html.bak lines ~2054-2111) を抽出
// ============================================================
import { KEY_MAP, POS_TO_KEY, getMidiNote, isInScale } from './constants.js';
import { state } from './state.js';

/**
 * 1 フレーム分の AUTO 生成をステップする。
 *
 * @param {number} now          現在時刻（秒単位; ts / 1000）
 * @param {(k: string) => void} triggerKeyAuto 単音を自動トリガーする関数
 */
export function stepAutoGeneration(now, triggerKeyAuto) {
  if (!state.genMode) return;

  const intensityRatio = state.sliderIntensityVal / 100;
  if (intensityRatio <= 0) return; // intensity 0 = 完全停止

  // BPM-quantized interval: intensity maps note density 0.25→4 notes/beat
  const beatsPerSec = state.bpm / 60;
  const notesPerBeat = 0.25 + intensityRatio * 3.75;
  const stepInterval = 1 / (beatsPerSec * notesPerBeat);
  const minInterval = stepInterval * 0.88;
  const maxInterval = stepInterval * 1.12;
  const restProb = Math.max(0, 0.45 - intensityRatio * 0.45);

  if (now - state.genLastTime <= state.genNextInterval) return;

  state.genNextInterval = minInterval + Math.random() * (maxInterval - minInterval);
  state.genLastTime = now;

  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];

  function getInScaleNeighbors(key) {
    const [gx, gy] = KEY_MAP[key];
    const all = dirs.map(([dx, dy]) => POS_TO_KEY[`${gx + dx},${gy + dy}`]).filter(Boolean);
    const inScale = all.filter(k => {
      const [kx, ky] = KEY_MAP[k];
      return isInScale(getMidiNote(kx, ky), state.currentScale, state.currentRoot);
    });
    return { all, inScale };
  }

  // 現在位置がスケール外なら先にスケール内へ引き戻す
  if (!isInScale(getMidiNote(...KEY_MAP[state.genCurrentKey]), state.currentScale, state.currentRoot)) {
    const { inScale } = getInScaleNeighbors(state.genCurrentKey);
    if (inScale.length) {
      state.genCurrentKey = inScale[Math.floor(Math.random() * inScale.length)];
    }
  }

  // 10%の確率でグリッド中央付近のスケール内キーにジャンプ（端への偏り防止）
  if (Math.random() < 0.10) {
    const allKeys = Object.keys(KEY_MAP);
    const centerKeys = allKeys.filter(k => {
      const [kx, ky] = KEY_MAP[k];
      return kx >= 2 && kx <= 7 && isInScale(getMidiNote(kx, ky), state.currentScale, state.currentRoot);
    });
    if (centerKeys.length) {
      state.genCurrentKey = centerKeys[Math.floor(Math.random() * centerKeys.length)];
    }
  } else {
    // スケール内の隣接キーだけを候補にする（なければ全隣接にフォールバック）
    const { all: allNeighbors, inScale: inScaleNeighbors } = getInScaleNeighbors(state.genCurrentKey);
    const candidates = inScaleNeighbors.length ? inScaleNeighbors : allNeighbors;
    if (candidates.length && Math.random() < 0.85) {
      state.genCurrentKey = candidates[Math.floor(Math.random() * candidates.length)];
    }
  }

  const [nx, ny] = KEY_MAP[state.genCurrentKey];
  const r = Math.random();
  if (r < restProb) {
    // rest
  } else if (r < restProb + 0.5) {
    triggerKeyAuto(state.genCurrentKey);
  } else {
    // コードはスケール内のものだけ追加
    const up = Math.random() < 0.5;
    const chord = [state.genCurrentKey];
    const candidates2 = up
      ? [POS_TO_KEY[`${nx + 1},${ny}`], POS_TO_KEY[`${nx},${ny + 1}`]]
      : [POS_TO_KEY[`${nx - 1},${ny}`], POS_TO_KEY[`${nx},${ny - 1}`]];
    for (const pk of candidates2) {
      if (pk && isInScale(getMidiNote(...KEY_MAP[pk]), state.currentScale, state.currentRoot)) {
        chord.push(pk);
      }
    }
    for (const pk of chord) triggerKeyAuto(pk);
  }
}
