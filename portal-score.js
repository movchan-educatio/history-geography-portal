/* Portal score synchronization — single Firebase scoring layer */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
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

const app = initializeApp(firebaseConfig);
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
      data.week_score =
        (Number(data.week_history_points) || 0) +
        (Number(data.week_geography_points) || 0) +
        (Number(data.week_nmt_history_score) || 0) +
        (Number(data.week_nmt_geography_score) || 0) +
        (Number(data.week_truth_or_lie_points) || 0);
      data.lastScoreSource = subject;
      data.lastScorePoints = points;
      data.lastScoreAt = Date.now();
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
      data.week_score =
        (Number(data.week_history_points) || 0) +
        (Number(data.week_geography_points) || 0) +
        (Number(data.week_nmt_history_score) || 0) +
        (Number(data.week_nmt_geography_score) || 0) +
        (Number(data.week_truth_or_lie_points) || 0);
      data.lastScoreSource = `nmt_${subject}`;
      data.lastScorePoints = points;
      data.lastScoreAt = Date.now();
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

window.portalScore = {
  getCurrentUser: () => currentUser,
  awardHistoryQuizScore: (themeId, score) => awardSubjectQuiz('history', themeId, score),
  awardGeographyQuizScore: (themeId, score) => awardSubjectQuiz('geography', themeId, score),
  awardNmtScore: awardNmt
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
});
