/* Portal score synchronization — single Firebase scoring layer */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, runTransaction, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
// Firebase Auth у браузері за замовчуванням використовує локальну persistence.
// Не блокуємо завантаження порталу через await setPersistence(): у деяких
// мобільних/приватних браузерах це могло затримати запуск Auth і рейтингу.
const database = getDatabase(app);
let currentUser = null;
let authReadyResolve;
const authReady = new Promise(resolve => { authReadyResolve = resolve; });

// Окремий канал стану поточного користувача. Він не залежить від загальної
// таблиці users, тому бали й монети оновлюються одразу навіть якщо рейтинг
// тимчасово не може прочитати весь список учнів.
let profileRealtimeUnsubscribe = null;
let latestProfile = {};

function emitProfile(profile = {}, reason = 'sync') {
  latestProfile = profile || {};
  window.__portalCurrentProfile = latestProfile;
  try {
    window.dispatchEvent(new CustomEvent('portal-profile-updated', {
      detail: { profile: latestProfile, reason }
    }));
  } catch (_) {}
}

function stopProfileRealtime() {
  if (profileRealtimeUnsubscribe) {
    try { profileRealtimeUnsubscribe(); } catch (_) {}
    profileRealtimeUnsubscribe = null;
  }
}

function startProfileRealtime(user) {
  stopProfileRealtime();
  if (!user) {
    emitProfile({}, 'signed-out');
    return;
  }
  profileRealtimeUnsubscribe = onValue(
    ref(database, `users/${user.uid}`),
    snapshot => emitProfile(snapshot.val() || {}, 'realtime'),
    error => console.warn('Портал: realtime профілю недоступний', error)
  );
}

async function runUserTransaction(user, mutator, reason = 'transaction') {
  const tx = await runTransaction(ref(database, `users/${user.uid}`), mutator);
  if (tx && tx.committed && tx.snapshot) emitProfile(tx.snapshot.val() || {}, reason);
  return tx;
}

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
    (Number(data.week_escape_points) || 0) +
    (Number(data.week_duel_points) || 0);
}


