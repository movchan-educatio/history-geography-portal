import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getDatabase, ref, push, set, update, onValue, get } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

const firebaseConfig={apiKey:'AIzaSyAF2acxaXKOH4e4RoAUQcqMgX4s65xttSw',authDomain:'movchan-portal.firebaseapp.com',databaseURL:'https://movchan-portal-default-rtdb.europe-west1.firebasedatabase.app',projectId:'movchan-portal',storageBucket:'movchan-portal.firebasestorage.app',messagingSenderId:'535915495927',appId:'1:535915495927:web:71f899ea2876ee129c2ef2',measurementId:'G-8XBVKRZRS1'};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app),storage=getStorage(app),provider=new GoogleAuthProvider();

// Google UID власника порталу. Він завжди має роль teacher.
const PORTAL_OWNER_UID='LGw3zPR7w4SdN8zvi4LWExYTfFh2';
const ROLE_CACHE_KEY='portal_role_cache_v4';
let user=null, profile=null, lessons={}, assignments={}, resources={}, submissions={}, grades={};
let unsubscribers=[];
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function cachedRole(uid){try{return JSON.parse(localStorage.getItem(ROLE_CACHE_KEY)||'{}')[uid]||null}catch{return null}}
function cacheRole(uid,role){try{const x=JSON.parse(localStorage.getItem(ROLE_CACHE_KEY)||'{}');x[uid]=role;localStorage.setItem(ROLE_CACHE_KEY,JSON.stringify(x))}catch{}}
function clearListeners(){unsubscribers.forEach(fn=>{try{fn()}catch{}});unsubscribers=[]}

async function login(){try{await signInWithPopup(auth,provider)}catch(e){alert('Не вдалося увійти: '+e.message)}}
async function logout(){clearListeners();await signOut(auth)}
window.portalLogin=login;window.portalLogout=logout;
function toast(msg){const n=$('toast');if(n){n.textContent=msg;n.classList.remove('hidden');setTimeout(()=>n.classList.add('hidden'),2800)}}

function setRoleUI(){
  const teacher=profile?.role==='teacher';
  document.querySelectorAll('[data-teacher-only]').forEach(e=>e.classList.toggle('hidden',!teacher));
  document.querySelectorAll('[data-student-only]').forEach(e=>e.classList.toggle('hidden',teacher));
  const role=$('roleText'); if(role) role.textContent=teacher?'Вчитель':'Учень';
}
function renderAll(){renderLessons();renderAssignments();renderResources();renderGrades();renderSubmissions();setRoleUI()}

function renderLessons(){
  const box=$('lessonsList'); if(!box)return;
  const arr=Object.entries(lessons).sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0));
  box.innerHTML=arr.length?arr.map(([id,x])=>`<article class="item"><div class="item-head"><div><span class="pill">${esc(x.subject||'Урок')}</span><h3>${esc(x.title)}</h3></div><span class="pill">${esc(x.grade||'Усі класи')}</span></div><p>${esc(x.topic||x.description||'')}</p>${x.homework?`<p><b>Д/з:</b> ${esc(x.homework)}</p>`:''}${x.videoUrl?`<p>🎥 <a href="${esc(x.videoUrl)}" target="_blank" rel="noopener">Відео до уроку</a></p>`:''}${x.presentationUrl?`<p>📊 <a href="${esc(x.presentationUrl)}" target="_blank" rel="noopener">Презентація</a></p>`:''}</article>`).join(''):'<div class="empty">Уроків ще немає.</div>';
}

function renderAssignments(){
  const box=$('assignmentsList'); if(!box)return;
  const arr=Object.entries(assignments).sort((a,b)=>(a[1].dueAt||'9999').localeCompare(b[1].dueAt||'9999'));
  box.innerHTML=arr.length?arr.map(([id,x])=>{
    const mine=Object.values(submissions).find(s=>s.assignmentId===id&&s.studentUid===user?.uid);
    const status=mine?(mine.grade?`Оцінено: ${esc(mine.grade)}`:'Роботу здано — очікує перевірки'):'Ще не здано';
    return `<article class="item"><div class="item-head"><div><span class="pill">Д/З</span><h3>${esc(x.title)}</h3></div><span class="pill">до ${esc(x.dueAt||'—')}</span></div><p>${esc(x.description||'')}</p>${x.subject?`<p><b>Предмет:</b> ${esc(x.subject)}${x.grade?` • <b>Клас:</b> ${esc(x.grade)}`:''}</p>`:''}${x.resourceUrl?`<p>📎 <a href="${esc(x.resourceUrl)}" target="_blank" rel="noopener">Матеріал до завдання</a></p>`:''}${profile?.role==='student'?`<p class="assignment-status"><b>Статус:</b> ${status}</p>`:''}<div class="form-actions"><button class="btn-primary" onclick="openSubmission('${id}')">${profile?.role==='teacher'?'Переглянути роботи':'Здати роботу'}</button></div></article>`;
  }).join(''):'<div class="empty">Домашніх завдань ще немає.</div>';
}

