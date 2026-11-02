# Card-1 – Zeichenkarte

Die Vorderseite zeigt die Bedeutung. Man zeichnet das Kanji, geführt Strich für Strich oder frei. Die Rückseite bewertet und zeigt Info, Radikal-Baum, Schreibfehler und Strichfolge.

Allgemeines zu Aufbau, Speicher und gemeinsamen Blöcken steht in [../README.md](../README.md). Mit ← markierte Abschnitte werden von `python3 Tools/build.py` aus `Templates/src/` eingesetzt und dort bearbeitet. Die Zeilennummern gelten für den Stand dieses Commits; nach Änderungen verschieben sie sich. Die Suchbegriffe bleiben gültig.

## FrontTemplate.html

### HTML

| Zeilen | Abschnitt | Suchbegriff / IDs |
|---|---|---|
| 1–38 | Theme-Vorauswahl vor dem ersten Paint, gecachte Palette, Einblenden der Karte `[SHARED]` | `_kdPreRoll`, `kdPal:`, `kd-enter` |
| 39–47 | Zahnrad-Knopf | `.gear-btn`, `openSettings` |
| 48–1508 | Einstellungs-Overlay | `#settings-overlay` |
| 52–198 | ‑ Übersicht (Kategoriekarten, Segment C1/C2) | `#settings-main` |
| 200–326 | ‑ Hilfslinien | `#page-grid` |
| 328–558 | ‑ Vorderseite (nur C1) | `#page-front` |
| 560–706 | ‑ Rückseite | `#page-back` |
| 708–785 | ‑ Vorderseite Erkennen (nur C2, hier ausgeblendet) | `#page-front-c2` |
| 787–1214 | ‑ Erscheinungsbild (Hell/Dunkel, Akzent, Landschaft, Strichfarbe/-stil/-breite, Schrift, Hand) | `#page-theme` |
| 1215–1507 | ‑ Klang & Musik (**generiert**) | `[KD-SOUND-PAGE]`, `#page-sound` |
| 1511–4309 | Landschaften (~207 KB SVG): Tag-/Nachtebenen 1514/1540, Szenen `neutral` 1593, `warm` 1971, `cool` 2308, `sepia` 2575, `rose` 2820, `sage` 3149, `hokkaido` 3435, `tokyo` 3756, `okinawa` 4008, Glühwürmchen 4253 | `.forest-scenery`, `jp-scene-<theme>` |
| 4310 | Kartentitel | `.card-title` (`{{Bedeutung}}`) |
| 4313–4356 | Neon-Filter (Desktop/Android und WebKit-lite) | `#neon-defs` |
| 4357–4403 | Zeichenfläche: Raster, Referenzpfade, Canvas (AnkiMobile), Zeichenebene, Touch-Schild, Banner | `.kanji-container`, `#grid-bg`, `#svg-bg` (`{{SVGPfade}}`), `#draw-canvas`, `#draw-layer`, `#touch-shield`, `#legacy-gesture-warning`, `#addon-hint` |
| 4404–4434 | Aktionsknöpfe | `#button-reveal`, `#button-undo`, `#button-skip`, `#button-reset` |
| 4435–4439 | Aufdeck-Ersatz (Plattformen ohne `pycmd`) | `#answer-fallback` |
| 4440–6420 | Audio-Engine (**generiert**, siehe [../README.md](../README.md#audio-engine-kd-audio-engine)) | `[KD-AUDIO-ENGINE]` |

### Haupt-Skript (6421–9597)

| Zeilen | Abschnitt (Suchbegriff) | Wichtigste Namen |
|---|---|---|
| 6443–6494 | `AnkiWeb / Browser Detection [SHARED]` | `_applyAwSize`, `_measureAwBar` |
| 6495–6516 | `AnkiDroid Legacy swipe-gesture warning` | `#legacy-gesture-warning` |
| 6517–6533 | `Anki Desktop: addon-missing hint` | `#addon-hint` |
| 6534–6542 | `Anti-Flicker [SHARED]` | – |
| 6543–6597 | `Persistence Layer` ← [src/front/persistence.js](../src/front/persistence.js) | `_parseCookies`, `_kCookieObj`, `safeGetItem`, `safeSetItem`, `_fc` (Cookie sichern), `pycmd('kdp:…')` |
| 6599–6658 | **`Shared helpers`** ← [src/front/shared-helpers.js](../src/front/shared-helpers.js) – auch für die Rückseite | `_kanjiIsDark`, `_kanjiSwFactor` (Strichbreite), `_kanjiGelColor`, `_kanjiMakeGelHalo`, `_kanjiEatNextClick` (Stift-Geisterklick schlucken) |
| 6659–6960 | `Settings UI [SHARED]` | `scopedGet`, `hostGet`, `switchSettingsTab`, `_initModalScrollbars` (eigene Scrollleiste), `navigateToPage`, `navigateBack`, `refreshSettingsRadios`, `updateModeDisabledSettings`, `getGlobalConfig` |
| 6961–7042 | Farbdefinitionen | `_accentColors`, `_primaryColors`, Strichfarben |
| 7043–7085 | Zufalls-Landschaft, verzögerte Theme-Kontrolle | `_rollRandomTheme`, `_scheduleDeferredThemeCheck` |
| 7086–7325 | `applyThemeSettings`: 1. Hell/Dunkel, 2. Akzent, 2b. Landschaft, 2c. Strichfarbe, 2d. Strichstil, 3. Schriftgröße, 4./5. Qt-Hintergrund | – |
| 7326–7337 | Theme-Einstellung speichern | `updateThemeSetting` |
| 7338–7415 | `Klang & Musik: Bridge zur Audio-Engine` ← [src/front/sound-bridge.js](../src/front/sound-bridge.js) | `_kdSnd`, `_kdSoundConf`, `applySoundSettings`, `updateSoundSetting`, UI-Klang-Delegation (`_kdSndUiBound`) |
| 7417–7502 | `Grid Rendering` ← [src/front/grid-display.js](../src/front/grid-display.js), danach Funktionsschalter | `updateGridDisplay`, `updateGridSetting`, `updateFeatureSetting` |
| 7503–7556 | Einstellungen öffnen/schließen | `openSettings`, `closeSettings` |
| 7557–7686 | Abwehr von Ankis Nachtmodus-Umschaltung, MediaQuery, bfcache | `_kanjiThemeObserver`, `_kanjiMQHandler`, `_kanjiPagesShowHandler` |
| 7687–7779 | `Scroll Lock & iOS Detection [SHARED]` | `kanjiTouchMoveModalHandler`, `kanjiTouchStartHandler`, `checkScrollability` |
| 7780–7791 | `Cleanup stale DOM` | – |
| 7792–7895 | `Shared Scoring Algorithms` | `window._kanjiAlgo` (`resamplePoints`, `discreteFrechet`, `smoothInput`, `hungarianMatch`, `avgPointDist`, `segmentAngles`) – auch von den Tests geladen |
| 7896–8446 | `Drawing Engine` – Zustand und Hilfsfunktionen | `getCSSVar` 7948, `updateStartMarker` 7994, `saveState` 8040, `triggerAutoFlip` 8060, `clearDrawLayer` 8102, Strichstil/-breite 8112, Canvas (AnkiMobile) 8131, `applyPathStyle` 8192, `_addGelHaloToPath` 8234, `snapToReference` 8260, `getMousePos` 8312, `playCompletionAnimation` 8324 |
| 8447–8789 | `HANDLER DEFINITIONS` | `startDrawing` 8453, `_renderCanvasFrame` 8522, `draw` 8559, `stopDrawing` 8587, **`evaluateStroke` 8628** (Bewertung geführter Modus), `saveFreeStrokes` 8781 |
| 8790–8876 | `EVENT WIRING` | Pointer-/Touch-Listener auf `#draw-layer` bzw. `#touch-shield`, `_kanjiDrawCleanup` 8849 |
| 8877–9237 | `BUTTON ACTIONS` | `revealAction`, `guidedResetAction` (Rückspul-Animation), `guidedSkipAction`, `freeUndoAction`, `freeResetAction`, `bindModeButtons` |
| 9238–9269 | `MODE SWITCHING` | `_kanjiSwitchDrawMode` |
| 9270–9314 | `Button Feedback & Stylus Fixes [SHARED]` | – |
| 9315–9351 | `Stroke-Order Replay Overlay [SHARED]` | `addPenHandler` |
| 9352–9494 | `Scroll Guards & AnkiMobile Tappable Isolation` ← [src/front/scroll-guards.js](../src/front/scroll-guards.js) | `_kanjiSetupModalTouchGuards` |
| 9496–9537 | `Apple Pencil: pen-to-click for modal controls [SHARED]` | – |
| 9538–9550 | `S-Pen / Stylus: backdrop-close verification [SHARED]` | `_trackBg` |
| 9551–9592 | `Global S-Pen defense [SHARED]` | `_kanjiGlobalPenDefenseAdded`, `.spen-hover` |
| 9593–9597 | AnkiDroid/AnkiMobile-Gesten | `userJs1`–`userJs3` (extern aufgerufen) |

## BackTemplate.html

| Zeilen | Abschnitt (Suchbegriff) | Wichtigste Namen |
|---|---|---|
| 1 | Anki-Überblendung aus | `aFade`, `qFade` |
| 2–99 | Statische Anti-Flacker-Regeln | `<style id="kanji-anti-flicker">` |
| 100–136 | Strichfarben vor dem Einbinden der Vorderseite (aus `kanjiErrors`) | `_ck` |
| 137–140 | Marker, Antwort, Vorderseite | `#is-back-side-marker`, `#answer`, `{{FrontSide}}` |
| 142–151 | Info-Knopf | `.back-actions`, `openInfoModal` |
| 152–409 | Info-Overlay: Übersicht (Tags, Baum, Wortbeispiele, Lesungen), Strichfolge, Schreibfehler | `#info-overlay`, `#info-page-main` 155, `#raw-tree-data` 187, `#raw-pitfalls-data` 195, `#info-page-order` 346, `#info-page-pitfalls` 384 |
| 410–665 | Kopf, Schrift/Strichstil der Rückseite, Info-Modal-Navigation | `safeGetState`, `openInfoModal`, `navigateInfoToOrder`, `navigateInfoToPitfalls`, `navigateInfoBack`, `closeInfoModal` |
| 666–1045 | `Primitive Tree (Kanji-Study style)` ← [src/back/primitive-tree.js](../src/back/primitive-tree.js) – Parser, Layout, Zoom, Vollbild | `_kanjiRenderPrimitiveTree` |
| 1046–1764 | `Interactive +/- Zoom, Fullscreen & Focus-Gated Pan` | Zoom, Vollbild, Doppeltipp-Navigation |
| 1766–1798 | `Radical Tree Renderer` ← [src/back/radical-tree.js](../src/back/radical-tree.js) – Aufruf | `_kanjiTreeOutsideHandler` |
| 1800–2104 | `Pitfalls ("Häufige Schreibfehler" …)` ← [src/back/pitfalls.js](../src/back/pitfalls.js) | `_kanjiRenderPitfalls` |
| 2105–2150 | `Word Examples (furigana toggle)`, `Hide "Lesungen"` ← [src/back/word-examples.js](../src/back/word-examples.js), [src/back/hide-readings.js](../src/back/hide-readings.js) | – |
| 2152–2439 | `Back Side Features` – gemeinsame Helfer | `addNumbersGPAL` 2163 (Strichnummern mit Kollisionsvermeidung), `makeStrokePath` 2210 |
| 2440–2586 | Strichfarben und -nummern der Rückseite | `applyBackFeatures` |
| 2587–2890 | `FREE MODE: Evaluation …` – Auswertung (Zuordnung per Ungarischer Methode, harte Grenzen), Morph-Helfer | `_newScratchSvg` 2595, `_morphResample`, `_morphLabelPos`, `_morphColAdj`, `window._kanjiFreeEval` 2886 |
| 2891–3442 | `renderFreeView`: `HANDWRITING VIEW` 2969, `SVG-PFADE VIEW` 3045, Morph WebKit (SMIL) 3200, Morph Desktop/Android 3307 | `window._kanjiRenderFreeView` |
| 3443–3811 | `Quicksettings toggle button (Handschrift ↔ SVG-Pfade)` inkl. Rück-Morph | – |
| 3812–3830 | Einstellungen live anwenden | `window.kanjiSettingsGlobalHandler` |
| 3831–3965 | `Stroke-Order Player` ← [src/back/stroke-order-player.js](../src/back/stroke-order-player.js) | `window._kanjiOrder` (`open`, `close`, `action`), `openStrokeOrder`, `strokeOrderAction` |
| 3967–4054 | `Cross-Platform Fixes` ← [src/back/cross-platform.js](../src/back/cross-platform.js) | Link-Knöpfe, `addPenHandler` |
| 4055–4148 | S-Pen: Hintergrund-Prüfung und globale Abwehr | `_trackBg`, `_kanjiGlobalPenDefenseAdded` |
| 4149–4172 | Scroll-Neusynchronisierung nach Rückkehr aus Safari | `resyncModalScroll`, `_kanjiModalScrollResyncAdded` |

## Code-Review: Stand

**Behoben**
- Gemeinsame Helfer statt Kopien (Abschnitt `Shared helpers`):
  - Dunkelmodus-Prüfung (vorher siebenmal ausgeschrieben).
  - Strichbreiten-Faktor (vorher zehnmal berechnet).
  - Stift-Geisterklick schlucken (vorher achtmal).
  - Farb- und Halo-Kern des Gelstifts, gemeinsam mit Card-2.
- Die fünf gleichen Scratch-SVGs der Rückseite erzeugt jetzt ein einziger Helfer, `_newScratchSvg`.
- `avgPointDist` und `segmentAngles` liegen jetzt in `window._kanjiAlgo`. Die Tests laden die Algorithmen direkt aus diesem Template.
- `_k`-Cookie: Statt dreier gleicher Parser gibt es jetzt `_kCookieObj`.
- Dead Code entfernt:
  - `window._kanjiGetStrokeWidthFactor`.
  - Den doppelten Aufruf von `_kanjiSetupModalTouchGuards` nach `renderList()`.
  - In der Audio-Engine die Kalimba, den Akkordtyp `ms11` und die ungenutzten Szenenfelder.

**Offen** (bewusst nicht angefasst, weil ohne Sichtprüfung auf allen Plattformen riskant)
1. Vier ähnliche Morph-Animationen auf der Rückseite (WebKit-SMIL und Desktop, je vorwärts und rückwärts, ~600 Zeilen). Eine gemeinsame `runMorph(pairs, {reverse, smil})` wäre möglich, muss aber auf AnkiMobile geprüft werden.
2. Die Landschaften (1511–4309) werden auf Vorder- und Rückseite komplett geparst. Siehe [../README.md](../README.md#code-review-stand).
3. `applyThemeSettings` stylt bei jedem Lauf alle Referenzpfade neu, auch wenn sich nichts geändert hat.
