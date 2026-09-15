import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, get, set, update, onValue, push, runTransaction, onDisconnect, serverTimestamp, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAF2acxaXKOH4e4RoAUQcqMgX4s65xttSw",
  authDomain: "movchan-portal.firebaseapp.com",
  databaseURL: "https://movchan-portal-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "movchan-portal",
  storageBucket: "movchan-portal.firebasestorage.app",
  messagingSenderId: "535915495927",
  appId: "1:535915495927:web:71f899ea2876ee129c2ef2"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GoogleAuthProvider();
const OWNER_UID = "LGw3zPR7w4SdN8zvi4LWExYTfFh2";
const ROUND_MS = 15000;
const QUESTION_COUNT = 10;

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const QUESTIONS = [
 {id:"u01",c:"Історія України",q:"Яка подія традиційно вважається початком Української революції 1917–1921 рр.?",a:["Проголошення IV Універсалу","Створення Української Центральної Ради","Бій під Крутами","Гетьманський переворот"],r:1},
 {id:"u02",c:"Історія України",q:"Який документ Української Центральної Ради проголосив незалежність Української Народної Республіки?",a:["I Універсал","II Універсал","III Універсал","IV Універсал"],r:3},
 {id:"u03",c:"Історія України",q:"Хто очолював Українську Центральну Раду?",a:["Симон Петлюра","Михайло Грушевський","Павло Скоропадський","Володимир Винниченко"],r:1},
 {id:"u04",c:"Історія України",q:"У якому році відбулося хрещення Русі за князя Володимира Великого?",a:["882","988","1019","1054"],r:1},
 {id:"u05",c:"Історія України",q:"Який князь розгромив печенігів під Києвом у 1036 році?",a:["Святослав Ігорович","Володимир Великий","Ярослав Мудрий","Володимир Мономах"],r:2},
 {id:"u06",c:"Історія України",q:"Яка пам’ятка є найвідомішим літописним зведенням Київської Русі початку XII ст.?",a:["«Руська правда»","«Повість минулих літ»","«Слово про закон і благодать»","«Повчання дітям»"],r:1},
 {id:"u07",c:"Історія України",q:"Хто заснував першу Запорозьку Січ на острові Мала Хортиця?",a:["Петро Конашевич-Сагайдачний","Іван Сірко","Дмитро Вишневецький","Богдан Хмельницький"],r:2},
 {id:"u08",c:"Історія України",q:"Яка битва 1648 року стала першою великою перемогою війська Богдана Хмельницького?",a:["Берестецька","Пилявецька","Жовтоводська","Зборівська"],r:2},
 {id:"u09",c:"Історія України",q:"Який договір 1658 року передбачав створення Великого князівства Руського у складі Речі Посполитої?",a:["Зборівський","Гадяцький","Білоцерківський","Бучацький"],r:1},
 {id:"u10",c:"Історія України",q:"Хто був автором Конституції 1710 року, укладеної в Бендерах?",a:["Іван Мазепа","Пилип Орлик","Іван Скоропадський","Данило Апостол"],r:1},
 {id:"u11",c:"Історія України",q:"Яке місто було центром Кирило-Мефодіївського братства?",a:["Харків","Львів","Київ","Одеса"],r:2},
 {id:"u12",c:"Історія України",q:"Хто написав програмний твір Кирило-Мефодіївського братства «Книгу буття українського народу»?",a:["Пантелеймон Куліш","Микола Костомаров","Тарас Шевченко","Микола Гулак"],r:1},
 {id:"u13",c:"Історія України",q:"У якому році було скасовано кріпосне право в Російській імперії, зокрема на більшості українських земель?",a:["1848","1861","1863","1876"],r:1},
 {id:"u14",c:"Історія України",q:"Який документ 1876 року суттєво обмежив українське друковане слово та публічне використання української мови?",a:["Валуєвський циркуляр","Емський указ","Маніфест 17 жовтня","Столипінський циркуляр"],r:1},
 {id:"u15",c:"Історія України",q:"Яка політична організація стала першою українською партією в Наддніпрянській Україні?",a:["РУП","УНДП","УСДРП","ТУП"],r:0},
 {id:"u16",c:"Історія України",q:"Яка подія відбулася 22 січня 1919 року в Києві?",a:["Проголошення УНР","Акт Злуки УНР і ЗУНР","Створення Директорії","Підписання Брестського миру"],r:1},
 {id:"u17",c:"Історія України",q:"Хто став гетьманом Української Держави у квітні 1918 року?",a:["Євген Петрушевич","Павло Скоропадський","Симон Петлюра","Нестор Махно"],r:1},
 {id:"u18",c:"Історія України",q:"Яка політика більшовицької влади 1920-х років сприяла розширенню використання української мови в освіті та управлінні?",a:["Колективізація","Коренізація (українізація)","Воєнний комунізм","Індустріалізація"],r:1},
 {id:"u19",c:"Історія України",q:"Яка трагедія 1932–1933 років була наслідком насильницької політики сталінського режиму в Україні?",a:["Депортація кримських татар","Голодомор","Операція «Вісла»","Великий терор 1937–1938 рр."],r:1},
 {id:"u20",c:"Історія України",q:"Коли було проголошено Акт відновлення Української Держави у Львові?",a:["30 червня 1941 р.","22 червня 1941 р.","14 жовтня 1942 р.","9 травня 1945 р."],r:0},
 {id:"u21",c:"Історія України",q:"Яку операцію 1944 року здійснила радянська влада проти кримськотатарського народу?",a:["Масову депортацію з Криму","Ліквідацію УГКЦ","Операцію «Вісла»","Виселення населення із Закарпаття"],r:0},
 {id:"u22",c:"Історія України",q:"У якому році Україна стала членом-засновником Організації Об’єднаних Націй?",a:["1944","1945","1946","1948"],r:1},
 {id:"u23",c:"Історія України",q:"Хто був одним із найвідоміших представників українського руху шістдесятників і автором збірки «Зимові дерева»?",a:["Василь Стус","Олесь Гончар","Павло Тичина","Максим Рильський"],r:0},
 {id:"u24",c:"Історія України",q:"Коли Верховна Рада ухвалила Акт проголошення незалежності України?",a:["16 липня 1990 р.","24 серпня 1991 р.","1 грудня 1991 р.","28 червня 1996 р."],r:1},
 {id:"u25",c:"Історія України",q:"Який результат мав Всеукраїнський референдум 1 грудня 1991 року?",a:["Схвалення Акта проголошення незалежності","Прийняття Конституції","Вступ до ООН","Введення гривні"],r:0},
 {id:"u26",c:"Історія України",q:"У якому році була прийнята Конституція незалежної України?",a:["1991","1994","1996","2004"],r:2},
 {id:"u27",c:"Історія України",q:"Яке місто було столицею Західноукраїнської Народної Республіки на початковому етапі її існування?",a:["Станіславів","Тернопіль","Львів","Чернівці"],r:2},
 {id:"u28",c:"Історія України",q:"Яка битва 1651 року стала однією з найбільших у Національно-визвольній війні середини XVII ст.?",a:["Конотопська","Берестецька","Батозька","Корсунська"],r:1},
 {id:"u29",c:"Історія України",q:"Який князь об’єднав Галицьке і Волинське князівства у 1199 році?",a:["Роман Мстиславич","Данило Романович","Ярослав Осмомисл","Лев Данилович"],r:0},
 {id:"u30",c:"Історія України",q:"Хто був коронований як король Русі в 1253 році?",a:["Роман Мстиславич","Данило Романович","Лев Данилович","Юрій І Львович"],r:1},

 {id:"w01",c:"Всесвітня історія",q:"Що стало безпосереднім приводом до Першої світової війни?",a:["Марокканська криза","Убивство ерцгерцога Франца Фердинанда в Сараєві","Балканські війни","Створення Антанти"],r:1},
 {id:"w02",c:"Всесвітня історія",q:"У якому році почалася Французька революція?",a:["1776","1789","1799","1815"],r:1},
 {id:"w03",c:"Всесвітня історія",q:"Який документ 1789 року у Франції проголосив природні й невід’ємні права людини?",a:["Декларація прав людини і громадянина","Велика хартія вольностей","Кодекс Наполеона","Декларація незалежності"],r:0},
 {id:"w04",c:"Всесвітня історія",q:"Яка подія вважається початком Реформації в Європі?",a:["Виступ Мартіна Лютера з 95 тезами","Варфоломіївська ніч","Аугсбурзький мир","Тридентський собор"],r:0},
 {id:"w05",c:"Всесвітня історія",q:"Хто здійснив першу навколосвітню експедицію, завершену його командою у 1522 році?",a:["Христофор Колумб","Васко да Гама","Фернан Магеллан","Амеріго Веспуччі"],r:2},
 {id:"w06",c:"Всесвітня історія",q:"Яка цивілізація створила полісну систему з такими центрами, як Афіни та Спарта?",a:["Давньоєгипетська","Давньогрецька","Фінікійська","Перська"],r:1},
 {id:"w07",c:"Всесвітня історія",q:"Хто був першим римським імператором?",a:["Юлій Цезар","Октавіан Август","Нерон","Траян"],r:1},
 {id:"w08",c:"Всесвітня історія",q:"У якому році традиційно датують падіння Західної Римської імперії?",a:["395","410","476","527"],r:2},
 {id:"w09",c:"Всесвітня історія",q:"Яка подія 1066 року суттєво змінила політичний розвиток Англії?",a:["Підписання Великої хартії вольностей","Нормандське завоювання","Початок Столітньої війни","Війна Червоної та Білої троянд"],r:1},
 {id:"w10",c:"Всесвітня історія",q:"Який документ англійський король Іоанн Безземельний підписав у 1215 році?",a:["Білль про права","Велику хартію вольностей","Акт про супрематію","Петицію про право"],r:1},
 {id:"w11",c:"Всесвітня історія",q:"Яка війна тривала між Англією та Францією у XIV–XV століттях?",a:["Тридцятилітня","Столітня","Семилітня","Пунічна"],r:1},
 {id:"w12",c:"Всесвітня історія",q:"Яка подія 1453 року традиційно вважається важливою межею між Середньовіччям і Новим часом?",a:["Падіння Константинополя","Відкриття Америки","Початок Реформації","Завершення Реконкісти"],r:0},
 {id:"w13",c:"Всесвітня історія",q:"Хто сформулював геліоцентричну модель світу в праці «Про обертання небесних сфер»?",a:["Галілео Галілей","Миколай Коперник","Ісаак Ньютон","Йоганн Кеплер"],r:1},
 {id:"w14",c:"Всесвітня історія",q:"Яка держава першою розпочала промисловий переворот у XVIII столітті?",a:["Франція","Велика Британія","Німеччина","США"],r:1},
 {id:"w15",c:"Всесвітня історія",q:"Яка битва 1815 року завершила період «Ста днів» Наполеона?",a:["Аустерліц","Лейпциг","Ватерлоо","Бородіно"],r:2},
 {id:"w16",c:"Всесвітня історія",q:"Який конгрес 1814–1815 років визначав повоєнний устрій Європи після наполеонівських війн?",a:["Берлінський","Віденський","Паризький","Версальський"],r:1},
 {id:"w17",c:"Всесвітня історія",q:"У якому році було проголошено Німецьку імперію після об’єднання німецьких земель?",a:["1848","1861","1871","1882"],r:2},
 {id:"w18",c:"Всесвітня історія",q:"Хто був ключовою політичною постаттю об’єднання Німеччини у XIX столітті?",a:["Отто фон Бісмарк","Джузеппе Гарібальді","Клеменс Меттерніх","Луї-Філіпп"],r:0},
 {id:"w19",c:"Всесвітня історія",q:"Яка держава постала внаслідок об’єднання більшості італійських земель у 1861 році?",a:["Італійське королівство","Папська держава","Королівство Сардинія","Ломбардська республіка"],r:0},
 {id:"w20",c:"Всесвітня історія",q:"Який мирний договір офіційно завершив стан війни між Німеччиною та більшістю держав Антанти після Першої світової?",a:["Версальський","Брест-Литовський","Сен-Жерменський","Локарнський"],r:0},
 {id:"w21",c:"Всесвітня історія",q:"Яка міжнародна організація була створена після Першої світової війни для підтримання миру?",a:["ООН","Ліга Націй","НАТО","Рада Європи"],r:1},
 {id:"w22",c:"Всесвітня історія",q:"Яка економічна подія почалася з біржового краху у США восени 1929 року?",a:["Велика депресія","Нафтова криза","План Маршалла","Новий курс"],r:0},
 {id:"w23",c:"Всесвітня історія",q:"Яка подія 1 вересня 1939 року стала початком Другої світової війни в Європі?",a:["Напад Німеччини на Польщу","Напад Японії на Перл-Гарбор","Аншлюс Австрії","Мюнхенська угода"],r:0},
 {id:"w24",c:"Всесвітня історія",q:"Яка битва 1942–1943 років стала одним із ключових переломів у війні на Східному фронті?",a:["Сталінградська","Дюнкеркська","Арденнська","Ель-Аламейнська"],r:0},
 {id:"w25",c:"Всесвітня історія",q:"У якому році була створена Організація Об’єднаних Націй?",a:["1944","1945","1947","1949"],r:1},
 {id:"w26",c:"Всесвітня історія",q:"Яка програма США передбачала масштабну економічну допомогу країнам Західної Європи після Другої світової війни?",a:["Доктрина Трумена","План Маршалла","Новий курс","План Дауеса"],r:1},
 {id:"w27",c:"Всесвітня історія",q:"У якому році впала Берлінська стіна?",a:["1985","1987","1989","1991"],r:2},
 {id:"w28",c:"Всесвітня історія",q:"Яка подія 1969 року стала символом технологічного суперництва часів холодної війни?",a:["Перший політ людини в космос","Висадка людей на Місяць","Запуск першого штучного супутника","Створення МКС"],r:1},
 {id:"w29",c:"Всесвітня історія",q:"Яка організація є військово-політичним союзом, створеним у 1949 році?",a:["ЄС","НАТО","ООН","ОБСЄ"],r:1},
 {id:"w30",c:"Всесвітня історія",q:"Яка революція наприкінці XVIII століття привела до утворення незалежних Сполучених Штатів Америки?",a:["Американська революція","Липнева революція","Славна революція","Весна народів"],r:0}
];
const QMAP = Object.fromEntries(QUESTIONS.map(q => [q.id,q]));

