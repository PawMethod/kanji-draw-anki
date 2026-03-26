# Kanji Draw – Anki Note Template

Interaktives Anki-Template zum Erlernen der japanischen Kanji-Schriftzeichen — mit **echte Strich-Erkennung**, deutschen Eselsbrücken und voller Plattform-Kompatibilität.

![Anki](https://img.shields.io/badge/Anki-2.1%2B-blue)
![Plattformen](https://img.shields.io/badge/Desktop%20%7C%20Android%20%7C%20iOS-✓-green)
![Sprache](https://img.shields.io/badge/Sprache-Deutsch-yellow)

---

## Übersicht

Das Template erzeugt **zwei Kartentypen** aus einem einzigen Notiztyp:

| Karte | Vorderseite | Rückseite |
|-------|------------|-----------|
| **Card 1 – Schreibkarte** | Interaktive Zeichenfläche mit Strich-für-Strich-Erkennung | Ergebnis mit Farbcodierung + Info-Modal |
| **Card 2 – Erkennungskarte** | Kanji als Ganzes angezeigt (keine Eingabe) | Farbige Strichreihenfolge + Info-Modal |

---

## Features

### Strich-Erkennung (Card 1)

- **Composite-Scoring-Algorithmus** basierend auf diskreter Fréchet-Distanz (iteratives DP, O(n²))
- Jeder Nutzerstrich wird geglättet und auf **64 Abtastpunkte** resampled
- Bewertung aus vier Komponenten:
  - **Form** (Fréchet-Distanz) — 40 %
  - **Durchschnittlicher Punktabstand** — 25 %
  - **Startpunkt-Toleranz** — 17,5 %
  - **Endpunkt-Toleranz** — 17,5 %
- Hard-Gates: Längenverhältnis (40–250 %), 4-Sektor-Winkelprüfung, harter Deckel (1,4–1,6×)
- Drei **Genauigkeitsstufen**: Locker (×1,35) · Normal (×1,0) · Streng (×0,7)
- Echtzeit-Feedback mit farblicher Abstufung (Grün → Orange → Rot)
- Automatischer Zeichenhinweis nach 3 Fehlversuchen (abschaltbar)

### Zeichenfläche & Visuelles (Card 1)

- SVG-basierte Zeichenfläche (109×109 Einheiten) mit Pointer-Events
- Konfigurierbares **Hilfslinien-Raster**: 3 Muster × 3 Stile × 3 Stärken × 3 Deckkräfte
- Strich-Animationen mit `stroke-dashoffset` (700 ms)
- **Abschluss-Animation**: Glow-Effekt + Bounce + Sparkle-Partikel (Web Animations API)
- Aktions-Buttons: Aufdecken · Überspringen · Zurücksetzen — mit haptischem Feedback

### Erkennungskarte (Card 2)

- Kanji mit allen Strichen sofort sichtbar — keine Eingabe nötig
- Optionale **Strichnummern** mit Kollisionsvermeidung
- Zwei Darstellungsmodi:
  - **Standard** — einheitliche Strichfarbe
  - **Farbig** — HSL-Regenbogenverlauf zeigt Strichreihenfolge (Hue 0°–300°)

### Rückseiten (Card 1 & 2)

- **Anti-Flicker-System**: Inline-`<style>` rendert Strichfarben VOR dem FrontSide-Injection
- **Fehler-Farbcodierung** (Card 1): Grün (0 Fehler) → Orange → Dunkelorange → Rot (3+ Fehler)
- **Strichnummern** am Startpunkt jedes Strichs mit automatischer Positionierung
- **Info-Modal** mit:
  - JLPT-Level und Häufigkeitsrang
  - **Radikalbaum** — visuelle Kanji-Zerlegung mit antippbaren Tooltips und Primitiv-Markierungen
  - **Eselsbrücke** — deutsche Merkhilfe mit optionalem visuellem Hinweis
  - **Wortbeispiele** — antippbar mit Furigana-Anzeige (Ruby-Toggle)
  - ON- und KUN-Lesungen mit farbigen Labels
  - **Externe Links**: Jisho, Tatoeba, WaniKani, Koohii

### Einstellungen

Alle Optionen werden **pro Kartentyp** gespeichert (c1_/c2_-Prefixes) und sind über ein Zahnrad-Menü auf der Vorderseite erreichbar:

| Einstellung | Card 1 | Card 2 | Beschreibung |
|-------------|:------:|:------:|-------------|
| Strich-Genauigkeit | ✓ | — | Locker / Normal / Streng |
| Echtzeit-Prüfung | ✓ | — | Strich sofort validieren |
| Zeichen-Hilfe | ✓ | — | Auto-Hinweis nach 3 Fehlern |
| Abschluss-Animation | ✓ | — | Sparkle/Glow bei Erfolg |
| Hilfslinien-Raster | ✓ | ✓ | Muster, Stil, Stärke, Deckkraft |
| Fehlerfarben (Rückseite) | ✓ | — | Farbcodierung an/aus |
| Strich-Darstellung | — | ✓ | Standard / Farbig (Regenbogen) |
| Strich-Nummern | — | ✓ | Nummerierung an/aus |

### Persistenz

Einstellungen folgen einer dreistufigen Fallback-Kette für maximale Kompatibilität:
In-Memory (window._ks) → Cookie → localStorage
```

Auf Android wird zusätzlich `CookieManager.flush()` über `visibilitychange`/`pagehide` ausgelöst.

---

## Plattform-Kompatibilität

| Plattform | Status | Besonderheiten |
|-----------|--------|----------------|
| **Anki Desktop** (2.1+) | ✅ Vollständig | Maus + Pointer-Events |
| **AnkiDroid** | ✅ Vollständig | S-Pen-Unterstützung, haptisches Feedback, CookieManager-Flush |
| **AnkiMobile (iOS)** | ✅ Vollständig | Apple Pencil, WKWebView-safe, `position:fixed` Scroll-Lock, Safe-Area-Insets |
| **Dark Mode** | ✅ Automatisch | Erkennt `.nightMode` / `.night_mode` Klasse |
| **Stylus** | ✅ Vollständig | Apple Pencil + S-Pen via `pointerup`-Fix (400 ms Debounce) |

---

## Notiztyp-Felder

| Feld | Pflicht | Beschreibung |
|------|:-------:|-------------|
| `Kanji` | ✓ | Das Schriftzeichen |
| `Bedeutung` | ✓ | Deutsche Übersetzung |
| `SVG-Pfade` | ✓ | SVG-`<path>`-Elemente für jeden Strich |
| `JLPT` | — | JLPT-Stufe (N5–N1) |
| `Frequenz` | — | Häufigkeitsrang |
| `Radikalbaum` | — | Zerlegung in Radikale/Primitive |
| `Geschichte` | — | Eselsbrücke / Merkhilfe |
| `VisuellHinweis` | — | Visueller Hinweis zur Eselsbrücke |
| `HinweisWort` | — | Wortbeispiele mit Furigana |
| `Onyomi` | — | ON-Lesung (Katakana) |
| `Kunyomi` | — | KUN-Lesung (Hiragana) |

---

## Dateistruktur
Templates/
├── Card-1/
│   ├── FrontTemplate.html   ← Schreibkarte: Zeichenfläche + Erkennung + Settings
│   └── BackTemplate.html    ← Schreibkarte Rückseite: Ergebnis + Info-Modal
├── Card-2/
│   ├── FrontTemplate.html   ← Erkennungskarte: Anzeige + Settings
│   └── BackTemplate.html    ← Erkennungskarte Rückseite: Farben + Info-Modal
└── Styling.css              ← Gemeinsames Stylesheet (Dark/Light, Responsive, Animationen)
```

Jede Datei wird in Anki direkt als Template-Inhalt eingefügt — **keine Plugins, keine externen Abhängigkeiten**.

---

## Installation

1. In Anki: **Werkzeuge → Notiztypen verwalten → Hinzufügen**
2. Notiztyp mit den oben genannten Feldern erstellen
3. Kartenvorlagen bearbeiten:
   - **Card 1 Vorderseite** → Inhalt von `Templates/Card-1/FrontTemplate.html`
   - **Card 1 Rückseite** → Inhalt von `Templates/Card-1/BackTemplate.html`
   - **Card 2 Vorderseite** → Inhalt von `Templates/Card-2/FrontTemplate.html`
   - **Card 2 Rückseite** → Inhalt von `Templates/Card-2/BackTemplate.html`
   - **Styling** → Inhalt von `Templates/Styling.css`

---

## Technische Details

- **Kein Build-Schritt** — reines HTML/CSS/JS, direkt in Anki einsetzbar
- **Keine externen Requests** — alles offline-fähig, keine CDN-Abhängigkeiten
- **SVG-basiert** — pixelgenaue Strichpfade ermöglichen algorithmische Auswertung
- **Fréchet-Distanz** — mathematisch fundierte Kurvensimilarität (iteratives DP mit Float64Array)
- **Web Animations API** — Celebration-Effekte ohne requestAnimationFrame-Loops
- **Mustache-safe** — keine `{{…}}`-Syntax in JS/CSS-Kommentaren (Ankis Template-Engine)

---

## Datenquellen & Attribution

- **Strichpfade (SVG):** [KanjiVG](https://github.com/KanjiVG/kanjivg) von Ulrich Apel — lizenziert unter [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Farbige Strichreihenfolge-Diagramme generiert mit [Kanji Colorizer](https://github.com/cayennes/kanji-colorize) von cayennes.
- **Kanji-Bedeutungen:** Basierend auf gängigen deutschen Übersetzungen. Lernreihenfolge inspiriert von James W. Heisig / Robert Rauther, *„Die Kanji lernen und behalten"*.
- **Eselsbrücken & Geschichten:** Erstellt von [PawMethod](https://github.com/PawMethod) unter Verwendung von KI-Sprachmodellen. Konzept, Prompt-Design, Kuration und Redaktion: PawMethod.

---

## Lizenz

Der **eigene Quellcode** dieses Projekts (Templates, Add-on, Erkennungsalgorithmus) steht unter der [MIT-Lizenz](LICENSE).

Drittinhalte und eingebettete Daten behalten ihre jeweilige Lizenz:

| Bestandteil | Lizenz | Rechteinhaber |
|---|---|---|
| KanjiVG SVG-Strichpfade | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Ulrich Apel |
| Migaku SVG-Zerlegung | [GPL v3](https://www.gnu.org/licenses/gpl-3.0.html) | Migaku |
| Kanji-Reihenfolge, Schlüsselwörter & Primitivnamen | Alle Rechte vorbehalten | James W. Heisig / Robert Rauther / Klostermann-Verlag |
| Eselsbrücken | [MIT](LICENSE) | PawMethod |

Siehe [LICENSE](LICENSE) für den vollständigen Lizenztext.