import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, onValue, update, onDisconnect, serverTimestamp, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const config={apiKey:"AIzaSyAF2acxaXKOH4e4RoAUQcqMgX4s65xttSw",authDomain:"movchan-portal.firebaseapp.com",databaseURL:"https://movchan-portal-default-rtdb.europe-west1.firebasedatabase.app",projectId:"movchan-portal",storageBucket:"movchan-portal.firebasestorage.app",messagingSenderId:"535915495927",appId:"1:535915495927:web:71f899ea2876ee129c2ef2"};
const app=getApps().length?getApp():initializeApp(config),auth=getAuth(app),db=getDatabase(app);
let stop=null,currentKey='';
function mount(){
  if(document.getElementById('globalDuelInvite'))return;
  const style=document.createElement('style');style.textContent=`
  #globalDuelInvite{position:fixed;z-index:99999;inset:0;display:grid;place-items:center;padding:18px;background:rgba(2,10,18,.78);backdrop-filter:blur(8px)}
  #globalDuelInvite[hidden]{display:none!important}.gdi-card{width:min(440px,100%);padding:28px;border:1px solid #3b6c8d;border-radius:22px;background:linear-gradient(145deg,#0d2d46,#071a2b);color:#fff;text-align:center;box-shadow:0 28px 90px rgba(0,0,0,.5);font-family:Inter,system-ui,sans-serif}
  .gdi-swords{font-size:64px;animation:gdiPulse 1s ease-in-out infinite}.gdi-card h2{margin:8px 0;font-size:24px}.gdi-card p{margin:0;color:#bfd1df}.gdi-actions{display:flex;gap:9px;justify-content:center;margin-top:20px}.gdi-actions button{padding:11px 17px;border-radius:12px;border:1px solid #397092;font-weight:850;cursor:pointer}.gdi-accept{background:#2563eb;color:#fff}.gdi-decline{background:#12334d;color:#e8f5ff}@keyframes gdiPulse{50%{transform:scale(1.12) rotate(-5deg)}}`;
  document.head.appendChild(style);
  const box=document.createElement('div');box.id='globalDuelInvite';box.hidden=true;box.innerHTML=`<div class="gdi-card"><div class="gdi-swords">⚔️</div><small>ВАС ВИКЛИКАЮТЬ</small><h2 id="gdiTitle">Запрошення на дуель</h2><p>10 однакових запитань. Знання та швидкість визначать переможця.</p><div class="gdi-actions"><button class="gdi-accept" id="gdiAccept">Прийняти</button><button class="gdi-decline" id="gdiDecline">Відхилити</button></div></div>`;
  document.body.appendChild(box);
}
onAuthStateChanged(auth,async user=>{
  try{stop?.();}catch{}stop=null;if(!user)return;mount();
  const profile=(await get(ref(db,'users/'+user.uid)).catch(()=>null))?.val?.()||{};
  const presenceRef=ref(db,'presence/'+user.uid),presence={online:true,name:profile.name||user.displayName||'Учень',role:profile.role||'student',lastSeen:serverTimestamp(),duelReady:true};
  await onDisconnect(presenceRef).update({online:false,lastSeen:serverTimestamp()}).catch(()=>{});await update(presenceRef,presence).catch(()=>{});
  stop=onValue(ref(db,'duelChallenges/'+user.uid),snap=>{
    const pending=Object.entries(snap.val()||{}).map(([id,c])=>({id,...c})).filter(c=>c.status==='pending'&&Date.now()-(Number(c.createdAt)||0)<45000).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0];
    const box=document.getElementById('globalDuelInvite');if(!pending){box.hidden=true;return;}currentKey=pending.id;box.hidden=false;document.getElementById('gdiTitle').textContent=`${pending.fromName||'Учень'} викликає вас на дуель`;
    document.getElementById('gdiAccept').onclick=()=>{sessionStorage.setItem('portalAutoAcceptDuel',currentKey);location.href='historical-duel.html';};
    document.getElementById('gdiDecline').onclick=async()=>{box.hidden=true;await update(ref(db,`duelChallenges/${user.uid}/${currentKey}`),{status:'declined',declinedAt:Date.now()}).catch(()=>{});};
  });
});