function renderResources(){
  const box=$('resourcesList'); if(!box)return;
  const arr=Object.entries(resources).sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0));
  box.innerHTML=arr.length?arr.map(([id,x])=>`<article class="item"><div class="item-head"><div><span class="pill">${esc(x.type||'Матеріал')}</span><h3>${esc(x.title)}</h3></div><span class="pill">${esc(x.ownerName||'Портал')}</span></div><p>${esc(x.description||'')}</p>${x.url?`<p>🔗 <a href="${esc(x.url)}" target="_blank" rel="noopener">Відкрити матеріал</a></p>`:''}</article>`).join(''):'<div class="empty">Матеріалів ще немає. Увійдіть і додайте перший.</div>';
}

function renderGrades(){
  const box=$('gradesList'); if(!box)return;
  if(profile?.role==='teacher'){
    const arr=Object.entries(grades);
    box.innerHTML=arr.length?arr.map(([uid,x])=>`<article class="item"><div class="item-head"><div><h3>${esc(x.studentName||uid)}</h3><p>${esc(x.title||'Робота')}</p></div><span class="grade">${esc(x.grade||'—')}</span></div><p>${esc(x.feedback||'')}</p></article>`).join(''):'<div class="empty">Оцінок ще немає.</div>';
  }else{
    const arr=Object.values(grades).filter(x=>x.studentUid===user?.uid);
    box.innerHTML=arr.length?arr.map(x=>`<article class="item"><div class="item-head"><div><h3>${esc(x.title||'Робота')}</h3><p>${esc(x.feedback||'')}</p></div><span class="grade">${esc(x.grade||'—')}</span></div></article>`).join(''):'<div class="empty">Ваші оцінки з’являться тут після перевірки робіт.</div>';
  }
}

function renderSubmissions(){
  const box=$('submissionsList'); if(!box||!profile)return;
  const arr=Object.entries(submissions).filter(([id,x])=>profile.role==='teacher'||x.studentUid===user.uid).sort((a,b)=>(b[1].submittedAt||0)-(a[1].submittedAt||0));
  box.innerHTML=arr.length?arr.map(([id,x])=>`<article class="item"><div class="item-head"><div><span class="pill">${profile.role==='teacher'?esc(x.studentName||'Учень'):'Моя робота'}</span><h3>${esc(x.assignmentTitle||'Завдання')}</h3></div><span class="grade">${x.grade?esc(x.grade):'—'}</span></div><p>${esc(x.text||'Файл/текст подано')}</p>${x.fileUrl?`<p>📎 <a href="${esc(x.fileUrl)}" target="_blank" rel="noopener">Відкрити файл</a></p>`:''}${x.feedback?`<p><b>Коментар учителя:</b> ${esc(x.feedback)}</p>`:''}${profile.role==='teacher'?`<div class="form-actions"><button class="btn-secondary" onclick="gradeSubmission('${id}')">Оцінити роботу</button></div>`:''}</article>`).join(''):'<div class="empty">Поданих робіт поки немає.</div>';
}

async function saveLesson(e){
  e.preventDefault(); if(profile?.role!=='teacher')return toast('Ця дія доступна лише вчителю.');
  const f=e.target,id=push(ref(db,'lessons')).key;
  await set(ref(db,'lessons/'+id),{title:f.title.value,subject:f.subject.value,grade:f.grade.value,topic:f.topic.value,homework:f.homework.value,videoUrl:f.videoUrl.value,presentationUrl:f.presentationUrl.value,createdBy:user.uid,createdAt:Date.now()});
  f.reset();toast('Урок опубліковано');
}
async function saveAssignment(e){
  e.preventDefault(); if(profile?.role!=='teacher')return toast('Ця дія доступна лише вчителю.');
  const f=e.target,id=push(ref(db,'assignments')).key;
  await set(ref(db,'assignments/'+id),{title:f.title.value,subject:f.subject?.value||'',grade:f.grade?.value||'',description:f.description.value,dueAt:f.dueAt.value,resourceUrl:f.resourceUrl.value,createdBy:user.uid,createdAt:Date.now()});
  f.reset();toast('Домашнє завдання створено');
}
async function addResource(e){
  e.preventDefault(); if(!user)return toast('Увійдіть через Google.');
  const f=e.target;let url=f.url.value;const file=f.file.files[0];
  try{
    if(file){toast('Завантаження файлу…');const sref=storageRef(storage,`portal-resources/${user.uid}/${Date.now()}-${file.name}`);await uploadBytes(sref,file);url=await getDownloadURL(sref)}
    if(!url)return toast('Додайте посилання або файл.');
    const id=push(ref(db,'resources')).key;await set(ref(db,'resources/'+id),{title:f.title.value,type:f.type.value,description:f.description.value,url,ownerUid:user.uid,ownerName:user.displayName||'Користувач',createdAt:Date.now()});
    f.reset();toast('Матеріал додано');
  }catch(e){console.error(e);toast('Не вдалося додати матеріал. Перевірте Firebase Storage.');}
}
window.openSubmission=id=>{
  const a=assignments[id];if(!a)return;
  if(profile?.role==='teacher'){document.querySelector('[data-tab="submissions"]')?.click();return}
  $('submissionAssignmentId').value=id;$('submissionTitle').textContent=`${a.title}${a.dueAt?' • до '+a.dueAt:''}`;document.querySelector('[data-tab="submit"]')?.click();
};
async function submitWork(e){
  e.preventDefault();if(!user)return toast('Увійдіть через Google.');
  const f=e.target,id=f.assignmentId.value,a=assignments[id];if(!a)return toast('Оберіть домашнє завдання.');
  let fileUrl='';const file=f.file.files[0];
  try{
    if(file){toast('Завантаження роботи…');const sref=storageRef(storage,`submissions/${user.uid}/${Date.now()}-${file.name}`);await uploadBytes(sref,file);fileUrl=await getDownloadURL(sref)}
    const sid=push(ref(db,'submissions')).key;await set(ref(db,'submissions/'+sid),{assignmentId:id,assignmentTitle:a.title,studentUid:user.uid,studentName:user.displayName||'Учень',text:f.text.value,fileUrl,submittedAt:Date.now(),grade:'',feedback:''});
    f.reset();toast('Роботу надіслано вчителю');document.querySelector('[data-tab="submissions"]')?.click();
  }catch(e){console.error(e);toast('Не вдалося надіслати роботу.');}
}
window.gradeSubmission=async id=>{
  if(profile?.role!=='teacher')return;
  const x=submissions[id];if(!x)return;
  const grade=prompt('Оцінка (наприклад 11 або 11/12):',x.grade||'');if(grade===null)return;
  const feedback=prompt('Короткий коментар учня:',x.feedback||'')||'';
  await update(ref(db,'submissions/'+id),{grade,feedback,gradedAt:Date.now(),gradedBy:user.uid});
  await set(ref(db,'grades/'+id),{studentUid:x.studentUid,studentName:x.studentName,title:x.assignmentTitle,grade,feedback,gradedAt:Date.now()});
  toast('Оцінку збережено');
};

