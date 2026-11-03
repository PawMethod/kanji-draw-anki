// Signature percussion per landscape (one bar each), its accents, and the layers all genres share

const OST = [[0, 0.5, 1.5, 2, 3], [0, 1, 1.5, 2.5, 3], [0, 0.75, 1.5, 2, 3.5], [0.5, 1, 2, 2.5, 3]];
const fits = p => b => b < p.beats - 0.01;
const SIG = {
    koto(p, t0, E) {
        const tn = ctones(p, t0 + 0.01, 60, 79), pat = pick(OST).filter(fits(p)), pan = rnd(-0.3, 0.3);
        if (tn.length < 2) return;
        pat.forEach((b, i) => { if (E < 4 && chance(0.2)) return; pluck(p.d, t0 + b * p.B + rnd(0, 0.01), tn[(i * 2 + p.sb) % tn.length], (i ? 0.028 : 0.038) * (E >= 4 ? 1.2 : 1), { decay: 1, bright: 6, wet: 0.45, echo: 0.1, pan: pan, pick: true }); });
    },
    shamisen(p, t0) {
        const nt = scaleNotes(p, 55, 72), i0 = nearestIdx(nt, 60 + chordAt(p, t0 + 0.01).root), pan = rnd(-0.2, 0.2);
        pick(OST).filter(fits(p)).forEach((b, i) => { const ix = clamp(i0 + [0, 2, 1, 3, 0][i % 5] - (i % 2), 0, nt.length - 1); pluck(p.d, t0 + b * p.B + rnd(0, 0.012), nt[ix], (i ? 0.04 : 0.055), { kind: 'shamisen', decay: 0.8, bright: 9, wet: 0.35, pan: pan }); });
    },
    suikin(p, t0, E) {
        const tn = ctones(p, t0 + 0.01, 79, 96), pn = rnd(-0.5, 0.5);
        for (let i = 0, n = 2 + (E >= 4 ? 2 : 0); i < n && tn.length; i++) suikin(p.d, t0 + rnd(0, p.barDur), pick(tn), rnd(0.02, 0.035), pn + rnd(-0.2, 0.2));
    },
    biwa(p, t0) {
        const r = low(chordAt(p, t0 + 0.01).root, 46);
        pluck(p.d, t0, r, 0.07, { kind: 'biwa', decay: 2, bright: 8, wet: 0.5, pan: -0.2, bend: chance(0.5) ? 1 : 0, bendAt: 0.3 });
        if (chance(0.6)) pluck(p.d, t0 + (p.beats - 1.5) * p.B, r + 7, 0.05, { kind: 'biwa', decay: 1.6, bright: 8, wet: 0.5, pan: -0.2 });
    },
    furin(p, t0) {
        const nt = scaleNotes(p, 86, 98), pan = rnd(-0.6, 0.6);
        let tt = t0 + p.B * (1 + Math.floor(Math.random() * (p.beats - 1)));
        for (let i = 0, n = 1 + Math.floor(Math.random() * 3); i < n; i++) { bell(p.d, tt, pick(nt), 0.022 * rnd(0.6, 1), { decay: 1.2, ratio: 2.4, index: 0.7, wet: 0.55, pan: pan }); tt += rnd(0.06, 0.2); }
    },
    mokugyo(p, t0, E) {
        for (let i = 0; i < p.beats; i++) if (i !== 3 || E >= 4) wood(p.d, t0 + i * p.B, 470, i ? 0.018 : 0.03, { wet: 0.35, pan: -0.25 });
        if (E >= 4) for (let j = 0; j < p.beats; j++) wood(p.d, t0 + (j + 0.5) * p.B, 470, 0.012, { wet: 0.35, pan: -0.25 });
    },
    taiko(p, t0, E) {
        taiko(p.d, t0, 0.07 * (E >= 4 ? 1.2 : 1), { m: 43 });
        taiko(p.d, t0 + (p.beats - 1.5) * p.B, 0.05, { m: 47, pan: 0.2 });
        if (E >= 4 || chance(0.4)) taiko(p.d, t0 + (p.beats - 0.5) * p.B, 0.04, { m: 47, pan: 0.2 });
        if (chance(0.5)) { const tw = t0 + (p.beats - 1) * p.B; wood(p.d, tw, 2300, 0.03, { wet: 0.4, pan: 0.3 }); wood(p.d, tw + 0.09, 2200, 0.022, { wet: 0.4, pan: 0.3 }); }
    },
    hyoshigi(p, t0, E) {
        (p.beats >= 4 ? [0, 2] : [0]).forEach(b => { wood(p.d, t0 + b * p.B, 2300, 0.035, { wet: 0.45, pan: 0.3 }); wood(p.d, t0 + b * p.B + 0.085, 2200, 0.025, { wet: 0.45, pan: 0.3 }); });
        if (E >= 4) wood(p.d, t0 + (p.beats - 0.5) * p.B, 2400, 0.025, { wet: 0.45, pan: 0.3 });
    },
    paranku(p, t0) {
        [[0, 0.06, 41], [1.5, 0.04, 48], [2, 0.05, 41], [3.5, 0.035, 48]].forEach(h => { if (h[0] < p.beats) taiko(p.d, t0 + h[0] * p.B, h[1], { m: h[2], pan: 0.15 }); });
        const tn = ctones(p, t0 + 0.01, 62, 79);
        if (tn.length >= 2) [0, 0.5, 1, 2, 2.5, 3].filter(fits(p)).forEach((b, i) => { pluck(p.d, t0 + b * p.B + (b % 1 ? p.B * 0.08 : 0), tn[[0, 1, 0, 2, 1, 0][i] % tn.length], i % 2 ? 0.03 : 0.045, { kind: 'sanshin', decay: 0.8, bright: 9, wet: 0.3, pan: -0.2 }); });
    }
};
// One accent of the signature (completed kanji, stage changes)
const SIG_HIT = {
    koto(p, d, t0, vel) {
        const nt = scaleNotes(p, 60, 84), i0 = Math.floor(Math.random() * 3);
        for (let g = 0; g < 6 && i0 + g < nt.length; g++) pluck(d, t0 + g * 0.06, nt[i0 + g], 0.05 * vel, { decay: 1.4, bright: 6, wet: 0.5, pan: -0.3 + g * 0.12 });
    },
    shamisen(p, d, t0, vel, ch) { tonesIn(ch.pcs, 57, 72).slice(0, 3).forEach((m, i) => { pluck(d, t0 + i * 0.035, m, 0.06 * vel, { kind: 'shamisen', decay: 1, bright: 9, wet: 0.4 }); }); },
    suikin(p, d, t0, vel, ch) { for (let i = 0; i < 3; i++) suikin(d, t0 + i * rnd(0.1, 0.25), pick(tonesIn(ch.pcs, 79, 96)), 0.03 * vel, rnd(-0.5, 0.5)); },
    biwa(p, d, t0, vel, ch) { pluck(d, t0, low(ch.root, 46), 0.08 * vel, { kind: 'biwa', decay: 2.2, bright: 9, wet: 0.5, bend: 1, bendAt: 0.25 }); noiseHit(d, t0, { f: 2500, q: 1.2, dur: 0.03, vel: 0.03 * vel }); },
    furin(p, d, t0, vel) { const fn = scaleNotes(p, 86, 98); for (let j = 0; j < 4; j++) bell(d, t0 + j * rnd(0.05, 0.12), pick(fn), 0.024 * vel, { decay: 1.4, ratio: 2.4, index: 0.7, wet: 0.6 }); },
    mokugyo(p, d, t0, vel) { wood(d, t0, 470, 0.04 * vel, { wet: 0.4 }); wood(d, t0 + 0.14, 470, 0.028 * vel, { wet: 0.4 }); },
    taiko(p, d, t0, vel) { taiko(d, t0, 0.09 * vel, { m: 41 }); taiko(d, t0 + p.B / 2, 0.06 * vel, { m: 47, pan: 0.2 }); },
    hyoshigi(p, d, t0, vel) { wood(d, t0, 2300, 0.045 * vel, { wet: 0.45 }); wood(d, t0 + 0.09, 2200, 0.035 * vel, { wet: 0.45 }); },
    paranku(p, d, t0, vel) { [0, 0.25, 0.5].forEach((b, i) => { taiko(d, t0 + b * p.B, (0.07 - i * 0.015) * vel, { m: i === 2 ? 48 : 41 }); }); }
};
function sigHit(p, t0, vel) {
    const h = SIG_HIT[p.sig];
    if (h) h(p, p.d, t0, vel, chordAt(p, t0 + 0.01));
}

