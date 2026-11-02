# Tools/audio – Audio-Engine, Einbetten und Tests

Quellen und Prüfwerkzeuge der Audio-Engine. Was im Template landet, beschreibt [../../Templates/README.md](../../Templates/README.md#audio-engine-kd-audio-engine).

## Dateien

| Datei | Zweck |
|---|---|
| `kd-audio-engine.js` | **Quelle** der Audio-Engine (`window.__kdAudio`, Version in `VERSION`) |
| `page-sound.html` | **Quelle** der Einstellungsseite „Klang & Musik“ |
| `embed_audio.py` | Bettet beide Quellen zwischen die Marker `[KD-AUDIO-ENGINE]` und `[KD-SOUND-PAGE]` in beiden FrontTemplates ein (idempotent) |
| `check_scripts.py` | Syntaxprüfung aller `<script>`-Blöcke der vier Templates mit `node --check` (`{{Feld}}` wird durch `0` ersetzt) |
| `selftest.html`, `run_selftest.sh` | Rendert jede Kombination aus Genre, Landschaft und Hell/Dunkel offline. Prüft Pegel, Spitzen und NaN |
| `switchtest.html` | Szenen- und Genrewechsel im Live-Kontext |
| `make_harness.py`, `harness_test.js` | Baut aus den echten Templates und einer echten Notiz (über AnkiConnect) die Testseiten `harness_c1.html`, `harness_c2.html` und `harness_c1b.html`. Diese spielen eine Bedienung durch und protokollieren alle Aufrufe an die Engine |
| `gelcheck.html` | Laufzeitprüfung der gemeinsamen Helfer (Dunkelmodus, Gelstift-Halos) auf beiden Karten; braucht die Harness-Seiten |
| `vergleich.html`, `render.html` | Hörvergleich mehrerer Engine-Versionen. Die Versionen liegen als `versions/kd-audio-<x.y.z>.js` vor (nicht im Repository) |

`harness_*.html` und `versions/` sind generiert bzw. lokal und stehen in [.gitignore](.gitignore).

## Arbeitsablauf

```bash
# 1. Engine oder Klangseite ändern, dann einbetten
python3 Tools/audio/embed_audio.py

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

Danach die Templates in Anki übernehmen und die JS-Tests laufen lassen ([../../Tests/README.md](../../Tests/README.md)).
