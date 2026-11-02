// Melody: the song's line on the landscape's instruments, with idiomatic ornaments and changing treatments

// Octave that puts the middle of the song's range into the middle of the instrument's register
function regBase(p, v) {
    const r = VREG[v] || VREG.koto, mid = (r[0] + r[1]) / 2 - (p.song.lo + p.song.hi) / 2;
    return p.k + 12 * Math.round((mid - p.k) / 12);
}
// One melody note: g grace from above, o push up and release (oshi-hanashi), y vibrato (yuri), f falling release
function playNote(p, v, t, m, dB, vel, pan, orn, far) {
    var d = p.d, dur = dB * p.B, tg = Math.max(now(), t - 0.07), wet = far ? 0.8 : 0.4, up = neighbor(p, m, 1) - m, dn = m - neighbor(p, m, -1), o;
    vel *= (VK[v] || 1) * p.dyn * rnd(0.88, 1.04);
    if (v === 'piano') {
        if (orn === 'g') piano(d, tg, m + up, vel * 0.55, 0.12, { wet: 0.45, pan: pan });
        piano(d, t, m, vel, dur + p.B * 0.5, { wet: 0.45, pan: pan, ped: true });
        return;
    }
    if (v === 'shaku' || v === 'fue') {
        flute(d, t, m, Math.max(0.25, dur * 0.92), vel, { wet: wet + 0.25, echo: far ? 0.35 : 0.2, pan: pan, fue: v === 'fue', grace: orn === 'g' ? m + up : orn === 'o' ? m - dn : 0, vib: orn === 'y' ? 0.02 : 0, fall: orn === 'f' ? 1 : 0 });
        return;
    }
    o = { kind: v, decay: v === 'shamisen' || v === 'sanshin' ? 0.85 : 1.6, bright: v === 'koto' ? 7 : 9, wet: v === 'biwa' ? wet + 0.1 : wet, echo: far ? 0.35 : 0.12, pan: pan, pick: true };
    if (orn === 'g') pluck(d, tg, m + up, vel * 0.5, o);
    if (orn === 'o' && dur > 0.5) { o.bend = up; o.bendAt = Math.min(0.3, dur * 0.3); o.release = dur * 0.35; }
    else if (orn === 'y' && dur > 0.6) o.yuri = true;
    else if (orn === 'f' && dur > 0.6) { o.bend = -1; o.bendAt = dur * 0.55; }
    pluck(d, t, m, vel, o);
}
// o: orn (ornaments), skel (only the main notes), lag (s), sw (swing on off-beats), oct, fall (last note falls)
function phrase(p, v, t0, notes, vel, pan, far, o) {
    o = o || {};
    const base = regBase(p, v) + (o.oct || 0);
    notes.forEach((n, i) => {
        if (o.skel && !(n.b % 1 === 0 && (n.b === 0 || n.d >= 1))) return;
        let orn = '';
        if (o.orn) { if (n.d >= 1.5) orn = chance(0.6) ? 'y' : 'o'; else if (n.d >= 0.5 && chance(0.15)) orn = 'g'; }
        if (o.fall && i === notes.length - 1 && n.d >= 1) orn = 'f';
        playNote(p, v, t0 + n.b * p.B + (o.sw && n.b % 1 ? o.sw : 0) + (o.lag || 0) + rnd(0, 0.01), base + n.p, n.d, vel, pan, orn, far);
    });
}
// Koto harmonics: two soft high tones with long echoes
function harmonics(p, t0) {
    const hn = ctones(p, t0 + 0.01, 79, 98);
    for (let h = 0; h < 2 && hn.length; h++) pluck(p.d, t0 + p.B * (h * 1.5 + rnd(0, 0.5)), pick(hn), 0.03, { decay: 2, bright: 3, wet: 0.85, echo: 0.45, pan: rnd(-0.5, 0.5) });
}
// The melodic layer of a bar; o: lead/part (instrument override), far, sw
function melody(p, t0, c, vel, o) {
    const sec = c.sec, s = p.song, E = p.E, lead = o.lead || p.V[0], part = o.part || p.V[1];
    if (E < 1 && sec.k !== 'v') return;
    if (sec.k === 'br') {
        // Interlude: the partner quotes the opening, the lead answers with the second bar; ma in between
        if (c.sb % 2 === 0) phrase(p, c.sb ? lead : part, t0, s.bars[c.sb ? Math.min(1, s.nb - 1) : 0].notes, vel * 0.85, c.sb ? -0.2 : 0.25, c.sb === 0, { orn: true, fall: true });
        else if (chance(0.7)) harmonics(p, t0);
        return;
    }
    if (sec.k === 'out') { if (c.first) phrase(p, part, t0, s.bars[s.nb - 1].notes, vel * 0.7, 0.3, true, { orn: true, fall: true }); return; }
    if (sec.k !== 'v') return;
    const tr = sec.tr, notes = c.bar.notes, skel = E <= 0, alt = Math.floor(c.sb / 2) % 2;
    let v = lead, het = null;
    if (tr === 'call' && alt) v = part;
    else if (tr === 'hi') v = part;
    else if (tr === 'frag' && c.sb % 2) { if (E >= 2 && notes.length) phrase(p, part, t0, notes.slice(-1), vel * 0.6, 0.35, true, { orn: true }); return; }
    if (tr === 'het' && p.st >= 1 && E >= 2 && !skel) het = part;
    phrase(p, v, t0, notes, vel * (skel ? 0.7 : 1) * (v === part ? 0.9 : 1), v === part ? 0.25 : -0.2, o.far, { orn: tr === 'orn' || tr === 'hi' || tr === 'call', skel: skel, sw: o.sw, oct: tr === 'hi' && (v === 'koto' || v === 'piano') ? 12 : 0, fall: c.last });
    if (het) phrase(p, het, t0, notes, vel * 0.55, 0.3, true, { skel: true, lag: 0.03 });
}
