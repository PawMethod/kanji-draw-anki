# Card-1 – Zeichenkarte

Die Vorderseite zeigt die Bedeutung. Man zeichnet das Kanji, geführt Strich für Strich oder frei. Die Rückseite bewertet und zeigt Info, Radikal-Baum, Schreibfehler und Strichfolge.

Allgemeines zu Aufbau, Speicher und gemeinsamen Blöcken steht in [../README.md](../README.md). Die Zeilennummern gelten für den Stand dieses Commits; nach Änderungen verschieben sie sich. Die Suchbegriffe bleiben gültig.

## FrontTemplate.html

### HTML

| Zeilen | Abschnitt | Suchbegriff / IDs |
|---|---|---|
| 1–38 | Theme-Vorauswahl vor dem ersten Paint, gecachte Palette, Einblenden der Karte `[SHARED]` | `_kdPreRoll`, `kdPal:`, `kd-enter` |
| 39–47 | Zahnrad-Knopf | `.gear-btn`, `openSettings` |
| 48–1480 | Einstellungs-Overlay | `#settings-overlay` |
| 52–198 | ‑ Übersicht (Kategoriekarten, Segment C1/C2) | `#settings-main` |
| 200–326 | ‑ Hilfslinien | `#page-grid` |
| 328–530 | ‑ Vorderseite (nur C1) | `#page-front` |
| 532–678 | ‑ Rückseite | `#page-back` |
| 680–757 | ‑ Vorderseite Erkennen (nur C2, hier ausgeblendet) | `#page-front-c2` |
| 759–1186 | ‑ Erscheinungsbild (Hell/Dunkel, Akzent, Landschaft, Strichfarbe/-stil/-breite, Schrift, Hand) | `#page-theme` |
| 1187–1479 | ‑ Klang & Musik (**generiert**) | `[KD-SOUND-PAGE]`, `#page-sound` |
| 1483–4281 | Landschaften (~207 KB SVG): Tag-/Nachtebenen 1486/1512, Szenen `neutral` 1565, `warm` 1943, `cool` 2280, `sepia` 2547, `rose` 2792, `sage` 3121, `hokkaido` 3407, `tokyo` 3728, `okinawa` 3980, Glühwürmchen 4225 | `.forest-scenery`, `jp-scene-<theme>` |
| 4282 | Kartentitel | `.card-title` (`{{Bedeutung}}`) |
| 4285–4328 | Neon-Filter (Desktop/Android und WebKit-lite) | `#neon-defs` |
| 4329–4375 | Zeichenfläche: Raster, Referenzpfade, Canvas (AnkiMobile), Zeichenebene, Touch-Schild, Banner | `.kanji-container`, `#grid-bg`, `#svg-bg` (`{{SVGPfade}}`), `#draw-canvas`, `#draw-layer`, `#touch-shield`, `#legacy-gesture-warning`, `#addon-hint` |
| 4376–4406 | Aktionsknöpfe | `#button-reveal`, `#button-undo`, `#button-skip`, `#button-reset` |
| 4407–4411 | Aufdeck-Ersatz (Plattformen ohne `pycmd`) | `#answer-fallback` |
| 4412–6171 | Audio-Engine (**generiert**, siehe [../README.md](../README.md#audio-engine-kd-audio-engine)) | `[KD-AUDIO-ENGINE]` |

### Haupt-Skript (6172–9306)

| Zeilen | Abschnitt (Suchbegriff) | Wichtigste Namen |
|---|---|---|
| 6194–6245 | `AnkiWeb / Browser Detection [SHARED]` | `_applyAwSize`, `_measureAwBar` |
| 6246–6267 | `AnkiDroid Legacy swipe-gesture warning` | `#legacy-gesture-warning` |
| 6268–6284 | `Anki Desktop: addon-missing hint` | `#addon-hint` |
| 6285–6293 | `Anti-Flicker [SHARED]` | – |
| 6294–6347 | `Persistence Layer [SHARED]` | `_parseCookies`, `_kCookieObj`, `safeGetItem`, `safeSetItem`, `_fc` (Cookie sichern), `pycmd('kdp:…')` |
| 6348–6405 | **`Shared helpers [SHARED]`** – auch für die Rückseite | `_kanjiIsDark`, `_kanjiSwFactor` (Strichbreite), `_kanjiGelColor`, `_kanjiMakeGelHalo`, `_kanjiEatNextClick` (Stift-Geisterklick schlucken) |
| 6406–6699 | `Settings UI [SHARED]` | `scopedGet`, `hostGet`, `switchSettingsTab`, `_initModalScrollbars` (eigene Scrollleiste), `navigateToPage`, `navigateBack`, `refreshSettingsRadios`, `updateModeDisabledSettings`, `getGlobalConfig` |
| 6700–6781 | Farbdefinitionen | `_accentColors`, `_primaryColors`, Strichfarben |
| 6782–6824 | Zufalls-Landschaft, verzögerte Theme-Kontrolle | `_rollRandomTheme`, `_scheduleDeferredThemeCheck` |
| 6825–7064 | `applyThemeSettings`: 1. Hell/Dunkel, 2. Akzent, 2b. Landschaft, 2c. Strichfarbe, 2d. Strichstil, 3. Schriftgröße, 4./5. Qt-Hintergrund | – |
| 7065–7076 | Theme-Einstellung speichern | `updateThemeSetting` |
| 7077–7153 | `Klang & Musik: Bridge zur Audio-Engine [SHARED]` | `_kdSnd`, `_kdSoundConf`, `applySoundSettings`, `updateSoundSetting`, UI-Klang-Delegation (`_kdSndUiBound`) |
| 7154–7237 | `Grid Rendering [SHARED]`, Funktionsschalter | `updateGridDisplay`, `updateGridSetting`, `updateFeatureSetting` |
| 7238–7291 | Einstellungen öffnen/schließen | `openSettings`, `closeSettings` |
| 7292–7421 | Abwehr von Ankis Nachtmodus-Umschaltung, MediaQuery, bfcache | `_kanjiThemeObserver`, `_kanjiMQHandler`, `_kanjiPagesShowHandler` |
| 7422–7514 | `Scroll Lock & iOS Detection [SHARED]` | `kanjiTouchMoveModalHandler`, `kanjiTouchStartHandler`, `checkScrollability` |
| 7515–7526 | `Cleanup stale DOM` | – |
| 7527–7630 | `Shared Scoring Algorithms` | `window._kanjiAlgo` (`resamplePoints`, `discreteFrechet`, `smoothInput`, `hungarianMatch`, `avgPointDist`, `segmentAngles`) – auch von den Tests geladen |
| 7631–8161 | `Drawing Engine` – Zustand und Hilfsfunktionen | `getCSSVar` 7683, `updateStartMarker` 7721, `saveState` 7755, `triggerAutoFlip` 7775, `clearDrawLayer` 7817, Strichstil/-breite 7827, Canvas (AnkiMobile) 7846, `applyPathStyle` 7907, `_addGelHaloToPath` 7949, `snapToReference` 7975, `getMousePos` 8027, `playCompletionAnimation` 8039 |
| 8162–8501 | `HANDLER DEFINITIONS` | `startDrawing` 8168, `_renderCanvasFrame` 8236, `draw` 8273, `stopDrawing` 8301, **`evaluateStroke` 8340** (Bewertung geführter Modus), `saveFreeStrokes` 8493 |
| 8502–8587 | `EVENT WIRING` | Pointer-/Touch-Listener auf `#draw-layer` bzw. `#touch-shield`, `_kanjiDrawCleanup` 8561 |
| 8588–8948 | `BUTTON ACTIONS` | `revealAction`, `guidedResetAction` (Rückspul-Animation), `guidedSkipAction`, `freeUndoAction`, `freeResetAction`, `bindModeButtons` |
| 8949–8980 | `MODE SWITCHING` | `_kanjiSwitchDrawMode` |
| 8981–9025 | `Button Feedback & Stylus Fixes [SHARED]` | – |
| 9026–9062 | `Stroke-Order Replay Overlay [SHARED]` | `addPenHandler` |
| 9063–9204 | `Scroll Guards & AnkiMobile Tappable Isolation [SHARED]` | `_kanjiSetupModalTouchGuards` |
| 9205–9246 | `Apple Pencil: pen-to-click for modal controls [SHARED]` | – |
| 9247–9259 | `S-Pen / Stylus: backdrop-close verification [SHARED]` | `_trackBg` |
| 9260–9301 | `Global S-Pen defense [SHARED]` | `_kanjiGlobalPenDefenseAdded`, `.spen-hover` |
| 9302–9306 | AnkiDroid/AnkiMobile-Gesten | `userJs1`–`userJs3` (extern aufgerufen) |

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
| 666–1044 | `Primitive Tree (Kanji-Study style) [SHARED]` – Parser und Layout | `_kanjiRenderPrimitiveTree` |
| 1045–1763 | `Interactive +/- Zoom, Fullscreen & Focus-Gated Pan` | Zoom, Vollbild, Doppeltipp-Navigation |
| 1764–1795 | `Radical Tree Renderer [SHARED]` – Aufruf | `_kanjiTreeOutsideHandler` |
| 1796–2098 | `Pitfalls ("Häufige Schreibfehler" …) [SHARED]` | `_kanjiRenderPitfalls` |
| 2099–2141 | `Word Examples (furigana toggle)`, `Hide "Lesungen"` `[SHARED]` | – |
| 2142–2429 | `Back Side Features` – gemeinsame Helfer | `addNumbersGPAL` 2153 (Strichnummern mit Kollisionsvermeidung), `makeStrokePath` 2200 |
| 2430–2576 | Strichfarben und -nummern der Rückseite | `applyBackFeatures` |
| 2577–2880 | `FREE MODE: Evaluation …` – Auswertung (Zuordnung per Ungarischer Methode, harte Grenzen), Morph-Helfer | `_newScratchSvg` 2585, `_morphResample`, `_morphLabelPos`, `_morphColAdj`, `window._kanjiFreeEval` 2876 |
| 2881–3432 | `renderFreeView`: `HANDWRITING VIEW` 2959, `SVG-PFADE VIEW` 3035, Morph WebKit (SMIL) 3190, Morph Desktop/Android 3297 | `window._kanjiRenderFreeView` |
| 3433–3801 | `Quicksettings toggle button (Handschrift ↔ SVG-Pfade)` inkl. Rück-Morph | – |
| 3802–3820 | Einstellungen live anwenden | `window.kanjiSettingsGlobalHandler` |
| 3821–3954 | `Stroke-Order Player [SHARED]` | `window._kanjiOrder` (`open`, `close`, `action`), `openStrokeOrder`, `strokeOrderAction` |
| 3955–4041 | `Cross-Platform Fixes [SHARED]` | Link-Knöpfe, `addPenHandler` |
| 4042–4135 | S-Pen: Hintergrund-Prüfung und globale Abwehr | `_trackBg`, `_kanjiGlobalPenDefenseAdded` |
| 4136–4159 | Scroll-Neusynchronisierung nach Rückkehr aus Safari | `resyncModalScroll`, `_kanjiModalScrollResyncAdded` |

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
2. Die Landschaften (1483–4281) werden auf Vorder- und Rückseite komplett geparst. Siehe [../README.md](../README.md#code-review-stand).
3. `applyThemeSettings` stylt bei jedem Lauf alle Referenzpfade neu, auch wenn sich nichts geändert hat.