let currentUser = null, myProfile = {}, users = {}, presence = {};
let currentChallenge = null, challengeUnsub = null, sentChallengeUnsub = null, sentChallengeRef = null;
let matchId = null, matchUnsub = null, matchData = null, previousHp = {};
let timerHandle = null, resolutionHandle = null, answerLocked = false, botState = null;
let lastOpponent = null;

function shuffledIds() {
  const ids = QUESTIONS.map(q=>q.id);
  for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
  return ids.slice(0,QUESTION_COUNT);
}
function initials(name){ return (String(name||'У').trim()[0]||'У').toUpperCase(); }
function avatarHtml(profile, fallbackName){
  const src = profile?.photoURL || profile?.googlePhotoURL || '';
  return src ? `<img src="${escapeHtml(src)}" alt="" referrerpolicy="no-referrer">` : escapeHtml(initials(fallbackName));
}
function ratingOf(p){ return Math.max(100, Number(p?.duel_rating)||1000); }
function toast(text, ms=2800){ const el=$('toast');el.textContent=text;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,ms); }
function showView(id){ ['lobbyView','arenaView','resultView'].forEach(v=>$(v).hidden=v!==id); }
function setModal(id,show){ $(id).hidden=!show; }

$('loginBtn').addEventListener('click', async()=>{
  try{ await signInWithPopup(auth,provider); }
  catch(e){ if(e?.code==='auth/popup-blocked'||e?.code==='auth/cancelled-popup-request'){await signInWithRedirect(auth,provider);} else {console.error(e);toast('Не вдалося відкрити Google-вхід.');}}
});
$('botDuelBtn').addEventListener('click',()=>startBotDuel());
$('fallbackBotBtn').addEventListener('click',async()=>{ await cancelSentChallenge(); startBotDuel(); });
$('cancelChallengeBtn').addEventListener('click',cancelSentChallenge);
$('acceptChallengeBtn').addEventListener('click',acceptChallenge);
$('declineChallengeBtn').addEventListener('click',declineChallenge);
$('backLobbyBtn').addEventListener('click',()=>{cleanupMatch();showView('lobbyView');renderLobby();});
$('rematchBtn').addEventListener('click',()=>{
  cleanupMatch();
  if(lastOpponent?.bot) startBotDuel();
  else if(lastOpponent?.uid && presence[lastOpponent.uid]?.online) sendChallenge(lastOpponent.uid);
  else {showView('lobbyView');toast('Суперник уже не онлайн.');}
});

