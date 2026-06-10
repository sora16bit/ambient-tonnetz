import { describe, it, expect, beforeEach } from 'vitest';
import { encodeURL, decodeURL } from '../src/pro/url-share.js';

beforeEach(() => {
  // Reset location.search
  Object.defineProperty(window, 'location', {
    value: {
      origin: 'https://example.com',
      pathname: '/',
      search: '',
      href: 'https://example.com/',
    },
    writable: true,
    configurable: true,
  });
});

describe('encodeURL', () => {
  it('基本設定をURLパラメータに変換する', () => {
    const url = encodeURL({
      currentScale: 'penta',
      currentRoot: 5,
      bpm: 120,
      octaveShift: 1,
      waveWeights: { sine: 80, triangle: 0, square: 0, sawtooth: 0, bell: 20, noise: 0 },
    });
    expect(url).toContain('scale=penta');
    expect(url).toContain('root=5');
    expect(url).toContain('bpm=120');
    expect(url).toContain('octave=1');
    expect(url).toContain('w_sine=80');
    expect(url).toContain('w_bell=20');
  });

  it('値が0のwave weightはパラメータに含まれない', () => {
    const url = encodeURL({
      currentScale: 'chromatic',
      currentRoot: 0,
      bpm: 80,
      octaveShift: 0,
      waveWeights: { sine: 100, triangle: 0, square: 0, sawtooth: 0, bell: 0, noise: 0 },
    });
    expect(url).not.toContain('w_triangle');
    expect(url).not.toContain('w_square');
    expect(url).toContain('w_sine=100');
  });
});

describe('decodeURL', () => {
  it('URLパラメータからstateを復元する', () => {
    window.location = {
      origin: 'https://example.com',
      pathname: '/',
      search: '?scale=minor&root=9&bpm=100&octave=-1&w_sine=60&w_bell=40',
      href: 'https://example.com/?scale=minor&root=9&bpm=100&octave=-1&w_sine=60&w_bell=40',
    };
    const decoded = decodeURL();
    expect(decoded.currentScale).toBe('minor');
    expect(decoded.currentRoot).toBe(9);
    expect(decoded.bpm).toBe(100);
    expect(decoded.octaveShift).toBe(-1);
    expect(decoded.waveWeights.sine).toBe(60);
    expect(decoded.waveWeights.bell).toBe(40);
    expect(decoded.waveWeights.triangle).toBeNull();
  });

  it('パラメータがない場合はnullを返す', () => {
    window.location = {
      origin: 'https://example.com',
      pathname: '/',
      search: '',
      href: 'https://example.com/',
    };
    const decoded = decodeURL();
    expect(decoded.currentScale).toBeNull();
    expect(decoded.bpm).toBeNull();
    expect(decoded.waveWeights.sine).toBeNull();
  });
});
