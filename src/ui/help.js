import { state } from '../core/state.js';
import { t, toggleLang, setLang } from '../i18n/strings.js';
import { showHelpTour } from './help-tour.js';

const FIRST_VISIT_KEY = 'tonnet_visited';
const LANG_KEY = 'tonnet_lang';

let el = null;
let _onCloseCallback = null;

function buildHTML() {
  const shortcuts = t('helpShortcutsList');
  const proList = t('helpProList');
  return `
<div id="help-overlay" style="
  position:fixed;inset:0;z-index:1000;
  background:rgba(4,6,16,0.92);
  display:flex;align-items:center;justify-content:center;
  font-family:monospace;
">
  <div style="
    background:rgb(8,12,26);border:1px solid rgba(255,220,0,0.4);
    border-radius:12px;padding:28px 32px;max-width:520px;width:calc(100% - 40px);
    max-height:90vh;overflow-y:auto;color:rgb(180,190,210);
    scrollbar-width:thin;scrollbar-color:rgba(255,220,0,0.3) transparent;
  ">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <span style="color:rgb(255,220,0);font-size:15px;font-weight:bold;">${t('helpTitle')}</span>
      <div style="display:flex;gap:8px;align-items:center;">
        <button id="help-tour" style="
          background:rgba(255,220,0,0.08);border:1px solid rgba(255,220,0,0.35);
          color:rgba(255,220,0,0.85);font-size:11px;cursor:pointer;
          padding:3px 8px;border-radius:4px;font-family:monospace;
        ">⊡ Visual</button>
        <button id="help-lang" style="
          background:rgba(255,255,255,0.06);border:1px solid rgba(120,130,160,0.4);
          color:rgba(150,160,180,0.9);font-size:11px;cursor:pointer;
          padding:3px 8px;border-radius:4px;font-family:monospace;
        ">${t('langToggle')}</button>
        <button id="help-close" style="
          background:none;border:none;color:rgba(180,190,210,0.6);
          font-size:18px;cursor:pointer;padding:0 4px;font-family:monospace;
        ">✕</button>
      </div>
    </div>

    <section style="margin-bottom:20px;">
      <div style="color:rgb(255,220,0);font-size:11px;letter-spacing:2px;margin-bottom:10px;">${t('helpHowToPlay')}</div>
      <p style="font-size:12px;line-height:1.7;margin:0 0 8px;">
        ${t('helpHowToPlayBody').replace(/\n/g, '<br>')}
      </p>
      <p style="font-size:12px;line-height:1.7;margin:0;">
        ${t('helpHowToPlayBody2').replace(/\n/g, '<br>')}
      </p>
    </section>

    <section style="margin-bottom:20px;">
      <div style="color:rgb(255,220,0);font-size:11px;letter-spacing:2px;margin-bottom:10px;">${t('helpShortcuts')}</div>
      <table style="font-size:12px;border-collapse:collapse;width:100%;">
        ${shortcuts.map(([k, v]) => `
          <tr>
            <td style="padding:4px 12px 4px 0;white-space:nowrap;">
              <kbd style="background:rgba(255,255,255,0.08);padding:2px 7px;border-radius:3px;color:rgb(255,220,0);">${k}</kbd>
            </td>
            <td style="padding:4px 0;color:rgb(150,160,180);">${v}</td>
          </tr>`).join('')}
      </table>
    </section>

    <section style="margin-bottom:20px;">
      <div style="color:rgb(255,220,0);font-size:11px;letter-spacing:2px;margin-bottom:10px;">${t('helpLayers')}</div>
      <p style="font-size:12px;line-height:1.7;margin:0;">
        ${t('helpLayersBody').replace(/\n/g, '<br>')}
      </p>
    </section>

    <section style="margin-bottom:20px;background:rgba(255,220,0,0.05);border:1px solid rgba(255,220,0,0.2);border-radius:8px;padding:14px 16px;">
      <div style="color:rgb(255,220,0);font-size:11px;letter-spacing:2px;margin-bottom:10px;">${t('helpPro')}</div>
      <ul style="font-size:12px;line-height:1.8;margin:0;padding-left:16px;color:rgb(150,160,180);">
        ${proList.map(([strong, note]) => `
          <li><strong style="color:rgb(200,210,230);">${strong}</strong> — ${note}</li>
        `).join('')}
      </ul>
    </section>

  </div>
</div>`;
}

