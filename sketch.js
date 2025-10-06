// HuntGame - p5.js
// Click wolves to kill them before they reach the bear.

let bearImg, beeImg;
let bear;
let wolves = [];
let particles = [];
let hematomas = 0;
const maxHematomas = 3;
// Audio
let audioCtx = null;
let bgOsc1 = null, bgOsc2 = null, bgGain = null;
let masterGain = null;
let musicPlaying = false;
let musicInterval = null;
let gameOver = false;
let score = 0;
let startTime = 0;
let elapsed = 0;
let playerName = null;
let running = false;

// spawn control
let spawnInterval = 1500; // ms
let lastSpawn = 0;
let wolvesPerWave = 1;
let waveIncreaseInterval = 20000; // 20s
let lastWaveIncrease = 0;

function preload(){
  bearImg = loadImage('assets/bear.svg');
  beeImg = loadImage('assets/bee.svg');
}

function setup(){
  gameOver = false;
  const canvas = createCanvas(800, 500);
  canvas.parent('canvas-container');
  imageMode(CENTER);
  textFont('Arial');
  resetGame();

  // create a DOM overlay cursor inside canvas container
  const container = document.getElementById('canvas-container');
  let cursorEl = document.getElementById('gameCursor');
  if(!cursorEl){
    cursorEl = document.createElement('div');
    cursorEl.id = 'gameCursor';
    // idle SVG (net) as background image
    cursorEl.style.backgroundImage = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><g fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='16' cy='14' r='8'/><path d='M22 24 L36 38' /><rect x='34' y='36' width='8' height='3' rx='1' transform='rotate(20 38 37)' fill='%23000' /></g></svg>")`;
    cursorEl.style.backgroundRepeat = 'no-repeat';
    cursorEl.style.backgroundSize = '48px 48px';
    container.appendChild(cursorEl);
  }

  // update cursor on mouse move
  container.addEventListener('mousemove', (e)=>{
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cursorEl.style.left = x + 'px';
    cursorEl.style.top = y + 'px';
  });
  // click feedback: toggle class and show a different small SVG briefly
  container.addEventListener('mousedown', ()=>{
    cursorEl.classList.add('click');
    // a quick visual change: use a 'squash' overlay
    cursorEl.style.backgroundImage = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><g fill='%23fff' stroke='%23000' stroke-width='1.5'><rect x='8' y='10' width='32' height='16' rx='8' fill='%23ffdd66' stroke='none'/><path d='M16 28 L32 44' stroke='%23000' stroke-width='2' stroke-linecap='round'/></g></svg>")`;
  });
  container.addEventListener('mouseup', ()=>{
    cursorEl.classList.remove('click');
    // restore idle image
    cursorEl.style.backgroundImage = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><g fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='16' cy='14' r='8'/><path d='M22 24 L36 38' /><rect x='34' y='36' width='8' height='3' rx='1' transform='rotate(20 38 37)' fill='%23000' /></g></svg>")`;
  });

  document.getElementById('startBtn').addEventListener('click', ()=>{
    if(!running){
      // clear any previous gameOver flag (starting fresh)
      gameOver = false;
      // ask for player name if not set
      if(!playerName){
        playerName = promptPlayerName();
        if(!playerName) return; // cancelled
      }
      document.getElementById('player').textContent = playerName;
      running = true;
      startTime = millis();
      lastSpawn = millis();
      lastWaveIncrease = millis();
      // start background music on first user gesture
      startBackgroundMusic();
    }
  });
  document.getElementById('restartBtn').addEventListener('click', ()=>{
    // clear gameOver and reuse existing playerName if available, otherwise ask
    gameOver = false;
    if(!playerName){
      playerName = promptPlayerName();
      if(!playerName) return;
    }
    document.getElementById('player').textContent = playerName;
    resetGame();
    running = true;
    startTime = millis();
    lastSpawn = millis();
    lastWaveIncrease = millis();
    startBackgroundMusic();
  });
  // UI sounds on button press
  document.getElementById('startBtn').addEventListener('mousedown', ()=>{ playUiClick(); });
  document.getElementById('restartBtn').addEventListener('mousedown', ()=>{ playUiClick(); });

  // render leaderboard at load
  renderLeaderboard();

  // volume slider and mute button wiring
  const volSlider = document.getElementById('volumeSlider');
  const muteBtn = document.getElementById('muteBtn');
  if(volSlider){
    // init slider from storage
    const saved = parseFloat(localStorage.getItem('HuntGame:volume'));
    volSlider.value = isNaN(saved) ? 80 : Math.round(saved * 100);
    volSlider.addEventListener('input', (e)=>{
      const v = Number(e.target.value) / 100;
      ensureAudio();
      setMasterVolume(v);
      // unmute if was muted
      localStorage.setItem('HuntGame:muted','0');
      if(muteBtn) muteBtn.textContent = '🔊';
    });
  }
  if(muteBtn){
    const muted = localStorage.getItem('HuntGame:muted') === '1';
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.addEventListener('click', ()=>{
      ensureAudio();
      const isMuted = toggleMute();
      muteBtn.textContent = isMuted ? '🔇' : '🔊';
    });
  }

  // clear buttons
  const clearMy = document.getElementById('clearMyBtn');
  if(clearMy) clearMy.addEventListener('click', ()=>{
    if(!playerName){ alert('Nenhum jogador definido.'); return; }
    const ok = confirm('Remover seu recorde ('+playerName+') do leaderboard?');
    if(!ok) return;
    let arr = loadLeaderboard();
    arr = arr.filter(e => !(e.name && e.name.toLowerCase() === playerName.toLowerCase()));
    saveLeaderboard(arr);
    renderLeaderboard();
  });
  const clearAll = document.getElementById('clearAllBtn');
  if(clearAll) clearAll.addEventListener('click', ()=>{
    const ok = confirm('Limpar TODO o leaderboard? Esta ação não pode ser desfeita.');
    if(!ok) return;
    saveLeaderboard([]);
    renderLeaderboard();
  });
}

