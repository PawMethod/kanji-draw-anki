# Tools/audio – Audio-Engine, Bündeln und Tests

Quellen und Prüfwerkzeuge der Audio-Engine. Was im Template landet, beschreibt [../../Templates/README.md](../../Templates/README.md#audio-engine-kd-audio-engine).

## Dateien

| Datei | Zweck |
|---|---|
| `src/*.js` | **Quelle** der Audio-Engine (`window.__kdAudio`), aufgeteilt in Module, Version in `src/01-base.js` (`VERSION`) |
| `kd-audio-engine.js` | **Generiert** von [../build.py](../build.py) aus `src/` (eine IIFE). Die Testseiten laden dieses Bündel |
| `page-sound.html` | **Quelle** der Einstellungsseite „Klang & Musik“ |
| `check_scripts.py` | Syntaxprüfung aller `<script>`-Blöcke der vier Templates mit `node --check` (`{{Feld}}` wird durch `0` ersetzt) |
| `selftest.html`, `run_selftest.sh` | Rendert jede Kombination aus Genre, Landschaft und Hell/Dunkel offline. Prüft Pegel, Spitzen und NaN |
| `switchtest.html` | Szenen- und Genrewechsel im Live-Kontext |
| `make_harness.py`, `harness_test.js` | Baut aus den echten Templates und einer echten Notiz (über AnkiConnect) die Testseiten `harness_c1.html`, `harness_c2.html` und `harness_c1b.html`. Diese spielen eine Bedienung durch und protokollieren alle Aufrufe an die Engine |
| `gelcheck.html` | Laufzeitprüfung der gemeinsamen Helfer (Dunkelmodus, Gelstift-Halos) auf beiden Karten; braucht die Harness-Seiten |
| `vergleich.html`, `render.html` | Hörvergleich mehrerer Engine-Versionen. Die Versionen liegen als `versions/kd-audio-<x.y.z>.js` vor (nicht im Repository) |

`harness_*.html` und `versions/` sind generiert bzw. lokal und stehen in [.gitignore](.gitignore).

## Module (`src/`)

Die Dateien werden in Namensreihenfolge zu einer IIFE verbunden; alle Module teilen sich deren Gültigkeitsbereich (keine Imports). Konstanten und Klassen stehen vor ihrer ersten Verwendung zur Laufzeit; Funktionsdeklarationen dürfen auch später kommen.

| Modul | Inhalt |
|---|---|
| `01-base.js` | `VERSION`, Singleton-Prüfung, Mathe-Helfer (`clamp`, `mtof`, `rnd`, `pick`, `poisson`, `shuffle` …) |
| `02-tables.js` | `THEMES`, `NAT`, `SK`, `SPACE`, `VOPT`/`VREG`/`VK`, `RES`, Jo-Ha-Kyū-Konstanten |
| `03-repertoire.js` | **`class Song`** (parst Melodie und Akkorde, `errors()`, `plan(genre)`, `weight()`), `SONGS`, `pickSong` |
| `04-runtime.js` | Laufzeitzustand (`cfg`, `cur`, `ctx`, `players` …), `now`, `imm`, `musicOn`, `live` |
| `05-graph.js` | AudioContext, Rauschpuffer, Hall, Echo, Master-Graph, Knoten-Helfer (`gainN`, `filt`, `send` …) |
| `06-samples.js` | **`class SampleBank`** (Cache, Vorwärmen im Hintergrund; Renderer `piano`, `modal`, `string`), `MODAL` |
| `07-instruments.js` | `tone`, `pluck`, `flute`, `piano`, `sho`, `bowl`, `kane`, `suikin`, `taiko` … |
| `08-harmony.js` | `scaleNotes`, `voiceChord`, `chordAt`, `ctones` |
| `09-flow.js` | **`class Flow`** (Lernfluss, Jo-Ha-Kyū-Stufe, Antwort-Raster, Strichrate) als `FL`; Antworten `answer`, `ghost`, `stageHit` |
| `10-melody.js` | `playNote` (Verzierungen), `phrase`, `melody` (Behandlungen) |
| `11-percussion.js` | `SIG` (Schlagwerk je Landschaft), `SIG_HIT`/`sigHit`, `shimmer` |
| `12-genres.js` | `GENRES`, `ambientBar`, `zenBar`, `pianoBar`, `lofiBar` |
| `13-nature.js` | **`class Nature`** (Naturbetten, `bar()` plant Ereignisse), Tierstimmen, `EV` |
| `14-player.js` | **`class Player`** (ein Lied je Genre: `begin`, `newSong`, `retheme`/`applyWant`, `scheduleBar`, `snapshot`) |
| `15-control.js` | `syncMusic`, `pump`, `tick` |
| `16-fx.js` | `FX` (UI-Klänge in der Tonart des Lieds) |
| `17-strokes.js` | **`class StrokeVoice`** (ein Strichklang: `move`, `apply`, `release`), `strokeStart`/`Move`/`End`, `duck` |
| `18-api.js` | `configure`, `setScene`, `cardShown`, `strokeResult`, `complete`, Lebenszyklus, `offline` (Tests), `api` |

## Arbeitsablauf

```bash
# 1. Module in src/ oder die Klangseite ändern, dann bündeln und einbetten
python3 Tools/build.py           # --check meldet nur, ob etwas veraltet ist

# 2. Syntax aller Template-Skripte prüfen
python3 Tools/audio/check_scripts.py

# 3. Lokalen Server starten (Seiten laden Skripte per URL)
cd Tools/audio && python3 -m http.server 8777 --bind 127.0.0.1

# 4. Selbsttest headless (Chromium): Filter = Präfixe, z. B. "zen/,nature/"; Laufzeit in Sekunden
./run_selftest.sh "zen/,nature/" 120

# 5. Integration in den echten Templates (braucht Anki mit AnkiConnect auf 8765)
python3 make_harness.py
./run_selftest.sh "" 60 harness_c1.html     # ebenso harness_c2.html, harness_c1b.html
```

Ausgabezeilen beginnen mit `KDR`. Ein Lauf ist fertig, wenn `KDR DONE` erscheint. Die Harness-Seiten melden zusätzlich `errors` (soll `[]` sein) und die Engine-Version.

Wichtige Testgruppen des Selbsttests: `songs` (Taktprüfung aller Transkriptionen, soll `[]` sein), `song/<lied>/<genre>` (jedes Lied in jedem Genre), `review/<genre>/still|flip` (alle 2 s eine andere Landschaft gegen keinen Wechsel – `maxJump1s` darf bei `flip` nicht deutlich über `still` liegen), `music/` (jede Kombination, 24 s), `bed/` (nur Naturbetten), `flowE/` (feste Dichte 0–4), `flowplay/` (acht Striche und ein fertiges Kanji), `burst/` (20 Striche in 4 s – die Spitze darf die der reinen Musik nicht nennenswert übersteigen), `form/` (150 s, Hüllkurve je 10 s). Mit `./run_selftest.sh "" 300 selftest.html prof=1` kommen Hüllkurven je Jo-Ha-Kyū-Stufe dazu (`stage/<genre>/<0-2>`).

Hörvergleich: `vergleich.html` rendert die in `VERS` eingetragenen Versionen aus `versions/kd-audio-<x.y.z>.js`. Neue Version dort ablegen: `cp kd-audio-engine.js versions/kd-audio-$(grep -o "VERSION = '[^']*'" kd-audio-engine.js | cut -d"'" -f2).js`.

Danach die Templates in Anki übernehmen und die JS-Tests laufen lassen ([../../Tests/README.md](../../Tests/README.md)).
