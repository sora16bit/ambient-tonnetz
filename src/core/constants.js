// ============================================================
//  定数・純粋関数  (index.html.bak からの抽出)
// ============================================================

export const HEX_SIZE = 58;
export const FPS = 60;

export const COLOR_SPACE_DEEP = [2, 4, 15];
export const COLOR_SPACE_VOID = [0, 1, 5];
export const COLOR_ACCENT = [255, 220, 0];
export const COLOR_TEXT   = [120, 130, 160];

export const WAVE_COLORS = {
  sine:     [0, 210, 255],
  triangle: [0, 255, 100],
  square:   [255, 160, 0],
  sawtooth: [255, 0, 130],
  bell:     [255, 240, 0],
  noise:    [180, 0, 255],
};
export const WAVE_TYPES = Object.keys(WAVE_COLORS);

export const NOTE_COLORS = [
  [255,20,80],[255,90,0],[255,210,0],[60,255,20],
  [0,255,130],[0,240,255],[0,130,255],[80,0,255],
  [200,0,255],[255,0,200],[255,0,80],[255,50,0],
];

export const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// スケール定義（半音インデックス、C基準）
export const SCALES = {
  chromatic:  { label: 'ALL',   notes: [0,1,2,3,4,5,6,7,8,9,10,11] },
  major:      { label: 'MAJ',   notes: [0,2,4,5,7,9,11] },
  minor:      { label: 'MIN',   notes: [0,2,3,5,7,8,10] },
  penta:      { label: 'PENTA', notes: [0,2,4,7,9] },
  blues:      { label: 'BLUES', notes: [0,3,5,6,7,10] },
};
export const SCALE_KEYS = Object.keys(SCALES);

// プリセット定義
export const PRESETS = {
  pad:   { label:'PAD',   weights:{ sine:80, triangle:40, square:0, sawtooth:0, bell:0,  noise:0  } },
  bell:  { label:'BELL',  weights:{ sine:20, triangle:0,  square:0, sawtooth:0, bell:100,noise:0  } },
  glass: { label:'GLASS', weights:{ sine:60, triangle:30, square:0, sawtooth:0, bell:50, noise:0  } },
  pluck: { label:'PLUCK', weights:{ sine:40, triangle:0,  square:0, sawtooth:60,bell:0,  noise:10 } },
  chaos: { label:'CHAOS', weights:{ sine:50, triangle:50, square:50,sawtooth:50,bell:50, noise:50 } },
};

// Key → grid (x, y)
export const KEY_MAP = {
  q:[0,0],w:[1,0],e:[2,0],r:[3,0],t:[4,0],
  y:[5,0],u:[6,0],i:[7,0],o:[8,0],p:[9,0],
  a:[0,1],s:[1,1],d:[2,1],f:[3,1],g:[4,1],
  h:[5,1],j:[6,1],k:[7,1],l:[8,1],';':[9,1],
  z:[0,2],x:[1,2],c:[2,2],v:[3,2],b:[4,2],
  n:[5,2],m:[6,2],',':[7,2],'.':[8,2],'/':[9,2],
};

export const KEY_NAMES = {
  q:'Q',w:'W',e:'E',r:'R',t:'T',y:'Y',u:'U',i:'I',o:'O',p:'P',
  a:'A',s:'S',d:'D',f:'F',g:'G',h:'H',j:'J',k:'K',l:'L',';':';',
  z:'Z',x:'X',c:'C',v:'V',b:'B',n:'N',m:'M',',':',','.':'.','/':'/',
};

// Reverse: "x,y" → key
export const POS_TO_KEY = {};
for (const [k, [x, y]] of Object.entries(KEY_MAP)) POS_TO_KEY[`${x},${y}`] = k;

// 基準ノート
export function getMidiNote(x, y) { return 60 + (x - 5) * 7 - (y - 1) * 4; }
export function midiToFreq(note) { return 440.0 * Math.pow(2, (note - 69) / 12); }

// NOTE: オリジナルはグローバル変数を参照していたが、ここでは引数として受け取る
export function isInScale(midiNote, currentScale, currentRoot) {
  if (currentScale === 'chromatic') return true;
  const semitone = ((midiNote % 12) + 12) % 12;
  const rootOffset = ((semitone - currentRoot) % 12 + 12) % 12;
  return SCALES[currentScale].notes.includes(rootOffset);
}

// リップルリング定義（line ~463）
export const RING_DEFS = [
  { delay: 0,  speed: 0.5,  startAlpha: 210, decay: 1.2, hasFill: true  },
  { delay: 10, speed: 0.65, startAlpha: 160, decay: 1.5, hasFill: false },
  { delay: 21, speed: 0.8,  startAlpha: 110, decay: 1.9, hasFill: false },
];

// レイヤーカードカラー（line ~709）
export const LAYER_CARD_COLORS = [
  [80,220,120],[80,160,255],[255,180,60],
  [255,120,180],[120,255,220],[200,160,255],
];

// スケール・プリセットボタン色（line ~1189）
export const SCALE_COLORS = {
  chromatic: [180, 180, 220],
  major:     [ 60, 220, 100],
  minor:     [ 80, 150, 255],
  penta:     [255, 190,  40],
  blues:     [190,  70, 255],
};
export const PRESET_COLORS = {
  pad:   [ 60, 180, 255],
  bell:  [255, 240,  60],
  glass: [ 60, 255, 210],
  pluck: [255, 110,  40],
  chaos: [255,  50, 170],
};
