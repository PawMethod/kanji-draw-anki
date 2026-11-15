"""Tests for Migration/core.py on synthetic collections, including a real sync round trip.

Needs Anki's Python package (no Qt):
    uv run --no-project --with anki==26.5 python -I -m unittest discover -s Tests/migration -v
"""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "Migration"))

import core  # noqa: E402
from anki.collection import (  # noqa: E402
    Collection,
    DeckIdLimit,
    ExportAnkiPackageOptions,
    ImportAnkiPackageOptions,
    ImportAnkiPackageRequest,
)
from anki.scheduler_pb2 import CardAnswer  # noqa: E402

STAMP = 1_700_000_000
SRC_FIELDS = ["Kanji", "Bedeutung", "Merkhilfe", "Eselsbrücke", "Wortbeispiel", "Onyomi", "Kunyomi", "SVGPfade"]
DST_FIELDS = [
    "Kanji", "Bedeutung-DE", "Bedeutung-Override", "Merksatz-Custom", "Merksatz-KI", "Merkhilfe", "Notiz",
    "Wortbeispiel", "Onyomi", "Kunyomi", "SVGPfade",
]
SRC_KANJI = ["一", "二", "三", "四", "篭", "六"]  # 篭 is 籠 in the fork, 六 is missing there
DST_KANJI = ["一", "二", "三", "四", "籠", "[Spazierstock]"]


def make_model(col, name, fields, front_field):
    mm = col.models
    m = mm.new(name)
    for f in fields:
        mm.add_field(m, mm.new_field(f))
    for i, (q, a) in enumerate([(f"{{{{{front_field}}}}}", "{{Kanji}}"), ("{{Kanji}}", f"{{{{{front_field}}}}}")]):
        t = mm.new_template(f"Card {i + 1}")
        t["qfmt"], t["afmt"] = q, a
        mm.add_template(m, t)
    mm.add(m)
    return mm.by_name(name)


def answer(col, cid, rating=CardAnswer.GOOD, times=1):
    for _ in range(times):
        card = col.get_card(cid)
        card.start_timer()
        states = col._backend.get_scheduling_states(card.id)
        col.sched.answer_card(col.sched.build_answer(card=card, states=states, rating=rating))


def build_collection(path, fsrs=False):
    """Upstream deck with reviews and edits, plus a freshly imported fork deck."""
    col = Collection(path)
    if fsrs:
        col.set_config("fsrs", True)
    src_m = make_model(col, "KanjiDraw", SRC_FIELDS, "Bedeutung")
    dst_m = make_model(col, "Fork", DST_FIELDS, "Bedeutung-DE")
    old_deck = col.decks.id("RTK Deutsch — Kanji schreiben")
    new_deck = col.decks.id("Kanji::Neu")

    src = {}
    for k in SRC_KANJI:
        n = col.new_note(src_m)
        n["Kanji"], n["Bedeutung"], n["Eselsbrücke"], n["Merkhilfe"] = k, f"bed-{k}", f"story-{k}", f"hint-{k}"
        n["Onyomi"], n["SVGPfade"] = "ON", "<path/>"
        col.add_note(n, old_deck)
        src[k] = n.id
    dst = {}
    for k in DST_KANJI:
        n = col.new_note(dst_m)
        n["Kanji"], n["Bedeutung-DE"], n["Merksatz-KI"], n["Merkhilfe"] = k, f"bed-{k}", f"ki-{k}", f"hint-{k}"
        n["Onyomi"], n["SVGPfade"] = "ON", "<path/>"
        if k == "一":
            n["Merksatz-Custom"] = "Bennis Satz"
        col.add_note(n, new_deck)
        dst[k] = n.id
    # Imported notes all carry the package's timestamp.
    col.db.execute(f"update notes set mod = {STAMP} where mid = ?", src_m["id"])
    originals = {
        "stamp": STAMP,
        "notes": {k: {f: core.field_hash(v) for f, v in col.get_note(nid).items()} for k, nid in src.items()},
    }

    def cards(nid):
        return [c.id for c in sorted(col.get_note(nid).cards(), key=lambda c: c.ord)]

    c = {k: cards(n) for k, n in src.items()}
    answer(col, c["一"][0], times=2)  # review
    answer(col, c["一"][1])  # learning
    answer(col, c["二"][0], times=2)
    answer(col, c["二"][0], rating=CardAnswer.AGAIN)  # lapse -> relearning
    col.sched.suspend_cards([c["二"][0]])
    col.set_user_flag_for_cards(3, [c["二"][0]])
    col.sched.suspend_cards([c["二"][1]])  # new + suspended
    col.set_user_flag_for_cards(1, [c["三"][0]])  # new + flagged
    col.sched.bury_cards([c["三"][1]], manual=True)  # new + buried
    answer(col, c["四"][0], times=2)
    answer(col, cards(dst["四"])[0])  # fork card already studied -> skipped
    answer(col, c["篭"][0], times=2)
    answer(col, c["六"][0], times=2)  # no fork note

    # Own edits: a story, a keyword, and a note that only got a tag.
    n = col.get_note(src["一"])
    n["Eselsbrücke"] = "Mein eigener Satz"
    col.update_note(n)
    n = col.get_note(src["二"])
    n["Bedeutung"] = "meine Bedeutung"
    n.add_tag("wichtig")
    col.update_note(n)
    n = col.get_note(src["三"])
    n.add_tag("leech")
    col.update_note(n)
    return col, src, dst, originals, cards


class MigrationTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.tmp.cleanup()

    def run_case(self, fsrs):
        col, src, dst, originals, cards = build_collection(os.path.join(self.tmp.name, f"c{fsrs}.anki2"), fsrs)
        try:
            sources, forks = core.find_note_types(col)
            self.assertEqual([s["name"] for s in sources], ["KanjiDraw"])
            self.assertEqual([f["name"] for f in forks], ["Fork"])
            plan = core.build_plan(col, sources[0]["id"], forks[0]["id"], originals)
            self.assertEqual(plan.version, "v3")
            self.assertFalse(plan.blocked)
            self.assertEqual(plan.unmatched, ["六"])
            self.assertEqual(plan.target_studied, [("四", 0)])
            kinds = {(p.kanji, p.ord): p.kind for p in plan.pairs}
            self.assertEqual(
                kinds,
                {("一", 0): "progress", ("一", 1): "progress", ("二", 0): "progress", ("二", 1): "state",
                 ("三", 0): "state", ("三", 1): "state", ("篭", 0): "progress"},
            )
            edits = {(e.kanji, e.label, e.target) for e in plan.personal}
            self.assertEqual(
                edits, {("一", "Eselsbrücke", "Merksatz-Custom"), ("二", "Bedeutung", "Bedeutung-Override")}
            )
            self.assertEqual(plan.tags, {dst["二"]: ["wichtig"], dst["三"]: ["leech"]})

            before = {p.dst: col.get_card(p.dst) for p in plan.pairs}
            result = core.apply_plan(col, plan)
            self.assertEqual(core.verify_plan(col, plan), [])
            self.assertEqual(result["progress"], 4)

            for p in plan.pairs:
                d = col.get_card(p.dst)
                self.assertEqual(d.usn, -1, "card must be marked for the next normal sync")
                self.assertGreaterEqual(d.mod, before[p.dst].mod)
                if p.kind == "progress":
                    self.assertEqual(d.original_position, before[p.dst].due)
                    if fsrs:
                        self.assertIsNotNone(d.memory_state)
                        self.assertEqual(d.memory_state, col.get_card(p.src).memory_state)
            self.assertEqual(col.db.list("select distinct usn from revlog where cid in (%s)"
                                         % ",".join(str(p.dst) for p in plan.pairs)), [-1])
            n1 = col.get_note(dst["一"])
            self.assertEqual(n1["Merksatz-Custom"], "Bennis Satz<br><br>Mein eigener Satz")
            self.assertEqual(col.get_note(dst["二"])["Bedeutung-Override"], "meine Bedeutung")
            self.assertEqual(col.get_card(cards(dst["二"])[0]).queue, -1)
            self.assertEqual(col.get_card(cards(dst["二"])[0]).flags, 3)
            self.assertEqual(col.get_card(cards(dst["三"])[1]).queue, -3)

            # A second run changes nothing.
            again = core.build_plan(col, sources[0]["id"], forks[0]["id"], originals)
            self.assertEqual(again.pairs, [])
            core.apply_plan(col, again)
            self.assertEqual(col.get_note(dst["一"])["Merksatz-Custom"], "Bennis Satz<br><br>Mein eigener Satz")

            # Deleting the old notes keeps the transferred cards and their history.
            history = {p.dst: col.db.scalar("select count() from revlog where cid = ?", p.dst) for p in plan.pairs}
            removed, decks = core.delete_source(col, plan)
            self.assertEqual(removed, 5)  # 六 has no partner and stays
            self.assertEqual(decks, 0)  # the old deck still holds 六
            for p in plan.pairs:
                self.assertEqual(col.db.scalar("select count() from revlog where cid = ?", p.dst), history[p.dst])
            self.assertEqual(len(col.find_notes("note:Fork")), len(DST_KANJI))
        finally:
            col.close()

    def test_sm2(self):
        self.run_case(fsrs=False)

    def test_fsrs(self):
        self.run_case(fsrs=True)

    def test_reset_target_with_leftover_history(self):
        """The TEST-profile case: another add-on copied history to the fork card, then the card was reset to new."""
        col, src, dst, originals, cards = build_collection(os.path.join(self.tmp.name, "r.anki2"))
        try:
            s_cid, d_cid = cards(src["一"])[0], cards(dst["一"])[0]
            cols = ", ".join(core.REVLOG_COLS)
            used = set(col.db.list("select id from revlog"))
            for rid, *values in col.db.all(f"select id, {cols} from revlog where cid = ?", s_cid):
                new_id = rid + 1
                while new_id in used:
                    new_id += 1
                used.add(new_id)
                col.db.execute(f"insert into revlog (id, cid, usn, {cols}) values (?, ?, -1, ?, ?, ?, ?, ?, ?)",
                               new_id, d_cid, *values)
            col.sched.schedule_cards_as_new([d_cid], restore_position=True, reset_counts=False)
            self.assertEqual(col.get_card(d_cid).type, 0)
            before = col.db.scalar("select count() from revlog where cid = ?", d_cid)
            self.assertGreater(before, 0)

            sources, forks = core.find_note_types(col)
            plan = core.build_plan(col, sources[0]["id"], forks[0]["id"], originals)
            self.assertIn(("一", 0), {(p.kanji, p.ord) for p in plan.pairs})
            core.apply_plan(col, plan)
            self.assertEqual(core.verify_plan(col, plan), [])
            # Nothing copied twice: the leftover copies count as present.
            self.assertEqual(col.db.scalar("select count() from revlog where cid = ?", d_cid), before)
            self.assertEqual(col.get_card(d_cid).ivl, col.get_card(s_cid).ivl)
        finally:
            col.close()

    def test_filtered_deck_blocks(self):
        col, src, dst, originals, cards = build_collection(os.path.join(self.tmp.name, "f.anki2"))
        try:
            did = col.decks.new_filtered("Filter")
            deck = col.decks.get(did)
            deck["terms"] = [["deck:\"RTK Deutsch — Kanji schreiben\" -is:new", 100, 0]]
            col.decks.save(deck)
            col.sched.rebuild_filtered_deck(did)
            sources, forks = core.find_note_types(col)
            plan = core.build_plan(col, sources[0]["id"], forks[0]["id"], originals)
            self.assertTrue(plan.blocked)
            with self.assertRaises(ValueError):
                core.apply_plan(col, plan)
        finally:
            col.close()

    def test_older_version_only_touched_notes(self):
        col, src, dst, originals, cards = build_collection(os.path.join(self.tmp.name, "o.anki2"))
        try:
            # Pretend the user has an older upstream version: every story differs from v3.
            older = {"stamp": STAMP + 1, "notes": {k: {**v, "Eselsbrücke": "x"} for k, v in originals["notes"].items()}}
            for i, k in enumerate(("一", "二", "三")):  # edits happen at different times
                col.db.execute("update notes set mod = ? where id = ?", STAMP + 100 * (i + 1), src[k])
            sources, forks = core.find_note_types(col)
            plan = core.build_plan(col, sources[0]["id"], forks[0]["id"], older)
            self.assertEqual(plan.version, "older")
            # Only notes changed after import count. Their stories differ from "v3" too, so they are listed:
            # this is the documented noise for older versions. Untouched notes (四, 篭) are not.
            self.assertEqual({e.kanji for e in plan.personal}, {"一", "二", "三"})
        finally:
            col.close()
    def test_reverse_round_trip(self):
        """Upstream -> fork, then back: the friend re-imports upstream's deck and moves the progress back."""
        col, src, dst, originals, cards = build_collection(os.path.join(self.tmp.name, "b.anki2"), fsrs=True)
        try:
            ups, forks = core.find_note_types(col)
            up_mid, fork_mid = ups[0]["id"], forks[0]["id"]
            # Upstream's package, to re-import later: notes and cards come back with their old ids, so the old
            # cards' review history is attached to them again.
            apkg = os.path.join(self.tmp.name, "upstream.apkg")
            col.export_anki_package(out_path=apkg, options=ExportAnkiPackageOptions(with_scheduling=False),
                                    limit=DeckIdLimit(col.decks.id("RTK Deutsch — Kanji schreiben")))
            forward = core.build_plan(col, up_mid, fork_mid, originals)
            core.apply_plan(col, forward)
            core.delete_source(col, forward)
            # Study on: a primitive (no partner upstream) and a card the forward run didn't touch.
            prim = col.get_note(dst["[Spazierstock]"])
            answer(col, cards(prim.id)[0], times=2)
            answer(col, cards(dst["三"])[0], times=2)
            col.import_anki_package(ImportAnkiPackageRequest(
                package_path=apkg, options=ImportAnkiPackageOptions(with_scheduling=False)))
            new_up = {k: src[k] for k in ["一", "二", "三", "四", "篭"]}
            self.assertTrue(all(col.get_note(n).id == n for n in new_up.values()))
            s_old = cards(new_up["一"])[0]
            self.assertGreater(col.db.scalar("select count() from revlog where cid = ?", s_old), 0)

            ups, forks = core.find_note_types(col)
            self.assertGreater(forks[0]["studied"], 0)
            plan = core.build_plan(col, fork_mid, up_mid, originals)
            self.assertTrue(plan.reverse)
            self.assertEqual(plan.personal, [])  # never in this direction
            self.assertEqual(plan.primitives, ["[Spazierstock]"])
            self.assertEqual(plan.primitives_studied, 1)
            self.assertEqual(plan.unmatched, [])
            self.assertEqual(plan.duplicates, [])
            self.assertEqual(plan.target_studied, [])
            kinds = {(p.kanji, p.ord): p.kind for p in plan.pairs}
            self.assertEqual(
                kinds,
                {("一", 0): "progress", ("一", 1): "progress", ("二", 0): "progress", ("二", 1): "state",
                 ("三", 0): "progress", ("三", 1): "state", ("四", 0): "progress", ("籠", 0): "progress"},
            )
            # The package brings 二's own tag back; Anki leaves "leech" out of exports without scheduling.
            self.assertEqual(plan.tags, {new_up["三"]: ["leech"]})

            core.apply_plan(col, plan)
            self.assertEqual(core.verify_plan(col, plan), [])
            for p in plan.pairs:
                self.assertEqual(col.get_card(p.dst).usn, -1)
            # 篭 gets 籠's progress, and the history went along both ways.
            s_cid, d_cid = cards(dst["籠"])[0], cards(new_up["篭"])[0]
            self.assertEqual(col.get_card(d_cid).memory_state, col.get_card(s_cid).memory_state)
            self.assertEqual(col.db.scalar("select count() from revlog where cid = ?", d_cid),
                             col.db.scalar("select count() from revlog where cid = ?", s_cid))
            # No review twice on the re-imported cards: their old history counts as present. (四 was studied in
            # both decks separately, within milliseconds here, so the counts can't be compared for it.)
            for p in plan.pairs:
                if p.kind == "progress" and p.kanji != "四":
                    self.assertEqual(col.db.scalar("select count() from revlog where cid = ?", p.dst),
                                     col.db.scalar("select count() from revlog where cid = ?", p.src), p.kanji)
            self.assertEqual(col.get_card(cards(new_up["二"])[0]).flags, 3)

            again = core.build_plan(col, fork_mid, up_mid, originals)
            self.assertEqual(again.pairs, [])

            removed, decks = core.delete_source(col, plan)
            self.assertEqual(removed, 5)
            self.assertEqual(decks, 0)  # the primitive keeps the fork's deck
            self.assertEqual(len(col.find_notes("note:Fork")), 1)
        finally:
            col.close()


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class SyncTest(unittest.TestCase):
    """The transfer reaches a second device through a normal (not full) sync."""

    def test_normal_sync(self):
        with tempfile.TemporaryDirectory() as tmp:
            port = free_port()
            env = dict(os.environ, SYNC_USER1="u:p", SYNC_BASE=os.path.join(tmp, "server"), SYNC_HOST="127.0.0.1",
                       SYNC_PORT=str(port))
            server = subprocess.Popen([sys.executable, "-I", "-m", "anki.syncserver"], env=env,
                                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                for _ in range(100):
                    try:
                        socket.create_connection(("127.0.0.1", port), timeout=0.1).close()
                        break
                    except OSError:
                        time.sleep(0.1)
                endpoint = f"http://127.0.0.1:{port}/"
                a, src, dst, originals, cards = build_collection(os.path.join(tmp, "a.anki2"), fsrs=True)
                auth = a.sync_login("u", "p", endpoint)
                out = a.sync_collection(auth, False)
                a.close_for_full_sync()
                a.full_upload_or_download(auth=auth, server_usn=None, upload=True)
                a.reopen(after_full_sync=True)

                b = Collection(os.path.join(tmp, "b.anki2"))
                out = b.sync_collection(auth, False)
                b.close_for_full_sync()
                b.full_upload_or_download(auth=auth, server_usn=None, upload=False)
                b.reopen(after_full_sync=True)

                sources, forks = core.find_note_types(a)
                plan = core.build_plan(a, sources[0]["id"], forks[0]["id"], originals)
                core.apply_plan(a, plan)
                core.delete_source(a, plan)
                out = a.sync_collection(auth, False)
                self.assertEqual(out.required, out.NO_CHANGES, "device A must not need a full sync")
                out = b.sync_collection(auth, False)
                self.assertEqual(out.required, out.NO_CHANGES, "device B must not need a full sync")

                cols = ", ".join(core.REVLOG_COLS)
                for p in plan.pairs:
                    ca, cb = a.get_card(p.dst), b.get_card(p.dst)
                    for attr in core.CARD_ATTRS + ("memory_state",):
                        self.assertEqual(getattr(ca, attr), getattr(cb, attr), f"{p.kanji} {p.ord}: {attr}")
                    self.assertEqual(
                        a.db.all(f"select id, {cols} from revlog where cid = ? order by id", p.dst),
                        b.db.all(f"select id, {cols} from revlog where cid = ? order by id", p.dst),
                    )
                for k in ("一", "二"):
                    self.assertEqual(a.get_note(dst[k]).fields, b.get_note(dst[k]).fields)
                self.assertEqual(len(b.find_notes("note:KanjiDraw")), 1)  # only 六 is left

                # And back: B re-imports upstream's notes and moves the progress back, A gets it by normal sync.
                up_model = b.models.by_name("KanjiDraw")
                deck = b.decks.id("RTK Deutsch — Kanji schreiben")
                for k in ["一", "二", "三", "四", "篭"]:
                    n = b.new_note(up_model)
                    n["Kanji"], n["SVGPfade"] = k, "<path/>"
                    b.add_note(n, deck)
                back = core.build_plan(b, b.models.by_name("Fork")["id"], up_model["id"])
                self.assertTrue(back.reverse)
                core.apply_plan(b, back)
                self.assertEqual(core.verify_plan(b, back), [])
                core.delete_source(b, back)
                out = b.sync_collection(auth, False)
                self.assertEqual(out.required, out.NO_CHANGES, "device B must not need a full sync (way back)")
                out = a.sync_collection(auth, False)
                self.assertEqual(out.required, out.NO_CHANGES, "device A must not need a full sync (way back)")
                for p in back.pairs:
                    ca, cb = a.get_card(p.dst), b.get_card(p.dst)
                    for attr in core.CARD_ATTRS + ("memory_state",):
                        self.assertEqual(getattr(ca, attr), getattr(cb, attr), f"back {p.kanji} {p.ord}: {attr}")
                    self.assertEqual(
                        a.db.all(f"select id, {cols} from revlog where cid = ? order by id", p.dst),
                        b.db.all(f"select id, {cols} from revlog where cid = ? order by id", p.dst),
                    )
                self.assertEqual(len(a.find_notes("note:Fork")), 1)  # only the primitive is left
                a.close()
                b.close()
            finally:
                server.terminate()
                server.wait(10)


class PackageTest(unittest.TestCase):
    def test_committed_package_is_current(self):
        out = subprocess.run([sys.executable, "-I", os.path.join(ROOT, "Tools", "build_migration_addon.py"), "--check"],
                             capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stdout + out.stderr)


if __name__ == "__main__":
    unittest.main()
