// game.js - game state and logic
let wolves = [];
let score = 0;
let hematomas = 0;
const BASE_MAX_HEMATOMAS = 3;
let maxHematomas = BASE_MAX_HEMATOMAS;
let upgradeCount = 0;
const MAX_UPGRADES = 10; // maximum extra capacity from bandages
// reward/progression state
let stickerCount = 0;
let streakCount = 0;
let streakExpiry = 0;
let bear = null;
let startTime = 0;
let elapsed = 0;
let running = false;
let gameOver = false;

// spawn control
let spawnInterval = 1500; // ms
let lastSpawn = 0;
let wolvesPerWave = 1;
let waveIncreaseInterval = 20000; // 20s
let lastWaveIncrease = 0;
let lastBandageSpawn = 0;
let pendingBandage = null;

function resetGame(){
  wolves = [];
  score = 0;
  elapsed = 0;
  running = false;
  gameOver = false;
  spawnInterval = 1500;
  wolvesPerWave = 1;
  lastSpawn = 0;
  lastWaveIncrease = 0;
  const margin = 120;
  bear = { x: random(margin, width - margin), y: random(margin, height - margin), r:36, flashTime:0, shakeTime:0 };
  hematomas = 0;
  maxHematomas = BASE_MAX_HEMATOMAS;
  upgradeCount = 0;
  updateUI();
}

function spawnWolf(){
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
  const speed = random(0.4,1.2) + elapsed/60000;
  // decide type: mostly 'bee', sometimes 'bumble', very rarely 'big'
  const roll = random();
  let type = 'bee';
  if(roll > 0.85) type = 'bumble';
  if(roll > 0.98) type = 'big'; // ~2% chance for a big bee
  wolves.push(createEnemy(x,y,speed,type));
  // if big, give a glow flag for drawing
  if(wolves[wolves.length-1].type === 'big') wolves[wolves.length-1].glowUntil = millis() + 8000; // glow for 8s
}

function updateGame(){
  if(gameOver){ return; }
  if(running){
    elapsed = millis() - startTime;
    if(millis() - lastWaveIncrease > waveIncreaseInterval){ wolvesPerWave++; lastWaveIncrease = millis(); }
    if(millis() - lastSpawn > spawnInterval){ for(let i=0;i<wolvesPerWave;i++) spawnWolf(); lastSpawn = millis(); spawnInterval = max(500, spawnInterval - 20); }
    // occasionally schedule a bandage (announce, then spawn)
    if(!pendingBandage && millis() - lastBandageSpawn > 12000 + random(0,10000)){
      const bx = random(60, width-60);
      const by = random(60, height-60);
      pendingBandage = {x: bx, y: by, announceAt: millis() + 1200};
      // we will spawn it when announceAt passes and then set lastBandageSpawn
    }
    if(pendingBandage && millis() >= pendingBandage.announceAt){
      if(typeof spawnBandage === 'function') spawnBandage(pendingBandage.x, pendingBandage.y);
      pendingBandage = null;
      lastBandageSpawn = millis();
    }
  }

  // bear draw handled in main
  // enemies update
  for(let i=wolves.length-1;i>=0;i--){
    const w = wolves[i];
    if(w.squashed){
      // handle squash animation time decay
      if(w.squashTime > 0) w.squashTime -= 1; else w.squashed = false;
      continue;
    }
    if(!w.alive) continue;
    const angle = atan2(bear.y - w.y, bear.x - w.x);
    w.vx = cos(angle) * w.speed;
    w.vy = sin(angle) * w.speed;
    w.x += w.vx; w.y += w.vy;
    if(dist(w.x,w.y,bear.x,bear.y) < bear.r + w.r - 6){
      applySting(w);
      w.alive = false;
      particlesPush(w.x,w.y,'#ffcc33');
      playStingSound();
      // schedule removal shortly after sting (use timestamp to avoid relying on array index)
      w.removeAt = millis() + 120;
    }
  }

  // remove any wolves scheduled for removal
  wolves = wolves.filter(w => !(w.removeAt && millis() > w.removeAt));

  // particles updated in entities.drawParticles
  updateUI();
}

function startGame(){
  running = true;
  startTime = millis();
  lastSpawn = millis();
  lastWaveIncrease = millis();
}

function stopGame(){
  running = false;
}

function applySting(w){
  hematomas = Math.min(maxHematomas, hematomas + 1);
  updateUI();
  particlesPush(bear.x,bear.y,'#ff6666',12);
  bear.flashTime = 12;
  bear.shakeTime = 18;
  if(hematomas >= maxHematomas){
    running = false; gameOver = true; stopBackgroundMusic();
    setTimeout(()=>{
      const improved = addScoreToLeaderboard(window.playerName, score);
      if(improved){ const fb = document.getElementById('recordFeedback'); if(fb){ fb.style.display='block'; setTimeout(()=>{ fb.style.display='none'; },2200); } }
    }, 200);
  }
}

function incrementScore(points = 1){
  score += points;
  const now = millis();
  if(now < streakExpiry){
    streakCount += 1;
  } else {
    streakCount = 1;
  }
  streakExpiry = now + 1500; // 1.5s window
  updateUI();
  // sticker reward every 5 points
  if(score % 5 === 0){
    stickerCount += 1;
    if(typeof spawnSticker === 'function') spawnSticker();
  }
  try{
    const el = document.getElementById('score');
    if(el){
      el.classList.remove('pop-animate');
      // trigger reflow to restart animation
      void el.offsetWidth;
      el.classList.add('pop-animate');
    }
  }catch(e){/*ignore*/}
}

function getGameState(){ return {wolves, score, hematomas, bear, running, gameOver, elapsed, maxHematomas, stickerCount, streakCount, pendingBandage, upgradeCount, BASE_MAX_HEMATOMAS}; }

function healOne(){
  // If there are current hematomas, consume one to heal
  if(hematomas > 0){
    hematomas = Math.max(0, hematomas - 1);
    // visual feedback for heal
    particlesPush(bear.x,bear.y,'#aaffcc',14);
    playHealSound();
    updateUI();
    return { healed: true, upgraded: false };
  }
  // Otherwise, instead of healing, increase the allowed hematomas capacity
  if(upgradeCount >= MAX_UPGRADES){
    // can't upgrade further
    return { healed: false, upgraded: false, reason: 'maxed' };
  }
  upgradeCount += 1;
  maxHematomas = BASE_MAX_HEMATOMAS + upgradeCount;
  // give visual feedback for upgrade
  particlesPush(bear.x,bear.y,'#ffd24a',20);
  // play bonus sound to indicate upgrade
  playBonusSound();
  updateUI();
  return { healed: false, upgraded: true };
}

// expose to global scope
window.game = {
  resetGame, updateGame, spawnWolf, incrementScore, getGameState, startGame, stopGame
};
window.game.healOne = healOne;