function resetGame(){
  wolves = [];
  score = 0;
  elapsed = 0;
  running = false;
  gameOver = false;
  // reset spawn parameters
  spawnInterval = 1500;
  wolvesPerWave = 1;
  lastSpawn = 0;
  lastWaveIncrease = 0;
  // place bear randomly but not too close to edges
  // keep the bear away from edges with a comfortable margin
  const margin = 120; // increased margin for better central play area
  bear = {
    x: random(margin, width - margin),
    y: random(margin, height - margin),
    r: 36
  };
  hematomas = 0;
  // reset bear effects (init properties)
  bear.flashTime = 0;
  bear.shakeTime = 0;
  updateUI();
}

function spawnWolf(){
  // pick a spawn point at least 120px away from bear
  let x,y;
  let tries = 0;
  do{
    const edge = floor(random(4));
    if(edge==0){ x = -40; y = random(0,height); }
    if(edge==1){ x = width+40; y = random(0,height); }
    if(edge==2){ x = random(0,width); y = -40; }
    if(edge==3){ x = random(0,width); y = height+40; }
    tries++;
  }while(dist(x,y,bear.x,bear.y) < 120 && tries<30);

  const speed = random(0.4, 1.2) + elapsed/60000; // a bit faster com o tempo
  wolves.push({x,y,vx:0,vy:0,speed, r:28, alive:true, spawnT:millis()});
}

function updateUI(){
  document.getElementById('timer').textContent = 'Tempo: ' + Math.floor(elapsed/1000) + 's';
  document.getElementById('score').textContent = 'Pontos: ' + score;
  document.getElementById('health').textContent = 'Hematomas: ' + hematomas + '/' + maxHematomas;
}

function draw(){
  background(159,211,199);

  // If game over, draw overlay persistently and skip updates
  if(gameOver){
    showGameOver();
    return;
  }

  if(running){
    elapsed = millis() - startTime;

    // increase wave difficulty every 20s
    if(millis() - lastWaveIncrease > waveIncreaseInterval){
      wolvesPerWave++;
      lastWaveIncrease = millis();
    }

    // spawn wolves
    if(millis() - lastSpawn > spawnInterval){
      for(let i=0;i<wolvesPerWave;i++) spawnWolf();
      lastSpawn = millis();
      // gradually decrease spawnInterval to increase pressure
      spawnInterval = max(500, spawnInterval - 20);
    }
  }

  // draw bear
  // bear visual effects (flash/shake)
  push();
  const shake = (bear.shakeTime>0) ? random(-6,6) : 0;
  translate(bear.x + shake, bear.y + shake);
  if(bear.flashTime>0){
    tint(255, 150, 150);
    bear.flashTime -= 1;
  } else {
    noTint();
  }
  image(bearImg,0,0, bear.r*2, bear.r*2);
  pop();
  // decrement shake so it eventually stops
  if(bear.shakeTime > 0) bear.shakeTime -= 1;

  // update wolves
  for(let i=wolves.length-1;i>=0;i--){
    const w = wolves[i];
    // if squashed, play squash animation (no movement)
    if(w.squashed){
      // draw squashed bee: scale Y down, rotate slightly, fade out
      push();
      translate(w.x, w.y);
      const t = w.squashTime / 18; // 1..0
      const scaleY = map(t,1,0,1,0.2);
      const scaleX = map(t,1,0,1,1.15);
      rotate(w.squashRot * (1 - t));
      scale(scaleX, scaleY);
      tint(255, 255 * t);
      image(beeImg,0,0, w.r*2, w.r*2);
      pop();
      // decrement squash timer
      if(w.squashTime > 0) w.squashTime -= 1; else w.squashed = false;
      continue;
    }
    if(!w.alive) continue;
    const angle = atan2(bear.y - w.y, bear.x - w.x);
    w.vx = cos(angle) * w.speed;
    w.vy = sin(angle) * w.speed;
    w.x += w.vx;
    w.y += w.vy;

    // draw bee (enemy)
    push();
    translate(w.x, w.y);
    rotate(angle+PI/2);
    image(beeImg,0,0, w.r*2, w.r*2);
    pop();

    // reached bear? sting event
    if(dist(w.x,w.y,bear.x,bear.y) < bear.r + w.r - 6){
      // apply hematoma and sting effect
        applySting(w);
      // remove bee
      w.alive = false;
      particlesPush(w.x, w.y, '#ffcc33');
      playStingSound();
      // remove non-alive (stung) bees shortly
      setTimeout(()=>{ wolves = wolves.filter(x=>x.alive); }, 120);
    }
  }

  // update particles
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.life -= p.dt;
    p.vy += 0.04; // gravity
    if(p.life <= 0) particles.splice(i,1);
  }

  // draw particles
  for(const p of particles){
    noStroke();
    if(p.label){
      fill(p.color);
      textSize(14);
      textAlign(CENTER,CENTER);
      text(p.label, p.x, p.y - (40 - p.life*0.2));
    } else {
      fill(p.color);
      ellipse(p.x, p.y, 6,6);
    }
  }

  // draw HUD
  fill(255,255,255,180);
  noStroke();
  rect(8,8,150,36,8);
  rect(width-158,8,150,36,8);
  fill(0);
  textSize(16);
  textAlign(LEFT, CENTER);
  text('Tempo: ' + Math.floor(elapsed/1000) + 's', 16, 26);
  textAlign(RIGHT, CENTER);
  text('Pontos: ' + score, width-16, 26);
}

