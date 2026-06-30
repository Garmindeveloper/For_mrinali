---
name: Things I love about/with you
overview: Build a static (vanilla HTML/CSS/JS) unlimited Wordle clone in a new folder, using the official answers list as the secret-word pool, with puzzle-number selection, full official UI/colors, an on-screen keyboard, and dark/light themes.
todos:
  - id: fetch-words
    content: Fetch the cfreshman answers and allowed-guesses lists and embed them in js/words.js as ANSWERS array and VALID_WORDS set
    status: completed
  - id: html
    content: "Build index.html: header (title, theme toggle, puzzle # control), 6x5 grid, on-screen keyboard, toast area"
    status: in_progress
  - id: css
    content: Write styles.css matching official Wordle layout and colors with light/dark CSS variables and animations
    status: pending
  - id: game-logic
    content: "Implement game.js: state, input handling, two-pass duplicate-letter evaluation, keyboard coloring, win/lose"
    status: pending
  - id: puzzle-select
    content: Implement random word on load plus puzzle-number selection (1-indexed) with range validation and Random button
    status: pending
  - id: theme
    content: Implement dark/light toggle with localStorage persistence and system-preference default
    status: pending
  - id: readme
    content: Write README.md with run/host instructions
    status: pending
isProject: false
---

# Wordle Unlimited

Build a no-build, static website that recreates the official Wordle UI and plays an unlimited number of games.

## Tech & location
- Vanilla HTML/CSS/JS, no build step (easy to host on GitHub Pages / Netlify / open `index.html` directly).
- New folder: `eval/wordle-unlimited/`.

## Word data
- Source the two standard lists (factual 5-letter word lists) via the `cfreshman` raw gists during implementation:
  - Answers (~2,309 words): `wordle-answers-alphabetical.txt`
  - Additional allowed guesses (~10,600 words): `wordle-allowed-guesses.txt`
- Embed them in `js/words.js` as:
  - `ANSWERS` = ordered array of solution words (puzzle pool).
  - `VALID_WORDS` = `Set` of `ANSWERS` + allowed guesses, used to reject invalid guesses ("Not in word list").
- Puzzle number is 1-indexed: puzzle #N -> `ANSWERS[N-1]`.

## Files
- `eval/wordle-unlimited/index.html` - board grid (6x5), header (title + theme toggle + puzzle # control), on-screen keyboard, toast/message area.
- `eval/wordle-unlimited/styles.css` - official layout & colors with CSS variables for theming.
- `eval/wordle-unlimited/js/words.js` - the embedded word lists.
- `eval/wordle-unlimited/js/game.js` - game state + logic.
- `eval/wordle-unlimited/README.md` - how to run/host.

## Game logic (`game.js`)
- State: `secret`, `puzzleNumber`, `currentRow`, `currentGuess`, `gameOver`.
- On load: pick a random index into `ANSWERS`, set puzzle # accordingly, render empty board.
- Input from physical keyboard (keydown) and on-screen keyboard clicks; both route through one `handleKey()`.
- On Enter: require length 5 and membership in `VALID_WORDS` (else toast). Then evaluate.
- Evaluation uses the correct two-pass duplicate-letter algorithm:
  1. Mark exact matches green and consume those letters from a tally.
  2. For remaining letters, mark yellow only if an unconsumed instance exists, else gray.
- Apply tile colors with flip animation; update keyboard key colors using priority green > yellow > gray.
- Win -> toast + lock input; loss after 6 rows -> reveal answer.

## Puzzle selection feature
- Header control: a number input + "Go" button (and a "Random" button).
- Entering N loads `ANSWERS[N-1]`, resets the board, and starts that game. Validate range `1..ANSWERS.length`.
- Reflect current puzzle number in the input so the player can see/share it.

## UI & layout (match official Wordle)
- Centered column: header bar with bottom border, 5-wide x 6-tall tile grid, three-row keyboard with wide Enter/Backspace keys.
- Colors via CSS variables, switched by `data-theme` on `<html>`:
  - Correct: `#6aaa64` (light) / `#538d4e` (dark)
  - Present: `#c9b458` (light) / `#b59f3b` (dark)
  - Absent: `#787c7e` (light) / `#3a3a3c` (dark)
  - Light bg `#ffffff`, text `#1a1a1b`, tile border `#d3d6da`, empty key `#d3d6da`.
  - Dark bg `#121213`, text `#ffffff`, tile border `#3a3a3c`, empty key `#818384`.
- Theme toggle button in header; persist choice in `localStorage`; default to system preference via `prefers-color-scheme`.
- Tile pop on type and flip-reveal animation on submit; invalid-word row shake; toast messages like official.

## Theming details
- `:root` defines light vars; `[data-theme="dark"]` overrides. Toggle flips the attribute and saves to `localStorage`.

## Verification
- Open `index.html`, confirm: random word on load, puzzle # entry plays the indexed word, duplicate-letter coloring is correct, invalid words rejected, keyboard coloring correct, win/lose flows, and dark/light toggle.
