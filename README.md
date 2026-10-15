# 封神英傑傳 — a three.js remake

A fan remake of the Mega Drive strategy RPG 封神英傑傳, in the browser (three.js, no build step).

**It ships none of the original game's content.** On first visit the page asks for your own ROM of the game; its art,
maps, scenes, music and text are then made from it in your browser (`extract/`: a 68000 and Z80 emulator runs the
game's own code), kept in the browser's storage and never uploaded. You need your own legally obtained copy.

Serve the folder over HTTP (e.g. `python3 -m http.server`) and open index.html.

Third-party code: three.js (MIT, `vendor/`), xBRjs (MIT, `extract/vendor/xbr.LICENSE`), z80-emulator and z80-base
(MIT, `extract/vendor/z80/`), ymfm (BSD-3-Clause, `src/synth/LICENSE.ymfm`).
