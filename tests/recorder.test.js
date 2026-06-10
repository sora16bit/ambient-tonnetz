import { describe, it, expect } from 'vitest';
import { audioBufferToWav } from '../src/audio/recorder.js';

function makeFakeAudioBuffer(numChannels, numFrames, sampleRate) {
  const channels = Array.from({ length: numChannels }, () => new Float32Array(numFrames));
  return {
    numberOfChannels: numChannels,
    sampleRate,
    length: numFrames,
    getChannelData: (ch) => channels[ch],
  };
}

describe('audioBufferToWav', () => {
  it('BlobのtypeがAudio/wavである', () => {
    const buf = makeFakeAudioBuffer(2, 1024, 44100);
    const blob = audioBufferToWav(buf);
    expect(blob.type).toBe('audio/wav');
  });

  it('Blobのサイズが44 + frames*channels*2バイト', () => {
    const buf = makeFakeAudioBuffer(2, 1024, 44100);
    const blob = audioBufferToWav(buf);
    expect(blob.size).toBe(44 + 1024 * 2 * 2);
  });

  it('ヘッダーにRIFFマジックバイトが含まれる', async () => {
    const buf = makeFakeAudioBuffer(1, 512, 44100);
    const blob = audioBufferToWav(buf);
    const ab = await blob.arrayBuffer();
    const view = new DataView(ab);
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    expect(riff).toBe('RIFF');
  });

  it('サンプルレートがヘッダーに正しく書き込まれる', async () => {
    const buf = makeFakeAudioBuffer(2, 256, 48000);
    const blob = audioBufferToWav(buf);
    const ab = await blob.arrayBuffer();
    const view = new DataView(ab);
    expect(view.getUint32(24, true)).toBe(48000);
  });

  it('チャンネル数がヘッダーに正しく書き込まれる', async () => {
    const buf = makeFakeAudioBuffer(1, 256, 44100);
    const blob = audioBufferToWav(buf);
    const ab = await blob.arrayBuffer();
    const view = new DataView(ab);
    expect(view.getUint16(22, true)).toBe(1);
  });
});
