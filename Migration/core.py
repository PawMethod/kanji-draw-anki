"""Transfer learning progress between upstream's KanjiDraw notes and this fork's notes, in either direction.

No Qt in here: everything works on an ``anki.collection.Collection`` so it can be tested headless.

Steps: ``build_plan`` (read only) -> ``apply_plan`` -> ``verify_plan`` -> optionally ``delete_source``.
The direction follows from the note types passed to ``build_plan``. Own edits are only carried from upstream to
the fork: upstream's note type has no free fields to put the fork's own texts in.

Sync: card and note changes go through Anki's own API (``update_cards``/``update_notes``), which marks them
for the next normal sync. Review history is *copied* to the new cards with fresh ids, because AnkiWeb ignores
changes to review entries it already has, so moving them would not sync.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from collections import Counter
from dataclasses import dataclass, field

# Note types are recognised by their fields, so renamed note types still work.
FORK_FIELDS = ("Kanji", "Bedeutung-DE", "Merksatz-Custom", "Notiz", "SVGPfade")
SOURCE_FIELDS = ("Kanji", "SVGPfade")

# Upstream v1 used other field names (renamed in upstream commit 47c5bf0).
FIELD_ALIASES = {
    "Eselsbrücke": ("Eselsbrücke", "Geschichte"),
    "Merkhilfe": ("Merkhilfe", "VisuellHinweis"),
    "Wortbeispiel": ("Wortbeispiel", "HinweisWort"),
    "Bedeutung": ("Bedeutung",),
    "Onyomi": ("Onyomi",),
    "Kunyomi": ("Kunyomi",),
}

# Upstream glyph -> the deck's glyph, where the two decks use different variants.
VARIANTS = {"篭": "籠"}

# Fields a user may have edited, where their own version goes, and which fork fields hold the same content
# (an edit equal to one of those is not carried over). Target "Notiz" gets a labelled line.
PERSONAL_FIELDS = (
    # (upstream field, label, preferred target, fork fields with the same content)
    ("Bedeutung", "Bedeutung", "Bedeutung-Override", ("Bedeutung-DE", "Bedeutung-Override")),
    ("Eselsbrücke", "Eselsbrücke", "Merksatz-Custom", ("Merksatz-KI", "Merksatz-Custom")),
    ("Merkhilfe", "Merkhilfe", "Notiz", ("Merkhilfe",)),
    ("Wortbeispiel", "Wortbeispiel", "Notiz", ("Wortbeispiel",)),
    ("Onyomi", "On-Lesung", "Notiz", ("Onyomi",)),
    ("Kunyomi", "Kun-Lesung", "Notiz", ("Kunyomi",)),
)

# Card attributes copied for a studied card. The optional ones exist only in newer Anki versions.
CARD_ATTRS = ("type", "queue", "due", "ivl", "factor", "reps", "lapses", "left", "flags", "custom_data")
CARD_ATTRS_OPTIONAL = ("memory_state", "desired_retention", "decay", "last_review_time")
REVLOG_COLS = ("ease", "ivl", "lastIvl", "factor", "time", "type")
# A copied review gets the next free id after the original's (ids are ms timestamps; dense ids push it further).
# A review on the target card with the same values within this window, before or after, counts as present,
# one-to-one, so it is not copied again: after it is a copy (earlier run, another transfer add-on); before it is
# the original that the source's review was copied from (on the way back, re-imported upstream cards get their old
# ids and so their old history back).
COPY_WINDOW_MS = 60_000

QUEUE_SUSPENDED, QUEUE_SIBLING_BURIED, QUEUE_MANUALLY_BURIED = -1, -2, -3
DEFAULT_DECK_ID = 1

HASHES_FILE = os.path.join(os.path.dirname(__file__), "upstream_v3_hashes.json")


def field_hash(value: str) -> str:
    return hashlib.sha1(value.strip().encode("utf-8")).hexdigest()[:10]


def load_originals(path: str = HASHES_FILE) -> dict | None:
    """Hashes of upstream v3's original field values: {"stamp": int, "fields": [...], "notes": {kanji: "h h …"}}."""
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return None
    names = data["fields"]
    notes = {k: dict(zip(names, v.split())) for k, v in data["notes"].items()}
    return {"stamp": data.get("stamp"), "notes": notes}


