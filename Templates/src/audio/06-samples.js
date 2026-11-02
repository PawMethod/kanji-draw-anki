// Rendered instrument samples: one note per 4-semitone zone, computed in code once and cached

// Tuned percussion as modal partials [frequency ratio, amplitude, T60 s]; decay shortens with pitch above ref
const MODAL = {
    // Singing bowl and temple bell: close partial pairs beat slowly (the typical wobble); long and low, so half the sample rate suffices
    bowl: { dur: 16, ref: 60, sr: 11025, click: 0.015, att: 0.004, parts: [[1, 1, 24], [1.0035, 0.7, 21], [2.76, 0.5, 12], [2.768, 0.35, 11], [5.4, 0.22, 6.5], [5.42, 0.15, 6], [8.93, 0.08, 3.5], [13.3, 0.03, 2]] },
    kane: { dur: 20, ref: 48, sr: 11025, click: 0.06, att: 0.006, parts: [[0.5, 0.9, 26], [0.503, 0.6, 24], [1, 1, 16], [1.006, 0.6, 15], [1.19, 0.4, 9], [1.5, 0.35, 7], [2, 0.3, 5], [2.62, 0.2, 3.5], [3.3, 0.1, 2]] },
    // Suikinkutsu: a drop rings the buried clay jar
    suikin: { dur: 5, ref: 84, click: 0.05, att: 0.002, parts: [[1, 1, 4.5], [1.006, 0.4, 4], [2.27, 0.35, 2.2], [3.9, 0.15, 1.2], [5.6, 0.06, 0.6]] },
    celesta: { dur: 3, ref: 72, click: 0.08, parts: [[1, 1, 2.6], [2, 0.14, 1.2], [3.01, 0.05, 0.7], [5.42, 0.04, 0.25]] },
    vibes: { dur: 3.5, ref: 72, click: 0.04, parts: [[1, 1, 4], [4, 0.22, 1.3], [10.1, 0.05, 0.35]] },
    glass: { dur: 4, ref: 79, click: 0.02, att: 0.012, parts: [[1, 1, 4.5], [2.32, 0.32, 2.6], [4.25, 0.12, 1.5], [6.63, 0.05, 0.8]] },
    marimba: { dur: 1.8, ref: 60, click: 0.12, parts: [[1, 1, 1], [3.93, 0.24, 0.28], [9.2, 0.06, 0.08]] },
    ep: { dur: 3, ref: 60, click: 0.03, parts: [[1, 1, 3.2], [2, 0.32, 1.6], [3, 0.1, 0.9], [4, 0.05, 0.5], [7.1, 0.1, 0.12]] },
    wood: { dur: 0.35, ref: 84, click: 0.25, parts: [[1, 1, 0.09], [2.42, 0.5, 0.05], [4.07, 0.22, 0.03], [6.7, 0.08, 0.02]] },
    // Taiko: skin mode plus body resonance, short
    taiko: { dur: 1.2, ref: 45, sr: 11025, click: 0.5, att: 0.002, parts: [[1, 1, 0.55], [1.59, 0.45, 0.25], [2.14, 0.25, 0.15], [2.9, 0.12, 0.08]] }
};
const zoneOf = m => 4 * Math.round(m / 4);

