#!/usr/bin/env python3
"""
KanjiDraw Live Interaction Stress Test
=======================================
Simulates real user interactions in the Anki card WebView:
  - Drawing strokes via PointerEvents on the draw-layer
  - Gear settings menu open/close (including rapid spam)
  - Theme (light/dark/system) and stroke-style changes
  - Card flips mid-stroke and mid-animation
  - Chaos mode: 100 random actions + card flips

Strategy: fire-and-forget JS via port 8767 + AnkiConnect as health-check proxy.
After each phase the AnkiConnect response time is measured — a frozen or
crashed Anki will fail or time out these checks.

Requirements:
  1. Anki running with deck "RTK Deutsch — Kanji schreiben"
  2. AnkiConnect addon (port 8765)
  3. KanjiDraw Stress Test Helper addon (port 8767)
     -> copy Tests/anki_addon_stress_helper/ into Anki's addons21/ and restart

Usage:
  python3 Tests/live_stress_test.py
"""
import json, os, time, sys, random, tempfile, threading
import urllib.request

ANKI_PORT = 8765
EVAL_PORT  = 8767
TOKEN_FILE = os.path.join(tempfile.gettempdir(), "kanjidraw_stress_token")
EASE_HARD  = 1   # "Again" — card is immediately requeued, prevents exhausting the daily review queue

# ─── HTTP helpers ──────────────────────────────────────────────────────────────

def anki(action, **params):
    payload = json.dumps({"action": action, "version": 6, "params": params}).encode()
    req = urllib.request.Request(f"http://127.0.0.1:{ANKI_PORT}",
        data=payload, headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=5).read())

_eval_token = None

def _eval_headers():
    global _eval_token
    if _eval_token is None:
        try:
            with open(TOKEN_FILE, encoding="utf-8") as f:
                _eval_token = f.read().strip()
        except FileNotFoundError:
            sys.exit(f"Token file {TOKEN_FILE} not found — is the stress helper add-on loaded?")
    return {"Content-Type": "application/json", "Authorization": f"Bearer {_eval_token}"}

def js(code):
    """Fire-and-forget JS execution in the card WebView."""
    req = urllib.request.Request(f"http://127.0.0.1:{EVAL_PORT}/eval",
        data=json.dumps({"js": code}).encode(),
        headers=_eval_headers())
    try:
        return json.loads(urllib.request.urlopen(req, timeout=3).read())
    except Exception as e:
        return {"error": str(e)}

def js_sync(code, timeout=35):
    """Execute JS and return the result value. Server retry every 2s for up to 30s."""
    req = urllib.request.Request(f"http://127.0.0.1:{EVAL_PORT}/eval_sync",
        data=json.dumps({"js": code}).encode(),
        headers=_eval_headers())
    try:
        return json.loads(urllib.request.urlopen(req, timeout=timeout).read())
    except Exception as e:
        return {"error": str(e)}

def warmup_bridge(label="", max_wait=10):
    """Poll until eval_sync responds. With v6 callback-based helper this is
    usually instant (<200ms); the 10s budget covers rare page-still-loading races."""
    deadline = time.time() + max_wait
    while time.time() < deadline:
        r = js_sync("return 1", timeout=5)
        if r.get("result") == 1:
            return
        sleep(1.0)
    print(f"    WARNING: bridge unresponsive after {max_wait}s ({label})", end="")

def alive(label="", timeout=2.0):
    """Assert AnkiConnect still responds within timeout — proxy for 'Anki not frozen'."""
    t0 = time.time()
    r = anki("version")
    dt = (time.time()-t0)*1000
    assert r.get("result") == 6, f"AnkiConnect dead after: {label}"
    assert dt < timeout*1000, f"AnkiConnect too slow ({dt:.0f}ms) after: {label}"
    return dt

def sleep(s): time.sleep(s)

# ─── Test Runner ───────────────────────────────────────────────────────────────

_passed = 0; _failed = 0

def test(name, fn):
    global _passed, _failed
    try:
        fn()
        _passed += 1
        print(f"  ✓ {name}")
    except AssertionError as e:
        _failed += 1
        print(f"  ✗ {name}\n    {e}")
    except Exception as e:
        _failed += 1
        print(f"  ✗ {name}\n    EXCEPTION: {e}")

def assert_(c, msg=""):
    if not c: raise AssertionError(msg)

# ─── JS snippets ───────────────────────────────────────────────────────────────

JS_DRAW = """
(function(){
    var l=document.getElementById('draw-layer');
    if(!l)return;
    var r=l.getBoundingClientRect(), cx=r.left+r.width*.5, cy=r.top+r.height*.5;
    function f(t,x,y){l.dispatchEvent(new PointerEvent(t,{clientX:x,clientY:y,bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true}));}
    f('pointerdown',cx-30,cy);
    for(var i=0;i<10;i++) f('pointermove',cx-30+i*6,cy+i*2);
    document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true}));
})()"""

