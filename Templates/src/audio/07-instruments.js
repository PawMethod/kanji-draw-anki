// Instruments: each call schedules one note/hit at time t into a destination {dry, wet, echo}

// Rendered tuned-percussion note; optional damping (dur), tremolo (trem Hz) or auto-pan (autopan Hz)
function tone(kind, dst, t, m, vel, o) {
    o = o || {}; var z = zoneOf(m), b = bank.get(kind, z), r = Math.pow(2, (m - z) / 12), len = b.duration / r;
    var s = ctx.createBufferSource(), lp = filt('lowpass', Math.min(16000, mtof(m) * (o.bright || 12)), 0.5), g = gainN(vel), out = g;
    s.buffer = b; s.playbackRate.value = r; NV++;
    if (o.dur && o.dur < len) { g.gain.setValueAtTime(vel, t + o.dur); g.gain.setTargetAtTime(0, t + o.dur, 0.1); len = o.dur + 0.6; }
    s.connect(lp); lp.connect(g);
    if (o.trem) { var tl = oscN('sine', o.trem), tg = gainN(0.3), tm = gainN(0.7); tl.connect(tg); tg.connect(tm.gain); g.connect(tm); out = tm; tl.start(t); tl.stop(t + len); }
    if (o.autopan && ctx.createStereoPanner) { var ap = ctx.createStereoPanner(), al = oscN('sine', o.autopan), ag = gainN(0.45); al.connect(ag); ag.connect(ap.pan); out.connect(ap); out = ap; al.start(t); al.stop(t + len); }
    send(out, dst, o.wet || 0, o.echo || 0, o.autopan ? 0 : o.pan || 0);
    s.start(t); s.stop(t + len);
}
// Shō (gagaku mouth organ): a free-reed cluster that swells in and fades — a short colour, never a bed
function sho(dst, t, notes, dur, vel, o) {
    o = o || {}; var att = Math.min(1.2, dur * 0.4), end = t + dur + 1.6;
    var lp = filt('lowpass', 3000, 0.6), g = gainN(0), v = vel / Math.max(1, notes.length * 0.6);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + att); g.gain.setValueAtTime(v, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
    lp.connect(g); send(g, dst, o.wet || 0.6, 0, 0);
    notes.slice(0, 4).forEach(function (m, i) {
        var x = oscN('reed', mtof(m)), tgt = lp; NV++;
        x.detune.value = rnd(-5, 5);
        if (ctx.createStereoPanner) { tgt = ctx.createStereoPanner(); tgt.pan.value = (i / Math.max(1, notes.length - 1) - 0.5) * 0.6; tgt.connect(lp); }
        x.connect(tgt); x.start(t); x.stop(end);
    });
}
function bell(dst, t, m, vel, o) {
    o = o || {}; var f = mtof(m), dec = o.decay || 1.5, end = t + dec * 5 + 0.05;
    var c = oscN('sine', f), md = oscN('sine', f * (o.ratio || 3.5)), mg = gainN(0), a = gainN(0); NV++;
    mg.gain.setValueAtTime(f * (o.index != null ? o.index : 1), t); mg.gain.setTargetAtTime(0, t, dec * 0.3);
    md.connect(mg); mg.connect(c.frequency);
    a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(vel, t + 0.004); a.gain.setTargetAtTime(0, t + 0.004, dec);
    c.connect(a); send(a, dst, o.wet || 0, o.echo || 0, o.pan || 0);
    c.start(t); md.start(t); c.stop(end); md.stop(end);
}
function noiseHit(dst, t, o) {
    var s = noiseN(o.kind || 'white'), fl = filt(o.type || 'bandpass', o.f, o.q || 1), g = gainN(0), d = o.dur, a = o.att || 0.002;
    if (o.f2) { fl.frequency.setValueAtTime(o.f, t); fl.frequency.exponentialRampToValueAtTime(o.f2, t + d); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.vel, t + a);
    g.gain.setTargetAtTime(0, t + a, Math.max(0.004, (d - a) / 3));
    s.connect(fl); fl.connect(g); send(g, dst, o.wet || 0, o.echo || 0, o.pan || 0);
    startNoise(s, t); s.stop(t + d * 2 + 0.1);
}
function swish(dst, t, f0, f1, dur, vel, pan) { noiseHit(dst, t, { kind: 'pink', type: 'bandpass', f: f0, f2: f1, q: 1.2, dur: dur, vel: vel, att: dur * 0.45, wet: 0.25, pan: pan || 0 }); }
function blip(dst, t, f0, f1, dur, vel) {
    var x = oscN('sine', f0), g = gainN(0);
    x.frequency.setValueAtTime(f0, t); x.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.005); g.gain.setTargetAtTime(0, t + dur * 0.5, dur / 3);
    x.connect(g); send(g, dst, 0.15, 0, 0); x.start(t); x.stop(t + dur * 2.5 + 0.05);
}
function wood(dst, t, f, vel, o) {
    o = o || {};
    tone('wood', dst, t, ftom(f), vel * 1.3, { wet: o.wet || 0, echo: o.echo || 0, pan: o.pan || 0, bright: 10 });
}
function pluck(dst, t, m, vel, o) {
    o = o || {};
    if (o.synth) return synthPluck(dst, t, m, vel, o);
    var kind = o.kind || 'koto', z = zoneOf(m), b = bank.get(kind, z), r = Math.pow(2, (m - z) / 12), f = mtof(m), dec = o.decay || 1.4;
    var s = ctx.createBufferSource(), lp = filt('lowpass', Math.min(15000, f * (o.bright || 7) * 1.6), 0.6), g = gainN(0);
    var pr = s.playbackRate; NV++;
    s.buffer = b;
    // A hard pluck starts slightly sharp (string tension)
    pr.setValueAtTime(r * 1.007, t); pr.linearRampToValueAtTime(r, t + 0.07);
    // Oshi: pressing the string behind the bridge raises the pitch (and releasing it lowers it again)
    if (o.bend) {
        var bt = t + Math.max(0.08, o.bendAt || 0.2), rb = r * Math.pow(2, o.bend / 12);
        pr.setValueAtTime(r, bt); pr.linearRampToValueAtTime(rb, bt + 0.14);
        if (o.release) { pr.setValueAtTime(rb, bt + 0.14 + o.release); pr.linearRampToValueAtTime(r, bt + 0.3 + o.release); }
    } else if (o.yuri) {
        for (var yi = 1; yi <= 8; yi++) pr.linearRampToValueAtTime(r * (yi % 2 ? 1.014 : 0.998), t + 0.3 + yi * 0.11);
        pr.linearRampToValueAtTime(r, t + 1.3);
    }
    g.gain.setValueAtTime(vel * 1.3, t); g.gain.setTargetAtTime(0, t + 0.02, dec * 0.9);
    s.connect(lp); lp.connect(g); send(g, dst, o.wet || 0, o.echo || 0, o.pan || 0);
    s.start(t); s.stop(t + Math.min(b.duration / r, dec * 4 + 0.1));
    if (o.pick && kind === 'koto') noiseHit(dst, t, { f: Math.min(9000, f * 6), q: 1.5, dur: 0.01, vel: vel * 0.25, pan: o.pan || 0 });
}
function synthPluck(dst, t, m, vel, o) {
    o = o || {}; var f = mtof(m), dec = o.decay || 1.4, end = t + dec * 4 + 0.05, br = Math.min(16000, f * (o.bright || 7));
    var a = oscN(o.wave || 'sawtooth', f), b = oscN('triangle', f), lp = filt('lowpass', br, o.q || 1.4), g = gainN(0); NV++;
    b.detune.value = 5;
    lp.frequency.setValueAtTime(br, t); lp.frequency.setTargetAtTime(f * 1.3, t + 0.005, dec * 0.2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.003); g.gain.setTargetAtTime(0, t + 0.003, dec * 0.4);
    a.connect(lp); b.connect(lp); lp.connect(g); send(g, dst, o.wet || 0, o.echo || 0, o.pan || 0);
    a.start(t); b.start(t); a.stop(end); b.stop(end);
    if (o.pick) noiseHit(dst, t, { f: Math.min(9000, f * 6), q: 1.5, dur: 0.012, vel: vel * 0.35, pan: o.pan || 0 });
}
// Shakuhachi / shinobue: breathy attack (muraiki), slide into pitch (meri→kari), late vibrato
function flute(dst, t, m, dur, vel, o) {
    o = o || {}; var f = mtof(m), end = t + dur + 1.2, g0 = o.grace ? mtof(o.grace) : f * 0.955;
    var a = oscN('shaku', f), vib = oscN('sine', o.fue ? rnd(5.8, 6.6) : rnd(4.6, 5.4)), vg = gainN(0), g = gainN(0), lp = filt('lowpass', f * (o.fue ? 6 : 5), 0.5); NV++;
    a.frequency.setValueAtTime(g0, t); a.frequency.exponentialRampToValueAtTime(f, t + (o.grace ? (g0 < f ? 0.16 : 0.07) : 0.22));
    // Phrase ends often drop in pitch as the breath fades
    if (o.fall) { a.frequency.setValueAtTime(f, t + dur); a.frequency.exponentialRampToValueAtTime(f * Math.pow(2, -o.fall / 12), t + dur + 0.4); }
    vg.gain.setValueAtTime(0, t + dur * 0.45); vg.gain.linearRampToValueAtTime(f * (o.vib || 0.011), t + dur);
    vib.connect(vg); vg.connect(a.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.18); g.gain.linearRampToValueAtTime(vel * 0.85, t + dur * 0.6);
    g.gain.linearRampToValueAtTime(vel, t + dur); g.gain.setTargetAtTime(0, t + dur, 0.18);
    a.connect(lp); lp.connect(g); send(g, dst, o.wet || 0, o.echo || 0, o.pan || 0);
    // Breath: a narrow noise band on the pitch (sustained) plus a broad chiff on the attack
    var n = noiseN('pink'), bp = filt('bandpass', f, 9), ng = gainN(0), n2 = noiseN('white'), bp2 = filt('bandpass', f * 2.5, 0.9), cg = gainN(0);
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(vel * 1.6, t + 0.15); ng.gain.setValueAtTime(vel * 1.6, t + dur); ng.gain.setTargetAtTime(0, t + dur, 0.15);
    cg.gain.setValueAtTime(0, t); cg.gain.linearRampToValueAtTime(vel * 0.45, t + 0.04); cg.gain.setTargetAtTime(0, t + 0.05, 0.07);
    n.connect(bp); bp.connect(ng); send(ng, dst, o.wet || 0, 0, o.pan || 0);
    n2.connect(bp2); bp2.connect(cg); send(cg, dst, o.wet || 0, 0, o.pan || 0);
    a.start(t); vib.start(t); startNoise(n, t); startNoise(n2, t);
    a.stop(end); vib.stop(end); n.stop(end); n2.stop(t + 0.6);
}
function piano(dst, t, m, vel, dur, o) {
    o = o || {}; var z = zoneOf(m), b = bank.get('piano', z), r = Math.pow(2, (m - z) / 12), f = mtof(m), A = vel * 0.92, rt = t + Math.max(0.15, dur), rel = o.ped ? 0.7 : 0.16, end = Math.min(t + b.duration / r, rt + rel * 5);
    var s = ctx.createBufferSource(), lp = filt('lowpass', Math.min(16000, f * (4 + 26 * vel)), 0.5), g = gainN(0); NV++;
    s.buffer = b; s.playbackRate.value = r;
    g.gain.setValueAtTime(A, t); g.gain.setValueAtTime(A, rt); g.gain.setTargetAtTime(0, rt, rel);
    s.connect(lp); lp.connect(g); send(g, dst, o.wet || 0, 0, o.pan || 0);
    s.start(t); s.stop(end);
}
// Electric piano: rendered tine/bar partials with stereo auto-pan
function ep(dst, t, m, vel, dur, o) {
    o = o || {};
    tone('ep', dst, t, m, vel * 1.6, { dur: Math.max(0.12, dur), wet: o.wet, echo: o.echo, autopan: 3.4, bright: 7 });
}
function bass(dst, t, m, vel, dur) {
    var z = zoneOf(m), b = bank.get('bass', z), r = Math.pow(2, (m - z) / 12), rt = t + dur, end = Math.min(t + b.duration / r, rt + 0.4);
    var s = ctx.createBufferSource(), lp = filt('lowpass', 1000, 0.7), g = gainN(0), x = oscN('sine', mtof(m)), sg = gainN(0), sum = gainN(1); NV++;
    s.buffer = b; s.playbackRate.value = r;
    g.gain.setValueAtTime(vel * 0.9, t); g.gain.setValueAtTime(vel * 0.9, rt); g.gain.setTargetAtTime(0, rt, 0.07);
    sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(vel * 0.5, t + 0.01); sg.gain.setTargetAtTime(vel * 0.25, t + 0.01, 0.3); sg.gain.setTargetAtTime(0, rt, 0.07);
    s.connect(lp); lp.connect(g); g.connect(sum); x.connect(sg); sg.connect(sum); send(sum, dst, 0.05, 0, 0);
    s.start(t); x.start(t); s.stop(end); x.stop(rt + 0.4);
}
function kick(dst, t, vel) {
    var o = oscN('sine', 115), g = gainN(0); NV++;
    o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.004); g.gain.setTargetAtTime(0, t + 0.004, 0.09);
    o.connect(g); send(g, dst, 0, 0, 0); o.start(t); o.stop(t + 0.6);
}
function brush(dst, t, vel) { noiseHit(dst, t, { type: 'bandpass', f: 3200, f2: 1800, q: 0.8, dur: 0.16, vel: vel * 0.12, att: 0.006, wet: 0.2 }); }
function shaker(dst, t, vel) { noiseHit(dst, t, { type: 'highpass', f: 7000, q: 0.7, dur: 0.045, vel: vel * 0.08, att: 0.004, pan: 0.25 }); }
function marimba(dst, t, m, vel) { tone('marimba', dst, t, m, vel * 1.9, { wet: 0.3, bright: 14 }); }
// Singing bowl struck with a padded mallet
function bowl(dst, t, m, vel, o) {
    o = o || {};
    tone('bowl', dst, t, m, vel, { wet: o.wet || 0.55, echo: o.echo || 0, pan: o.pan || 0, bright: 24 });
    noiseHit(dst, t, { kind: 'pink', type: 'lowpass', f: 380, q: 0.7, dur: 0.05, vel: vel * 0.25, pan: o.pan || 0 });
}
// Rubbed singing bowl: the stick circling the rim makes the tone swell, wobble and fade away
function singBowl(dst, t, m, dur, vel, o) {
    o = o || {}; var f = mtof(m), end = t + dur + 6, g = gainN(0), am = gainN(1), lfo = oscN('sine', rnd(1.2, 2.4)), lg = gainN(0.3); NV += 2;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + dur * 0.5); g.gain.setValueAtTime(vel, t + dur * 0.7); g.gain.setTargetAtTime(0, t + dur * 0.7, 1.6);
    lfo.connect(lg); lg.connect(am.gain); am.connect(g); send(g, dst, o.wet || 0.6, 0, o.pan || 0);
    [[1, 1, 0], [1, 0.8, rnd(0.6, 1.4)], [2.76, 0.18, 0], [2.76, 0.12, rnd(1, 2.5)]].forEach(function (p) {
        var x = oscN('sine', f * p[0] + p[2]), a = gainN(p[1] * 0.5);
        x.connect(a); a.connect(am); x.start(t); x.stop(end);
    });
    lfo.start(t); lfo.stop(end);
}
// Temple bell (bonshō), struck with a wooden beam
function kane(dst, t, m, vel, o) {
    o = o || {};
    tone('kane', dst, t, m, vel, { wet: o.wet || 0.75, pan: o.pan || 0, bright: 18 });
    noiseHit(dst, t, { kind: 'brown', type: 'lowpass', f: 260, q: 0.7, dur: 0.12, vel: vel * 0.6, wet: 0.6, pan: o.pan || 0 });
}
// Suikinkutsu: a little splash, then the jar rings
function suikin(dst, t, m, vel, pan) {
    var f = rnd(1800, 3200), x = oscN('sine', f), g = gainN(0);
    x.frequency.setValueAtTime(f, t); x.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.03);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.25, t + 0.003); g.gain.setTargetAtTime(0, t + 0.01, 0.012);
    x.connect(g); send(g, dst, 0.4, 0, pan); x.start(t); x.stop(t + 0.12);
    tone('suikin', dst, t + 0.015, m, vel, { wet: 0.85, echo: 0.3, pan: pan, bright: 10 });
}
// Taiko: rendered drum body plus the stick's slap; m sets the drum size
function taiko(dst, t, vel, o) {
    o = o || {};
    tone('taiko', dst, t, o.m || 45, vel * 1.4, { wet: o.wet || 0.4, pan: o.pan || 0, bright: 30 });
    noiseHit(dst, t, { kind: 'pink', type: 'lowpass', f: 700, q: 0.7, dur: 0.05, vel: vel * 0.5, wet: 0.3, pan: o.pan || 0 });
}
function thock(dst, t, m, vel) {
    var f = mtof(m), x = oscN('sine', f * 1.5), g = gainN(0), lp = filt('lowpass', 900, 0.7); NV++;
    x.frequency.setValueAtTime(f * 1.5, t); x.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.004); g.gain.setTargetAtTime(0, t + 0.004, 0.07);
    x.connect(lp); lp.connect(g); send(g, dst, 0.15, 0, 0); x.start(t); x.stop(t + 0.6);
    noiseHit(dst, t, { kind: 'pink', type: 'lowpass', f: 700, q: 0.7, dur: 0.05, vel: vel * 0.6 });
}
// Progress chime in the timbre of the active stroke style
function chime(style, dst, t, m, vel) {
    if (style === 'ink') pluck(dst, t, m, vel * 1.3, { decay: 1.2, bright: 6, wet: 0.35, pick: true });
    else if (style === 'gel') tone('glass', dst, t, m, vel, { wet: 0.4 });
    else if (style === 'neon') tone('vibes', dst, t, m, vel * 1.6, { wet: 0.35, echo: 0.35, trem: 5 });
    else marimba(dst, t, m, vel * 1.2);
}