function initTabs(){
  document.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');$(b.dataset.tab)?.classList.add('active');
  }));
}

window.addEventListener('DOMContentLoaded',()=>{
  initTabs();
  if($('loginBtn'))$('loginBtn').onclick=login;
  if($('lessonForm'))$('lessonForm').onsubmit=saveLesson;
  if($('assignmentForm'))$('assignmentForm').onsubmit=saveAssignment;
  if($('resourceForm'))$('resourceForm').onsubmit=addResource;
  if($('submissionForm'))$('submissionForm').onsubmit=submitWork;
});

onAuthStateChanged(auth,async u=>{
  clearListeners();user=u;
  if(!u){
    profile=null;
    if($('authArea')){$('authArea').innerHTML='<button id="loginBtn" class="portal-login">Увійти через Google</button>';$('loginBtn').onclick=login}
    $('privateArea')?.classList.add('hidden');return;
  }

  // 1. Показываем кэшированную роль мгновенно — без "Перевірка ролі…".
  const cached=cachedRole(u.uid);
  if(cached){profile={role:cached,displayName:u.displayName,email:u.email};setRoleUI();}

  // 2. Читаем профиль один раз и исправляем профиль владельца.
  try{
    const snap=await get(ref(db,'users/'+u.uid));
    if(snap.exists()) profile=snap.val();
    else profile={displayName:u.displayName,email:u.email,role:(u.uid===PORTAL_OWNER_UID?'teacher':'student'),createdAt:Date.now()};
    if(u.uid===PORTAL_OWNER_UID && profile.role!=='teacher') profile={...profile,role:'teacher'};
    await set(ref(db,'users/'+u.uid),{...profile,displayName:u.displayName||profile.displayName,email:u.email||profile.email,role:profile.role});
    cacheRole(u.uid,profile.role);
  }catch(e){
    console.error('Profile error',e);
    profile=profile||{role:u.uid===PORTAL_OWNER_UID?'teacher':'student',displayName:u.displayName,email:u.email};
  }

  setRoleUI();
  if($('authArea')){
    $('authArea').innerHTML=`<div class="user-chip"><img src="${esc(u.photoURL||'logo.png')}" alt=""><div><b>${esc(u.displayName||'Користувач')}</b><small class="role-badge">${profile.role==='teacher'?'Вчитель':'Учень'}</small></div><button id="logoutBtn" class="btn-secondary">Вийти</button></div>`;
    $('logoutBtn').onclick=logout;
  }
  $('privateArea')?.classList.remove('hidden');

  // 3. Один набір realtime listeners на сесію.
  unsubscribers.push(onValue(ref(db,'lessons'),s=>{lessons=s.val()||{};renderAll()}));
  unsubscribers.push(onValue(ref(db,'assignments'),s=>{assignments=s.val()||{};renderAll()}));
  unsubscribers.push(onValue(ref(db,'resources'),s=>{resources=s.val()||{};renderAll()}));
  unsubscribers.push(onValue(ref(db,'submissions'),s=>{submissions=s.val()||{};renderAll()}));
  unsubscribers.push(onValue(ref(db,'grades'),s=>{grades=s.val()||{};renderAll()}));
  renderAll();
});