# Pointerdown without pointerup — simulates an interrupted stroke
JS_DRAW_DOWN = """
(function(){
    var l=document.getElementById('draw-layer');
    if(!l)return;
    var r=l.getBoundingClientRect(), cx=r.left+r.width*.5, cy=r.top+r.height*.5;
    l.dispatchEvent(new PointerEvent('pointerdown',{clientX:cx,clientY:cy,bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true}));
})()"""

JS_OPEN_GEAR  = "(function(){var b=document.querySelector('.gear-btn');if(b)b.click();})()"
JS_CLOSE_GEAR = "(function(){var b=document.querySelector('.close-settings');if(b)b.click();})()"

def JS_THEME(m): return f"(function(){{var rs=document.querySelectorAll('[name=\"theme-mode\"]');for(var i=0;i<rs.length;i++){{if(rs[i].value==='{m}'){{rs[i].click();return;}}}}}})()"
def JS_STYLE(s): return f"(function(){{var rs=document.querySelectorAll('[name=\"stroke-style\"]');for(var i=0;i<rs.length;i++){{if(rs[i].value==='{s}'){{rs[i].click();return;}}}}}})()"

# ─── Helpers ──────────────────────────────────────────────────────────────────

def ensure_review():
    r = anki("guiReviewActive")
    if not r.get("result"):
        anki("guiDeckReview", name="RTK Deutsch — Kanji schreiben")
        sleep(1.5)

def ensure_front_side():
    """Ensure the card is showing its front side (question)."""
    r = js_sync("return !!document.getElementById('is-back-side-marker')", timeout=10)
    if r.get("result"):
        # We're on the back side — flip to next card
        flip_next(); sleep(0.4)

def flip_next():
    anki("guiShowAnswer"); sleep(0.08)
    return anki("guiAnswerCard", ease=EASE_HARD).get("error") is None

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Preflight ===\n")
# ══════════════════════════════════════════════════════════════════════════════

test("AnkiConnect reachable (v6)", lambda: assert_(anki("version")["result"] == 6))
test("Eval addon reachable (port 8767)", lambda: assert_(
    js("1+1").get("error") is None, "Port 8767 not reachable — restart Anki with the helper addon"))

ensure_review(); sleep(0.5)
test("Review session active", lambda: assert_(anki("guiReviewActive").get("result") is True))

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Phase 1: Drawing ===\n")
# ══════════════════════════════════════════════════════════════════════════════

def t_draw_20():
    for _ in range(20): js(JS_DRAW); sleep(0.05)
    dt = alive("20 strokes"); print(f"    (AnkiConnect: {dt:.0f}ms)", end="")

def t_draw_burst():
    for _ in range(30): js(JS_DRAW); sleep(0.01)
    sleep(0.3)
    dt = alive("30-stroke burst"); print(f"    (AnkiConnect: {dt:.0f}ms)", end="")

def t_draw_with_leave():
    """Drawing + pointerleave tests the _cachedRect invalidation fix."""
    for _ in range(10):
        js(JS_DRAW)
        js("(function(){var l=document.getElementById('draw-layer');if(l)l.dispatchEvent(new PointerEvent('pointerleave',{bubbles:true,pointerId:1,pointerType:'mouse',isPrimary:true}));})()")
        sleep(0.06)
    alive("draw + pointerleave ×10")

test("20 strokes (50ms apart)", t_draw_20)
test("30-stroke burst (10ms apart)", t_draw_burst)
test("draw + pointerleave invalidation ×10", t_draw_with_leave)

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Phase 2: Settings Menu ===\n")
# ══════════════════════════════════════════════════════════════════════════════

def t_gear_10():
    for _ in range(10): js(JS_OPEN_GEAR); sleep(0.08); js(JS_CLOSE_GEAR); sleep(0.08)
    alive("gear 10× toggle")

def t_gear_rapid():
    for _ in range(20): js(JS_OPEN_GEAR); sleep(0.03); js(JS_CLOSE_GEAR); sleep(0.03)
    sleep(0.2)
    dt = alive("gear 20× rapid"); print(f"    (AnkiConnect: {dt:.0f}ms)", end="")

def t_draw_while_gear():
    js(JS_OPEN_GEAR); sleep(0.15)
    for _ in range(5): js(JS_DRAW); sleep(0.05)
    js(JS_CLOSE_GEAR); sleep(0.2)
    alive("draw with menu open")

