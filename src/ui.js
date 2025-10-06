// ui.js - DOM interactions: cursor, buttons, volume slider, leaderboard controls
function initUI(){
  const container = document.getElementById('canvas-container');
  if(!container) return;
  let cursorEl = document.getElementById('gameCursor');
  if(!cursorEl){
    cursorEl = document.createElement('div'); cursorEl.id = 'gameCursor';
    cursorEl.style.backgroundImage = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><g fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='16' cy='14' r='8'/><path d='M22 24 L36 38' /><rect x='34' y='36' width='8' height='3' rx='1' transform='rotate(20 38 37)' fill='%23000' /></g></svg>")`;
    cursorEl.style.backgroundRepeat = 'no-repeat'; cursorEl.style.backgroundSize='48px 48px';
    container.appendChild(cursorEl);
  }
  container.addEventListener('mousemove', (e)=>{ const rect = container.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; cursorEl.style.left = x + 'px'; cursorEl.style.top = y + 'px'; });
  container.addEventListener('mousedown', ()=>{ cursorEl.classList.add('click'); cursorEl.style.backgroundImage = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><g fill='%23fff' stroke='%23000' stroke-width='1.5'><rect x='8' y='10' width='32' height='16' rx='8' fill='%23ffdd66' stroke='none'/><path d='M16 28 L32 44' stroke='%23000' stroke-width='2' stroke-linecap='round'/></g></svg>")`; });
  container.addEventListener('mouseup', ()=>{ cursorEl.classList.remove('click'); cursorEl.style.backgroundImage = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><g fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='16' cy='14' r='8'/><path d='M22 24 L36 38' /><rect x='34' y='36' width='8' height='3' rx='1' transform='rotate(20 38 37)' fill='%23000' /></g></svg>")`; });

  // Start/Restart handlers (partial wiring — game control in main.js will set details)
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');

// small helper to update HUD elements from game state
function updateUI(){
  try{
    const elTimer = document.getElementById('timer');
    const elScore = document.getElementById('score');
    const elHealth = document.getElementById('health');
    const elPlayer = document.getElementById('player');
    if(!window.game) return;
    const st = window.game.getGameState();
    if(elTimer) elTimer.textContent = 'Tempo: ' + Math.floor((st && st.elapsed) ? st.elapsed/1000 : 0) + 's';
    if(elScore) elScore.textContent = 'Pontos: ' + ((st && st.score) || 0);
    if(elHealth) elHealth.textContent = 'Hematomas: ' + ((st && st.hematomas) || 0) + '/' + (st && st.maxHematomas ? st.maxHematomas : 3);
  const up = document.getElementById('upgradeBadge'); if(up) up.textContent = 'Upg: ' + ((st && st.upgradeCount) || 0);
    if(elPlayer) elPlayer.textContent = window.playerName ? window.playerName : 'Jogador: -';
  // sticker count
  const sc = document.getElementById('stickerCount'); if(sc) sc.textContent = (st && st.stickerCount) || 0;
  // streak meter (optional display)
  const sm = document.getElementById('streakMeter'); if(sm){ sm.textContent = (st && st.streakCount && st.streakCount > 1) ? 'x' + st.streakCount : ''; }
  }catch(e){ console.error('updateUI',e); }
}

// expose update helper for legacy calls
window.updateUI = updateUI;

function flashHealthUI(){
  const el = document.getElementById('health');
  if(!el) return;
  el.classList.add('upgrade-glow');
  setTimeout(()=>{ el.classList.remove('upgrade-glow'); }, 520);
}
window.ui = window.ui || {};
window.ui.flashHealth = flashHealthUI;

// draw a full-screen Game Over overlay using p5 drawing commands
function showGameOver(){
  try{
    if(typeof noStroke === 'undefined') return; // p5 not ready
    push();
    fill(0, 180);
    rect(0,0,width,height);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(36);
    text('Game Over', width/2, height/2 - 34);
    textSize(22);
    const st = window.game ? window.game.getGameState() : null;
    const finalScore = st ? st.score : 0;
    text('Pontos finais: ' + finalScore, width/2, height/2 + 6);
    textSize(16);
    text('Clique em Reiniciar para jogar novamente', width/2, height/2 + 44);
    pop();
  }catch(e){ console.error('showGameOver', e); }
}

window.showGameOver = showGameOver;

// process sticker particles and animate them to the shelf
function processStickerParticles(){
  try{
    if(!window.game) return;
    // find sticker particles in global particles array
    if(typeof particles === 'undefined' || !Array.isArray(particles)) return;
    const shelfEl = document.getElementById('stickerShelf');
    const countEl = document.getElementById('stickerCount');
    const rect = shelfEl ? shelfEl.getBoundingClientRect() : null;
    // target coordinates relative to canvas
    const targetX = rect ? (rect.left + rect.width/2) - document.getElementById('canvas-container').getBoundingClientRect().left : width - 60;
    const targetY = rect ? (rect.top + rect.height/2) - document.getElementById('canvas-container').getBoundingClientRect().top : 32;
    for(let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      if(p.shape !== 'sticker') continue;
      // move sticker toward target smoothly
      const dx = targetX - p.x; const dy = targetY - p.y;
      p.vx = dx * 0.08; p.vy = dy * 0.08;
      p.x += p.vx; p.y += p.vy; p.life -= p.dt;
      p.rot = (p.rot || 0) + 0.2;
      // if close enough, consume and increment DOM counter
      if(dist(p.x,p.y,targetX,targetY) < 8 || p.life <= 0){
        // remove particle
        particles.splice(i,1);
        // increment displayed stickers (UI only)
        try{ const st = window.game ? window.game.getGameState() : null; if(countEl && st) countEl.textContent = st.stickerCount; }catch(e){}
      }
    }
  }catch(e){ console.error('processStickerParticles', e); }
}
  if(startBtn){ startBtn.addEventListener('mousedown', ()=> playUiClick()); }
  if(restartBtn){ restartBtn.addEventListener('mousedown', ()=> playUiClick()); }

  // volume slider and mute button wiring
  const volSlider = document.getElementById('volumeSlider');
  const muteBtn = document.getElementById('muteBtn');
  if(volSlider){ const saved = parseFloat(localStorage.getItem('HuntGame:volume')); volSlider.value = isNaN(saved) ? 80 : Math.round(saved * 100); volSlider.addEventListener('input', (e)=>{ const v = Number(e.target.value) / 100; ensureAudio(); setMasterVolume(v); localStorage.setItem('HuntGame:muted','0'); if(muteBtn) muteBtn.textContent = '🔊'; }); }
  if(muteBtn){ const muted = localStorage.getItem('HuntGame:muted') === '1'; muteBtn.textContent = muted ? '🔇' : '🔊'; muteBtn.addEventListener('click', ()=>{ ensureAudio(); const isMuted = toggleMute(); muteBtn.textContent = isMuted ? '🔇' : '🔊'; }); }

  // clear buttons
  const clearMy = document.getElementById('clearMyBtn'); if(clearMy) clearMy.addEventListener('click', ()=>{ if(!window.playerName){ alert('Nenhum jogador definido.'); return; } const ok = confirm('Remover seu recorde ('+window.playerName+') do leaderboard?'); if(!ok) return; let arr = loadLeaderboard(); arr = arr.filter(e => !(e.name && e.name.toLowerCase() === window.playerName.toLowerCase())); saveLeaderboard(arr); renderLeaderboard(); });
  const clearAll = document.getElementById('clearAllBtn'); if(clearAll) clearAll.addEventListener('click', ()=>{ const ok = confirm('Limpar TODO o leaderboard? Esta ação não pode ser desfeita.'); if(!ok) return; saveLeaderboard([]); renderLeaderboard(); });
}

// expose
window.ui = { initUI };
