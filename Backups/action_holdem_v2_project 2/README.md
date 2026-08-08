# Action Hold 'Em v2.0 Project Split

This version restructures the game into a real project folder instead of one giant HTML file.

## How to run

Open `index.html` locally in your browser.

## Current structure

- `index.html` contains the page markup.
- `css/main.css` contains the styling.
- `js/main.js` contains the current working game logic.
- `assets/sounds/` contains the sound files if they were available in the workspace.
- Additional JS files are placeholders for the next refactor pass.

## Important

This migration preserves the current behavior. The next step is to move code out of `main.js` into focused files such as `ai.js`, `actions.js`, `ui.js`, and `poker.js`.

## Recommended next step

Build AI 2.1:
- AI avatars
- AI identity badges
- avatar rendering in seats, scoreboard, target picker, and logs


## Audio Manager v2

Audio playback now runs through `js/audio.js`.

Use:

```js
AudioManager.play("draw");
AudioManager.play("discard");
AudioManager.play("shuffle");
AudioManager.play("action");
AudioManager.startAmbience();
```

The manager supports randomized clips, category volumes, cooldowns, ambience toggle, and SFX toggle.


## AI 2.0

This version adds:

- AI difficulty selection on the setup screen: Easy, Normal, Hard, Expert.
- AI identities with unique names, avatars, colors, and personality labels.
- Personality-based preferred action cards.
- Difficulty-based action frequency, targeting skill, discard skill, and draw/discard behavior.
- AI badges in the table seats, scoreboard, and target picker.

Personalities currently include RiverRat, ChipBot, All-In Al, PocketBot, The Grinder, Bad Beat Bob, Viper, Lucky, Owl, Wolf, Queen, and Falcon.


Random difficulty: each AI is independently assigned Easy, Normal, Hard, or Expert when the Random option is selected.


## AI 2.2 Memory

AI players now remember who targeted them with action cards. This affects targeting decisions:
- AI may retaliate against players who burned, skipped, reset, or exposed them.
- AI shifts into stop-the-leader mode when someone gets close to the target score.
- Memory fades slightly each hand so grudges do not last forever.
- The scoreboard and seats show memory hints when an AI is holding a grudge.
