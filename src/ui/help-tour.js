import { t } from '../i18n/strings.js';

let tourEl = null;

function hideTour(cb) {
  if (!tourEl) return;
  document.body.removeChild(tourEl);
  tourEl = null;
  if (cb) cb();
}

function isMobileLandscape(W, H) {
  return W > H && W < 1024 && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
}

function buildAnnotations(W, H) {
  if (isMobileLandscape(W, H)) {
    const barMid = H - 24;
    const kbMidY = (40 + (H - 48)) / 2;
    return [
      // キーボード — 右寄り、ラベルも右
      { x0: W * 0.72, y0: kbMidY, dx: W * 0.22, dy: 0, label: t('tourHexGrid') },
      // PRESET — 上に線
      { x0: W * 0.095, y0: barMid, dx: 0, dy: -70, label: t('tourPreset') },
      // SCALE + KEY — 上に線
      { x0: W * 0.34,  y0: barMid, dx: 0, dy: -70, label: t('tourScale') },
      // BPM + VOL — 上に線
      { x0: W * 0.65,  y0: barMid, dx: 0, dy: -70, label: t('tourBpm') },
      // AUTO — 右
      { x0: W * 0.62,  y0: 22,     dx: W * 0.28, dy: 0, label: t('tourAuto') },
    ];
  }

  // PC版アノテーション
  const kbBottom = Math.floor(H / 2) + 136;
  const row1Y = Math.max(kbBottom + 30, H - 140);
  const row2Y = Math.max(row1Y + 52, H - 88);

  return [
    {
      x0: W / 2, y0: H * 0.44,
      dx: Math.min(160, W / 2 - 60), dy: -70,
      label: t('tourHexGrid'),
    },
    {
      x0: 170, y0: 36,
      dx: 160, dy: 0,
      label: t('tourScale'),
    },
    {
      x0: W / 2, y0: 90,
      dx: Math.min(160, W / 2 - 60), dy: -32,
      label: t('tourWaveMix'),
    },
    {
      x0: 97, y0: Math.min(H / 2 + 160, H * 0.70),
      dx: 0, dy: -80,
      label: t('tourLayers'),
    },
    {
      x0: W * 0.30, y0: row1Y,
      dx: 150, dy: -50,
      label: t('tourEffects'),
    },
    {
      x0: W * 0.65, y0: row2Y,
      dx: Math.min(160, W * 0.30), dy: -32,
      label: t('tourBpm'),
    },
  ];
}

function clampTextX(x, label, anchor) {
  const approxCharW = 8;
  const len = label.length * approxCharW;
  if (anchor === 'start') return Math.min(x, window.innerWidth - len - 16);
  if (anchor === 'end')   return Math.max(x, len + 16);
  return x;
}

function annotationSVG(W, H) {
  return buildAnnotations(W, H).map(({ x0, y0, dx, dy, label }) => {
    const x1 = x0 + dx;
    const y1 = y0 + dy;
    const anchor = dx === 0 ? 'middle' : dx > 0 ? 'start' : 'end';
    const rawTextX = dx === 0 ? x1 : x1 + (dx > 0 ? 12 : -12);
    const textX = dx === 0 ? rawTextX : clampTextX(rawTextX, label, anchor);
    const textY = Math.max(16, Math.min(H - 16, y1));
    return `
<g>
  <circle cx="${x0}" cy="${y0}" r="6" fill="none" stroke="rgb(255,220,0)" stroke-width="2" opacity="0.95"/>
  <circle cx="${x0}" cy="${y0}" r="2.5" fill="rgb(255,220,0)" opacity="0.9"/>
  <line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"
    stroke="rgb(255,220,0)" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.7"/>
  <text x="${textX}" y="${textY}"
    font-family="monospace" font-size="13" fill="rgb(225,232,250)"
    text-anchor="${anchor}" dominant-baseline="middle"
    stroke="rgba(0,0,10,0.92)" stroke-width="5" paint-order="stroke">${label}</text>
</g>`;
  }).join('');
}

export function showHelpTour(onClose) {
  if (tourEl) { hideTour(onClose); return; }

  const canvas = document.getElementById('c');
  const W = canvas.width;
  const H = canvas.height;
  const screenshot = canvas.toDataURL('image/jpeg', 0.82);

  tourEl = document.createElement('div');
  tourEl.innerHTML = `
<div id="tour-root" style="
  position:fixed;inset:0;z-index:3000;cursor:pointer;
  background:#000;
">
  <img src="${screenshot}" style="
    position:absolute;inset:0;width:100%;height:100%;
    object-fit:fill;opacity:0.5;pointer-events:none;
  "/>
  <svg style="position:absolute;inset:0;width:100%;height:100%;"
       viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    ${annotationSVG(W, H)}
  </svg>
  <div style="
    position:absolute;bottom:20px;left:50%;transform:translateX(-50%);
    font-family:monospace;font-size:12px;
    color:rgba(140,150,170,0.7);
    pointer-events:none;letter-spacing:1px;
  ">${t('tourClose')}</div>
</div>`;
  document.body.appendChild(tourEl);
  tourEl.querySelector('#tour-root').addEventListener('click', () => hideTour(onClose));
}

export function toggleHelpTour() {
  tourEl ? hideTour(null) : showHelpTour(null);
}
