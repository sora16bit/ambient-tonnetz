// src/audio/engine.js
import { WAVE_TYPES, getMidiNote, midiToFreq } from '../core/constants.js';
import { state } from '../core/state.js';
import { playDrone, releaseDrone } from './drone.js';

// ── Module-level audio singletons ──────────────────────────
let audioCtx = null;
let masterCompressor = null;
export let masterGain = null;
let convolver = null;
let noiseBuffer = null;
let reverbGain = null;
let delayNode = null;
let delayFeedback = null;
let delayWetGain = null;
export let mediaStreamDest = null;
const activeVoices = new Map();

// ── Audio Context Setup ────────────────────────────────────
export function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.55; // Master headroom

    masterCompressor = audioCtx.createDynamicsCompressor();
    masterCompressor.threshold.value = -16;
    masterCompressor.knee.value = 25;
    masterCompressor.ratio.value = 10;
    masterCompressor.attack.value = 0.01;
    masterCompressor.release.value = 0.25;

    convolver = audioCtx.createConvolver();
    // 豊かなリバーブ（アンビエント空間）を生み出すインパルス応答生成
    const len = audioCtx.sampleRate * 8.0; // 4秒→8秒
    const impulse = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const _d = impulse.getChannelData(c);
      for (let j = 0; j < len; j++) {
        // より自然な指数減衰カーブ（4.0→2.8でロングテール化）
        _d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / len, 2.8);
      }
    }
    convolver.buffer = impulse;

    reverbGain = audioCtx.createGain();
    reverbGain.gain.value = 0.6; // Reverb amount

    // Routing
    masterGain.connect(convolver);
    convolver.connect(reverbGain);
    reverbGain.connect(masterCompressor);
    masterGain.connect(masterCompressor);
    masterCompressor.connect(audioCtx.destination);

    // Delay chain: masterGain → delay → feedback loop → delayWet → compressor
    delayNode = audioCtx.createDelay(2.0);
    delayNode.delayTime.value = 60 / 80 * 0.5; // eighth note at 80 BPM

    delayFeedback = audioCtx.createGain();
    delayFeedback.gain.value = 0.35;

    delayWetGain = audioCtx.createGain();
    delayWetGain.gain.value = 0.0; // start at 0 (dry)

    masterGain.connect(delayNode);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayWetGain);
    delayWetGain.connect(masterCompressor);

    // MediaRecorder用のストリーム出力（録音タップ）
    mediaStreamDest = audioCtx.createMediaStreamDestination();
    masterCompressor.connect(mediaStreamDest);

    generateNoiseBuffer();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// ── Pink Noise Buffer ──────────────────────────────────────
function generateNoiseBuffer() {
  const len = audioCtx.sampleRate * 3.0; // 3 secs loop
  noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = noiseBuffer.getChannelData(0);
  // 優しいピンクノイズ（Pink Noise）フィルタ
  let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    d[i] = pink * 0.08;
  }
}

// ── Master Volume ──────────────────────────────────────────
export function applyMasterVolume() {
  if (masterGain) masterGain.gain.value = 0.55 * (state.masterVolumeVal / 100);
}

