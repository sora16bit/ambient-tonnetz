const STRINGS = {
  en: {
    presetSaved: 'PRESET SAVED',
    presetLoaded: 'PRESET LOADED',

    // Help overlay
    helpTitle: '✦ Ambient Tonnetz — Help',
    helpHowToPlay: 'HOW TO PLAY',
    helpHowToPlayBody: 'Click or tap the hexagonal grid to play notes.\nKeyboard and touch input fully supported.',
    helpHowToPlayBody2: 'Adjust scale, key, BPM, and waveform in the top panel.\nStack multiple layers to build ambient loops.',
    helpShortcuts: 'SHORTCUTS',
    helpShortcutsList: [
      ['Space', 'Toggle auto mode'],
      ['Tab', 'Tap tempo'],
      ['F11', 'Toggle fullscreen'],
      ['Esc', 'Exit fullscreen / close'],
    ],
    helpLayers: 'LAYERS',
    helpLayersBody: 'Manage independent loops from the layer queue (bottom-left).\nStack as many layers as you like.',
    helpPro: '✦ FEATURES',
    helpProList: [
      ['WAV export', 'per layer'],
      ['Preset save & export', 'store your sounds'],
      ['Unlimited layers', 'no limit'],
    ],

    // UI hidden hint
    uiHiddenHint: 'Move mouse to show controls',

    // Share toast
    urlCopied: 'URL COPIED!',

    // Lang toggle
    langToggle: '日本語',

    // Help tour annotations
    tourHexGrid: 'Tap or click to play notes',
    tourScale: 'Scale · Root key',
    tourWaveMix: 'Waveform mix display',
    tourLayers: 'Record & loop layers',
    tourEffects: 'Reverb · Delay · Attack · Release',
    tourBpm: 'BPM · Volume',
    tourPreset: 'Sound preset',
    tourAuto: 'Auto-play toggle',
    tourClose: 'Click anywhere to close',
  },

  ja: {
    presetSaved: 'PRESET SAVED',
    presetLoaded: 'PRESET LOADED',

    helpTitle: '✦ Ambient Tonnetz — ヘルプ',
    helpHowToPlay: '使い方',
    helpHowToPlayBody: '六角グリッドをクリック／タップして音を鳴らします。\nキーボードおよびタッチ操作に対応しています。',
    helpHowToPlayBody2: '上部パネルでスケール・キー・BPM・波形を調整。\n複数レイヤーを重ねてアンビエントなループを作れます。',
    helpShortcuts: 'ショートカット',
    helpShortcutsList: [
      ['Space', 'オートモード ON / OFF'],
      ['Tab', 'タップテンポ'],
      ['F11', 'フルスクリーン切替'],
      ['Esc', 'フルスクリーン終了 / 閉じる'],
    ],
    helpLayers: 'レイヤー',
    helpLayersBody: '左下のレイヤーキューから独立したループを管理できます。\nレイヤーは好きなだけ重ねられます。',
    helpPro: '✦ できること',
    helpProList: [
      ['WAVエクスポート', 'レイヤーごと'],
      ['プリセット保存・エクスポート', '音色を保存'],
      ['レイヤー無制限', '制限なし'],
    ],

    uiHiddenHint: 'マウスを動かしてUIを表示',

    urlCopied: 'URL COPIED!',

    langToggle: 'English',

    tourHexGrid: '六角グリッドをタップして演奏',
    tourScale: 'スケール・キー',
    tourWaveMix: '波形ミックス表示',
    tourLayers: 'ループを録音・再生',
    tourEffects: 'リバーブ・ディレイ・アタック・リリース',
    tourBpm: 'BPM・音量',
    tourPreset: '音色プリセット',
    tourAuto: '自動演奏ON/OFF',
    tourClose: 'どこかをタップして閉じる',
  },
};

const STORAGE_KEY = 'tonnet_lang';

function detectLang() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved;
  return navigator.language?.startsWith('ja') ? 'ja' : 'en';
}

export let currentLang = detectLang();

export function t(key) {
  return STRINGS[currentLang]?.[key] ?? STRINGS.en[key] ?? key;
}

export function toggleLang() {
  currentLang = currentLang === 'en' ? 'ja' : 'en';
  localStorage.setItem(STORAGE_KEY, currentLang);
}

export function setLang(lang) {
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
}
