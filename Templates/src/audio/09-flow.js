// Flow (after Tetris Effect): learning flow, jo-ha-kyū stage, answer grid, and the musical responses to input

class Flow {
    // o: test overrides — flow (fixed level), E (fixed density), stage, done, bloom
    constructor(o) {
        o = o || {};
        this.v = 0; this.t = 0; this.lastIn = -1e9;
        this.bloomUntil = o.bloom ? 1e9 : 0; this.calmUntil = 0;
        this.fixFlow = o.flow != null ? o.flow : null; this.fixE = o.E != null ? o.E : null; this.fixStage = o.stage != null ? o.stage : null;
        this.done = o.done || 0; this.doneT = 0;  // kanji completed in the current jo-ha-kyū cycle
        this.aq = -1; this.rn = 0; this.rt = 0;   // last answer slot; recent stroke rate
    }
    level() { return this.fixFlow !== null ? this.fixFlow : this.v * Math.exp(-Math.max(0, now() - this.t) / 45); }
    add(x) { if (!ctx) return; this.v = clamp(this.level() + x, 0, 1); this.t = this.lastIn = now(); }
    // Continue after a page reload (AnkiDroid) from the saved state
    resume(st) {
        if (st.flow != null) { this.v = st.flow; this.t = this.lastIn = now(); }
        if (st.done != null && !this.done) { this.done = st.done; this.doneT = clockMs(); }
    }
    stage() {
        if (this.fixStage !== null) return this.fixStage;
        if (!imm()) return 1;
        // Without new kanji the cycle slowly sinks back towards the introduction
        const ms = clockMs();
        while (this.done > 0 && ms - this.doneT > 150000) { this.done = Math.max(0, this.done - 2); this.doneT += 150000; }
        return this.done < STAGE_AT[0] ? 0 : this.done < STAGE_AT[1] ? 1 : 2;
    }
    advance() { this.doneT = clockMs(); if (++this.done >= CYCLE) this.done = 0; }
    // Arrangement density 0..4: ma in thinking pauses, fuller while drawing, bloom after a kanji; the stage sets the frame
    energy(t0, sg) {
        const m = imm();
        if (!m) return 2;
        if (this.fixE !== null) return this.fixE;
        const f = this.level(), idle = this.fixFlow === null && now() - this.lastIn > 30;
        let e = f < 0.15 ? 1 : f < 0.5 ? 2 : 3;
        if (idle || t0 < this.calmUntil) e = 0;
        else if (sg === 0) e = Math.min(e, 2);
        else if (sg === 2) e = Math.max(e, 2);
        if (t0 < this.bloomUntil) e = 4;
        return clamp(e, m > 1 ? 0 : 1, m > 1 ? 4 : 3);
    }
    // Answers fall on eighth notes; strokes faster than the grid take the next free slot or are dropped, never stacked
    slot(p, tn) {
        const st = p.B / 2;
        let g = nextGrid(p, 2, tn);
        if (g <= this.aq + 1e-3) g = this.aq + st;
        if (g - tn > st * 2.5) return null;
        this.aq = g; return g;
    }
    // Stroke rate over the last seconds: dense playing gets softer answers
    bump() { const ms = clockMs(); this.rn = this.rn * Math.exp(-(ms - this.rt) / 2500) + 1; this.rt = ms; }
    dens() { const n = this.rn * Math.exp(-(clockMs() - this.rt) / 2500); return 1 / (1 + 0.3 * Math.max(0, n - 1)); }
}
let FL = new Flow();

