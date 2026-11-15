# About this fork

This is a personal fork of [PawMethod/kanji-draw-anki](https://github.com/PawMethod/kanji-draw-anki). It adapts the
KanjiDraw note type to a German Heisig deck (*„Die Kanji lernen und behalten“*, 4th ed.) with its own field set
and some extra features. Everything else is upstream's work and documentation; the [README](README.md) is upstream's
text with only a fork note at the top.

> **Status (2026-11-12).** Based on upstream **v3.0.0** (`b853acf`) plus the changes below. This version is
> installed in the deck's study profile.

**Contents:** [How the fork is organised](#how-the-fork-is-organised) · [Fields](#fields) ·
[Deck data](#deck-data) · [Changes](#changes) · [Settings and defaults](#settings-and-defaults) ·
[Switching from upstream's deck](#switching-from-upstreams-deck) · [Fork files](#fork-files) · [Upstream candidates](#upstream-candidates)

## How the fork is organised

The fork stays as close to upstream as possible so upstream updates merge easily:

- Fork changes are small and additive. Upstream code isn't refactored, reformatted or renamed.
- Fork-only code is marked with a `fork:` comment, uses `kd-`-prefixed CSS classes, and lives in its own files
  where possible (`Templates/src/**/kd-fork-*`).
- Code shared between the cards lives in `Templates/src/` and is copied into the four templates by
  `python3 Tools/build.py` (between `[KD-SRC …]` markers). Edit the sources, then build.
- Card 1 and Card 2 get the same change in the same way.

## Fields

The templates use this fork's field names instead of upstream's:

| Upstream field | Fork field |
|---|---|
| `Bedeutung` | `Bedeutung-DE`, replaced by `Bedeutung-Override` when that is filled |
| `JLPT` | `JLPT-Level` |
| `Nummer` | `Kanjinummer-BuchDE-Edition-4` |
| `Eselsbrücke` | `Merksatz-KI` |

These upstream fields keep their names: `Kanji`, `SVGPfade`, `Radikale`, `Stolperfallen`, `Merkhilfe`,
`Wortbeispiel`, `Onyomi`, `Kunyomi`, `Häufigkeit`.

Fields only the fork uses:

| Field | Shown as |
|---|---|
| `PrimitivBedeutung-DE` | Primitive-meaning pills next to the keyword (comma-separated) |
| `PrimitivBedeutung-Override` | Replaces `PrimitivBedeutung-DE` when filled |
| `Merksatz-Custom`, `Merksatz-DE` | Story boxes in "Eselsbrücken" (source "Merksätze") |
| `BuchBeschreibung`, `BuchPrimitivBeschreibung` | Story boxes under `HEISIG` (source "Heisig") |
| `Nanori` | Third row in "Lesungen" |
| `Notiz` | Section "Notiz" |

**Primitive notes:** the deck also has notes for primitives. Their `Kanji` field holds a bracketed name such as
`[Spazierstock]` instead of a glyph. The templates detect them by the leading `[`.

The deck's contents are not in this repo; [Deck data](#deck-data) describes how they differ from upstream's deck.

## Deck data

Upstream ships its own deck. This fork's deck is a separate one: the German Heisig deck
`Kanji::🏮Benni's RTK Deutsch🏮` with the note type `Mobi's Die Kanji lernen & behalten 1`, 2363 notes
(2200 kanji, 163 primitives) and 30 fields. Its data was changed with private scripts that go through AnkiConnect
(dry run, apply, undo, each tested on a copy first). Scheduling, review history and flags were never touched. The
data itself is not in this repo.

### Fields taken from upstream's deck (v3)

| Field | Change in this deck |
|---|---|
| `Stolperfallen` | New field, after `Radikale`. Imported unchanged for 2199 kanji. Not for 籠, because upstream has the variant 篭 and its stroke references would not match. |
| `Merkhilfe` | New field, after `Merksatz-KI`. Imported for 2199 kanji. In 70 of them the component names were changed to this deck's names. |
| `Merksatz-KI` | Holds upstream's `Eselsbrücke`, which replaced the previous texts for 2199 kanji; primitives keep theirs. In 391 texts the component names were changed to this deck's names (e.g. upstream's "Pfote" becomes "Finger"), with the grammar adjusted. |
| `Radikale` | Converted to upstream's tree format with stroke ranges and nesting (`吾[Ich]@8-14{五[fünf]@8-11, …}`) for 2346 notes. The names stay this deck's (book) names. Details below. |
| `Bedeutung-DE` | Upstream's wording for 2 kanji (a typo and a stray line break); this deck's wording kept for the other 3 differences. |

Kept from this deck instead of upstream: the book numbers (German 4th edition; upstream follows the English
edition, e.g. 斬 1214 / 誓 1215 are swapped there) and the stroke paths where the book's form differs from
upstream's.

### Component trees (`Radikale`)

- **Names.** Top-level parts keep the note's own names. Nested parts take the name from that part's own note
  (e.g. 吾 inside 語 uses the 吾 note), otherwise this deck's usual name for that glyph.
- **Reviewed by hand.** 95 kanji where the decks disagreed: 84 use upstream's tree, 4 this deck's decomposition with
  upstream's stroke ranges, and 7 trees were built by hand.
- **Corrections to upstream's trees.** 廾 is the book's "Blume" (now 艹). 尤 stays whole ("Chihuahua mit einem
  Menschenbein") instead of 尢 + 丶. 爾 in 璽 is not split further. 金 is split König 3–5+8, Tropfen 6 and 7
  (upstream: König 3–6), in 金 and the 33 kanji containing it.
- **Primitives.** The 109 single-part primitives cover all their strokes. 36 multi-part primitives got their parts with
  stroke ranges, split down as far as the deck allows (e.g. Marsch → Parade → Straßenfest → Pfeil + Tropfen). 18 that
  list related forms rather than parts keep their entry. Where a kanji contains one of these primitives, its tree
  uses the primitive's parts.
- **Missing parents.** An audit added three missing intermediate parts: 昆 in 混, 苗 in 猫, 刑 in 型.

### Colour-coded mnemonics (this deck only)

Component names and keywords in the book-based texts are marked with upstream's colour spans
(`<span class="kd-kw kd-c1">`), coloured by the top-level part of the tree they belong to:
`Merksatz-DE` (2341 notes), `BuchBeschreibung` (2331), `BuchPrimitivBeschreibung` (127). Indirect wording counts too,
e.g. "Worte" for the part "sagen" (言). Two AI models proposed the spans independently, and every field was
approved by hand. `Merksatz-Custom` is unchanged.

### Earlier cleanup of this deck (before v3)

- **Stroke paths (`SVGPfade`).** Broken paths replaced with KanjiVG. Where the book prints a different form,
  KanjiVG's variant was used; a few were built by hand (e.g. 箋, 嗅).
- **Stroke counts (`Strichanzahl`).** Equal to the number of strokes in the paths. Book misprints and book-specific
  stroke splits are noted in `Notiz`.
- **Primitives.** All 163 primitive notes completed (7 added): stroke paths, components, short Merksätze,
  English names, `Wortbeispiel` (kanji that use the primitive) and `Häufigkeit` (how often it is used).
- **Order.** `Kanjinummer-BuchDE-Edition-4_mitPrimitive` numbers all notes 1–2363 in book order, primitives
  after their frame. New cards come in that order.
- **Book numbers.** German 4th edition checked (all correct); the English 6th edition numbers (誓/斬) and 5 German
  3rd edition numbers were corrected.

## Changes

Each entry: what it does, then where the code is. *Upstream candidate* marks generic fixes that could go upstream.

### Back side

- **Inline sections instead of the info modal.** The back shows everything as collapsible sections in this order:
  Elemente, Eselsbrücken, Strichfolge, Notiz, Schreibfehler, Wortbeispiele, Lesungen, Externe Links. Each section
  remembers whether it is open. Strichfolge and Schreibfehler start closed and load on first open. The header
  shows JLPT, frequency and the book number. Dragging vertically over the tree scrolls the page.
  *Code:* `src/back/kd-fork-sections.js` (`KD_SECTIONS` sets order, titles, icons and default state),
  `#kd-info-inline` / `.kd-section` in both back templates, one fork line in `src/back/primitive-tree.js`
  (`treeModalEl`).
- **Several mnemonic sources.** "Eselsbrücken" groups the texts by source:
  - Merksätze: `Merksatz-Custom` and `Merksatz-DE`
  - KanjiDraw: upstream's `Merkhilfe` hint and `Merksatz-KI`
  - Heisig: the book texts, under a muted `HEISIG` label

  Each source can be switched on or off per card type (toggle chips on the "Rückseite" settings page). The
  section hides when all three are off. All story texts are upright. Empty groups are removed.
  *Code:* `.kd-story-group-*` in the back templates, `src/front/kd-fork-back-settings.html`,
  `src/front/kd-fork-source-settings.js`.
- **Notiz.** A free-form note section, hidden when the field is empty or holds only line breaks.
  *Code:* `.kd-note-box`, section key `notiz`.
- **Nanori.** A third reading row with a muted outlined `NANORI` label. Can be switched on or off per card type;
  off by default. *Code:* `.kd-nanori-label`, `.kd-nanori-row`.
- **Handschriftbeispiele.** The kanji in three more fonts above the tree (on by default; "Rückseite"). The fonts
  are collection media files (`_kanji_font2_kai08.otf`, `_kanji_font3_ArmedBanana.ttf`,
  `_kanji_font4_KouzanGyousho.otf`) and are not part of this repo. *Code:* `.kanji-font-examples`.
- **Primitive notes.** No font samples; the tree's root row is hidden, and "Elemente" is hidden when `Radikale`
  only names the primitive itself. *Code:* `.custom-tree-box.is-primitive`.
- **Landscape at the bottom.** The back is taller than one screen, so the landscape sits at the bottom of the page
  instead of the screen.
- **Faster reveal.** The info area fades in over 0.1 s.
- **Settings take effect at once.** Changing a back option redraws the visible back without flipping the card.

### Front and title

- **Meaning overrides.** `Bedeutung-Override` / `PrimitivBedeutung-Override` replace the keyword and the primitive
  meanings when filled. *Code:* Anki conditionals in both fronts' `.card-title`, marked `<!-- fork: … -->`.
- **Primitive-meaning pills.** Each meaning in `PrimitivBedeutung-DE` gets its own pill in the keyword's row, with
  a `PRIMITIVE` tag on the top-right pill. Pills wrap one by one. On phones, short pills share a row even at
  320 px. *Code:* `src/front/kd-fork-primitive-chips.js` (`.kd-title-row`, `.primitive-group` with
  `display: contents`, `.primitive-box`, `.primitive-label`; a ResizeObserver repositions the tag).
- **Long keywords.** Long one-word keywords hyphenate (German) or shrink to fit instead of running into the gear
  button. Only the keyword is fitted, after the primitive meanings are moved out.
- **Faster pill reveal.** Keyword and primitive pills enter together in 0.18 s without stagger. Card 2 reveals
  both answers in 0.15 s without delay. With reduced motion these animations are off.

### Drawing and comparison

- **Free drawing by default.** New installations start in "Frei"; a saved "Geführt" choice still wins. Front and
  back resolve the same default.
- **Side-by-side comparison** (Card 1, restored from before v3). After free drawing, the back shows your
  handwriting next to the reference, with grading, stroke numbers and the grid. The "Striche zu viel / zu wenig"
  badges sit under the matching drawing at any window width. The comparison takes only the height of its two
  pads (8 px gap above). Even an empty free drawing shows the missing strokes.
  Switch with "Nebeneinander / Einzeln" on "Rückseite"; guided drawing and Card 2 are unchanged.
  *Code:* `src/back/kd-fork-comparison.js`, `src/back/kd-fork-comparison-grid.js`, `.side-by-side-*`,
  `.sbs-badge-row`.
- **SVG stroke loading.** Both fronts read `SVGPfade` from an inert `<template id="kd-stroke-source">` and build
  the SVG paths in script, so HTML line breaks or wrappers in the field can't cut the kanji off after its first
  stroke. Field contents are unchanged. *Code:* `src/front/kd-fork-svg-paths.js`. *Upstream candidate.*

### Component tree (Elemente)

- **Root meaning.** The root kanji gets the same label pill as its components, with the effective meaning
  (override, else `Bedeutung-DE`). *Code:* `.kd-tree-root-keyword`; fork lines in `src/back/primitive-tree.js`.
- **Height by depth.** Trees with four or more levels get a taller box (+90 px per level beyond three, up to
  590 px) so their nodes stay readable. *Code:* `boxH` in `src/back/primitive-tree.js`. *Upstream candidate.*
- **Esc closes fullscreen.** *Code:* one document `keydown` listener (`window._kdTreeEscBound`) in
  `src/back/primitive-tree.js`. *Upstream candidate.*
- **Larger tool buttons.** Zoom and fullscreen buttons are 36 px in Verspielt (42 px on touch screens). Minimal
  uses 40 / 44 px.

### Appearance

- **Design switch.** A global setting ("Design: Verspielt / Minimal" on "Erscheinungsbild"):
  - **Verspielt** is upstream's v3 look.
  - **Minimal** is the plain pre-v3 look with the classic outline icons. It applies to every surface:
    settings, sections, player, Schreibfehler, tree tools, sound settings and Danke.

  All v3 features stay in both designs. Minimal keeps neutral surfaces with any accent colour, and its
  tool buttons are larger. *Code:* `src/front/kd-fork-design-early.js` (sets `html.kd-design-minimal` before
  the first paint), `src/front/kd-fork-design.js` (icon swap, `kdSetDesign`), the `html.kd-design-minimal` block
  in `Styling.css`.
- **Accent "Schlicht".** A black/white accent colour (7 accents in total). All swatches have the same size; on
  phones they wrap into four columns. *Code:* `plain` in `_accentColors`, `html.kd-accent-plain`, `.kd-swatch-plain`.
- **Word examples.** Furigana sit slightly higher above the kanji.

### Sound (engine 1.2.2)

- **Quieter music.** The music's reverb and echo now follow the music level; before, they bypassed it, so the three
  steps differed by only about 5 dB. The levels are also lower: 0.16 / 0.32 / 0.55 instead of 0.45 / 0.7 / 1.
  Stroke sounds and effects are unchanged. *Code:* `MLEVEL`, `MSEND_REF` in `src/audio/02-tables.js`,
  `G.musicVerb` / `G.musicEcho` in `src/audio/05-graph.js`. *Upstream candidate* (the bypass).
- **Windows playback.** Windows requests `latencyHint: 'balanced'`, and bars that a UI stall made overdue are
  skipped instead of being scheduled in the past. *Code:* `src/audio/05-graph.js`, `src/audio/15-control.js`.
  *Upstream candidate.*
- **Sound defaults from CSS.** The sound controls and the engine read their defaults from `--default-sound-*`
  (see [Settings and defaults](#settings-and-defaults)). *Code:* `src/front/sound-bridge.js`.

### Input

- **Pen scrolling on Anki Desktop.** Qt WebEngine treats a Windows Ink pen drag like a mouse drag, so it selected
  text instead of scrolling. A pen swipe now scrolls the card or the settings dialog, with a short glide. It
  respects `touch-action` like a browser, so the drawing pad and the tree keep their own pen handling. Mouse
  input and other platforms are unchanged. *Code:* `src/front/kd-fork-pen-scroll.js`, `html.kd-pen-panning`.

## Settings and defaults

Settings use upstream's persistence chain (`window._ks` → cookie `_k` → localStorage → add-on). Saved choices
always win over the CSS defaults; deck defaults are the `--default-*` variables at the top of `Styling.css`.
"Per card" keys are stored with a `c1_` / `c2_` prefix (Card 1 / Card 2).

| Setting (page) | Storage key | CSS default | Default | Scope |
|---|---|---|---|---|
| Design (Erscheinungsbild) | `kanjiThemeDesign` | `--default-theme-design` | `kd` (Verspielt); `minimal` | global |
| Accent (Erscheinungsbild) | `kanjiThemeAccent` (upstream) | `--default-theme-accent` | `green`; new value `plain` = Schlicht | global |
| Japan theme (Erscheinungsbild) | `kanjiThemePrimary` (upstream) | `--default-theme-primary` | `random` (upstream: `sage`) | global |
| Drawing mode (Zeichnen) | `kanjiOptDrawMode` (upstream) | `--default-opt-draw-mode` | `free` (upstream: `guided`) | per card |
| Merksätze source (Rückseite) | `kanjiOptMerksaetze` | `--default-opt-merksaetze` | `on` | per card |
| KanjiDraw source (Rückseite) | `kanjiOptKanjiDraw` | `--default-opt-kanji-draw` | `off` | per card |
| Heisig source (Rückseite) | `kanjiOptHeisig` | `--default-opt-heisig` | `on` | per card |
| Nanori (Rückseite) | `kanjiOptNanori` | `--default-opt-nanori` | `off` | per card |
| Handschriftbeispiele (Rückseite) | `kanjiOptHandwriting` | `--default-opt-handwriting` | `on` | per card |
| Comparison (Rückseite) | `kanjiOptSideBySide` | `--default-opt-side-by-side` | `on` (Nebeneinander) | Card 1 |
| Section open/closed | `kdSec_<key>` | `collapsed` in `KD_SECTIONS` | Strichfolge, Schreibfehler closed | global |
| Volume (Klang & Musik) | `kanjiSoundLevel` | `--default-sound-level` | `low` (upstream: `off`) | global |
| Music style | `kanjiSoundMusic` | `--default-sound-music` | `lofi` (upstream: `off`) | global |
| Music volume | `kanjiSoundMusicLevel` | `--default-sound-music-level` | `low` (upstream: `mid`) | global |
| Reaction | `kanjiSoundImmersion` | `--default-sound-immersion` | `low` | global |
| Stroke / effect sounds | `kanjiSoundStroke`, `kanjiSoundFx` | `--default-sound-stroke`, `--default-sound-fx` | `on` | global |

Music still needs a first tap where the browser blocks autoplay.

## Switching from upstream's deck

The add-on in [`Migration/`](Migration/README.md) ("KanjiDraw: Lernfortschritt übernehmen", Anki Desktop 23.10+) is for
people who studied with upstream's deck and import this one, or the other way round. It moves their progress onto the
other deck's cards in one go, so they keep their reviews. It's a one-time tool, separate from the persistence add-on.
The ready package is [`Migration/dist/kanji_draw_migration.ankiaddon`](Migration/dist/kanji_draw_migration.ankiaddon),
built by `Tools/build_migration_addon.py` (a test fails if it is stale).

- **Matching:** same glyph in `Kanji` (upstream's 篭 = this deck's 籠), Card 1 → Card 1, Card 2 → Card 2. Note types
  are found by their fields, so renamed ones work, and upstream v1's old field names too.
- **Direction:** chosen in the dialog, preselected away from the deck with more studied cards. Fork → upstream
  transfers the same scheduling, history, states and tags, but no own edits (upstream has no free fields for them).
  The fork's primitives have no upstream partner; they keep their progress and stay in the fork's deck.
- **Transferred:** the scheduling of studied cards, including FSRS memory state, through Anki's card API, so a normal
  sync uploads it. Also suspended, buried and flagged new cards, tags, and optionally the old deck's options preset.
  The review history is *copied* with new ids, because AnkiWeb ignores entries it already has, so a move would not
  sync. As a result, collection-wide stats count those reviews twice (more on a round trip).
- **Own edits** (upstream → fork only): fields that differ from upstream v3's text go to `Merksatz-Custom` (`Eselsbrücke`),
  `Bedeutung-Override` (`Bedeutung`) or a labelled line in `Notiz`, appended to existing text.
  [`upstream_v3_hashes.json`](Migration/upstream_v3_hashes.json) holds short hashes of upstream's v3 values (no
  text), made by `Tools/make_migration_hashes.py`. For older upstream versions only notes changed after import count.
- **Safety:** preview first, then an Anki backup, the transfer and a check of every card. Fork cards that are already
  studied are skipped, a second run changes nothing, and cards in filtered decks block the run. Only after a clean
  check does it offer to delete the old notes and their empty deck.
- **Tests:** [`Tests/migration/`](Tests/migration/test_migration.py) covers SM-2 and FSRS, all card states, re-runs,
  deletion, filtered decks, older versions and the way back. It also syncs to a second device through Anki's own sync
  server, there and back, and checks that a normal sync is enough each time.

## Fork files

New files (everything else is a marked edit of an upstream file):

| File | Purpose |
|---|---|
| `src/back/kd-fork-sections.js` | Inline back sections, `KD_SECTIONS`, lazy Strichfolge/Schreibfehler, Notiz/empty-group handling |
| `src/back/kd-fork-comparison.js`, `kd-fork-comparison-grid.js` | Side-by-side comparison and its grid |
| `src/front/kd-fork-primitive-chips.js` | Primitive-meaning pills, `PRIMITIVE` tag, keyword fitting |
| `src/front/kd-fork-design-early.js`, `kd-fork-design.js` | Design switch (Verspielt / Minimal), icon swap |
| `src/front/kd-fork-back-settings.html`, `kd-fork-source-settings.js` | "Rückseite" settings: source chips, Nanori |
| `src/front/kd-fork-svg-paths.js` | Inert stroke source → SVG paths |
| `src/front/kd-fork-pen-scroll.js` | Pen scrolling on Anki Desktop |
| `Tests/js/test_fork_settings.js`, `test_audio_scheduling.js` | Node tests: settings/defaults resolution, audio scheduling |
| `Tests/browser/check_fork_*.py` | Playwright checks against Anki-rendered cards (back options, mobile title, strokes, reveal timing); see [Tests/browser/README.md](Tests/browser/README.md) |
| `Migration/` | Add-on to switch between upstream's deck and this one (see [above](#switching-from-upstreams-deck)); the built package is in `Migration/dist/` |
| `Tools/build_migration_addon.py` | Builds `Migration/dist/kanji_draw_migration.ankiaddon`; `--check` verifies it |
| `Tools/make_migration_hashes.py` | Builds `Migration/upstream_v3_hashes.json` from upstream's v3 deck |
| `Tests/migration/test_migration.py` | Tests for the migration add-on, incl. a sync round trip (needs `anki` from PyPI) |
| `FORK.md` | This file |

Paths under `src/` are relative to `Templates/`. `.gitignore` additionally ignores the local agent instruction files
`AGENTS.md` / `CLAUDE.md`.

## Upstream candidates

Generic fixes that don't depend on this deck and could be offered upstream (no PRs have been opened):

- SVG stroke loading from an inert template (`kd-fork-svg-paths.js`)
- Music reverb/echo following the music level
- Windows audio latency and overdue-bar skipping
- Esc to close the fullscreen tree; tree height by nesting depth
- Faster answer reveal and reduced-motion handling of the title/pill animations
- Comparison badges sized to the pads

## License and attribution

Same as upstream, see [LICENSE](LICENSE) and the attribution section in the [README](README.md).