def kanji_key(value: str) -> str:
    return re.sub(r"<[^>]*>|&nbsp;", "", value).strip()


def has_fields(model: dict, names) -> bool:
    have = {f["name"] for f in model["flds"]}
    return all(n in have for n in names)


def find_note_types(col) -> tuple[list[dict], list[dict]]:
    """(upstream candidates, fork candidates), each sorted by note count, only types that have notes.

    Each entry: {"id", "name", "count" (notes), "studied" (cards that are not new)}.
    """
    sources, forks = [], []
    for m in col.models.all():
        count = col.models.use_count(m)
        if not count or len(m["tmpls"]) < 2:
            continue
        studied = col.db.scalar(
            "select count() from cards where type != 0 and nid in (select id from notes where mid = ?)", m["id"]
        )
        entry = {"id": m["id"], "name": m["name"], "count": count, "studied": studied}
        if has_fields(m, FORK_FIELDS):
            forks.append(entry)
        elif has_fields(m, SOURCE_FIELDS):
            sources.append(entry)
    key = lambda e: -e["count"]
    return sorted(sources, key=key), sorted(forks, key=key)


@dataclass
class CardPair:
    src: int
    dst: int
    kanji: str
    ord: int
    kind: str  # "progress" (studied card) or "state" (new card that is suspended, buried or flagged)


@dataclass
class PersonalEdit:
    dst_nid: int
    kanji: str
    label: str
    value: str
    target: str  # field name; "Notiz" means a labelled line


@dataclass
class Plan:
    src_mid: int
    dst_mid: int
    note_pairs: list = field(default_factory=list)  # (src_nid, dst_nid, kanji)
    pairs: list = field(default_factory=list)  # CardPair
    personal: list = field(default_factory=list)  # PersonalEdit
    tags: dict = field(default_factory=dict)  # dst_nid -> tags to add
    unmatched: list = field(default_factory=list)  # source kanji without a target note
    primitives: list = field(default_factory=list)  # fork -> upstream: primitive notes, which upstream doesn't have
    primitives_studied: int = 0  # their studied cards (their progress stays on the fork's cards)
    duplicates: list = field(default_factory=list)  # kanji that occur more than once on either side
    target_studied: list = field(default_factory=list)  # (kanji, ord): fork card already has progress, skipped
    filtered: list = field(default_factory=list)  # (kanji, ord, side): card sits in a filtered deck
    src_studied: int = 0
    version: str = "unknown"  # upstream source: "v3", "older" or "unknown"
    reverse: bool = False  # fork -> upstream

    @property
    def blocked(self) -> bool:
        return bool(self.filtered)


def _resolve(model: dict, name: str) -> str | None:
    have = {f["name"] for f in model["flds"]}
    for alias in FIELD_ALIASES.get(name, (name,)):
        if alias in have:
            return alias
    return None


def _cards_by_note(col, nids) -> dict:
    out: dict = {}
    nids = list(nids)
    for i in range(0, len(nids), 500):
        chunk = ",".join(str(int(n)) for n in nids[i : i + 500])
        for cid, nid, ord_, ctype, queue, flags, odid in col.db.all(
            f"select id, nid, ord, type, queue, flags, odid from cards where nid in ({chunk})"
        ):
            out.setdefault(nid, {})[ord_] = (cid, ctype, queue, flags, odid)
    return out


