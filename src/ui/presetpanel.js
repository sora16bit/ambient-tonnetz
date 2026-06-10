// src/ui/presetpanel.js
import { state } from '../core/state.js';
import { loadSavedPresets } from '../pro/presets.js';

const ROW_H = 40, ROW_GAP = 5, PANEL_W = 160;

export function getPresetPanelMetrics(W, H) {
  const panelX = W - PANEL_W - 10;
  const saveBtnH = 22, saveBtnY = H - 55;
  const rowsYEnd = saveBtnY - 6;
  const kbBottomY = Math.floor(H / 2) + 136;
  const rowsY = kbBottomY + 8;
  const visibleH = Math.max(0, rowsYEnd - rowsY);
  const visibleRows = Math.max(1, Math.floor((visibleH + ROW_GAP) / (ROW_H + ROW_GAP)));
  return { panelX, panelW: PANEL_W, rowH: ROW_H, rowGap: ROW_GAP,
           saveBtnY, saveBtnH, rowsY, rowsYEnd, visibleRows };
}

export function drawPresetPanel(ctx, uAlpha, W, H) {
  const { panelX, panelW, rowH, rowGap, saveBtnY, saveBtnH, rowsY, visibleRows } = getPresetPanelMetrics(W, H);
  const presets = loadSavedPresets();

  ctx.save();

  // SAVE PRESET button (always visible; non-PRO shown dimmed)
  const btnColor = state.isPro ? 'rgba(255,220,0,0.6)' : 'rgba(120,130,160,0.35)';
  const txtColor = state.isPro ? 'rgba(255,220,0,0.9)' : 'rgba(120,130,160,0.5)';
  ctx.globalAlpha = uAlpha * 0.85;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(panelX, saveBtnY, panelW, saveBtnH, 4);
  else ctx.rect(panelX, saveBtnY, panelW, saveBtnH);
  ctx.strokeStyle = btnColor;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = txtColor;
  ctx.fillText('+ SAVE PRESET', panelX + panelW / 2, saveBtnY + saveBtnH / 2);
  state.savePresetBtnRect = { x: panelX, y: saveBtnY, w: panelW, h: saveBtnH };

  // Preset rows (Pro only)
  const rects = [];
  if (!state.isPro) { state.presetPanelRects = rects; ctx.restore(); return; }
  for (let vi = 0; vi < visibleRows; vi++) {
    const idx = state.presetScrollOffset + vi;
    if (idx >= presets.length) break;
    const preset = presets[idx];
    const ry = rowsY + vi * (rowH + rowGap);

    ctx.globalAlpha = uAlpha * 0.8;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(panelX, ry, panelW, rowH, 4);
    else ctx.rect(panelX, ry, panelW, rowH);
    ctx.strokeStyle = 'rgba(255,220,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // LOAD / DEL buttons — right column (40px wide)
    const btnColX = panelX + panelW - 46;
    const loadX = btnColX, loadY = ry + 6,  loadW = 40, loadH = 13;
    const delX  = btnColX, delY  = ry + 22, delW  = 40, delH  = 13;

    // name (clickable area for rename) — space left of button column
    const nameAreaX = panelX + 6;
    const nameAreaW = btnColX - panelX - 10;
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(232,239,255,0.9)';
    let name = preset.name;
    while (ctx.measureText(name).width > nameAreaW && name.length > 1) name = name.slice(0, -1);
    if (name !== preset.name) name += '…';
    ctx.fillText(name, nameAreaX, ry + 11);

    // scale/bpm info
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(120,130,160,0.8)';
    ctx.fillText(`${preset.currentScale.toUpperCase()} / ${preset.bpm}bpm`, nameAreaX, ry + 26);

    // LOAD button
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(loadX, loadY, loadW, loadH, 3);
    else ctx.rect(loadX, loadY, loadW, loadH);
    ctx.strokeStyle = 'rgba(60,220,160,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(60,220,160,0.9)';
    ctx.fillText('LOAD', loadX + loadW / 2, loadY + loadH / 2);

    // DEL button
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(delX, delY, delW, delH, 3);
    else ctx.rect(delX, delY, delW, delH);
    ctx.strokeStyle = 'rgba(255,80,80,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,80,80,0.7)';
    ctx.fillText('DEL', delX + delW / 2, delY + delH / 2);

    rects.push({ idx,
                 row:    { x: panelX, y: ry, w: panelW, h: rowH },
                 name:   { x: nameAreaX, y: ry, w: nameAreaW, h: rowH / 2 + 4 },
                 load:   { x: loadX, y: loadY, w: loadW, h: loadH },
                 del:    { x: delX,  y: delY,  w: delW,  h: delH  } });
  }
  state.presetPanelRects = rects;

  // scroll indicators
  const shown = Math.min(visibleRows, presets.length - state.presetScrollOffset);
  const lastBottom = rowsY + shown * (rowH + rowGap) - rowGap;
  const arrowW = panelW, arrowH = 14;
  const arrowCX = panelX + panelW / 2;

  state.presetScrollUpBtn = null;
  state.presetScrollDownBtn = null;

  if (state.presetScrollOffset > 0) {
    const ay = rowsY - 13;
    ctx.globalAlpha = uAlpha * 0.7;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(180,180,200,0.7)';
    ctx.fillText('▲', arrowCX, ay + 10);
    state.presetScrollUpBtn = { x: panelX, y: ay, w: arrowW, h: arrowH };
  }
  if (state.presetScrollOffset + visibleRows < presets.length) {
    const ay = lastBottom + 2;
    ctx.globalAlpha = uAlpha * 0.7;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(180,180,200,0.7)';
    ctx.fillText('▼', arrowCX, ay + 10);
    state.presetScrollDownBtn = { x: panelX, y: ay, w: arrowW, h: arrowH };
  }

  ctx.restore();
}
