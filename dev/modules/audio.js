// Audio system: biome music, SFX, mute toggle, controls rendering.
// Owns AudioContext and all gain nodes.

let audioCtx   = null;
let masterGain = null;
let biomeGain  = null;
let muted      = false;
let biomeLoopId  = 0;
let activeBiome  = null;

const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

const BIOME_MUSIC = {
  badlands:    { bpm:105, wave:'triangle', vol:0.05, notes:[
    [50,0.5],[52,0.5],[53,1  ],
    [52,0.5],[50,0.5],[48,0.5],[50,0.5],
    [52,1  ],[56,0.5],[57,0.5],
    [55,0.5],[53,0.5],[52,1  ],
    [50,0.5],[53,0.5],[52,0.5],[50,0.5],
    [48,0.5],[47,0.5],[45,2  ],
  ]},
  wetlands:    { bpm: 75, wave:'sine',     vol:0.05, notes:[
    [57,1  ],[60,0.5],[64,0.5],[67,1  ],
    [66,0.5],[64,0.5],[62,1  ],
    [60,0.5],[59,0.5],[57,2  ],
  ]},
  forest:      { bpm:120, wave:'triangle', vol:0.05, notes:[
    [60,0.5],[64,0.5],[67,0.5],[69,0.5],
    [67,0.5],[64,0.5],[62,0.5],[60,0.5],
    [64,0.5],[67,1  ],[69,0.5],
    [67,0.5],[64,0.5],[60,0.5],[62,0.5],[60,1],
  ]},
  underground: { bpm: 50, wave:'sine',     vol:0.06, notes:[
    [45,2  ],[47,1  ],[48,2  ],
    [47,1  ],[45,1  ],[43,3  ],
    [48,2  ],[50,1  ],[52,1.5],
    [50,0.5],[48,1  ],[45,4  ],
  ]},
  plains:      { bpm: 90, wave:'triangle', vol:0.05, notes:[
    [67,0.5],[69,0.5],[71,1  ],
    [67,0.5],[64,0.5],[62,1  ],
    [60,0.5],[62,0.5],[64,0.5],[67,0.5],
    [69,1  ],[67,1  ],
  ]},
};

export function ensureAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) {
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function playTone(midi, startTime, duration, waveType, peak, ctx, outNode) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = waveType;
  osc.frequency.value = midiHz(midi);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + 0.01);
  gain.gain.setValueAtTime(peak, startTime + duration * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(outNode ?? masterGain);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

export function startBiomeLoop(biomeKey) {
  if (biomeKey === activeBiome) return;
  const ctx = ensureAudio();
  if (!ctx) return;

  if (biomeGain) {
    const old = biomeGain;
    old.gain.cancelScheduledValues(ctx.currentTime);
    old.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    setTimeout(() => { try { old.disconnect(); } catch (_) { /* already disconnected */ } }, 900);
    biomeGain = null;
  }

  activeBiome = biomeKey;
  biomeLoopId++;
  const myId  = biomeLoopId;
  const music = BIOME_MUSIC[biomeKey];
  if (!music) return;

  const newBus = ctx.createGain();
  newBus.gain.setValueAtTime(0, ctx.currentTime);
  newBus.gain.setTargetAtTime(1, ctx.currentTime, 0.3);
  newBus.connect(masterGain);
  biomeGain = newBus;
  const myBus = newBus;

  function schedule(startTime) {
    if (biomeLoopId !== myId) return;
    const ctx  = ensureAudio();
    if (!ctx) return;
    const beat = 60 / music.bpm;
    let   t    = startTime;
    let   totalDur = 0;
    for (const [midi, beats] of music.notes) {
      const dur = beats * beat;
      playTone(midi, t, dur * 0.88, music.wave, music.vol, ctx, myBus);
      t        += dur;
      totalDur += dur;
    }
    const delay = (startTime + totalDur - ctx.currentTime) * 1000 - 300;
    setTimeout(() => schedule(startTime + totalDur), Math.max(0, delay));
  }

  schedule(ctx.currentTime + 0.05);
}

export function sfxPickup() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t   = ctx.currentTime;
  [[76,0.06],[79,0.06],[83,0.1]].forEach(([m,d],i) => {
    playTone(m, t + i * 0.055, d, 'square', 0.12, ctx);
  });
}

export function sfxGem() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t   = ctx.currentTime;
  [69,73,76,81].forEach((m,i) => {
    playTone(m, t + i * 0.065, 0.1 + i * 0.02, 'triangle', 0.13, ctx);
  });
  playTone(88, t + 0.26, 0.4, 'sine', 0.07, ctx);
}

export function sfxChestOpen() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  // Three mechanical lock clicks
  playTone(38, t,        0.05, 'square',   0.25, ctx);
  playTone(46, t + 0.07, 0.05, 'square',   0.25, ctx);
  playTone(50, t + 0.14, 0.05, 'square',   0.28, ctx);
  // Short ascending arpeggio
  playTone(60, t + 0.24, 0.12, 'triangle', 0.18, ctx);
  playTone(64, t + 0.34, 0.12, 'triangle', 0.16, ctx);
  playTone(67, t + 0.44, 0.16, 'triangle', 0.15, ctx);
  playTone(72, t + 0.56, 0.28, 'triangle', 0.13, ctx);
}

