// leaderboard.js - load/save and manage top 10 leaderboard
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
  const existingIdx = arr.findIndex(e => e.name && e.name.toLowerCase() === cleanName.toLowerCase());
  let improved = false;
  if(existingIdx >= 0){
    if((score||0) > (arr[existingIdx].score||0)){
      arr[existingIdx].score = score||0;
      arr[existingIdx].date = Date.now();
      improved = true;
    } else {
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
  if(!list) return;
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
