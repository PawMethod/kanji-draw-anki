// Public API: configuration, card/stroke hooks, lifecycle, offline rendering for tests

function setParam(p, v, t, tc) { p.cancelScheduledValues(t); p.setTargetAtTime(v, t, tc); }
function configure(o) {
    o = o || {};
    cfg = {
        level: LEVEL.hasOwnProperty(o.level) ? o.level : cfg.level,
        music: (o.music === 'off' || GENRES.hasOwnProperty(o.music)) ? o.music : cfg.music,
        musicLevel: MLEVEL.hasOwnProperty(o.musicLevel) ? o.musicLevel : cfg.musicLevel,
        stroke: (o.stroke === 'on' || o.stroke === 'off') ? o.stroke : cfg.stroke,
        fx: (o.fx === 'on' || o.fx === 'off') ? o.fx : cfg.fx,
        immersion: IMM.hasOwnProperty(o.immersion) ? o.immersion : cfg.immersion
    };
    if (ctx && G) { const t = now(); setParam(G.master.gain, LEVEL[cfg.level], t, 0.08); setParam(G.music.gain, MLEVEL[cfg.musicLevel], t, 0.25); }
    if (cfg.stroke === 'off' || cfg.level === 'off') strokeEnd();
    if (cfg.level === 'off') { fadeOutAll(0.4); return; }
    syncMusic();
}
function setScene(theme, dark) {
    theme = THEMES.hasOwnProperty(theme) ? theme : 'neutral'; dark = !!dark;
    if (theme === cur.theme && dark === cur.dark) return;
    cur = { theme: theme, dark: dark };
    const p = live();
    if (p) p.retheme(theme, dark);
}
function withCtx(fn) {
    if (!ensureCtx()) return;
    if (OFF || ctx.state === 'running') { fn(); return; }
    if (D.hidden) return;
    const asked = Date.now();
    try { const p = ctx.resume(); if (p && p.then) p.then(() => { if (ctx && ctx.state === 'running' && Date.now() - asked < 400) fn(); }, () => { }); } catch (e) { }
}
function play(fn, delay) { touch(); withCtx(() => fn(now() + 0.01 + (delay || 0))); }
function cardShown(isBack) {
    touch();
    if (cfg.level === 'off') return;
    if (musicOn()) syncMusic();
    if (!isBack) cBase = Math.floor(Math.random() * 3);
    const s = live(), name = isBack ? 'cardBack' : 'cardFront';
    if (s && imm()) {
        if (isBack) FL.add(0.05);
        if (fxOn()) play(tn => FX[name](isBack ? nextGrid(s, 4, tn + 0.02) : tn + 0.05));
        return;
    }
    if (fxOn()) play(FX[name], isBack ? 0.02 : 0.05);
}
function strokeResult(ok, idx) {
    if (!fxOn()) return;
    const sc = live();
    if (sc && imm()) {
        FL.add(ok ? 0.06 : 0.015); FL.bump();
        play(tn => { const t = FL.slot(sc, tn); if (t === null) return; if (ok) answer(sc, t, contourNote(sc, t, idx), FL.dens()); else ghost(sc, t); });
        return;
    }
    play(t => {
        const s = ks();
        if (ok) { const base = rootNear(s, 72), n = scaleNotes(s, base, base + 26); chime(lastStyle, FXD(), t, n[(idx || 0) % n.length], 0.04); }
        else thock(FXD(), t, rootNear(s, 50), 0.05);
    });
}
function complete() {
    if (!fxOn()) return;
    const sc = live();
    if (sc && imm()) {
        FL.add(0.25);
        play(tn => {
            // Sararin: a run up the mode in 16ths that lands on the chord root on the next beat, then the arrangement blooms
            const st = sc.B / 4, land = nextGrid(sc, 1, tn + 6 * st), r = LEADR[sc.genre] || LEADR.ambient, top = r[1] - 5;
            const tonic = top - pc(top - chordAt(sc, land).root), run = scaleNotes(sc, tonic - 14, tonic - 1).slice(-6);
            run.push(tonic);
            run.forEach((m, i) => answer(sc, land - (run.length - 1 - i) * st, m, 0.55 + i * 0.08));
            tone('glass', sc.d, land, tonic + 12, 0.018, { wet: 0.8, echo: 0.35 });
            FL.aq = land;
            FL.bloomUntil = sc.nextT + sc.barDur * 2; sc.accent = true;
            FL.advance();
        });
        return;
    }
    play(t => {
        const s = ks(), base = rootNear(s, 72), n = scaleNotes(s, base, base + 26);
        for (let i = 0; i < 6; i++) chime(lastStyle, FXD(), t + i * 0.075, n[Math.min(n.length - 1, i)], 0.034 + i * 0.004);
        tone('glass', FXD(), t + 0.5, base + 24, 0.02, { wet: 0.7, echo: 0.3 });
    }, 0.12);
}

