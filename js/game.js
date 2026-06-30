(function () {
  "use strict";

  const WORD_LENGTH = 5;
  const MAX_ROWS = 6;
  const KEY_LAYOUT = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["enter", "z", "x", "c", "v", "b", "n", "m", "back"],
  ];
  // Coloring priority so a key is never downgraded (e.g. green stays green).
  const STATE_RANK = { absent: 1, present: 2, correct: 3 };

  const boardEl = document.getElementById("board");
  const keyboardEl = document.getElementById("keyboard");
  const toastContainer = document.getElementById("toast-container");
  const puzzleInput = document.getElementById("puzzle-input");
  const puzzleGo = document.getElementById("puzzle-go");
  const puzzleRange = document.getElementById("puzzle-range");
  const newGameBtn = document.getElementById("new-game");
  const themeToggle = document.getElementById("theme-toggle");
  const hardModeCheckbox = document.getElementById("hardmode-checkbox");
  const hardModeHint = document.getElementById("hardmode-hint");

  // Puzzle pool: original answers occupy the low indices (1..ANSWERS.length);
  // every remaining valid guess is appended at higher indices and only becomes
  // selectable in hard mode. POOL is the global, stable puzzle-number index.
  const ANSWERS_COUNT = ANSWERS.length;
  const answerSet = new Set(ANSWERS);
  const EXTRA_WORDS = Array.from(VALID_WORDS).filter(function (w) {
    return !answerSet.has(w);
  }).sort();
  const POOL = ANSWERS.concat(EXTRA_WORDS);
  const TOTAL = POOL.length;

  const state = {
    secret: "",
    puzzleNumber: 1,
    currentRow: 0,
    currentGuess: "",
    gameOver: false,
    keyStates: {},
    hardMode: false,
  };

  /* ---------- Board / keyboard construction ---------- */

  function buildBoard() {
    boardEl.innerHTML = "";
    for (let r = 0; r < MAX_ROWS; r++) {
      const row = document.createElement("div");
      row.className = "tile-row";
      row.dataset.row = String(r);
      for (let c = 0; c < WORD_LENGTH; c++) {
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.dataset.row = String(r);
        tile.dataset.col = String(c);
        row.appendChild(tile);
      }
      boardEl.appendChild(row);
    }
  }

  function buildKeyboard() {
    keyboardEl.innerHTML = "";
    KEY_LAYOUT.forEach(function (rowKeys, idx) {
      const row = document.createElement("div");
      row.className = "keyboard-row";
      if (idx === 1) {
        const spacer = document.createElement("div");
        spacer.className = "spacer";
        row.appendChild(spacer);
      }
      rowKeys.forEach(function (key) {
        const btn = document.createElement("button");
        btn.className = "key";
        btn.dataset.key = key;
        if (key === "enter") {
          btn.classList.add("wide");
          btn.textContent = "Enter";
        } else if (key === "back") {
          btn.classList.add("wide");
          btn.innerHTML = "&#x232b;";
        } else {
          btn.textContent = key;
        }
        row.appendChild(btn);
      });
      if (idx === 1) {
        const spacer = document.createElement("div");
        spacer.className = "spacer";
        row.appendChild(spacer);
      }
      keyboardEl.appendChild(row);
    });
  }

  function getTile(row, col) {
    return boardEl.querySelector('.tile[data-row="' + row + '"][data-col="' + col + '"]');
  }

  function getRowEl(row) {
    return boardEl.querySelector('.tile-row[data-row="' + row + '"]');
  }

  /* ---------- Toast ---------- */

  function showToast(message, duration) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toastContainer.appendChild(toast);
    const ttl = duration || 1500;
    setTimeout(function () {
      toast.classList.add("fade-out");
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, ttl);
  }

  /* ---------- Game flow ---------- */

  // Highest puzzle number the user can pick/enter given the current mode.
  function maxPuzzle() {
    return state.hardMode ? TOTAL : ANSWERS_COUNT;
  }

  function startGame(puzzleNumber) {
    let n = puzzleNumber;
    if (!Number.isInteger(n) || n < 1 || n > TOTAL) {
      n = randomPuzzleNumber();
    }
    state.secret = POOL[n - 1];
    state.puzzleNumber = n;
    state.currentRow = 0;
    state.currentGuess = "";
    state.gameOver = false;
    state.keyStates = {};

    buildBoard();
    refreshKeyboardColors();
    puzzleInput.value = String(n);
    updatePuzzleRange();
  }

  function randomPuzzleNumber() {
    if (state.hardMode) {
      // Draw from the obscure pool (higher indices) for a harder game.
      return ANSWERS_COUNT + Math.floor(Math.random() * EXTRA_WORDS.length) + 1;
    }
    return Math.floor(Math.random() * ANSWERS_COUNT) + 1;
  }

  function startRandom() {
    startGame(randomPuzzleNumber());
  }

  function updatePuzzleRange() {
    puzzleInput.max = String(maxPuzzle());
    puzzleRange.textContent = "of " + maxPuzzle().toLocaleString();
  }

  /* ---------- Input handling ---------- */

  function handleKey(key) {
    if (state.gameOver) return;
    if (key === "enter") {
      submitGuess();
    } else if (key === "back") {
      deleteLetter();
    } else if (/^[a-z]$/.test(key)) {
      addLetter(key);
    }
  }

  function addLetter(letter) {
    if (state.currentGuess.length >= WORD_LENGTH) return;
    const col = state.currentGuess.length;
    state.currentGuess += letter;
    const tile = getTile(state.currentRow, col);
    tile.textContent = letter;
    tile.dataset.state = "filled";
  }

  function deleteLetter() {
    if (state.currentGuess.length === 0) return;
    state.currentGuess = state.currentGuess.slice(0, -1);
    const col = state.currentGuess.length;
    const tile = getTile(state.currentRow, col);
    tile.textContent = "";
    delete tile.dataset.state;
  }

  function submitGuess() {
    const guess = state.currentGuess;
    if (guess.length < WORD_LENGTH) {
      shakeRow();
      showToast("Not enough letters");
      return;
    }
    if (!VALID_WORDS.has(guess)) {
      shakeRow();
      showToast("Not in word list");
      return;
    }

    const result = evaluateGuess(guess, state.secret);
    revealRow(guess, result);
  }

  function shakeRow() {
    const row = getRowEl(state.currentRow);
    row.classList.add("shake");
    setTimeout(function () {
      row.classList.remove("shake");
    }, 500);
  }

  /* ---------- Evaluation: two-pass duplicate-aware ---------- */

  function evaluateGuess(guess, secret) {
    const result = new Array(WORD_LENGTH).fill("absent");
    const counts = {};
    for (let i = 0; i < WORD_LENGTH; i++) {
      counts[secret[i]] = (counts[secret[i]] || 0) + 1;
    }
    // Pass 1: exact matches.
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (guess[i] === secret[i]) {
        result[i] = "correct";
        counts[guess[i]]--;
      }
    }
    // Pass 2: present letters with remaining unconsumed instances.
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (result[i] === "correct") continue;
      const ch = guess[i];
      if (counts[ch] > 0) {
        result[i] = "present";
        counts[ch]--;
      }
    }
    return result;
  }

  function revealRow(guess, result) {
    const row = state.currentRow;
    let revealed = 0;
    for (let i = 0; i < WORD_LENGTH; i++) {
      (function (col) {
        const tile = getTile(row, col);
        setTimeout(function () {
          tile.classList.add("flip");
          setTimeout(function () {
            tile.dataset.state = result[col];
            tile.textContent = guess[col];
          }, 250);
          tile.addEventListener("animationend", function handler() {
            tile.classList.remove("flip");
            tile.removeEventListener("animationend", handler);
            updateKeyState(guess[col], result[col]);
            refreshKeyboardColors();
            revealed++;
            if (revealed === WORD_LENGTH) {
              finishRow(guess);
            }
          });
        }, col * 300);
      })(i);
    }
  }

  function finishRow(guess) {
    if (guess === state.secret) {
      state.gameOver = true;
      const row = getRowEl(state.currentRow);
      row.classList.add("win");
      const messages = ["Genius", "Magnificent", "Impressive", "Splendid", "Great", "Phew"];
      showToast(messages[state.currentRow] || "Well done!", 2000);
      launchConfetti();
      reportResult(true, state.currentRow + 1);
      return;
    }
    state.currentRow++;
    state.currentGuess = "";
    if (state.currentRow >= MAX_ROWS) {
      state.gameOver = true;
      showToast(state.secret.toUpperCase(), 4000);
      reportResult(false, 0);
    }
  }

  // Notify the stats layer (auth.js) that a game finished. Decoupled via an
  // event so the game works fine even if auth.js / Firebase aren't loaded.
  function reportResult(won, guesses) {
    window.dispatchEvent(
      new CustomEvent("wu:gameover", {
        detail: {
          won: won,
          guesses: guesses,
          puzzleNumber: state.puzzleNumber,
          hardMode: state.hardMode,
        },
      })
    );
  }

  /* ---------- Keyboard coloring ---------- */

  function updateKeyState(letter, newState) {
    const existing = state.keyStates[letter];
    if (!existing || STATE_RANK[newState] > STATE_RANK[existing]) {
      state.keyStates[letter] = newState;
    }
  }

  function refreshKeyboardColors() {
    const keys = keyboardEl.querySelectorAll(".key");
    keys.forEach(function (btn) {
      const k = btn.dataset.key;
      if (k === "enter" || k === "back") return;
      const st = state.keyStates[k];
      if (st) {
        btn.dataset.state = st;
      } else {
        delete btn.dataset.state;
      }
    });
  }

  /* ---------- Theme ---------- */

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || "light";
  }

  function updateThemeIcon() {
    themeToggle.innerHTML = currentTheme() === "dark" ? "\u2600" : "\uD83C\uDF19";
  }

  function toggleTheme() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("wu-theme", next);
    } catch (e) {}
    updateThemeIcon();
  }

  /* ---------- Congrats confetti ---------- */

  function launchConfetti() {
    const layer = document.createElement("div");
    layer.className = "confetti-layer";
    document.body.appendChild(layer);

    const hearts = ["❤️", "💕", "💖", "💗", "💘", "💝"];
    const pieces = 140;

    for (let i = 0; i < pieces; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";

      // Pick a random heart
      piece.textContent = hearts[Math.floor(Math.random() * hearts.length)];

      // Random position
      piece.style.left = Math.random() * 100 + "vw";

      // Random heart size
      piece.style.fontSize = (16 + Math.random() * 18) + "px";

      // Animation timing
      piece.style.animationDuration = (2.2 + Math.random() * 1.8) + "s";
      piece.style.animationDelay = Math.random() * 0.6 + "s";

      // Random drift and spin
      piece.style.setProperty("--drift", (Math.random() * 240 - 120) + "px");
      piece.style.setProperty("--spin", (Math.random() * 720 - 360) + "deg");

      layer.appendChild(piece);
    }

    setTimeout(function () {
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    }, 4800);
  }

  /* ---------- Hard mode ---------- */

  function applyHardMode(on, restart) {
    state.hardMode = on;
    hardModeCheckbox.checked = on;
    try {
      localStorage.setItem("wu-hardmode", on ? "1" : "0");
    } catch (e) {}
    if (on) {
      hardModeHint.hidden = false;
      hardModeHint.textContent =
        "Pool expanded to " + TOTAL.toLocaleString() + " words \u2014 the higher the number, the harder the word.";
    } else {
      hardModeHint.hidden = true;
    }
    updatePuzzleRange();
    if (restart) startRandom();
  }

  function loadHardMode() {
    try {
      return localStorage.getItem("wu-hardmode") === "1";
    } catch (e) {
      return false;
    }
  }

  /* ---------- Wiring ---------- */

  function goToPuzzle() {
    const value = parseInt(puzzleInput.value, 10);
    const max = maxPuzzle();
    if (!Number.isInteger(value) || value < 1 || value > max) {
      if (!state.hardMode && Number.isInteger(value) && value > ANSWERS_COUNT && value <= TOTAL) {
        showToast("Turn on hard mode to play puzzle #" + value.toLocaleString(), 2500);
      } else {
        showToast("Enter a number from 1 to " + max.toLocaleString());
      }
      puzzleInput.value = String(state.puzzleNumber);
      return;
    }
    startGame(value);
  }

  function init() {
    buildKeyboard();
    updateThemeIcon();

    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const key = e.key;
      if (key === "Enter") {
        handleKey("enter");
      } else if (key === "Backspace") {
        handleKey("back");
      } else if (/^[a-zA-Z]$/.test(key)) {
        handleKey(key.toLowerCase());
      }
    });

    keyboardEl.addEventListener("click", function (e) {
      const btn = e.target.closest(".key");
      if (!btn) return;
      handleKey(btn.dataset.key);
    });

    puzzleGo.addEventListener("click", goToPuzzle);
    puzzleInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        goToPuzzle();
        puzzleInput.blur();
      }
    });

    newGameBtn.addEventListener("click", startRandom);
    themeToggle.addEventListener("click", toggleTheme);
    hardModeCheckbox.addEventListener("change", function () {
      applyHardMode(hardModeCheckbox.checked, true);
    });

    applyHardMode(loadHardMode(), false);
    startRandom();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