def build_plan(col, src_mid: int, dst_mid: int, originals: dict | None = None, personal: bool = True) -> Plan:
    """Match source notes to target notes and decide what to transfer. Changes nothing.

    Upstream -> fork or fork -> upstream, depending on which note type is the fork's.
    """
    plan = Plan(src_mid=src_mid, dst_mid=dst_mid)
    src_model = col.models.get(src_mid)
    dst_model = col.models.get(dst_mid)
    plan.reverse = has_fields(src_model, FORK_FIELDS)
    variants = {v: k for k, v in VARIANTS.items()} if plan.reverse else VARIANTS
    if plan.reverse:
        personal = False

    src_notes = [col.get_note(n) for n in col.models.nids(src_model)]
    if plan.reverse:
        primitives = [n for n in src_notes if kanji_key(n["Kanji"]).startswith("[")]
        plan.primitives = [kanji_key(n["Kanji"]) for n in primitives]
        if primitives:
            ids = ",".join(str(n.id) for n in primitives)
            plan.primitives_studied = col.db.scalar(f"select count() from cards where nid in ({ids}) and type != 0")
        src_notes = [n for n in src_notes if not kanji_key(n["Kanji"]).startswith("[")]
    dst_index: dict = {}
    dst_dupes = set()
    for nid in col.models.nids(dst_model):
        note = col.get_note(nid)
        key = kanji_key(note["Kanji"])
        if not key or key.startswith("["):  # primitives exist only in the fork
            continue
        if key in dst_index:
            dst_dupes.add(key)
        dst_index[key] = note

    # Which upstream version? v3 is recognised by the package timestamp the notes keep on import, or by the
    # stories being v3's. For v3 the hashes show exactly which fields the user changed. For older versions
    # the hashes don't fit, so only notes changed after their import count (their timestamp differs from the
    # most common one, which is the package's).
    stamps = Counter(n.mod for n in src_notes)
    stamp = stamps.most_common(1)[0][0] if stamps else None
    if originals and src_notes and not plan.reverse:
        ref = _resolve(src_model, "Eselsbrücke")
        same = sum(
            1
            for n in src_notes
            if ref and field_hash(n[ref]) == originals["notes"].get(kanji_key(n["Kanji"]), {}).get("Eselsbrücke")
        )
        is_v3 = originals.get("stamp") in stamps or same >= 0.9 * len(src_notes)
        plan.version = "v3" if is_v3 else "older"

    src_seen = Counter(kanji_key(n["Kanji"]) for n in src_notes)
    plan.duplicates = sorted({k for k, c in src_seen.items() if c > 1} | dst_dupes)

    matched = []
    for note in src_notes:
        key = kanji_key(note["Kanji"])
        if key in plan.duplicates:
            continue
        dst = dst_index.get(variants.get(key, key))
        if dst is None:
            plan.unmatched.append(key)
            continue
        matched.append((note, dst, key))
        plan.note_pairs.append((note.id, dst.id, key))

    src_cards = _cards_by_note(col, [s.id for s, _, _ in matched])
    dst_cards = _cards_by_note(col, [d.id for _, d, _ in matched])

    for src, dst, key in matched:
        for ord_, (scid, stype, squeue, sflags, sodid) in sorted(src_cards.get(src.id, {}).items()):
            studied = stype != 0
            state_only = not studied and (squeue in (QUEUE_SUSPENDED, QUEUE_SIBLING_BURIED, QUEUE_MANUALLY_BURIED) or sflags)
            plan.src_studied += studied
            if not (studied or state_only):
                continue
            target = dst_cards.get(dst.id, {}).get(ord_)
            if target is None:
                continue
            dcid, dtype, dqueue, dflags, dodid = target
            if sodid:
                plan.filtered.append((key, ord_, "src"))
                continue
            if dodid:
                plan.filtered.append((key, ord_, "dst"))
                continue
            if dtype != 0:  # a card reset to new may still have old history; it is transferred
                plan.target_studied.append((key, ord_))
                continue
            if not studied and (dqueue, dflags) == (squeue, sflags):
                continue  # status already the same (second run)
            plan.pairs.append(CardPair(scid, dcid, key, ord_, "progress" if studied else "state"))

        if src.tags:
            missing = [t for t in src.tags if not dst.has_tag(t)]
            if missing:
                plan.tags[dst.id] = missing

        touched = plan.version == "v3" or (stamp is not None and src.mod != stamp)
        if personal and touched:
            plan.personal.extend(_personal_edits(src_model, src, dst, key, originals))
    return plan


def _personal_edits(src_model, src, dst, key, originals) -> list:
    out = []
    orig = (originals or {}).get("notes", {}).get(key, {})
    for name, label, target, same_as in PERSONAL_FIELDS:
        actual = _resolve(src_model, name)
        if not actual:
            continue
        value = src[actual].strip()
        if not value or (name in orig and field_hash(value) == orig[name]):
            continue
        if any(value == dst[f].strip() for f in same_as if f in dst):
            continue
        if target == "Bedeutung-Override" and dst[target].strip() and value != dst[target].strip():
            target = "Notiz"  # the fork already overrides the keyword; keep it and note the user's version
        out.append(PersonalEdit(dst.id, key, label, value, target))
    return out