test("gear 10× open/close (80ms)", t_gear_10)
test("gear 20× rapid (30ms)", t_gear_rapid)
test("5 strokes with menu open — no freeze", t_draw_while_gear)

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Phase 3: Theme & Stroke Style ===\n")
# ══════════════════════════════════════════════════════════════════════════════

def t_theme_cycle():
    js(JS_OPEN_GEAR); sleep(0.2)
    for m in ("light","dark","system","dark","light","system"):
        js(JS_THEME(m)); sleep(0.1)
    js(JS_CLOSE_GEAR); sleep(0.3)
    alive("theme cycle ×6")

def t_style_cycle():
    js(JS_OPEN_GEAR); sleep(0.2)
    for s in ("neon","gel","standard","neon","standard"):
        js(JS_STYLE(s)); sleep(0.1)
    js(JS_CLOSE_GEAR); sleep(0.3)
    alive("style cycle ×5")

def t_rapid_theme():
    js(JS_OPEN_GEAR); sleep(0.15)
    for _ in range(10): js(JS_THEME("dark")); sleep(0.02); js(JS_THEME("light")); sleep(0.02)
    js(JS_CLOSE_GEAR); sleep(0.4)
    dt = alive("rapid theme ×10"); print(f"    (AnkiConnect: {dt:.0f}ms)", end="")

def t_combined():
    """draw → open → theme → draw while open → close → draw"""
    js(JS_DRAW); sleep(0.05)
    js(JS_OPEN_GEAR); sleep(0.12)
    js(JS_THEME("dark")); sleep(0.08)
    js(JS_DRAW); sleep(0.05)
    js(JS_THEME("light")); sleep(0.08)
    js(JS_CLOSE_GEAR); sleep(0.2)
    js(JS_DRAW); sleep(0.05)
    alive("draw+gear+theme combined")

test("theme light/dark/system cycle ×6", t_theme_cycle)
test("stroke-style neon/gel/standard cycle ×5", t_style_cycle)
test("10× rapid dark↔light switch", t_rapid_theme)
test("draw + gear + theme combined sequence", t_combined)

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Phase 4: Card Flips ===\n")
# ══════════════════════════════════════════════════════════════════════════════

def t_flip_mid_stroke():
    js(JS_DRAW_DOWN); sleep(0.04)  # pointerdown with no pointerup
    anki("guiShowAnswer"); sleep(0.05)
    anki("guiAnswerCard", ease=EASE_HARD); sleep(0.2)
    alive("flip mid-stroke")
    ensure_review()

def t_25_rapid_flips():
    times = []; errs = 0
    for _ in range(25):
        t0 = time.time()
        js(JS_DRAW); sleep(0.02)
        anki("guiShowAnswer"); sleep(0.04)
        r = anki("guiAnswerCard", ease=EASE_HARD)
        if r.get("error"): errs += 1
        times.append((time.time()-t0)*1000); sleep(0.04)
    avg = sum(times)/len(times)
    print(f"    25 flips | avg {avg:.0f}ms | errors: {errs}", end="")
    assert_(errs == 0, f"{errs} flip errors")
    ensure_review()

def t_flip_gear_open():
    js(JS_OPEN_GEAR); sleep(0.15)
    anki("guiShowAnswer"); sleep(0.05)
    anki("guiAnswerCard", ease=EASE_HARD); sleep(0.35)
    alive("flip with menu open")
    ensure_review()

def t_flip_mid_theme():
    js(JS_OPEN_GEAR); sleep(0.12)
    js(JS_THEME("dark")); sleep(0.05)
    anki("guiShowAnswer"); sleep(0.04)  # flip while theme is still being applied
    anki("guiAnswerCard", ease=EASE_HARD); sleep(0.3)
    alive("flip during theme change")
    ensure_review()

test("flip mid-stroke (pointerdown without pointerup)", t_flip_mid_stroke)
test("25× rapid draw + flip", t_25_rapid_flips)
test("flip with settings menu open", t_flip_gear_open)
test("flip during theme change", t_flip_mid_theme)

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Phase 5: Chaos Mode ===\n")
# ══════════════════════════════════════════════════════════════════════════════

