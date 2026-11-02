# Card-2 – Erkennungskarte

Die Vorderseite zeigt das fertige Kanji mit allen Strichen: optional nummeriert, nach Strichfolge eingefärbt oder im gewählten Strichstil. Gefragt ist die Bedeutung. Gezeichnet wird hier nicht, deshalb fehlt die Zeichen-Engine aus Card-1. Die Rückseite zeigt Info, Radikal-Baum, Schreibfehler und Strichfolge wie bei Card-1, aber ohne Freimodus-Auswertung.

Allgemeines steht in [../README.md](../README.md). Mit ← markierte Abschnitte kommen aus `Templates/src/` (eingesetzt von `python3 Tools/build.py`) und sind in beiden Karten gleich. Die Zeilennummern gelten für den Stand dieses Commits; die Suchbegriffe bleiben gültig.

## FrontTemplate.html

### HTML

| Zeilen | Abschnitt | Suchbegriff / IDs |
|---|---|---|
| 1–38 | Theme-Vorauswahl, Palette, Einblenden `[SHARED]` | `_kdPreRoll` |
| 39–48 | Zahnrad-Knopf | `.gear-btn` |
| 49–1509 | Einstellungs-Overlay, startet auf Reiter C2 (`data-tab="c2"`) | `#settings-overlay` |
| 53 / 201 / 329 / 561 / 709 / 788 | ‑ Übersicht / Hilfslinien / Vorderseite C1 (ausgeblendet) / Rückseite / **Vorderseite Erkennen** / Erscheinungsbild | `#settings-main`, `#page-grid`, `#page-front`, `#page-back`, `#page-front-c2`, `#page-theme` |
| 1216–1508 | ‑ Klang & Musik (**generiert**) | `[KD-SOUND-PAGE]` |
| 1512–4310 | Landschaften (identisch zu Card-1) | `.forest-scenery`, `jp-scene-<theme>` |
| 4311 | Kartentitel, versteckt | `.card-title` |
| 4314–4357 | Neon-Filter (identisch zu Card-1) | `#neon-defs` |
| 4358–4400 | Kanji-Anzeige: Raster, Referenzpfade, Banner (ohne Zeichenebene) | `#grid-bg`, `#svg-bg`, `#legacy-gesture-warning`, `#addon-hint` |
| 4401–6381 | Audio-Engine (**generiert**) | `[KD-AUDIO-ENGINE]` |

### Haupt-Skript (6382–8013)

| Zeilen | Abschnitt (Suchbegriff) | Wichtigste Namen | Gegenstück Card-1 |
|---|---|---|---|
| 6391–6438 | `AnkiWeb / Browser Detection [SHARED]` | `_applyAwSize`, `_measureAwBar` | 6443 |
| 6439–6466 | AnkiDroid-Gesten-Warnung, fehlendes Add-on | – | 6495, 6517 |
| 6467–6486 | `Anti-Flicker [SHARED]` (setzt zusätzlich `stroke-complete`) | – | 6534 |
| 6487–6541 | `Persistence Layer` ← `src/front/persistence.js` | `_kCookieObj`, `safeGetItem`, `safeSetItem`, `_fc` | 6543 |
| 6543–6603 | `Shared helpers` ← `src/front/shared-helpers.js` | `_kanjiIsDark`, `_kanjiSwFactor`, `_kanjiGelColor`, `_kanjiMakeGelHalo`, `_kanjiEatNextClick` | 6599 |
| 6604–6681 | **`Card 2 Front: apply c2f_* feature settings`** | `_addNumbersC2F`, `applyFrontFeaturesC2` (Nummern, Farbe nach Strichfolge, Anzeigestil) | – |
| 6682–6974 | `Settings UI [SHARED]` | `scopedGet`, `hostGet`, `switchSettingsTab`, `navigateToPage`, `navigateBack`, `refreshSettingsRadios`, `getGlobalConfig` 6940 | 6659 |
| 6975–7094 | Farbdefinitionen, Zufalls-Landschaft | `_rollRandomTheme` 7056, `_scheduleDeferredThemeCheck` | 6961 |
| 7095–7105 | **Gelstift-Halos für alle Striche** (alle sofort sichtbar), nutzt die gemeinsamen Helfer | `_c2AddGelHaloToPath` | `_addGelHaloToPath` 8234 |
| 7106–7318 | `applyThemeSettings`, `updateThemeSetting` 7307 | – | 7086 |
| 7319–7396 | `Klang & Musik: Bridge` ← `src/front/sound-bridge.js` | `_kdSnd`, `applySoundSettings` | 7338 |
| 7398–7488 | `Grid Rendering` ← `src/front/grid-display.js`, danach Funktionsschalter (inkl. `c2f`-Bereich) | `updateGridDisplay`, `updateFeatureSetting` 7465 | 7417 |
| 7489–7567 | Einstellungen öffnen/schließen | `openSettings`, `closeSettings` 7517 | 7503 |
| 7568–7665 | Theme-Observer, MediaQuery, `Cleanup stale DOM` (7639), bfcache | `_kanjiThemeObserver`, `_kanjiPagesShowHandler` 7653 | 7557 |
| 7666–7752 | `Scroll Lock & iOS Detection [SHARED]` | `kanjiTouchMoveModalHandler`, `kanjiTouchStartHandler`, `checkScrollability` 7707 | 7687 |
| 7753–7778 | `Button Feedback & Stylus Fixes [SHARED]` | `addPenTopBtn` | 9270 |
| 7779–7921 | `Scroll Guards & AnkiMobile Tappable Isolation` ← `src/front/scroll-guards.js` | `_kanjiSetupModalTouchGuards` | 9352 |
| 7923–8008 | Apple Pencil, S-Pen (Hintergrund, globale Abwehr) `[SHARED]` | `_trackBg`, `_kanjiGlobalPenDefenseAdded` | 9496–9592 |
| 8009–8012 | Geste für AnkiDroid/AnkiMobile | `userJs1` (Card-1 hat `userJs1`–`3`) | 9593 |

