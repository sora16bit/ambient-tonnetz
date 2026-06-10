// ============================================================
//  src/ui/layerqueue.js  —  レイヤーキュー描画 (index.html.bak から抽出)
// ============================================================
import { LAYER_CARD_COLORS } from '../core/constants.js';
import { state } from '../core/state.js';
import { getAudioCtx } from '../audio/engine.js';

// ── レイアウトメトリクス
export function getQueueMetrics(W, H) {
  const rowH = 58, rowGap = 6, queueW = 174;
  const queueX = 10;
  const lockBtnH = 22, addBtnH = 22;
  const lockBtnY = H - 55;
  const addBtnY  = lockBtnY - lockBtnH - 5;
  const rowsYEnd = addBtnY - 6;
  const kbBottomY = Math.floor(H / 2) + 136;
  const rowsY = kbBottomY + 8;
  const visibleH = Math.max(0, rowsYEnd - rowsY);
  const visibleRows = Math.max(1, Math.floor((visibleH + rowGap) / (rowH + rowGap)));
  return { rowH, rowGap, queueW, queueX, lockBtnY, lockBtnH, addBtnY, addBtnH, rowsY, rowsYEnd, visibleRows };
}

// ── ピンボタン矩形
export function getPinButton(W, H) {
  const { queueW, queueX, lockBtnY, lockBtnH } = getQueueMetrics(W, H);
  return { x: queueX, y: lockBtnY, w: queueW, h: lockBtnH };
}

// ── カードスタイルボタン描画
export function drawCardButton(ctx, x, y, w, h, label, color, fontSize = 11) {
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 4);
  else ctx.rect(x, y, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(label, x + w / 2, y + h / 2);
  ctx.restore();
}

// ── レイヤー行の Y 座標を返す
export function getLayerRowY(idx, metrics) {
  const { rowH, rowGap, rowsY } = metrics;
  const vi = idx - state.layerScrollOffset;
  return rowsY + vi * (rowH + rowGap);
}

// ── 単一レイヤー行の描画
export function drawLayerRow(ctx, idx, uAlpha, W, H, callbacks) {
  const layer = state.layers[idx];
  const metrics = getQueueMetrics(W, H);
  const { rowH, queueX, queueW } = metrics;
  const cx = queueX;
  const ry = getLayerRowY(idx, metrics);
  const [cr, cg, cb] = LAYER_CARD_COLORS[idx % LAYER_CARD_COLORS.length];
  const stateAlpha = layer.state === 'idle' ? 0.55 : layer.state === 'paused' ? 0.75 : 1.0;
  ctx.save();
  ctx.globalAlpha = uAlpha * stateAlpha;
  // background
  ctx.fillStyle = 'rgba(20,25,40,0.90)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx, ry, queueW, rowH, 4);
  else ctx.rect(cx, ry, queueW, rowH);
  ctx.fill();
  // left color bar
  ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
  ctx.fillRect(cx, ry + 4, 3, rowH - 8);
  // border
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx, ry, queueW, rowH, 4);
  else ctx.rect(cx, ry, queueW, rowH);
  ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.4)`;
  ctx.lineWidth = 1;
  ctx.stroke();
  // label
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
  ctx.fillText(`L${idx + 1}`, cx + 7, ry + 11);
  // state indicator (blink on record)
  const stateStr = { idle: '○', recording: '●', decoding: '…', playing: '▶', paused: '⏸' }[layer.state];
  if (!(layer.state === 'recording' && Math.sin(Date.now() / 200) < 0)) {
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = layer.state === 'recording' ? 'rgb(255,80,80)' : `rgba(${cr},${cg},${cb},0.8)`;
    ctx.fillText(stateStr, cx + queueW - 4, ry + 11);
  }
  // progress bar
  const barX = cx + 6, barW = queueW - 12, barY = ry + 24;
  ctx.fillStyle = 'rgba(50,55,70,0.9)';
  ctx.fillRect(barX, barY, barW, 3);
  if ((layer.state === 'playing' || layer.state === 'paused') && layer.duration > 0) {
    const elapsed = layer.state === 'playing'
      ? (getAudioCtx().currentTime - layer.startTime) % layer.duration
      : layer.pausedAt;
    ctx.fillStyle = layer.state === 'paused' ? `rgba(${cr},${cg},${cb},0.45)` : `rgb(${cr},${cg},${cb})`;
    ctx.fillRect(barX, barY, Math.floor(barW * elapsed / layer.duration), 3);
    const lx1 = barX + layer.loopStart * barW;
    const lx2 = barX + layer.loopEnd   * barW;
    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.5)`;
    ctx.fillRect(lx1, barY, lx2 - lx1, 3);
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
    ctx.beginPath(); ctx.arc(lx1, barY + 1, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(lx2, barY + 1, 4, 0, Math.PI * 2); ctx.fill();
  }
  // buttons
  const btnAreaX = cx + 5, btnAreaW = queueW - 10;
  const btnY = ry + rowH - 17, btnH = 14;
  if (state.deleteConfirmLayerIdx === idx) {
    ctx.globalAlpha = uAlpha;
    ctx.fillStyle = 'rgba(0,0,10,0.96)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx, ry, queueW, rowH, 4);
    else ctx.rect(cx, ry, queueW, rowH);
    ctx.fill();
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgb(255,220,80)';
    ctx.fillText('削除?', cx + queueW / 2, ry + 14);
    const hw = Math.floor((btnAreaW - 4) / 2);
    drawCardButton(ctx, btnAreaX,          ry + 27, hw, 13, 'DEL', 'rgb(255,80,80)');
    drawCardButton(ctx, btnAreaX + hw + 4, ry + 27, hw, 13, 'NO',  'rgba(180,180,180,0.8)');
  } else if (layer.state === 'idle') {
    drawCardButton(ctx, btnAreaX, btnY, btnAreaW, btnH, '● REC', 'rgba(200,80,80,0.9)');
  } else if (layer.state === 'recording') {
    drawCardButton(ctx, btnAreaX, btnY, btnAreaW, btnH, '■ STOP', 'rgb(255,80,80)');
  } else if (layer.state === 'playing' || layer.state === 'paused') {
    const tw = Math.floor((btnAreaW - 6) / 3);
    const pauseLabel = layer.state === 'playing' ? '||' : '▶';
    const pauseColor = layer.state === 'playing' ? 'rgba(255,200,60,0.9)' : `rgba(${cr},${cg},${cb},0.9)`;
    drawCardButton(ctx, btnAreaX,              btnY, tw, btnH, pauseLabel, pauseColor, layer.state === 'playing' ? 8 : 11);
    drawCardButton(ctx, btnAreaX + tw + 3,     btnY, tw, btnH, 'CLR', 'rgba(80,85,110,0.9)');
    drawCardButton(ctx, btnAreaX + (tw + 3)*2, btnY, tw, btnH, 'DL',  `rgba(${cr},${cg},${cb},0.9)`);
  } else {
    drawCardButton(ctx, btnAreaX, btnY, btnAreaW, btnH, '…', 'rgba(80,85,110,0.5)');
  }
  ctx.restore();
}

