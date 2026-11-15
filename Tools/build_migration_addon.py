#!/usr/bin/env python3
"""Build Migration/dist/kanji_draw_migration.ankiaddon from Migration/.

Sorted entries and fixed timestamps keep rebuilds stable. ``--check`` compares the committed package's contents with
the sources (contents, not bytes: deflate output may differ between zlib versions):

    python3 Tools/build_migration_addon.py           # build
    python3 Tools/build_migration_addon.py --check   # fail if the committed package is out of date
"""

from __future__ import annotations

import io
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "Migration")
OUT = os.path.join(SRC, "dist", "kanji_draw_migration.ankiaddon")
# Files that go into the package (README.md is for GitHub; Anki does not use it).
INCLUDE = ("__init__.py", "core.py", "dialog.py", "manifest.json", "upstream_v3_hashes.json")


def build() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name in sorted(INCLUDE):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            with open(os.path.join(SRC, name), "rb") as f:
                z.writestr(info, f.read())
    return buf.getvalue()


def contents(data: bytes) -> dict:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        return {name: z.read(name) for name in z.namelist()}


def main() -> int:
    data = build()
    if "--check" in sys.argv[1:]:
        try:
            with open(OUT, "rb") as f:
                current = contents(f.read())
        except (OSError, zipfile.BadZipFile):
            current = None
        if current != contents(data):
            print(f"{os.path.relpath(OUT, ROOT)} is out of date: run python3 Tools/build_migration_addon.py")
            return 1
        print(f"{os.path.relpath(OUT, ROOT)} is up to date")
        return 0
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "wb") as f:
        f.write(data)
    print(f"wrote {os.path.relpath(OUT, ROOT)} ({len(data):,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