onValue(ref(db,'users'), snap=>{users=snap.val()||{}; if(currentUser){myProfile=users[currentUser.uid]||myProfile;renderMyStats();} renderLobby();renderDuelLeaderboard();});
onValue(ref(db,'presence'), snap=>{presence=snap.val()||{};renderLobby();});

onAuthStateChanged(auth, async user=>{
  currentUser=user;
  if(!user){
    $('authTitle').textContent='Увійдіть через Google';
    $('authText').textContent='Після входу ви побачите учнів, які зараз на сайті.';
    $('loginBtn').hidden=false;$('botDuelBtn').disabled=true;
    cleanupChallengeListeners();renderLobby();return;
  }
  $('authTitle').textContent=user.displayName||'Учень';
  $('authText').textContent='Ви на арені. Оберіть суперника або бота.';
  $('loginBtn').hidden=true;$('botDuelBtn').disabled=false;
  await ensureProfile(user);
  await startPresence(user);
  listenIncomingChallenges(user.uid);
  renderMyStats();renderLobby();renderDuelLeaderboard();
});

async function ensureProfile(user){
  await runTransaction(ref(db,'users/'+user.uid), data=>{
    data=data||{};
    data.name=data.name||user.displayName||'Учень';
    data.email=data.email||user.email||'';
    if(user.photoURL){data.photoURL=user.photoURL;data.googlePhotoURL=user.photoURL;}
    data.role=user.uid===OWNER_UID?'teacher':(data.role||'student');
    if(data.duel_rating===undefined)data.duel_rating=1000;
    if(data.duel_wins===undefined)data.duel_wins=0;
    if(data.duel_losses===undefined)data.duel_losses=0;
    if(data.duel_draws===undefined)data.duel_draws=0;
    if(data.duel_streak===undefined)data.duel_streak=0;
    if(data.duel_xp===undefined)data.duel_xp=0;
    return data;
  });
  const s=await get(ref(db,'users/'+user.uid));myProfile=s.val()||{};
}
async function startPresence(user){
  const pRef=ref(db,'presence/'+user.uid);
  try{
    await onDisconnect(pRef).set({online:false,name:user.displayName||'Учень',role:user.uid===OWNER_UID?'teacher':'student',lastSeen:serverTimestamp()});
    await update(pRef,{online:true,name:myProfile.name||user.displayName||'Учень',role:user.uid===OWNER_UID?'teacher':(myProfile.role||'student'),lastSeen:serverTimestamp(),duelReady:true});
  }catch(e){console.warn('Presence:',e);}
}
function renderMyStats(){
  $('myRating').textContent=ratingOf(myProfile);
  $('myWins').textContent=Number(myProfile.duel_wins)||0;
  $('myStreak').textContent=Number(myProfile.duel_streak)||0;
}
function renderLobby(){
  const box=$('onlinePlayers');
  if(!currentUser){box.innerHTML='<div class="empty-state">Увійдіть, щоб побачити учнів онлайн.</div>';$('onlineCount').textContent='0 онлайн';return;}
  const list=Object.entries(presence).filter(([uid,p])=>uid!==currentUser.uid&&uid!==OWNER_UID&&p?.online===true&&p?.role!=='teacher')
    .map(([uid,p])=>({uid,...p,profile:users[uid]||{}})).sort((a,b)=>ratingOf(b.profile)-ratingOf(a.profile));
  $('onlineCount').textContent=`${list.length} онлайн`;
  if(!list.length){box.innerHTML='<div class="empty-state"><strong>Інших учнів зараз немає.</strong><br>Архіваріус уже чекає на дуель 🤖</div>';return;}
  box.innerHTML=list.map(p=>`<div class="player-row">
    <div class="player-avatar">${avatarHtml(p.profile,p.name)}</div>
    <div class="player-info"><strong>${escapeHtml(p.profile.name||p.name||'Учень')}</strong><span>${ratingOf(p.profile)} рейтингу • ${Number(p.profile.duel_wins)||0} перемог</span></div>
    <button class="challenge-btn" data-duel-user="${p.uid}">Виклик ⚔️</button>
  </div>`).join('');
  box.querySelectorAll('[data-duel-user]').forEach(btn=>btn.addEventListener('click',()=>sendChallenge(btn.dataset.duelUser)));
}
function renderDuelLeaderboard(){
  const list=Object.entries(users).filter(([uid,p])=>uid!==OWNER_UID&&p&&p.role!=='teacher'&&(p.name||p.email))
    .map(([uid,p])=>({uid,...p})).sort((a,b)=>ratingOf(b)-ratingOf(a)).slice(0,10);
  $('duelLeaderboard').innerHTML=list.length?list.map((p,i)=>`<div class="rank-row"><span class="rank-pos">#${i+1}</span><span class="rank-name">${escapeHtml(p.name||p.email||'Учень')}</span><span class="rank-rating">${ratingOf(p)} RP</span></div>`).join(''):'<div class="empty-state">Ще немає завершених дуелей.</div>';
}

