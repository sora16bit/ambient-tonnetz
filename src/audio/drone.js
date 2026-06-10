// src/audio/drone.js

const activeDrones = new Map();

export function playDrone(masterGain, audioCtx, keyId, freq) {
  if (activeDrones.has(keyId)) return;
  const droneFreq = freq / 4;

  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = droneFreq;

  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.11, now + 1.5);
  gain.gain.exponentialRampToValueAtTime(0.055, now + 4.5);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();

  activeDrones.set(keyId, { osc, gain });
}

export function releaseDrone(audioCtx, keyId) {
  if (!activeDrones.has(keyId)) return;
  const { osc, gain } = activeDrones.get(keyId);
  activeDrones.delete(keyId);
  const now = audioCtx.currentTime;
  const cur = gain.gain.value || 0.001;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(cur, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
  setTimeout(() => { osc.stop(); osc.disconnect(); gain.disconnect(); }, 3100);
}
