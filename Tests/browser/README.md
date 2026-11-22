# Tests/browser – Browser-Tests für Audio-Engine und Templates

Testseiten für headless Chromium. Die Quellen der Engine liegen in [../../Templates/src/audio/](../../Templates/src/audio/), siehe [../../Templates/README.md](../../Templates/README.md#audio-engine-kd-audio-engine).

## Dateien

| Datei | Zweck |
|---|---|
| `selftest.html`, `run_selftest.sh` | Rendert jede Kombination aus Genre, Landschaft und Hell/Dunkel offline. Prüft Pegel, Spitzen und NaN |
| `switchtest.html` | Szenen- und Genrewechsel im Live-Kontext |
| `reloadtest.html` | Seiten-Reload wie bei AnkiDroid (Legacy): `hideMs` = Ausblenden beim Verlassen, `duringParse` muss leer sein (kein Start während die Seite lädt), `afterLoad` zeigt dasselbe Lied wieder |
| `lifecycletest.html` | Verlassen und Zurückkehren wie bei AnkiMobile: `pagehide` ohne Entladen (`after` muss wieder Pegel haben), toter AudioContext beim Zurückkehren (`autoRevived`: ohne Tippen neu aufgebaut) und bei einem Tipp in einem Popup, das Ereignisse stoppt (`modalTap`), neue Effekte |
| `make_harness.py`, `harness_test.js` | Baut aus den echten Templates und einer echten Notiz (über AnkiConnect) die Testseiten `harness_c1.html`, `harness_c2.html` und `harness_c1b.html`. Diese spielen eine Bedienung durch und protokollieren alle Aufrufe an die Engine |
| `check_fork_back.py <isolated-testdir>` | Prüft echte Anki-Ausgaben: Rückseitenoptionen/Persistenz, Stammübersetzung, Minimal-Akzente und den Handschriftvergleich (vier Stiftstile, 320/1100px, Fehl-/Zusatzstriche). Benötigt Playwright und die getrennten Probe-Notizen des isolierten Testexports. |
| `check_fork_feedback2.py <isolated-testdir>` | Zweite/dritte Windows-Rückmeldung: tatsächliche Defaults, Icon-Geometrie und Rückwechsel, alle Farben in beiden Tabs, alle acht Quellenkombinationen, Quellpersistenz, gewählte Toggle-Chips mit Tastaturbedienung und größere Primitivbedeutungen. Mit `--start 0 --end 4` usw. lassen sich die 16 UI-Fälle in kurzen Abschnitten ausführen. |
| `check_fork_mobile.py <isolated-testdir>` | Echte mobile Chromium-Kontexte (User-Agent, Touch, Pixelverhältnis und Viewport-Meta) statt nur schmaler Desktopfenster: sieben Profile einschließlich 320/360/375px, beide Designs/Kartenrichtungen, Schriftgrößen, zusätzliche Reviewer-Ränder, Drehung, lange Texte und 200%-Textvergrößerung. Verlangt für die kurze Beispielüberschrift nebeneinanderliegende Bedeutung-/Primitive-Pills auch bei 320px. Benötigt Anki-gerenderte `一`-/`marsch`-Fixtures; erzeugt nur private Ausgaben im übergebenen Testverzeichnis. Keine Aussage über natives iOS-WebKit. |
| `check_fork_strokes.py <isolated-testdir> --note 五 --input` | Strichquelle und Elemente-Baum für `五`, `召`, `吾`, `語`, jeweils mit normalen Pfaden, HTML-Umbrüchen, Absatz-Tags und selbstschließenden Pfaden. `--note` pro Familie ausführen. `--input` zeichnet echte Touch-/Mausstriche, prüft Geführt/Frei, Seitenwechsel und Vergleich ohne gespeicherte Moduswahl; auch leere Vorschau und Ein-/Ausschalten des Vergleichs. Läuft nur gegen isolierte Backend-Fixtures, ohne AnkiConnect. |
| `check_fork_reveal.py <fixtures>` | Anki-gerenderte `before/`-/`after/`-Fixtures mit `pages.json`: beide Karten/Seiten, Kanji und Primitive mit/ohne Nebenbedeutung, beide Designs, Hell/Dunkel, 320/1100px, reduzierte Bewegung und echte DOM-Seitenwechsel. Prüft 180ms Einstieg ohne Staffelung, 150ms Antwort, verborgene Card-2-Antworten und Animationen durch manuelles Anhalten/Weitersuchen. Private Ausgaben, kein AnkiConnect. |
| `check_fork_layout.py <outdir>` | Abschnitte auf der Rückseite: Reihenfolge, Ausblenden, Bearbeitungsmodus (Pfeile, Ziehen mit der Maus), Speichern, Zurücksetzen, leere Abschnitte nur im Bearbeitungsmodus. Rendert die Templates selbst mit Beispielfeldern, braucht weder Anki noch Fixtures. |
| `gelcheck.html` | Laufzeitprüfung der gemeinsamen Helfer (Dunkelmodus, Gelstift-Halos) auf beiden Karten; braucht die Harness-Seiten |
| `vergleich.html`, `render.html` | Hörvergleich mehrerer Engine-Versionen aus `versions/kd-audio-<x.y.z>.js` |

Nicht im Repository ([.gitignore](.gitignore)): `kd-audio-engine.js` (schreibt `Tools/build.py`), `harness_*.html` (schreibt `make_harness.py`), `versions/` (lokales Archiv).

## Arbeitsablauf

```bash
# 1. Templates und Test-Bündel bauen, Syntax prüfen (im Repo-Hauptordner)
python3 Tools/build.py
python3 Tools/check_scripts.py

# 2. Lokalen Server starten (Seiten laden Skripte per URL)
cd Tests/browser && python3 -m http.server 8777 --bind 127.0.0.1

# 3. Selbsttest headless (Chromium): Filter = Präfixe, z. B. "zen/,nature/"; Laufzeit in Sekunden
./run_selftest.sh "zen/,nature/" 120

# 4. Integration in den echten Templates (braucht Anki mit AnkiConnect auf 8765)
python3 make_harness.py
./run_selftest.sh "" 60 harness_c1.html     # ebenso harness_c2.html, harness_c1b.html, switchtest.html, reloadtest.html, lifecycletest.html
```

Ausgabezeilen beginnen mit `KDR`. Ein Lauf ist fertig, wenn `KDR DONE` erscheint. Die Harness-Seiten melden zusätzlich `errors` (soll `[]` sein) und die Engine-Version.

Wichtige Testgruppen des Selbsttests: `songs` (Taktprüfung aller Transkriptionen, soll `[]` sein), `song/<lied>/<genre>` (jedes Lied in jedem Genre), `review/<genre>/still|flip` (alle 2 s eine andere Landschaft gegen keinen Wechsel – `maxJump1s` darf bei `flip` nicht deutlich über `still` liegen), `music/` (jede Kombination, 24 s), `bed/` (nur Naturbetten), `flowE/` (feste Dichte 0–4), `flowplay/` (acht Striche und ein fertiges Kanji), `burst/` (20 Striche in 4 s – die Spitze darf die der reinen Musik nicht nennenswert übersteigen), `form/` (150 s, Hüllkurve je 10 s). Mit `./run_selftest.sh "" 300 selftest.html prof=1` kommen Hüllkurven je Jo-Ha-Kyū-Stufe dazu (`stage/<genre>/<0-2>`).

Hörvergleich: `vergleich.html` rendert die in `VERS` eingetragenen Versionen aus `versions/kd-audio-<x.y.z>.js`. Neue Version dort ablegen: `cp kd-audio-engine.js versions/kd-audio-$(grep -o "VERSION = '[^']*'" kd-audio-engine.js | cut -d"'" -f2).js`.

Danach die Templates in Anki übernehmen und die Node-Tests laufen lassen ([../README.md](../README.md)).