function mousePressed(){
  if(!running) return;
  // check wolves from top to bottom
  // only allow one bee per click — iterate and squash the first hittable bee
  for(let i=wolves.length-1;i>=0;i--){
    const w = wolves[i];
    if(!w.alive) continue;
    // use a tighter hit radius (bee radius) to avoid multi-hit clusters
    if(dist(mouseX,mouseY,w.x,w.y) < w.r){
      // kill
      // mark as squashed to show squash animation before removal
      w.alive = false;
      w.squashed = true;
      w.squashTime = 18; // frames of squash animation
      w.squashRot = random(-0.6,0.6);
      // score and UI
      score += 1;
      updateUI();
      // visual and sound
      particlesPush(w.x,w.y,'#ffd24a', 18);
      playSquashSound();
      spawnScorePop(w.x,w.y,'+1');
      // remove this specific bee after animation ends
      const id = i;
      setTimeout(()=>{ if(wolves[id] && wolves[id].squashed === false) return; wolves = wolves.filter((_,idx)=> idx !== id); }, 220);
      break;
    }
  }
}

// play a squash sound: short noise burst + pitch bend to simulate squish
function playSquashSound(){
  ensureAudio();
  const ctx = audioCtx;
  // create a short noise buffer
  const bufferSize = 0.2 * ctx.sampleRate; // 200ms
  const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for(let i=0;i<bufferSize;i++){
    // higher energy at start, decay quickly
    data[i] = (Math.random()*2 -1) * (1 - i/bufferSize) * (0.9);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.001, ctx.currentTime);
  nGain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.005);
  nGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

  // a short pitchy oscillator layered for a 'squash' tonal element
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  const now = ctx.currentTime;
  o.frequency.setValueAtTime(800, now);
  o.frequency.exponentialRampToValueAtTime(220, now + 0.14);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.14, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

  // connect both to destination (mix) via masterGain when available
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

function applySting(w){
  hematomas = Math.min(maxHematomas, hematomas + 1);
  updateUI();
  // hurt effect on bear (tint + shake)
  // small flash + shake
  particlesPush(bear.x,bear.y,'#ff6666',12);
  bear.flashTime = 12;
  bear.shakeTime = 18;
  // visual offset will be applied in draw
  // if reached max hematomas => game over
  if(hematomas >= maxHematomas){
    running = false;
    gameOver = true;
    stopBackgroundMusic();
    setTimeout(()=>{ showGameOver();
      // save score to leaderboard using current playerName
      const improved = addScoreToLeaderboard(playerName, score);
      if(improved){
        const fb = document.getElementById('recordFeedback');
        if(fb){ fb.style.display = 'block'; setTimeout(()=>{ fb.style.display='none'; }, 2200); }
      }
    }, 200);
  }
}

function promptPlayerName(){
  let name = prompt('Digite seu nome para o ranking (máx 20 chars):','');
  if(!name) return null;
  name = name.trim().slice(0,20);
  return name;
}