function nextGrid(p, div, t) { const st = p.B / div; return p.nextT + Math.ceil((t - p.nextT) / st - 1e-6) * st; }
// Answering voice: the landscape's string instrument (piano in the piano genre)
function answer(p, t, m, k) {
    const d = p.d, g = p.genre, pan = spot(), V = p.V, sv = STR[V[0]] ? V[0] : STR[V[1]] ? V[1] : 'koto';
    if (g === 'piano') piano(d, t, m, 0.26 * k, 0.9, { wet: 0.5, pan: pan });
    else if (g === 'ambient') tone('glass', d, t, m, 0.035 * k, { wet: 0.6, echo: 0.3, pan: pan });
    else pluck(d, t, m, 0.047 * k * VK[sv], { kind: sv, decay: sv === 'koto' || sv === 'biwa' ? 1.5 : 0.85, bright: 7, wet: g === 'nature' ? 0.55 : 0.4, echo: 0.2, pan: pan, pick: true });
}
// The strokes of a kanji trace a melody through the song's mode; every second step lands on a chord tone
function contourNote(p, t, idx) {
    const r = LEADR[p.genre] || LEADR.ambient, sc = scaleNotes(p, r[0], r[1]);
    let m = sc[clamp(cBase + CONTOUR[(idx || 0) % CONTOUR.length], 0, sc.length - 1)];
    if (idx % 2 === 1) { const ct = ctones(p, t, r[0], r[1]); if (ct.length) m = ct[nearestIdx(ct, m)]; }
    return m;
}
// Mistake: a muted low note on the chord root — part of the music, never a buzzer
function ghost(p, t) {
    const d = p.d, g = p.genre, r = low(chordAt(p, t).root, 43);
    if (g === 'piano') piano(d, t, r, 0.13, 0.12, { wet: 0.25 });
    else if (g === 'lofi') bass(d, t, low(r, 36), 0.06, 0.18);
    else if (g === 'zen') pluck(d, t, r + 12, 0.045, { decay: 0.3, bright: 3, wet: 0.3 });
    else thock(d, t, r + 12, 0.04);
}
function penTick(p, t) {
    const d = p.d, g = p.genre, pan = spot(), r = LEADR[g] || LEADR.ambient, ct = ctones(p, t, r[0] + 12, r[1] + 12);
    if (g === 'lofi') wood(d, t, 1700, 0.014, { pan: pan });
    else if (g === 'zen') wood(d, t, 900, 0.018, { wet: 0.3, pan: pan });
    else if (ct.length) tone('celesta', d, t, pick(ct), 0.007, { wet: 0.4, pan: pan });
}
// Landing on the downbeat after a completed kanji or a genre change: the signature answers, a high glass tone, some air
function accentBar(p, t0, withSig) {
    if (withSig) sigHit(p, t0, 0.8);
    tone('glass', p.d, t0 + 0.01, rootNear(p, 84), 0.022, { wet: 0.8, echo: 0.3 });
    noiseHit(p.d, t0, { type: 'highpass', f: 6500, dur: 1.4, att: 0.01, vel: 0.008, wet: 0.7 });
}
// Stage change: up = a gesture into the fuller stage, down = release into stillness
function stageHit(p, t0, dir) {
    const d = p.d, g = p.genre, R = low(p.k, 40);
    if (dir === 'down') {
        if (g === 'lofi') { kick(d, t0, 0.4); brush(d, t0, 0.3); }
        else if (g === 'piano') { piano(d, t0, R, 0.3, p.barDur * 2, { wet: 0.6, ped: true }); piano(d, t0 + 0.02, R + 12, 0.18, p.barDur * 2, { wet: 0.6, ped: true }); }
        else if (p.dark || g === 'zen') kane(d, t0, low(p.k, 43), 0.06, { pan: 0.2 });
        else singBowl(d, t0, low(p.k, 67), p.barDur * 1.5, 0.035, { wet: 0.7 });
        noiseHit(d, t0, { kind: 'pink', type: 'bandpass', f: 2600, f2: 500, q: 1, dur: p.barDur, att: 0.3, vel: 0.012, wet: 0.6 });
        return;
    }
    riser(t0 - 1.2, 1.2);
    sigHit(p, t0, 1);
    if (g === 'piano') { piano(d, t0, R, 0.32, p.barDur, { wet: 0.5, ped: true }); piano(d, t0 + 0.015, R - 12, 0.2, p.barDur, { wet: 0.5, ped: true }); }
    else if (g === 'lofi') { kick(d, t0, 0.5); for (let f = 0; f < 3; f++) brush(d, Math.max(now(), t0 - (3 - f) * p.B / 4), 0.15 + f * 0.08); }
    else if (g === 'zen' && p.dark) kane(d, t0, low(p.k, 43), 0.05, { pan: 0.3 });
}
function riser(t, dur) {
    if (t < now()) { dur -= now() - t; t = now(); if (dur < 0.3) return; }
    noiseHit({ dry: G.music, wet: G.verbIn, echo: null }, t, { kind: 'pink', type: 'bandpass', f: 350, f2: 3200, q: 1.1, dur: dur, att: dur * 0.92, vel: 0.02, wet: 0.5 });
}