// Shimmer at full bloom: high chord tones on the half beats, wide stereo
function shimmer(p, t0) {
    const g = p.genre, tn = ctones(p, t0 + 0.01, g === 'zen' ? 72 : 79, g === 'zen' ? 91 : 98), n = p.beats * 2;
    if (tn.length < 2 || !room(n)) return;
    for (let i = 0; i < n; i++) {
        if (i % 4 === 3) continue;
        const t = t0 + i * p.B / 2 + (g === 'lofi' && i % 2 ? p.B * 0.07 : 0), m = tn[[0, 2, 1, 3, 1, 2, 0, 3][i] % tn.length], pan = i % 2 ? 0.55 : -0.55, v = i % 2 ? 0.7 : 1;
        if (g === 'zen' || g === 'nature') pluck(p.d, t, m, 0.028 * v, { decay: 1.6, bright: 3, wet: 0.8, echo: 0.3, pan: pan });
        else if (g === 'piano') piano(p.d, t, m, 0.09 * v, p.B, { wet: 0.6, pan: pan });
        else tone(g === 'lofi' ? 'vibes' : 'glass', p.d, t, m, 0.014 * v, { wet: 0.7, echo: 0.35, pan: pan, trem: g === 'lofi' ? 4.6 : 0 });
    }
}
function rhythmOn(p) { return p.E >= (p.st >= 2 ? 2 : 3) && room(14); }
