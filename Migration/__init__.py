"""KanjiDraw Lernfortschritt übernehmen – one-time move between upstream's KanjiDraw deck and this fork's deck,
in either direction.

Adds "Extras → KanjiDraw: Lernfortschritt übernehmen…". The logic lives in core.py (no Qt, tested headless);
this file only adds the dialog.
"""

try:
    from aqt import mw
except ImportError:  # imported outside Anki (tests)
    mw = None

if mw is not None:
    from aqt.qt import QAction

    def _open():
        from .dialog import MigrationDialog

        MigrationDialog(mw).exec()

    _action = QAction("KanjiDraw: Lernfortschritt übernehmen…", mw)
    _action.triggered.connect(_open)
    mw.form.menuTools.addAction(_action)
