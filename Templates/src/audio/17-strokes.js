// Stroke sounds: one voice per pen stroke, shaped by speed and pressure; gentle ducking of the music

const panOf = x => clamp((x - 54.5) / 54.5, -1, 1) * 0.35;
function spot() { return clamp(panOf(lastX) * 1.6, -0.6, 0.6); }

class StrokeVoice {
    constructor(style, x, y, pressure, ptype) {
        const t = now(), c = SK[style], amp = gainN(0), d = { dry: G.stroke, wet: G.verbIn, echo: null };
        const sc = imm() ? live() : null, r = RES[style];
        let out = amp, tones = sc && sc.song ? ctones(sc, t, r.lo, r.hi) : null;
        Object.assign(this, { style: style, c: c, x: x, y: y, ms: clockMs(), sp: 0, upd: 0, m: 0, pen: ptype === 'pen', pr: +pressure || 0, src: [], amp: amp });
        if (ctx.createStereoPanner) { this.pan = ctx.createStereoPanner(); this.pan.pan.value = panOf(x); amp.connect(this.pan); out = this.pan; }
        out.connect(G.stroke);
        const src = kind => { const s = noiseN(kind); startNoise(s, t); this.src.push(s); return s; };
        if (style === 'gel') {
            // Rolling ball: smooth, narrow "ssss" plus a faint glide tone
            const gs = src('pink'), bp = filt('bandpass', c.f0, 1.3), lp = filt('lowpass', 3600, 0.5), tn = oscN('sine', 1200), tg = gainN(0);
            gs.connect(bp); bp.connect(lp); lp.connect(amp); tn.connect(tg); tg.connect(amp); tn.start(t); this.src.push(tn);
            this.f = bp; this.tg = tg;
            blip(d, t, 2600, 2300, 0.02, 0.01);
        } else if (style === 'ink') {
            // Brush: breathy low band with bristle flutter; soft "dab" on contact
            const is = src('pink'), lp = filt('lowpass', c.f0, 0.8), hp = filt('highpass', 180, 0.5), ib = gainN(0.6), am = src('white'), amf = filt('lowpass', 14, 0.5), amg = gainN(20);
            is.connect(lp); lp.connect(hp); hp.connect(ib); ib.connect(amp); am.connect(amf); amf.connect(amg); amg.connect(ib.gain);
            this.f = lp;
            thock(d, t, 45, 0.035);
        } else if (style === 'neon') {
            // Soft glow on the chord root (else the key): two slightly detuned sines beat slowly, a quiet
            // triangle an octave up carries it on phone speakers. Speed changes brightness, never pitch
            const f = mtof(low(sc && sc.song ? chordAt(sc, t).root : ks().k, 50)), lp = filt('lowpass', c.f0, 0.7), og = gainN(0.25);
            const o1 = oscN('sine', f), o2 = oscN('sine', f * 1.003), o3 = oscN('triangle', f * 2);
            o1.connect(lp); o2.connect(lp); o3.connect(og); og.connect(lp); lp.connect(amp);
            [o1, o2, o3].forEach(o => { o.start(t); this.src.push(o); });
            this.f = lp;
            // Pen down: a quiet ping two octaves up instead of a zap
            const z = oscN('sine', f * 4), zg = gainN(0);
            zg.gain.setValueAtTime(0, t); zg.gain.linearRampToValueAtTime(0.007, t + 0.01); zg.gain.setTargetAtTime(0, t + 0.02, 0.07);
            z.connect(zg); zg.connect(out); send(zg, d, 0.5, 0, 0); z.start(t); z.stop(t + 0.5);
        } else {
            // Soft pencil on smooth paper: warm friction band, slow fine graphite grain (no hiss, no crackle)
            const ps = src('pink'), bp = filt('bandpass', c.f0, 0.7), lp = filt('lowpass', 4200, 0.5), gr = gainN(0.7), gm = src('pink'), gmf = filt('lowpass', 28, 0.5), gmg = gainN(1.6);
            ps.connect(bp); bp.connect(lp); lp.connect(gr); gr.connect(amp); gm.connect(gmf); gmf.connect(gmg); gmg.connect(gr.gain);
            const body = src('brown'), bbp = filt('bandpass', 480, 0.8), bg = gainN(0.5);
            body.connect(bbp); bbp.connect(bg); bg.connect(amp);
            this.f = bp;
            noiseHit(d, t, { kind: 'pink', type: 'lowpass', f: 1600, q: 0.6, dur: 0.018, att: 0.003, vel: 0.02 });
        }
        if (tones && tones.length) {
            // Pen resonance: the stroke texture rings faintly in two tones of the current chord
            const rb = gainN(r.k), rw = gainN(0.7);
            if (tones.length > 2) tones = [tones[0], tones[Math.floor(tones.length / 2)]];
            tones.forEach(m => { const bp = filt('bandpass', mtof(m), 40); amp.connect(bp); bp.connect(rb); });
            rb.connect(this.pan || G.stroke); rb.connect(rw); rw.connect(G.verbIn);
        }
        amp.gain.setValueAtTime(0, t); amp.gain.setTargetAtTime(c.base, t, 0.02);
        // Without pointer events the pen counts as resting: let the speed decay
        if (!OFF) this.iv = setInterval(() => { if (SV === this && clockMs() - this.ms > 45) { this.sp *= 0.5; this.apply(); } }, 40);
    }
    apply() {
        const t = now(), c = this.c, m = clamp((this.sp - 4) / 150, 0, 1), loud = Math.pow(m, 0.8);
        const pf = this.pen && this.pr > 0 ? 0.55 + 0.9 * clamp(this.pr, 0, 1) : 1;
        this.m = m;
        this.amp.gain.setTargetAtTime((c.base + c.k * loud) * pf, t, 0.03);
        this.f.frequency.setTargetAtTime(c.f0 + (c.f1 - c.f0) * m, t, 0.05);
        if (this.pan) this.pan.pan.setTargetAtTime(panOf(this.x), t, 0.1);
        if (this.tg) this.tg.gain.setTargetAtTime(0.012 * loud, t, 0.05);
    }
    move(x, y, pressure) {
        const ms = clockMs(), dt = Math.max(1, ms - this.ms) / 1000, dist = Math.sqrt((x - this.x) * (x - this.x) + (y - this.y) * (y - this.y));
        this.x = x; this.y = y; this.ms = ms; if (pressure > 0) this.pr = pressure;
        this.sp += (dist / dt - this.sp) * Math.min(1, dt / 0.06);
        if (ms - this.upd < 25) return;
        this.upd = ms; this.apply();
    }
    release() {
        clearInterval(this.iv);
        const t = now(), c = this.c, d = { dry: G.stroke, wet: G.verbIn, echo: null }, end = t + c.rel * 8 + 0.05;
        this.amp.gain.cancelScheduledValues(t); this.amp.gain.setTargetAtTime(0, t, c.rel);
        if (this.style === 'ink' && this.m > 0.4) noiseHit(d, t, { kind: 'pink', type: 'bandpass', f: 1400, f2: 3800, q: 1.4, dur: 0.14, att: 0.02, vel: 0.05 * this.m, pan: this.pan ? panOf(this.x) : 0 });
        this.src.forEach(s => { try { s.stop(end); } catch (e) { } });
    }
}

