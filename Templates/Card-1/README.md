# Card-1 – Zeichenkarte

Die Vorderseite zeigt die Bedeutung. Man zeichnet das Kanji, geführt Strich für Strich oder frei. Die Rückseite bewertet und zeigt Info, Radikal-Baum, Schreibfehler und Strichfolge.

Allgemeines zu Aufbau, Speicher und gemeinsamen Blöcken steht in [../README.md](../README.md). Die Zeilennummern gelten für Commit `46fc277`, die Suchbegriffe sind verlässlicher.

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
| 1483–4281 | Landschaften (~207 KB SVG): Tag-/Nachtebenen 1486/1512, Szenen `neutral` 1565, `warm` 1943, `cool` 2280, `sepia` 2547, `rose` 2792, `sage` 3121, `hokkaido` 3407, `tokyo` 3728, `okinawa` 3980, Glühwürmchen 4226 | `.forest-scenery`, `jp-scene-<theme>` |
| 4282 | Kartentitel | `.card-title` (`{{Bedeutung}}`) |
| 4285–4328 | Neon-Filter (Desktop/Android und WebKit-lite) | `#neon-defs` |
| 4329–4375 | Zeichenfläche: Raster, Referenzpfade, Canvas (AnkiMobile), Zeichenebene, Touch-Schild, Banner | `.kanji-container`, `#grid-bg`, `#svg-bg` (`{{SVGPfade}}`), `#draw-canvas`, `#draw-layer`, `#touch-shield`, `#legacy-gesture-warning`, `#addon-hint` |
| 4376–4406 | Aktionsknöpfe | `#button-reveal`, `#button-undo`, `#button-skip`, `#button-reset` |
| 4407–4411 | Aufdeck-Ersatz (Plattformen ohne `pycmd`) | `#answer-fallback` |
| 4412–6172 | Audio-Engine (**generiert**, siehe [../README.md](../README.md#audio-engine-kd-audio-engine)) | `[KD-AUDIO-ENGINE]` |

### Haupt-Skript (6173–9287)

| Zeilen | Abschnitt (Suchbegriff) | Wichtigste Namen |
|---|---|---|
| 6195–6246 | `AnkiWeb / Browser Detection [SHARED]` | `_applyAwSize`, `_measureAwBar` |
| 6247–6268 | `AnkiDroid Legacy swipe-gesture warning` | `#legacy-gesture-warning` |
| 6269–6285 | `Anki Desktop: addon-missing hint` | `#addon-hint` |
| 6286–6294 | `Anti-Flicker [SHARED]` | – |
| 6295–6352 | `Persistence Layer [SHARED]` | `_parseCookies`, `safeGetItem`, `safeSetItem`, `_fc` (Cookie schreiben), `pycmd('kdp:…')` |
| 6353–6646 | `Settings UI [SHARED]` | `scopedGet`, `hostGet`, `switchSettingsTab`, `_initModalScrollbars` (eigene Scrollleiste), `navigateToPage`, `navigateBack`, `refreshSettingsRadios`, `updateModeDisabledSettings`, `getGlobalConfig` |
| 6647–6728 | Farbdefinitionen | `_accentColors`, `_primaryColors`, Strichfarben |
| 6729–6771 | Zufalls-Landschaft, verzögerte Theme-Kontrolle | `_rollRandomTheme`, `_scheduleDeferredThemeCheck` |
| 6772–7011 | `applyThemeSettings`: 1. Hell/Dunkel, 2. Akzent, 2b. Landschaft, 2c. Strichfarbe, 2d. Strichstil, 3. Schriftgröße, 4./5. Qt-Hintergrund | – |
| 7012–7023 | Theme-Einstellung speichern | `updateThemeSetting` |
| 7024–7100 | `Klang & Musik: Bridge zur Audio-Engine [SHARED]` | `_kdSnd`, `_kdSoundConf`, `applySoundSettings`, `updateSoundSetting`, UI-Klang-Delegation (`_kdSndUiBound`) |
| 7101–7184 | `Grid Rendering [SHARED]`, Funktionsschalter | `updateGridDisplay`, `updateGridSetting`, `updateFeatureSetting` |
| 7185–7238 | Einstellungen öffnen/schließen | `openSettings`, `closeSettings` |
| 7239–7368 | Abwehr von Ankis Nachtmodus-Umschaltung, MediaQuery, bfcache | `_kanjiThemeObserver`, `_kanjiMQHandler`, `_kanjiPagesShowHandler` |
| 7369–7461 | `Scroll Lock & iOS Detection [SHARED]` | `kanjiTouchMoveModalHandler`, `kanjiTouchStartHandler`, `checkScrollability` |
| 7462–7473 | `Cleanup stale DOM` | – |
| 7474–7562 | `Shared Scoring Algorithms` | `window._kanjiAlgo` (`resamplePoints`, `discreteFrechet`, `smoothInput`, `hungarianMatch`) |
| 7563–8130 | `Drawing Engine` – Zustand und Hilfsfunktionen | `getCSSVar` 7615, `updateStartMarker` 7653, `saveState` 7687, `triggerAutoFlip` 7707, `clearDrawLayer` 7749, Strichstil-/breite 7759, Canvas (AnkiMobile) 7779–7831, `applyPathStyle` 7840, `_addGelHaloToPath` 7882, `snapToReference` 7928, `getMousePos` 7980, `playCompletionAnimation` 7992, `avgPointDist`/`segmentAngles` 8113 |
| 8131–8470 | `HANDLER DEFINITIONS` | `startDrawing` 8137, `_renderCanvasFrame` 8205, `draw` 8242, `stopDrawing` 8270, **`evaluateStroke` 8309** (Bewertung geführter Modus), `saveFreeStrokes` 8462 |
| 8471–8556 | `EVENT WIRING` | Pointer-/Touch-Listener auf `#draw-layer` bzw. `#touch-shield`, `_kanjiDrawCleanup` |
| 8557–8917 | `BUTTON ACTIONS` | `revealAction`, `guidedResetAction` (Rückspul-Animation), `guidedSkipAction`, `freeUndoAction`, `freeResetAction`, `bindModeButtons` |
| 8918–8949 | `MODE SWITCHING` | `_kanjiSwitchDrawMode` |
| 8950–8994 | `Button Feedback & Stylus Fixes [SHARED]` | – |
| 8995–9037 | `Stroke-Order Replay Overlay [SHARED]` | `addPenHandler` |
| 9038–9179 | `Scroll Guards & AnkiMobile Tappable Isolation [SHARED]` | `_kanjiSetupModalTouchGuards` |
| 9180–9227 | `Apple Pencil: pen-to-click for modal controls [SHARED]` | – |
| 9228–9240 | `S-Pen / Stylus: backdrop-close verification [SHARED]` | `_trackBg` |
| 9241–9282 | `Global S-Pen defense [SHARED]` | `_kanjiGlobalPenDefenseAdded`, `.spen-hover` |
| 9283–9287 | AnkiDroid/AnkiMobile-Gesten | `userJs1`–`userJs3` (extern aufgerufen) |

## BackTemplate.html

| Zeilen | Abschnitt (Suchbegriff) | Wichtigste Namen |
|---|---|---|
| 1 | Anki-Überblendung aus | `aFade`, `qFade` |
| 2–99 | Statische Anti-Flacker-Regeln | `<style id="kanji-anti-flicker">` |
| 100–136 | Strichfarben vor dem Einbinden der Vorderseite (aus `kanjiErrors`) | `_ck` |
| 137–140 | Marker, Antwort, Vorderseite | `#is-back-side-marker`, `#answer`, `{{FrontSide}}` |
| 142–151 | Info-Knopf | `.back-actions`, `openInfoModal` |
| 152–409 | Info-Overlay: Übersicht (Tags, Baum, Wortbeispiele, Lesungen), Strichfolge, Schreibfehler | `#info-overlay`, `#info-page-main` 155, `#raw-tree-data` 187, `#raw-pitfalls-data` 195, `#info-page-order` 346, `#info-page-pitfalls` 384 |
| 410–674 | Kopf, Dunkel-Helfer, Info-Modal-Navigation | `_kanjiIsDark` 423, `safeGetState`, `openInfoModal`, `navigateInfoToOrder`, `navigateInfoToPitfalls`, `navigateInfoBack`, `closeInfoModal` |
| 675–1053 | `Primitive Tree (Kanji-Study style) [SHARED]` – Parser und Layout | `_kanjiRenderPrimitiveTree` |
| 1054–1772 | `Interactive +/- Zoom, Fullscreen & Focus-Gated Pan` | Zoom, Vollbild, Doppeltipp-Navigation |
| 1773–1804 | `Radical Tree Renderer [SHARED]` – Aufruf | `_kanjiTreeOutsideHandler` |
| 1805–2108 | `Pitfalls ("Häufige Schreibfehler" …) [SHARED]` | `_kanjiRenderPitfalls` |
| 2109–2151 | `Word Examples (furigana toggle)`, `Hide "Lesungen"` `[SHARED]` | – |
| 2152–2442 | `Back Side Features` – gemeinsame Helfer | `addNumbersGPAL` 2163 (Strichnummern mit Kollisionsvermeidung), `makeStrokePath` 2213 |
| 2443–2588 | Strichfarben und -nummern der Rückseite | `applyBackFeatures` |
| 2589–2965 | `FREE MODE: Evaluation …` – Auswertung (Zuordnung per Ungarischer Methode, harte Grenzen), Morph-Helfer | `_morphResample`, `_morphLabelPos`, `_morphColAdj`, `window._kanjiFreeEval` |
| 2885–3437 | `renderFreeView`: `HANDWRITING VIEW` 2966, `SVG-PFADE VIEW` 3042, Morph WebKit (SMIL) 3197, Morph Desktop/Android 3308 | `window._kanjiRenderFreeView` |
| 3448–3823 | `Quicksettings toggle button (Handschrift ↔ SVG-Pfade)` inkl. Rück-Morph | – |
| 3824–3843 | Einstellungen live anwenden | `window.kanjiSettingsGlobalHandler` |
| 3844–3977 | `Stroke-Order Player [SHARED]` | `window._kanjiOrder` (`open`, `close`, `action`), `openStrokeOrder`, `strokeOrderAction` |
| 3978–4070 | `Cross-Platform Fixes [SHARED]` | Link-Knöpfe, `addPenHandler` |
| 4071–4164 | S-Pen: Hintergrund-Prüfung und globale Abwehr | `_trackBg`, `_kanjiGlobalPenDefenseAdded` |
| 4165–4189 | Scroll-Neusynchronisierung nach Rückkehr aus Safari | `resyncModalScroll`, `_kanjiModalScrollResyncAdded` |

## Befunde aus dem Code-Review (Stand `46fc277`)

**Gut gelöst**
- Alle globalen `window`/`document`-Listener sind gegen Mehrfachbindung über Kartenwechsel geschützt, entweder durch Entfernen vor dem Neu-Anmelden oder durch ein Flag.
- Der `MutationObserver` wird vor dem Neuanlegen getrennt. Die Zeichenfläche cacht `getBoundingClientRect` und rendert per `requestAnimationFrame`.

**Redundanter Code (nicht durch Anki bedingt)**
1. **Vier Morph-Animationen in der Rückseite.** Rund 600 Zeilen mit fast gleicher Logik:
   - WebKit vorwärts (3197–3307) und Desktop vorwärts (3308–3437).
   - Desktop rückwärts und WebKit rückwärts (im Umschalter 3448–3823).
   - Vorschlag: eine Funktion `runMorph(pairs, {reverse, smil})`.
2. **Sieben getrennte „Scratch-SVG“-Helfer für `getTotalLength()`.** Rückseite 764, 2591, 2656, 3195, 3304, 3486, 3646. Ein gemeinsamer Helfer `withScratchSvg(fn)` reicht.
3. **Die Dunkelmodus-Prüfung steht siebenmal ausgeschrieben** (`classList.contains('nightMode') || … 'night_mode' …`), obwohl `window._kanjiIsDark()` (Rückseite 423) existiert. Gehört als gemeinsamer Helfer in die Vorderseite.
4. **Der Strichbreiten-Faktor ist mehrfach berechnet.** `thin ? 0.7 : thick ? 1.4 : 1` steht dreifach im Code, obwohl `_swf` (7760) existiert.
5. **Der „Klick schlucken“-Block** (`var _eatHandler = function …`) steht in jedem Template zweimal. Er sollte in eine gemeinsame Funktion `eatNextClick()`.
6. **`avgPointDist` und `segmentAngles`** (8113, 8121) liegen lokal in der Zeichen-Engine statt in `window._kanjiAlgo`. Die Tests pflegen dazu eigene Kopien (siehe [../../Tests/README.md](../../Tests/README.md)).

**Dead Code**
7. `window._kanjiGetStrokeWidthFactor` (7761) wird gesetzt, aber nirgends gelesen.
8. In der Audio-Engine (Quelle außerhalb des Repos):
   - `MODAL.kalimba` und `CH.ms11` werden nie benutzt.
   - Die Szenenfelder `lastMel` und `motif` werden nur angelegt.
   - In `zenBar` wird `cl`/`s.hiVoice` berechnet, aber nie verwendet.

**Performance**
9. **Die Landschaften** (1483–4281) werden auf Vorder- und Rückseite komplett geparst. Vorschlag siehe [../README.md](../README.md#befunde-aus-dem-code-review-stand-46fc277).
10. **`applyThemeSettings` läuft pro Karte mindestens einmal komplett durch.** Beim Laden, nach dem Schließen der Einstellungen und bei Nachtmodus-Wechseln setzt es alle Referenzpfade zurück und stylt sie neu (Strichstil, Filter, Halos). Bei unverändertem Stil ließe sich der Durchlauf überspringen, z. B. mit einem Schlüssel aus Stil, Farbe, Breite und Dunkelmodus.