class SampleBank {
    constructor() { this.cache = {}; this.queue = []; this.timer = null; }
    get(kind, z) {
        const k = kind + z;
        if (!this.cache[k]) {
            const P = MODAL[kind], sr = (P && P.sr) || 22050;
            const d = kind === 'piano' ? SampleBank.piano(sr, z) : P ? SampleBank.modal(sr, z, P) : SampleBank.string(sr, z, kind);
            const b = ctx.createBuffer(1, d.length, sr);
            b.getChannelData(0).set(d); this.cache[k] = b;
        }
        return this.cache[k];
    }
    // Pre-render the zones a genre needs, one per timer slice, so the UI never stalls
    warm(kind, lo, hi) {
        if (OFF) return;
        for (let m = zoneOf(lo); m <= hi; m += 4) if (!this.cache[kind + m]) this.queue.push([kind, m]);
        if (!this.timer && this.queue.length) this.timer = setTimeout(() => this.step(), 40);
    }
    step() {
        this.timer = null;
        const it = this.queue.shift();
        if (it && ctx && !disposed) { try { this.get(it[0], it[1]); } catch (e) { } }
        if (this.queue.length && !disposed) this.timer = setTimeout(() => this.step(), 30);
    }
    stop() { clearTimeout(this.timer); this.timer = null; this.queue = []; }

