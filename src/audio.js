// audio.js - manages AudioContext and game sounds
let audioCtx = null;
let masterGain = null;
let bgGain = null;
let musicPlaying = false;
let musicInterval = null;

function ensureAudio(){
  if(audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  const savedVol = parseFloat(localStorage.getItem('HuntGame:volume'));
  const vol = (isNaN(savedVol) ? 0.08 : savedVol);
  masterGain.gain.value = vol;
  masterGain.connect(audioCtx.destination);
}

function setMasterVolume(v){
  if(!audioCtx || !masterGain) return;
  masterGain.gain.setValueAtTime(v, audioCtx.currentTime);
  localStorage.setItem('HuntGame:volume', v);
}

function toggleMute(){
  if(!audioCtx || !masterGain) return false;
  const isMuted = localStorage.getItem('HuntGame:muted') === '1';
  if(isMuted){
    const saved = parseFloat(localStorage.getItem('HuntGame:volume')) || 0.08;
    masterGain.gain.setValueAtTime(saved, audioCtx.currentTime);
    localStorage.setItem('HuntGame:muted','0');
    return false;
  } else {
    masterGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    localStorage.setItem('HuntGame:muted','1');
    return true;
  }
}

function startBackgroundMusic(){
  ensureAudio();
  if(musicPlaying) return;
  if(audioCtx.state === 'suspended') audioCtx.resume();
  bgGain = audioCtx.createGain();
  bgGain.gain.value = 0.08;
  if(masterGain) bgGain.connect(masterGain); else bgGain.connect(audioCtx.destination);

  const melody = [784, 0, 880, 0, 988, 0, 880, 0];
  const bass = [130, 0, 130, 0, 98, 0, 130, 0];
  const stepSec = 0.165;
  let step = 0;

  function triggerNote(freq, dur, type='square', vol=0.12){
    if(freq <= 0) return;
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g); g.connect(bgGain);
    o.start(now);
    o.stop(now + dur + 0.02);
  }

  musicInterval = setInterval(()=>{
    const m = melody[step % melody.length];
    const b = bass[step % bass.length];
    triggerNote(m, stepSec, 'square', 0.12);
    triggerNote(b, stepSec * 1.25, 'sawtooth', 0.06);
    step = (step + 1) % Math.max(melody.length, bass.length);
  }, stepSec * 1000);

  musicPlaying = true;
}

function stopBackgroundMusic(){
  if(!musicPlaying) return;
  if(musicInterval){ clearInterval(musicInterval); musicInterval = null; }
  try{ bgGain.disconnect(); } catch(e){}
  musicPlaying = false;
}

function playClickSound(){
  ensureAudio();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine'; o.frequency.value = 880;
  g.gain.value = 0.08;
  o.connect(g);
  if(masterGain) g.connect(masterGain); else g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + 0.08);
}

function playUiClick(){
  // convenience alias for UI/button click sound
  playClickSound();
}

function playStingSound(){
  ensureAudio();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'square'; o.frequency.value = 220;
  g.gain.value = 0.14;
  o.connect(g);
  if(masterGain) g.connect(masterGain); else g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + 0.25);
}

function playSquashSound(){
  ensureAudio();
  const ctx = audioCtx;
  const bufferSize = 0.2 * ctx.sampleRate;
  const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for(let i=0;i<bufferSize;i++) data[i] = (Math.random()*2 -1) * (1 - i/bufferSize) * (0.9);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.001, ctx.currentTime);
  nGain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.005);
  nGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  const now = ctx.currentTime;
  o.frequency.setValueAtTime(800, now);
  o.frequency.exponentialRampToValueAtTime(220, now + 0.14);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.14, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

  if(masterGain){
    noise.connect(nGain); nGain.connect(masterGain);
    o.connect(g); g.connect(masterGain);
  } else {
    noise.connect(nGain); nGain.connect(ctx.destination);
    o.connect(g); g.connect(ctx.destination);
  }
  noise.start(now); noise.stop(now + 0.2);
  o.start(now); o.stop(now + 0.18);
}

function playBonusSound(){
  // pleasant rising chord for big-bee bonus
  ensureAudio();
  const now = audioCtx.currentTime;
  const freqs = [660, 880, 990];
  const dur = 0.28;
  freqs.forEach((f, idx) =>{
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = (idx === 1) ? 'sine' : 'triangle';
    o.frequency.setValueAtTime(f * (1 + idx*0.01), now + idx*0.02);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.14/(idx+1), now + 0.02 + idx*0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur + idx*0.02);
    o.connect(g); if(masterGain) g.connect(masterGain); else g.connect(audioCtx.destination);
    o.start(now + idx*0.02); o.stop(now + dur + idx*0.02 + 0.02);
  });
}

function playHealSound(){
  ensureAudio();
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(660, now);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(0.08, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
  o.connect(g); if(masterGain) g.connect(masterGain); else g.connect(audioCtx.destination);
  o.start(now); o.stop(now + 0.28);
}
