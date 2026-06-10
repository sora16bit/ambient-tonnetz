// src/pro/presets.js

const STORAGE_KEY = 'tonnet_saved_presets';

export function captureSnapshot(state) {
  return {
    name: `Preset ${new Date().toISOString().slice(0,16).replace('T',' ')}`,
    currentScale: state.currentScale,
    currentRoot: state.currentRoot,
    bpm: Math.round(state.bpm),
    octaveShift: state.octaveShift,
    waveWeights: { ...state.waveWeights },
    sliderIntensityVal: state.sliderIntensityVal,
    sliderReverbVal: state.sliderReverbVal,
    sliderDelayVal: state.sliderDelayVal,
    attackTime: state.attackTime,
    releaseTime: state.releaseTime,
  };
}

export function loadSavedPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistPresets(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function savePreset(state, name) {
  const presets = loadSavedPresets();
  const snapshot = captureSnapshot(state);
  snapshot.name = name || snapshot.name;
  presets.push(snapshot);
  persistPresets(presets);
  return snapshot;
}

export function deletePreset(index) {
  const presets = loadSavedPresets();
  presets.splice(index, 1);
  persistPresets(presets);
}

export function renamePreset(index, newName) {
  const presets = loadSavedPresets();
  if (!presets[index]) return;
  presets[index].name = newName;
  persistPresets(presets);
}

export function exportPresetsJSON() {
  const presets = loadSavedPresets();
  const blob = new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `tonnet-presets-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importPresetsJSON(file, onDone) {
  const reader = new FileReader();
  reader.onerror = () => onDone(null);
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) return;
      const existing = loadSavedPresets();
      const merged = [...existing, ...imported];
      persistPresets(merged);
      onDone(merged.length);
    } catch {
      onDone(null);
    }
  };
  reader.readAsText(file);
}