// ── Voice Playback ─────────────────────────────────────────
export function playKeyTarget(x, y, volume = 0.8) {
  const ac = getAudioCtx();
  const keyId = `${x},${y}`;

  if (activeVoices.has(keyId)) releaseVoice(keyId);

  const totalWeight = Object.values(state.waveWeights).reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return;

  let freq = midiToFreq(getMidiNote(x, y) + state.octaveShift * 12);
  // スマホのスピーカー等でも綺麗に鳴るよう、低すぎる帯域・高すぎる帯域を折り返す（元の仕様の復活と改善）
  while (freq > 1200) freq /= 2;
  while (freq < 90)   freq *= 2;

  const envGain = ac.createGain();
  const now = ac.currentTime;

  // ADSR: Soft attack, gentle sustain
  envGain.gain.setValueAtTime(0, now);
  envGain.gain.linearRampToValueAtTime(volume * 0.8, now + state.attackTime);
  envGain.gain.exponentialRampToValueAtTime(volume * 0.35, now + state.attackTime + 1.5);
  envGain.connect(masterGain);

  const oscs = [];

  for (const wt of WAVE_TYPES) {
    const w = state.waveWeights[wt];
    if (w <= 0) continue;

    const typeGain = ac.createGain();
    typeGain.gain.value = (w / totalWeight) * 0.45;
    typeGain.connect(envGain);

    if (wt === 'noise') {
      const src = ac.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;
      src.connect(typeGain);
      src.start();
      oscs.push(src);
    } else if (wt === 'bell') {
      const f0 = freq, f1 = freq * 2, f2 = freq * 3.5;
      [ {f: f0, a: 0.6}, {f: f1, a: 0.3}, {f: f2, a: 0.1} ].forEach(({f, a}) => {
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const g = ac.createGain();
        g.gain.value = a;
        osc.connect(g);
        g.connect(typeGain);
        osc.start();
        oscs.push(osc);
      });
    } else {
      // Add subtle detune for extra width
      const osc1 = ac.createOscillator();
      osc1.type = wt;
      osc1.frequency.value = freq;

      const osc2 = ac.createOscillator();
      osc2.type = wt;
      osc2.frequency.value = freq * 1.006;

      osc1.connect(typeGain);
      osc2.connect(typeGain);

      // コーラス LFO
      const lfo = ac.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.25 + Math.random() * 0.45; // 0.25-0.7 Hz

      const lfoGain = ac.createGain();
      lfoGain.gain.value = 3.5 + Math.random() * 3.5; // ±3.5-7 Hz変調

      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);

      osc1.start();
      osc2.start();
      lfo.start();
      oscs.push(osc1, osc2, lfo);
    }
  }

  activeVoices.set(keyId, { gain: envGain, oscs: oscs });
  playDrone(masterGain, ac, keyId, freq);
}

// ── Voice Release ──────────────────────────────────────────
export function releaseVoice(keyId) {
  if (!activeVoices.has(keyId)) return;
  const voice = activeVoices.get(keyId);
  activeVoices.delete(keyId);

  const ac = getAudioCtx();
  const now = ac.currentTime;

  // Smooth release
  const currentVol = voice.gain.gain.value || 0.001;
  voice.gain.gain.cancelScheduledValues(now);
  voice.gain.gain.setValueAtTime(currentVol, now);
  voice.gain.gain.exponentialRampToValueAtTime(0.001, now + state.releaseTime);

  setTimeout(() => {
    voice.oscs.forEach(o => { o.stop(); o.disconnect(); });
    voice.gain.disconnect();
  }, (state.releaseTime + 0.1) * 1000);
  releaseDrone(ac, keyId);
}

// ── FX Sync ────────────────────────────────────────────────
export function syncWeights(sliders_wave, slider_volume, slider_bpm, slider_reverb, slider_delay, slider_attack, slider_release) {
  if (!sliders_wave) return;
  for (const wt of WAVE_TYPES) state.waveWeights[wt] = sliders_wave[wt].val;
  if (slider_volume) { state.masterVolumeVal = slider_volume.val; applyMasterVolume(); }
  if (slider_bpm)    { state.bpm = Math.round(slider_bpm.val); }
  if (slider_reverb && reverbGain) {
    state.sliderReverbVal = slider_reverb.val;
    reverbGain.gain.value = (slider_reverb.val / 100) * 2.0;
  }
  if (slider_delay && delayWetGain && delayNode) {
    state.sliderDelayVal = slider_delay.val;
    delayWetGain.gain.value = (slider_delay.val / 100) * 0.8;
    delayNode.delayTime.value = (60 / state.bpm) * 0.5;
  }
  if (slider_attack)  state.attackTime  = slider_attack.val;
  if (slider_release) state.releaseTime = slider_release.val;
}

// ── Tap Tempo ──────────────────────────────────────────────
export function tapTempo(slider_bpm) {
  const now = performance.now();
  state.tapTimes.push(now);
  if (state.tapTimes.length > 6) state.tapTimes.shift();
  if (state.tapTimes.length < 2) return;
  let total = 0;
  for (let i = 1; i < state.tapTimes.length; i++) total += state.tapTimes[i] - state.tapTimes[i - 1];
  const avgMs = total / (state.tapTimes.length - 1);
  const newBpm = Math.round(60000 / avgMs);
  state.bpm = Math.max(40, Math.min(200, newBpm));
  if (slider_bpm) slider_bpm.val = state.bpm;
  setTimeout(() => {
    if (state.tapTimes.length && performance.now() - state.tapTimes[state.tapTimes.length - 1] > 3000) {
      state.tapTimes = [];
    }
  }, 3100);
}
