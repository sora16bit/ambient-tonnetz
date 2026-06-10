import { describe, it, expect } from 'vitest';
import { getMidiNote, midiToFreq, isInScale, SCALES, KEY_MAP, WAVE_TYPES, NOTE_NAMES } from '../src/core/constants.js';

describe('getMidiNote', () => {
  it('中央C（x=5, y=1）はMIDI 60を返す', () => {
    expect(getMidiNote(5, 1)).toBe(60);
  });
  it('x方向に1動くと7半音変化する', () => {
    expect(getMidiNote(6, 1)).toBe(67);
  });
});

describe('midiToFreq', () => {
  it('MIDI 69（A4）は440Hzを返す', () => {
    expect(midiToFreq(69)).toBeCloseTo(440.0);
  });
  it('MIDI 60（C4）は261.63Hzを返す', () => {
    expect(midiToFreq(60)).toBeCloseTo(261.63, 1);
  });
});

describe('isInScale', () => {
  it('chromaticは全ノートをtrueで返す', () => {
    for (let i = 0; i < 12; i++) {
      expect(isInScale(i, 'chromatic', 0)).toBe(true);
    }
  });
  it('Cメジャースケールは C,D,E,F,G,A,B のみtrue', () => {
    const cMajor = [0, 2, 4, 5, 7, 9, 11];
    for (let i = 0; i < 12; i++) {
      expect(isInScale(i, 'major', 0)).toBe(cMajor.includes(i));
    }
  });
  it('SCALES定数が正しく定義されている', () => {
    expect(SCALES.chromatic.notes).toHaveLength(12);
    expect(SCALES.major.notes).toHaveLength(7);
    expect(SCALES.penta.notes).toHaveLength(5);
  });
});

describe('KEY_MAP', () => {
  it('30キーが定義されている', () => {
    expect(Object.keys(KEY_MAP)).toHaveLength(30);
  });
  it('qキーは[0,0]', () => {
    expect(KEY_MAP['q']).toEqual([0, 0]);
  });
});

describe('WAVE_TYPES', () => {
  it('6種類の波形がある', () => {
    expect(WAVE_TYPES).toHaveLength(6);
    expect(WAVE_TYPES).toContain('sine');
    expect(WAVE_TYPES).toContain('noise');
  });
});