// ── Lifecycle ──
let faded = false, ctxStale = false, autoRebuilt = false;
// iOS only counts these as user activation (may create/resume an AudioContext)
const ACTIVATING = { pointerup: 1, touchend: 1, click: 1, keydown: 1 };
function onGesture(e) {
    if (cfg.level === 'off' || disposed) return;
    touch();
    if (faded) revive();
    if (ctx && (ctxStale || ctx.state === 'closed')) { if (!e || ACTIVATING[e.type]) rebuild(); else return; }
    if (!ctx && !musicOn()) return;
    if (!ensureCtx()) return;
    if (ctx.state !== 'running') { wake(); checkAlive(); }
}
function onVis() {
    if (!ctx) return;
    if (D.hidden) { const s = live(); if (s) s.save(); try { ctx.suspend(); } catch (e) { } }
    else {
        autoRebuilt = false;
        if (faded) revive();
        if (cfg.level !== 'off' && (musicOn() || SV)) { wake(); checkAlive(); }
    }
}
function revive() { faded = false; if (ctx && G && !OFF) setParam(G.master.gain, LEVEL[cfg.level] || 0, now(), 0.08); }
// After Safari or another app, iOS can leave the context interrupted or frozen: rebuild it right away,
// and if that is not allowed without a gesture, on the next tap anywhere (also inside modals)
function checkAlive() {
    if (!ctx || OFF) return;
    const c = ctx, t0 = c.currentTime;
    setTimeout(() => {
        if (ctx !== c || D.hidden || (c.state === 'running' && c.currentTime > t0)) return;
        if (!autoRebuilt && musicOn()) { autoRebuilt = true; rebuild(); checkAlive(); }
        else ctxStale = true;
    }, 800);
}
function rebuild() {
    ctxStale = false;
    const s = live(); if (s) s.save();
    stopTimer();
    players.forEach(p => p.dispose()); players = [];
    if (SV) { clearInterval(SV.iv); SV = null; }
    const old = ctx;
    ctx = null; G = null;
    old.onstatechange = null;
    try { const pr = old.close(); if (pr && pr.catch) pr.catch(() => { }); } catch (e) { }
    if (!ensureCtx()) return;
    if (ctx.state !== 'running') wake();
    if (musicOn()) syncMusic();
}
// Watchdog (bar timer): a context that reports "running" while its clock stands still is dead
let wdT = -1, wdMs = 0;
function watchdog() {
    if (OFF || !ctx || D.hidden || ctx.state !== 'running') { wdT = -1; return; }
    const ms = clockMs();
    if (ctx.currentTime !== wdT) { wdT = ctx.currentTime; wdMs = ms; return; }
    if (ms - wdMs > 1500 && !ctxStale) { ctxStale = true; if (!autoRebuilt) { autoRebuilt = true; rebuild(); } }
}
// AnkiDroid Legacy tears the page down per card side: fade out within a few ms instead of a hard cut (click).
// The wait gives the audio thread time to render the fade before the context is destroyed.
function onHide() {
    const s = live(); if (s) s.save();
    if (!ctx || !G || OFF || ctx.state !== 'running') return;
    const p = G.master.gain, t = now(), lat = (ctx.baseLatency || 0) + (ctx.outputLatency || 0);
    faded = true;
    p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(0, t + 0.03);
    const end = performance.now() + Math.min(100, 45 + lat * 1000);
    while (performance.now() < end) { }
}
// The page stayed alive (bfcache, or iOS fired pagehide without unloading): undo the fade of onHide
function onShow() { if (faded) revive(); }
const GEST = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown', 'click'];
// Window capture runs before any handler of the card (modals stop propagation or prevent touches)
GEST.forEach(n => W.addEventListener(n, onGesture, { capture: true, passive: true }));
D.addEventListener('visibilitychange', onVis);
W.addEventListener('pagehide', onHide);
W.addEventListener('pageshow', onShow);
// Idle: release the audio device when nothing has played for a while
idleIv = setInterval(() => {
    if (ctx && ctx.state === 'running' && !players.length && !SV && Date.now() - lastAct > 15000) { try { ctx.suspend(); } catch (e) { } }
}, 5000);
function dispose() {
    disposed = true; stopTimer(); clearInterval(idleIv); bank.stop();
    GEST.forEach(n => W.removeEventListener(n, onGesture, { capture: true }));
    D.removeEventListener('visibilitychange', onVis); W.removeEventListener('pagehide', onHide); W.removeEventListener('pageshow', onShow);
    if (ctx) { try { ctx.close(); } catch (e) { } }
    ctx = null; players = [];
    if (W.__kdAudio === api) W.__kdAudio = null;
}

