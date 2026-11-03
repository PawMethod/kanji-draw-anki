# Card-2 – Erkennungskarte

Die Vorderseite zeigt das fertige Kanji mit allen Strichen: optional nummeriert, nach Strichfolge eingefärbt oder im gewählten Strichstil. Gefragt ist die Bedeutung. Gezeichnet wird hier nicht, deshalb fehlt die Zeichen-Engine aus Card-1. Die Rückseite zeigt Info, Radikal-Baum, Schreibfehler und Strichfolge wie bei Card-1, aber ohne Freimodus-Auswertung.

Allgemeines steht in [../README.md](../README.md). Mit ← markierte Abschnitte kommen aus `Templates/src/` (eingesetzt von `python3 Tools/build.py`) und sind in beiden Karten gleich. Die Zeilennummern gelten für den Stand dieses Commits; die Suchbegriffe bleiben gültig.

## FrontTemplate.html

### HTML

| Zeilen | Abschnitt | Suchbegriff / IDs |
|---|---|---|
| 1–38 | Theme-Vorauswahl, Palette, Einblenden `[SHARED]` | `_kdPreRoll` |
| 39–48 | Zahnrad-Knopf | `.gear-btn` |
| 49–1580 | Einstellungs-Overlay, startet auf Reiter C2 (`data-tab="c2"`) | `#settings-overlay` |
| 53 / 208 / 336 / 568 / 716 / 795 | ‑ Übersicht / Hilfslinien / Vorderseite C1 (ausgeblendet) / Rückseite / **Vorderseite Erkennen** / Erscheinungsbild | `#settings-main`, `#page-grid`, `#page-front`, `#page-back`, `#page-front-c2`, `#page-theme` |
| 1223–1515 | ‑ Klang & Musik (**generiert**) | `[KD-SOUND-PAGE]` |
| 1516–1579 | ‑ Danke ← `src/front/page-about.html` | `#page-about` |
| 1583–4381 | Landschaften (identisch zu Card-1) | `.forest-scenery`, `jp-scene-<theme>` |
| 4382 | Kartentitel, versteckt | `.card-title` |
| 4385–4428 | Neon-Filter (identisch zu Card-1) | `#neon-defs` |
| 4429–4475 | Kanji-Anzeige: Raster, Referenzpfade, Banner (ohne Zeichenebene) | `#grid-bg`, `#svg-bg`, `#legacy-gesture-warning`, `#addon-hint` |
| 4476–6551 | Audio-Engine (**generiert**) | `[KD-AUDIO-ENGINE]` |

### Haupt-Skript (6552–8180)

| Zeilen | Abschnitt (Suchbegriff) | Wichtigste Namen | Gegenstück Card-1 |
|---|---|---|---|
| 6561–6608 | `AnkiWeb / Browser Detection [SHARED]` | `_applyAwSize`, `_measureAwBar` | 6616 |
| 6609–6636 | AnkiDroid-Gesten-Warnung, fehlendes Add-on | – | 6668, 6690 |
| 6637–6656 | `Anti-Flicker [SHARED]` (setzt zusätzlich `stroke-complete`) | – | 6707 |
| 6657–6711 | `Persistence Layer` ← `src/front/persistence.js` | `_kCookieObj`, `safeGetItem`, `safeSetItem`, `_fc` | 6716 |
| 6713–6773 | `Shared helpers` ← `src/front/shared-helpers.js` | `_kanjiIsDark`, `_kanjiSwFactor`, `_kanjiGelColor`, `_kanjiMakeGelHalo`, `_kanjiEatNextClick` | 6772 |
| 6774–6851 | **`Card 2 Front: apply c2f_* feature settings`** | `_addNumbersC2F`, `applyFrontFeaturesC2` (Nummern, Farbe nach Strichfolge, Anzeigestil) | – |
| 6852–7142 | `Settings UI [SHARED]` | `scopedGet`, `hostGet`, `switchSettingsTab`, `navigateToPage`, `navigateBack`, `refreshSettingsRadios`, `getGlobalConfig` 7108 | 6832 |
| 7143–7262 | Farbdefinitionen, Zufalls-Landschaft | `_rollRandomTheme` 7224, `_scheduleDeferredThemeCheck` | 7132 |
| 7263–7273 | **Gelstift-Halos für alle Striche** (alle sofort sichtbar), nutzt die gemeinsamen Helfer | `_c2AddGelHaloToPath` | `_addGelHaloToPath` 8405 |
| 7274–7486 | `applyThemeSettings`, `updateThemeSetting` 7475 | – | 7257 |
| 7487–7564 | `Klang & Musik: Bridge` ← `src/front/sound-bridge.js` | `_kdSnd`, `applySoundSettings` | 7509 |
| 7566–7656 | `Grid Rendering` ← `src/front/grid-display.js`, danach Funktionsschalter (inkl. `c2f`-Bereich) | `updateGridDisplay`, `updateFeatureSetting` 7633 | 7588 |
| 7657–7735 | Einstellungen öffnen/schließen | `openSettings`, `closeSettings` 7685 | 7674 |
| 7736–7833 | Theme-Observer, MediaQuery, `Cleanup stale DOM` (7807), bfcache | `_kanjiThemeObserver`, `_kanjiPagesShowHandler` 7821 | 7728 |
| 7834–7920 | `Scroll Lock & iOS Detection [SHARED]` | `kanjiTouchMoveModalHandler`, `kanjiTouchStartHandler`, `checkScrollability` 7875 | 7858 |
| 7921–7946 | `Button Feedback & Stylus Fixes [SHARED]` | `addPenTopBtn` | 9442 |
| 7947–8089 | `Scroll Guards & AnkiMobile Tappable Isolation` ← `src/front/scroll-guards.js` | `_kanjiSetupModalTouchGuards` | 9524 |
| 8091–8176 | Apple Pencil, S-Pen (Hintergrund, globale Abwehr) `[SHARED]` | `_trackBg`, `_kanjiGlobalPenDefenseAdded` | 9668–9764 |
| 8177–8180 | Geste für AnkiDroid/AnkiMobile | `userJs1`, `userJs3` (beide öffnen die Einstellungen; Card-1 hat `userJs1`–`3`) | 9765 |

