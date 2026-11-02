#!/usr/bin/env python3
"""Build headless test harnesses for the audio integration from the repo
templates + one real note (fields via AnkiConnect).

  harness_c1.html / harness_c2.html  (front side)
  harness_c1b.html                   (back side of card 1, includes FrontSide)

Each page records all window.__kdAudio calls (spy injected right after the
engine block), runs a scripted interaction and logs `KDR <json>` lines.
"""
import json
import pathlib
import re
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
TPL = HERE.parents[1] / 'Templates'


def ac(action, **params):
    req = json.dumps({'action': action, 'version': 6, 'params': params}).encode()
    r = json.load(urllib.request.urlopen('http://127.0.0.1:8765', req, timeout=10))
    if r.get('error'):
        raise SystemExit(r['error'])
    return r['result']


nid = ac('findNotes', query='note:KanjiDraw Kanji:学')[0]
fields = {k: v['value'] for k, v in ac('notesInfo', notes=[nid])[0]['fields'].items()}


def render(src, front_side=''):
    def sect(m):
        neg, name, body = m.group(1) == '^', m.group(2), m.group(3)
        has = bool(fields.get(name, '').strip())
        return body if has != neg else ''
    for _ in range(3):
        src = re.sub(r'\{\{([#^])([^}]+)\}\}(.*?)\{\{/\2\}\}', sect, src, flags=re.S)

    def field(m):
        name = m.group(1).split(':')[-1].strip()
        if name == 'FrontSide':
            return front_side
        return fields.get(name, '')
    return re.sub(r'\{\{([^}#/^]+)\}\}', field, src)


SPY = """<script>
window.__kdThemeBeforeMain = document.documentElement.getAttribute('data-jp-theme');
(function () {
    window.__kdCalls = []; window.__kdErrors = [];
    window.addEventListener('error', function (e) { __kdErrors.push(String(e.message) + ' @' + e.lineno); });
    var a = window.__kdAudio; if (!a || a.__spied) return; a.__spied = true;
    ['configure', 'setScene', 'cardShown', 'strokeStart', 'strokeMove', 'strokeEnd', 'strokeResult', 'complete', 'fx', 'demoStroke'].forEach(function (m) {
        var f = a[m]; a[m] = function () { __kdCalls.push([m].concat([].slice.call(arguments).map(function (x) { return typeof x === 'object' ? JSON.stringify(x) : x; }))); return f.apply(this, arguments); };
    });
})();
</script>
"""

TEST = (HERE / 'harness_test.js').read_text(encoding='utf-8')
css = (TPL / 'Styling.css').read_text(encoding='utf-8')


def page(name, body_cls, html):
    html = html.replace('<!-- [/KD-AUDIO-ENGINE] -->', '<!-- [/KD-AUDIO-ENGINE] -->\n' + SPY, 1)
    doc = (f'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" '
           f'content="width=device-width, initial-scale=1"><style>{css}</style></head>'
           f'<body class="card {body_cls}"><script>if (/random/.test(location.search)) {{ try {{ localStorage.setItem("kanjiThemePrimary", "random"); }} catch (e) {{ }} }}'
           f'if (/soundon/.test(location.search)) {{ try {{ localStorage.setItem("kanjiSoundLevel", "mid"); localStorage.setItem("kanjiSoundMusic", "zen"); }} catch (e) {{ }} }}</script>'
           f'<div id="qa">{html}</div>'
           f'<script>window.__kdHarness = {json.dumps(name)};\n{TEST}</script></body></html>')
    (HERE / f'harness_{name}.html').write_text(doc, encoding='utf-8')
    print('wrote', f'harness_{name}.html', len(doc) // 1024, 'KB')


c1f = render((TPL / 'Card-1/FrontTemplate.html').read_text(encoding='utf-8'))
c2f = render((TPL / 'Card-2/FrontTemplate.html').read_text(encoding='utf-8'))
c1b = render((TPL / 'Card-1/BackTemplate.html').read_text(encoding='utf-8'), front_side=c1f)
page('c1', 'card1', c1f)
page('c2', 'card2', c2f)
page('c1b', 'card1', c1b)
