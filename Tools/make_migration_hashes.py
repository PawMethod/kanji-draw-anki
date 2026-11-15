"""Write Migration/upstream_v3_hashes.json from upstream's v3 deck package.

The migration add-on uses these hashes to tell a user's own edits from upstream's original text. Only short
hashes are stored, no field contents.

Usage (needs Anki's Python package, e.g. `uv run --with anki==26.5`):
    python -I Tools/make_migration_hashes.py UPSTREAM_V3.apkg
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "Migration"))

import core  # noqa: E402

OUT = os.path.join(ROOT, "Migration", "upstream_v3_hashes.json")
FIELDS = [name for name, *_ in core.PERSONAL_FIELDS]


def main(apkg: str) -> None:
    from anki.collection import Collection, ImportAnkiPackageOptions, ImportAnkiPackageRequest

    with tempfile.TemporaryDirectory() as tmp:
        col = Collection(os.path.join(tmp, "c.anki2"))
        try:
            col.import_anki_package(
                ImportAnkiPackageRequest(package_path=apkg, options=ImportAnkiPackageOptions(with_scheduling=False))
            )
            sources, _ = core.find_note_types(col)
            if len(sources) != 1:
                sys.exit(f"expected one KanjiDraw note type, found {sources}")
            model = col.models.get(sources[0]["id"])
            notes = [col.get_note(n) for n in col.models.nids(model)]
            stamps = Counter(n.mod for n in notes)
            data = {
                "about": "sha1[:10] of upstream KanjiDraw v3.0.0 field values (stripped), for Migration/core.py",
                "stamp": stamps.most_common(1)[0][0],
                "fields": FIELDS,
                "notes": {
                    core.kanji_key(n["Kanji"]): " ".join(core.field_hash(n[core._resolve(model, f)]) for f in FIELDS)
                    for n in notes
                },
            }
        finally:
            col.close()
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        f.write("\n")
    print(f"{len(data['notes'])} notes, stamp {data['stamp']} ({len(stamps)} distinct) -> {OUT}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