// ── Offline render (tests / sound design): deterministic timeline on a fresh state ──
function offline(o) {
    const OAC = W.OfflineAudioContext || W.webkitOfflineAudioContext, sr = o.sr || 44100;
    const off = new OAC(2, Math.ceil(sr * o.seconds), sr);
    const sv = { ctx, G, NB, PW, players, cfg, cur, SV, sTok, lastStyle, lastX, cBase, lastTick, SFORCE, FL };
    try {
        OFF = true; ctx = off; players = []; SV = null;
        cfg = { level: o.level || 'mid', music: o.music || 'off', musicLevel: o.musicLevel || 'mid', stroke: o.stroke || 'on', fx: o.fx || 'on', immersion: o.immersion || 'off' };
        FL = new Flow(o); lastX = 54.5; cBase = 0; lastTick = -1e9; NOEV = !!o.noEvents; SFORCE = o.song || null;
        cur = { theme: o.theme || 'neutral', dark: !!o.dark };
        setup(off);
        if (o.muteMusic) G.music.gain.value = 0;
        TO = 0; syncMusic();
        (o.events || []).slice().sort((a, b) => a.at - b.at).forEach(ev => {
            TO = ev.at; pump(ev.at + 1.4);
            api[ev.fn].apply(null, ev.args || []);
        });
        TO = o.seconds; pump(o.seconds);
    } finally {
        OFF = false; TO = null; NOEV = false;
        ({ ctx, G, NB, PW, players, cfg, cur, SV, sTok, lastStyle, lastX, cBase, lastTick, SFORCE, FL } = sv);
    }
    return off.startRendering();
}

function safe(fn) {
    return function () {
        try { return fn.apply(null, arguments); } catch (e) { if (OFF) throw e; if (W.__kdAudioDebug) console.error(e); }
    };
}
const api = {
    version: VERSION,
    configure: safe(configure),
    setScene: safe(setScene),
    cardShown: safe(cardShown),
    strokeStart: safe(strokeStart),
    strokeMove: safe(strokeMove),
    strokeEnd: safe(strokeEnd),
    strokeResult: safe(strokeResult),
    complete: safe(complete),
    fx: safe((name, delay, arg) => { if (fxOn() && FX.hasOwnProperty(name)) play(t => FX[name](t, arg), delay); }),
    demoStroke: safe(demoStroke),
    state() {
        return {
            ctx: ctx ? ctx.state : 'none', gain: G ? Math.round(G.master.gain.value * 100) / 100 : null, cfg: JSON.parse(JSON.stringify(cfg)), theme: cur.theme, dark: cur.dark, flow: Math.round(FL.level() * 100) / 100, done: FL.done,
            scenes: players.map(p => p.describe())
        };
    },
    dispose: dispose,
    _offline: offline,
    _t: { THEMES, GENRES, NAT, SK, FX, EV, SIG, SONGS, songErrors, scaleNotes, voiceChord, rootNear, renderPiano: SampleBank.piano, renderString: SampleBank.string, ctx: () => ctx }
};
W.__kdAudio = api;
