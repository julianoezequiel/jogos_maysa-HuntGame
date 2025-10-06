// main.js - p5 lifecycle and orchestration
function preload(){
  bearImg = loadImage('assets/bear.svg');
  beeImg = loadImage('assets/bee.svg');
  bumbleImg = loadImage('assets/bumble.svg');
  bigBeeImg = loadImage('assets/bee_big.svg');
  bandageImg = loadImage('assets/bandage.svg');
}

function setup(){
  const canvas = createCanvas(800,500);
  canvas.parent('canvas-container');
  imageMode(CENTER); textFont('Arial');
  // initialize modules
  ui.initUI();
  renderLeaderboard();
  // attach start/restart logic
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  startBtn.addEventListener('click', ()=>{
    if(!game) return;
    if(!game.getGameState().running){
      // prompt for name only if not already set (existing behaviour)
      window.playerName = window.playerName || prompt('Digite seu nome para o ranking (máx 20 chars):','');
      if(!window.playerName) return;
      document.getElementById('player').textContent = window.playerName;
      game.resetGame();
      if(typeof game.startGame === 'function') game.startGame();
      startBackgroundMusic();
    }
  });
  restartBtn.addEventListener('click', ()=>{
    // always prompt again on restart (bugfix requested)
    const nm = prompt('Digite seu nome para o ranking (máx 20 chars):','');
    if(!nm) return; window.playerName = nm;
    document.getElementById('player').textContent = window.playerName;
    game.resetGame();
    if(typeof game.startGame === 'function') game.startGame();
    startBackgroundMusic();
  });
}

function draw(){
  background(159,211,199);
  // call game update and draw parts
  if(window.game){
    // draw bear
    const state = window.game.getGameState();
    if(!state) return;
    // show bear
    const b = state.bear;
    if(b){
      push();
      const shake = (b.shakeTime>0)? random(-6,6):0;
      translate(b.x + shake, b.y + shake);
      if(b.flashTime>0){ tint(255,150,150); b.flashTime -= 1; } else noTint();
      image(bearImg,0,0,b.r*2,b.r*2);
      pop();
      if(b.shakeTime>0) b.shakeTime -=1;
    }
    window.game.updateGame();
    // draw enemies
    const wolves = state.wolves;
    for(const w of wolves){
      const img = (w.type === 'bumble') ? bumbleImg : (w.type === 'big' ? bigBeeImg : beeImg);
      if(w.squashed){
        push(); translate(w.x,w.y); const t = w.squashTime/18; const scaleY = map(t,1,0,1,0.2); const scaleX = map(t,1,0,1,1.15); rotate(w.squashRot * (1 - t)); scale(scaleX,scaleY); tint(255,255*t); image(img,0,0,w.r*2,w.r*2); pop();
      } else if(w.alive){
        push(); translate(w.x,w.y); const angle = atan2(state.bear.y - w.y, state.bear.x - w.x); rotate(angle+PI/2);
        // big bees can glow
        if(w.type === 'big' && w.glowUntil && millis() < w.glowUntil){
          push(); tint(255,255); image(img,0,0,w.r*2.3,w.r*2.3); pop();
          // subtle sparkle
          noStroke(); fill(255,240,120,160); ellipse(0 - w.r*0.4, -w.r*0.6, 6,6);
        }
        image(img,0,0,w.r*2,w.r*2); pop();
      }
    }
    // draw particles
    drawParticles();
    // draw pickups (bandages)
    if(typeof drawPickups === 'function') drawPickups();
    // draw pending bandage ping if present
    if(typeof window.game !== 'undefined'){
      const st = window.game.getGameState();
      if(st && st.pendingBandage){
        push(); noFill(); stroke(255,220,120,160); strokeWeight(2);
        const t = (st.pendingBandage.announceAt - millis())/1200.0;
        const r = map(constrain(t,0,1),0,1,22,48);
        ellipse(st.pendingBandage.x, st.pendingBandage.y, r, r);
        pop();
      }
    }
  // sticker animation toward shelf
  if(typeof processStickerParticles === 'function') processStickerParticles();
  // HUD
  fill(255,255,255,180); noStroke(); rect(8,8,150,36,8); rect(width-158,8,150,36,8); fill(0); textSize(16); textAlign(LEFT,CENTER); text('Tempo: ' + Math.floor((state.elapsed||0)/1000) + 's', 16, 26); textAlign(RIGHT,CENTER); text('Pontos: ' + state.score, width-16, 26);
  }
  // if game over, draw overlay on top
  if(window.game && window.game.getGameState().gameOver){
    if(typeof window.showGameOver === 'function') window.showGameOver();
  }
}

function mousePressed(){
  // squash a single alive enemy per click
  const state = game.getGameState();
  if(!state.running) return;
  // find nearest alive wolf within an expanded touch radius
  let nearest = null; let nearestIdx = -1; let nearestDist = Infinity;
  const touchRadius = 42; // more forgiving for touch
  for(let i=0;i<state.wolves.length;i++){
    const w = state.wolves[i];
    if(!w.alive) continue;
    const d = dist(mouseX, mouseY, w.x, w.y);
    if(d < touchRadius && d < nearestDist){ nearest = w; nearestIdx = i; nearestDist = d; }
  }
  if(nearest){
    const w = nearest;
    w.alive = false; w.squashed = true; w.squashTime = 18; w.squashRot = random(-0.6,0.6);
    const pts = (w.points) ? w.points : 1;
    game.incrementScore(pts);
    particlesPush(w.x,w.y,'#ffd24a',18);
    spawnConfetti(w.x, w.y, 22);
    playSquashSound();
    spawnScorePop(w.x,w.y,'+' + pts);
    // big bee bonus SFX
    if(w.type === 'big'){ playBonusSound(); }
    w.removeAt = millis() + 220;
  }
  else {
    // check for pickup click
    if(typeof collectPickupAt === 'function'){
      const picked = collectPickupAt(mouseX, mouseY);
      if(picked && picked.type === 'bandage'){
        // use game API to heal
        if(typeof window.game !== 'undefined' && typeof window.game.healOne === 'function'){
          const res = window.game.healOne();
          if(res && (res.healed || res.upgraded)){
            spawnConfetti(mouseX, mouseY, 12);
            // small extra feedback when upgraded capacity
            if(res.upgraded){
              // flash UI health with golden glow
              if(typeof window.ui !== 'undefined' && typeof window.ui.flashHealth === 'function') window.ui.flashHealth();
            }
          }
        }
      }
    }
  }
}

// make sure ui and others are accessible
window.main = { };
