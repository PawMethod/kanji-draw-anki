# Card-2 – Erkennungskarte

Die Vorderseite zeigt das fertige Kanji, alle Striche sind sichtbar: optional nummeriert, nach Strichfolge eingefärbt oder im gewählten Strichstil. Gefragt ist die Bedeutung. Gezeichnet wird hier nicht, deshalb fehlt die Zeichen-Engine aus Card-1. Die Rückseite zeigt Info, Radikal-Baum, Schreibfehler und Strichfolge wie bei Card-1, aber ohne Freimodus-Auswertung.

Allgemeines steht in [../README.md](../README.md). Die Zeilennummern gelten für Commit `46fc277`.

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
| 4286–4322 | Neon-Filter | `#neon-defs` |
| 4323–4365 | Kanji-Anzeige: Raster, Referenzpfade, Banner (ohne Zeichenebene) | `#grid-bg`, `#svg-bg`, `#legacy-gesture-warning`, `#addon-hint` |
| 4366–6126 | Audio-Engine (**generiert**) | `[KD-AUDIO-ENGINE]` |

### Haupt-Skript (6127–7713)

| Zeilen | Abschnitt (Suchbegriff) | Wichtigste Namen | Gegenstück Card-1 |
|---|---|---|---|
| 6136–6183 | `AnkiWeb / Browser Detection [SHARED]` | `_applyAwSize`, `_measureAwBar` | 6195 |
| 6184–6211 | AnkiDroid-Gesten-Warnung, fehlendes Add-on | – | 6247, 6269 |
| 6212–6231 | `Anti-Flicker [SHARED]` (setzt zusätzlich `stroke-complete`) | – | 6286 |
| 6232–6290 | `Persistence Layer [SHARED]` | `safeGetItem`, `safeSetItem`, `_fc` | 6295 |
| 6291–6368 | **`Card 2 Front: apply c2f_* feature settings`** | `_addNumbersC2F`, `applyFrontFeaturesC2` (Nummern, Farbe nach Strichfolge, Anzeigestil) | – |
| 6369–6653 | `Settings UI [SHARED]` | `scopedGet`, `hostGet`, `switchSettingsTab`, `navigateToPage`, `navigateBack`, `refreshSettingsRadios`, `getGlobalConfig` | 6353 |
| 6654–6776 | Farbdefinitionen, Zufalls-Landschaft | `_rollRandomTheme`, `_scheduleDeferredThemeCheck` | 6647 |
| 6777–6808 | **Eigene Gelstift-Halos** (alle Striche sind sofort sichtbar) | `_c2AddGelHaloToPath` | ≈ `_addGelHaloToPath` 7882 |
| 6809–7021 | `applyThemeSettings`, `updateThemeSetting` | – | 6772 |
| 7022–7098 | `Klang & Musik: Bridge [SHARED]` | `_kdSnd`, `applySoundSettings` | 7024 |
| 7099–7187 | `Grid Rendering [SHARED]`, Funktionsschalter (inkl. `c2f`-Bereich) | `updateGridDisplay`, `updateFeatureSetting` | 7101 |
| 7188–7232 | Einstellungen öffnen/schließen | `openSettings`, `closeSettings` | 7185 |
| 7233–7359 | Theme-Observer, MediaQuery, `Cleanup stale DOM` (7333), bfcache | `_kanjiThemeObserver`, `_kanjiPagesShowHandler` | 7239 |
| 7360–7446 | `Scroll Lock & iOS Detection [SHARED]` | `kanjiTouchMoveModalHandlerC2`, `kanjiTouchStartHandlerC2`, `checkScrollability` | 7369 |
| 7447–7476 | `Button Feedback & Stylus Fixes [SHARED]` | `addPenTopBtn` | 8950 |
| 7477–7618 | `Scroll Guards & AnkiMobile Tappable Isolation [SHARED]` | `_kanjiSetupModalTouchGuards` | 9038 |
| 7619–7708 | Apple Pencil, S-Pen (Hintergrund, globale Abwehr) `[SHARED]` | `_trackBg`, `_kanjiGlobalPenDefenseAdded` | 9180–9282 |
| 7709–7712 | Geste für AnkiDroid/AnkiMobile | `userJs1` (Card-1 hat `userJs1`–`3`) | 9283 |

## BackTemplate.html

