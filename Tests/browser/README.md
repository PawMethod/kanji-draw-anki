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