export function showHelp(onClose) {
  if (el) hideHelp();
  _onCloseCallback = onClose || null;
  el = document.createElement('div');
  el.innerHTML = buildHTML();
  document.body.appendChild(el);

  el.querySelector('#help-close').addEventListener('click', hideHelp);
  el.querySelector('#help-tour').addEventListener('click', () => {
    const cb = _onCloseCallback;
    _onCloseCallback = null;
    hideHelp();
    showHelpTour(cb);
  });
  el.querySelector('#help-lang').addEventListener('click', () => {
    toggleLang();
    showHelp(_onCloseCallback);
  });
  el.querySelector('#help-overlay').addEventListener('click', e => {
    if (e.target.id === 'help-overlay') hideHelp();
  });

  state.showHelp = true;
}

export function hideHelp() {
  if (!el) return;
  document.body.removeChild(el);
  el = null;
  state.showHelp = false;
  if (_onCloseCallback) {
    const cb = _onCloseCallback;
    _onCloseCallback = null;
    cb();
  }
}

export function toggleHelp() {
  state.showHelp ? hideHelp() : showHelp();
}

// First-play onboarding: help → visual tour → mark visited
export function showHelpIfFirstPlay() {
  if (localStorage.getItem(FIRST_VISIT_KEY)) return;
  showHelp(() => {
    showHelpTour(() => {
      localStorage.setItem(FIRST_VISIT_KEY, '1');
    });
  });
}

// ── Language picker (shown before title on first ever visit) ──
function buildLangPickerHTML() {
  const btnStyle = `
    background:rgba(255,255,255,0.06);border:1px solid rgba(255,220,0,0.4);
    color:rgb(220,225,240);font-size:14px;cursor:pointer;
    padding:10px 28px;border-radius:6px;font-family:monospace;
    transition:background 0.15s;
  `;
  return `
<div id="lang-picker-overlay" style="
  position:fixed;inset:0;z-index:2000;
  background:rgba(4,6,16,0.96);
  display:flex;align-items:center;justify-content:center;
  font-family:monospace;
">
  <div style="
    background:rgb(8,12,26);border:1px solid rgba(255,220,0,0.4);
    border-radius:12px;padding:36px 44px;text-align:center;
    color:rgb(180,190,210);
  ">
    <div style="color:rgb(255,220,0);font-size:18px;font-weight:bold;margin-bottom:6px;">✦ Ambient Tonnetz</div>
    <div style="font-size:12px;color:rgba(150,160,180,0.7);margin-bottom:28px;">Choose your language / 言語を選択</div>
    <div style="display:flex;gap:14px;justify-content:center;">
      <button id="lang-pick-en" style="${btnStyle}">English</button>
      <button id="lang-pick-ja" style="${btnStyle}">日本語</button>
    </div>
  </div>
</div>`;
}

let langEl = null;

function hideLangPicker() {
  if (!langEl) return;
  document.body.removeChild(langEl);
  langEl = null;
}

export function showLangPickerIfFirstVisit() {
  if (localStorage.getItem(LANG_KEY)) return;

  langEl = document.createElement('div');
  langEl.innerHTML = buildLangPickerHTML();
  document.body.appendChild(langEl);

  function pick(lang) {
    setLang(lang);
    hideLangPicker();
    // Help + tour shown after user clicks play (in showHelpIfFirstPlay)
  }

  langEl.querySelector('#lang-pick-en').addEventListener('click', () => pick('en'));
  langEl.querySelector('#lang-pick-ja').addEventListener('click', () => pick('ja'));
}
