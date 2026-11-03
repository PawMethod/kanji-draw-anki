// Music control: creates/crossfades players, schedules bars ahead, restores after page reloads

function loadState() {
    try { const st = JSON.parse(sessionStorage.getItem(SS) || 'null'); if (st) st.recent = Date.now() - (st.ts || 0) < 20000; return st; } catch (e) { return null; }
}
// The landscape only recolours the running player; a new player is created for a genre change (the song continues)
function syncMusic() {
    if (disposed) return;
    if (!musicOn()) { fadeOutAll(1.8); return; }
    if (!ensureCtx()) return;
    if (!OFF && ctx.state !== 'running') { if (!D.hidden) wake(); return; }
    const top = live();
    if (top && top.genre === cfg.music) { top.retheme(cur.theme, cur.dark); return; }
    // While the page still parses and paints, a starting AudioContext underruns on phones (crackle): start after load
    if (!top && !OFF && D.readyState !== 'complete') { waitForLoad(); return; }
    const p = new Player(cfg.music);
    let t = now() + 0.06, dur, st = null;
    if (top) {
        st = top.snapshot();
        // Tails of earlier switches make room so at most two players overlap
        players.forEach(x => { if (x.ending && x.endT > t + 1.5) x.fadeOut(t, 1.5, true); });
        t = Math.max(t, Math.min(top.nextT, t + 2.5)); dur = 3.5;
        top.fadeOut(t, dur);
        if (imm()) p.accent = true;
    } else {
        const ls = OFF ? null : loadState();
        // After a page reload (AnkiDroid Legacy) the song continues where it was
        if (ls && ls.recent) { st = ls; FL.resume(ls); dur = 0.6; }
        else dur = 3;
    }
    p.begin(t, dur, st);
    players.push(p);
    if (players.length > 3) players[0].fadeOut(now() + 0.01, 0.3, true);
    if (!OFF) { ensureTimer(); tick(); }
}
function waitForLoad() {
    if (loadWait) return;
    loadWait = true;
    let done = false;
    const go = () => { if (done) return; done = true; W.removeEventListener('load', soon); loadWait = false; syncMusic(); };
    // One more frame after load: the first paint of the landscape is the last heavy step
    const soon = () => setTimeout(() => requestAnimationFrame(go), 50);
    W.addEventListener('load', soon);
    setTimeout(go, 4000);
}
function fadeOutAll(dur) {
    if (!ctx) return;
    const t = now() + 0.02;
    players.forEach(s => s.fadeOut(t, dur));
    if (!OFF) { try { sessionStorage.removeItem(SS); } catch (e) { } }
}
function pump(horizon) {
    const tn = now();
    players.forEach(p => {
        // Missed bars (suspended tab, throttled timer): skip ahead in the song without playing them
        if (!OFF && p.nextT < tn - 0.2) {
            for (let k = 0; p.nextT < tn - 0.2 && k < 64; k++) { if (p.needSong) p.newSong(); p.step(); p.bar++; p.nextT += p.barDur; }
            if (p.nextT < tn) p.nextT = tn + 0.05;
        }
        if (!p.ending) p.applyWant(tn + 0.05);
        while (p.nextT < horizon && (p.endT === null || p.nextT < p.endT)) { p.scheduleBar(p.nextT); p.bar++; p.nextT += p.barDur; }
    });
    if (OFF) return;
    players = players.filter(s => { if (s.endT !== null && tn > s.endT + 7) { s.dispose(); return false; } return true; });
    if (!players.length) stopTimer();
}
function tick() { watchdog(); if (!ctx || ctx.state !== 'running') return; try { pump(now() + 1.4); } catch (e) { if (W.__kdAudioDebug) console.error(e); } }
function ensureTimer() { if (!timer) timer = setInterval(tick, 250); }
function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
