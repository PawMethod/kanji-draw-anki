# Migration – Lernfortschritt übernehmen

Ein Anki-Desktop-Add-on (ab Anki 23.10) für den Wechsel zwischen dem KanjiDraw-Deck *„RTK Deutsch – Kanji
schreiben“* (upstream, hier **Original-Deck**) und dem Deck dieses Forks (**Mobi-Deck**), in beide Richtungen. Es
überträgt den Lernfortschritt auf die Karten des anderen Decks, damit niemand von vorn anfangen muss.

**Download:** [`dist/kanji_draw_migration.ankiaddon`](dist/kanji_draw_migration.ankiaddon) (auf GitHub: Datei öffnen →
*Download raw file*).

## Was übernommen wird

| | |
|---|---|
| Gelernte Karten | Fälligkeit, Intervall, Ease, Wiederholungen, Fehler, Lernschritte, FSRS-Gedächtnisdaten |
| Wiederholungsverlauf | jede Wiederholung, als Kopie (siehe unten) |
| Neue Karten | ausgesetzt, zurückgestellt und markiert bleibt erhalten |
| Schlagwörter | alle, z. B. `leech` |
| Eigene Änderungen | nur Original → Mobi: `Eselsbrücke` → `Merksatz-Custom`, `Bedeutung` → `Bedeutung-Override`, `Merkhilfe`, `Wortbeispiel` und Lesungen → `Notiz` (mit Beschriftung). Vorhandener Text bleibt, das Eigene wird angehängt. |
| Stapel-Optionen | auf Wunsch: das Optionen-Preset des bisherigen Stapels (Limits, FSRS-Parameter) |

Zuordnung: gleiches Kanji im Feld `Kanji`, Karte 1 → Karte 1 (Zeichnen), Karte 2 → Karte 2 (Bedeutung). 篭 im
Original-Deck ist 籠 im Mobi-Deck.

**Primitive** gibt es nur im Mobi-Deck. Original → Mobi kommen sie als neue Karten dazu. Mobi → Original bleiben sie
mit ihrem Fortschritt im Mobi-Deck stehen; den Stapel kann man danach selbst löschen.

**Eigene Änderungen** gehen nur vom Original- zum Mobi-Deck, weil das Original-Deck keine freien Felder dafür hat.
Wer zurückwechselt, behält seine Texte im Mobi-Deck (oder in der Sicherung).

## Anleitung

1. **Alle Geräte synchronisieren.** Danach bis zum Ende nur noch am PC lernen.
2. Das Deck importieren, zu dem du wechselst (Datei → Importieren).
3. Dieses Add-on installieren: Extras → Erweiterungen → *Aus Datei installieren…* → `kanji_draw_migration.ankiaddon`,
   Anki neu starten.
4. Extras → *KanjiDraw: Lernfortschritt übernehmen…* Die **Richtung** ist vorausgewählt (weg von dem Deck mit dem
   meisten Fortschritt), bitte prüfen. Die Vorschau zeigt, was passiert; noch wird nichts geändert.
5. *Übernehmen*: Das Add-on erstellt zuerst eine Sicherungskopie, überträgt dann alles und prüft jede Karte.
6. Es bietet an, die übertragenen Notizen im bisherigen Deck zu löschen. Bestätigen, wenn alles stimmt.
7. **Normal synchronisieren**, dann die anderen Geräte. Ein Voll-Upload ist nicht nötig.
8. Das Add-on kann danach wieder deinstalliert werden.

## Gut zu wissen

- **Rückgängig** geht nicht mit Strg+Z, sondern über die Sicherungskopie von Schritt 5:
  Datei → Benutzerprofil wechseln → *Sicherungskopie öffnen …*
- **Gefilterte Stapel** mit Karten aus einem der beiden Decks bitte vorher leeren; sonst startet das Add-on nicht.
- **Zurückwechseln:** Beim erneuten Import des Original-Decks bekommen die Notizen ihre alten IDs wieder. Das ist in
  Ordnung, auch dafür reicht ein normaler Sync.
- **Statistik:** Der Wiederholungsverlauf wird kopiert, nicht verschoben, weil AnkiWeb verschobene Einträge nicht
  übernimmt. Anki behält den Verlauf gelöschter Karten, daher zählt die Statistik über die *ganze Sammlung* alte
  Wiederholungen doppelt. Die Statistik des Decks stimmt.
- **Der bisherige Notiztyp** bleibt (fast) leer zurück. Nicht löschen: Das Löschen eines Notiztyps erzwingt einen
  Voll-Sync.
- **Ältere Deck-Versionen (vor v3):** Eigene Änderungen werden nur in Notizen gesucht, die nach dem Import geändert
  wurden; dabei können auch Unterschiede zwischen den Versionen als „eigene Änderung“ erscheinen. Die Vorschau
  listet sie auf.
- Schon gelernte Karten im Zieldeck werden nicht überschrieben. Ein zweiter Durchlauf ändert nichts.
- Nur Anki Desktop. AnkiDroid und AnkiMobile bekommen alles über den Sync.

## Dateien

| Datei | Inhalt |
|---|---|
| [manifest.json](manifest.json) | Paketname, Version, Mindestversion |
| [__init__.py](__init__.py) | Menüeintrag |
| [dialog.py](dialog.py) | Fenster: Vorschau, Sicherung, Übernehmen, Prüfen, Löschen |
| [core.py](core.py) | gesamte Logik ohne Qt (Zuordnung, Übertragung, Prüfung) |
| [upstream_v3_hashes.json](upstream_v3_hashes.json) | Kurz-Hashes der Originaltexte von upstream v3, um eigene Änderungen zu erkennen; erzeugt mit `Tools/make_migration_hashes.py` |
| [dist/kanji_draw_migration.ankiaddon](dist/kanji_draw_migration.ankiaddon) | das fertige Paket (aus den Dateien oben gebaut) |

## Paket bauen und testen

Nach jeder Änderung an den Dateien oben das Paket neu bauen und mit committen:

```sh
python3 Tools/build_migration_addon.py
uv run --no-project --with anki==26.5 python -I -m unittest discover -s Tests/migration -v
```

Die Tests ([Tests/migration](../Tests/migration/test_migration.py)) bauen Sammlungen mit SM-2 und FSRS, lernen Karten
in allen Zuständen und prüfen Übertragung, Prüfung, zweiten Durchlauf, Löschen, gefilterte Stapel, ältere Versionen
und den Weg zurück (Mobi → Original). Ein Test synchronisiert über Ankis eigenen Sync-Server mit einem zweiten Gerät
hin und zurück und prüft, dass jedes Mal ein normaler Sync reicht. Ein weiterer schlägt fehl, wenn
`dist/kanji_draw_migration.ankiaddon` nicht zu den Quelldateien passt.