function strokeStart(style, x, y, pressure, ptype) {
    lastStyle = SK.hasOwnProperty(style) ? style : 'standard'; lastX = +x || 54.5;
    const sc = live();
    if (sc && imm()) {
        FL.add(0.03);
        // Pen-down tick (full immersion only), at most twice a second and never when answers are queued
        if (imm() > 1 && fxOn() && now() - lastTick > 0.5 && FL.dens() > 0.7) { lastTick = now(); play(tn => penTick(sc, nextGrid(sc, 4, tn))); }
    }
    if (cfg.level === 'off' || cfg.stroke !== 'on') return;
    touch();
    const tok = ++sTok, st = lastStyle;
    withCtx(() => {
        if (tok !== sTok) return;
        if (SV) { SV.release(); duck(false); }
        SV = new StrokeVoice(st, x, y, pressure, ptype);
        duck(true);
    });
}
function strokeMove(x, y, pressure) {
    if (!SV || !ctx) return;
    lastX = x; SV.move(x, y, pressure);
}
function strokeEnd() { sTok++; const v = SV; SV = null; if (v && ctx) { v.release(); duck(false); } }
// Gentle, slow ducking: the music steps back a little while the pen moves and never pumps with quick strokes
function duck(on) {
    if (!G || !musicOn()) return;
    const p = G.duck.gain, t = now();
    p.cancelScheduledValues(t); p.setTargetAtTime(on ? 0.82 : 1, t + (on ? 0 : 0.4), on ? 0.2 : 1.2);
}
function demoStroke(style) {
    if (cfg.level === 'off') return;
    if (cfg.stroke !== 'on') { lastStyle = SK.hasOwnProperty(style) ? style : lastStyle; if (fxOn()) play(FX.select); return; }
    let i = 0;
    strokeStart(style, 20, 40, 0.5, 'mouse');
    const iv = setInterval(() => {
        i++; strokeMove(20 + i * 5, 40 + Math.sin(i / 14 * Math.PI) * 14, 0.5);
        if (i >= 14) { clearInterval(iv); strokeEnd(); }
    }, 30);
}