function cleanupChallengeListeners(){
  try{challengeUnsub?.();}catch{} challengeUnsub=null;
  try{sentChallengeUnsub?.();}catch{} sentChallengeUnsub=null;
}
function listenIncomingChallenges(uid){
  try{challengeUnsub?.();}catch{}
  challengeUnsub=onValue(ref(db,'duelChallenges/'+uid), snap=>{
    const raw=snap.val()||{};
    const pending=Object.entries(raw).map(([id,c])=>({id,...c}))
      .filter(c=>c.status==='pending'&&Date.now()-(Number(c.createdAt)||0)<45000)
      .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    const c=pending[0];
    if(!c||matchId)return;
    currentChallenge=c;
    $('challengeTitle').textContent=`${c.fromName||'Учень'} викликає вас на дуель`;
    setModal('challengeModal',true);
  },err=>console.warn('Challenges:',err));
}
async function sendChallenge(uid){
  if(!currentUser||uid===currentUser.uid)return;
  if(!presence[uid]?.online){toast('Цей учень уже не на сайті.');renderLobby();return;}
  lastOpponent={uid,bot:false};
  const matchKey=push(ref(db,'duelMatches')).key;
  const cRef=push(ref(db,'duelChallenges/'+uid));
  sentChallengeRef=cRef;
  const challenge={fromUid:currentUser.uid,fromName:myProfile.name||currentUser.displayName||'Учень',toUid:uid,toName:users[uid]?.name||presence[uid]?.name||'Учень',matchId:matchKey,questionIds:shuffledIds(),createdAt:Date.now(),status:'pending'};
  try{
    await set(cRef,challenge);
    setModal('waitingModal',true);$('waitingTitle').textContent=`Виклик для ${challenge.toName}`;$('waitingText').textContent='Чекаємо до 30 секунд. Можна одразу перейти до бота.';
    try{sentChallengeUnsub?.();}catch{}
    sentChallengeUnsub=onValue(cRef,s=>{
      const val=s.val();if(!val)return;
      if(val.status==='accepted'){setModal('waitingModal',false);sentChallengeUnsub?.();sentChallengeUnsub=null;sentChallengeRef=null;enterPvpMatch(matchKey);}
      if(val.status==='declined'){setModal('waitingModal',false);sentChallengeUnsub?.();sentChallengeUnsub=null;sentChallengeRef=null;toast('Суперник відхилив виклик.');}
    });
    setTimeout(async()=>{const s=await get(cRef);if(s.val()?.status==='pending'){await update(cRef,{status:'expired'}).catch(()=>{});setModal('waitingModal',false);toast('Виклик не прийнято. Архіваріус готовий до бою.');}},30000);
  }catch(e){console.error(e);toast('Не вдалося надіслати виклик. Перевірте Firebase Rules.');}
}
async function cancelSentChallenge(){
  setModal('waitingModal',false);
  try{sentChallengeUnsub?.();}catch{} sentChallengeUnsub=null;
  if(sentChallengeRef){
    try{await update(sentChallengeRef,{status:'canceled',canceledAt:Date.now()});}catch(e){console.warn('Cancel challenge:',e);}
    sentChallengeRef=null;
  }
}
async function acceptChallenge(){
  const c=currentChallenge;if(!c||!currentUser)return;
  setModal('challengeModal',false);
  const myP=users[currentUser.uid]||myProfile||{}, opP=users[c.fromUid]||{};
  const match={
    mode:'pvp',status:'active',hostUid:c.fromUid,createdAt:Date.now(),round:0,roundStartedAt:Date.now()+3200,questionIds:c.questionIds||shuffledIds(),
    players:{
      [c.fromUid]:{uid:c.fromUid,name:c.fromName||opP.name||'Учень',rating:ratingOf(opP),hp:100,score:0,correct:0,totalMs:0},
      [currentUser.uid]:{uid:currentUser.uid,name:myP.name||currentUser.displayName||'Учень',rating:ratingOf(myP),hp:100,score:0,correct:0,totalMs:0}
    },answers:{},resolved:{}
  };
  try{
    await set(ref(db,'duelMatches/'+c.matchId),match);
    await update(ref(db,`duelChallenges/${currentUser.uid}/${c.id}`),{status:'accepted',acceptedAt:Date.now()});
    lastOpponent={uid:c.fromUid,bot:false};currentChallenge=null;enterPvpMatch(c.matchId);
  }catch(e){console.error(e);toast('Не вдалося створити матч.');}
}
async function declineChallenge(){
  const c=currentChallenge;if(!c||!currentUser)return;
  setModal('challengeModal',false);
  await update(ref(db,`duelChallenges/${currentUser.uid}/${c.id}`),{status:'declined'}).catch(()=>{});
  currentChallenge=null;
}