| Zeilen | Abschnitt (Suchbegriff) | Wichtigste Namen | Gegenstück Card-1 |
|---|---|---|---|
| 1–34 | Überblendung aus, statische Anti-Flacker-Regeln | `#kanji-anti-flicker` | 1–99 |
| 35–69 | Strichfarben vorab, inkl. Farbe nach Strichfolge (HSL) | `_ck` | 100–136 |
| 70–84 | Marker, `{{FrontSide}}`, Info-Knopf | `#is-back-side-marker` | 137–151 |
| 85–341 | Info-Overlay (Übersicht 88, Strichfolge 278, Schreibfehler 316) | `#info-overlay` | 152–409 |
| 342–584 | Kopf, Info-Modal-Navigation | `openInfoModal`, `closeInfoModal` | 410–674 |
| 585–1714 | `Primitive Tree [SHARED]`, Zoom/Vollbild, Aufruf | `_kanjiRenderPrimitiveTree`, `_kanjiTreeOutsideHandlerC2` | 675–1804 |
| 1715–2017 | `Pitfalls [SHARED]` | `_kanjiRenderPitfalls` | 1805–2108 |
| 2018–2058 | `Word Examples`, `Hide "Lesungen"` `[SHARED]` | – | 2109–2151 |
| 2059–2259 | `Back Side Features (stroke colors, numbers, colorOrder)` | `addNumbersGPAL` 2071 (vereinfachte Version), `applyBackFeatures` 2096, `kanjiSettingsGlobalHandlerC2` 2244 | 2152–2588 |
| 2260–2393 | `Stroke-Order Player [SHARED]` | `_kanjiOrder` | 3844–3977 |
| 2394–2486 | `Cross-Platform Fixes [SHARED]` | `addPenHandler` | 3978–4070 |
| 2487–2580 | S-Pen: Hintergrund-Prüfung, globale Abwehr | `_trackBg` | 4071–4164 |
| 2581–2605 | Scroll-Neusynchronisierung (AnkiMobile) | `resyncModalScroll` | 4165–4189 |

## Abweichungen zu Card-1 (Drift)

Diese Blöcke sind als `[SHARED]` markiert, unterscheiden sich aber nicht nur kartenbedingt.

1. **Schreibfehler-Seite:** Card-1 ruft nach `renderList()` noch einmal `_kanjiSetupModalTouchGuards()` auf (Card-1 Back 2088). `renderList` erledigt das bereits selbst (Card-1 Back 2055, Card-2 Back 1965). Der zusätzliche Aufruf in Card-1 ist also überflüssig, Card-2 fehlt nichts.
2. **Zahnrad-Feedback:** `openSettings` in Card-1 spielt die Tipp-Animation `gear-tap`, Card-2 setzt nur `no-hover-fx`.
3. **Neon-Filter `neon-glow-lite`:** unterschiedliche Filterregion. Card-1 nutzt `x=-12 width=130`, Card-2 `x=-8 width=125`.
4. **Info-Modal der Rückseite:**
   - Card-1 nutzt den Helfer `_kanjiIsDark()` und `safeGetState()`.
   - Card-2 schreibt die Dunkelmodus-Prüfung aus.
   - Card-2 sichert jeden Zugriff mit `typeof safeGetItem === 'function' ? … : localStorage…` ab. Das ist unnötig, weil `{{FrontSide}}` die Funktion immer liefert.
5. **Strichnummern:** `addNumbersGPAL` existiert in zwei Versionen mit verschiedenen Signaturen (Card-1 2163, Card-2 2071).
6. **Gelstift-Halo:** zwei getrennte Implementierungen (`_c2AddGelHaloToPath` 6777 und Card-1 `_addGelHaloToPath` 7882). Eine gemeinsame `[SHARED]`-Funktion reicht.

## Befunde aus dem Code-Review (Stand `46fc277`)

1. **Zwei Handler-Sätze nebeneinander (Anki Desktop, gemischte Sitzung).** Werden Karte 1 und Karte 2 im selben Fenster abwechselnd gelernt, bleibt je ein Handler beider Karten gebunden. Grund: Card-2 entfernt nur seine eigenen `…C2`-Handler, Card-1 nur die eigenen. Betroffen sind:
   - `kanjiTouchMoveModalHandler` und `…C2`
   - `kanjiTouchStartHandler` und `…C2`
   - `kanjiResizeHandler` und `…C2`
   - `_kanjiTreeOutsideHandler` und `…C2`

   Die Anzahl wächst nicht unbegrenzt, aber die Arbeit läuft doppelt. Lösung: dieselben globalen Namen in beiden Karten verwenden.
2. Die übrigen Punkte (Landschaften-Größe, Redundanz, Dead Code) gelten wie in [../Card-1/README.md](../Card-1/README.md#befunde-aus-dem-code-review-stand-46fc277).
