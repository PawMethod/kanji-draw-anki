// Player: one per genre; plays the current song bar by bar, crossfades in and out, follows the landscape

const pickV = theme => { const vo = VOPT[theme] || VOPT.neutral; return chance(0.4) ? vo[0] : pick(vo); };
// Sample zones each genre / signature needs, pre-rendered in the background
const WARM = {
    ambient: [['suikin', 72, 98], ['glass', 76, 96], ['koto', 72, 100], ['piano', 36, 56]], zen: [['koto', 40, 76], ['bowl', 52, 78], ['kane', 40, 56]],
    piano: [['piano', 36, 96], ['celesta', 76, 96]], lofi: [['bass', 24, 60], ['ep', 52, 80], ['vibes', 60, 90]], nature: [['suikin', 76, 98], ['kane', 40, 56]]
};
const SIGW = { koto: ['koto', 56, 84], shamisen: ['shamisen', 52, 76], suikin: ['suikin', 76, 96], biwa: ['biwa', 44, 66], taiko: ['taiko', 40, 48], paranku: ['sanshin', 56, 80] };
function warmV(V) { V.forEach(v => { if (STR[v]) bank.warm(v, VREG[v][0] - 14, VREG[v][1] + 14); }); }

class Player {
    constructor(genre) {
        const gn = GENRES[genre] || GENRES.ambient, th = THEMES[cur.theme] || THEMES.neutral, sp = SPACE[cur.theme] || SPACE.neutral;
        this.genre = genre; this.gn = gn; this.th = cur.theme; this.dark = cur.dark;
        this.bar = 0; this.nextT = 0; this.endT = null; this.ending = false; this.fv = null; this.cont = []; this.N = [];
        this.hist = []; this.E = null; this.st = FL.stage(); this.hit = null; this.accent = false; this.want = null; this.recent = [];
        this.plan = []; this.si = 0; this.sb = 0; this.needSong = true; this.prevVoice = null;
        this.V = pickV(this.th); this.sig = th.sig; this.pendV = null; this.pendSig = null;
        this.bright = th.bright * (this.dark ? 0.72 : 1); this.dyn = this.dark ? 0.85 : 1;
        // Signal flow: dry/nature → tone filter → fader → music bus; wet → damping → fader → reverb; echo → fader → echo
        this.dry = gainN(gn.gain); this.nat = gainN(gn.nat); this.wet = gainN(sp.verb); this.mwet = gainN(gn.gain); this.nwet = gainN(gn.nat); this.echo = gainN(sp.echo * gn.gain);
        this.toneF = Math.min(18000, gn.tone * this.bright);
        this.tone = filt('lowpass', this.toneF, 0.5); this.damp = filt('lowpass', sp.damp, 0.5);
        this.fd = gainN(0); this.fw = gainN(0); this.fe = gainN(0);
        this.dry.connect(this.tone); this.nat.connect(this.tone); this.tone.connect(this.fd); this.fd.connect(G.music);
        this.mwet.connect(this.wet); this.nwet.connect(this.wet); this.wet.connect(this.damp); this.damp.connect(this.fw); this.fw.connect(G.verbIn);
        this.echo.connect(this.fe); this.fe.connect(G.echoIn);
        this.d = { dry: this.dry, wet: this.mwet, echo: this.echo };
    }
    // Fader value at time t (follows the equal-power curve of fade())
    valAt(t) {
        const f = this.fv;
        if (!f) return 0;
        if (t <= f.t) return f.a;
        if (t >= f.t + f.d) return f.b;
        const x = (t - f.t) / f.d;
        return f.a + (f.b - f.a) * (f.b > f.a ? Math.sin(x * Math.PI / 2) : 1 - Math.cos(x * Math.PI / 2));
    }
    // Equal-power fade on all three faders (dry, reverb, echo)
    fade(to, t, dur) {
        const from = this.valAt(t);
        [this.fd, this.fw, this.fe].forEach(f => {
            const p = f.gain;
            p.cancelScheduledValues(t); p.setValueAtTime(from, t);
            for (let i = 1; i <= 16; i++) {
                const x = i / 16, y = to > from ? Math.sin(x * Math.PI / 2) : 1 - Math.cos(x * Math.PI / 2);
                p.linearRampToValueAtTime(from + (to - from) * y, t + dur * x);
            }
        });
        this.fv = { a: from, b: to, t: t, d: dur };
    }
    // st: saved position (sessionStorage) or the player of the previous genre — the song continues where it was
    begin(t, dur, st) {
        this.nextT = t;
        const ok = st && SONG_BY[st.id] && st.plan && st.plan.length && st.si < st.plan.length && st.plan.every(x => x && typeof x.k === 'string' && x.n > 0);
        if (ok) { this.recent = (st.rec || []).slice(-3); this.load(SONG_BY[st.id], +st.tp || 0); this.plan = st.plan; this.si = st.si; this.sb = Math.min(st.sb, st.plan[st.si].n - 1); this.needSong = false; }
        else this.newSong();
        this.N.push(new Nature(this, this.th, this.dark, t, Math.min(dur, 2)));
        if (this.gn.start) this.gn.start(this, t);
        this.fade(1, t, dur);
    }
    load(song, tp) {
        this.song = song; this.tp = tp; this.k = pc(song.key + tp); this.scale = song.scale; this.beats = song.beats;
        this.B = 60 / (song.bpm * this.gn.tm); this.barDur = this.B * this.beats;
        this.recent.push(song.id); if (this.recent.length > 4) this.recent.shift();
        this.warm();
    }
    warm() {
        (WARM[this.genre] || []).forEach(w => bank.warm(w[0], w[1], w[2]));
        warmV(this.V);
        if (SIGW[this.sig]) bank.warm.apply(bank, SIGW[this.sig]);
    }
    newSong() {
        const s = SFORCE && SONG_BY[SFORCE] ? SONG_BY[SFORCE] : pickSong(this.th, this.dark, this.recent);
        SFORCE = null;
        this.load(s, pick([0, 0, 0, 2, -2, -3]));
        this.plan = s.plan(this.genre); this.si = 0; this.sb = 0; this.needSong = false;
    }
    step() {
        if (++this.sb >= this.plan[this.si].n) { this.sb = 0; if (++this.si >= this.plan.length) this.needSong = true; }
    }
    // A new landscape is noted now and applied once it has stayed for SETTLE ms
    retheme(theme, dark) {
        if (theme === this.th && dark === this.dark && !this.want) return;
        this.want = { theme: theme, dark: dark, at: clockMs() };
    }
    applyWant(t0) {
        const w = this.want;
        if (!w || clockMs() - w.at < SETTLE) return;
        this.want = null;
        if (w.theme === this.th && w.dark === this.dark) return;
        const sp = SPACE[w.theme] || SPACE.neutral, th = THEMES[w.theme] || THEMES.neutral;
        if (w.theme !== this.th) { this.pendV = pickV(w.theme); this.pendSig = th.sig; }
        this.th = w.theme; this.dark = w.dark;
        this.wet.gain.setTargetAtTime(sp.verb, t0, 1.5); this.echo.gain.setTargetAtTime(sp.echo * this.gn.gain, t0, 1.5); this.damp.frequency.setTargetAtTime(sp.damp, t0, 1.5);
        this.bright = th.bright * (this.dark ? 0.72 : 1); this.toneF = Math.min(18000, this.gn.tone * this.bright); this.dyn = this.dark ? 0.85 : 1;
        this.N.forEach(n => n.fadeOut(t0, 4));
        this.N.push(new Nature(this, this.th, this.dark, t0, 4));
        while (this.N.length > 3) { const o = this.N.shift(); o.fadeOut(t0, 0.3); o.dispose(t0 + 0.5); }
        if (this.pendV) warmV(this.pendV);
    }
    scheduleBar(t0) {
        if (this.needSong) this.newSong();
        const sec = this.plan[this.si], sb = this.sb, s = this.song, k = this.k, B = this.B;
        if (sb === 0 && this.pendV) { this.V = this.pendV; this.sig = this.pendSig || this.sig; this.pendV = this.pendSig = null; }
        const idx = sec.k === 'v' ? sb % s.nb : sec.k === 'in' ? Math.max(0, s.nb - sec.n + sb) : sec.k === 'br' ? sb % Math.min(4, s.nb) : s.nb - 1;
        const bar = s.bars[idx], segs = bar.ch.map(c => { const r = pc(k + c.r); return { t: t0 + c.b0 * B, b0: c.b0, len: c.len, root: r, pcs: CHT[c.q].map(x => pc(r + x)) }; });
        this.hist.push({ t: t0, segs: segs }); if (this.hist.length > 8) this.hist.shift();
        this.applyWant(t0);
        const sg = FL.stage();
        if (sg !== this.st) { this.hit = sg > this.st ? 'up' : 'down'; this.st = sg; if (this.hit === 'down') FL.calmUntil = t0 + this.barDur * 2; }
        const tgt = FL.energy(t0, sg);
        // ±1 step per bar keeps the build-up gradual; the bloom may jump
        this.E = this.E === null || tgt >= 4 || this.E >= 4 ? tgt : clamp(tgt, this.E - 1, this.E + 1);
        this.tone.frequency.setTargetAtTime(Math.min(18000, this.toneF * TONEMUL[this.E]), t0, 1.2);
        NV = 0;
        this.gn.bar(this, t0, { sec: sec, sb: sb, first: sb === 0, last: sb === sec.n - 1, bar: bar, segs: segs, idx: idx });
        if (this.accent) { this.accent = false; accentBar(this, t0, !this.hit); }
        if (this.hit) { stageHit(this, t0, this.hit); this.hit = null; }
        this.N.forEach(n => n.bar(this, t0));
        this.N = this.N.filter(n => { if (n.end !== null && t0 > n.end + 1) { n.dispose(); return false; } return true; });
        this.step();
        this.save();
    }
    fadeOut(t, dur, force) {
        if (this.ending && !force) return;
        const end = t + dur;
        if (this.ending && this.endT !== null && this.endT <= end) return;
        this.ending = true; this.endT = end;
        this.fade(0, t, dur);
        this.cont.forEach(s => { try { s.stop(end + 0.3); } catch (e) { } });
        this.N.forEach(n => n.dispose(end + 0.3));
    }
    dispose() {
        [this.fd, this.fw, this.fe].forEach(f => { try { f.disconnect(); } catch (e) { } });
        this.cont.forEach(s => { try { s.stop(); } catch (e) { } });
        this.N.forEach(n => n.dispose());
        this.cont = []; this.N = [];
    }
    snapshot() {
        return { g: this.genre, id: this.song.id, tp: this.tp, plan: this.plan, si: this.si, sb: this.sb, rec: this.recent, flow: Math.round(FL.level() * 100) / 100, done: FL.done };
    }
    save() {
        if (OFF || this.ending) return;
        try { const st = this.snapshot(); st.ts = Date.now(); sessionStorage.setItem(SS, JSON.stringify(st)); } catch (e) { }
    }
    describe() {
        const sec = this.plan[this.si] || {};
        return this.genre + ' ' + (this.song ? this.song.id : '-') + ' ' + this.th + (this.dark ? '/n' : '/d') + (this.ending ? ' (fading)' : '') + ' E' + this.E + ' ' + ['jo', 'ha', 'kyu'][this.st] + ' ' + (sec.k || '') + (sec.tr ? ':' + sec.tr : '') + ' ' + this.sb;
    }
}