function loadLeaderboard(){
  try{
    const raw = localStorage.getItem('HuntGame:leaderboard');
    if(!raw) return [];
    const arr = JSON.parse(raw);
    if(!Array.isArray(arr)) return [];
    return arr;
  }catch(e){ console.error('loadLeaderboard',e); return []; }
}

function saveLeaderboard(arr){
  try{ localStorage.setItem('HuntGame:leaderboard', JSON.stringify(arr)); }catch(e){ console.error('saveLeaderboard',e); }
}

function addScoreToLeaderboard(name,score){
  const arr = loadLeaderboard();
  const cleanName = (name || '---').trim().slice(0,20);
  // find existing entry with same name (case-insensitive)
  const existingIdx = arr.findIndex(e => e.name && e.name.toLowerCase() === cleanName.toLowerCase());
  let improved = false;
  if(existingIdx >= 0){
    // replace only if new score is greater than existing
    if((score||0) > (arr[existingIdx].score||0)){
      arr[existingIdx].score = score||0;
      arr[existingIdx].date = Date.now();
      improved = true;
    } else {
      // no improvement: render current leaderboard and return false
      renderLeaderboard();
      return false;
    }
  } else {
    arr.push({name: cleanName, score: score||0, date: Date.now()});
    improved = true;
  }
  arr.sort((a,b)=> b.score - a.score || a.date - b.date);
  const top = arr.slice(0,10);
  saveLeaderboard(top);
  renderLeaderboard();
  return improved;
}

function renderLeaderboard(){
  const list = document.getElementById('leaderList');
  list.innerHTML = '';
  const arr = loadLeaderboard();
  if(arr.length === 0){
    const li = document.createElement('li'); li.textContent = 'Nenhum registro ainda'; list.appendChild(li); return;
  }
  arr.forEach((it,idx)=>{
    const li = document.createElement('li');
    li.textContent = `${idx+1}. ${it.name} — ${it.score}`;
    list.appendChild(li);
  });
}

function particlesPush(x,y,color,count=8){
  for(let i=0;i<count;i++){
    const ang = random(TWO_PI);
    const spd = random(1,3);
    particles.push({x:x,y:y,vx:cos(ang)*spd,vy:sin(ang)*spd,life:random(30,60),dt:1,color});
  }
}

function spawnScorePop(x,y,text){
  // simple temporary text particle
  particles.push({x,y,vx:0,vy:-1,life:40,dt:1,color:'#ffffff',label:text,scale:1});
}

function showGameOver(){
  // simple overlay
  stopBackgroundMusic();
  push();
  fill(0,180);
  rect(0,0,width,height);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(36);
  text('Game Over', width/2, height/2 - 34);
  textSize(22);
  text('Pontos finais: ' + score, width/2, height/2 + 6);
  textSize(16);
  text('Clique em Reiniciar para jogar novamente', width/2, height/2 + 44);
  pop();
}

// --- Audio helpers ------------------------------------------------
function ensureAudio(){
  if(audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // create a master gain to control overall volume
  masterGain = audioCtx.createGain();
  const savedVol = parseFloat(localStorage.getItem('HuntGame:volume'));
  const vol = (isNaN(savedVol) ? 0.08 : savedVol);
  masterGain.gain.value = vol;
  masterGain.connect(audioCtx.destination);
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

function playUiClick(){ playClickSound(); }

function startBackgroundMusic(){
  ensureAudio();
  if(musicPlaying) return;
  // resume audio context if suspended (user gesture may be needed)
  if(audioCtx.state === 'suspended') audioCtx.resume();
  // chiptune sequencer: melody + bass with short ADSR
  bgGain = audioCtx.createGain();
  bgGain.gain.value = 0.08; // relative to master
  // connect bgGain through masterGain so the slider controls everything
  if(masterGain) bgGain.connect(masterGain); else bgGain.connect(audioCtx.destination);

  const melody = [784, 0, 880, 0, 988, 0, 880, 0]; // upbeat small motif
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
    // schedule melody and bass for this step
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

// set master volume (0.0 - 1.0)
function setMasterVolume(v){
  if(!audioCtx) return;
  if(!masterGain) return;
  masterGain.gain.setValueAtTime(v, audioCtx.currentTime);
  localStorage.setItem('HuntGame:volume', v);
}

function toggleMute(){
  if(!audioCtx || !masterGain) return;
  const isMuted = localStorage.getItem('HuntGame:muted') === '1';
  if(isMuted){
    // unmute
    const saved = parseFloat(localStorage.getItem('HuntGame:volume')) || 0.08;
    masterGain.gain.setValueAtTime(saved, audioCtx.currentTime);
    localStorage.setItem('HuntGame:muted','0');
    return false;
  } else {
    // mute
    masterGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    localStorage.setItem('HuntGame:muted','1');
    return true;
  }
}
