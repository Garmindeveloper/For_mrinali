(function () {
  "use strict";

  const TARGET_LENGTHS = [5, 6, 7];
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

  function normalizeWord(word) {
    return String(word || "")
      .trim()
      .toLowerCase();
  }

  function buildWordPools() {
    const answersSource =
      typeof ANSWERS !== "undefined" ? Array.from(ANSWERS) : [];
    const validSource =
      typeof VALID_WORDS !== "undefined" ? Array.from(VALID_WORDS) : [];

    const answers = answersSource
      .map(normalizeWord)
      .filter(function (w) {
        return w.length >= 5 && w.length <= 7;
      });

    const validWords = validSource
      .map(normalizeWord)
      .filter(function (w) {
        return w.length >= 5 && w.length <= 7;
      });

    const pools = {};

    TARGET_LENGTHS.forEach(function (len) {
      const answerList = answers.filter(function (w) {
        return w.length === len;
      });
      const validList = validWords.filter(function (w) {
        return w.length === len;
      });
      const answerSet = new Set(answerList);
      const extraWords = validList
        .filter(function (w) {
          return !answerSet.has(w);
        })
        .sort();

      pools[len] = {
        answers: answerList,
        extras: extraWords,
        pool: answerList.concat(extraWords),
        validSet: new Set(validList),
      };
    });

    return pools;
  }

  const WORD_POOLS = buildWordPools();

  const availableLengths = TARGET_LENGTHS.filter(function (len) {
    return WORD_POOLS[len] && WORD_POOLS[len].answers.length > 0;
  });

  const state = {
    secret: "",
    wordLength: availableLengths[0] || 5,
    puzzleNumber: 1,
    currentRow: 0,
    currentGuess: "",
    gameOver: false,
    keyStates: {},
    hardMode: false,
    answerWords: [],
    validWords: new Set(),
    wordPool: [],
  };

  /* ---------- Board / keyboard construction ---------- */

  function buildBoard() {
    boardEl.innerHTML = "";
    boardEl.style.setProperty("--word-length", state.wordLength);
    updateBoardSizing();
    for (let r = 0; r < MAX_ROWS; r++) {
      const row = document.createElement("div");
      row.className = "tile-row";
      row.dataset.row = String(r);

      for (let c = 0; c < state.wordLength; c++) {
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.dataset.row = String(r);
        tile.dataset.col = String(c);
        row.appendChild(tile);
      }

      boardEl.appendChild(row);
    }
  }

function updateBoardSizing() {
  const letters = state.wordLength;
  const gap = 8; // same as your CSS gap
  const maxWidth = Math.min(window.innerWidth * 0.92, 520);

  const tileSize = Math.floor((maxWidth - gap * (letters - 1)) / letters);
  const clamped = Math.max(36, Math.min(64, tileSize));

  boardEl.style.setProperty("--word-length", letters);
  boardEl.style.setProperty("--tile-size", clamped + "px");
}

function buildBoard() {
  boardEl.innerHTML = "";
  boardEl.style.setProperty("--word-length", state.wordLength);
  updateBoardSizing();

  for (let r = 0; r < MAX_ROWS; r++) {
    const row = document.createElement("div");
    row.className = "tile-row";
    row.dataset.row = String(r);

    for (let c = 0; c < state.wordLength; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.row = String(r);
      tile.dataset.col = String(c);
      row.appendChild(tile);
    }

    boardEl.appendChild(row);
  }
}

window.addEventListener("resize", function () {
  updateBoardSizing();
});

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
    return boardEl.querySelector(
      '.tile[data-row="' + row + '"][data-col="' + col + '"]'
    );
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

  function getPoolForLength(len) {
    return WORD_POOLS[len] || null;
  }

  function maxPuzzle() {
    const pool = getPoolForLength(state.wordLength);
    if (!pool) return 0;
    return state.hardMode ? pool.pool.length : pool.answers.length;
  }

  function randomWordLength() {
    const choices = availableLengths.length ? availableLengths : TARGET_LENGTHS;
    return choices[Math.floor(Math.random() * choices.length)];
  }

  function randomPuzzleNumber(len) {
    const pool = getPoolForLength(len || state.wordLength);
    if (!pool) return 1;

    const max = state.hardMode ? pool.pool.length : pool.answers.length;
    if (max <= 0) return 1;

    return Math.floor(Math.random() * max) + 1;
  }

  function startGame(puzzleNumber, requestedLength) {
    const len =
      Number.isInteger(requestedLength) && getPoolForLength(requestedLength)
        ? requestedLength
        : randomWordLength();

    const pool = getPoolForLength(len);
    if (!pool || pool.answers.length === 0) {
      showToast("No words available for that length");
      return;
    }

    state.wordLength = len;
    state.answerWords = pool.answers;
    state.validWords = pool.validSet;
    state.wordPool = state.hardMode ? pool.pool : pool.answers;

    let n = puzzleNumber;
    const max = maxPuzzle();

    if (!Number.isInteger(n) || n < 1 || n > max) {
      n = randomPuzzleNumber(len);
    }

    state.secret = state.wordPool[n - 1];
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

  function startRandom() {
    const len = randomWordLength();
    startGame(undefined, len);
  }

  function updatePuzzleRange() {
    const max = maxPuzzle();
    puzzleInput.max = String(max || 1);
    puzzleRange.textContent =
      "of " +
      (max || 1).toLocaleString() +
      " (" +
      state.wordLength +
      "-letter)";
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
    if (state.currentGuess.length >= state.wordLength) return;
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

    if (guess.length < state.wordLength) {
      shakeRow();
      showToast("Not enough letters");
      return;
    }

    if (!state.validWords.has(guess)) {
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
    const len = state.wordLength;
    const result = new Array(len).fill("absent");
    const counts = {};

    for (let i = 0; i < len; i++) {
      counts[secret[i]] = (counts[secret[i]] || 0) + 1;
    }

    // Pass 1: exact matches.
    for (let i = 0; i < len; i++) {
      if (guess[i] === secret[i]) {
        result[i] = "correct";
        counts[guess[i]]--;
      }
    }

    // Pass 2: present letters with remaining unconsumed instances.
    for (let i = 0; i < len; i++) {
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

    for (let i = 0; i < state.wordLength; i++) {
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
            if (revealed === state.wordLength) {
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
      const messages = [
        "Genius",
        "Magnificent",
        "Impressive",
        "Splendid",
        "Great",
        "Phew",
      ];
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

  function reportResult(won, guesses) {
    window.dispatchEvent(
      new CustomEvent("wu:gameover", {
        detail: {
          won: won,
          guesses: guesses,
          puzzleNumber: state.puzzleNumber,
          hardMode: state.hardMode,
          wordLength: state.wordLength,
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
    themeToggle.innerHTML =
      currentTheme() === "dark" ? "\u2600" : "\uD83C\uDF19";
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

      piece.textContent = hearts[Math.floor(Math.random() * hearts.length)];
      piece.style.left = Math.random() * 100 + "vw";
      piece.style.fontSize = 16 + Math.random() * 18 + "px";
      piece.style.animationDuration = 2.2 + Math.random() * 1.8 + "s";
      piece.style.animationDelay = Math.random() * 0.6 + "s";
      piece.style.setProperty(
        "--drift",
        Math.random() * 240 - 120 + "px"
      );
      piece.style.setProperty(
        "--spin",
        Math.random() * 720 - 360 + "deg"
      );

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
      const pool = getPoolForLength(state.wordLength);
      const total = pool ? pool.pool.length : 0;
      hardModeHint.hidden = false;
      hardModeHint.textContent =
        "Pool expanded to " +
        total.toLocaleString() +
        " " +
        state.wordLength +
        "-letter words — the higher the number, the harder the word.";
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
      if (
        !state.hardMode &&
        Number.isInteger(value) &&
        value > (state.answerWords.length || 0) &&
        value <= (getPoolForLength(state.wordLength)?.pool.length || 0)
      ) {
        showToast(
          "Turn on hard mode to play puzzle #" + value.toLocaleString(),
          2500
        );
      } else {
        showToast("Enter a number from 1 to " + max.toLocaleString());
      }
      puzzleInput.value = String(state.puzzleNumber);
      return;
    }

    startGame(value, state.wordLength);
  }

  function loadSavedTheme() {
    try {
      const saved = localStorage.getItem("wu-theme");
      if (saved === "dark" || saved === "light") {
        document.documentElement.setAttribute("data-theme", saved);
      }
    } catch (e) {}
  }

  function init() {
    buildKeyboard();
    loadSavedTheme();
    updateThemeIcon();

    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA"))
        return;
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
    window.addEventListener("resize", updateBoardSizing);

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