function enterPvpMatch(id){
  cleanupMatch();matchId=id;botState=null;answerLocked=false;showView('arenaView');
  try{matchUnsub?.();}catch{}
  matchUnsub=onValue(ref(db,'duelMatches/'+id),snap=>{
    const d=snap.val();if(!d)return;const old=matchData;matchData=d;renderPvp(d,old);maybeResolvePvp();
  },e=>{console.error(e);toast('Втрачено зв’язок із дуеллю.');});
  resolutionHandle=setInterval(maybeResolvePvp,400);
}
function getSides(d){
  const entries=Object.values(d.players||{});
  const me=entries.find(p=>p.uid===currentUser?.uid)||entries[0];
  const op=entries.find(p=>p.uid!==currentUser?.uid)||entries[1];
  return {me,op};
}
function renderPvp(d,old){
  const {me,op}=getSides(d);if(!me||!op)return;
  setFighter('left',me,users[me.uid]||{});setFighter('right',op,users[op.uid]||{});
  if(old){const oldSides=getSides(old);if(oldSides.me&&me.hp<oldSides.me.hp)animateHit('left',oldSides.me.hp-me.hp,'right');if(oldSides.op&&op.hp<oldSides.op.hp)animateHit('right',oldSides.op.hp-op.hp,'left');}
  if(d.status==='finished'){finishMatch(d);return;}
  const round=Number(d.round)||0;const q=QMAP[d.questionIds?.[round]];if(!q)return;
  $('roundLabel').textContent=`РАУНД ${round+1} / ${QUESTION_COUNT}`;
  renderQuestion(q,d.roundStartedAt, d.answers?.[round]?.[currentUser.uid]);
}
function setFighter(side,p,profile){
  const cap=side[0].toUpperCase()+side.slice(1);
  $(side+'Name').textContent=p.name||'Учень';$(side+'Rating').textContent=`${p.rating||ratingOf(profile)} рейтингу`;
  $(side+'Hp').style.width=`${Math.max(0,p.hp)}%`;$(side+'Hp').classList.toggle('low',p.hp<=35);
  $(side+'Correct').textContent=p.correct||0;$(side+'Score').textContent=Math.round(p.score||0);
  $(side+'Avatar').innerHTML=avatarHtml(profile,p.name);
}
function renderQuestion(q,startAt,myAnswer){
  clearInterval(timerHandle);answerLocked=!!myAnswer;
  $('questionCategory').textContent=q.c;$('questionText').textContent=q.q;
  $('answerState').textContent=myAnswer?'Відповідь зафіксовано':'Обери відповідь';
  $('answersGrid').innerHTML=q.a.map((a,i)=>`<button class="answer-btn" data-answer="${i}" ${myAnswer?'disabled':''}>${escapeHtml(a)}</button>`).join('');
  $('answersGrid').querySelectorAll('.answer-btn').forEach(b=>b.addEventListener('click',()=>submitPvpAnswer(Number(b.dataset.answer))));
  const tick=()=>{
    const now=Date.now(), wait=startAt-now;
    if(wait>0){const n=Math.max(1,Math.ceil(wait/1000));$('countdown').hidden=false;$('countdown').textContent=n;$('timerLabel').textContent='—';$('questionProgress').style.width='100%';return;}
    $('countdown').hidden=true;const left=Math.max(0,ROUND_MS-(now-startAt));$('timerLabel').textContent=(left/1000).toFixed(1);$('questionProgress').style.width=`${left/ROUND_MS*100}%`;
    if(left<=0&&!answerLocked){answerLocked=true;$('answerState').textContent='Час вийшов';$('answersGrid').querySelectorAll('button').forEach(b=>b.disabled=true);maybeResolvePvp();}
  };tick();timerHandle=setInterval(tick,100);
}
async function submitPvpAnswer(index){
  if(answerLocked||!matchData||!currentUser)return;
  const round=matchData.round,q=QMAP[matchData.questionIds[round]],start=matchData.roundStartedAt;
  if(Date.now()<start)return;
  answerLocked=true;const ms=Math.min(ROUND_MS,Math.max(0,Date.now()-start)),correct=index===q.r;
  $('answerState').textContent=correct?'Правильно! ⚡':'Відповідь прийнято';
  $('answersGrid').querySelectorAll('.answer-btn').forEach((b,i)=>{b.disabled=true;if(i===q.r)b.classList.add('correct');if(i===index&&!correct)b.classList.add('wrong');});
  await runTransaction(ref(db,`duelMatches/${matchId}/answers/${round}/${currentUser.uid}`),cur=>cur||{index,correct,responseMs:ms,at:Date.now()}).catch(console.error);
}
function damageFor(a){if(!a?.correct)return 0;return 12+Math.max(0,Math.min(10,Math.floor((ROUND_MS-a.responseMs)/1400)));}
async function maybeResolvePvp(){
  const d=matchData;if(!d||d.status!=='active'||!currentUser)return;
  const round=Number(d.round)||0;if(d.resolved?.[round])return;
  const players=Object.values(d.players||{});if(players.length<2)return;
  const a=d.answers?.[round]||{},both=players.every(p=>a[p.uid]),expired=Date.now()>=(Number(d.roundStartedAt)||0)+ROUND_MS+350;
  if(!both&&!expired)return;
  await runTransaction(ref(db,'duelMatches/'+matchId),data=>{
    if(!data||data.status!=='active'||data.round!==round||data.resolved?.[round])return data;
    const ps=Object.values(data.players||{}),ans=data.answers?.[round]||{};
    data.resolved=data.resolved||{};data.resolved[round]={at:Date.now()};
    for(const p of ps){const aa=ans[p.uid];if(aa){p.score=(Number(p.score)||0)+(aa.correct?1000+Math.max(0,ROUND_MS-aa.responseMs):0);if(aa.correct)p.correct=(Number(p.correct)||0)+1;p.totalMs=(Number(p.totalMs)||0)+(Number(aa.responseMs)||ROUND_MS);}}
    for(const attacker of ps){const defender=ps.find(p=>p.uid!==attacker.uid);if(defender)defender.hp=Math.max(0,(Number(defender.hp)||100)-damageFor(ans[attacker.uid]));}
    const ko=ps.some(p=>p.hp<=0),last=round>=QUESTION_COUNT-1;
    if(ko||last){
      data.status='finished';data.finishedAt=Date.now();
      const sorted=[...ps].sort((x,y)=>(y.hp-x.hp)||(y.score-x.score));
      data.winnerUid=sorted[0].hp===sorted[1].hp&&sorted[0].score===sorted[1].score?'draw':sorted[0].uid;
    }else{data.round=round+1;data.roundStartedAt=Date.now()+1800;}
    return data;
  }).catch(e=>console.warn('Resolve:',e));
}

