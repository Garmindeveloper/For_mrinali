// -----------------------------------------------------------------------------
// auth.js - Google sign-in + stats (Firebase Auth + Firestore)
//
// Stats are recorded for every finished game (the game dispatches a
// "wu:gameover" event). When signed in, stats live in Firestore at
// users/{uid} and sync across devices. When signed out or when Firebase is
// not configured yet, stats fall back to this browser's localStorage.
// -----------------------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const GUEST_STATS_KEY = "wu-stats-guest";

// ---------- DOM ----------
const authBtn = document.getElementById("auth-btn");
const userAvatar = document.getElementById("user-avatar");
const statsBtn = document.getElementById("stats-btn");
const overlay = document.getElementById("stats-overlay");
const closeBtn = document.getElementById("stats-close");
const signInBtn = document.getElementById("stats-signin");
const signOutBtn = document.getElementById("stats-signout");
const accountEl = document.getElementById("stats-account");
const syncNote = document.getElementById("stats-sync-note");

const elPlayed = document.getElementById("stat-played");
const elWinPct = document.getElementById("stat-winpct");
const elStreak = document.getElementById("stat-streak");
const elMaxStreak = document.getElementById("stat-maxstreak");
const distEl = document.getElementById("guess-distribution");

// ---------- State ----------
let auth = null;
let db = null;
let provider = null;
let currentUser = null;
let stats = defaultStats();

const config = window.FIREBASE_CONFIG || {};
const firebaseConfigured =
  !!config.apiKey && config.apiKey.indexOf("REPLACE_WITH") !== 0;

// ---------- Stats helpers ----------
function defaultStats() {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    // index 0..5 -> wins in 1..6 guesses
    distribution: [0, 0, 0, 0, 0, 0],
  };
}

function normalizeStats(raw) {
  const s = defaultStats();
  if (raw && typeof raw === "object") {
    s.gamesPlayed = raw.gamesPlayed | 0;
    s.gamesWon = raw.gamesWon | 0;
    s.currentStreak = raw.currentStreak | 0;
    s.maxStreak = raw.maxStreak | 0;
    if (Array.isArray(raw.distribution) && raw.distribution.length === 6) {
      s.distribution = raw.distribution.map(function (n) {
        return n | 0;
      });
    }
  }
  return s;
}

function applyResult(s, won, guesses) {
  s.gamesPlayed += 1;
  if (won) {
    s.gamesWon += 1;
    s.currentStreak += 1;
    if (s.currentStreak > s.maxStreak) s.maxStreak = s.currentStreak;
    if (guesses >= 1 && guesses <= 6) s.distribution[guesses - 1] += 1;
  } else {
    s.currentStreak = 0;
  }
  return s;
}

// ---------- Persistence ----------
function loadGuestStats() {
  try {
    return normalizeStats(JSON.parse(localStorage.getItem(GUEST_STATS_KEY)));
  } catch (e) {
    return defaultStats();
  }
}

function saveGuestStats(s) {
  try {
    localStorage.setItem(GUEST_STATS_KEY, JSON.stringify(s));
  } catch (e) {}
}

async function loadUserStats(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? normalizeStats(snap.data().stats) : defaultStats();
}

async function saveUserStats(uid, s) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { stats: s, updatedAt: Date.now() }, { merge: true });
}

async function persistStats() {
  if (currentUser && db) {
    try {
      await saveUserStats(currentUser.uid, stats);
      return;
    } catch (e) {
      // Fall through to local cache if the write fails (e.g. offline).
      console.warn("Could not save stats to Firestore:", e);
    }
  }
  saveGuestStats(stats);
}

// ---------- Recording game results ----------
window.addEventListener("wu:gameover", function (e) {
  const detail = e.detail || {};
  applyResult(stats, !!detail.won, detail.guesses | 0);
  persistStats();
  renderStats();
});

