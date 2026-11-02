// Harmony helpers: scales, voicings and the chord sounding at a given time

function tonesIn(pcs, lo, hi) { const r = []; for (let m = lo; m <= hi; m++) if (pcs.indexOf(pc(m)) >= 0) r.push(m); return r; }
// s: anything with a tonic pitch class k and a mode (scale offsets) — a Player, or a fallback key
function scaleNotes(s, lo, hi) { const r = []; for (let m = lo; m <= hi; m++) if (s.scale.indexOf(pc(m - s.k)) >= 0) r.push(m); return r; }
function low(m, base) { base = base || 36; return base + pc(m - base); }
function rootNear(s, m) { const r = m - pc(m - s.k); return m - r > 6 ? r + 12 : r; }
function nearestIdx(arr, m) { let bi = 0, bd = 1e9; for (let i = 0; i < arr.length; i++) { const d = Math.abs(arr[i] - m); if (d < bd) { bd = d; bi = i; } } return bi; }
// Each chord tone placed in [lo, hi], as close as possible to the previous voicing (smooth voice leading)
function voiceChord(notes, prev, lo, hi) {
    const out = [];
    notes.forEach(n => {
        let best = null, bd = 1e9;
        for (let m = lo; m <= hi; m++) {
            if (pc(m) !== pc(n)) continue;
            const d = prev && prev.length ? Math.min.apply(null, prev.map(p => Math.abs(p - m))) : Math.abs(m - (lo + hi) / 2);
            if (d < bd) { bd = d; best = m; }
        }
        if (best !== null && out.indexOf(best) < 0) out.push(best);
    });
    return out.sort((a, b) => a - b);
}
function voiceOf(seg, prev, lo, hi) { return voiceChord(seg.pcs.map(x => 60 + x), prev, lo, hi); }
// Neighbouring scale tone above (dir 1) or below (dir -1), within the song's mode
function neighbor(p, m, dir) {
    for (let i = 1; i <= 4; i++) if (p.scale.indexOf(pc(m + dir * i - p.k)) >= 0) return m + dir * i;
    return m + dir * 2;
}
// Bars are scheduled ahead, so look up the chord that actually sounds at t
function chordAt(p, t) {
    const h = p.hist;
    for (let i = h.length - 1; i >= 0; i--) {
        if (h[i].t > t + 0.01) continue;
        const sg = h[i].segs;
        for (let j = sg.length - 1; j >= 0; j--) if (sg[j].t <= t + 0.01) return sg[j];
        return sg[0];
    }
    return h.length ? h[0].segs[0] : { root: p.k, pcs: [p.k, pc(p.k + 7)] };
}
function ctones(p, t, lo, hi) { return tonesIn(chordAt(p, t).pcs, lo, hi); }