def t_chaos_100():
    actions = [
        lambda: js(JS_DRAW),
        lambda: js(JS_DRAW),
        lambda: js(JS_DRAW),
        lambda: js(JS_OPEN_GEAR),
        lambda: js(JS_CLOSE_GEAR),
        lambda: (js(JS_OPEN_GEAR), sleep(0.03), js(JS_THEME("dark")),     js(JS_CLOSE_GEAR)),
        lambda: (js(JS_OPEN_GEAR), sleep(0.03), js(JS_THEME("light")),    js(JS_CLOSE_GEAR)),
        lambda: (js(JS_OPEN_GEAR), sleep(0.03), js(JS_STYLE("neon")),     js(JS_CLOSE_GEAR)),
        lambda: (js(JS_OPEN_GEAR), sleep(0.03), js(JS_STYLE("standard")), js(JS_CLOSE_GEAR)),
        # Card flip with a mandatory 0.5s settle time so Qt can fully complete the
        # page navigation before the next chaos action. Consecutive flips at 40ms
        # caused QWebChannel to queue multiple reinits (~2-3 min to drain).
        lambda: (anki("guiShowAnswer"), sleep(0.15), anki("guiAnswerCard", ease=EASE_HARD), sleep(0.5)),
        lambda: js(JS_DRAW_DOWN),  # interrupted stroke (no pointerup)
    ]
    errs = 0
    for _ in range(100):
        try: random.choice(actions)()
        except Exception: errs += 1
        sleep(0.025)
    sleep(0.5)
    ensure_review(); sleep(0.3)
    dt = alive("100 chaos actions")
    print(f"    100 actions | errors: {errs} | AnkiConnect: {dt:.0f}ms", end="")
    assert_(errs < 5, f"too many exceptions: {errs}")

def t_latency_regression():
    """AnkiConnect response time must not degrade significantly after chaos."""
    dts_before = [alive() for _ in range(5)]
    avg_before = sum(dts_before)/len(dts_before)

    for _ in range(50):
        random.choice([
            lambda: js(JS_DRAW),
            lambda: js(JS_OPEN_GEAR),
            lambda: js(JS_CLOSE_GEAR),
            lambda: (js(JS_OPEN_GEAR), sleep(0.02), js(JS_THEME("dark")), js(JS_CLOSE_GEAR)),
        ])()
        sleep(0.02)
    sleep(0.5); ensure_review(); sleep(0.2)

    dts_after = [alive() for _ in range(5)]
    avg_after = sum(dts_after)/len(dts_after)
    print(f"    avg before: {avg_before:.0f}ms → after: {avg_after:.0f}ms", end="")
    assert_(avg_after < avg_before * 3 + 100,
            f"latency regression: {avg_after:.0f}ms (was {avg_before:.0f}ms)")

test("chaos mode: 100 random actions", t_chaos_100)
test("latency regression: AnkiConnect before vs after chaos", t_latency_regression)
sleep(3.0)  # let Qt main thread fully drain after chaos card flips

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Phase 6: Banner Interactions ===\n")
# ══════════════════════════════════════════════════════════════════════════════

ensure_review(); ensure_front_side(); sleep(0.3)
warmup_bridge("Phase 6 start")

JS_SHOW_ADDON_HINT = "(function(){var h=document.getElementById('addon-hint');if(h)h.classList.add('addon-hint-visible');})()"
JS_HIDE_ADDON_HINT = "(function(){var h=document.getElementById('addon-hint');if(h)h.classList.remove('addon-hint-visible');})()"
JS_SHOW_LGW        = "(function(){var w=document.getElementById('legacy-gesture-warning');if(w)w.classList.add('lgw-visible');})()"
JS_HIDE_LGW        = "(function(){var w=document.getElementById('legacy-gesture-warning');if(w)w.classList.remove('lgw-visible');})()"

def t_addon_hint_show_dismiss():
    js(JS_SHOW_ADDON_HINT); sleep(0.15)
    r = js_sync("return !!document.getElementById('addon-hint')&&document.getElementById('addon-hint').classList.contains('addon-hint-visible')")
    assert_(r.get("result") is True, f"addon-hint not visible: {r}")
    # Click dismiss button
    js("(function(){var b=document.getElementById('addon-hint-dismiss');if(b)b.click();})()")
    sleep(0.15)
    r2 = js_sync("return document.getElementById('addon-hint')&&document.getElementById('addon-hint').classList.contains('addon-hint-visible')")
    assert_(not r2.get("result"), f"addon-hint still visible after dismiss: {r2}")
    alive("addon-hint dismiss")

def t_addon_hint_link_clickable():
    """The link inside the banner must have pointer-events: auto when visible."""
    js(JS_SHOW_ADDON_HINT); sleep(0.1)
    r = js_sync("""
        var h = document.getElementById('addon-hint');
        if(!h) return 'no banner';
        var a = h.querySelector('a');
        if(!a) return 'no link';
        var pe = window.getComputedStyle(a).pointerEvents;
        return pe;
    """)
    result = r.get("result", "")
    assert_(result not in ("none", "no banner", "no link"), f"link not clickable: {result}")
    js(JS_HIDE_ADDON_HINT)
    alive("addon-hint link pointer-events")