def _copy_progress(src, dst) -> None:
    if getattr(dst, "original_position", 0) is None and dst.type == 0:
        dst.original_position = dst.due  # "Zurücksetzen" later puts the card back into book order
    for attr in CARD_ATTRS:
        setattr(dst, attr, getattr(src, attr))
    for attr in CARD_ATTRS_OPTIONAL:
        if hasattr(src, attr) and hasattr(dst, attr):
            setattr(dst, attr, getattr(src, attr))


def _notiz_line(label: str, value: str) -> str:
    return f"<b>Eigene {label}:</b> {value}"


def apply_plan(col, plan: Plan, copy_deck_options: bool = True, progress=None) -> dict:
    """Transfer scheduling, review history, tags and own edits. Make a backup before calling this."""
    if plan.blocked:
        raise ValueError("Karten in gefilterten Stapeln: bitte die gefilterten Stapel zuerst leeren.")

    # Cards: one batch through Anki's API, so mtime/usn are set and the next normal sync uploads them.
    cards = []
    for i, pair in enumerate(plan.pairs):
        src, dst = col.get_card(pair.src), col.get_card(pair.dst)
        if pair.kind == "progress":
            _copy_progress(src, dst)
        else:
            dst.queue, dst.flags = src.queue, src.flags
        cards.append(dst)
        if progress and i % 200 == 0:
            progress(i, len(plan.pairs))
    for i in range(0, len(cards), 500):
        col.update_cards(cards[i : i + 500], skip_undo_entry=True)

    # Review history: copied with fresh ids (ids are millisecond timestamps, so +1 ms keeps the order).
    used = set(col.db.list("select id from revlog"))
    usn = col.usn()
    rows = []
    for pair in plan.pairs:
        if pair.kind != "progress":
            continue
        for rid, *values in _missing_reviews(col, pair):
            new_id = rid + 1
            while new_id in used:
                new_id += 1
            used.add(new_id)
            rows.append((new_id, pair.dst, usn, *values))
    if rows:
        col.db.executemany(
            f"insert into revlog (id, cid, usn, {', '.join(REVLOG_COLS)}) values (?, ?, ?, ?, ?, ?, ?, ?, ?)", rows
        )

    # Tags and own edits.
    by_note: dict = {}
    for nid in plan.tags:
        by_note.setdefault(nid, [])
    for edit in plan.personal:
        by_note.setdefault(edit.dst_nid, []).append(edit)
    notes = []
    for nid, edits in by_note.items():
        note = col.get_note(nid)
        for tag in plan.tags.get(nid, []):
            note.add_tag(tag)
        for edit in edits:
            text = _notiz_line(edit.label, edit.value) if edit.target == "Notiz" else edit.value
            current = note[edit.target]
            if text in current:
                continue  # already carried over (second run)
            note[edit.target] = f"{current}<br><br>{text}" if current.strip() else text
        notes.append(note)
    if notes:
        col.update_notes(notes, skip_undo_entry=True)

    options = 0
    if copy_deck_options:
        options = _copy_deck_options(col, plan)

    return {
        "progress": sum(p.kind == "progress" for p in plan.pairs),
        "state": sum(p.kind == "state" for p in plan.pairs),
        "reviews": len(rows),
        "notes": len(notes),
        "decks_options": options,
    }


def _reviews(col, cid) -> list:
    return col.db.all(f"select id, {', '.join(REVLOG_COLS)} from revlog where cid = ? order by id", cid)


def _missing_reviews(col, pair) -> list:
    """Source reviews that the target card doesn't have yet."""
    have = _reviews(col, pair.dst)
    taken = set()
    out = []
    for rid, *values in _reviews(col, pair.src):
        match = next(
            (i for i, (tid, *tvalues) in enumerate(have)
             if i not in taken and abs(tid - rid) <= COPY_WINDOW_MS and tvalues == values),
            None,
        )
        if match is None:
            out.append((rid, *values))
        else:
            taken.add(match)
    return out