// ===== PORTAL ECONOMY / CHARACTER COINS =====
function ensurePortalEconomy(data = {}) {
  const oldScore = Math.max(0, Math.floor(Number(data.score) || 0));
  if (!data.portal_economy_version) {
    if (data.portal_coins === undefined) data.portal_coins = oldScore;
    if (data.portal_coins_earned === undefined) data.portal_coins_earned = oldScore;
  }
  data.portal_coins = Math.max(0, Math.floor(Number(data.portal_coins) || 0));
  data.portal_coins_earned = Math.max(data.portal_coins, Math.floor(Number(data.portal_coins_earned) || 0));
  data.portal_coins_spent = Math.max(0, Math.floor(Number(data.portal_coins_spent) || 0));
  data.portal_character_owned = data.portal_character_owned || {};
  data.portal_achievements = data.portal_achievements || {};
  data.portal_weekly_claims = data.portal_weekly_claims || {};
  data.portal_economy_version = 5;
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
  // Якщо попередня версія зберігала бали без монет, відновлюємо пропущені
  // монети до стану ПЕРЕД поточним нарахуванням, а потім додаємо нові.
  const previousScore = Math.max(0, Math.floor(Number(data.score) || 0) - safe);
  if (data.portal_coins_earned < previousScore) {
    const missed = previousScore - data.portal_coins_earned;
    data.portal_coins += missed;
    data.portal_coins_earned += missed;
  }
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
  if (score >= 1) rewardOnce(data, ach, 'first_step', 10, { label:'Перший крок' });
  if (score >= 50) rewardOnce(data, ach, 'scholar_50', 20, { label:'50 балів знань' });
  if (score >= 100) rewardOnce(data, ach, 'prime_100', 30, { label:'Сотня' });
  if (score >= 250) rewardOnce(data, ach, 'expert_250', 50, { label:'Експерт порталу' });
  const week = getCurrentWeekKey();
  data.portal_weekly_claims[week] = data.portal_weekly_claims[week] || {};
  const wk = data.portal_weekly_claims[week];
  const weekScore = calculateWeekScore(data);
  const geoProgress = (Number(data.week_map_activity_points)||0) + (Number(data.week_flags_points)||0);
  const histProgress = (Number(data.week_history_activity_points)||0) + (Number(data.week_escape_points)||0);
  if (weekScore >= 20) rewardOnce(data, wk, 'score20', 20, { label:'20 балів за тиждень' });
  if (geoProgress >= 10) rewardOnce(data, wk, 'geo10', 15, { label:'10 географічних активностей' });
  if (histProgress >= 10) rewardOnce(data, wk, 'history10', 15, { label:'10 історичних активностей' });
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
    await runUserTransaction(user, data => {
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
    await runUserTransaction(user, data => {
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
    await runUserTransaction(user, data => {
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
    await runUserTransaction(user, data => {
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
    await runUserTransaction(user, data => {
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

async function completeEscapeGame(escapeId, questionIds = []) {
  const safeEscape = String(escapeId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
  if (!safeEscape) return { ok: false, completed: false, reason: 'invalid' };

  const user = await requireUser();
  if (!user) return { ok: false, completed: false, reason: 'login' };

  const weekKey = getCurrentWeekKey();
  const completionKey = `${weekKey}_${safeEscape}`;
  let newlyCompleted = false;

  try {
    await runUserTransaction(user, data => {
      data = data || {};
      data.name = data.name || user.displayName || 'Учень';
      data.role = data.role || 'student';
      data.escape_weekly_completed = data.escape_weekly_completed || {};
      data.escape_question_history = data.escape_question_history || {};

      if (data.escape_weekly_completed[completionKey]) {
        newlyCompleted = false;
        return data;
      }

      data.escape_weekly_completed[completionKey] = Date.now();
      const safeQuestionIds = Array.isArray(questionIds)
        ? questionIds.map(id => String(id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)).filter(Boolean).slice(0, 5)
        : [];
      data.escape_question_history[completionKey] = {
        questions: safeQuestionIds,
        completedAt: Date.now()
      };
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

async function failEscapeGame(escapeId, questionIds = [], earnedScore = 0) {
  const safeEscape = String(escapeId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
  if (!safeEscape) return { ok: false, failed: false, reason: 'invalid' };
  const user = await requireUser();
  if (!user) return { ok: false, failed: false, reason: 'login' };
  const weekKey = getCurrentWeekKey();
  const completionKey = `${weekKey}_${safeEscape}`;
  let newlyFailed = false;
  try {
    await runUserTransaction(user, data => {
      data = data || {};
      data.name = data.name || user.displayName || 'Учень';
      data.role = data.role || 'student';
      data.escape_weekly_completed = data.escape_weekly_completed || {};
      data.escape_question_history = data.escape_question_history || {};
      if (data.escape_weekly_completed[completionKey]) return data;
      const at = Date.now();
      const safeQuestionIds = Array.isArray(questionIds)
        ? questionIds.map(id => String(id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)).filter(Boolean).slice(0, 5)
        : [];
      data.escape_weekly_completed[completionKey] = { status: 'failed', at };
      data.escape_question_history[completionKey] = {
        questions: safeQuestionIds,
        status: 'failed',
        score: Math.max(0, Math.min(10, Math.floor(Number(earnedScore) || 0))),
        failedAt: at
      };
      data.last_escape_failed = safeEscape;
      data.last_escape_failed_at = at;
      newlyFailed = true;
      return data;
    });
    return { ok: true, failed: true, newlyFailed, key: completionKey };
  } catch (error) {
    console.error('Портал: не вдалося зафіксувати поразку у Втечі', error);
    return { ok: false, failed: false, reason: 'firebase' };
  }
}

async function lockTruthOrLie(reason = 'suspicious_activity', until = Date.now() + 3600000) {
  const user = await requireUser();
  if (!user) return false;
  try {
    await runUserTransaction(user, data => {
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
  getCurrentProfile: () => latestProfile,
  awardHistoryQuizScore: (themeId, score) => awardSubjectQuiz('history', themeId, score),
  awardGeographyQuizScore: (themeId, score) => awardSubjectQuiz('geography', themeId, score),
  awardNmtScore: awardNmt,
  awardMapPoint: points => awardActivityPoint('map', points),
  awardHistoryActivityPoint: points => awardActivityPoint('history_activity', points),
  awardFlagsPoint: points => awardActivityPoint('flags', points),
  awardEscapeStage: awardEscapeStage,
  completeEscapeGame: completeEscapeGame,
  failEscapeGame: failEscapeGame,
  awardTruthOrLiePoint: awardTruthOrLiePoint,
  lockTruthOrLie: lockTruthOrLie,
  calculateWeekScore
};
window.awardHistoryQuizScore = window.portalScore.awardHistoryQuizScore;
window.awardGeographyQuizScore = window.portalScore.awardGeographyQuizScore;
window.awardNmtPoint = awardNmt;

onAuthStateChanged(auth, async user => {
  currentUser = user;
  authReadyResolve(user);
  startProfileRealtime(user);
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
  for (const kind of ['map', 'history_activity', 'flags']) {
    const key = `activity_${kind}`;
    const pending = readPending(key);
    const points = Number(pending.total) || 0;
    if (points > 0) {
      writePending(key, {});
      await awardActivityPoint(kind, points);
    }
  }
  const truthPending = readPending('truth_or_lie');
  const truthPoints = Number(truthPending.total) || 0;
  if (truthPoints > 0) {
    writePending('truth_or_lie', {});
    await awardTruthOrLiePoint(truthPoints);
  }
});