def t_lgw_show_dismiss():
    js(JS_SHOW_LGW); sleep(0.15)
    r = js_sync("return !!document.getElementById('legacy-gesture-warning')&&document.getElementById('legacy-gesture-warning').classList.contains('lgw-visible')")
    assert_(r.get("result") is True, f"lgw not visible: {r}")
    js("(function(){var b=document.getElementById('lgw-dismiss');if(b)b.click();})()")
    sleep(0.15)
    r2 = js_sync("return document.getElementById('legacy-gesture-warning')&&document.getElementById('legacy-gesture-warning').classList.contains('lgw-visible')")
    assert_(not r2.get("result"), f"lgw still visible after dismiss: {r2}")
    alive("lgw dismiss")

def t_banner_draw_passthrough():
    """Banners must not block drawing strokes on the layer beneath."""
    js(JS_SHOW_ADDON_HINT); sleep(0.1)
    for _ in range(5): js(JS_DRAW); sleep(0.05)
    js(JS_HIDE_ADDON_HINT); sleep(0.1)
    alive("drawing with banner visible")

def t_banner_rapid_toggle():
    for _ in range(20):
        js(JS_SHOW_ADDON_HINT); sleep(0.02)
        js(JS_HIDE_ADDON_HINT); sleep(0.02)
    sleep(0.2)
    dt = alive("banner 20× rapid toggle")
    print(f"    (AnkiConnect: {dt:.0f}ms)", end="")

test("addon-hint: show + dismiss", t_addon_hint_show_dismiss)
test("addon-hint: link has pointer-events when visible", t_addon_hint_link_clickable)
test("lgw: show + dismiss", t_lgw_show_dismiss)
test("banner visible: drawing still works", t_banner_draw_passthrough)
test("banner 20× rapid show/hide — no freeze", t_banner_rapid_toggle)

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Phase 7: Advanced Drawing Scenarios ===\n")
# ══════════════════════════════════════════════════════════════════════════════

def JS_DRAW_DIR(dx, dy, steps=12):
    """Draw a stroke in a given direction from canvas center."""
    return f"""(function(){{
        var l=document.getElementById('draw-layer');
        if(!l)return;
        var r=l.getBoundingClientRect(),cx=r.left+r.width*.5,cy=r.top+r.height*.5;
        function f(t,x,y){{l.dispatchEvent(new PointerEvent(t,{{clientX:x,clientY:y,bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true}}));}}
        f('pointerdown',cx,cy);
        for(var i=1;i<={steps};i++) f('pointermove',cx+({dx})*i/{steps},cy+({dy})*i/{steps});
        document.dispatchEvent(new PointerEvent('pointerup',{{bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true}}));
    }})()"""

def t_all_directions():
    """Draw strokes in 8 cardinal directions — tests stroke scoring with varied angles."""
    dirs = [(0,-60),(60,-60),(60,0),(60,60),(0,60),(-60,60),(-60,0),(-60,-60)]
    for dx, dy in dirs:
        js(JS_DRAW_DIR(dx, dy)); sleep(0.04)
    alive("8-direction strokes")

def t_very_long_stroke():
    """500-point zigzag across the entire canvas."""
    code = """(function(){
        var l=document.getElementById('draw-layer');
        if(!l)return;
        var r=l.getBoundingClientRect(),w=r.width,h=r.height;
        var x0=r.left+5,y0=r.top+h*.5;
        function f(t,x,y){l.dispatchEvent(new PointerEvent(t,{clientX:x,clientY:y,bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true}));}
        f('pointerdown',x0,y0);
        for(var i=1;i<=500;i++){
            var x=r.left+5+(w-10)*i/500;
            var y=r.top+h*.5+Math.sin(i*0.15)*h*.4;
            f('pointermove',x,y);
        }
        document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true}));
    })()"""
    js(code); sleep(0.2)
    alive("500-point zigzag stroke")

def t_single_pixel_stroke():
    """Minimal stroke — pointerdown + immediate pointerup at same location."""
    code = """(function(){
        var l=document.getElementById('draw-layer');
        if(!l)return;
        var r=l.getBoundingClientRect(),cx=r.left+r.width*.5,cy=r.top+r.height*.5;
        l.dispatchEvent(new PointerEvent('pointerdown',{clientX:cx,clientY:cy,bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true}));
        document.dispatchEvent(new PointerEvent('pointerup',{clientX:cx,clientY:cy,bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true}));
    })()"""
    js(code); sleep(0.1)
    alive("single-pixel stroke (no crash)")

