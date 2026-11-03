// Genres: one bar each (c: section, bar, chord segments); tm = tempo factor on the song's own tempo

const GENRES = {
    ambient: { tm: 0.8, tone: 9000, nat: 0.55, gain: 2.2, bar: ambientBar },
    zen: { tm: 0.85, tone: 11000, nat: 0.6, gain: 3.6, bar: zenBar },
    piano: { tm: 1, tone: 9000, nat: 0.35, gain: 0.9, bar: pianoBar },
    lofi: { tm: 1.08, tone: 3600, nat: 0.45, gain: 1.2, bar: lofiBar, start: lofiStart },
    nature: { tm: 1, tone: 16000, nat: 1.5, gain: 1.2, bar() { } }
};

function ambientBar(p, t0, c) {
    const B = p.B, E = p.E, sec = c.sec, bd = p.barDur;
    // Ground: one soft low piano tone per chord under the pedal — then nothing but decay
    if (sec.k !== 'ma' && (E >= 1 || c.sb % 2 === 0)) c.segs.forEach(sg => { piano(p.d, sg.t, low(sg.root, 40), 0.12 * p.dyn, sg.len * B, { wet: 0.6, ped: true }); });
    // Suikinkutsu: drops ring the buried jar, always within the mode
    const drops = scaleNotes(p, 74, 96), nd = poisson([0.3, 0.7, 1.1, 1.6, 2.2][E]);
    for (let i = 0; i < nd; i++) {
        const tt = t0 + rnd(0, bd), pn = rnd(-0.6, 0.6);
        suikin(p.d, tt, pick(drops), rnd(0.02, 0.035), pn);
        if (chance(0.25)) suikin(p.d, tt + rnd(0.12, 0.3), pick(drops), 0.014, pn);
    }
    if (sec.k === 'in' && c.first) tone('glass', p.d, t0 + 0.01, rootNear(p, 84), 0.02, { wet: 0.85, echo: 0.3 });
    melody(p, t0, c, 0.05, { far: true });
    if (sec.k === 'v' && c.sb % 2 === 1 && E >= 1 && chance(0.3)) harmonics(p, t0);
    if (sec.k === 'out' && c.last) singBowl(p.d, t0, low(p.k, 57), bd * 1.5, 0.026, { wet: 0.7 });
    if (rhythmOn(p) && p.sig === 'suikin') SIG.suikin(p, t0, E);
    if (E >= 4) shimmer(p, t0);
}
function zenBar(p, t0, c) {
    const B = p.B, E = p.E, sec = c.sec, str = p.th === 'okinawa' ? 'sanshin' : 'koto', dk = p.dyn;
    if (sec.k === 'ma') { if (c.first && E >= 1) bowl(p.d, t0 + B, low(p.k, 55), 0.035, { pan: -0.2 }); return; }
    // A struck bowl on the tonic opens every section
    if (c.first && sec.k !== 'out') bowl(p.d, t0, low(p.k, 55), (sec.k === 'v' ? 0.06 : 0.045) * dk, { pan: -0.15 });
    c.segs.forEach((sg, i) => {
        if (E <= 0 && i > 0) return;
        pluck(p.d, sg.t + 0.02, low(sg.root, 43), 0.06 * dk, { kind: str, decay: 2.4, bright: 5, wet: 0.5, pan: 0.1 });
        if (E >= 2 && sec.k !== 'out' && room(3)) {
            const tn = tonesIn(sg.pcs, 55, 74);
            for (let j = 1; j < sg.len && j <= 3 && tn.length; j++) pluck(p.d, sg.t + j * B, tn[(j * 2 + i) % tn.length], 0.026 * dk, { kind: str, decay: 1.4, bright: 5, wet: 0.5, echo: 0.1, pan: 0.2 });
        }
    });
    if (sec.k === 'v' && c.first && E >= 2 && p.st >= 1) sho(p.d, t0, voiceOf(c.segs[0], null, 67, 86), B * 3, 0.016, { wet: 0.85 });
    if (sec.k === 'out' && c.last) { bowl(p.d, t0, low(p.k, 55), 0.06 * dk); if (p.dark || p.th === 'sage') kane(p.d, t0 + B, low(p.k, 43), 0.045, { pan: 0.3 }); }
    melody(p, t0, c, 0.075, {});
    if (rhythmOn(p) && sec.k !== 'out') SIG[p.sig](p, t0, E);
    if (E >= 4) shimmer(p, t0);
}
function pianoBar(p, t0, c) {
    const B = p.B, E = p.E, sec = c.sec, dk = p.dyn, three = p.beats === 3;
    if (sec.k === 'ma') return;
    c.segs.forEach(sg => {
        const R = low(sg.root, 40), hold = sg.len * B, v = voiceOf(sg, p.prevVoice, 55, 72);
        let pat;
        p.prevVoice = v;
        // Intro and final bar: rolled chords under the pedal
        if (sec.k === 'in' || (sec.k === 'out' && c.last)) { [R].concat(v).forEach((m, j) => { piano(p.d, sg.t + j * 0.04, m, (j ? 0.13 : 0.24) * dk, hold, { wet: 0.5, ped: true }); }); return; }
        if (E <= 0) pat = [[0, R, 0.22]];
        else if (three) pat = [[0, R, 0.26], [1, v[0], 0.11], [2, v[1] || v[0], 0.1]];
        else if (sg.len >= 4) pat = [[0, R, 0.26], [1, R + 7, 0.15], [2, R + 12, 0.16], [3, v[v.length - 1], 0.12]];
        else pat = [[0, R, 0.25], [1, R + 7, 0.14]];
        if (E >= 3 && !three && sg.len >= 4) pat.push([2.5, v[0], 0.1]);
        pat.forEach(q => { if (q[0] < sg.len) piano(p.d, sg.t + q[0] * B + rnd(0, 0.01), q[1], q[2] * rnd(0.9, 1.04) * dk, Math.max(B, hold - q[0] * B), { wet: 0.4, ped: true }); });
    });
    melody(p, t0, c, 0.075, { lead: 'piano', part: p.V[0] });
    if (rhythmOn(p) && p.sig !== 'koto' && p.sig !== 'biwa' && sec.k !== 'out') SIG[p.sig](p, t0, E);
    if (E >= 4) shimmer(p, t0);
}
function lofiStart(p, t) {
    const c = noiseN('crackle'), g = gainN(0.6);
    c.connect(g); g.connect(p.dry); startNoise(c, t); p.cont.push(c);
}
function lofiBar(p, t0, c) {
    const B = p.B, sw = B * 0.14, E = p.E, sec = c.sec, dk = p.dyn * 0.9, nb = p.beats, gv = p.st === 2 ? 1 : p.st === 0 ? 2 : 0, play = sec.k !== 'ma';
    c.segs.forEach(sg => {
        const v = voiceOf(sg, p.prevVoice, 57, 76), R = low(sg.root, 36);
        p.prevVoice = v;
        // EP: a short stab on the chord, an answering stab later — chords that decay, no sustain
        v.forEach((m, j) => { ep(p.d, sg.t + 0.02 + j * 0.012, m, (play ? 0.05 : 0.03) * dk, Math.min(sg.len, 1.5) * B, { wet: 0.35 }); });
        if (!play || E < 1) return;
        if (sg.len >= 2 && chance(0.6)) v.forEach((m, j) => { ep(p.d, sg.t + (sg.len - 1.5) * B + sw + j * 0.01, m, 0.03 * dk, B * 0.6, { wet: 0.35 }); });
        bass(p.d, sg.t, R, 0.12, B * Math.min(1.6, sg.len));
        if (sg.len >= 3 && chance(0.6)) bass(p.d, sg.t + (sg.len - 1.5) * B + sw, R + pick([7, 12]), 0.09, B * 0.8);
    });
    if (play && sec.k !== 'out' && E >= 1) {
        kick(p.d, t0, 0.5 * dk);
        if (nb === 3) { if (gv === 1) kick(p.d, t0 + 1.5 * B + sw, 0.3 * dk); }
        else if (gv === 1) { kick(p.d, t0 + 1.75 * B + sw, 0.3 * dk); kick(p.d, t0 + 3 * B, 0.4 * dk); }
        else if (gv === 0) { if (chance(0.65)) kick(p.d, t0 + 2.5 * B + sw, 0.38 * dk); else kick(p.d, t0 + 2 * B, 0.4 * dk); }
        if (E >= 2) {
            if (nb === 3) brush(p.d, t0 + 2 * B, 0.3 * dk);
            else if (gv === 2) brush(p.d, t0 + 2 * B, 0.34 * dk);
            else { brush(p.d, t0 + B, 0.3 * dk); brush(p.d, t0 + 3 * B, 0.32 * dk); }
            const nh = gv === 1 ? nb * 4 : nb * 2;
            for (let i = 0; i < nh; i++) shaker(p.d, t0 + i * nb * B / nh + (i % 2 ? (nh > nb * 2 ? sw * 0.5 : sw) : 0), (i % 2 ? 0.1 : 0.16) * dk * (nh > nb * 2 ? 0.7 : 1));
            if (c.last && sec.k === 'v') for (let f = 0; f < 4; f++) brush(p.d, t0 + (nb - 1) * B + f * B / 4 + (f % 2 ? sw * 0.5 : 0), (0.12 + f * 0.06) * dk);
        }
    }
    melody(p, t0, c, 0.06, { sw: sw });
    if (rhythmOn(p) && p.sig !== 'koto' && p.sig !== 'suikin' && sec.k !== 'out') SIG[p.sig](p, t0, E);
    if (E >= 4) shimmer(p, t0);
}
