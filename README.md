# Kanji Draw – Anki Note Template

Interaktives Anki-Template zum Erlernen der japanischen Kanji-Schriftzeichen — mit **echter Strich-Erkennung**, deutschen Eselsbrücken und vollständiger Plattform-Kompatibilität.

![Anki](https://img.shields.io/badge/Anki-2.1%2B-blue)
![Plattformen](https://img.shields.io/badge/Desktop%20%7C%20Android%20%7C%20iOS%20%7C%20Web-✓-green)
![Sprache](https://img.shields.io/badge/Sprache-Deutsch-yellow)
![Lizenz](https://img.shields.io/badge/Lizenz-MIT-lightgrey)

---

## Vorschau

<table align="center">
  <tr>
    <td align="center"><img src="Media/demos/demo-guided.gif" width="200" alt="Geführter Modus – Strich für Strich"><br><sub>✍️ Geführter Modus</sub></td>
    <td align="center"><img src="Media/demos/demo-freehand.gif" width="200" alt="Freihand-Modus mit Bewertung"><br><sub>🖊️ Freihand-Modus</sub></td>
    <td align="center"><img src="Media/demos/demo-appearance.gif" width="200" alt="Erscheinungsbild-Optionen"><br><sub>🎨 Erscheinungsbild</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="Media/demos/demo-info.gif" width="200" alt="Info & Merkhilfe Modal"><br><sub>📖 Info-Modal</sub></td>
    <td align="center"><img src="Media/demos/demo-settings.gif" width="200" alt="Einstellungen"><br><sub>⚙️ Einstellungen</sub></td>
    <td align="center"><img src="Media/demos/demo-gallery.gif" width="200" alt="Screenshot-Galerie"><br><sub>🖼️ Galerie</sub></td>
  </tr>
</table>

---

## Inhaltsverzeichnis

- [Überblick](#überblick)
- [Kartentypen](#kartentypen)
- [Zeichenmodi](#zeichenmodi)
- [Bewertungsalgorithmus](#bewertungsalgorithmus)
- [Einstellungen](#einstellungen)
- [Info-Modal](#info-modal)
- [Plattform-Kompatibilität](#plattform-kompatibilität)
- [Notiztyp-Felder](#notiztyp-felder)
- [Installation](#installation)
- [Add-on: Kanji Draw Persistence](#add-on-kanji-draw-persistence)
- [Dateistruktur](#dateistruktur)
- [Technische Details](#technische-details)
- [Datenquellen & Attribution](#datenquellen--attribution)
- [Lizenz](#lizenz)

---

## Überblick

Kanji Draw ist ein vollständig selbst enthaltenes Anki-Template — kein Build-Schritt, keine externen Dienste, vollständig offline-fähig. Es erzeugt **zwei Kartentypen** aus einem einzigen Notiztyp und bietet:

- **Echte Strich-Erkennung** auf Basis mathematischer Kurvenähnlichkeit (diskrete Fréchet-Distanz)
- **Zwei Lernmodi**: Strich für Strich geführt oder freies Zeichnen des gesamten Kanji
- **Anpassbares Erscheinungsbild**: 4 Stift-Stile, 6 Akzentfarben, 6 Primärfarbthemen, Dark/Light Mode
- **Umfassendes Info-Modal**: Radikalbaum, Eselsbrücke, Wortbeispiele, Lesungen, externe Links
- **Vollständige Plattformunterstützung**: Desktop, Android (inkl. S-Pen), iOS (inkl. Apple Pencil), Web

---

## Kartentypen

| | **Card 1 – Aktiv (Schreiben)** | **Card 2 – Passiv (Erkennen)** |
|---|---|---|
| **Vorderseite** | Deutsche Bedeutung · Zeichenfläche | Kanji sichtbar · Zeichenfläche |
| **Rückseite** | Ergebnis · Vergleichsansicht · Info-Modal | Schlüsselwort · Farbige Strichreihenfolge · Ergebnis · Info-Modal |
| **Lernziel** | Kanji aus der Bedeutung abrufen und schreiben | Kanji sehen und die Bedeutung abrufen |

Die Kartentypen können unabhängig voneinander konfiguriert werden. Card 1 bietet den vollen Einstellungsumfang (Zeichenmodus, Genauigkeit usw.); Card 2 beschränkt sich auf Darstellungsoptionen für das angezeigte Kanji (Strich-Nummern, Strich-Darstellung) sowie die gemeinsamen Erscheinungsbild-Einstellungen.

---

## Zeichenmodi

### ✍️ Geführter Modus

Der nächste Strich wird hervorgehoben — sobald er korrekt gezeichnet wurde, erscheint automatisch der folgende. Fehlerhafte Striche werden sofort farblich markiert.

- Nach **3 Fehlversuchen** erscheint automatisch ein Zeichenhinweis (abschaltbar)
- Überspringen-Funktion für den aktuellen Strich
- Optionale Abschluss-Animation (Glow + Sparkle)

### 🖊️ Freihand-Modus

Das gesamte Kanji wird in einem Zug frei gezeichnet — ohne Reihenfolgevorgabe. Nach dem Aufdecken der Rückseite wird jeder Strich automatisch dem passenden Referenzstrich zugeordnet und bewertet.

- **Ungarischer Algorithmus** (O(n³)) für optimale Strich-Zuordnung
- Jeder zugeordnete Strich wird einzeln bewertet
- Fehlende, überzählige und falsch gezogene Striche werden gesondert gekennzeichnet
- Rückgängig-Funktion für den letzten Strich

---

## Bewertungsalgorithmus

Jeder Strich wird auf Basis von vier Komponenten bewertet:

| Komponente | Gewichtung | Beschreibung |
|---|:---:|---|
| **Form** (Fréchet-Distanz) | 40 % | Globale Kurvenähnlichkeit zwischen Nutzerstrich und Referenzpfad |
| **Durchschnittlicher Punktabstand** | 25 % | Mittlere euklidische Abweichung der Abtastpunkte |
| **Startpunkt-Toleranz** | 17,5 % | Abweichung des Strichanfangs vom Referenzstartpunkt |
| **Endpunkt-Toleranz** | 17,5 % | Abweichung des Strichendes vom Referenzendpunkt |

Vor der Bewertung durchläuft jeder Strich drei **Hard Gates**:
- **Längenverhältnis**: 40–250 % der Referenzlänge (verhindert zu kurze oder zu lange Striche)
- **Richtungsprüfung**: 4-Sektor-Winkelvergleich (erkennt gespiegelte oder umgekehrte Striche)
- **Deckel-Multiplikator**: 1,4–1,6× (verhindert Dominanz einzelner Komponenten)

Alle Striche werden auf **64 Abtastpunkte** normalisiert (Catmull-Rom-Resampling). Die Fréchet-Distanz wird per iterativem Dynamic Programming (O(n²)) berechnet.

### Strich-Genauigkeit

Die drei Stufen skalieren alle Schwellenwerte gleichmäßig:

| Stufe | Multiplikator | Effekt |
|---|:---:|---|
| **Locker** | × 1,35 | Großzügigere Toleranzen — gut für Anfänger |
| **Normal** | × 1,0 | Ausgewogene Standardeinstellung |
| **Streng** | × 0,7 | Engere Toleranzen — für geübte Lernende |

### Fehler-Farbcodierung (Rückseite)

| Fehler | Farbe | Bedeutung |
|---|---|---|
| 0 | 🟢 Grün | Strich korrekt gezeichnet |
| 1 | 🟠 Orange | Leichte Abweichung |
| 2 | 🟧 Dunkelorange | Merkliche Abweichung |
| 3+ | 🔴 Rot | Strich falsch oder nicht erkannt |

---

## Einstellungen

Alle Optionen sind über das **⚙️ Zahnrad-Menü** erreichbar. Einstellungen werden pro Kartentyp (Card 1 / Card 2) unabhängig gespeichert.

### Zeichnen & Bewertung

| Einstellung | Card 1 | Card 2 | Optionen |
|---|:---:|:---:|---|
| **Zeichenmodus** | ✓ | — | Geführt · Frei |
| **Strich-Genauigkeit** | ✓ | — | Locker · Normal · Streng |
| **Echtzeit-Prüfung** | ✓ | — | An · Aus |
| **Zeichen-Hilfe** | ✓ | — | An · Aus |
| **Abschluss-Animation** | ✓ | — | An · Aus |

### Rückseiten-Darstellung

| Einstellung | Card 1 | Card 2 | Optionen |
|---|:---:|:---:|---|
| **Farb-Bewertung** | ✓ | — | An · Aus |
| **Strich-Nummern** | ✓ | ✓ | An · Aus |
| **Vergleichsansicht** | ✓ | — | An · Aus |
| **Strichansicht** | ✓ | — | Handschrift beibehalten · SVG-Pfade einblenden |
| **Strich-Darstellung** | — | ✓ | Standard · Farbig (Regenbogen-Strichreihenfolge) |

### Hilfslinien-Raster

| Einstellung | Optionen |
|---|---|
| **Muster** | Kein · Kreuz (Mittellinien) · Voll (+ Diagonalen) |
| **Linienstil** | Gepunktet · Gestrichelt · Durchgehend |
| **Dicke** | Dünn · Mittel · Dick |
| **Sichtbarkeit** | Hell (30 %) · Mittel (60 %) · Dunkel (100 %) |

### Erscheinungsbild

| Einstellung | Optionen |
|---|---|
| **Modus** | System (automatisch) · Hell · Dunkel |
| **Akzentfarbe** | 🟢 Grün · 🔵 Blau · 🟣 Lila · 🟠 Orange · 🔴 Rot · 🩵 Türkis |
| **Primärfarbe** | Neutral · Warm · Kühl · Sepia · Rosé · Salbei |
| **Strich-Stil** | Standard · Gelstift · Tusche · Neon |
| **Strichfarbe** | Schwarz · Tintenblau · Violett · Braun · Türkis · Schiefer |
| **Schriftgröße** | Klein · Normal · Groß |

#### Stift-Stile im Detail

| Stil | Aussehen |
|---|---|
| **Standard** | Klarer, gleichmäßiger Strich |
| **Gelstift** | Weicher Wet-Ink-Look mit leuchtendem Halo-Effekt |
| **Tusche** | Variierender Pinselstrich mit dynamischer Breite |
| **Neon** | Leuchtender Glow-Effekt (SVG-Doppelfilter, GPU-optimiert) |

---

## Info-Modal

Das Info-Modal (📖-Schaltfläche auf der Rückseite) zeigt alle verfügbaren Informationen zu einem Kanji auf einen Blick:

| Bereich | Inhalt |
|---|---|
| **Kopfzeile** | Kanji · Deutsche Bedeutung · JLPT-Stufe · Häufigkeitsrang |
| **Radikalbaum** | Visuelle Zerlegung in Radikale/Primitive mit antippbaren Tooltips |
| **Eselsbrücke** | Deutsche Merkhilfe mit optionalem visuellem Hinweis |
| **Wortbeispiele** | Anklickbare Beispielwörter mit ein-/ausblendbarer Furigana |
| **Lesungen** | ON-Lesung (blau) · KUN-Lesung (grün) mit farbigen Labels |
| **Externe Links** | [Jisho](https://jisho.org) · [Tatoeba](https://tatoeba.org) · [WaniKani](https://www.wanikani.com) · [Koohii](https://kanji.koohii.com) |

---

## Plattform-Kompatibilität

| Plattform | Status | Besonderheiten |
|---|:---:|---|
| **Anki Desktop** (2.1+) | ✅ | Maus + Pointer-Events; Add-on für Einstellungspersistenz empfohlen |
| **AnkiDroid** | ✅ | Touch + S-Pen; CookieManager-Flush; Gesten-Hooks `userJs1/2/3` |
| **AnkiMobile (iOS)** | ✅ | Touch + Apple Pencil; `position:fixed` Scroll-Lock; Safe-Area-Insets |
| **AnkiWeb** | ✅ | Vollständig browserbasiert; dynamische Viewport-Anpassung |

### Gesten-Hooks (AnkiDroid & AnkiMobile)

Folgende JavaScript-Funktionen können Geräte-Gesten zugewiesen werden:

| Funktion | Card 1 | Card 2 | Beschreibung |
|---|:---:|:---:|---|
| `userJs1` | ✓ | ✓ | Referenzstrich einblenden/ausblenden (C1) · Einstellungen (C2) |
| `userJs2` | ✓ | — | Zeichenfläche zurücksetzen |
| `userJs3` | ✓ | — | Einstellungen öffnen |

**AnkiDroid:** *Einstellungen → Gesten → JavaScript-Funktion 1/2/3*  
**AnkiMobile:** *Einstellungen → Gesten → Eigene Aktion → JavaScript ausführen*

### Hinweise zu AnkiDroid

- **localStorage** kann ab AnkiDroid 2.21+ explizit aktiviert werden:  
  *Einstellungen → Erweitert → localStorage aktivieren*
- Im **Legacy-Lernmodus** kann es zu Konflikten mit Wisch-Gesten kommen. Das Template zeigt in diesem Fall einen Hinweis an. Der **neue Lernmodus** ist empfohlen.

---

## Notiztyp-Felder

| Feld | Pflicht | Beschreibung |
|---|:---:|---|
| `Kanji` | ✓ | Das Schriftzeichen (z. B. `山`) |
| `Bedeutung` | ✓ | Deutsche Übersetzung (z. B. `Berg`) |
| `SVGPfade` | ✓ | SVG-`<path>`-Elemente — ein Element pro Strich |
| `JLPT` | — | JLPT-Stufe (N5–N1) |
| `Häufigkeit` | — | Häufigkeitsrang unter den gebräuchlichsten Kanji |
| `Radikale` | — | Strukturierte Kanji-Zerlegung (JSON) für den Radikalbaum |
| `Eselsbrücke` | — | Deutsche Merkhilfe / Eselsbrücke |
| `Merkhilfe` | — | Visueller Hinweis zur Eselsbrücke (Bild oder HTML) |
| `Wortbeispiel` | — | Wortbeispiele mit Furigana-Markup |
| `Onyomi` | — | ON-Lesung (Katakana) |
| `Kunyomi` | — | KUN-Lesung (Hiragana) |

> Die Felder `Kanji`, `Bedeutung` und `SVGPfade` sind für die Grundfunktion zwingend erforderlich. Alle anderen Felder sind optional und werden im Info-Modal nur angezeigt, wenn sie befüllt sind.

---

## Installation

### 1. Notiztyp anlegen

1. In Anki: **Werkzeuge → Notiztypen verwalten → Hinzufügen**
2. Notiztyp mit den oben genannten Feldern erstellen
3. Kartenvorlagen bearbeiten — **zwei Kartentypen** anlegen:

| Vorlage | Datei |
|---|---|
| Card 1 – Vorderseite | `Templates/Card-1/FrontTemplate.html` |
| Card 1 – Rückseite | `Templates/Card-1/BackTemplate.html` |
| Card 2 – Vorderseite | `Templates/Card-2/FrontTemplate.html` |
| Card 2 – Rückseite | `Templates/Card-2/BackTemplate.html` |
| Styling (CSS) | `Templates/Styling.css` |

### 2. Inhalt übernehmen

Den Inhalt der jeweiligen Datei vollständig in das entsprechende Eingabefeld des Template-Editors kopieren.

---

## Add-on: Kanji Draw Persistence

Auf **Anki Desktop** verwendet Qt WebEngine ein Off-The-Record-Profil — Cookies und localStorage werden bei jedem Neustart gelöscht. Das mitgelieferte Add-on löst dieses Problem.

### Funktion

- Fängt Einstellungs-Updates aus dem Template ab (`pycmd('kdp:{...}')`)
- Speichert alle Einstellungen in `user_files/settings.json` (atomarer Schreibvorgang)
- Stellt die Einstellungen beim nächsten Kartenaufruf automatisch wieder her
- Arbeitet transparent im Hintergrund — keine Benutzeroberfläche notwendig

### Installation

**Option A – AnkiWeb (empfohlen):**  
In Anki: **Werkzeuge → Erweiterungen → Erweiterungen herunterladen** → Code eingeben:

```
905251277
```

**Option B – Manuell:**  
Den Ordner `Addon/` in das Anki-Add-on-Verzeichnis kopieren und Anki neu starten:

| Betriebssystem | Pfad |
|---|---|
| Linux | `~/.local/share/Anki2/addons21/kanji_draw_persistence/` |
| Windows | `%APPDATA%\Anki2\addons21\kanji_draw_persistence\` |
| macOS | `~/Library/Application Support/Anki2/addons21/kanji_draw_persistence/` |

> Das Add-on ist **optional**. Ohne Add-on werden Einstellungen nur für die aktuelle Sitzung gespeichert und nach einem Neustart auf die Standardwerte zurückgesetzt. Auf AnkiDroid und AnkiMobile ist kein Add-on erforderlich.

---

## Dateistruktur

```
kanji-draw-anki/
├── Templates/
│   ├── Card-1/
│   │   ├── FrontTemplate.html    ← Zeichenfläche + Strich-Erkennung + Einstellungs-UI
│   │   └── BackTemplate.html     ← Ergebnis + Vergleichsansicht + Info-Modal
│   ├── Card-2/
│   │   ├── FrontTemplate.html    ← Zeichenfläche + Strich-Erkennung + Einstellungs-UI
│   │   └── BackTemplate.html     ← Strichreihenfolge + Ergebnis + Info-Modal
│   └── Styling.css               ← Gemeinsames Stylesheet (Themes, Responsive, Animationen)
│
├── Addon/
│   ├── __init__.py               ← Einstellungspersistenz für Anki Desktop
│   └── manifest.json             ← Add-on-Metadaten
│
├── Tests/
│   ├── js/                       ← JavaScript-Unit-Tests (Node.js, 11 Dateien, 848 Tests)
│   └── anki_addon_stress_helper/ ← Live-Stresstests über AnkiConnect
│
├── Media/
│   └── demos/                    ← Demo-GIFs für README
│
└── README.md
```

---

## Technische Details

### Kein Build-Schritt, keine Abhängigkeiten

Reines HTML/CSS/JavaScript — direkt in Anki einsetzbar, keine CDN-Abhängigkeiten, vollständig offline-fähig.

### Algorithmen

| Algorithmus | Komplexität | Einsatz |
|---|:---:|---|
| **Diskrete Fréchet-Distanz** (iteratives DP, Float64Array) | O(n²) | Formähnlichkeit zwischen Nutzerstrich und Referenzpfad |
| **Ungarischer Algorithmus** | O(n³) | Optimale Strich-Zuordnung im Freihand-Modus |
| **Catmull-Rom-Resampling** | O(n) | Normalisierung aller Striche auf 64 Abtastpunkte |

### Rendering & Animationen

- **SVG-basierte Zeichenfläche** (109 × 109 Einheiten) mit präzisen `<path>`-Elementen
- **Web Animations API** für Abschluss-Animationen (kein permanenter `requestAnimationFrame`-Loop)
- **Anti-Flicker-System**: Strichfarben werden per Inline-`<style>` gerendert, bevor Ankis FrontSide-Injection ausgeführt wird — verhindert das kurze Aufblitzen falscher Farben
- **GPU-Beförderung**: `will-change: transform` auf animierten Elementen; separate Lite-SVG-Filter für WebKit/iOS

### Einstellungspersistenz (Fallback-Kette)

```
window._ks (Arbeitsspeicher)
    → Cookie (_k=…, max-age 1 Jahr)
        → localStorage
            → Add-on JSON (Anki Desktop)
```

### Sicherheit

- Kein `eval()`, keine dynamische Skripterstellung
- JSON-Escaping (`</` → `<\/`) verhindert `<script>`-Injection über das Add-on
- Keine externen Requests — CSP-freundlich

---

## Datenquellen & Attribution

- **Strichpfade (SVG):** [KanjiVG](https://github.com/KanjiVG/kanjivg) von Ulrich Apel — lizenziert unter [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- **Kanji-Reihenfolge, Schlüsselwörter & Primitivnamen:** Entnommen aus James W. Heisig / Robert Rauther, *„Die Kanji lernen und behalten"* (Klostermann-Verlag). Lernreihenfolge, deutsche Schlüsselwörter und Primitivbezeichnungen sind geistiges Eigentum der Autoren bzw. des Verlags.
- **SVG-Zerlegung nach Primitiven:** Extrahiert aus [Migaku Kanji God](https://github.com/migaku-official/Migaku-Kanji-Addon) — lizenziert unter [GPL v3](https://www.gnu.org/licenses/gpl-3.0.html)
- **Farbige Strichreihenfolge:** Inspiriert von [Kanji Colorizer](https://github.com/cayennes/kanji-colorize) (Code: [AGPL v3](https://www.gnu.org/licenses/agpl-3.0.html), SVGs: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/))
- **Eselsbrücken & Merkhilfen:** Erstellt von [PawMethod](https://github.com/PawMethod) mit KI-Unterstützung. Konzept, Prompt-Design, Kuration und Redaktion: PawMethod.

---

## Lizenz

Der **Quellcode** dieses Projekts (Templates, Add-on, Algorithmen) steht unter der [MIT-Lizenz](LICENSE).

Drittinhalte und eingebettete Daten behalten ihre jeweilige Lizenz:

| Bestandteil | Lizenz | Rechteinhaber |
|---|---|---|
| KanjiVG SVG-Strichpfade | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Ulrich Apel |
| Migaku SVG-Zerlegung | [GPL v3](https://www.gnu.org/licenses/gpl-3.0.html) | Migaku |
| Kanji-Reihenfolge, Schlüsselwörter & Primitivnamen | Alle Rechte vorbehalten | Heisig / Rauther / Klostermann-Verlag |
| Merkhilfen & Eselsbrücken | [MIT](LICENSE) | PawMethod |

Vollständiger Lizenztext: [LICENSE](LICENSE)