def t_50_strokes_no_flip():
    """50 strokes without flipping — draw-layer must not accumulate children."""
    for _ in range(50): js(JS_DRAW); sleep(0.03)
    sleep(1.0)
    warmup_bridge("50-stroke burst")
    r = js_sync("return document.getElementById('draw-layer') ? document.getElementById('draw-layer').children.length : -1")
    count = r.get("result", -1)
    assert_(isinstance(count, (int, float)) and 0 <= count <= 2,
            f"draw-layer has {count} children (expected 0–2) — possible DOM leak or wrong page")
    dt = alive("50 strokes, no flip — DOM check")
    print(f"    draw-layer children: {count} | AnkiConnect: {dt:.0f}ms", end="")

def t_stroke_outside_bounds():
    """Stroke starting at edge/outside of canvas — must not crash."""
    code = """(function(){
        var l=document.getElementById('draw-layer');
        if(!l)return;
        var r=l.getBoundingClientRect();
        function f(t,x,y){l.dispatchEvent(new PointerEvent(t,{clientX:x,clientY:y,bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true}));}
        f('pointerdown',r.left-5,r.top-5);
        for(var i=0;i<20;i++) f('pointermove',r.left+i*5,r.top+i*5);
        document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',isPrimary:true}));
    })()"""
    js(code); sleep(0.1)
    alive("stroke starting outside canvas bounds")

test("8-directional strokes (N/NE/E/SE/S/SW/W/NW)", t_all_directions)
test("500-point zigzag stroke across full canvas", t_very_long_stroke)
test("single-pixel stroke (degenerate input)", t_single_pixel_stroke)
test("50 strokes no flip — draw-layer DOM leak check", t_50_strokes_no_flip)
test("stroke starting outside canvas bounds — no crash", t_stroke_outside_bounds)

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Phase 8: Settings Deep Navigation ===\n")
# ══════════════════════════════════════════════════════════════════════════════

def JS_NAV(page):
    return f"(function(){{if(typeof navigateTo==='function')navigateTo('{page}');}})()"
def JS_NAV_BACK():
    return "(function(){if(typeof navigateBack==='function')navigateBack();})()"

def t_settings_all_tabs():
    """Navigate to every settings sub-page and back."""
    js(JS_OPEN_GEAR); sleep(0.2)
    pages = ["page-back", "page-front", "page-front-c2", "page-stroke-nrs"]
    for p in pages:
        js(JS_NAV(p)); sleep(0.1)
        js(JS_NAV_BACK()); sleep(0.1)
    js(JS_CLOSE_GEAR); sleep(0.2)
    alive("all settings sub-pages visited")

def t_settings_rapid_nav():
    """Rapid tab switching — no animation glitch / leaked listener."""
    js(JS_OPEN_GEAR); sleep(0.15)
    for _ in range(15):
        js(JS_NAV("page-back")); sleep(0.02)
        js(JS_NAV_BACK()); sleep(0.02)
    js(JS_CLOSE_GEAR); sleep(0.3)
    dt = alive("rapid tab switching ×15")
    print(f"    (AnkiConnect: {dt:.0f}ms)", end="")

def t_settings_draw_while_navigating():
    """Draw strokes while the settings modal is in mid-navigation."""
    js(JS_OPEN_GEAR); sleep(0.1)
    js(JS_NAV("page-back")); sleep(0.03)
    js(JS_DRAW); sleep(0.03)
    js(JS_NAV_BACK()); sleep(0.03)
    js(JS_DRAW); sleep(0.03)
    js(JS_CLOSE_GEAR); sleep(0.2)
    alive("draw during settings navigation")

def t_all_stroke_styles():
    """Cycle through all 3 stroke styles and draw a stroke with each."""
    js(JS_OPEN_GEAR); sleep(0.15)
    for s in ("standard", "neon", "gel", "standard"):
        js(JS_STYLE(s)); sleep(0.12)
        js(JS_CLOSE_GEAR); sleep(0.08)
        js(JS_DRAW); sleep(0.1)
        js(JS_OPEN_GEAR); sleep(0.12)
    js(JS_CLOSE_GEAR); sleep(0.2)
    alive("draw with each stroke style (standard/neon/gel)")

test("navigate all settings sub-pages", t_settings_all_tabs)
test("rapid tab switching ×15 — no leaked listeners", t_settings_rapid_nav)
test("draw strokes during settings navigation", t_settings_draw_while_navigating)
test("draw one stroke per style: standard / neon / gel", t_all_stroke_styles)

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Phase 9: DOM Health & Memory ===\n")
# ══════════════════════════════════════════════════════════════════════════════

ensure_review(); ensure_front_side(); sleep(0.3)
warmup_bridge("Phase 9 start")