function startBotDuel(){
  if(!currentUser){toast('Спочатку увійдіть через Google.');return;}
  setModal('waitingModal',false);cleanupMatch();lastOpponent={bot:true};
  const ids=shuffledIds();
  botState={mode:'bot',round:0,questionIds:ids,roundStartedAt:Date.now()+2500,player:{uid:currentUser.uid,name:myProfile.name||currentUser.displayName||'Учень',rating:ratingOf(myProfile),hp:100,score:0,correct:0,totalMs:0},bot:{uid:'bot',name:'Архіваріус',rating:1020,hp:100,score:0,correct:0,totalMs:0},answered:false,botAnswer:null,status:'active'};
  showView('arenaView');renderBot();
}
function renderBot(){
  const d=botState;if(!d)return;if(d.status==='finished'){finishBot();return;}
  setFighter('left',d.player,myProfile);setFighter('right',d.bot,{});
  $('rightAvatar').textContent='🏛️';$('roundLabel').textContent=`РАУНД ${d.round+1} / ${QUESTION_COUNT}`;
  const q=QMAP[d.questionIds[d.round]];clearInterval(timerHandle);answerLocked=false;
  $('questionCategory').textContent=q.c;$('questionText').textContent=q.q;$('answerState').textContent='Обери відповідь';
  $('answersGrid').innerHTML=q.a.map((a,i)=>`<button class="answer-btn" data-answer="${i}">${escapeHtml(a)}</button>`).join('');
  $('answersGrid').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>submitBotAnswer(Number(b.dataset.answer))));
  const botMs=3000+Math.floor(Math.random()*8500), botCorrect=Math.random()<.69;
  const wrong=[0,1,2,3].filter(i=>i!==q.r);d.botPlan={responseMs:botMs,index:botCorrect?q.r:wrong[Math.floor(Math.random()*wrong.length)]};
  const tick=()=>{
    const now=Date.now(),wait=d.roundStartedAt-now;
    if(wait>0){$('countdown').hidden=false;$('countdown').textContent=Math.max(1,Math.ceil(wait/1000));$('timerLabel').textContent='—';return;}
    $('countdown').hidden=true;const elapsed=now-d.roundStartedAt,left=Math.max(0,ROUND_MS-elapsed);$('timerLabel').textContent=(left/1000).toFixed(1);$('questionProgress').style.width=`${left/ROUND_MS*100}%`;
    if(!d.botAnswer&&elapsed>=d.botPlan.responseMs)d.botAnswer={index:d.botPlan.index,correct:d.botPlan.index===q.r,responseMs:d.botPlan.responseMs};
    if(left<=0&&!d.answered){d.answered=true;$('answerState').textContent='Час вийшов';$('answersGrid').querySelectorAll('button').forEach(b=>b.disabled=true);}
    if((d.answered||left<=0)&&d.botAnswer)resolveBotRound();
  };timerHandle=setInterval(tick,100);tick();
}
function submitBotAnswer(index){
  const d=botState;if(!d||d.answered||Date.now()<d.roundStartedAt)return;
  const q=QMAP[d.questionIds[d.round]],ms=Math.min(ROUND_MS,Date.now()-d.roundStartedAt),correct=index===q.r;
  d.answered={index,correct,responseMs:ms};answerLocked=true;$('answerState').textContent=correct?'Правильно! ⚡':'Відповідь прийнято';
  $('answersGrid').querySelectorAll('.answer-btn').forEach((b,i)=>{b.disabled=true;if(i===q.r)b.classList.add('correct');if(i===index&&!correct)b.classList.add('wrong');});
  if(d.botAnswer)resolveBotRound();
}
function resolveBotRound(){
  const d=botState;if(!d||d.resolving)return;d.resolving=true;clearInterval(timerHandle);
  const pa=typeof d.answered==='object'?d.answered:null,ba=d.botAnswer;
  if(pa){d.player.score+=(pa.correct?1000+ROUND_MS-pa.responseMs:0);if(pa.correct)d.player.correct++;d.player.totalMs+=pa.responseMs;}
  else d.player.totalMs+=ROUND_MS;
  if(ba){d.bot.score+=(ba.correct?1000+ROUND_MS-ba.responseMs:0);if(ba.correct)d.bot.correct++;d.bot.totalMs+=ba.responseMs;}
  d.player.hp=Math.max(0,d.player.hp-damageFor(ba));d.bot.hp=Math.max(0,d.bot.hp-damageFor(pa));
  if(damageFor(pa))animateHit('right',damageFor(pa),'left');if(damageFor(ba))animateHit('left',damageFor(ba),'right');
  setTimeout(()=>{setFighter('left',d.player,myProfile);setFighter('right',d.bot,{});$('rightAvatar').textContent='🏛️';
    if(d.player.hp<=0||d.bot.hp<=0||d.round>=QUESTION_COUNT-1){d.status='finished';const a=d.player,b=d.bot;d.winnerUid=a.hp===b.hp&&a.score===b.score?'draw':((a.hp>b.hp||(a.hp===b.hp&&a.score>b.score))?a.uid:'bot');finishBot();}
    else{d.round++;d.roundStartedAt=Date.now()+1600;d.answered=false;d.botAnswer=null;d.resolving=false;renderBot();}
  },1100);
}

