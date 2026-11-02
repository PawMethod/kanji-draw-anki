# Card-2 – Erkennungskarte

Die Vorderseite zeigt das fertige Kanji mit allen Strichen: optional nummeriert, nach Strichfolge eingefärbt oder im gewählten Strichstil. Gefragt ist die Bedeutung. Gezeichnet wird hier nicht, deshalb fehlt die Zeichen-Engine aus Card-1. Die Rückseite zeigt Info, Radikal-Baum, Schreibfehler und Strichfolge wie bei Card-1, aber ohne Freimodus-Auswertung.

Allgemeines steht in [../README.md](../README.md). Die Zeilennummern gelten für den Stand dieses Commits; die Suchbegriffe bleiben gültig.

## FrontTemplate.html

### HTML

| Zeilen | Abschnitt | Suchbegriff / IDs |
|---|---|---|
| 1–38 | Theme-Vorauswahl, Palette, Einblenden `[SHARED]` | `_kdPreRoll` |
| 39–48 | Zahnrad-Knopf | `.gear-btn` |
| 49–1481 | Einstellungs-Overlay, startet auf Reiter C2 (`data-tab="c2"`) | `#settings-overlay` |
| 53 / 201 / 329 / 533 / 681 / 760 | ‑ Übersicht / Hilfslinien / Vorderseite C1 (ausgeblendet) / Rückseite / **Vorderseite Erkennen** / Erscheinungsbild | `#settings-main`, `#page-grid`, `#page-front`, `#page-back`, `#page-front-c2`, `#page-theme` |
| 1188–1480 | ‑ Klang & Musik (**generiert**) | `[KD-SOUND-PAGE]` |
| 1484–4282 | Landschaften (identisch zu Card-1) | `.forest-scenery`, `jp-scene-<theme>` |
| 4283 | Kartentitel, versteckt | `.card-title` |
| 4286–4329 | Neon-Filter (identisch zu Card-1) | `#neon-defs` |
| 4330–4372 | Kanji-Anzeige: Raster, Referenzpfade, Banner (ohne Zeichenebene) | `#grid-bg`, `#svg-bg`, `#legacy-gesture-warning`, `#addon-hint` |
| 4373–6132 | Audio-Engine (**generiert**) | `[KD-AUDIO-ENGINE]` |

### Haupt-Skript (6133–7746)

| Zeilen | Abschnitt (Suchbegriff) | Wichtigste Namen | Gegenstück Card-1 |
|---|---|---|---|
| 6142–6189 | `AnkiWeb / Browser Detection [SHARED]` | `_applyAwSize`, `_measureAwBar` | 6194 |
| 6190–6217 | AnkiDroid-Gesten-Warnung, fehlendes Add-on | – | 6246, 6268 |
| 6218–6237 | `Anti-Flicker [SHARED]` (setzt zusätzlich `stroke-complete`) | – | 6285 |
| 6238–6291 | `Persistence Layer [SHARED]` | `_kCookieObj`, `safeGetItem`, `safeSetItem`, `_fc` | 6294 |
| 6292–6350 | `Shared helpers [SHARED]` | `_kanjiIsDark`, `_kanjiSwFactor`, `_kanjiGelColor`, `_kanjiMakeGelHalo`, `_kanjiEatNextClick` | 6348 |
| 6351–6428 | **`Card 2 Front: apply c2f_* feature settings`** | `_addNumbersC2F`, `applyFrontFeaturesC2` (Nummern, Farbe nach Strichfolge, Anzeigestil) | – |
| 6429–6713 | `Settings UI [SHARED]` | `scopedGet`, `hostGet`, `switchSettingsTab`, `navigateToPage`, `navigateBack`, `refreshSettingsRadios`, `getGlobalConfig` 6680 | 6406 |
| 6714–6833 | Farbdefinitionen, Zufalls-Landschaft | `_rollRandomTheme` 6795, `_scheduleDeferredThemeCheck` | 6700 |
| 6834–6844 | **Gelstift-Halos für alle Striche** (alle sofort sichtbar), nutzt die gemeinsamen Helfer | `_c2AddGelHaloToPath` | `_addGelHaloToPath` 7949 |
| 6845–7057 | `applyThemeSettings`, `updateThemeSetting` 7046 | – | 6825 |
| 7058–7134 | `Klang & Musik: Bridge [SHARED]` | `_kdSnd`, `applySoundSettings` | 7077 |
| 7135–7223 | `Grid Rendering [SHARED]`, Funktionsschalter (inkl. `c2f`-Bereich) | `updateGridDisplay`, `updateFeatureSetting` 7200 | 7154 |
| 7224–7302 | Einstellungen öffnen/schließen | `openSettings`, `closeSettings` 7252 | 7238 |
| 7303–7400 | Theme-Observer, MediaQuery, `Cleanup stale DOM` (7374), bfcache | `_kanjiThemeObserver`, `_kanjiPagesShowHandler` 7388 | 7292 |
| 7401–7487 | `Scroll Lock & iOS Detection [SHARED]` | `kanjiTouchMoveModalHandler`, `kanjiTouchStartHandler`, `checkScrollability` 7442 | 7422 |
| 7488–7513 | `Button Feedback & Stylus Fixes [SHARED]` | `addPenTopBtn` | 8981 |
| 7514–7655 | `Scroll Guards & AnkiMobile Tappable Isolation [SHARED]` | `_kanjiSetupModalTouchGuards` | 9063 |
| 7656–7741 | Apple Pencil, S-Pen (Hintergrund, globale Abwehr) `[SHARED]` | `_trackBg`, `_kanjiGlobalPenDefenseAdded` | 9205–9301 |
| 7742–7745 | Geste für AnkiDroid/AnkiMobile | `userJs1` (Card-1 hat `userJs1`–`3`) | 9302 |

