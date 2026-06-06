# Wordle Unlimited

An unlimited, self-hosted clone of Wordle. Play as many games as you want, jump to any puzzle by number, and switch between light and dark themes. Built with plain HTML, CSS, and JavaScript: no build step and no dependencies.

## Features

- **Unlimited play** - a new random word is chosen every time you open the page or hit the refresh icon.
- **Puzzle numbers** - type a number in the `Puzzle #` box and press `Go` (or Enter) to play a specific word. Puzzle `#N` maps to the `N`th word in the puzzle pool (1-indexed).
- **Hard mode** - toggle on to expand the pool from the ~2,300 common answers to all ~13,000 valid words. The obscure words sit at higher puzzle numbers, so the higher the number, the harder the word.
- **Congrats animation** - a confetti burst celebrates every solved puzzle.
- **Google login + synced stats** - sign in with Google to track Played, Win %, Current/Max Streak, and a guess-distribution chart that syncs across devices (see setup below). Without login, stats are kept locally in your browser.
- **Authentic UI** - 6x5 tile grid, on-screen keyboard, tile flip/pop/shake/bounce animations, a Statistics modal, and toast messages matching the official game's layout and colors.
- **Real word validation** - guesses are checked against the full ~13,000-word valid-words dictionary; invalid words are rejected.
- **Light & dark themes** - toggle with the moon/sun button. Your choice is saved, and the default follows your system preference.

## How to play

1. Guess the hidden 5-letter word in 6 tries.
2. After each guess, tile colors give feedback:
   - **Green** - correct letter, correct spot.
   - **Yellow** - correct letter, wrong spot.
   - **Gray** - letter not in the word.
3. Use your physical keyboard or the on-screen one.

## Running locally

Just open `index.html` in any modern browser. It works straight from the file system, no server required.

If you prefer to serve it (e.g. to mimic production), run any static server from this folder, for example:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Hosting

Because it's fully static, you can deploy the folder as-is to GitHub Pages, Netlify, Vercel, Cloudflare Pages, or any static host.

## Project structure

```
wordle-unlimited/
  index.html            Markup: header, board, keyboard, stats modal
  styles.css            Layout, official colors, theming, animations
  js/
    words.js            ANSWERS list + VALID_WORDS guess dictionary
    game.js             Game state, input handling, evaluation, hard mode, confetti
    firebase-config.js  Your Firebase project config (edit this to enable login)
    auth.js             Google sign-in + stats (Firebase Auth + Firestore)
  README.md
```

## Google login + cloud stats (Firebase)

The game works fully without any of this: by default you play as a guest and stats are saved in your browser's `localStorage`. To enable "Sign in with Google" and have stats sync across devices, set up a free Firebase project and paste its config into `js/firebase-config.js`.

### Why Firebase?

The site is 100% static (no server). Firebase gives you Google authentication and a database (Firestore) that you can talk to directly from the browser, with security enforced by server-side rules. That keeps the "no backend to run" property while still giving real, synced per-user stats. The free Spark plan is far more than enough for this.

### Step-by-step setup

1. **Create a project.** Go to the [Firebase console](https://console.firebase.google.com/), click **Add project**, name it (e.g. `wordle-unlimited`), and finish the wizard. Google Analytics is optional.

2. **Register a web app.** In the project, click the **`</>`** (Web) icon under "Get started by adding Firebase to your app". Give it a nickname. You do **not** need Firebase Hosting. After registering, Firebase shows a `firebaseConfig` object - keep that tab open.

3. **Copy the config.** Open `js/firebase-config.js` in this project and replace the placeholder values with the ones from `firebaseConfig` (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`). These values are safe to commit/expose in client code - access is controlled by the security rules below, not by hiding the keys.

4. **Enable Google sign-in.** In the console go to **Build -> Authentication -> Get started -> Sign-in method**, click **Google**, toggle **Enable**, pick a support email, and **Save**.

5. **Authorize your domains.** In **Authentication -> Settings -> Authorized domains**, make sure the domains you'll serve from are listed. `localhost` is there by default; add your production domain (e.g. `gcfc.github.io`) when you deploy.

6. **Create the database.** Go to **Build -> Firestore Database -> Create database**. Choose a location, and start in **production mode** (we'll add rules in the next step).

7. **Set security rules.** In **Firestore Database -> Rules**, replace the contents with the following so each signed-in user can only read/write their own stats document, then **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

8. **Run it over HTTP(S).** Google sign-in popups require `http://localhost` or `https://`, not the `file://` protocol. Start a local server from this folder (`python -m http.server 8000`) and open `http://localhost:8000`, or deploy to any static host.

That's it. Click the person icon (or the **Sign in with Google** button in the Statistics modal) to log in. Your stats now live at `users/{your-uid}` in Firestore and follow you across devices and browsers.

### Data model

Each user has one document at `users/{uid}`:

```
stats: {
  gamesPlayed:   number,
  gamesWon:      number,
  currentStreak: number,
  maxStreak:     number,
  distribution:  [n1, n2, n3, n4, n5, n6]  // wins by number of guesses
}
updatedAt: number (epoch ms)
```

The first time you sign in on a device that already has guest stats, those guest stats seed your (empty) cloud account so you don't lose progress.

### Notes & limits

- Stats count every finished game (unlimited mode), so streaks reflect consecutive wins regardless of which puzzle number you played.
- Because writes happen straight from the client, a determined user could write fabricated stats to their own document - fine for a personal/fun project. If you ever need tamper-proof stats, move writes behind a Cloud Function.

## Word lists

The word lists are the standard public Wordle lists compiled by [@cfreshman](https://gist.github.com/cfreshman):

- Answers (solution pool): https://gist.github.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b
- Allowed guesses: https://gist.github.com/cfreshman/cdcdf777450c5b5301e439061d29694c

This project is an independent clone and is not affiliated with or endorsed by The New York Times.
