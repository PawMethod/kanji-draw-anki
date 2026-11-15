"""Dialog: pick direction and note types, show the preview, back up, transfer, check, offer to delete the source."""

from __future__ import annotations

import html
import os
import time

from aqt.qt import (
    QApplication,
    QCheckBox,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QLabel,
    QTextBrowser,
    Qt,
    QVBoxLayout,
)
from aqt.utils import askUser, showInfo, showWarning

from . import core

# Both deck names are neuter ("das Deck"), so "im …", "das …" fit either way.
UP, FORK = "Original-Deck", "Mobi-Deck"
INTRO = (
    f"Überträgt deinen Lernfortschritt zwischen dem {UP} (KanjiDraw, <i>RTK Deutsch – Kanji schreiben</i>) "
    f"und dem {FORK}, in beide Richtungen: Fälligkeiten, Intervalle, FSRS-Daten, Wiederholungsverlauf, "
    "ausgesetzte und markierte Karten, Schlagwörter und auf Wunsch deine eigenen Änderungen an den Notizen "
    f"(nur vom {UP} zum {FORK}).<br><br>"
    "<b>Vorher:</b> das Deck, zu dem du wechselst, importieren und <b>alle Geräte synchronisieren</b>. "
    "Bis zum Ende nicht auf anderen Geräten lernen."
)
SHOW_MAX = 25


def _esc(text) -> str:
    return html.escape(str(text))


def _card_name(kanji, ord_) -> str:
    return f"{kanji} ({'Zeichnen' if ord_ == 0 else 'Bedeutung'})"