## BackTemplate.html

| Zeilen | Abschnitt (Suchbegriff) | Wichtigste Namen | Gegenstück Card-1 |
|---|---|---|---|
| 1–34 | Überblendung aus, statische Anti-Flacker-Regeln | `#kanji-anti-flicker` | 1–99 |
| 35–69 | Strichfarben vorab, inkl. Farbe nach Strichfolge (HSL) | `_ck` | 100–136 |
| 70–84 | Marker, `{{FrontSide}}`, Info-Knopf | `#is-back-side-marker` | 137–151 |
| 85–341 | Info-Overlay (Übersicht 88, Strichfolge 278, Schreibfehler 316) | `#info-overlay` | 152–409 |
| 342–577 | Kopf, Info-Modal-Navigation | `openInfoModal` 440, `closeInfoModal` 551 | 410–665 |
| 578–1707 | `Primitive Tree [SHARED]`, Zoom/Vollbild 957, Aufruf 1676 | `_kanjiRenderPrimitiveTree`, `_kanjiTreeOutsideHandler` | 666–1795 |
| 1708–2010 | `Pitfalls [SHARED]` | `_kanjiRenderPitfalls` | 1796–2098 |
| 2011–2051 | `Word Examples`, `Hide "Lesungen"` `[SHARED]` | – | 2099–2141 |
| 2052–2245 | `Back Side Features (stroke colors, numbers, colorOrder)` | `addNumbersGPAL` 2064 (vereinfachte Version), `applyBackFeatures` 2089, `kanjiSettingsGlobalHandler` 2232 | 2142–2576, 3802 |
| 2246–2379 | `Stroke-Order Player [SHARED]` | `_kanjiOrder` | 3821–3954 |
| 2380–2466 | `Cross-Platform Fixes [SHARED]` | `addPenHandler` | 3955–4041 |
| 2467–2560 | S-Pen: Hintergrund-Prüfung, globale Abwehr | `_trackBg` | 4042–4135 |
| 2561–2584 | Scroll-Neusynchronisierung (AnkiMobile) | `resyncModalScroll` | 4136–4159 |

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
- `addNumbersGPAL` gibt es in zwei Versionen mit verschiedenen Signaturen (Card-1 2153, Card-2 2064). Card-1 braucht zusätzlich Kollisionsvermeidung und Freimodus-Nummern. Eine Vereinigung lohnt sich erst, wenn beide Varianten sichtbar geprüft werden können.
- `_kanjiSrGenC1` und `_kanjiSrGenC2` sind getrennte Generationszähler. Das ist harmlos und gewollt: Jede Karte sperrt nur ihre eigene Einstellungsseite kurz nach dem Öffnen.
