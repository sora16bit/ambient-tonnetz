// src/pro/url-share.js
import { WAVE_TYPES } from '../core/constants.js';

export function encodeURL(snapshot) {
  const params = new URLSearchParams();
  params.set('scale', snapshot.currentScale);
  params.set('root', snapshot.currentRoot);
  params.set('bpm', Math.round(snapshot.bpm));
  params.set('octave', snapshot.octaveShift);
  for (const wt of WAVE_TYPES) {
    const val = snapshot.waveWeights[wt];
    if (val > 0) params.set(`w_${wt}`, Math.round(val));
  }
  return `${location.origin}${location.pathname}?${params}`;
}

export function decodeURL() {
  const params = new URLSearchParams(location.search);
  const getStr = (key) => params.has(key) ? params.get(key) : null;
  const getInt = (key) => params.has(key) ? parseInt(params.get(key), 10) : null;
  return {
    currentScale: getStr('scale'),
    currentRoot:  getInt('root'),
    bpm:          getInt('bpm'),
    octaveShift:  getInt('octave'),
    waveWeights:  Object.fromEntries(
      WAVE_TYPES.map(wt => [wt, getInt(`w_${wt}`)])
    ),
  };
}
