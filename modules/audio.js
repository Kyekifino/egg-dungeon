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
  badlands:    { bpm:100, wave:'sawtooth', vol:0.04, notes:[
    [50,1.5],[53,0.5],[57,1  ],[60,1  ],
    [57,0.5],[55,0.5],[53,1  ],
    [50,0.5],[58,0.5],[57,1  ],
    [55,0.5],[53,0.5],[50,2  ],
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
  underground: { bpm: 55, wave:'square',   vol:0.03, notes:[
    [57,2  ],[58,1  ],[55,2  ],
    [57,1  ],[53,1.5],[52,0.5],[50,2  ],
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
  const base = 'WASD:&nbsp;move &nbsp;·&nbsp; 1-6:&nbsp;select &nbsp;·&nbsp; F:&nbsp;feed &nbsp;·&nbsp; R:&nbsp;lay&nbsp;egg &nbsp;·&nbsp; C:&nbsp;collection &nbsp;·&nbsp; M:&nbsp;mute &nbsp;·&nbsp; Ctrl+S/O:&nbsp;save/load &nbsp;·&nbsp; ?:&nbsp;feedback';
  const mTag = muted ? ' &nbsp;<span style="color:#e05050">[MUTED]</span>' : '';
  document.getElementById('controls').innerHTML = base + mTag;
}
