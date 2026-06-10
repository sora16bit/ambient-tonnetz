// ============================================================
//  中央ミュータブル状態オブジェクト
// ============================================================
import { WAVE_TYPES } from './constants.js';

export const state = {
  // Audio params
  masterVolumeVal: 70,
  octaveShift: 0,
  bpm: 80,
  attackTime: 0.15,
  releaseTime: 1.2,
  tapTimes: [],

  // Wave
  waveWeights: Object.fromEntries(WAVE_TYPES.map((wt, i) => [wt, i === 0 ? 100 : 0])),

  // Scale
  currentScale: 'chromatic',
  currentRoot: 0,
  currentPreset: null,

  // App lifecycle
  appState: 'title',
  titleAlpha: 0,
  titleExiting: false,

  // Layers
  layers: [],

  // AUTO generation
  genMode: false,
  genLastTime: 0,
  genNextInterval: 2.5,
  genCurrentKey: 'h',

  // UI
  lastMouseMove: Date.now(),
  uiAlpha: 1.0,
  uiPinned: false,
  deleteConfirmLayerIdx: null,
  loopSliderDrags: new Map(),
  longPressTimer: null,
  longPressLayerIdx: null,
  layerScrollOffset: 0,

  // Note ticker
  noteTicker: [],
  noteTickerMasterAlpha: 0,
  tickerSpeed: 0.8,

  // Scan mode
  scanMode: false,
  scanPressTimer: null,
  scanLastKey: null,
  scanPointerId: null,

  // Input
  physicalKeys: new Set(),
  pressedKeys: new Set(),
  activeTouches: new Map(),
  cursorX: -999,
  cursorY: -999,

  // Help
  showHelp: false,
  helpBtnRect: null,

  // All features unlocked (free portfolio build)
  isPro: true,
  savedPresets: [],
  savePresetBtnRect: null,
  presetScrollOffset: 0,
  presetPanelRects: [],

  // Inline text input overlay
  textInput: null, // { mode: 'preset-save'|'preset-rename', value, cursorBlink, renameIdx }
  textInputRect: null,

  // Share toast
  shareToastUntil: 0,
  toastMessage: '',

  // Sliders (set by buildSliderPositions)
  sliderIntensityVal: 30,
  sliderReverbVal: 40,
  sliderDelayVal: 0,
};