function animateHit(target,damage,attacker){
  const t=$(`fighter${target==='left'?'Left':'Right'}`),a=$(`fighter${attacker==='left'?'Left':'Right'}`),arena=document.querySelector('.arena');
  a.classList.add(attacker==='left'?'attack-left':'attack-right');setTimeout(()=>a.classList.remove('attack-left','attack-right'),500);
  setTimeout(()=>{t.classList.add('hit');arena.classList.add('screen-hit');const fx=document.createElement('div');fx.className=`projectile ${attacker}`;fx.textContent='⚡';$('battleFx').appendChild(fx);
    const dmg=document.createElement('div');dmg.className='damage-float';dmg.textContent=`-${damage}`;dmg.style.left=target==='left'?'22%':'74%';dmg.style.top='42%';$('battleFx').appendChild(dmg);
    setTimeout(()=>{t.classList.remove('hit');arena.classList.remove('screen-hit');fx.remove();dmg.remove();},900);
  },260);
}
async function finishMatch(d){
  clearInterval(timerHandle);clearInterval(resolutionHandle);resolutionHandle=null;
  const {me,op}=getSides(d),winner=d.winnerUid;await applyReward(winner,'pvp',matchId,me);
  showResult(winner===currentUser.uid?'win':winner==='draw'?'draw':'loss',me,op,'pvp');
}
async function finishBot(){
  clearInterval(timerHandle);const d=botState,w=d.winnerUid;await applyReward(w,'bot','bot-'+Date.now(),d.player);
  showResult(w===currentUser.uid?'win':w==='draw'?'draw':'loss',d.player,d.bot,'bot');
}
async function applyReward(winnerUid,mode,rewardId,me){
  if(!currentUser)return;
  const outcome=winnerUid==='draw'?'draw':winnerUid===currentUser.uid?'win':'loss';
  const coins=mode==='pvp'?(outcome==='win'?15:outcome==='draw'?8:5):(outcome==='win'?8:outcome==='draw'?5:3);
  const ratingDelta=mode==='pvp'?(outcome==='win'?24:outcome==='draw'?3:-10):(outcome==='win'?10:outcome==='draw'?2:-4);
  await runTransaction(ref(db,'users/'+currentUser.uid),data=>{
    data=data||{};data.duel_rewarded=data.duel_rewarded||{};const key=rewardId.replace(/[.#$[\]/]/g,'_');if(data.duel_rewarded[key])return data;
    data.duel_rewarded[key]={at:Date.now(),outcome,mode,coins,ratingDelta};
    data.duel_matches=(Number(data.duel_matches)||0)+1;data.duel_rating=Math.max(100,(Number(data.duel_rating)||1000)+ratingDelta);data.duel_xp=(Number(data.duel_xp)||0)+(outcome==='win'?30:outcome==='draw'?18:12);
    if(outcome==='win'){data.duel_wins=(Number(data.duel_wins)||0)+1;data.duel_streak=(Number(data.duel_streak)||0)+1;}
    else if(outcome==='loss'){data.duel_losses=(Number(data.duel_losses)||0)+1;data.duel_streak=0;}
    else data.duel_draws=(Number(data.duel_draws)||0)+1;
    data.portal_coins=Math.max(0,Number(data.portal_coins)||0)+coins;data.portal_coins_earned=Math.max(0,Number(data.portal_coins_earned)||0)+coins;
    data.last_duel_at=Date.now();data.last_duel_result=outcome;return data;
  }).then(async()=>{const s=await get(ref(db,'users/'+currentUser.uid));myProfile=s.val()||{};renderMyStats();});
  window.__lastDuelReward={coins,ratingDelta,outcome};
}
function showResult(outcome,me,op,mode){
  showView('resultView');const r=window.__lastDuelReward||{coins:0,ratingDelta:0};
  $('resultIcon').textContent=outcome==='win'?'🏆':outcome==='draw'?'🤝':'🛡️';$('resultTitle').textContent=outcome==='win'?'Перемога!':outcome==='draw'?'Нічия':'Цього разу поразка';
  $('resultText').textContent=outcome==='win'?`Ви перемогли ${op.name}. Знання та швидкість дали перевагу.`:outcome==='draw'?`Абсолютно рівна дуель із ${op.name}.`:`${op.name} переміг у цій дуелі. Реванш може змінити все.`;
  $('resultCorrect').textContent=`${me.correct||0}/${QUESTION_COUNT}`;$('resultSpeed').textContent=me.correct?`${((me.totalMs||0)/Math.max(1,QUESTION_COUNT)/1000).toFixed(1)} с`:'—';
  $('resultReward').textContent=`+${r.coins||0} 🪙`;$('resultRating').textContent=`${(r.ratingDelta||0)>=0?'+':''}${r.ratingDelta||0}`;
}
function cleanupMatch(){
  clearInterval(timerHandle);timerHandle=null;clearInterval(resolutionHandle);resolutionHandle=null;try{matchUnsub?.();}catch{}matchUnsub=null;matchId=null;matchData=null;botState=null;previousHp={};answerLocked=false;$('battleFx').innerHTML='';
}
window.addEventListener('beforeunload',()=>{if(currentUser)update(ref(db,'presence/'+currentUser.uid),{online:false,lastSeen:serverTimestamp()}).catch(()=>{});});