// ---------- Rendering ----------
function renderStats() {
  const winPct =
    stats.gamesPlayed > 0
      ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
      : 0;
  elPlayed.textContent = stats.gamesPlayed;
  elWinPct.textContent = winPct;
  elStreak.textContent = stats.currentStreak;
  elMaxStreak.textContent = stats.maxStreak;

  const max = Math.max.apply(null, stats.distribution.concat([1]));
  distEl.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const count = stats.distribution[i];
    const row = document.createElement("div");
    row.className = "dist-row";

    const label = document.createElement("div");
    label.className = "dist-label";
    label.textContent = String(i + 1);

    const barWrap = document.createElement("div");
    barWrap.className = "dist-bar-wrap";

    const bar = document.createElement("div");
    bar.className = "dist-bar";
    const pct = Math.max((count / max) * 100, count > 0 ? 8 : 0);
    bar.style.width = pct + "%";
    bar.textContent = String(count);
    if (count === 0) bar.classList.add("empty");

    barWrap.appendChild(bar);
    row.appendChild(label);
    row.appendChild(barWrap);
    distEl.appendChild(row);
  }
}

function renderAccount() {
  if (currentUser) {
    accountEl.textContent = "Signed in as " + (currentUser.displayName || currentUser.email || "you");
    signInBtn.hidden = true;
    signOutBtn.hidden = false;
    syncNote.textContent = "Your stats sync to your Google account.";
  } else {
    accountEl.textContent = "Playing as guest";
    signInBtn.hidden = !firebaseConfigured;
    signOutBtn.hidden = true;
    syncNote.textContent = firebaseConfigured
      ? "Sign in to save your stats and sync across devices."
      : "Cloud sync not set up yet \u2014 see README.md to enable Google login.";
  }
}

function updateHeaderAuth() {
  if (currentUser && currentUser.photoURL) {
    userAvatar.src = currentUser.photoURL;
    userAvatar.hidden = false;
    authBtn.hidden = true;
  } else {
    userAvatar.hidden = true;
    authBtn.hidden = false;
    authBtn.innerHTML = currentUser ? "\uD83D\uDC64" : "\uD83D\uDC64";
  }
}

// ---------- Modal ----------
function openStats() {
  renderStats();
  renderAccount();
  overlay.hidden = false;
}

function closeStats() {
  overlay.hidden = true;
}

statsBtn.addEventListener("click", openStats);
closeBtn.addEventListener("click", closeStats);
overlay.addEventListener("click", function (e) {
  if (e.target === overlay) closeStats();
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !overlay.hidden) closeStats();
});

// ---------- Auth ----------
async function doSignIn() {
  if (!firebaseConfigured || !auth) {
    openStats();
    return;
  }
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.warn("Sign-in failed:", e);
  }
}

async function doSignOut() {
  if (auth) {
    try {
      await signOut(auth);
    } catch (e) {}
  }
}

authBtn.addEventListener("click", doSignIn);
signInBtn.addEventListener("click", doSignIn);
signOutBtn.addEventListener("click", doSignOut);

// ---------- Init ----------
function initGuest() {
  stats = loadGuestStats();
  updateHeaderAuth();
  renderStats();
}

if (firebaseConfigured) {
  try {
    const app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    provider = new GoogleAuthProvider();

    onAuthStateChanged(auth, async function (user) {
      currentUser = user;
      if (user) {
        try {
          const cloud = await loadUserStats(user.uid);
          // If the cloud doc is empty but this device has guest progress,
          // seed the account with it on first sign-in.
          const guest = loadGuestStats();
          stats = cloud.gamesPlayed === 0 && guest.gamesPlayed > 0 ? guest : cloud;
          if (stats === guest) await saveUserStats(user.uid, stats);
        } catch (e) {
          console.warn("Could not load cloud stats:", e);
          stats = loadGuestStats();
        }
      } else {
        stats = loadGuestStats();
      }
      updateHeaderAuth();
      renderAccount();
      renderStats();
    });
  } catch (e) {
    console.warn("Firebase init failed; running in guest mode:", e);
    initGuest();
  }
} else {
  initGuest();
}
