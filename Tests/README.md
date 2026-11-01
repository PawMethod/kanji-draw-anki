# Tests

Automatische Tests für die Templates und das Add-on. Die Zeilennummern gelten für Commit `46fc277`.

## Ordner

| Pfad | Inhalt |
|---|---|
| [js/](js/) | Node-Tests (`node --test`), kein Browser nötig |
| [live_stress_test.py](live_stress_test.py) | Stresstest im laufenden Anki (echte WebView) |
| [anki_addon_stress_helper/](anki_addon_stress_helper/) | Hilfs-Add-on für den Stresstest: führt JavaScript in der Karten-WebView aus |

## js/ – Node-Tests

Ausführen mit `cd Tests/js && npm test` (entspricht `node --test "test_*.js"`).

| Datei | Prüft | Quelle der geprüften Logik |
|---|---|---|
| `algorithms.js` | – (Hilfsmodul) Resampling, Fréchet, Punktabstand, Segmentwinkel, Glättung, Ungarische Methode | **Kopie** aus Card-1 `window._kanjiAlgo` bzw. `avgPointDist`/`segmentAngles` |
| `test_algorithms.js` | die Algorithmen oben | `algorithms.js` |
| `test_snap.js` | Einrasten der Striche auf die Referenz | `algorithms.js` plus **nachgebaute** Snap-Logik |
| `test_strictness.js` | Strenge „Locker/Normal/Streng“ im geführten und freien Modus | **nachgebautes** `evaluateStroke` |
| `test_persistence.js` | Cookie/`localStorage`-Kette | **nachgebautes** `_parseCookies`/`safeGetItem` |
| `test_settings.js` | Einstellungs-Modal unter Last, Theme-Wechsel | **nachgebaute** Settings-Logik mit Mock-DOM |
| `test_stress.js` | Race Conditions, Timer, Animationsüberlappungen | Mock-DOM und Mock-Timer |
| `test_new_fixes.js` | Regressionstests für frühere Fixes | **nachgebaut** (`saveState`, `stopDrawingOnLeave` …) |
| `test_banners.js` | AnkiDroid-Gesten- und Add-on-Banner | **liest die echten** FrontTemplates |
| `test_display.js` | Layout bei verschiedenen Bildschirm- und Schriftgrößen | **liest die echte** `Styling.css` |
| `test_stroke_features.js` | Strichfarben-Palette, Korrekturfarben | **liest die echten** FrontTemplates und CSS |
| `test_stroke_styles_v2.js` | Strichstile Standard, Gel, Tusche, Neon | **liest die echten** FrontTemplates und CSS |

## live_stress_test.py

Simuliert echte Bedienung in Anki: Zeichnen per PointerEvents, Zahnrad-Spam, Theme- und Stilwechsel, Kartenwechsel mitten im Strich, 100 Zufallsaktionen. Nach jeder Phase misst er die Antwortzeit von AnkiConnect als Lebenszeichen.

| Zeilen | Inhalt |
|---|---|
| 35–93 | Brücken: `anki` (AnkiConnect 8765), `js`/`js_sync` (Hilfs-Add-on 8767, Token-Auth), `alive` |
| 99–138 | Testrahmen `test`, `assert_` |
| 140–176 | JS-Bausteine und Navigation (`ensure_review`, `flip_next`) |
| 177–773 | 39 Testfälle `t_*` (Zeichnen, Zahnrad, Themes, Kartenwechsel, Chaos, Speicher, Latenz), jeweils direkt danach mit `test(…)` ausgeführt |
| 774–Ende | Standard-Einstellungen wiederherstellen, Zusammenfassung |

Voraussetzungen: Anki mit dem Stapel „RTK Deutsch — Kanji schreiben“, AnkiConnect und das Hilfs-Add-on.

## anki_addon_stress_helper/

HTTP-Server auf `127.0.0.1:8767`:
- `POST /eval` führt JavaScript in der Karten-WebView aus und antwortet sofort.
- `POST /eval_sync` wartet auf den Rückgabewert.

Jede Anfrage braucht ein Bearer-Token aus `<tmp>/kanjidraw_stress_token` (Rechte 0600), Anfragen mit `Origin`-Header werden abgelehnt.

**Nur für die Dauer der Stresstests installieren.** Ein Add-on, das beliebiges JavaScript in Anki ausführt, gehört nicht in den Alltagsbetrieb.

## Befunde aus dem Code-Review (Stand `46fc277`)

1. **Viele Tests prüfen Kopien statt des echten Codes.** Betroffen sind `test_persistence`, `test_settings`, `test_strictness`, `test_new_fixes`, `test_snap` und `algorithms.js`. Sie bauen die Template-Logik nach. Ändert sich das Template, bleiben die Tests grün, obwohl das Verhalten anders ist. Belege:
   - `test_strictness.js` verweist auf „Card-1/FrontTemplate.html lines 1789–1880“, `evaluateStroke` steht inzwischen in Zeile 8309.
   - `smoothInput` hat im Template einen Parameter `passes`, die Kopie in `algorithms.js` nicht.

   Vorschlag: die Funktionen wie `test_banners.js` direkt aus den Templates extrahieren, z. B. den Block `window._kanjiAlgo = {…}` per Regex herausschneiden und in einem `vm`-Kontext auswerten. Dann können die Kopien entfallen.
2. **Die Audio-Engine hat hier keine Tests.** Ihre Selbsttests (Pegel, NaN-Prüfung, Szenenwechsel) liegen außerhalb des Repositorys in `~/kanji-draw-work/audio/` (`selftest.html`, `switchtest.html`, `run_selftest.sh`).
