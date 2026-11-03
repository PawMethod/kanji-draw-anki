// Nature soundscapes: one layer per landscape, crossfaded on change; events (birds, insects, bells) per bar

class Nature {
    constructor(p, theme, dark, t, fin) {
        const pr = (NAT[theme] || NAT.neutral)[dark ? 'n' : 'd'];
        this.np = pr; this.L = {}; this.cont = []; this.end = null; this.t0 = t; this.fin = Math.max(0.05, fin);
        this.g = gainN(0); this.wg = gainN(0); this.g.connect(p.nat); this.wg.connect(p.nwet);
        [this.g, this.wg].forEach(x => { x.gain.setValueAtTime(0, t); x.gain.linearRampToValueAtTime(1, t + this.fin); });
        this.nd = { dry: this.g, wet: this.wg, echo: null };
        const bg = gainN(p.genre === 'nature' ? 0.6 : 1);
        bg.connect(this.g);
        if (pr.wind) {
            // Wind lives in its gusts: a low resting level, swells per bar
            const w = this.bed('pink', t, 0.6), bp = filt('bandpass', 420, 0.8), lp = filt('lowpass', 1100, 0.5), g = gainN(0);
            w.connect(bp); bp.connect(lp); lp.connect(g); g.connect(bg);
            g.gain.setTargetAtTime(pr.wind * K.wind * 0.3, t, 0.8);
            this.L.wind = { g: g, bp: bp, lvl: pr.wind * K.wind };
            if (pr.leaves) this.L.leaves = { lvl: pr.leaves };
        }
        if (pr.water) {
            // Brook: a smooth rush; the babble comes from discrete bubbles in bar()
            const ru = this.bed('pink', t, 0.5), rbp = filt('bandpass', 1300, 0.7), rlp = filt('lowpass', 3500, 0.5), rg = gainN(0);
            ru.connect(rbp); rbp.connect(rlp); rlp.connect(rg); rg.connect(bg); rg.gain.setTargetAtTime(pr.water * K.water, t, 1);
            this.L.water = { lvl: pr.water, pan: rnd(-0.35, 0.35), rg: rg };
        }
        if (pr.waves) {
            const wv = this.bed('pink', t, 0.7), lp = filt('lowpass', 600, 0.5), g = gainN(0);
            wv.connect(lp); lp.connect(g); g.connect(bg);
            this.L.waves = { g: g, lp: lp, lvl: pr.waves * K.waves, next: t + 0.3 };
        }
        if (pr.rain) {
            const r1 = this.bed('white', t, 0.8), bp = filt('bandpass', 2800, 0.4), g = gainN(0);
            r1.connect(bp); bp.connect(g); g.connect(bg); g.gain.setTargetAtTime(pr.rain * K.rain, t, 1);
            this.L.rain = { lvl: pr.rain };
        }
        if (pr.city) {
            // Distant traffic: a dark, quiet rumble that breathes; the city itself lives in its events
            const c2 = this.bed('pink', t, 0.7), lp = filt('lowpass', 380, 0.5), g = gainN(0);
            c2.connect(lp); lp.connect(g); g.connect(bg); g.gain.setTargetAtTime(pr.city * K.city, t, 1);
            this.L.city = { g: g, lvl: pr.city * K.city };
        }
    }
    // Decorrelated stereo pair: a mono noise bed in the centre sounds like flat hiss
    bed(kind, t, width) {
        const g = gainN(1);
        [-width, width].forEach(pn => {
            const x = noiseN(kind);
            let o = x;
            startNoise(x, t); this.cont.push(x);
            if (ctx.createStereoPanner) { o = ctx.createStereoPanner(); o.pan.value = pn; x.connect(o); }
            o.connect(g);
        });
        return g;
    }
    fadeOut(t, dur) {
        if (this.end !== null) return;
        const v = clamp((t - this.t0) / this.fin, 0, 1);
        this.end = t + dur;
        [this.g, this.wg].forEach(x => { x.gain.cancelScheduledValues(t); x.gain.setValueAtTime(v, t); x.gain.linearRampToValueAtTime(0, t + dur); });
        this.dispose(t + dur + 0.2);
    }
    dispose(at) {
        this.cont.forEach(s => { try { if (at) s.stop(at); else s.stop(); } catch (e) { } });
        this.cont = [];
    }
    bar(p, t0) {
        const bd = p.barDur, L = this.L, nd = this.nd;
        if (this.end !== null && t0 > this.end) return;
        if (L.wind) {
            const gt = t0 + rnd(0, bd * 0.5), v = L.wind.lvl * (chance(0.4) ? rnd(0.5, 1) : rnd(0.15, 0.4));
            L.wind.g.gain.setTargetAtTime(v, gt, rnd(1.2, 2.4)); L.wind.bp.frequency.setTargetAtTime(rnd(300, 700), gt, 2);
            // Foliage only stirs with a stronger gust: one soft swell instead of constant crackle
            if (L.leaves && v > L.wind.lvl * 0.65) noiseHit(nd, gt + rnd(0.3, 0.9), { kind: 'pink', type: 'bandpass', f: 1700, f2: 2600, q: 0.6, dur: rnd(2, 3.2), att: rnd(0.9, 1.5), vel: L.leaves.lvl * 0.05, wet: 0.35, pan: rnd(-0.6, 0.6) });
        }
        if (L.water) {
            const Wt = L.water;
            Wt.rg.gain.setTargetAtTime(Wt.lvl * K.water * rnd(0.7, 1.1), t0 + rnd(0, bd), 2);
            for (let bb = poisson(bd * 9 * Wt.lvl / 0.3); bb > 0; bb--) bubble(nd, t0 + rnd(0, bd), Wt);
        }
        if (L.waves) {
            const w = L.waves;
            while (w.next < t0 + bd) {
                const up = rnd(2.6, 3.6), down = rnd(4, 6), peak = w.lvl * rnd(0.6, 1), wt = Math.max(w.next, t0);
                w.g.gain.setTargetAtTime(peak, wt, up / 3); w.g.gain.setTargetAtTime(w.lvl * 0.12, wt + up, down / 3);
                w.lp.frequency.setTargetAtTime(rnd(1300, 1900), wt, up / 3); w.lp.frequency.setTargetAtTime(500, wt + up, down / 3);
                noiseHit(nd, wt + up * 0.8, { type: 'highpass', f: 2500, dur: 2.5, att: 0.6, vel: peak * K.foam, wet: 0.3, pan: rnd(-0.4, 0.4) });
                w.next = wt + up + down * rnd(0.7, 1);
            }
        }
        if (L.city) L.city.g.gain.setTargetAtTime(L.city.lvl * rnd(0.5, 1), t0 + rnd(0, bd), 2.5);
        if (L.rain) for (let r = poisson(10 * L.rain.lvl * bd / 4); r > 0; r--) noiseHit(nd, t0 + rnd(0, bd), { f: rnd(2500, 6000), q: 3, dur: 0.015, vel: rnd(0.01, 0.03), pan: rnd(-0.8, 0.8) });
        if (this.end !== null) return;
        const ev = this.np.ev || {}, mul = (p.genre === 'nature' ? 2.4 : 1) * EVMUL[p.E === null ? 2 : p.E] * (NOEV ? 0 : 1);
        for (const k in ev) {
            if (!EV.hasOwnProperty(k)) continue;
            for (let m = poisson(ev[k] * mul * bd / 60); m > 0; m--) EV[k](nd, t0 + rnd(0, bd), p);
        }
    }
}