// ── レイヤーキュー全体の描画
export function drawLayerQueue(ctx, uAlpha, W, H, callbacks) {
  const { rowH, rowGap, queueW, queueX, lockBtnY, lockBtnH, addBtnY, addBtnH, rowsY, visibleRows } = getQueueMetrics(W, H);
  ctx.save();
  // HIDE/SHOW button always fully visible so user can always find it
  ctx.globalAlpha = 1.0;
  const lockLabel = state.uiPinned ? 'SHOW UI' : 'HIDE UI';
  const lockColor = state.uiPinned ? [255, 220, 80] : [120, 130, 160];
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(queueX, lockBtnY, queueW, lockBtnH, 4);
  else ctx.rect(queueX, lockBtnY, queueW, lockBtnH);
  ctx.strokeStyle = state.uiPinned ? `rgb(${lockColor.join(',')})` : 'rgba(255,255,255,0.2)';
  ctx.lineWidth = state.uiPinned ? 2 : 1;
  ctx.stroke();
  ctx.font = state.uiPinned ? 'bold 12px monospace' : '12px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = state.uiPinned ? `rgb(${lockColor.join(',')})` : 'rgba(255,255,255,0.5)';
  ctx.fillText(lockLabel, queueX + queueW / 2, lockBtnY + lockBtnH / 2);
  // ADD LAYER button
  ctx.globalAlpha = uAlpha * 0.75;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(queueX, addBtnY, queueW, addBtnH, 4);
  else ctx.rect(queueX, addBtnY, queueW, addBtnH);
  ctx.strokeStyle = 'rgba(180,180,200,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(180,180,200,0.7)';
  ctx.fillText('+ LAYER', queueX + queueW / 2, addBtnY + addBtnH / 2);
  // rows (single column, visibleRows layers)
  for (let vi = 0; vi < visibleRows; vi++) {
    const idx = state.layerScrollOffset + vi;
    if (idx >= state.layers.length) break;
    drawLayerRow(ctx, idx, uAlpha, W, H, callbacks);
  }
  // scroll indicators flush against the actual row edges
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  const actualCount = Math.min(visibleRows, state.layers.length - state.layerScrollOffset);
  const lastRowBottom = rowsY + actualCount * (rowH + rowGap) - rowGap;
  const arrowW = queueW, arrowH = 14;
  const arrowCX = queueX + queueW / 2;

  state.layerScrollUpBtn = null;
  state.layerScrollDownBtn = null;

  if (state.layerScrollOffset > 0) {
    const ay = rowsY - 13;
    ctx.fillStyle = 'rgba(180,180,200,0.70)';
    ctx.fillText('▲', arrowCX, ay + 10);
    state.layerScrollUpBtn = { x: queueX, y: ay, w: arrowW, h: arrowH };
  }
  if (state.layerScrollOffset + visibleRows < state.layers.length) {
    const ay = lastRowBottom + 2;
    ctx.fillStyle = 'rgba(180,180,200,0.70)';
    ctx.fillText('▼', arrowCX, ay + 10);
    state.layerScrollDownBtn = { x: queueX, y: ay, w: arrowW, h: arrowH };
  }
  ctx.restore();
}