class MigrationDialog(QDialog):
    def __init__(self, mw):
        super().__init__(mw)
        self.mw = mw
        self.plan = None
        self.originals = core.load_originals()
        self.setWindowTitle("KanjiDraw: Lernfortschritt übernehmen")
        self.resize(640, 620)

        layout = QVBoxLayout(self)
        intro = QLabel(INTRO)
        intro.setWordWrap(True)
        layout.addWidget(intro)

        form = QFormLayout()
        self.dir_box = QComboBox()
        self.dir_box.addItem(f"{UP} → {FORK}", False)
        self.dir_box.addItem(f"{FORK} → {UP}", True)
        self.up_box, self.fork_box = QComboBox(), QComboBox()
        form.addRow("Richtung:", self.dir_box)
        form.addRow(f"{UP} (Notiztyp):", self.up_box)
        form.addRow(f"{FORK} (Notiztyp):", self.fork_box)
        layout.addLayout(form)

        self.personal_box = QCheckBox("Eigene Änderungen an Notizen übernehmen")
        self.personal_box.setChecked(True)
        self.options_box = QCheckBox("Stapel-Optionen mitnehmen (Limits, FSRS-Parameter)")
        self.options_box.setChecked(True)
        layout.addWidget(self.personal_box)
        layout.addWidget(self.options_box)

        self.preview = QTextBrowser()
        layout.addWidget(self.preview, 1)

        self.buttons = QDialogButtonBox()
        self.run_button = self.buttons.addButton("Übernehmen", QDialogButtonBox.ButtonRole.AcceptRole)
        self.buttons.addButton("Schließen", QDialogButtonBox.ButtonRole.RejectRole)
        self.buttons.accepted.connect(self.run)
        self.buttons.rejected.connect(self.reject)
        layout.addWidget(self.buttons)

        ups, forks = core.find_note_types(mw.col)
        for box, entries in ((self.up_box, ups), (self.fork_box, forks)):
            for e in entries:
                box.addItem(f"{e['name']} ({e['count']} Notizen, {e['studied']} gelernte Karten)", e["id"])
        if not ups or not forks:
            missing = f"das {UP} (KanjiDraw)" if not ups else f"das {FORK}"
            self.preview.setHtml(f"<p>Nicht gefunden: <b>{missing}</b>. Bitte zuerst importieren.</p>")
            self.run_button.setEnabled(False)
            return
        # Guess the direction: away from the deck that has more progress.
        self.dir_box.setCurrentIndex(1 if forks[0]["studied"] > ups[0]["studied"] else 0)
        for box in (self.dir_box, self.up_box, self.fork_box):
            box.currentIndexChanged.connect(self.refresh)
        self.personal_box.toggled.connect(self.refresh)
        self.refresh()

    @property
    def reverse(self) -> bool:
        return bool(self.dir_box.currentData())

    def names(self) -> tuple[str, str]:
        """(source deck, target deck) for the texts."""
        return (FORK, UP) if self.reverse else (UP, FORK)

    def refresh(self, *_):
        self.personal_box.setEnabled(not self.reverse)
        self.personal_box.setToolTip(
            f"Das {UP} hat keine freien Felder dafür; deine Texte bleiben im {FORK}." if self.reverse else ""
        )
        src, dst = self.up_box.currentData(), self.fork_box.currentData()
        if self.reverse:
            src, dst = dst, src
        QApplication.setOverrideCursor(Qt.CursorShape.WaitCursor)
        try:
            self.plan = core.build_plan(
                self.mw.col, src, dst, self.originals, personal=self.personal_box.isChecked()
            )
        finally:
            QApplication.restoreOverrideCursor()
        self.preview.setHtml(self.describe(self.plan))
        self.run_button.setEnabled(self._has_work(self.plan))

    @staticmethod
    def _has_work(plan) -> bool:
        return plan is not None and not plan.blocked and bool(plan.pairs or plan.personal or plan.tags)

    def describe(self, plan) -> str:
        progress = sum(p.kind == "progress" for p in plan.pairs)
        state = len(plan.pairs) - progress
        src_name, dst_name = self.names()
        out = [f"<h3>Vorschau: {src_name} → {dst_name}</h3>"]
        if not (plan.pairs or plan.personal or plan.tags) and not plan.blocked:
            reason = (
                f"alle passenden Karten im {dst_name} sind schon gelernt (siehe Hinweise)"
                if plan.target_studied
                else f"im {src_name} gibt es keine gelernten Karten, Schlagwörter oder eigenen Änderungen"
            )
            out.append(f"<p><b>Nichts zu übernehmen:</b> {reason}.</p>")
        out.append("<ul>")
        out.append(f"<li><b>{len(plan.note_pairs)}</b> Kanji in beiden Decks gefunden.</li>")
        out.append(
            f"<li><b>{progress}</b> gelernte Karten werden übernommen (von {plan.src_studied} gelernten), "
            "mit Wiederholungsverlauf.</li>"
        )
        if state:
            out.append(f"<li><b>{state}</b> neue Karten behalten ihren Status (ausgesetzt, zurückgestellt, markiert).</li>")
        if plan.tags:
            out.append(f"<li>Schlagwörter für <b>{len(plan.tags)}</b> Notizen.</li>")
        if plan.personal:
            notes = len({e.dst_nid for e in plan.personal})
            out.append(f"<li><b>{len(plan.personal)}</b> eigene Änderungen in {notes} Notizen:<ul>")
            for e in plan.personal[:SHOW_MAX]:
                where = "Notiz" if e.target == "Notiz" else e.target
                out.append(f"<li>{_esc(e.kanji)}: {_esc(e.label)} → {_esc(where)}</li>")
            if len(plan.personal) > SHOW_MAX:
                out.append(f"<li>… und {len(plan.personal) - SHOW_MAX} weitere</li>")
            out.append("</ul></li>")
        if plan.reverse:
            out.append(
                f"<li>Eigene Änderungen an Notizen werden in dieser Richtung nicht übernommen; sie bleiben "
                f"im {FORK}.</li>"
            )
        out.append("</ul>")

        warn = []
        if plan.filtered:
            names = ", ".join(_card_name(k, o) for k, o, _ in plan.filtered[:SHOW_MAX])
            warn.append(
                f"<b>Karten in gefilterten Stapeln:</b> {_esc(names)}. Bitte die gefilterten Stapel zuerst leeren "
                "(Stapel → Zahnrad → Leeren), dann dieses Fenster neu öffnen."
            )
        if plan.target_studied:
            names = ", ".join(_card_name(k, o) for k, o in plan.target_studied[:SHOW_MAX])
            warn.append(f"Im {dst_name} schon gelernt, werden übersprungen: {_esc(names)}")
        if plan.unmatched:
            warn.append(f"Nicht im {dst_name}, bleiben unverändert: {_esc(', '.join(plan.unmatched[:SHOW_MAX]))}")
        if plan.primitives_studied:
            warn.append(
                f"{plan.primitives_studied} gelernte Karten von Primitiven: Das {UP} hat keine Primitive, ihr "
                f"Fortschritt bleibt im {FORK}."
            )
        if plan.duplicates:
            warn.append(f"Mehrfach vorhanden, werden übersprungen: {_esc(', '.join(plan.duplicates[:SHOW_MAX]))}")
        if plan.version == "older" and self.personal_box.isChecked():
            warn.append(
                f"Dein {UP} ist eine ältere Version als v3. Eigene Änderungen werden nur in Notizen gesucht, "
                "die du nach dem Import geändert hast; dabei können auch Unterschiede zwischen den Versionen als "
                "eigene Änderung erkannt werden. Bitte die Liste oben prüfen."
            )
        if warn:
            out.append("<h3>Hinweise</h3><ul>" + "".join(f"<li>{w}</li>" for w in warn) + "</ul>")
        out.append(
            f"<p>Vor dem Übernehmen wird automatisch eine Sicherung erstellt. Das {src_name} bleibt erhalten, "
            "bis du am Ende das Löschen bestätigst.</p>"
        )
        return "".join(out)

    def _backup(self) -> str | None:
        folder = self.mw.pm.backupFolder()
        start = time.time() - 2  # file times may be coarse
        self.mw.col.create_backup(backup_folder=folder, force=True, wait_for_completion=True)
        files = [os.path.join(folder, f) for f in os.listdir(folder) if f.endswith(".colpkg")]
        new = [f for f in files if os.path.getmtime(f) >= start]
        return max(new, key=os.path.getmtime) if new else None

    def run(self):
        plan = self.plan
        if not self._has_work(plan):
            return
        if not askUser("Jetzt eine Sicherung erstellen und den Lernfortschritt übernehmen?", parent=self):
            return
        mw = self.mw
        src_name, _ = self.names()
        backup = None
        mw.progress.start(label="Sicherung wird erstellt…", immediate=True, parent=self)
        try:
            backup = self._backup()
            mw.progress.update(label="Lernfortschritt wird übernommen…")
            result = core.apply_plan(mw.col, plan, copy_deck_options=self.options_box.isChecked())
            mw.progress.update(label="Wird geprüft…")
            problems = core.verify_plan(mw.col, plan)
        except Exception as e:  # show the backup so the user can go back
            mw.progress.finish()
            showWarning(f"Fehler: {e}\n\nSicherung: {backup or 'keine'}", parent=self)
            return
        mw.progress.finish()
        mw.reset()

        backup_text = (
            f"Sicherung: {os.path.basename(backup)}\n(Wiederherstellen: Datei → Benutzerprofil wechseln → Sicherungskopie öffnen …)"
            if backup
            else "Achtung: Die Sicherung konnte nicht gefunden werden."
        )
        summary = (
            f"Übernommen: {result['progress']} gelernte Karten, {result['reviews']} Wiederholungen, "
            f"{result['state']} Karten mit Status, {result['notes']} Notizen mit Schlagwörtern oder eigenen "
            f"Änderungen" + (f", Optionen für {result['decks_options']} Stapel" if result["decks_options"] else "") + "."
        )
        if problems:
            more = f"\n… und {len(problems) - 10} weitere" if len(problems) > 10 else ""
            showWarning(
                f"{summary}\n\nDie Prüfung hat Abweichungen gefunden:\n" + "\n".join(problems[:10]) + more
                + f"\n\nDas {src_name} wurde nicht gelöscht.\n{backup_text}",
                parent=self,
            )
            self.refresh()
            return

        notes = len(plan.note_pairs)
        kept = (
            f"\nDie {len(plan.primitives)} Primitive bleiben im {FORK} (das {UP} hat keine); den Stapel kannst du "
            "später selbst löschen.\n"
            if plan.primitives
            else ""
        )
        if askUser(
            f"{summary}\n\nGeprüft: alle Karten stimmen mit dem {src_name} überein.\n\n"
            f"Die {notes} übertragenen Notizen im {src_name} ({2 * notes} Karten) jetzt löschen?\n{kept}\n"
            f"{backup_text}",
            parent=self,
            defaultno=True,
        ):
            removed, decks = core.delete_source(mw.col, plan)
            mw.reset()
            done = f"{removed} Notizen" + (f" und {decks} leere Stapel" if decks else "") + f" im {src_name} gelöscht."
        else:
            done = f"Das {src_name} ist noch da; du kannst es später selbst löschen."
        showInfo(
            f"{done}\n\nJetzt synchronisieren (ein normaler Sync reicht), danach die anderen Geräte.",
            parent=self,
        )
        self.accept()