// Brook bubble: tiny sine whose pitch jumps up as the air pocket collapses
function bubble(d, t, w) {
    const f = rnd(450, 1300), du = rnd(0.025, 0.07), x = oscN('sine', f), g = gainN(0), v = w.lvl * rnd(0.012, 0.04);
    x.frequency.setValueAtTime(f, t); x.frequency.exponentialRampToValueAtTime(f * rnd(1.4, 2.1), t + du);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.setTargetAtTime(0, t + du * 0.4, du / 3);
    x.connect(g); send(g, d, 0.25, 0, clamp(w.pan + rnd(-0.25, 0.25), -0.8, 0.8)); x.start(t); x.stop(t + du * 2 + 0.03);
}
function birdCall(d, t, lvl) {
    const x = oscN('sine', 3000), g = gainN(0), n = 2 + Math.floor(Math.random() * 5), base = rnd(2400, 4200), type = Math.floor(Math.random() * 3);
    let tt = t;
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < n; i++) {
        const du = rnd(0.04, 0.11), f0 = base * rnd(0.85, 1.2), f1 = f0 * (type === 0 ? rnd(1.2, 1.6) : type === 1 ? rnd(0.6, 0.85) : rnd(0.9, 1.1));
        x.frequency.setValueAtTime(f0, tt); x.frequency.exponentialRampToValueAtTime(f1, tt + du);
        g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(lvl, tt + 0.008); g.gain.linearRampToValueAtTime(0, tt + du);
        tt += du + rnd(0.03, 0.09);
    }
    const p0 = rnd(-0.8, 0.8);
    x.connect(g);
    if (chance(0.35)) sendMove(g, d, 0.45, p0, clamp(p0 + rnd(-0.9, 0.9), -0.9, 0.9), t, tt - t); else send(g, d, 0.45, 0, p0);
    x.start(t); x.stop(tt + 0.05);
}
// Japanese bush warbler (uguisu): "hōō — hokekyo"
function uguisu(d, t, lvl) {
    const x = oscN('sine', 1000), g = gainN(0), F = x.frequency, s = rnd(0.95, 1.08), t2 = t + 1.05, t3 = t2 + 0.16, t4 = t3 + 0.17;
    F.setValueAtTime(980 * s, t); F.linearRampToValueAtTime(1080 * s, t + 0.8);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl * 0.8, t + 0.25); g.gain.setValueAtTime(lvl * 0.8, t + 0.7); g.gain.linearRampToValueAtTime(0, t + 0.9);
    F.setValueAtTime(1500 * s, t2); F.exponentialRampToValueAtTime(2500 * s, t2 + 0.09);
    g.gain.setValueAtTime(0, t2); g.gain.linearRampToValueAtTime(lvl, t2 + 0.02); g.gain.linearRampToValueAtTime(0, t2 + 0.11);
    F.setValueAtTime(2300 * s, t3); F.exponentialRampToValueAtTime(1700 * s, t3 + 0.1);
    g.gain.setValueAtTime(0, t3); g.gain.linearRampToValueAtTime(lvl * 0.9, t3 + 0.02); g.gain.linearRampToValueAtTime(0, t3 + 0.12);
    F.setValueAtTime(2400 * s, t4); F.linearRampToValueAtTime(2900 * s, t4 + 0.08); F.exponentialRampToValueAtTime(2200 * s, t4 + 0.4);
    g.gain.setValueAtTime(0, t4); g.gain.linearRampToValueAtTime(lvl, t4 + 0.03); g.gain.setValueAtTime(lvl, t4 + 0.28); g.gain.linearRampToValueAtTime(0, t4 + 0.42);
    x.connect(g); send(g, d, 0.5, 0, rnd(-0.6, 0.6)); x.start(t); x.stop(t4 + 0.5);
}
function crane(d, t, lvl) {
    const n = 2 + Math.floor(Math.random() * 2), base = rnd(820, 1000), x = oscN('triangle', base), lp = filt('lowpass', 2600, 0.7), g = gainN(0);
    let tt = t;
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < n; i++) {
        x.frequency.setValueAtTime(base * 0.92, tt); x.frequency.linearRampToValueAtTime(base * 1.08, tt + 0.06); x.frequency.linearRampToValueAtTime(base, tt + 0.2);
        g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(lvl, tt + 0.03); g.gain.linearRampToValueAtTime(0, tt + 0.22);
        tt += rnd(0.3, 0.45);
    }
    const p0 = rnd(-0.8, 0.8);
    x.connect(lp); lp.connect(g); sendMove(g, d, 0.8, p0, clamp(p0 + (p0 < 0 ? 0.5 : -0.5), -0.9, 0.9), t, tt - t); x.start(t); x.stop(tt + 0.1);
}
// Bell cricket (suzumushi)
function cricket(d, t, lvl) {
    const x = oscN('sine', rnd(4200, 4900)), g = gainN(0), reps = 2 + Math.floor(Math.random() * 3), pulses = 3 + Math.floor(Math.random() * 4);
    let tt = t;
    g.gain.setValueAtTime(0, t);
    for (let r = 0; r < reps; r++) {
        for (let q = 0; q < pulses; q++) { g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(lvl, tt + 0.008); g.gain.linearRampToValueAtTime(0, tt + 0.03); tt += 0.045; }
        tt += rnd(0.25, 0.5);
    }
    x.connect(g); send(g, d, 0.3, 0, rnd(-0.9, 0.9)); x.start(t); x.stop(tt + 0.05);
}
function frog(d, t, lvl) {
    const n = 3 + Math.floor(Math.random() * 4), base = rnd(110, 170), x = oscN('sawtooth', base), bp = filt('bandpass', rnd(600, 900), 4), g = gainN(0);
    let tt = t;
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < n; i++) {
        x.frequency.setValueAtTime(base * 1.1, tt); x.frequency.linearRampToValueAtTime(base * 0.9, tt + 0.08);
        g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(lvl, tt + 0.015); g.gain.linearRampToValueAtTime(0, tt + 0.09);
        tt += rnd(0.18, 0.3);
    }
    x.connect(bp); bp.connect(g); send(g, d, 0.35, 0, rnd(-0.8, 0.8)); x.start(t); x.stop(tt + 0.05);
}
function owl(d, t, lvl) {
    const x = oscN('sine', 390), g = gainN(0);
    g.gain.setValueAtTime(0, t);
    [[0, 0.42], [0.95, 0.22], [1.25, 0.5]].forEach(n => {
        const tt = t + n[0];
        x.frequency.setValueAtTime(400, tt); x.frequency.linearRampToValueAtTime(360, tt + n[1]);
        g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(lvl, tt + 0.08); g.gain.linearRampToValueAtTime(0, tt + n[1]);
    });
    x.connect(g); send(g, d, 0.7, 0, rnd(-0.7, 0.7)); x.start(t); x.stop(t + 2);
}
function drip(d, t, lvl) {
    const f = rnd(900, 2000), x = oscN('sine', f), g = gainN(0);
    x.frequency.setValueAtTime(f * 0.7, t); x.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.05);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 0.004); g.gain.setTargetAtTime(0, t + 0.01, 0.025);
    x.connect(g); send(g, d, 0.8, 0, rnd(-0.8, 0.8)); x.start(t); x.stop(t + 0.25);
}
function knock(d, t, lvl) {
    const f = rnd(420, 700), pan = rnd(-0.7, 0.7);
    wood(d, t, f, lvl, { wet: 0.5, pan: pan });
    if (chance(0.5)) wood(d, t + rnd(0.1, 0.18), f * rnd(0.9, 1.15), lvl * 0.7, { wet: 0.5, pan: pan });
}
// Shishi-odoshi: water trickles into the bamboo, then the tock
function shishi(d, t, lvl) {
    noiseHit(d, t, { type: 'bandpass', f: 2600, q: 2.5, dur: 2.2, att: 1.8, vel: lvl * 0.18, pan: -0.2, wet: 0.3 });
    wood(d, t + 2.3, 380, lvl, { wet: 0.75, pan: -0.2 });
    noiseHit(d, t + 2.33, { type: 'bandpass', f: 1400, q: 1, dur: 0.3, vel: lvl * 0.15, pan: -0.25, wet: 0.4 });
}
function chimes(d, t, lvl, s, lo, hi, dec, n) {
    const notes = scaleNotes(s, lo, hi), pan = rnd(-0.6, 0.6);
    let tt = t;
    for (let i = 0; i < n; i++) { bell(d, tt, pick(notes), lvl * rnd(0.6, 1), { decay: dec, ratio: 2.4, index: 0.7, wet: 0.5, pan: pan }); tt += rnd(0.06, 0.2); }
}
function train(d, t, lvl) {
    const s = noiseN('pink'), bp = filt('bandpass', 280, 0.9), g = gainN(0), du = rnd(6, 9);
    let out = g;
    bp.frequency.setValueAtTime(260, t); bp.frequency.linearRampToValueAtTime(520, t + du * 0.45); bp.frequency.linearRampToValueAtTime(300, t + du);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + du * 0.45); g.gain.linearRampToValueAtTime(0, t + du);
    s.connect(bp); bp.connect(g);
    if (ctx.createStereoPanner) { out = ctx.createStereoPanner(); out.pan.setValueAtTime(-0.8, t); out.pan.linearRampToValueAtTime(0.8, t + du); g.connect(out); }
    out.connect(d.dry); startNoise(s, t); s.stop(t + du + 0.2);
    for (let tt = t + du * 0.25; tt < t + du * 0.75; tt += 0.42) {
        const a = lvl * 0.35 * (1 - Math.abs((tt - t) / du - 0.5) * 2);
        noiseHit(d, tt, { f: 1800, q: 4, dur: 0.02, vel: a }); noiseHit(d, tt + 0.11, { f: 1700, q: 4, dur: 0.02, vel: a * 0.8 });
    }
}
// Raspy insect tone: a carrier chopped by a fast pulse train
function rasp(x, rate, depth) {
    const am = gainN(1 - depth), lf = oscN('square', rate), lg = gainN(depth);
    lf.connect(lg); lg.connect(am.gain); x.connect(am); return { out: am, lf: lf };
}
// Minmin-zemi (summer cicada): "miiin—min-min-min—" swell, pulses, fade
function minmin(d, t, lvl) {
    const x = oscN('sine', rnd(3800, 4400)), r = rasp(x, rnd(90, 140), 0.6), g = gainN(0), du = rnd(5, 8);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl * 0.6, t + 1.2);
    for (let tt = t + 1.2; tt < t + du - 1; tt += 0.32) { g.gain.linearRampToValueAtTime(lvl, tt + 0.08); g.gain.linearRampToValueAtTime(lvl * 0.35, tt + 0.3); }
    g.gain.linearRampToValueAtTime(0, t + du);
    r.out.connect(g); send(g, d, 0.3, 0, rnd(-0.8, 0.8));
    x.start(t); r.lf.start(t); x.stop(t + du + 0.1); r.lf.stop(t + du + 0.1);
}
// Higurashi (evening cicada): "kana-kana-kana…" falling in pitch and strength
function higurashi(d, t, lvl) {
    const fc = rnd(4300, 4700), x = oscN('sine', fc), r = rasp(x, 160, 0.4), am = gainN(0), g = gainN(lvl), n = 22 + Math.floor(Math.random() * 14);
    let tt = t;
    for (let i = 0; i < n; i++) {
        const a = Math.min(1, (i + 1) / 4) * (1 - i / n * 0.7);
        am.gain.setValueAtTime(0, tt); am.gain.linearRampToValueAtTime(a, tt + 0.012); am.gain.linearRampToValueAtTime(a * 0.25, tt + 0.05); am.gain.linearRampToValueAtTime(0, tt + 0.085);
        x.frequency.setValueAtTime(fc * (1 - i / n * 0.12), tt);
        tt += 0.11;
    }
    r.out.connect(am); am.connect(g); send(g, d, 0.5, 0, rnd(-0.8, 0.8));
    x.start(t); r.lf.start(t); x.stop(tt + 0.1); r.lf.stop(tt + 0.1);
}
// Sequence of whistled notes [Hz start, Hz end, s, level, gap] with short gaps
function whistle(d, t, lvl, notes, wet, type) {
    const x = oscN(type || 'sine', notes[0][0]), g = gainN(0), lp = filt('lowpass', 5000, 0.5);
    let tt = t;
    g.gain.setValueAtTime(0, t);
    notes.forEach(n => {
        x.frequency.setValueAtTime(n[0], tt); x.frequency.exponentialRampToValueAtTime(n[1], tt + n[2]);
        g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(lvl * (n[3] || 1), tt + Math.min(0.03, n[2] * 0.3)); g.gain.setValueAtTime(lvl * (n[3] || 1), tt + n[2] * 0.7); g.gain.linearRampToValueAtTime(0, tt + n[2]);
        tt += n[2] + (n[4] || 0.04);
    });
    x.connect(lp); lp.connect(g); send(g, d, wet, 0, rnd(-0.7, 0.7)); x.start(t); x.stop(tt + 0.05);
}
// Hototogisu (lesser cuckoo): "tokkyo kyoka kyoku"
function hototogisu(d, t, lvl) {
    const s = rnd(0.92, 1.08);
    whistle(d, t, lvl, [[1750 * s, 1900 * s, 0.1], [2500 * s, 2300 * s, 0.16, 1, 0.05], [2150 * s, 2350 * s, 0.09], [2600 * s, 2400 * s, 0.14, 1, 0.05], [2100 * s, 1850 * s, 0.24, 0.9]], 0.55);
}
// Kakkō (cuckoo): "kak-ko", a falling third, a few times
function kakko(d, t, lvl) {
    const s = rnd(0.95, 1.05), seq = [], n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) seq.push([760 * s, 740 * s, 0.16, 1, 0.08], [610 * s, 590 * s, 0.32, 0.85, 0.55]);
    whistle(d, t, lvl, seq, 0.7);
}
// Kajika frog: a flute-like rising trill by the mountain stream
function kajika(d, t, lvl) {
    const seq = [], n = 8 + Math.floor(Math.random() * 8), f = rnd(1700, 2000);
    for (let i = 0; i < n; i++) { const fi = f * (1 + i / n * 0.35); seq.push([fi * 0.92, fi * 1.05, 0.05, 0.6 + 0.4 * i / n, 0.035]); }
    whistle(d, t, lvl, seq, 0.45);
}
// Karasu (crow): two or three hoarse caws
function karasu(d, t, lvl) {
    const n = 2 + Math.floor(Math.random() * 2), pn = rnd(-0.8, 0.8), f = rnd(520, 620);
    let tt = t;
    for (let i = 0; i < n; i++) {
        const x = oscN('sawtooth', f), b1 = filt('bandpass', 1250, 1.8), b2 = filt('bandpass', 2500, 2.5), g = gainN(0), du = rnd(0.28, 0.4);
        x.frequency.setValueAtTime(f * 1.05, tt); x.frequency.linearRampToValueAtTime(f * 0.88, tt + du);
        g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(lvl, tt + 0.04); g.gain.setValueAtTime(lvl, tt + du * 0.6); g.gain.linearRampToValueAtTime(0, tt + du);
        x.connect(b1); x.connect(b2); b1.connect(g); b2.connect(g); send(g, d, 0.6, 0, pn);
        x.start(tt); x.stop(tt + du + 0.05); tt += du + rnd(0.25, 0.45);
    }
}
// Railway crossing (fumikiri): the alternating "kan-kan" bell
function fumikiri(d, t, lvl) {
    const du = rnd(5, 8), pn = rnd(-0.6, 0.6);
    for (let tt = t, i = 0; tt < t + du; tt += 0.48, i++) bell(d, tt, i % 2 ? 83 : 84, lvl * (1 - (tt - t) / du * 0.4), { decay: 0.25, ratio: 2.76, index: 1.2, wet: 0.6, pan: pn });
}
// A car passing in the distance: a dark swell that travels across the stereo field
function car(d, t, lvl) {
    const s = noiseN('pink'), lp = filt('lowpass', 260, 0.7), g = gainN(0), du = rnd(3.5, 5.5), dir = chance(0.5) ? 1 : -1;
    lp.frequency.setValueAtTime(260, t); lp.frequency.linearRampToValueAtTime(rnd(700, 1000), t + du * 0.5); lp.frequency.linearRampToValueAtTime(260, t + du);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + du * 0.5); g.gain.linearRampToValueAtTime(0, t + du);
    s.connect(lp); lp.connect(g); sendMove(g, d, 0.3, -0.7 * dir, 0.7 * dir, t, du);
    startNoise(s, t); s.stop(t + du + 0.1);
}
const EV = {
    minmin: (d, t) => minmin(d, t, 0.009),
    higurashi: (d, t) => higurashi(d, t, 0.014),
    hototogisu: (d, t) => hototogisu(d, t, 0.024),
    kakko: (d, t) => kakko(d, t, 0.03),
    kajika: (d, t) => kajika(d, t, 0.018),
    karasu: (d, t) => karasu(d, t, 0.02),
    fumikiri: (d, t) => fumikiri(d, t, 0.01),
    car: (d, t) => car(d, t, 0.03),
    suikin(d, t, s) { const nt = scaleNotes(s, 79, 96), pn = rnd(-0.6, 0.6); suikin(d, t, pick(nt), rnd(0.015, 0.03), pn); if (chance(0.4)) suikin(d, t + rnd(0.15, 0.4), pick(nt), 0.012, pn); },
    chirp: (d, t) => birdCall(d, t, 0.028),
    uguisu: (d, t) => uguisu(d, t, 0.03),
    crane: (d, t) => crane(d, t, 0.022),
    cricket: (d, t) => cricket(d, t, 0.011),
    frog: (d, t) => frog(d, t, 0.03),
    owl: (d, t) => owl(d, t, 0.03),
    drip: (d, t) => drip(d, t, 0.035),
    knock: (d, t) => knock(d, t, 0.045),
    shishi: (d, t) => shishi(d, t, 0.06),
    bell: (d, t, s) => kane(d, t, low(s.k, 43), 0.045, { wet: 0.95, pan: rnd(-0.5, 0.5) }),
    furin: (d, t, s) => chimes(d, t, 0.028, s, 86, 98, 1.1, 1 + Math.floor(Math.random() * 3)),
    tinkle: (d, t, s) => chimes(d, t, 0.012, s, 96, 108, 0.45, 2 + Math.floor(Math.random() * 4)),
    train: (d, t) => train(d, t, 0.07)
};
