#!/usr/bin/env python3
"""Embed the KanjiDraw audio engine and the "Klang & Musik" settings page
into both front templates (Card-1 / Card-2).

Idempotent: on re-run, the blocks between the markers are replaced, so engine
updates are a single `python embed_audio.py` away.
"""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
TPL = HERE.parents[1] / 'Templates'
FILES = [TPL / 'Card-1/FrontTemplate.html', TPL / 'Card-2/FrontTemplate.html']

ENGINE = (HERE / 'kd-audio-engine.js').read_text(encoding='utf-8').rstrip()
PAGE = (HERE / 'page-sound.html').read_text(encoding='utf-8').strip('\n')

# Anki template syntax and the HTML parser must not see these inside the script
for bad in ('{{', '}}', '</'):
    if bad in ENGINE:
        sys.exit(f'engine contains forbidden sequence {bad!r}')

EB, EE = '<!-- [KD-AUDIO-ENGINE] -->', '<!-- [/KD-AUDIO-ENGINE] -->'
PB, PE = '<!-- [KD-SOUND-PAGE] -->', '<!-- [/KD-SOUND-PAGE] -->'

ENGINE_BLOCK = f'{EB}\n<script>\n{ENGINE}\n</script>\n{EE}\n'
PAGE_BLOCK = f'        {PB}\n{PAGE}\n        {PE}\n'

# Main card script starts with this header in both templates
ENGINE_ANCHOR = re.compile(r'(?m)^<script>\n    // =+\n    // FrontTemplate-Card-[12] ')
# End of the "Erscheinungsbild" page = last settings page before the modal closes
PAGE_ANCHOR = re.compile(
    r'(?m)^            <div role="button" tabindex="0" class="close-settings" '
    r'onclick="closeSettings\(event\)">Schließen</div>\n        </div>\n'
    r'(?=    </div>\n</div>\n\n<div class="forest-scenery")')


def put(text, begin, end, block, anchor, before):
    if begin in text:
        i = text.rfind('\n', 0, text.index(begin)) + 1
        j = text.index(end, i) + len(end)
        if text[j:j + 1] == '\n':
            j += 1
        return text[:i] + block + text[j:], 'replaced'
    found = list(anchor.finditer(text))
    if len(found) != 1:
        sys.exit(f'anchor matched {len(found)}x: {anchor.pattern[:60]}')
    pos = found[0].start() if before else found[0].end()
    return text[:pos] + block + text[pos:], 'inserted'


for f in FILES:
    src = f.read_text(encoding='utf-8')
    out, a = put(src, EB, EE, ENGINE_BLOCK, ENGINE_ANCHOR, before=True)
    out, b = put(out, PB, PE, PAGE_BLOCK, PAGE_ANCHOR, before=False)
    if out != src:
        f.write_text(out, encoding='utf-8')
    print(f'{f.parent.name}/{f.name}: engine {a}, page {b}, '
          f'{len(src.splitlines())} -> {len(out.splitlines())} lines')
