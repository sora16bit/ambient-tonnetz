// src/audio/recorder.js
import { state } from '../core/state.js';
import { getAudioCtx, masterGain, mediaStreamDest } from './engine.js';

// ── Layer Management ───────────────────────────────────────
export function createLayer() {
  return {
    state: 'idle',
    mediaRecorder: null,
    chunks: [],
    blob: null,
    source: null,
    audioBuffer: null,
    startTime: 0,
    duration: 0,
    loopStart: 0,
    loopEnd: 1,
    pausedAt: 0,
  };
}

export function addLayer() {
  state.layers.push(createLayer());
}

export function removeLayer(idx) {
  clearLayer(idx);
  state.layers.splice(idx, 1);
  state.layerScrollOffset = Math.max(0, Math.min(state.layerScrollOffset, Math.max(0, state.layers.length - 1)));
}

// ── Recording ─────────────────────────────────────────────
export function startRecording(idx = 0) {
  if (!mediaStreamDest) return;
  const layer = state.layers[idx];
  layer.chunks = [];
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus' : 'audio/webm';
  layer.mediaRecorder = new MediaRecorder(mediaStreamDest.stream, { mimeType });
  layer.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) layer.chunks.push(e.data); };
  layer.mediaRecorder.onstop = async () => {
    layer.blob = new Blob(layer.chunks, { type: 'audio/webm' });
    try {
      const ab = await layer.blob.arrayBuffer();
      getAudioCtx().decodeAudioData(ab, buf => startLayerPlayback(idx, buf));
    } catch(err) { layer.state = 'idle'; }
  };
  layer.mediaRecorder.start();
  layer.state = 'recording';
}

export function stopRecording(idx = 0) {
  const layer = state.layers[idx];
  if (layer.mediaRecorder && layer.mediaRecorder.state === 'recording') {
    layer.mediaRecorder.stop();
    layer.state = 'decoding';
  }
}

// ── Playback ──────────────────────────────────────────────
export function startLayerPlayback(idx, audioBuffer) {
  const layer = state.layers[idx];
  if (layer.source) { layer.source.stop(); layer.source.disconnect(); }
  const ac = getAudioCtx();
  layer.audioBuffer = audioBuffer;
  layer.source = ac.createBufferSource();
  layer.source.buffer = audioBuffer;
  layer.source.loop = true;
  layer.source.loopStart = layer.loopStart * audioBuffer.duration;
  layer.source.loopEnd   = layer.loopEnd   * audioBuffer.duration;
  layer.source.connect(masterGain);
  layer.source.start(0, layer.loopStart * audioBuffer.duration);
  layer.startTime = ac.currentTime;
  layer.duration  = (layer.loopEnd - layer.loopStart) * audioBuffer.duration;
  layer.state = 'playing';
}

export function clearLayer(idx = 0) {
  const layer = state.layers[idx];
  if (layer.source) { layer.source.stop(); layer.source.disconnect(); layer.source = null; }
  layer.audioBuffer = null;
  layer.blob = null; layer.chunks = []; layer.duration = 0;
  layer.loopStart = 0; layer.loopEnd = 1;
  layer.state = 'idle';
}

export function pauseLayer(idx) {
  const layer = state.layers[idx];
  if (layer.state !== 'playing') return;
  const ac = getAudioCtx();
  const elapsed = ac.currentTime - layer.startTime;
  layer.pausedAt = layer.duration > 0 ? elapsed % layer.duration : 0;
  if (layer.source) { layer.source.stop(); layer.source.disconnect(); layer.source = null; }
  layer.state = 'paused';
}

export function resumeLayer(idx) {
  const layer = state.layers[idx];
  if (layer.state !== 'paused' || !layer.audioBuffer) return;
  const ac = getAudioCtx();
  layer.source = ac.createBufferSource();
  layer.source.buffer = layer.audioBuffer;
  layer.source.loop = true;
  layer.source.loopStart = layer.loopStart * layer.audioBuffer.duration;
  layer.source.loopEnd   = layer.loopEnd   * layer.audioBuffer.duration;
  layer.source.connect(masterGain);
  layer.source.start(0, layer.pausedAt);
  layer.startTime = ac.currentTime - layer.pausedAt;
  layer.state = 'playing';
}

export function updateLayerLoopPoints(idx) {
  const layer = state.layers[idx];
  if (!layer.source || !layer.audioBuffer || (layer.state !== 'playing')) return;
  layer.source.loopStart = layer.loopStart * layer.audioBuffer.duration;
  layer.source.loopEnd   = layer.loopEnd   * layer.audioBuffer.duration;
  layer.duration = (layer.loopEnd - layer.loopStart) * layer.audioBuffer.duration;
}

// ── WAV Export ────────────────────────────────────────────
export function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const byteRate = sr * blockAlign;
  const dataSize = numFrames * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const write = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

export async function exportLayerAudio(idx) {
  const layer = state.layers[idx];
  if (!layer.blob) return;

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  try {
    const ab = await layer.blob.arrayBuffer();
    getAudioCtx().decodeAudioData(ab.slice(0), wavBuf => {
      const wavBlob = audioBufferToWav(wavBuf);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url; a.download = `tonnet-L${idx+1}-${ts}.wav`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  } catch(e) {
    const url = URL.createObjectURL(layer.blob);
    const a = document.createElement('a');
    a.href = url; a.download = `tonnet-L${idx+1}-${ts}.webm`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