    static finish(d, sr, att, rel) {
        const a = Math.floor(sr * att), r = Math.floor(sr * rel), n = d.length;
        let pk = 0, i;
        for (i = 0; i < a; i++) d[i] *= i / a;
        for (i = 0; i < r; i++) d[n - 1 - i] *= i / r;
        for (i = 0; i < n; i++) if (Math.abs(d[i]) > pk) pk = Math.abs(d[i]);
        if (pk > 0) for (i = 0; i < n; i++) d[i] *= 0.9 / pk;
        return d;
    }
    // Piano: three detuned strings per note (the beating gives the piano shimmer), stretched partials, two-stage
    // decay that loses the upper partials first, a felt-hammer thump and the knock of the soundboard
    static piano(sr, m) {
        var f = mtof(m), n = Math.floor(sr * clamp(9 - (m - 36) * 0.1, 2.5, 9)), d = new Float32Array(n);
        var Bi = 0.00005 * Math.pow(2, (m - 48) / 14), tau = clamp(2.4 - (m - 36) * 0.035, 0.35, 2.4), np = Math.min(32, Math.floor(9500 / f));
        for (var k = 1; k <= np; k++) {
            var fk = f * k * Math.sqrt(1 + Bi * k * k);
            if (fk > sr * 0.45) break;
            var amp = (0.25 + Math.abs(Math.sin(Math.PI * k / 8.2))) / Math.pow(k, 0.95), t1 = tau / (1 + 0.22 * Math.pow(k - 1, 1.15)), d1 = Math.exp(-1 / (sr * t1)), d2 = Math.exp(-1 / (sr * t1 * 5)), ns = k <= 12 ? 3 : 1;
            for (var s = 0; s < ns; s++) {
                var w = 2 * Math.PI * fk * (1 + (ns > 1 ? [-0.0006, 0.00005, 0.0007][s] : 0)) / sr, cw = Math.cos(w), sw = Math.sin(w), ph = Math.random() * 6.283;
                var x = Math.cos(ph), y = Math.sin(ph), e1 = 0.7 * amp / ns, e2 = 0.3 * amp / ns;
                for (var i = 0; i < n; i++) {
                    var nx = x * cw - y * sw; y = x * sw + y * cw; x = nx;
                    d[i] += (e1 + e2) * y; e1 *= d1; e2 *= d2;
                    if (e1 + e2 < 3e-5) break;
                }
            }
        }
        var hn = Math.floor(sr * 0.2), lpn = 0;
        for (var h = 0; h < hn; h++) {
            var tt = h / sr;
            lpn += 0.15 * ((Math.random() * 2 - 1) - lpn);
            d[h] += lpn * 0.3 * Math.exp(-tt / 0.008) + 0.05 * Math.sin(597 * tt) * Math.exp(-tt / 0.05) + 0.035 * Math.sin(1319 * tt) * Math.exp(-tt / 0.035) + 0.02 * Math.sin(2639 * tt) * Math.exp(-tt / 0.02);
        }
        return SampleBank.finish(d, sr, 0.002, 0.4);
    }
    static modal(sr, m, P) {
        var f = mtof(m), n = Math.floor(sr * P.dur), d = new Float32Array(n), ks2 = Math.pow(2, -(m - P.ref) / 24);
        P.parts.forEach(function (p) {
            var fk = f * p[0];
            if (fk > sr * 0.45) return;
            var w = 2 * Math.PI * fk / sr, cw = Math.cos(w), sw = Math.sin(w), x = 1, y = 0, e = p[1], dec = Math.exp(-6.9 / (sr * p[2] * ks2));
            for (var i = 0; i < n; i++) {
                var nx = x * cw - y * sw; y = x * sw + y * cw; x = nx;
                d[i] += e * y; e *= dec;
                if (e < 1e-5) break;
            }
        });
        // Mallet/tine contact: short low-passed noise burst
        var cn = Math.floor(sr * 0.006), lp = 0, cf = clamp(f * 4 / sr, 0.05, 0.6);
        for (var j = 0; j < cn; j++) { lp += cf * ((Math.random() * 2 - 1) - lp); d[j] += lp * P.click * (1 - j / cn); }
        return SampleBank.finish(d, sr, P.att || 0.0015, 0.08);
    }
    // Plucked strings (Karplus-Strong with fractional-delay tuning): koto, shamisen, biwa, sanshin, upright bass
    static string(sr, m, kind) {
        var f = mtof(m), K2 = kind === 'sanshin' ? { dur: 1.6, t60: 1.1, S: 0.32, ex: 0.85, pk: 0.13 }
            : kind === 'shamisen' ? { dur: 1.6, t60: 0.9, S: 0.2, ex: 0.95, pk: 0.07, buzz: 2.5 }
                : kind === 'biwa' ? { dur: 2.6, t60: 1.8, S: 0.25, ex: 0.8, pk: 0.09, buzz: 3.5 }
                    : kind === 'bass' ? { dur: 2.2, t60: 2.4, S: 0.5, ex: 0.22, pk: 0.25 }
                        : { dur: 3.2, t60: clamp(3.8 - (m - 55) * 0.05, 1.2, 3.8), S: 0.45, ex: 0.68, pk: 0.13 };
        var n = Math.floor(sr * K2.dur), d = new Float32Array(n), Dl = sr / f - K2.S, N = Math.max(2, Math.floor(Dl - 0.1)), fr = Dl - N, C = (1 - fr) / (1 + fr);
        var ln = new Float32Array(N), ex = new Float32Array(N), lp = 0, i;
        for (i = 0; i < N; i++) { lp += K2.ex * ((Math.random() * 2 - 1) - lp); ex[i] = lp; }
        var pN = Math.max(1, Math.round(N * K2.pk));
        for (i = 0; i < N; i++) ln[i] = ex[i] - ex[(i - pN + N) % N];
        var rho = Math.pow(0.001, 1 / (f * K2.t60)), idx = 0, px = 0, ax = 0, ay = 0;
        for (i = 0; i < n; i++) {
            var x = ln[idx], l = (1 - K2.S) * x + K2.S * px; px = x;
            var a = C * l + ax - C * ay; ax = l; ay = a;
            ln[idx] = a * rho; d[i] = x;
            if (++idx === N) idx = 0;
        }
        // Shamisen/biwa: sawari buzz (odd-harmonic waveshaping) and the hard bachi strike
        if (K2.buzz) {
            var pk2 = 0;
            for (i = 0; i < n; i++) if (Math.abs(d[i]) > pk2) pk2 = Math.abs(d[i]);
            for (i = 0; i < n; i++) { var y2 = d[i] / (pk2 || 1); d[i] = y2 + K2.buzz * y2 * y2 * y2 * 0.4; }
            var bn = Math.floor(sr * 0.005);
            for (i = 0; i < bn; i++) d[i] += (Math.random() * 2 - 1) * 0.5 * (1 - i / bn);
        }
        return SampleBank.finish(d, sr, 0.001, 0.15);
    }
}
const bank = new SampleBank();
