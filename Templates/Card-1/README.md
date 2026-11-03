# Card-1 – Zeichenkarte

Die Vorderseite zeigt die Bedeutung. Man zeichnet das Kanji, geführt Strich für Strich oder frei. Die Rückseite bewertet und zeigt Info, Radikal-Baum, Schreibfehler und Strichfolge.

Allgemeines zu Aufbau, Speicher und gemeinsamen Blöcken steht in [../README.md](../README.md). Mit ← markierte Abschnitte werden von `python3 Tools/build.py` aus `Templates/src/` eingesetzt und dort bearbeitet. Die Zeilennummern gelten für den Stand dieses Commits; nach Änderungen verschieben sie sich. Die Suchbegriffe bleiben gültig.

## FrontTemplate.html

### HTML

| Zeilen | Abschnitt | Suchbegriff / IDs |
|---|---|---|
| 1–38 | Theme-Vorauswahl vor dem ersten Paint, gecachte Palette, Einblenden der Karte `[SHARED]` | `_kdPreRoll`, `kdPal:`, `kd-enter` |
| 39–47 | Zahnrad-Knopf | `.gear-btn`, `openSettings` |
| 48–1579 | Einstellungs-Overlay | `#settings-overlay` |
| 52–205 | ‑ Übersicht (Kategoriekarten, Segment C1/C2) | `#settings-main` |
| 207–333 | ‑ Hilfslinien | `#page-grid` |
| 335–565 | ‑ Vorderseite (nur C1) | `#page-front` |
| 567–713 | ‑ Rückseite | `#page-back` |
| 715–792 | ‑ Vorderseite Erkennen (nur C2, hier ausgeblendet) | `#page-front-c2` |
| 794–1221 | ‑ Erscheinungsbild (Hell/Dunkel, Akzent, Landschaft, Strichfarbe/-stil/-breite, Schrift, Hand) | `#page-theme` |
| 1222–1514 | ‑ Klang & Musik (**generiert**) | `[KD-SOUND-PAGE]`, `#page-sound` |
| 1515–1578 | ‑ Danke (**generiert**, Herz oben rechts in der Übersicht) ← [src/front/page-about.html](../src/front/page-about.html) | `#page-about`, `.settings-about-btn` |
| 1582–4380 | Landschaften (~207 KB SVG): Tag-/Nachtebenen 1585/1611, Szenen `neutral` 1664, `warm` 2042, `cool` 2379, `sepia` 2646, `rose` 2891, `sage` 3220, `hokkaido` 3506, `tokyo` 3827, `okinawa` 4079, Glühwürmchen 4324 | `.forest-scenery`, `jp-scene-<theme>` |
| 4381 | Kartentitel | `.card-title` (`{{Bedeutung}}`) |
| 4384–4427 | Neon-Filter (Desktop/Android und WebKit-lite) | `#neon-defs` |
| 4428–4481 | Zeichenfläche: Raster, Referenzpfade, Canvas (AnkiMobile), Zeichenebene, Touch-Schild, Banner | `.kanji-container`, `#grid-bg`, `#svg-bg` (`{{SVGPfade}}`), `#draw-canvas`, `#draw-layer`, `#touch-shield`, `#legacy-gesture-warning`, `#addon-hint` |
| 4482–4512 | Aktionsknöpfe | `#button-reveal`, `#button-undo`, `#button-skip`, `#button-reset` |
| 4513–4517 | Aufdeck-Ersatz (Plattformen ohne `pycmd`) | `#answer-fallback` |
| 4518–6593 | Audio-Engine (**generiert**, siehe [../README.md](../README.md#audio-engine-kd-audio-engine)) | `[KD-AUDIO-ENGINE]` |

### Haupt-Skript (6594–9768)

| Zeilen | Abschnitt (Suchbegriff) | Wichtigste Namen |
|---|---|---|
| 6616–6667 | `AnkiWeb / Browser Detection [SHARED]` | `_applyAwSize`, `_measureAwBar` |
| 6668–6689 | `AnkiDroid Legacy swipe-gesture warning` | `#legacy-gesture-warning` |
| 6690–6706 | `Anki Desktop: addon-missing hint` | `#addon-hint` |
| 6707–6715 | `Anti-Flicker [SHARED]` | – |
| 6716–6770 | `Persistence Layer` ← [src/front/persistence.js](../src/front/persistence.js) | `_parseCookies`, `_kCookieObj`, `safeGetItem`, `safeSetItem`, `_fc` (Cookie sichern), `pycmd('kdp:…')` |
| 6772–6831 | **`Shared helpers`** ← [src/front/shared-helpers.js](../src/front/shared-helpers.js) – auch für die Rückseite | `_kanjiIsDark`, `_kanjiSwFactor` (Strichbreite), `_kanjiGelColor`, `_kanjiMakeGelHalo`, `_kanjiEatNextClick` (Stift-Geisterklick schlucken) |
| 6832–7131 | `Settings UI [SHARED]` | `scopedGet`, `hostGet`, `switchSettingsTab`, `_initModalScrollbars` (eigene Scrollleiste), `navigateToPage`, `navigateBack`, `refreshSettingsRadios`, `updateModeDisabledSettings`, `getGlobalConfig` |
| 7132–7213 | Farbdefinitionen | `_accentColors`, `_primaryColors`, Strichfarben |
| 7214–7256 | Zufalls-Landschaft, verzögerte Theme-Kontrolle | `_rollRandomTheme`, `_scheduleDeferredThemeCheck` |
| 7257–7496 | `applyThemeSettings`: 1. Hell/Dunkel, 2. Akzent, 2b. Landschaft, 2c. Strichfarbe, 2d. Strichstil, 3. Schriftgröße, 4./5. Qt-Hintergrund | – |
| 7497–7508 | Theme-Einstellung speichern | `updateThemeSetting` |
| 7509–7586 | `Klang & Musik: Bridge zur Audio-Engine` ← [src/front/sound-bridge.js](../src/front/sound-bridge.js) | `_kdSnd`, `_kdSoundConf`, `applySoundSettings`, `updateSoundSetting`, UI-Klang-Delegation (`_kdSndUiBound`) |
| 7588–7673 | `Grid Rendering` ← [src/front/grid-display.js](../src/front/grid-display.js), danach Funktionsschalter | `updateGridDisplay`, `updateGridSetting`, `updateFeatureSetting` |
| 7674–7727 | Einstellungen öffnen/schließen | `openSettings`, `closeSettings` |
| 7728–7857 | Abwehr von Ankis Nachtmodus-Umschaltung, MediaQuery, bfcache | `_kanjiThemeObserver`, `_kanjiMQHandler`, `_kanjiPagesShowHandler` |
| 7858–7950 | `Scroll Lock & iOS Detection [SHARED]` | `kanjiTouchMoveModalHandler`, `kanjiTouchStartHandler`, `checkScrollability` |
| 7951–7962 | `Cleanup stale DOM` | – |
| 7963–8066 | `Shared Scoring Algorithms` | `window._kanjiAlgo` (`resamplePoints`, `discreteFrechet`, `smoothInput`, `hungarianMatch`, `avgPointDist`, `segmentAngles`) – auch von den Tests geladen |
| 8067–8617 | `Drawing Engine` – Zustand und Hilfsfunktionen | `getCSSVar` 8119, `updateStartMarker` 8165, `saveState` 8211, `triggerAutoFlip` 8231, `clearDrawLayer` 8273, Strichstil/-breite 8283, Canvas (AnkiMobile) 8302, `applyPathStyle` 8363, `_addGelHaloToPath` 8405, `snapToReference` 8431, `getMousePos` 8483, `playCompletionAnimation` 8495 |
| 8618–8960 | `HANDLER DEFINITIONS` | `startDrawing` 8624, `_renderCanvasFrame` 8693, `draw` 8730, `stopDrawing` 8758, **`evaluateStroke` 8799** (Bewertung geführter Modus), `saveFreeStrokes` 8952 |
| 8961–9048 | `EVENT WIRING` | Pointer-/Touch-Listener auf `#draw-layer` bzw. `#touch-shield`, `_kanjiDrawCleanup` 9021 |
| 9049–9409 | `BUTTON ACTIONS` | `revealAction`, `guidedResetAction` (Rückspul-Animation), `guidedSkipAction`, `freeUndoAction`, `freeResetAction`, `bindModeButtons` |
| 9410–9441 | `MODE SWITCHING` | `_kanjiSwitchDrawMode` |
| 9442–9486 | `Button Feedback & Stylus Fixes [SHARED]` | – |
| 9487–9523 | `Stroke-Order Replay Overlay [SHARED]` | `addPenHandler` |
| 9524–9666 | `Scroll Guards & AnkiMobile Tappable Isolation` ← [src/front/scroll-guards.js](../src/front/scroll-guards.js) | `_kanjiSetupModalTouchGuards` |
| 9668–9709 | `Apple Pencil: pen-to-click for modal controls [SHARED]` | – |
| 9710–9722 | `S-Pen / Stylus: backdrop-close verification [SHARED]` | `_trackBg` |
| 9723–9764 | `Global S-Pen defense [SHARED]` | `_kanjiGlobalPenDefenseAdded`, `.spen-hover` |
| 9765–9768 | AnkiDroid/AnkiMobile-Gesten | `userJs1`–`userJs3` (extern aufgerufen) |

## BackTemplate.html

| Zeilen | Abschnitt (Suchbegriff) | Wichtigste Namen |
|---|---|---|
| 1 | Anki-Überblendung aus | `aFade`, `qFade` |
| 2–99 | Statische Anti-Flacker-Regeln | `<style id="kanji-anti-flicker">` |
| 100–136 | Strichfarben vor dem Einbinden der Vorderseite (aus `kanjiErrors`) | `_ck` |
| 137–140 | Marker, Antwort, Vorderseite | `#is-back-side-marker`, `#answer`, `{{FrontSide}}` |
| 142–151 | Info-Knopf | `.back-actions`, `openInfoModal` |
| 152–412 | Info-Overlay: Übersicht (Tags, Baum, Wortbeispiele, Lesungen), Strichfolge, Schreibfehler | `#info-overlay`, `#info-page-main` 155, `#raw-tree-data` 190, `#raw-pitfalls-data` 198, `#info-page-order` 349, `#info-page-pitfalls` 387 |
| 413–668 | Kopf, Schrift/Strichstil der Rückseite, Info-Modal-Navigation | `safeGetState`, `openInfoModal`, `navigateInfoToOrder`, `navigateInfoToPitfalls`, `navigateInfoBack`, `closeInfoModal` |
| 669–1048 | `Primitive Tree (Kanji-Study style)` ← [src/back/primitive-tree.js](../src/back/primitive-tree.js) – Parser, Layout, Zoom, Vollbild | `_kanjiRenderPrimitiveTree` |
| 1049–1772 | `Interactive +/- Zoom, Fullscreen & Focus-Gated Pan` | Zoom, Vollbild, Doppeltipp-Navigation |
| 1774–1806 | `Radical Tree Renderer` ← [src/back/radical-tree.js](../src/back/radical-tree.js) – Aufruf | `_kanjiTreeOutsideHandler` |
| 1808–2114 | `Pitfalls ("Häufige Schreibfehler" …)` ← [src/back/pitfalls.js](../src/back/pitfalls.js) | `_kanjiRenderPitfalls` |
| 2115–2162 | `Word Examples (furigana toggle)`, `Hide "Lesungen"` ← [src/back/word-examples.js](../src/back/word-examples.js), [src/back/hide-readings.js](../src/back/hide-readings.js) | – |
| 2164–2451 | `Back Side Features` – gemeinsame Helfer | `addNumbersGPAL` 2175 (Strichnummern mit Kollisionsvermeidung), `makeStrokePath` 2222 |
| 2452–2598 | Strichfarben und -nummern der Rückseite | `applyBackFeatures` |
| 2599–2902 | `FREE MODE: Evaluation …` – Auswertung (Zuordnung per Ungarischer Methode, harte Grenzen), Morph-Helfer | `_newScratchSvg` 2607, `_morphResample`, `_morphLabelPos`, `_morphColAdj`, `window._kanjiFreeEval` 2898 |
| 2903–3454 | `renderFreeView`: `HANDWRITING VIEW` 2981, `SVG-PFADE VIEW` 3057, Morph WebKit (SMIL) 3212, Morph Desktop/Android 3319 | `window._kanjiRenderFreeView` |
| 3455–3823 | `Quicksettings toggle button (Handschrift ↔ SVG-Pfade)` inkl. Rück-Morph | – |
| 3824–3842 | Einstellungen live anwenden | `window.kanjiSettingsGlobalHandler` |
| 3843–3977 | `Stroke-Order Player` ← [src/back/stroke-order-player.js](../src/back/stroke-order-player.js) | `window._kanjiOrder` (`open`, `close`, `action`), `openStrokeOrder`, `strokeOrderAction` |
| 3979–4066 | `Cross-Platform Fixes` ← [src/back/cross-platform.js](../src/back/cross-platform.js) | Link-Knöpfe, `addPenHandler` |
| 4067–4160 | S-Pen: Hintergrund-Prüfung und globale Abwehr | `_trackBg`, `_kanjiGlobalPenDefenseAdded` |
| 4161–4184 | Scroll-Neusynchronisierung nach Rückkehr aus Safari | `resyncModalScroll`, `_kanjiModalScrollResyncAdded` |

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
2. Die Landschaften (1582–4380) werden auf Vorder- und Rückseite komplett geparst. Siehe [../README.md](../README.md#code-review-stand).
3. `applyThemeSettings` stylt bei jedem Lauf alle Referenzpfade neu, auch wenn sich nichts geändert hat.