## BackTemplate.html

| Zeilen | Abschnitt (Suchbegriff) | Wichtigste Namen | Gegenstück Card-1 |
|---|---|---|---|
| 1–34 | Überblendung aus, statische Anti-Flacker-Regeln | `#kanji-anti-flicker` | 1–99 |
| 35–69 | Strichfarben vorab, inkl. Farbe nach Strichfolge (HSL) | `_ck` | 100–136 |
| 70–84 | Marker, `{{FrontSide}}`, Info-Knopf | `#is-back-side-marker` | 137–151 |
| 85–344 | Info-Overlay (Übersicht 88, Strichfolge 281, Schreibfehler 319) | `#info-overlay` | 152–412 |
| 345–580 | Kopf, Info-Modal-Navigation | `openInfoModal` 443, `closeInfoModal` 554 | 413–668 |
| 581–1718 | `Primitive Tree` ← `src/back/primitive-tree.js` (inkl. Zoom/Vollbild), Aufruf ← `src/back/radical-tree.js` 1686 | `_kanjiRenderPrimitiveTree`, `_kanjiTreeOutsideHandler` | 669–1806 |
| 1720–2026 | `Pitfalls` ← `src/back/pitfalls.js` | `_kanjiRenderPitfalls` | 1808–2114 |
| 2027–2072 | `Word Examples`, `Hide "Lesungen"` ← `src/back/word-examples.js`, `src/back/hide-readings.js` | – | 2115–2162 |
| 2074–2267 | `Back Side Features (stroke colors, numbers, colorOrder)` | `addNumbersGPAL` 2086 (vereinfachte Version), `applyBackFeatures` 2111, `kanjiSettingsGlobalHandler` 2254 | 2164–2598, 3824 |
| 2268–2402 | `Stroke-Order Player` ← `src/back/stroke-order-player.js` | `_kanjiOrder` | 3843–3977 |
| 2404–2491 | `Cross-Platform Fixes` ← `src/back/cross-platform.js` | `addPenHandler` | 3979–4066 |
| 2492–2585 | S-Pen: Hintergrund-Prüfung, globale Abwehr | `_trackBg` | 4067–4160 |
| 2586–2609 | Scroll-Neusynchronisierung (AnkiMobile) | `resyncModalScroll` | 4161–4184 |

## Abgleich mit Card-1

**Behoben**
- Handler-Namen sind in beiden Karten jetzt gleich: `kanjiTouchMoveModalHandler`, `kanjiTouchStartHandler`, `kanjiResizeHandler`, `_kanjiTreeOutsideHandler`, `kanjiSettingsGlobalHandler`. In einer gemischten Sitzung (beide Karten im selben Fenster) bleibt so nur noch ein Handler-Satz gebunden statt zwei.
- Die Neon-Filter sind jetzt identisch zu Card-1.
- Das Zahnrad spielt jetzt auch hier die Tipp-Animation `gear-tap`.
- Info-Modal der Rückseite:
  - nutzt `_kanjiIsDark()` statt einer ausgeschriebenen Prüfung;
  - die unnötigen `typeof safeGetItem === 'function'`-Absicherungen sind entfernt.
- Der Gelstift-Halo nutzt denselben Kern wie Card-1 (`_kanjiGelColor`, `_kanjiMakeGelHalo`).

**Bewusst verschieden**
- `addNumbersGPAL` gibt es in zwei Versionen mit verschiedenen Signaturen (Card-1 2175, Card-2 2086). Card-1 braucht zusätzlich Kollisionsvermeidung und Freimodus-Nummern. Eine Vereinigung lohnt sich erst, wenn beide Varianten sichtbar geprüft werden können.
- `_kanjiSrGenC1` und `_kanjiSrGenC2` sind getrennte Generationszähler. Das ist harmlos und gewollt: Jede Karte sperrt nur ihre eigene Einstellungsseite kurz nach dem Öffnen.