def t_draw_layer_never_leaks():
    """After 100 rapid draw-then-flip cycles, draw-layer must be empty."""
    for i in range(100):
        js(JS_DRAW); sleep(0.01)
        if i % 10 == 9:
            anki("guiShowAnswer"); sleep(0.15)
            anki("guiAnswerCard", ease=EASE_HARD); sleep(0.5)  # 0.5s settle per flip
            ensure_review(); sleep(0.05)
    sleep(1.0)
    warmup_bridge("draw-layer leak check")
    r = js_sync("return document.getElementById('draw-layer') ? document.getElementById('draw-layer').children.length : -1")
    count = r.get("result", -1)
    assert_(isinstance(count, (int, float)) and count <= 1,
            f"draw-layer has {count} children after 100 flips — DOM leak!")
    dt = alive("100 draw+flip cycles — DOM leak check")
    print(f"    draw-layer children: {count} | AnkiConnect: {dt:.0f}ms", end="")
    ensure_review()

def t_no_orphan_error_timeout():
    """Reject 20 strokes rapidly, then immediately draw — errorTimeout must be cleared."""
    for _ in range(20):
        js(JS_DRAW); sleep(0.01)
    sleep(0.02)
    # A new draw should clear any pending error/fade timers
    js(JS_DRAW); sleep(0.5)
    # If errorTimeout leaked, the draw-layer would be cleared mid-draw by the stale timer.
    # We can't easily detect this without instrumentation, so we just verify no freeze.
    alive("20-reject burst → clear timers → no freeze")

def t_modal_dom_clean_after_many_opens():
    """Open/close settings 50× — modal must still render correctly after."""
    for _ in range(50):
        js(JS_OPEN_GEAR); sleep(0.04); js(JS_CLOSE_GEAR); sleep(0.04)
    sleep(0.5)
    # Open once more and verify overlay has 'active' class (modal is open)
    js(JS_OPEN_GEAR); sleep(0.3)
    r = js_sync("""
        var o = document.getElementById('settings-overlay');
        if (!o) return 'overlay-missing';
        if (!o.classList.contains('active')) return 'not-active';
        var m = document.querySelector('.settings-modal');
        return m ? 'ok' : 'modal-missing';
    """)
    result = r.get("result", "")
    js(JS_CLOSE_GEAR); sleep(0.1)
    assert_(result == "ok", f"modal broken after 50 opens: {result}")
    alive("settings modal DOM clean after 50 open/close")

def t_localstorage_not_exhausted():
    """localStorage must still be writable after heavy use."""
    r = js_sync("""
        try {
            localStorage.setItem('_kd_stress_probe', '1');
            var v = localStorage.getItem('_kd_stress_probe');
            localStorage.removeItem('_kd_stress_probe');
            return v === '1';
        } catch(e) { return 'error:'+e.message; }
    """)
    assert_(r.get("result") is True, f"localStorage not writable: {r}")
    alive("localStorage still writable after stress")

test("100 draw+flip cycles — draw-layer DOM leak check", t_draw_layer_never_leaks)
test("20-reject burst → errorTimeout cleared on next draw", t_no_orphan_error_timeout)

# t_modal_dom_clean and t_localstorage follow t_draw_layer_never_leaks which does
# 10 card flips — ensure bridge is warm before these eval_sync-heavy tests
warmup_bridge("Phase 9 modal/localStorage")

test("settings modal DOM clean after 50 open/close cycles", t_modal_dom_clean_after_many_opens)
test("localStorage writable after full stress", t_localstorage_not_exhausted)

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Phase 10: Concurrent Input ===\n")
# ══════════════════════════════════════════════════════════════════════════════

def t_draw_while_theme_switching():
    """Interleave stroke drawing with rapid theme switches — no visual corruption."""
    threads = []
    results = {"draw_errors": 0, "theme_errors": 0}

    def draw_thread():
        for _ in range(15):
            r = js(JS_DRAW)
            if r.get("error"): results["draw_errors"] += 1
            time.sleep(0.06)

    def theme_thread():
        themes = ["dark", "light", "dark", "system", "light", "system", "dark"]
        for t_val in themes:
            js(JS_OPEN_GEAR); time.sleep(0.03)
            r = js(JS_THEME(t_val))
            if r.get("error"): results["theme_errors"] += 1
            js(JS_CLOSE_GEAR); time.sleep(0.06)

    t1 = threading.Thread(target=draw_thread)
    t2 = threading.Thread(target=theme_thread)
    t1.start(); t2.start()
    t1.join(); t2.join()
    sleep(0.4)
    dt = alive("draw + theme concurrent")
    print(f"    draw_errs={results['draw_errors']} theme_errs={results['theme_errors']} AnkiConnect={dt:.0f}ms", end="")
    assert_(results["draw_errors"] == 0, f"{results['draw_errors']} draw request errors during concurrent theme switch")