def _home_deck(col, cid) -> int:
    did, odid = col.db.first("select did, odid from cards where id = ?", cid)
    return odid or did


def _copy_deck_options(col, plan: Plan) -> int:
    """Give the target's decks the options preset (limits, FSRS parameters) of the source deck."""
    src_decks = Counter(_home_deck(col, p.src) for p in plan.pairs)
    if not src_decks:
        src_nids = [s for s, _, _ in plan.note_pairs]
        if not src_nids:
            return 0
        src_decks = Counter(col.db.list(f"select did from cards where nid in ({','.join(map(str, src_nids[:500]))})"))
    src_deck = col.decks.get(src_decks.most_common(1)[0][0], default=False)
    if not src_deck or src_deck.get("dyn"):
        return 0
    conf_id = src_deck["conf"]
    dst_nids = [d for _, d, _ in plan.note_pairs]
    dst_decks = set()
    for i in range(0, len(dst_nids), 500):
        chunk = ",".join(map(str, dst_nids[i : i + 500]))
        dst_decks.update(col.db.list(f"select distinct case when odid then odid else did end from cards where nid in ({chunk})"))
    changed = 0
    for did in dst_decks:
        deck = col.decks.get(did, default=False)
        if deck and not deck.get("dyn") and deck.get("conf") != conf_id:
            deck["conf"] = conf_id
            col.decks.save(deck)
            changed += 1
    return changed


def verify_plan(col, plan: Plan) -> list[str]:
    """Compare every transferred card with its original. Returns problems (empty = everything matches)."""
    problems = []
    for pair in plan.pairs:
        src, dst = col.get_card(pair.src), col.get_card(pair.dst)
        name = f"{pair.kanji} Karte {pair.ord + 1}"
        if pair.kind == "state":
            if (src.queue, src.flags) != (dst.queue, dst.flags):
                problems.append(f"{name}: Status weicht ab")
            continue
        attrs = CARD_ATTRS + tuple(a for a in CARD_ATTRS_OPTIONAL if hasattr(src, a))
        diff = [a for a in attrs if getattr(src, a) != getattr(dst, a)]
        if diff:
            problems.append(f"{name}: {', '.join(diff)} weichen ab")
        missing = _missing_reviews(col, pair)
        if missing:
            problems.append(f"{name}: {len(missing)} Wiederholungen fehlen im Verlauf")
    for edit in plan.personal:
        note = col.get_note(edit.dst_nid)
        if edit.value not in note[edit.target]:
            problems.append(f"{edit.kanji}: eigene {edit.label} fehlt")
    for nid, tags in plan.tags.items():
        note = col.get_note(nid)
        if any(not note.has_tag(t) for t in tags):
            problems.append(f"Notiz {nid}: Schlagwörter fehlen")
    return problems


def delete_source(col, plan: Plan) -> tuple[int, int]:
    """Delete the matched source notes, then source decks that are left empty. Returns (notes, decks).

    Fork -> upstream: the fork's primitives have no partner and stay, so the fork's deck stays too.
    """
    src_nids = [s for s, _, _ in plan.note_pairs]
    decks = set()
    for i in range(0, len(src_nids), 500):
        chunk = ",".join(map(str, src_nids[i : i + 500]))
        decks.update(col.db.list(f"select distinct case when odid then odid else did end from cards where nid in ({chunk})"))
    if src_nids:
        col.remove_notes(src_nids)
    removed = len(src_nids)
    keep = {DEFAULT_DECK_ID}
    dst_nids = [d for _, d, _ in plan.note_pairs]
    for i in range(0, len(dst_nids), 500):
        chunk = ",".join(map(str, dst_nids[i : i + 500]))
        keep.update(col.db.list(f"select distinct case when odid then odid else did end from cards where nid in ({chunk})"))
    removed_decks = 0
    for did in decks:
        deck = col.decks.get(did, default=False)
        if not deck or did in keep or deck.get("dyn"):
            continue
        if col.decks.card_count(did, include_subdecks=True) == 0 and not list(col.decks.children(did)):
            col.decks.remove([did])
            removed_decks += 1
    return removed, removed_decks
