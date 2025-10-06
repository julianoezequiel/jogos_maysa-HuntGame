// entities.js - enemy and particle helpers
let particles = [];
let pickups = []; // bandages and other pickups

function particlesPush(x,y,color,count=8){
  for(let i=0;i<count;i++){
    const ang = random(TWO_PI);
    const spd = random(1,3);
    particles.push({x:x,y:y,vx:cos(ang)*spd,vy:sin(ang)*spd,life:random(30,60),dt:1,color});
  }
}

function spawnScorePop(x,y,text){
  particles.push({x,y,vx:0,vy:-1,life:40,dt:1,color:'#ffffff',label:text,scale:1});
}

function drawParticles(){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.life -= p.dt;
    p.vy += 0.04; // gravity
    if(p.life <= 0) particles.splice(i,1);
  }
  for(const p of particles){
    noStroke();
    if(p.label){
      fill(p.color);
      textSize(14);
      textAlign(CENTER,CENTER);
      text(p.label, p.x, p.y - (40 - p.life*0.2));
    } else if(p.shape === 'confetti'){
      push(); translate(p.x, p.y); rotate(p.rot || 0);
      rectMode(CENTER);
      fill(p.color);
      rect(0,0,p.size || 6, (p.size||6)*1.6);
      pop();
    } else {
      fill(p.color);
      ellipse(p.x, p.y, 6,6);
    }
  }
}

function createEnemy(x,y,speed,type='bee'){
  // types: 'bee' (default, small), 'bumble' (zangão visual), 'big' (rare, worth more points)
  let r = 28;
  let points = 1;
  if(type === 'bumble'){
    r = 32;
    points = 1;
  } else if(type === 'big'){
    r = 48;
    points = 5; // worth five times the normal bee
  }
  return {x,y,vx:0,vy:0,speed, r, alive:true, spawnT:millis(), type, points};
}

// spawn a burst of colorful confetti particles at x,y
function spawnConfetti(x,y,count=18){
  const palette = ['#FFD24A','#FF6B6B','#9FD3C7','#8EC5FF','#FFB6C1','#F6E05E'];
  for(let i=0;i<count;i++){
    const ang = random(TWO_PI);
    const spd = random(1,4);
    const size = random(4,10);
    particles.push({
      x:x + random(-6,6), y:y + random(-6,6), vx:cos(ang)*spd, vy:sin(ang)*spd - random(1,3),
      life:random(40,80), dt:1, color: random(palette), shape:'confetti', rot: random(-PI,PI), size
    });
  }
}

// spawn a sticker particle which UI will animate to the shelf
function spawnSticker(x,y){
  // if coordinates not provided, spawn near center-top of screen
  const sx = (typeof x === 'number') ? x : width/2 + random(-40,40);
  const sy = (typeof y === 'number') ? y : height/2 + random(-40,40);
  particles.push({x:sx,y:sy,vx:0,vy:0,life:80,dt:1,color:'#FFD24A',shape:'sticker',size:18, target:null, createdAt:millis()});
}

// spawn a bandage pickup (healing item)
function spawnBandage(x,y){
  const bx = (typeof x === 'number') ? x : random(60, width-60);
  const by = (typeof y === 'number') ? y : random(60, height-60);
  pickups.push({x:bx, y:by, type:'bandage', createdAt:millis(), ttl: millis() + 12000}); // lasts 12s
}

function drawPickups(){
  // remove expired
  pickups = pickups.filter(p => !p.ttl || millis() < p.ttl);
  for(const p of pickups){
    if(p.type === 'bandage'){
      const pulse = 1 + 0.06 * sin(millis() / 160);
      push(); translate(p.x,p.y); imageMode(CENTER);
      if(typeof bandageImg !== 'undefined') image(bandageImg,0,0,28 * pulse,28 * pulse);
      // subtle shine
      noStroke(); fill(255,250,220,120); ellipse( -6, -6, 6 * pulse, 4 * pulse);
      pop();
    }
  }
}

function collectPickupAt(x,y){
  for(let i=pickups.length-1;i>=0;i--){
    const p = pickups[i];
    if(dist(x,y,p.x,p.y) < 24){
      pickups.splice(i,1);
      return p;
    }
  }
  return null;
}