export function sfxHatch() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t   = ctx.currentTime;
  const seq = [[60,0.08],[64,0.08],[67,0.08],[72,0.28]];
  let time  = t;
  seq.forEach(([m,d]) => { playTone(m, time, d, 'triangle', 0.15, ctx); time += d + 0.01; });
  playTone(64, t + 0.25, 0.32, 'triangle', 0.08, ctx);
  playTone(67, t + 0.25, 0.32, 'triangle', 0.08, ctx);
}

export function sfxDragonHatch() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  [33, 36, 40].forEach((m, i) => playTone(m, t + i * 0.08, 0.6, 'sawtooth', 0.12, ctx));
  [45, 52, 57, 64].forEach((m, i) => playTone(m, t + 0.30 + i * 0.10, 0.5, 'triangle', 0.14 - i * 0.02, ctx));
  playTone(64, t + 0.80, 0.7, 'triangle', 0.15, ctx);
  playTone(67, t + 0.90, 0.6, 'triangle', 0.12, ctx);
  playTone(72, t + 1.00, 0.8, 'triangle', 0.10, ctx);
}

export function sfxKrakenHatch() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  [28, 31, 33].forEach((m, i) => playTone(m, t + i * 0.09, 0.7, 'sawtooth', 0.13, ctx));
  [40, 45, 48, 52].forEach((m, i) => playTone(m, t + 0.32 + i * 0.11, 0.55, 'sine', 0.14 - i * 0.02, ctx));
  playTone(52, t + 0.85, 0.9, 'sine',     0.14, ctx);
  playTone(57, t + 0.95, 0.8, 'triangle', 0.10, ctx);
  playTone(45, t + 1.05, 1.0, 'sine',     0.08, ctx);
}

export function sfxGriffonHatch() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  [57, 60, 64].forEach((m, i) => playTone(m, t + i * 0.07, 0.4, 'sawtooth', 0.10, ctx));
  [72, 76, 79, 84].forEach((m, i) => playTone(m, t + 0.28 + i * 0.09, 0.4, 'triangle', 0.13 - i * 0.02, ctx));
  playTone(79, t + 0.72, 0.6, 'triangle', 0.14, ctx);
  playTone(84, t + 0.82, 0.5, 'triangle', 0.11, ctx);
  playTone(88, t + 0.92, 0.7, 'triangle', 0.09, ctx);
}

export function sfxBeastAwaken() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  [33, 36, 38].forEach((m, i) => playTone(m, t + i * 0.10, 0.8, 'sawtooth', 0.15, ctx));
  [45, 50, 55, 59, 64].forEach((m, i) => playTone(m, t + 0.35 + i * 0.13, 0.5, 'triangle', 0.13 - i * 0.01, ctx));
  playTone(38, t + 1.1, 1.5, 'triangle', 0.12, ctx);
  playTone(45, t + 1.1, 1.5, 'sine',     0.08, ctx);
}

export function sfxSacrifice() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  [69, 65, 62, 57, 53].forEach((m, i) => playTone(m, t + i * 0.08, 0.18, 'sine', 0.09, ctx));
  playTone(45, t + 0.45, 0.45, 'triangle', 0.06, ctx);
}

export function sfxManticoreHatch() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  // Low rumbling roar
  [36, 40, 43].forEach((m, i) => playTone(m, t + i * 0.06, 0.5, 'sawtooth', 0.14, ctx));
  // Rising screech
  [55, 58, 62, 65].forEach((m, i) => playTone(m, t + 0.22 + i * 0.08, 0.4, 'triangle', 0.12 - i * 0.02, ctx));
  // Stinger strike — sharp high note
  playTone(84, t + 0.60, 0.15, 'square', 0.10, ctx);
  playTone(88, t + 0.72, 0.25, 'sawtooth', 0.08, ctx);
  playTone(76, t + 0.82, 0.6, 'triangle', 0.12, ctx);
}

export function getMuted() { return muted; }

export const SFX_BEAST_HATCH = {
  dragon:    sfxDragonHatch,
  kraken:    sfxKrakenHatch,
  griffon:   sfxGriffonHatch,
  manticore: sfxManticoreHatch,
};

export function setMuted(val) {
  muted = !!val;
  if (masterGain) masterGain.gain.value = muted ? 0 : 1;
  const ctrl = document.getElementById('controls');
  if (ctrl) {
    if (muted) ctrl.dataset.muted = '1';
    else       delete ctrl.dataset.muted;
  }
  renderControls();
}

export function toggleMute() {
  muted = !muted;
  if (masterGain) {
    masterGain.gain.setTargetAtTime(muted ? 0 : 1, audioCtx.currentTime, 0.05);
  }
  const ctrl = document.getElementById('controls');
  if (muted) ctrl.dataset.muted = '1';
  else       delete ctrl.dataset.muted;
  renderControls();
}

export function renderControls() {
  const base = 'WASD:&nbsp;move &nbsp;·&nbsp; 1-6:&nbsp;select &nbsp;·&nbsp; F:&nbsp;feed &nbsp;·&nbsp; E:&nbsp;interact &nbsp;·&nbsp; C:&nbsp;collection &nbsp;·&nbsp; M:&nbsp;mute &nbsp;·&nbsp; Ctrl+S/O:&nbsp;save/load &nbsp;·&nbsp; ?:&nbsp;feedback';
  const mTag = muted ? ' &nbsp;<span style="color:#e05050">[MUTED]</span>' : '';
  document.getElementById('controls').innerHTML = base + mTag;
}
