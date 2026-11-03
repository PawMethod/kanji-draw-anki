// Audio context, master graph (compressor, chorus, reverb, echo) and node helpers

function ensureCtx() {
    if (ctx) return ctx;
    if (disposed || cfg.level === 'off') return null;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { ctx = null; return null; } }
    // iOS 17+: mix with other audio and respect the silent switch
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { }
    setup(ctx);
    bank.warm('wood', 80, 96); bank.warm('celesta', 76, 96); bank.warm('glass', 72, 92);
    ctx.onstatechange = function () { if (ctx && ctx.state === 'running' && musicOn()) syncMusic(); };
    return ctx;
}
function setup(c) { NB = makeNoise(c); PW = makeWaves(c); G = buildGraph(c); }

function makeNoise(c) {
    var sr = c.sampleRate, n = Math.floor(sr * 3), nl = Math.floor(sr * 8), F = Math.floor(sr * 0.05), out = {};
    out.white = c.createBuffer(1, n, sr); out.crackle = c.createBuffer(1, n, sr);
    // Beds loop pink/brown: a 3 s loop is audible as a repeating pattern
    out.pink = c.createBuffer(1, nl, sr); out.brown = c.createBuffer(1, nl, sr);
    var w = out.white.getChannelData(0), cr = out.crackle.getChannelData(0);
    var p = new Float32Array(nl + F), b = new Float32Array(nl + F);
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0, hs = 0;
    for (var i = 0; i < nl + F; i++) {
        var x = Math.random() * 2 - 1;
        if (i < n) { w[i] = x; hs += (x - hs) * 0.3; cr[i] = hs * 0.03; }
        b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
        b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
        p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11; b6 = x * 0.115926;
        br = (br + 0.02 * x) / 1.02; b[i] = br * 3.5;
    }
    // Seamless loops: crossfade the overhang back into the head
    [[p, out.pink], [b, out.brown]].forEach(function (pr) {
        var s = pr[0], d = pr[1].getChannelData(0);
        for (var j = 0; j < nl; j++) d[j] = j < F ? s[j] * (j / F) + s[nl + j] * (1 - j / F) : s[j];
    });
    // Vinyl crackle: sparse decaying clicks of random polarity
    var clicks = Math.floor(n / sr * 6);
    for (var k = 0; k < clicks; k++) {
        var at = Math.floor(Math.random() * (n - 300)), amp = (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * Math.random() * 0.35), len = 20 + Math.floor(Math.random() * 120);
        for (var q = 0; q < len; q++) cr[at + q] += amp * Math.exp(-q / (len / 5)) * (q % 2 ? -0.5 : 1);
    }
    return out;
}
function makeIR(c, sec) {
    var sr = c.sampleRate, n = Math.floor(sr * sec), buf = c.createBuffer(2, n, sr), pre = Math.floor(sr * 0.018);
    for (var ch = 0; ch < 2; ch++) {
        var d = buf.getChannelData(ch), lp = 0;
        for (var i = pre; i < n; i++) {
            var x = (i - pre) / (n - pre);
            lp += (0.62 - 0.55 * x) * ((Math.random() * 2 - 1) - lp);
            d[i] = lp * Math.pow(1 - x, 2.2);
        }
        for (var r = 0; r < 7; r++) d[pre + Math.floor(sr * rnd(0.004, 0.05))] += (chance(0.5) ? -1 : 1) * (0.5 - r * 0.05);
    }
    return buf;
}
function makeWaves(c) {
    var sh = [0, 1, 0.32, 0.16, 0.07, 0.05, 0.025, 0.015], sre = new Float32Array(sh.length), sim = new Float32Array(sh.length);
    for (var j = 1; j < sh.length; j++) sim[j] = sh[j];
    // Free reed (shō): strong, slowly falling harmonic series
    var rd = [0, 1, 0.7, 0.55, 0.42, 0.3, 0.24, 0.17, 0.12, 0.09, 0.06], rre = new Float32Array(rd.length), rim = new Float32Array(rd.length);
    for (var q = 1; q < rd.length; q++) rim[q] = rd[q];
    return { shaku: c.createPeriodicWave(sre, sim), reed: c.createPeriodicWave(rre, rim) };
}
function buildGraph(c) {
    var g = {};
    function gn(v) { var x = c.createGain(); x.gain.value = v; return x; }
    g.master = gn(LEVEL[cfg.level] || 0);
    g.comp = c.createDynamicsCompressor();
    g.comp.threshold.value = -18; g.comp.knee.value = 12; g.comp.ratio.value = 4; g.comp.attack.value = 0.005; g.comp.release.value = 0.3;
    g.master.connect(g.comp); g.comp.connect(c.destination);
    g.music = gn(MLEVEL[cfg.musicLevel] || 0.7); g.duck = gn(1);
    var ls = c.createBiquadFilter(), hs = c.createBiquadFilter();
    ls.type = 'lowshelf'; ls.frequency.value = 170; ls.gain.value = 1; hs.type = 'highshelf'; hs.frequency.value = 7000; hs.gain.value = -2.5;
    g.music.connect(ls); ls.connect(hs); hs.connect(g.duck); g.duck.connect(g.master);
    // Stereo chorus: slowly moving delay lines widen and soften the synthesized voices
    var ci = gn(0.3), dlL = c.createDelay(0.05), dlR = c.createDelay(0.05), lL = c.createOscillator(), lR = c.createOscillator(), mL = gn(0.0022), mR = gn(0.0022), cm = c.createChannelMerger(2);
    dlL.delayTime.value = 0.013; dlR.delayTime.value = 0.019; lL.frequency.value = 0.19; lR.frequency.value = 0.26;
    lL.connect(mL); mL.connect(dlL.delayTime); lR.connect(mR); mR.connect(dlR.delayTime);
    g.duck.connect(ci); ci.connect(dlL); ci.connect(dlR); dlL.connect(cm, 0, 0); dlR.connect(cm, 0, 1); cm.connect(g.master);
    lL.start(); lR.start();
    g.stroke = gn(1); g.stroke.connect(g.master);
    g.fx = gn(1); g.fx.connect(g.master);
    g.verbIn = gn(1); g.verb = c.createConvolver(); g.verb.buffer = makeIR(c, 3.2); g.verbOut = gn(0.5);
    g.verbIn.connect(g.verb); g.verb.connect(g.verbOut); g.verbOut.connect(g.master);
    // Ping-pong echo
    g.echoIn = gn(1);
    var dl = c.createDelay(2), dr = c.createDelay(2), fb = gn(0.3), lp = c.createBiquadFilter(), mg = c.createChannelMerger(2);
    dl.delayTime.value = 0.43; dr.delayTime.value = 0.29; lp.type = 'lowpass'; lp.frequency.value = 2400;
    g.echoIn.connect(dl); dl.connect(dr); dr.connect(lp); lp.connect(fb); fb.connect(dl);
    dl.connect(mg, 0, 0); dr.connect(mg, 0, 1);
    g.echoOut = gn(0.45); mg.connect(g.echoOut); g.echoOut.connect(g.master);
    var es = gn(0.3); g.echoOut.connect(es); es.connect(g.verbIn);
    return g;
}
function FXD() { return { dry: G.fx, wet: G.verbIn, echo: G.echoIn }; }

