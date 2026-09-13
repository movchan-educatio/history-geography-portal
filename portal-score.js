/* Portal score synchronization — single Firebase scoring layer */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
const database = getDatabase(app);
let currentUser = null;
let authReadyResolve;
const authReady = new Promise(resolve => { authReadyResolve = resolve; });

const pendingKey = kind => `portal_pending_${kind}`;
function readPending(kind) {
  try { return JSON.parse(localStorage.getItem(pendingKey(kind)) || '{}') || {}; }
  catch { return {}; }
}
function writePending(kind, value) {
  localStorage.setItem(pendingKey(kind), JSON.stringify(value || {}));
}

function getCurrentWeekKey() {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

async function requireUser() {
  await authReady;
  return currentUser;
}

function setSyncStatus(type, text) {
  const el = document.getElementById(`${type}-sync-status`);
  if (el) el.textContent = text;
}

function calculateWeekScore(data = {}) {
  return (Number(data.week_history_points) || 0) +
    (Number(data.week_geography_points) || 0) +
    (Number(data.week_nmt_history_score) || 0) +
    (Number(data.week_nmt_geography_score) || 0) +
    (Number(data.week_truth_or_lie_points) || 0) +
    (Number(data.week_map_activity_points) || 0) +
    (Number(data.week_history_activity_points) || 0) +
    (Number(data.week_flags_points) || 0) +
    (Number(data.week_escape_points) || 0);
}


// ===== PORTAL ECONOMY / STORE / ACHIEVEMENTS =====
const PORTAL_STORE_CATALOG = Object.freeze({
  // Одяг / образи
  skin_student:       { type:'skin', value:'student',       price:0,   label:'Учень' },
  outfit_hoodie:      { type:'skin', value:'hoodie',        price:120, label:'Худі' },
  outfit_varsity:     { type:'skin', value:'varsity',       price:220, label:'Бомбер ліцею' },
  outfit_uniform:     { type:'skin', value:'uniform',       price:300, label:'Парадний образ' },
  outfit_history:     { type:'skin', value:'history_club',  price:360, label:'Клуб історії' },
  outfit_geo:         { type:'skin', value:'geo_club',      price:360, label:'Клуб географії' },
  outfit_sport:       { type:'skin', value:'sport',         price:430, label:'Спортивний комплект' },
  outfit_cyber:       { type:'skin', value:'cyber',         price:650, label:'Cyber Student' },
  outfit_honor:       { type:'skin', value:'honor',         price:850, label:'Легенда ліцею' },
  outfit_neon:        { type:'skin', value:'neon',          price:520, label:'Neon Pulse' },
  outfit_shadow:      { type:'skin', value:'shadow',        price:560, label:'Shadow' },
  outfit_frost:       { type:'skin', value:'frost',         price:620, label:'Frost Byte' },
  outfit_solar:       { type:'skin', value:'solar',         price:700, label:'Solar Rush' },
  outfit_pixel:       { type:'skin', value:'pixel',         price:760, label:'Pixel Hero' },
  outfit_captain:     { type:'skin', value:'captain',       price:980, label:'Капітан ліцею' },
  outfit_arcade:      { type:'skin', value:'arcade',        price:580, label:'Arcade Kid' },
  outfit_street:      { type:'skin', value:'street',        price:640, label:'Street Crew' },
  outfit_toxic:       { type:'skin', value:'toxic',         price:720, label:'Toxic Lab' },
  outfit_galaxy:      { type:'skin', value:'galaxy',        price:820, label:'Galaxy' },
  outfit_royal:       { type:'skin', value:'royal',         price:1050,label:'Royal Blue' },
  outfit_glitch:      { type:'skin', value:'glitch',        price:930, label:'Glitch' },
  outfit_ember:       { type:'skin', value:'ember',         price:680, label:'Ember Core' },
  outfit_mint:        { type:'skin', value:'mint',          price:720, label:'Mint Rush' },
  outfit_void:        { type:'skin', value:'void',          price:980, label:'Void Walker' },
  outfit_academy:     { type:'skin', value:'academy',       price:620, label:'Academy Pro' },
  outfit_spectrum:    { type:'skin', value:'spectrum',      price:1120,label:'Spectrum' },
  outfit_stealth:     { type:'skin', value:'stealth',       price:900, label:'Stealth' },
  outfit_champion:    { type:'skin', value:'champion',      price:1320,label:'Champion 01' },
  outfit_crimson:     { type:'skin', value:'crimson',       price:780, label:'Crimson Ace' },

  // Колекційні костюми
  skin_dino:          { type:'skin', value:'dino',          price:500, label:'Костюм Dino' },
  skin_teacher:       { type:'skin', value:'teacher',       price:600, label:'Маскування вчителя' },
  skin_cossack:       { type:'skin', value:'cossack',       price:420, label:'Козак' },
  skin_knight:        { type:'skin', value:'knight',        price:460, label:'Лицар' },
  skin_pharaoh:       { type:'skin', value:'pharaoh',       price:520, label:'Фараон' },
  skin_explorer:      { type:'skin', value:'explorer',      price:540, label:'Мандрівник' },
  skin_archaeologist: { type:'skin', value:'archaeologist', price:580, label:'Археолог' },
  skin_prince:        { type:'skin', value:'prince',        price:650, label:'Князь' },
  skin_viking:        { type:'skin', value:'viking',        price:680, label:'Вікінг' },
  skin_pirate:        { type:'skin', value:'pirate',        price:620, label:'Пірат' },
  skin_legionary:     { type:'skin', value:'legionary',     price:690, label:'Римський легіонер' },
  skin_scythian:      { type:'skin', value:'scythian',      price:720, label:'Скіфський лучник' },
  skin_musketeer:     { type:'skin', value:'musketeer',     price:760, label:'Мушкетер' },
  skin_samurai:       { type:'skin', value:'samurai',       price:820, label:'Самурай' },

  // Шкільний арсенал
  weapon_school_blaster: { type:'weapon', value:'school_blaster', price:0,   label:'Імпульсний бластер' },
  weapon_marker:         { type:'weapon', value:'marker_blaster', price:120, label:'Маркер-бластер' },
  weapon_chalk:          { type:'weapon', value:'chalk_cannon',   price:200, label:'Крейдяна гармата' },
  weapon_bookwave:       { type:'weapon', value:'book_wave',      price:280, label:'Дискомет знань' },
  weapon_ruler:          { type:'weapon', value:'laser_ruler',    price:360, label:'Лазерна лінійка' },
  weapon_science:        { type:'weapon', value:'science_pulse',  price:480, label:'Науковий імпульс' },
  weapon_bell:           { type:'weapon', value:'bell_breaker',   price:650, label:'Дзвінкобій' },
  weapon_honor:          { type:'weapon', value:'honor_cannon',   price:900, label:'Бластер відмінника' },
  weapon_pulse_smg:      { type:'weapon', value:'pulse_smg',      price:340, label:'Pulse SMG' },
  weapon_prism:          { type:'weapon', value:'prism_rifle',    price:540, label:'Prism Rifle' },
  weapon_gravity:        { type:'weapon', value:'gravity_disc',   price:620, label:'Gravity Disc' },
  weapon_storm:          { type:'weapon', value:'storm_launcher', price:780, label:'Storm Launcher' },
  weapon_echo:           { type:'weapon', value:'echo_bow',       price:860, label:'Echo Bow' },
  weapon_twin:           { type:'weapon', value:'twin_sparks',    price:420, label:'Twin Sparks' },
  weapon_nova:           { type:'weapon', value:'nova_shot',      price:590, label:'Nova Shot' },
  weapon_rail:           { type:'weapon', value:'rail_driver',    price:760, label:'Rail Driver' },
  weapon_sonic:          { type:'weapon', value:'sonic_burst',    price:680, label:'Sonic Burst' },
  weapon_frost_ray:      { type:'weapon', value:'frost_ray',      price:840, label:'Frost Ray' },
  weapon_comet:          { type:'weapon', value:'comet_cannon',   price:1080,label:'Comet Cannon' },
  weapon_vector:         { type:'weapon', value:'vector_pulse',   price:520, label:'Vector Pulse' },
  weapon_arc:            { type:'weapon', value:'arc_blaster',    price:720, label:'Arc Blaster' },
  weapon_meteor_disc:    { type:'weapon', value:'meteor_disc',    price:820, label:'Meteor Disc' },
  weapon_volt:           { type:'weapon', value:'volt_caster',    price:940, label:'Volt Caster' },
  weapon_rapid_marker:   { type:'weapon', value:'rapid_marker',   price:460, label:'Rapid Marker' },
  weapon_crystal_bow:    { type:'weapon', value:'crystal_bow',    price:1180,label:'Crystal Bow' },

  weapon_skin_default: { type:'weapon_skin', value:'default', price:0,   label:'Стандарт' },
  weapon_skin_neon:    { type:'weapon_skin', value:'neon',    price:180, label:'Neon Flux' },
  weapon_skin_gold:    { type:'weapon_skin', value:'gold',    price:260, label:'Gold Rush' },
  weapon_skin_frost:   { type:'weapon_skin', value:'frost',   price:320, label:'Frost' },
  weapon_skin_toxic:   { type:'weapon_skin', value:'toxic',   price:360, label:'Toxic' },
  weapon_skin_shadow:  { type:'weapon_skin', value:'shadow',  price:420, label:'Shadow' },
  weapon_skin_holo:    { type:'weapon_skin', value:'holo',    price:520, label:'Holo Prism' },
  weapon_skin_plasma:  { type:'weapon_skin', value:'plasma',  price:460, label:'Plasma' },
  weapon_skin_lava:    { type:'weapon_skin', value:'lava',    price:540, label:'Lava Core' },
  weapon_skin_mint:    { type:'weapon_skin', value:'minttech',price:390, label:'Mint Tech' },

  // Колекційна зброя
  weapon_firebreath:  { type:'weapon', value:'firebreath',     price:420, label:'Вогняний плювок' },
  weapon_training:    { type:'weapon', value:'training',       price:240, label:'Тренувальний бластер' },
  weapon_bow:         { type:'weapon', value:'prince_bow',     price:320, label:'Князівський лук' },
  weapon_crossbow:    { type:'weapon', value:'crossbow',       price:360, label:'Лицарський арбалет' },
  weapon_flare:       { type:'weapon', value:'flare',          price:380, label:'Сигнальний пістолет' },
  weapon_musket:      { type:'weapon', value:'cossack_musket', price:460, label:'Козацький мушкет' },
  weapon_disc:        { type:'weapon', value:'relic_disc',     price:480, label:'Релікварний диск' },
  weapon_ra_staff:    { type:'weapon', value:'ra_staff',       price:520, label:'Посох Ра' },
  weapon_viking_axe:  { type:'weapon', value:'viking_axe',     price:560, label:'Метальна сокира' },
  weapon_scythian_bow:{ type:'weapon', value:'scythian_bow',   price:590, label:'Скіфський складний лук' },
  weapon_pirate:      { type:'weapon', value:'pirate_pistol',  price:620, label:'Піратський пістолет' },
  weapon_pilum:       { type:'weapon', value:'roman_pilum',    price:650, label:'Римський пілум' },
  weapon_yumi:        { type:'weapon', value:'samurai_yumi',   price:720, label:'Самурайський юмі' },
  weapon_musketeer:   { type:'weapon', value:'musketeer_rifle',price:820, label:'Мушкетерська рушниця' },

  trail_gold:       { type:'trail', value:'gold',       price:120, label:'Золотий слід' },
  trail_fire:       { type:'trail', value:'fire',       price:220, label:'Вогняний слід' },
  trail_stars:      { type:'trail', value:'stars',      price:300, label:'Зоряний слід' },
  trail_lightning:  { type:'trail', value:'lightning',  price:380, label:'Блискавка' },

  frame_bronze:     { type:'frame', value:'bronze',     price:100, label:'Бронзова рамка' },
  frame_silver:     { type:'frame', value:'silver',     price:200, label:'Срібна рамка' },
  frame_gold:       { type:'frame', value:'gold',       price:350, label:'Золота рамка' },
  frame_historian:  { type:'frame', value:'historian',  price:450, label:'Історик' },

  boost_shield:     { type:'boost', value:'shield',     price:180, label:'Щит на старті' },
  boost_magnet:     { type:'boost', value:'magnet',     price:220, label:'Магніт жетонів' },
  boost_heart:      { type:'boost', value:'heart',      price:300, label:'+1 життя на старті' }
});

function ensurePortalEconomy(data = {}) {
  const oldScore = Math.max(0, Math.floor(Number(data.score) || 0));

  if (!data.portal_economy_version) {
    // Перший запуск економіки: старі бали стають стартовими монетами.
    if (data.portal_coins === undefined) data.portal_coins = oldScore;
    if (data.portal_coins_earned === undefined) data.portal_coins_earned = oldScore;
    data.portal_economy_version = 1;
  }

  data.portal_coins = Math.max(0, Math.floor(Number(data.portal_coins) || 0));
  data.portal_coins_earned = Math.max(data.portal_coins, Math.floor(Number(data.portal_coins_earned) || 0));
  data.portal_owned_items = data.portal_owned_items || {};
  data.portal_equipped = data.portal_equipped || {};

  // Міграція 2.8: стартовий персонаж — тільки Dino.
  // Старий "Вчитель" раніше був безкоштовним, тому це право безпечно прибираємо:
  // тепер його можна окремо купити в магазині.
  if ((Number(data.portal_economy_version) || 0) < 2) {
    data.portal_owned_items.skin_student = true;
    delete data.portal_owned_items.skin_teacher;

    // Старий тренувальний бластер теж був безкоштовним.
    // Новий стартовий комплект Dino — вогняний плювок.
    data.portal_owned_items.weapon_school_blaster = true;
    delete data.portal_owned_items.weapon_training;

    if (!data.portal_equipped.skin || data.portal_equipped.skin === 'teacher') {
      data.portal_equipped.skin = 'student';
    }
    if (!data.portal_equipped.weapon || data.portal_equipped.weapon === 'training') {
      data.portal_equipped.weapon = 'school_blaster';
    }
    data.portal_economy_version = 2;
  }

  // Міграція "Вижити до дзвінка"
  if ((Number(data.portal_economy_version) || 0) < 3) {
    data.portal_owned_items.skin_student = true;
    data.portal_owned_items.weapon_school_blaster = true;
    delete data.portal_owned_items.skin_dino;
    delete data.portal_owned_items.weapon_firebreath;
    if (!data.portal_equipped.skin || data.portal_equipped.skin === 'dino') data.portal_equipped.skin = 'student';
    if (!data.portal_equipped.weapon || data.portal_equipped.weapon === 'firebreath') data.portal_equipped.weapon = 'school_blaster';
    data.portal_economy_version = 3;
  }

  // Гарантовані безкоштовні стартові предмети.
  data.portal_owned_items.skin_student = true;
  data.portal_owned_items.weapon_school_blaster = true;
  data.portal_owned_items.trail_none = true;
  data.portal_owned_items.frame_none = true;
  data.portal_owned_items.weapon_skin_default = true;

  data.portal_equipped.skin = data.portal_equipped.skin || 'student';
  data.portal_equipped.weapon = data.portal_equipped.weapon || 'school_blaster';
  data.portal_equipped.trail = data.portal_equipped.trail || 'none';
  data.portal_equipped.frame = data.portal_equipped.frame || 'none';
  data.portal_equipped.weapon_skin = data.portal_equipped.weapon_skin || 'default';

  // Якщо після старої локальної конфігурації стоїть предмет, якого вже немає у власності,
  // повертаємо безпечний стартовий комплект.
  const skinItemId = Object.keys(PORTAL_STORE_CATALOG).find(
    id => PORTAL_STORE_CATALOG[id]?.type === 'skin' && PORTAL_STORE_CATALOG[id]?.value === data.portal_equipped.skin
  );
  if (data.portal_equipped.skin !== 'student' && (!skinItemId || !data.portal_owned_items[skinItemId])) {
    data.portal_equipped.skin = 'student';
  }

  const weaponItemId = Object.keys(PORTAL_STORE_CATALOG).find(
    id => PORTAL_STORE_CATALOG[id]?.type === 'weapon' && PORTAL_STORE_CATALOG[id]?.value === data.portal_equipped.weapon
  );
  if (data.portal_equipped.weapon !== 'school_blaster' && (!weaponItemId || !data.portal_owned_items[weaponItemId])) {
    data.portal_equipped.weapon = 'school_blaster';
  }

  const weaponSkinItemId = Object.keys(PORTAL_STORE_CATALOG).find(
    id => PORTAL_STORE_CATALOG[id]?.type === 'weapon_skin' && PORTAL_STORE_CATALOG[id]?.value === data.portal_equipped.weapon_skin
  );
  if (data.portal_equipped.weapon_skin !== 'default' && (!weaponSkinItemId || !data.portal_owned_items[weaponSkinItemId])) {
    data.portal_equipped.weapon_skin = 'default';
  }

  data.portal_achievements = data.portal_achievements || {};
  data.portal_weekly_claims = data.portal_weekly_claims || {};
  data.portal_daily_claims = data.portal_daily_claims || {};
  data.portal_weapon_levels = data.portal_weapon_levels || {};
  data.portal_weapon_levels.weapon_school_blaster = Math.max(1, Math.min(3, Number(data.portal_weapon_levels.weapon_school_blaster) || 1));
  for (const [id,item] of Object.entries(PORTAL_STORE_CATALOG)) {
    if (item?.type === 'weapon' && data.portal_owned_items[id]) {
      data.portal_weapon_levels[id] = Math.max(1, Math.min(3, Number(data.portal_weapon_levels[id]) || 1));
    }
  }
  if ((Number(data.portal_economy_version) || 0) < 4) data.portal_economy_version = 4;
  return data;
}

function creditPortalCoins(data, amount) {
  const safe = Math.max(0, Math.floor(Number(amount) || 0));
  if (!safe) return;
  // Якщо економіка запускається вперше саме під час нарахування бала,
  // стартовий баланс рахуємо зі score ДО цього нарахування, щоб не подвоїти монети.
  if (!data.portal_economy_version) {
    const previousScore = Math.max(0, Math.floor(Number(data.score) || 0) - safe);
    if (data.portal_coins === undefined) data.portal_coins = previousScore;
    if (data.portal_coins_earned === undefined) data.portal_coins_earned = previousScore;
    data.portal_economy_version = 1;
  }
  ensurePortalEconomy(data);
  data.portal_coins += safe;
  data.portal_coins_earned += safe;
}

function rewardOnce(data, bucket, key, bonus, meta = {}) {
  if (bucket[key]) return false;
  bucket[key] = { claimedAt: Date.now(), bonus, ...meta };
  data.portal_coins += bonus;
  data.portal_coins_earned += bonus;
  return true;
}

function applyPortalProgressRewards(data) {
  ensurePortalEconomy(data);
  const ach = data.portal_achievements;
  const score = Math.max(0, Number(data.score) || 0);
  const dino = Math.max(0, Number(data.dino_best) || 0);
  const ownedCount = Object.entries(data.portal_owned_items || {}).filter(([id,v]) => v && !['skin_student','trail_none','frame_none','weapon_school_blaster','weapon_skin_default'].includes(id)).length;

  if (score >= 1)   rewardOnce(data, ach, 'first_step', 10, { label:'Перший крок' });
  if (score >= 50)  rewardOnce(data, ach, 'scholar_50', 20, { label:'50 балів знань' });
  if (score >= 100) rewardOnce(data, ach, 'prime_100', 30, { label:'Сотня' });
  if (score >= 250) rewardOnce(data, ach, 'expert_250', 50, { label:'Експерт порталу' });
  if (dino >= 500)  rewardOnce(data, ach, 'runner_500', 20, { label:'Виживальник 500' });
  if (dino >= 1500) rewardOnce(data, ach, 'runner_1500', 40, { label:'Легенда дзвінка' });
  if (ownedCount >= 3) rewardOnce(data, ach, 'collector_3', 25, { label:'Колекціонер' });

  const week = getCurrentWeekKey();
  data.portal_weekly_claims[week] = data.portal_weekly_claims[week] || {};
  const wk = data.portal_weekly_claims[week];
  const weekScore = calculateWeekScore(data);
  const geoProgress = (Number(data.week_map_activity_points)||0) + (Number(data.week_flags_points)||0);
  const histProgress = (Number(data.week_history_activity_points)||0) + (Number(data.week_escape_points)||0);
  const dinoWeek = data.dino_week_key === week ? (Number(data.dino_week_best)||0) : 0;
  if (weekScore >= 20) rewardOnce(data, wk, 'score20', 20, { label:'20 балів за тиждень' });
  if (geoProgress >= 10) rewardOnce(data, wk, 'geo10', 15, { label:'10 географічних активностей' });
  if (histProgress >= 10) rewardOnce(data, wk, 'history10', 15, { label:'10 історичних активностей' });
  if (dinoWeek >= 600) rewardOnce(data, wk, 'dino600', 20, { label:'600 у «Вижити до дзвінка»' });
}

async function awardActivityPoint(kind, points = 1) {
  const safePoints = Math.max(0, Number(points) || 0);
  if (!safePoints) return false;
  const user = await requireUser();
  const pendingKind = `activity_${kind}`;
  if (!user) {
    const pending = readPending(pendingKind);
    pending.total = (Number(pending.total) || 0) + safePoints;
    writePending(pendingKind, pending);
    return false;
  }
  try {
    await runTransaction(ref(database, `users/${user.uid}`), data => {
      data = data || {};
      data.name = data.name || user.displayName || 'Учень';
      data.role = data.role || 'student';
      const totalKey = kind === 'map' ? 'map_activity_points' :
        kind === 'flags' ? 'flags_points' : 'history_activity_points';
      const weekKey = kind === 'map' ? 'week_map_activity_points' :
        kind === 'flags' ? 'week_flags_points' : 'week_history_activity_points';
      data[totalKey] = (Number(data[totalKey]) || 0) + safePoints;
      data[weekKey] = (Number(data[weekKey]) || 0) + safePoints;
      data.score = (Number(data.score) || 0) + safePoints;
      data.week_score = calculateWeekScore(data);
      data.lastScoreSource = kind;
      data.lastScorePoints = safePoints;
      data.lastScoreAt = Date.now();
      creditPortalCoins(data, safePoints);
      applyPortalProgressRewards(data);
      // Будь-який позитивний навчальний результат відкриває Динорейсер.
      data.dino_unlocked = true;
      data.dino_unlocked_at = Number(data.dino_unlocked_at) || Date.now();
      return data;
    });
    return true;
  } catch (error) {
    console.error(`Портал: помилка ${kind} score`, error);
    const pending = readPending(pendingKind);
    pending.total = (Number(pending.total) || 0) + safePoints;
    writePending(pendingKind, pending);
    return false;
  }
}

async function awardTruthOrLiePoint(points = 1) {
  const safePoints = Math.max(0, Number(points) || 0);
  if (!safePoints) return false;
  const user = await requireUser();
  if (!user) {
    const pending = readPending('truth_or_lie');
    pending.total = (Number(pending.total) || 0) + safePoints;
    writePending('truth_or_lie', pending);
    return false;
  }
  try {
    await runTransaction(ref(database, `users/${user.uid}`), data => {
      data = data || {};
      data.name = data.name || user.displayName || 'Учень';
      data.role = data.role || 'student';
      data.score = (Number(data.score) || 0) + safePoints;
      data.truth_or_lie_points = (Number(data.truth_or_lie_points) || 0) + safePoints;
      data.week_truth_or_lie_points = (Number(data.week_truth_or_lie_points) || 0) + safePoints;
      data.week_score = calculateWeekScore(data);
      data.lastScoreSource = 'truth_or_lie';
      data.lastScorePoints = safePoints;
      data.lastScoreAt = Date.now();
      creditPortalCoins(data, safePoints);
      applyPortalProgressRewards(data);
      // Будь-який позитивний навчальний результат відкриває Динорейсер.
      data.dino_unlocked = true;
      data.dino_unlocked_at = Number(data.dino_unlocked_at) || Date.now();
      return data;
    });
    return true;
  } catch (error) {
    console.error('Портал: помилка truth_or_lie score', error);
    const pending = readPending('truth_or_lie');
    pending.total = (Number(pending.total) || 0) + safePoints;
    writePending('truth_or_lie', pending);
    return false;
  }
}

async function awardSubjectQuiz(subject, themeId, score) {
  const points = Math.max(0, Number(score) || 0);
  if (!themeId || points <= 0) return false;
  const user = await requireUser();
  if (!user) {
    const pending = readPending(subject);
    pending.total = (Number(pending.total) || 0) + points;
    writePending(subject, pending);
    console.warn(`Портал: ${subject} — результат ${points} поставлено в чергу.`);
    return false;
  }

  try {
    await runTransaction(ref(database, `users/${user.uid}`), data => {
      data = data || {};
      data.name = data.name || user.displayName || 'Учень';
      data.role = data.role || 'student';

      // КОЖНЕ завершене проходження додає всі набрані бали.
      const totalKey = subject === 'history' ? 'total_history_points' : 'total_geography_points';
      const weekPointsKey = subject === 'history' ? 'week_history_points' : 'week_geography_points';
      data[totalKey] = (Number(data[totalKey]) || 0) + points;
      data[weekPointsKey] = (Number(data[weekPointsKey]) || 0) + points;
      data.score = (Number(data.score) || 0) + points;
      data.week_score = calculateWeekScore(data);
      data.lastScoreSource = subject;
      data.lastScorePoints = points;
      data.lastScoreAt = Date.now();
      creditPortalCoins(data, points);
      applyPortalProgressRewards(data);
      // Будь-який позитивний навчальний результат відкриває Динорейсер.
      data.dino_unlocked = true;
      data.dino_unlocked_at = Number(data.dino_unlocked_at) || Date.now();
      return data;
    });
    console.log(`Портал: ${subject} ${themeId} → +${points} балів.`);
    return true;
  } catch (error) {
    console.error(`Портал: помилка ${subject} score`, error);
    const pending = readPending(subject);
    pending.total = (Number(pending.total) || 0) + points;
    writePending(subject, pending);
    return false;
  }
}

async function awardNmt(subject, score, total) {
  const points = Math.max(0, Math.min(Number(total) || 30, Number(score) || 0));
  if (points <= 0) return false;
  const user = await requireUser();
  if (!user) {
    const pending = readPending(`nmt_${subject}`);
    pending.totalPoints = (Number(pending.totalPoints) || 0) + points;
    pending.total = Number(total) || 30;
    writePending(`nmt_${subject}`, pending);
    setSyncStatus(subject, '⏳ Результат буде синхронізовано після входу через Google.');
    return false;
  }

  try {
    await runTransaction(ref(database, `users/${user.uid}`), data => {
      data = data || {};
      data.name = data.name || user.displayName || 'Учень';
      data.role = data.role || 'student';
      const scoreKey = `nmt_${subject}_score`;
      const totalKey = `nmt_${subject}_total`;
      const weekKey = subject === 'history' ? 'week_nmt_history_score' : 'week_nmt_geography_score';

      // НМТ: кожне завершене проходження додає отриманий результат.
      data[scoreKey] = (Number(data[scoreKey]) || 0) + points;
      data[totalKey] = Number(total) || 30;
      data.nmt_total_score = (Number(data.nmt_history_score) || 0) + (Number(data.nmt_geography_score) || 0);
      data.score = (Number(data.score) || 0) + points;
      data[weekKey] = (Number(data[weekKey]) || 0) + points;
      data.week_score = calculateWeekScore(data);
      data.lastScoreSource = `nmt_${subject}`;
      data.lastScorePoints = points;
      data.lastScoreAt = Date.now();
      creditPortalCoins(data, points);
      applyPortalProgressRewards(data);
      // Будь-який позитивний навчальний результат відкриває Динорейсер.
      data.dino_unlocked = true;
      data.dino_unlocked_at = Number(data.dino_unlocked_at) || Date.now();
      return data;
    });
    writePending(`nmt_${subject}`, {});
    setSyncStatus(subject, '✅ Бал синхронізовано');
    console.log(`Портал: НМТ ${subject} → +${points} балів.`);
    return true;
  } catch (error) {
    console.error('Портал: помилка НМТ score', error);
    const pending = readPending(`nmt_${subject}`);
    pending.totalPoints = (Number(pending.totalPoints) || 0) + points;
    pending.total = Number(total) || 30;
    writePending(`nmt_${subject}`, pending);
    setSyncStatus(subject, '⚠️ Не вдалося синхронізувати. Спробуйте ще раз.');
    return false;
  }
}


async function awardEscapeStage(stageId, points = 2) {
  const safeStage = String(stageId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  const safePoints = Math.max(0, Math.min(2, Math.floor(Number(points) || 0)));
  if (!safeStage || !safePoints) {
    return { ok: false, awarded: false, reason: 'invalid' };
  }

  const user = await requireUser();
  if (!user) {
    return { ok: false, awarded: false, reason: 'login' };
  }

  const weekKey = getCurrentWeekKey();
  const awardKey = `${weekKey}_${safeStage}`;
  const escapeId = safeStage.includes('__') ? safeStage.split('__')[0] : '';
  const completionKey = escapeId ? `${weekKey}_${escapeId}` : '';
  let awarded = false;
  let alreadyCompleted = false;

  try {
    await runTransaction(ref(database, `users/${user.uid}`), data => {
      data = data || {};
      data.name = data.name || user.displayName || 'Учень';
      data.role = data.role || 'student';

      data.escape_stage_awards = data.escape_stage_awards || {};
      data.escape_weekly_completed = data.escape_weekly_completed || {};

      if (completionKey && data.escape_weekly_completed[completionKey]) {
        alreadyCompleted = true;
        awarded = false;
        return data;
      }

      if (data.escape_stage_awards[awardKey]) {
        awarded = false;
        return data;
      }

      data.escape_stage_awards[awardKey] = Date.now();
      data.escape_points = (Number(data.escape_points) || 0) + safePoints;
      data.week_escape_points = (Number(data.week_escape_points) || 0) + safePoints;
      data.score = (Number(data.score) || 0) + safePoints;
      data.week_score = calculateWeekScore(data);
      data.lastScoreSource = 'escape_from_past';
      data.lastScorePoints = safePoints;
      data.lastScoreAt = Date.now();
      creditPortalCoins(data, safePoints);
      applyPortalProgressRewards(data);

      data.dino_unlocked = true;
      data.dino_unlocked_at = Number(data.dino_unlocked_at) || Date.now();

      awarded = true;
      return data;
    });

    return {
      ok: true,
      awarded,
      points: awarded ? safePoints : 0,
      reason: alreadyCompleted ? 'completed' : (awarded ? 'awarded' : 'duplicate')
    };
  } catch (error) {
    console.error('Портал: помилка Втечі з минулого', error);
    return { ok: false, awarded: false, reason: 'firebase' };
  }
}

async function completeEscapeGame(escapeId) {
  const safeEscape = String(escapeId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
  if (!safeEscape) return { ok: false, completed: false, reason: 'invalid' };

  const user = await requireUser();
  if (!user) return { ok: false, completed: false, reason: 'login' };

  const weekKey = getCurrentWeekKey();
  const completionKey = `${weekKey}_${safeEscape}`;
  let newlyCompleted = false;

  try {
    await runTransaction(ref(database, `users/${user.uid}`), data => {
      data = data || {};
      data.name = data.name || user.displayName || 'Учень';
      data.role = data.role || 'student';
      data.escape_weekly_completed = data.escape_weekly_completed || {};

      if (data.escape_weekly_completed[completionKey]) {
        newlyCompleted = false;
        return data;
      }

      data.escape_weekly_completed[completionKey] = Date.now();
      data.last_escape_completed = safeEscape;
      data.last_escape_completed_at = Date.now();
      newlyCompleted = true;
      return data;
    });

    return { ok: true, completed: true, newlyCompleted, key: completionKey };
  } catch (error) {
    console.error('Портал: не вдалося зафіксувати завершення Втечі', error);
    return { ok: false, completed: false, reason: 'firebase' };
  }
}

async function unlockDinoForUser() {
  const user = await requireUser();
  if (!user) return false;
  try {
    await runTransaction(ref(database, `users/${user.uid}`), data => {
      data = data || {};
      data.name = data.name || user.displayName || 'Учень';
      data.role = data.role || 'student';
      data.dino_unlocked = true;
      data.dino_unlocked_at = Number(data.dino_unlocked_at) || Date.now();
      return data;
    });
    return true;
  } catch (error) {
    console.error('Портал: не вдалося зберегти розблокування Динорейсера', error);
    return false;
  }
}


async function saveDinoBest(score, artifacts = 0, durationMs = 0, runId = '') {
  const safeScore = Math.max(0, Math.floor(Number(score) || 0));
  const safeArtifacts = Math.max(0, Math.min(100, Math.floor(Number(artifacts) || 0)));
  const safeDuration = Math.max(0, Math.floor(Number(durationMs) || 0));
  const safeRunId = String(runId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
  if (!safeScore) return false;

  // Basic anti-cheat sanity check. Normal runs stay far below this ceiling.
  if (safeDuration > 0) {
    // Horde mode produces denser legitimate scoring than the old runner.
    const maxPlausibleScore = 9000 + Math.floor((safeDuration / 1000) * 720);
    if (safeScore > maxPlausibleScore || safeArtifacts > 100) {
      console.warn('Portal: Dino result rejected by sanity check', { safeScore, safeArtifacts, safeDuration });
      return false;
    }
  }

  const user = await requireUser();
  if (!user) return false;
  const weekKey = getCurrentWeekKey();

  try {
    await runTransaction(ref(database, `users/${user.uid}`), data => {
      data = data || {};
      data.name = data.name || user.displayName || 'Гравець';
      data.email = data.email || user.email || '';
      if (user.photoURL) {
        data.photoURL = data.photoURL || user.photoURL;
        data.googlePhotoURL = data.googlePhotoURL || user.photoURL;
      }
      data.role = data.role || 'student';
      data.dino_best = Math.max(Number(data.dino_best) || 0, safeScore);
      if (data.dino_week_key !== weekKey) {
        data.dino_week_key = weekKey;
        data.dino_week_best = 0;
      }
      data.dino_week_best = Math.max(Number(data.dino_week_best) || 0, safeScore);

      // Artifacts are credited once per run id.
      const duplicateRun = safeRunId && data.dino_last_run_id === safeRunId;
      if (!duplicateRun) {
        data.dino_artifacts_total = (Number(data.dino_artifacts_total) || 0) + safeArtifacts;
        data.dino_runs_total = (Number(data.dino_runs_total) || 0) + 1;
        if (safeRunId) data.dino_last_run_id = safeRunId;
      }
      data.dino_last_score = safeScore;
      data.dino_last_run_at = Date.now();
      ensurePortalEconomy(data);
      applyPortalProgressRewards(data);
      return data;
    });
    return true;
  } catch (error) {
    console.error('Портал: не вдалося зберегти рекорд «Вижити до дзвінка»', error);
    return false;
  }
}


async function refreshPortalEconomy() {
  const user = await requireUser();
  if (!user) return { ok:false, reason:'login' };
  try {
    const tx = await runTransaction(ref(database, `users/${user.uid}`), data => {
      data = data || {};
      data.name = data.name || user.displayName || 'Учень';
      data.role = data.role || 'student';
      ensurePortalEconomy(data);
      applyPortalProgressRewards(data);
      return data;
    });
    return { ok:true, profile:tx.snapshot.val() || {} };
  } catch (error) {
    console.error('Портал: economy refresh', error);
    return { ok:false, reason:'firebase' };
  }
}

async function purchasePortalItem(itemId) {
  const id = String(itemId || '');
  const item = PORTAL_STORE_CATALOG[id];
  if (!item) return { ok:false, reason:'invalid_item' };
  const user = await requireUser();
  if (!user) return { ok:false, reason:'login' };
  let result = { ok:false, reason:'unknown' };
  try {
    const tx = await runTransaction(ref(database, `users/${user.uid}`), data => {
      data = data || {};
      ensurePortalEconomy(data);
      if (data.portal_owned_items[id]) {
        result = { ok:true, owned:true, reason:'already_owned', balance:data.portal_coins };
        return data;
      }
      if (data.portal_coins < item.price) {
        result = { ok:false, reason:'not_enough', balance:data.portal_coins, price:item.price };
        return; // abort transaction: nothing changes
      }
      data.portal_coins -= item.price;
      data.portal_coins_spent = (Number(data.portal_coins_spent)||0) + item.price;
      data.portal_owned_items[id] = true;
      if (item.type === 'weapon') {
        data.portal_weapon_levels = data.portal_weapon_levels || {};
        data.portal_weapon_levels[id] = Math.max(1, Number(data.portal_weapon_levels[id]) || 1);
      }
      data.portal_last_purchase = { id, label:item.label, price:item.price, at:Date.now() };
      applyPortalProgressRewards(data);
      result = { ok:true, bought:true, balance:data.portal_coins, item };
      return data;
    });
    if (!tx.committed && result.reason === 'unknown') result = { ok:false, reason:'not_enough' };
    return result;
  } catch (error) {
    console.error('Портал: purchase item', error);
    return { ok:false, reason:'firebase' };
  }
}

async function equipPortalItem(slot, itemId) {
  const safeSlot = ['skin','weapon','weapon_skin','trail','frame'].includes(slot) ? slot : '';
  const id = String(itemId || '');
  const item = PORTAL_STORE_CATALOG[id];
  const freeMap = { skin:'skin_student', weapon:'weapon_school_blaster', weapon_skin:'weapon_skin_default', trail:'trail_none', frame:'frame_none' };
  if (!safeSlot) return { ok:false, reason:'invalid_slot' };
  const isFree = id === freeMap[safeSlot];
  if (!isFree && (!item || item.type !== safeSlot)) return { ok:false, reason:'invalid_item' };
  const user = await requireUser();
  if (!user) return { ok:false, reason:'login' };
  try {
    let equipped = false;
    const tx = await runTransaction(ref(database, `users/${user.uid}`), data => {
      data = data || {};
      ensurePortalEconomy(data);
      if (!data.portal_owned_items[id]) return;
      data.portal_equipped[safeSlot] = isFree ? ({skin:'student',weapon:'school_blaster',weapon_skin:'default',trail:'none',frame:'none'}[safeSlot]) : item.value;
      equipped = true;
      return data;
    });
    return { ok:tx.committed && equipped, equipped, slot:safeSlot, value:isFree ? ({skin:'student',weapon:'school_blaster',weapon_skin:'default',trail:'none',frame:'none'}[safeSlot]) : item?.value };
  } catch (error) {
    console.error('Портал: equip item', error);
    return { ok:false, reason:'firebase' };
  }
}


function portalLocalDateKey() {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function portalWeaponUpgradeCost(item, level) {
  const base = Math.max(100, Math.round(((Number(item?.price)||0) * .45) / 10) * 10);
  return level <= 1 ? base : base * 2;
}

async function upgradePortalWeapon(itemId) {
  const id = String(itemId || '');
  const item = PORTAL_STORE_CATALOG[id];
  if (!item || item.type !== 'weapon') return { ok:false, reason:'invalid_item' };
  const user = await requireUser();
  if (!user) return { ok:false, reason:'login' };
  let result = { ok:false, reason:'unknown' };
  try {
    const tx = await runTransaction(ref(database, `users/${user.uid}`), data => {
      data = data || {};
      ensurePortalEconomy(data);
      if (!data.portal_owned_items[id]) { result={ok:false,reason:'not_owned'}; return; }
      const level = Math.max(1, Math.min(3, Number(data.portal_weapon_levels?.[id]) || 1));
      if (level >= 3) { result={ok:true,maxed:true,level:3,balance:data.portal_coins}; return data; }
      const price = portalWeaponUpgradeCost(item, level);
      if (data.portal_coins < price) { result={ok:false,reason:'not_enough',price,balance:data.portal_coins}; return; }
      data.portal_coins -= price;
      data.portal_coins_spent = (Number(data.portal_coins_spent)||0) + price;
      data.portal_weapon_levels[id] = level + 1;
      data.portal_last_weapon_upgrade = { id, level:level+1, price, at:Date.now() };
      result={ok:true,upgraded:true,level:level+1,price,balance:data.portal_coins};
      return data;
    });
    if (!tx.committed && result.reason === 'unknown') return {ok:false,reason:'not_enough'};
    if (tx.snapshot?.exists()) result.profile = tx.snapshot.val();
    return result;
  } catch (error) {
    console.error('Портал: weapon upgrade', error);
    return {ok:false,reason:'firebase'};
  }
}

const BELL_DAILY_REWARDS = Object.freeze({
  kills45:25,
  wave8:25,
  combo18:20,
  score5000:30,
  boss1:30
});

async function claimBellDailyMission(missionId, dateKey='') {
  const id=String(missionId||'');
  const reward=Number(BELL_DAILY_REWARDS[id])||0;
  if (!reward) return {ok:false,reason:'invalid_mission'};
  const today=portalLocalDateKey();
  if (dateKey && String(dateKey)!==today) return {ok:false,reason:'wrong_day'};
  const user=await requireUser();
  if(!user)return {ok:false,reason:'login'};
  let result={ok:false,reason:'unknown'};
  try{
    const tx=await runTransaction(ref(database,`users/${user.uid}`),data=>{
      data=data||{};ensurePortalEconomy(data);
      data.portal_daily_claims=data.portal_daily_claims||{};
      if(data.portal_daily_claims[today]){
        result={ok:true,already:true,reward:Number(data.portal_daily_claims[today].reward)||0,balance:data.portal_coins};
        return data;
      }
      data.portal_daily_claims[today]={id,reward,claimedAt:Date.now()};
      data.portal_coins += reward;
      data.portal_coins_earned += reward;
      result={ok:true,claimed:true,reward,balance:data.portal_coins};
      return data;
    });
    if(tx.snapshot?.exists())result.profile=tx.snapshot.val();
    return result;
  }catch(error){
    console.error('Портал: daily mission reward',error);
    return {ok:false,reason:'firebase'};
  }
}

async function lockTruthOrLie(reason = 'suspicious_activity', until = Date.now() + 3600000) {
  const user = await requireUser();
  if (!user) return false;
  try {
    await runTransaction(ref(database, `users/${user.uid}`), data => {
      data = data || {};
      data.truth_or_lie_locked_until = Math.max(Number(data.truth_or_lie_locked_until) || 0, Number(until) || (Date.now()+3600000));
      data.truth_or_lie_lock_reason = String(reason || 'suspicious_activity');
      data.lastAntiCheatAt = Date.now();
      return data;
    });
    return true;
  } catch (error) {
    console.error('Портал: не вдалося зберегти блокування гри', error);
    return false;
  }
}

window.portalScore = {
  getCurrentUser: () => currentUser,
  awardHistoryQuizScore: (themeId, score) => awardSubjectQuiz('history', themeId, score),
  awardGeographyQuizScore: (themeId, score) => awardSubjectQuiz('geography', themeId, score),
  awardNmtScore: awardNmt,
  awardMapPoint: points => awardActivityPoint('map', points),
  awardHistoryActivityPoint: points => awardActivityPoint('history_activity', points),
  awardFlagsPoint: points => awardActivityPoint('flags', points),
  awardEscapeStage: awardEscapeStage,
  completeEscapeGame: completeEscapeGame,
  awardTruthOrLiePoint: awardTruthOrLiePoint,
  lockTruthOrLie: lockTruthOrLie,
  unlockDinoForUser: unlockDinoForUser,
  saveDinoBest: saveDinoBest,
  refreshPortalEconomy: refreshPortalEconomy,
  purchasePortalItem: purchasePortalItem,
  equipPortalItem: equipPortalItem,
  upgradePortalWeapon: upgradePortalWeapon,
  claimBellDailyMission: claimBellDailyMission,
  storeCatalog: PORTAL_STORE_CATALOG,
  calculateWeekScore
};
window.awardHistoryQuizScore = window.portalScore.awardHistoryQuizScore;
window.awardGeographyQuizScore = window.portalScore.awardGeographyQuizScore;
window.awardNmtPoint = awardNmt;

onAuthStateChanged(auth, async user => {
  currentUser = user;
  authReadyResolve(user);
  if (!user) return;

  // Надсилаємо тільки результати, які реально були отримані до готовності Auth.
  for (const subject of ['history','geography']) {
    const pending = readPending(subject);
    const points = Number(pending.total) || 0;
    if (points <= 0) continue;
    writePending(subject, {});
    await awardSubjectQuiz(subject, 'pending', points);
  }
  for (const subject of ['history','geography']) {
    const key = `nmt_${subject}`;
    const pending = readPending(key);
    const points = Number(pending.totalPoints) || 0;
    if (points > 0) {
      writePending(key, {});
      await awardNmt(subject, points, pending.total || 30);
    }
  }
  for (const kind of ['map', 'history_activity', 'flags', 'truth_or_lie']) {
    const key = `activity_${kind}`;
    const pending = readPending(key);
    const points = Number(pending.total) || 0;
    if (points > 0) {
      writePending(key, {});
      if (kind === 'truth_or_lie') await awardTruthOrLiePoint(points);
      else await awardActivityPoint(kind, points);
    }
  }
});