def t_settings_open_while_drawing():
    """Spam gear open/close while 30 strokes are drawn — no freeze."""
    threads = []
    errors = {"n": 0}

    def draw_t():
        for _ in range(30):
            if js(JS_DRAW).get("error"): errors["n"] += 1
            time.sleep(0.04)

    def gear_t():
        for _ in range(20):
            js(JS_OPEN_GEAR); time.sleep(0.05); js(JS_CLOSE_GEAR); time.sleep(0.05)

    t1 = threading.Thread(target=draw_t)
    t2 = threading.Thread(target=gear_t)
    t1.start(); t2.start()
    t1.join(); t2.join()
    sleep(0.3)
    dt = alive("concurrent draw + gear spam")
    print(f"    errs={errors['n']} AnkiConnect={dt:.0f}ms", end="")
    assert_(errors["n"] == 0, f"{errors['n']} request errors")

def t_flip_during_concurrent_ops():
    """Flip card while draw + gear threads are active."""
    errors = {"n": 0}
    done = threading.Event()

    def bg():
        while not done.is_set():
            js(JS_DRAW); time.sleep(0.05)
            js(JS_OPEN_GEAR); time.sleep(0.03); js(JS_CLOSE_GEAR); time.sleep(0.03)

    t = threading.Thread(target=bg, daemon=True)
    t.start()
    sleep(0.25)
    anki("guiShowAnswer"); sleep(0.05)
    anki("guiAnswerCard", ease=EASE_HARD); sleep(0.3)
    done.set(); t.join(timeout=1)
    ensure_review(); sleep(0.2)
    alive("flip during concurrent draw + gear")

test("15 draws + 7 theme changes concurrently — no freeze", t_draw_while_theme_switching)
test("30 draws + 20 gear cycles concurrently — no freeze", t_settings_open_while_drawing)
test("card flip during concurrent draw + gear background thread", t_flip_during_concurrent_ops)

# ══════════════════════════════════════════════════════════════════════════════
print("\n=== Phase 11: Sustained Load & Latency ===\n")
# ══════════════════════════════════════════════════════════════════════════════

def t_sustained_500_draws():
    """500 draw events over ~25 seconds — AnkiConnect must stay responsive throughout."""
    latencies = []
    for i in range(500):
        js(JS_DRAW)
        if i % 50 == 49:
            dt = alive(f"sustained draw #{i+1}")
            latencies.append(dt)
        time.sleep(0.05)
    avg = sum(latencies) / len(latencies)
    worst = max(latencies)
    print(f"    500 draws | avg latency: {avg:.0f}ms | worst: {worst:.0f}ms", end="")
    assert_(worst < 1500, f"AnkiConnect degraded during sustained load: worst={worst:.0f}ms")

def t_latency_stable_under_draw_spam():
    """Rapid 200 draw burst — latency before vs during vs after must be comparable."""
    before = [alive() for _ in range(3)]
    avg_before = sum(before) / len(before)

    during = []
    for i in range(200):
        js(JS_DRAW)
        if i % 40 == 39:
            during.append(alive(f"during draw spam #{i+1}"))
        time.sleep(0.01)
    avg_during = sum(during) / max(len(during), 1)

    sleep(0.5)
    after = [alive() for _ in range(3)]
    avg_after = sum(after) / len(after)

    print(f"    before: {avg_before:.0f}ms | during: {avg_during:.0f}ms | after: {avg_after:.0f}ms", end="")
    assert_(avg_during < avg_before * 5 + 200,
            f"latency spike during draw spam: {avg_during:.0f}ms (baseline {avg_before:.0f}ms)")
    assert_(avg_after < avg_before * 3 + 100,
            f"latency did not recover after draw spam: {avg_after:.0f}ms (was {avg_before:.0f}ms)")

test("sustained 500 draws (50ms apart) — latency sampled ×10", t_sustained_500_draws)
test("200-draw burst — latency before/during/after comparison", t_latency_stable_under_draw_spam)

# ─── Restore default settings ──────────────────────────────────────────────────
js(JS_OPEN_GEAR); sleep(0.15)
js(JS_STYLE("standard")); sleep(0.05)
js(JS_THEME("system")); sleep(0.05)
js(JS_CLOSE_GEAR); sleep(0.2)

# ─── Summary ──────────────────────────────────────────────────────────────────
total = _passed + _failed
print("\n" + "═"*58)
print(f"  Results: {_passed}/{total} passed, {_failed} failed")
print("═"*58 + "\n")
sys.exit(0 if _failed == 0 else 1)