function gainN(v) { var g = ctx.createGain(); g.gain.value = v; return g; }
function filt(type, f, q) { var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; }
function oscN(type, f) { var o = ctx.createOscillator(); if (PW && PW[type]) o.setPeriodicWave(PW[type]); else o.type = type; o.frequency.value = f; return o; }
function noiseN(kind) { var s = ctx.createBufferSource(); s.buffer = NB[kind]; s.loop = true; return s; }
function startNoise(s, t) { s.start(t, Math.random() * (s.buffer.duration - 0.5)); }
// Route a voice: dry bus, optional reverb/echo sends and stereo position
function send(node, dst, wet, echo, pan) {
    var o = node;
    if (pan && ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -0.95, 0.95); node.connect(p); o = p; }
    o.connect(dst.dry);
    if (wet > 0 && dst.wet) { var w = gainN(wet); o.connect(w); w.connect(dst.wet); }
    if (echo > 0 && dst.echo) { var e = gainN(echo); o.connect(e); e.connect(dst.echo); }
}
// Like send(), with the source travelling across the stereo field
function sendMove(node, dst, wet, p0, p1, t, dur) {
    var o = node;
    if (ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.setValueAtTime(p0, t); p.pan.linearRampToValueAtTime(p1, t + dur); node.connect(p); o = p; }
    o.connect(dst.dry);
    if (wet > 0 && dst.wet) { var w = gainN(wet); o.connect(w); w.connect(dst.wet); }
}