## BackTemplate.html

| Zeilen | Abschnitt (Suchbegriff) | Wichtigste Namen | Gegenstück Card-1 |
|---|---|---|---|
| 1–34 | Überblendung aus, statische Anti-Flacker-Regeln | `#kanji-anti-flicker` | 1–99 |
| 35–69 | Strichfarben vorab, inkl. Farbe nach Strichfolge (HSL) | `_ck` | 100–136 |
| 70–84 | Marker, `{{FrontSide}}`, Info-Knopf | `#is-back-side-marker` | 137–151 |
| 85–341 | Info-Overlay (Übersicht 88, Strichfolge 278, Schreibfehler 316) | `#info-overlay` | 152–409 |
| 342–577 | Kopf, Info-Modal-Navigation | `openInfoModal` 440, `closeInfoModal` 551 | 410–665 |
| 578–1710 | `Primitive Tree` ← `src/back/primitive-tree.js` (inkl. Zoom/Vollbild), Aufruf ← `src/back/radical-tree.js` 1678 | `_kanjiRenderPrimitiveTree`, `_kanjiTreeOutsideHandler` | 666–1798 |
| 1712–2016 | `Pitfalls` ← `src/back/pitfalls.js` | `_kanjiRenderPitfalls` | 1800–2104 |
| 2017–2060 | `Word Examples`, `Hide "Lesungen"` ← `src/back/word-examples.js`, `src/back/hide-readings.js` | – | 2105–2150 |
| 2062–2255 | `Back Side Features (stroke colors, numbers, colorOrder)` | `addNumbersGPAL` 2074 (vereinfachte Version), `applyBackFeatures` 2099, `kanjiSettingsGlobalHandler` 2242 | 2152–2586, 3812 |
| 2256–2390 | `Stroke-Order Player` ← `src/back/stroke-order-player.js` | `_kanjiOrder` | 3831–3965 |
| 2392–2479 | `Cross-Platform Fixes` ← `src/back/cross-platform.js` | `addPenHandler` | 3967–4054 |
| 2480–2573 | S-Pen: Hintergrund-Prüfung, globale Abwehr | `_trackBg` | 4055–4148 |
| 2574–2597 | Scroll-Neusynchronisierung (AnkiMobile) | `resyncModalScroll` | 4149–4172 |

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
- `addNumbersGPAL` gibt es in zwei Versionen mit verschiedenen Signaturen (Card-1 2163, Card-2 2074). Card-1 braucht zusätzlich Kollisionsvermeidung und Freimodus-Nummern. Eine Vereinigung lohnt sich erst, wenn beide Varianten sichtbar geprüft werden können.
- `_kanjiSrGenC1` und `_kanjiSrGenC2` sind getrennte Generationszähler. Das ist harmlos und gewollt: Jede Karte sperrt nur ihre eigene Einstellungsseite kurz nach dem Öffnen.
