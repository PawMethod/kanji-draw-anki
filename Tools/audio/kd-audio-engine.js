    /* ═══════════════════════════════════════════════════════════════════
       KanjiDraw Audio — prozedurale Klangwelt (Web Audio API, keine Dateien)
       · Hintergrundmusik je Japan-Theme × Tag/Nacht × Genre (generativ;
         Übergänge mit harmonischem Pivot-Akkord + Equal-Power-Crossfade)
       · Strichgeräusche je Strichstil (Bleistift, Gelstift, Tusche, Neon),
         gesteuert von Geschwindigkeit und Stiftdruck
       · Dezente UI-Effekte (Aufdecken, Tasten, Einstellungen, Fortschritt)
       · Flow (nach dem Vorbild von Tetris Effect): Treffer-Töne landen im Takt
         und in der Tonart, der Stift klingt in den Akkordtönen mit, das
         Arrangement wächst mit dem Lernfluss und wird in Denkpausen ruhig
       Singleton window.__kdAudio überlebt Kartenwechsel (Anki Desktop und
       AnkiMobile ersetzen nur #qa); bei Seiten-Reloads (AnkiDroid) setzt die
       Harmonie über sessionStorage fort.
       [SHARED c1-front/c2-front — beide Kopien identisch halten]
       ═══════════════════════════════════════════════════════════════════ */
    (function () {
        'use strict';
        var VERSION = '2.0.1';
        var W = window, D = document;
        var prior = W.__kdAudio;
        if (prior && prior.version === VERSION) return;
        if (prior && typeof prior.dispose === 'function') { try { prior.dispose(); } catch (e) { } }
        var AC = W.AudioContext || W.webkitAudioContext;
        if (!AC) { W.__kdAudio = null; return; }

        // ── Tables ──────────────────────────────────────────────────────
        var LEVEL = { off: 0, low: 0.4, mid: 0.7, high: 1 };
        var MLEVEL = { low: 0.45, mid: 0.7, high: 1 };
        var CH = {
            add9: [0, 4, 7, 14], maj7: [0, 4, 7, 11], maj9: [0, 4, 11, 14], six9: [0, 4, 9, 14], maj: [0, 4, 7, 12],
            m7: [0, 3, 7, 10], m9: [0, 3, 10, 14], sus2: [0, 2, 7, 12], sus4: [0, 5, 7, 10]
        };
        // key = tonic pitch class, scale = Japanese pentatonic mode.
        // Progression entries: [scale degree, stack] builds the chord from the scale itself (STACKS);
        // [semitones, chord type] is Western harmony (Okinawan folk pop).
        var THEMES = {
            neutral: { key: 4, scale: [0, 1, 5, 7, 8], bright: 1, day: [[0, 0], [4, 0], [2, 0], [3, 0]], night: [[4, 0], [2, 0], [0, 1], [3, 0]] }, // Miyako-bushi (In)
            warm: { key: 5, scale: [0, 2, 5, 7, 9], bright: 0.95, day: [[0, 0], [2, 0], [1, 0], [3, 0]], night: [[4, 0], [1, 0], [2, 0], [0, 1]] }, // Yo
            cool: { key: 3, scale: [0, 2, 3, 7, 9], bright: 0.9, day: [[0, 0], [3, 0], [2, 0], [1, 0]], night: [[0, 1], [3, 0], [1, 0], [0, 0]] }, // Kumoi
            sepia: { key: 9, scale: [0, 1, 5, 6, 10], bright: 0.85, day: [[0, 1], [4, 0], [2, 0], [1, 0]], night: [[4, 0], [1, 0], [2, 0], [0, 1]] }, // Iwato
            rose: { key: 7, scale: [0, 1, 5, 7, 8], bright: 1.05, day: [[0, 0], [4, 0], [2, 0], [3, 1]], night: [[2, 0], [4, 0], [0, 1], [3, 1]] }, // In (Sakura)
            sage: { key: 2, scale: [0, 2, 5, 7, 9], bright: 0.95, day: [[0, 0], [1, 0], [4, 0], [2, 0]], night: [[3, 0], [1, 0], [0, 0], [2, 0]] }, // Yo (temple)
            hokkaido: { key: 4, scale: [0, 3, 5, 7, 10], bright: 1.15, day: [[0, 0], [3, 0], [4, 0], [1, 0]], night: [[4, 0], [1, 0], [0, 0], [3, 0]] }, // Min'yō (northern folk)
            tokyo: { key: 5, scale: [0, 2, 3, 7, 8], bright: 0.9, day: [[4, 0], [3, 0], [0, 0], [2, 0]], night: [[0, 0], [4, 0], [2, 0], [3, 0]] }, // Hirajoshi
            okinawa: { key: 0, scale: [0, 4, 5, 7, 11], bright: 1.05, day: [[0, 'add9'], [5, 'maj'], [4, 'm7'], [7, 'sus4']], night: [[9, 'm7'], [5, 'maj'], [0, 'add9'], [7, 'sus4']] } // Ryukyu
        };
        // Second progression per theme for the B sections: [day, night]
        var ALT = {
            neutral: [[[2, 0], [3, 0], [1, 0], [4, 0]], [[1, 0], [3, 0], [4, 0], [0, 1]]],
            warm: [[[2, 0], [0, 1], [4, 0], [3, 0]], [[2, 0], [3, 0], [4, 0], [1, 0]]],
            cool: [[[3, 0], [1, 0], [0, 1], [0, 0]], [[1, 0], [3, 0], [0, 1], [0, 0]]],
            sepia: [[[1, 0], [2, 0], [4, 0], [0, 1]], [[2, 0], [4, 0], [1, 0], [0, 1]]],
            rose: [[[4, 0], [2, 0], [3, 1], [0, 0]], [[0, 1], [2, 0], [4, 0], [3, 1]]],
            sage: [[[1, 0], [4, 0], [2, 0], [0, 0]], [[4, 0], [1, 0], [3, 0], [0, 0]]],
            hokkaido: [[[3, 0], [4, 0], [1, 0], [0, 0]], [[1, 0], [4, 0], [3, 0], [0, 0]]],
            tokyo: [[[2, 0], [4, 0], [3, 0], [0, 0]], [[4, 0], [2, 0], [0, 0], [3, 0]]],
            okinawa: [[[5, 'maj'], [4, 'm7'], [2, 'm7'], [7, 'sus4']], [[4, 'm7'], [9, 'm7'], [5, 'add9'], [0, 'maj']]]
        };
        // Scale-degree offsets of a chord built from the scale: full colour, open (with octave), plain
        var STACKS = [[0, 2, 3, 4], [0, 2, 4, 5], [0, 2, 3]];
        // Soundscape per theme: continuous layers (0..1) + events per minute
        var NAT = {
            neutral: { d: { wind: 0.5, ev: { chirp: 4, crane: 0.6, kakko: 0.8, karasu: 0.4 } }, n: { wind: 0.55, ev: { cricket: 9, owl: 0.5, higurashi: 0.8 } } },
            warm: { d: { water: 0.3, wind: 0.2, ev: { chirp: 3, furin: 2, bell: 0.4, minmin: 1.2, suikin: 2 } }, n: { water: 0.25, ev: { frog: 5, cricket: 4, bell: 0.3, higurashi: 1.5 } } },
            cool: { d: { water: 0.3, ev: { drip: 4, chirp: 1.5, suikin: 3, kakko: 0.5 } }, n: { water: 0.28, ev: { drip: 4, cricket: 4, kajika: 2.5 } } },
            sepia: { d: { wind: 0.68, leaves: 0.5, ev: { chirp: 1.5, bell: 0.3, karasu: 0.8, higurashi: 1 } }, n: { wind: 0.5, leaves: 0.35, ev: { cricket: 14, higurashi: 1, bell: 0.3 } } },
            rose: { d: { wind: 0.5, ev: { uguisu: 1.5, chirp: 4, hototogisu: 0.6 } }, n: { wind: 0.55, ev: { frog: 5, cricket: 2, hototogisu: 0.5 } } },
            sage: { d: { wind: 0.55, leaves: 0.5, ev: { knock: 2, shishi: 0.8, chirp: 2, kakko: 0.8, suikin: 1.5 } }, n: { wind: 0.45, leaves: 0.35, ev: { shishi: 0.8, cricket: 6, owl: 0.3, bell: 0.3 } } },
            hokkaido: { d: { wind: 0.6, ev: { tinkle: 3, chirp: 0.6, karasu: 0.5, crane: 0.5 } }, n: { wind: 0.6, ev: { owl: 0.7, tinkle: 1 } } },
            tokyo: { d: { city: 0.28, ev: { train: 0.5, chirp: 1, karasu: 1.2, fumikiri: 0.4, minmin: 0.6 } }, n: { city: 0.2, rain: 0.5, ev: { train: 0.4, fumikiri: 0.3 } } },
            okinawa: { d: { waves: 0.5, wind: 0.2, ev: { furin: 1.5, chirp: 0.8, minmin: 1 } }, n: { waves: 0.45, ev: { cricket: 6, frog: 2 } } }
        };
        // Continuous-layer calibration (pre-scene gain)
        var K = { wind: 0.9, leaves: 0.06, water: 0.5, gurgle: 0.5, waves: 0.75, foam: 0.05, rain: 0.15, city: 0.8 };
        var GENRES = {
            ambient: { bpm: 56, cpb: 2, tone: 9000, nat: 0.55, trim: 1, bar: ambientBar },
            zen: { bpm: 60, cpb: 2, tone: 11000, nat: 0.6, trim: 1, bar: zenBar },
            piano: { bpm: 66, cpb: 2, tone: 9000, nat: 0.35, trim: 1, bar: pianoBar },
            lofi: { bpm: 74, cpb: 1, tone: 3400, nat: 0.45, trim: 1, bar: lofiBar, start: lofiStart },
            nature: { bpm: 60, cpb: 2, tone: 16000, nat: 1.5, trim: 1, bar: function () { } }
        };
        // Stroke voices: base hum, speed gain, filter range, release
        var SK = {
            standard: { base: 0, k: 0.5, f0: 1300, f1: 2500, rel: 0.035 },
            gel: { base: 0, k: 0.5, f0: 1300, f1: 2400, rel: 0.04 },
            ink: { base: 0, k: 0.48, f0: 650, f1: 2100, rel: 0.06 },
            neon: { base: 0.016, k: 0.05, f0: 380, f1: 2600, rel: 0.09 }
        };
        // Acoustic space per theme: reverb send, reverb damping (Hz), echo send
        var SPACE = {
            neutral: { verb: 1, damp: 6500, echo: 1 },
            warm: { verb: 0.85, damp: 4800, echo: 0.8 },
            cool: { verb: 1.25, damp: 7500, echo: 1.2 },
            sepia: { verb: 1.35, damp: 3800, echo: 0.9 },
            rose: { verb: 0.95, damp: 8000, echo: 1 },
            sage: { verb: 1.15, damp: 5200, echo: 0.9 },
            hokkaido: { verb: 0.75, damp: 3200, echo: 0.7 },
            tokyo: { verb: 0.9, damp: 6000, echo: 1.4 },
            okinawa: { verb: 0.65, damp: 9000, echo: 0.8 }
        };
        // Flow (interactive music): off = static arrangement, low = gentle, high = full range
        var IMM = { off: 0, low: 1, high: 2 };
        // Melodic contour over the strokes of a kanji (indices into the chord tones)
        var CONTOUR = [0, 1, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 3, 4, 2, 3];
        // Register of the answering voice per genre
        var LEADR = { ambient: [72, 93], zen: [62, 86], piano: [67, 88], lofi: [62, 84], nature: [79, 98] };
        // Lead instrument and partner per landscape; each scene picks one pairing (the first is the most likely)
        var VOPT = {
            neutral: [['koto', 'shaku'], ['koto', 'fue'], ['shaku', 'koto'], ['koto', 'shamisen']],
            warm: [['fue', 'shamisen'], ['shamisen', 'fue'], ['koto', 'fue']],
            cool: [['koto', 'shaku'], ['shaku', 'koto'], ['koto', 'fue']],
            sepia: [['biwa', 'shaku'], ['shaku', 'biwa'], ['koto', 'shaku']],
            rose: [['koto', 'fue'], ['fue', 'koto'], ['koto', 'shaku']],
            sage: [['shaku', 'koto'], ['koto', 'shaku'], ['shaku', 'biwa']],
            hokkaido: [['shaku', 'shamisen'], ['shamisen', 'shaku'], ['fue', 'shamisen']],
            tokyo: [['koto', 'shamisen'], ['shamisen', 'koto'], ['koto', 'shaku']],
            okinawa: [['sanshin', 'fue'], ['sanshin', 'koto'], ['fue', 'sanshin']]
        };
        var VREG = { koto: [62, 86], shamisen: [60, 81], biwa: [50, 72], sanshin: [60, 81], shaku: [62, 81], fue: [74, 93], piano: [64, 86] };
        var VK = { koto: 1, shamisen: 0.85, biwa: 0.9, sanshin: 1, shaku: 0.8, fue: 0.6, piano: 1 };
        var STR = { koto: 1, shamisen: 1, biwa: 1, sanshin: 1 };
        // Pen resonance: chord-tone register and makeup gain per stroke style
        var RES = { standard: { lo: 76, hi: 91, k: 1.4 }, gel: { lo: 79, hi: 93, k: 1.6 }, ink: { lo: 69, hi: 84, k: 1.2 }, neon: { lo: 74, hi: 89, k: 1 } };

        // ── State ───────────────────────────────────────────────────────
        var cfg = { level: 'off', music: 'off', musicLevel: 'mid', stroke: 'on', fx: 'on', immersion: 'low' };
        var cur = { theme: 'neutral', dark: false };
        var ctx = null, G = null, NB = null, PW = null;
        var scenes = [], timer = null, sceneT = null, idleIv = null, disposed = false, pendT = null, pendKey = null, lastSwitch = 0, DWELL = 1500, MINGAP = 7000;
        var OFF = false, TO = null, lastAct = 0, SV = null, sTok = 0, lastStyle = 'standard', lastX = 54.5;
        var flow = 0, flowT = 0, lastIn = -1e9, bloomUntil = 0, flowFix = null, NOEV = false;
        var SS = 'kdAudioState';

        function now() { return TO !== null ? TO : (ctx ? ctx.currentTime : 0); }
        function clockMs() { return TO !== null ? TO * 1000 : (W.performance && performance.now ? performance.now() : Date.now()); }
        function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
        function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
        function rnd(a, b) { return a + Math.random() * (b - a); }
        function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
        function chance(p) { return Math.random() < p; }
        function poisson(l) { var L = Math.exp(-l), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L && k < 40); return k - 1; }
        function pc(m) { return ((m % 12) + 12) % 12; }
        function touch() { lastAct = Date.now(); }

        // ── Context & master graph ──────────────────────────────────────
        function ensureCtx() {
            if (ctx) return ctx;
            if (disposed || cfg.level === 'off') return null;
            try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { ctx = null; return null; } }
            // iOS 17+: mix with other audio and respect the silent switch
            try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { }
            setup(ctx);
            warm('wood', 80, 96); warm('celesta', 76, 96); warm('glass', 72, 92);
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
            var amps = [0, 1, 0.42, 0.24, 0.14, 0.09, 0.06, 0.035, 0.02, 0.012], re = new Float32Array(amps.length), im = new Float32Array(amps.length);
            for (var i = 1; i < amps.length; i++) im[i] = amps[i];
            var sh = [0, 1, 0.32, 0.16, 0.07, 0.05, 0.025, 0.015], sre = new Float32Array(sh.length), sim = new Float32Array(sh.length);
            for (var j = 1; j < sh.length; j++) sim[j] = sh[j];
            // Free reed (shō): strong, slowly falling harmonic series
            var rd = [0, 1, 0.7, 0.55, 0.42, 0.3, 0.24, 0.17, 0.12, 0.09, 0.06], rre = new Float32Array(rd.length), rim = new Float32Array(rd.length);
            for (var q = 1; q < rd.length; q++) rim[q] = rd[q];
            return { piano: c.createPeriodicWave(re, im), shaku: c.createPeriodicWave(sre, sim), reed: c.createPeriodicWave(rre, rim) };
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
            ls.type = 'lowshelf'; ls.frequency.value = 170; ls.gain.value = 1.5; hs.type = 'highshelf'; hs.frequency.value = 7000; hs.gain.value = -2.5;
            g.music.connect(ls); ls.connect(hs); hs.connect(g.duck); g.duck.connect(g.master);
            // Stereo chorus: slowly moving delay lines widen and soften the synthesized voices
            var ci = gn(0.35), dlL = c.createDelay(0.05), dlR = c.createDelay(0.05), lL = c.createOscillator(), lR = c.createOscillator(), mL = gn(0.0022), mR = gn(0.0022), cm = c.createChannelMerger(2);
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

        // ── Node helpers ────────────────────────────────────────────────
        function gainN(v) { var g = ctx.createGain(); g.gain.value = v; return g; }
        function filt(type, f, q) { var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; }
        function oscN(type, f) { var o = ctx.createOscillator(); if (PW && PW[type]) o.setPeriodicWave(PW[type]); else o.type = type; o.frequency.value = f; return o; }
        function noiseN(kind) { var s = ctx.createBufferSource(); s.buffer = NB[kind]; s.loop = true; return s; }
        function startNoise(s, t) { s.start(t, Math.random() * (s.buffer.duration - 0.5)); }
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

        // ── Instruments ─────────────────────────────────────────────────
        // Rendered instrument notes: computed once in code per 4-semitone zone, then cached
        var SMP = {}, WQ = [], wT = null;
        function zoneOf(m) { return 4 * Math.round(m / 4); }
        function sampleBuf(kind, z) {
            var k = kind + z;
            if (!SMP[k]) {
                var sr = (MODAL[kind] && MODAL[kind].sr) || 22050, d = kind === 'piano' ? renderPiano(sr, z) : MODAL[kind] ? renderModal(sr, z, MODAL[kind]) : renderString(sr, z, kind), b = ctx.createBuffer(1, d.length, sr);
                b.getChannelData(0).set(d); SMP[k] = b;
            }
            return SMP[k];
        }
        // Pre-render the zones a genre needs, one per timer slice, so the UI never stalls
        function warm(kind, lo, hi) {
            if (OFF) return;
            for (var m = zoneOf(lo); m <= hi; m += 4) if (!SMP[kind + m]) WQ.push([kind, m]);
            if (!wT && WQ.length) wT = setTimeout(warmStep, 40);
        }
        function warmStep() {
            wT = null; var it = WQ.shift();
            if (it && ctx && !disposed) { try { sampleBuf(it[0], it[1]); } catch (e) { } }
            if (WQ.length) wT = setTimeout(warmStep, 30);
        }
        function finish(d, sr, att, rel) {
            var a = Math.floor(sr * att), r = Math.floor(sr * rel), n = d.length, pk = 0, i;
            for (i = 0; i < a; i++) d[i] *= i / a;
            for (i = 0; i < r; i++) d[n - 1 - i] *= i / r;
            for (i = 0; i < n; i++) if (Math.abs(d[i]) > pk) pk = Math.abs(d[i]);
            if (pk > 0) for (i = 0; i < n; i++) d[i] *= 0.9 / pk;
            return d;
        }
        // Piano: three detuned strings per note (the beating gives the piano shimmer), stretched partials, two-stage
        // decay that loses the upper partials first, a felt-hammer thump and the knock of the soundboard
        function renderPiano(sr, m) {
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
            return finish(d, sr, 0.002, 0.4);
        }
        // Tuned percussion as modal partials [frequency ratio, amplitude, T60 s]; decay shortens with pitch above ref
        var MODAL = {
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
            wood: { dur: 0.35, ref: 84, click: 0.25, parts: [[1, 1, 0.09], [2.42, 0.5, 0.05], [4.07, 0.22, 0.03], [6.7, 0.08, 0.02]] }
        };
        function renderModal(sr, m, P) {
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
            return finish(d, sr, P.att || 0.0015, 0.08);
        }
        function ftom(f) { return 69 + 12 * Math.log(f / 440) / Math.LN2; }
        // Plays a rendered tuned-percussion note; optional damping (dur), tremolo (trem Hz) or auto-pan (autopan Hz)
        function tone(kind, dst, t, m, vel, o) {
            o = o || {}; var z = zoneOf(m), b = sampleBuf(kind, z), r = Math.pow(2, (m - z) / 12), len = b.duration / r;
            var s = ctx.createBufferSource(), lp = filt('lowpass', Math.min(16000, mtof(m) * (o.bright || 12)), 0.5), g = gainN(vel), out = g;
            s.buffer = b; s.playbackRate.value = r;
            if (o.dur && o.dur < len) { g.gain.setValueAtTime(vel, t + o.dur); g.gain.setTargetAtTime(0, t + o.dur, 0.1); len = o.dur + 0.6; }
            s.connect(lp); lp.connect(g);
            if (o.trem) { var tl = oscN('sine', o.trem), tg = gainN(0.3), tm = gainN(0.7); tl.connect(tg); tg.connect(tm.gain); g.connect(tm); out = tm; tl.start(t); tl.stop(t + len); }
            if (o.autopan && ctx.createStereoPanner) { var ap = ctx.createStereoPanner(), al = oscN('sine', o.autopan), ag = gainN(0.45); al.connect(ag); ag.connect(ap.pan); out.connect(ap); out = ap; al.start(t); al.stop(t + len); }
            send(out, dst, o.wet || 0, o.echo || 0, o.autopan ? 0 : o.pan || 0);
            s.start(t); s.stop(t + len);
        }
        // Plucked strings (Karplus-Strong with fractional-delay tuning): koto, sanshin, upright bass
        function renderString(sr, m, kind) {
            var f = mtof(m), K2 = kind === 'sanshin' ? { dur: 1.6, t60: 1.1, S: 0.32, ex: 0.85, pk: 0.13 }
                : kind === 'shamisen' ? { dur: 1.6, t60: 0.9, S: 0.2, ex: 0.95, pk: 0.07, buzz: 2.5 }
                    : kind === 'biwa' ? { dur: 2.6, t60: 1.8, S: 0.25, ex: 0.8, pk: 0.09, buzz: 3.5 }
                        : kind === 'bass' ? { dur: 2.2, t60: 2.4, S: 0.5, ex: 0.22, pk: 0.25 }
                            : { dur: 2.8, t60: clamp(3.4 - (m - 55) * 0.05, 1.2, 3.4), S: 0.45, ex: 0.68, pk: 0.13 };
            var n = Math.floor(sr * K2.dur), d = new Float32Array(n), D = sr / f - K2.S, N = Math.max(2, Math.floor(D - 0.1)), fr = D - N, C = (1 - fr) / (1 + fr);
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
            // Shamisen: sawari buzz (odd-harmonic waveshaping) and the hard bachi strike
            if (K2.buzz) {
                var pk2 = 0;
                for (i = 0; i < n; i++) if (Math.abs(d[i]) > pk2) pk2 = Math.abs(d[i]);
                for (i = 0; i < n; i++) { var y2 = d[i] / (pk2 || 1); d[i] = y2 + K2.buzz * y2 * y2 * y2 * 0.4; }
                var bn = Math.floor(sr * 0.005);
                for (i = 0; i < bn; i++) d[i] += (Math.random() * 2 - 1) * 0.5 * (1 - i / bn);
            }
            return finish(d, sr, 0.001, 0.15);
        }
        // Ensemble pad: three detuned voices per note spread in stereo, slowly breathing filter
        function pad(dst, t, notes, dur, o) {
            var att = o.att, hold = Math.max(att, dur), end = t + hold + o.rel * 1.3 + 0.1, gv = o.gain * 0.8;
            var f = filt('lowpass', o.cut * 0.45, 0.7), a = gainN(0), lfo = oscN('sine', rnd(0.06, 0.14)), lg = gainN(o.cut * 0.12);
            f.frequency.setValueAtTime(o.cut * 0.45, t);
            f.frequency.linearRampToValueAtTime(o.cut, t + att * 1.2);
            f.frequency.setTargetAtTime(o.cut * 0.6, t + att * 1.2, Math.max(0.5, dur * 0.5));
            lfo.connect(lg); lg.connect(f.frequency); lfo.start(t); lfo.stop(end);
            a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(gv, t + att);
            a.gain.setValueAtTime(gv, t + hold); a.gain.setTargetAtTime(0, t + hold, o.rel / 3.5);
            f.connect(a); send(a, dst, o.wet, o.echo || 0, 0);
            var types = [o.type || 'sawtooth', o.type2 || 'triangle', o.type || 'sawtooth'], dets = [1, -1, 0.35];
            for (var i = 0; i < notes.length; i++) {
                var fr = mtof(notes[i]), base = notes.length > 1 ? (i / (notes.length - 1) - 0.5) * (o.spread || 0.7) : 0;
                for (var k = 0; k < 3; k++) {
                    var x = oscN(types[k], fr), tgt = f;
                    x.detune.value = dets[k] * (o.det || 6) + rnd(-3, 3);
                    if (ctx.createStereoPanner) { tgt = ctx.createStereoPanner(); tgt.pan.value = clamp(base + (k - 1) * 0.25, -0.9, 0.9); tgt.connect(f); }
                    x.connect(tgt); x.start(t); x.stop(end);
                }
            }
        }
        // Shō (gagaku mouth organ): free-reed cluster with slow swell and gentle beating
        function sho(dst, t, notes, dur, vel, o) {
            o = o || {}; var att = 1.6, hold = Math.max(att, dur), end = t + hold + 2.4;
            var lp = filt('lowpass', 3200, 0.6), g = gainN(0), v = vel / Math.max(1, notes.length * 0.6);
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + att); g.gain.setValueAtTime(v, t + hold); g.gain.setTargetAtTime(0, t + hold, 0.7);
            lp.connect(g); send(g, dst, o.wet || 0.6, 0, 0);
            notes.forEach(function (m, i) {
                var x = oscN('reed', mtof(m)), tgt = lp;
                x.detune.value = rnd(-5, 5);
                if (ctx.createStereoPanner) { tgt = ctx.createStereoPanner(); tgt.pan.value = (i / Math.max(1, notes.length - 1) - 0.5) * 0.6; tgt.connect(lp); }
                x.connect(tgt); x.start(t); x.stop(end);
            });
        }
        // Aitake-like voicing: chord tones plus a neighbouring scale tone, packed into the shō register
        function shoVoice(s, ch) { return voiceChord(ch.concat([s.k + s.scale[1]]), null, 69, 88).slice(0, 6); }
        function sub(dst, t, m, dur, vel) {
            var hold = Math.max(1.6, dur), end = t + hold + 2.5, a = gainN(0), x = oscN('sine', mtof(m)), y = oscN('triangle', mtof(m) * 2), yg = gainN(0.18);
            a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(vel, t + 1.6); a.gain.setValueAtTime(vel, t + hold); a.gain.setTargetAtTime(0, t + hold, 0.7);
            x.connect(a); y.connect(yg); yg.connect(a); send(a, dst, 0.15, 0, 0);
            x.start(t); y.start(t); x.stop(end); y.stop(end);
        }
        function bell(dst, t, m, vel, o) {
            o = o || {}; var f = mtof(m), dec = o.decay || 1.5, end = t + dec * 5 + 0.05;
            var c = oscN('sine', f), md = oscN('sine', f * (o.ratio || 3.5)), mg = gainN(0), a = gainN(0);
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
            var kind = o.kind || (o.wave === 'square' ? 'sanshin' : 'koto'), z = zoneOf(m), b = sampleBuf(kind, z), r = Math.pow(2, (m - z) / 12), f = mtof(m), dec = o.decay || 1.4;
            var s = ctx.createBufferSource(), lp = filt('lowpass', Math.min(15000, f * (o.bright || 7) * 1.6), 0.6), g = gainN(0);
            var pr = s.playbackRate;
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
        }
        function synthPluck(dst, t, m, vel, o) {
            o = o || {}; var f = mtof(m), dec = o.decay || 1.4, end = t + dec * 4 + 0.05, br = Math.min(16000, f * (o.bright || 7));
            var a = oscN(o.wave || 'sawtooth', f), b = oscN('triangle', f), lp = filt('lowpass', br, o.q || 1.4), g = gainN(0);
            b.detune.value = 5;
            lp.frequency.setValueAtTime(br, t); lp.frequency.setTargetAtTime(f * 1.3, t + 0.005, dec * 0.2);
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.003); g.gain.setTargetAtTime(0, t + 0.003, dec * 0.4);
            if (o.bend) {
                [a, b].forEach(function (x) { x.frequency.setValueAtTime(f, t + o.bendAt); x.frequency.linearRampToValueAtTime(f * Math.pow(2, o.bend / 12), t + o.bendAt + 0.14); });
            }
            a.connect(lp); b.connect(lp); lp.connect(g); send(g, dst, o.wet || 0, o.echo || 0, o.pan || 0);
            a.start(t); b.start(t); a.stop(end); b.stop(end);
            if (o.pick) noiseHit(dst, t, { f: Math.min(9000, f * 6), q: 1.5, dur: 0.012, vel: vel * 0.35, pan: o.pan || 0 });
        }
        // Shakuhachi: breathy attack (muraiki), slide into pitch (meri→kari), late vibrato
        function flute(dst, t, m, dur, vel, o) {
            o = o || {}; var f = mtof(m), end = t + dur + 1.2, g0 = o.grace ? mtof(o.grace) : f * 0.955;
            var a = oscN('shaku', f), vib = oscN('sine', o.fue ? rnd(5.8, 6.6) : rnd(4.6, 5.4)), vg = gainN(0), g = gainN(0), lp = filt('lowpass', f * (o.fue ? 6 : 5), 0.5);
            // Shakuhachi slides up into the note; a grace note (shinobue ornament) drops into it
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
            o = o || {}; var z = zoneOf(m), b = sampleBuf('piano', z), r = Math.pow(2, (m - z) / 12), f = mtof(m), A = vel * 0.92, rt = t + Math.max(0.15, dur), rel = o.ped ? 0.7 : 0.16, end = Math.min(t + b.duration / r, rt + rel * 5);
            var s = ctx.createBufferSource(), lp = filt('lowpass', Math.min(16000, f * (4 + 26 * vel)), 0.5), g = gainN(0);
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
            var z = zoneOf(m), b = sampleBuf('bass', z), r = Math.pow(2, (m - z) / 12), rt = t + dur, end = Math.min(t + b.duration / r, rt + 0.4);
            var s = ctx.createBufferSource(), lp = filt('lowpass', 1000, 0.7), g = gainN(0), x = oscN('sine', mtof(m)), sg = gainN(0), sum = gainN(1);
            s.buffer = b; s.playbackRate.value = r;
            g.gain.setValueAtTime(vel * 0.9, t); g.gain.setValueAtTime(vel * 0.9, rt); g.gain.setTargetAtTime(0, rt, 0.07);
            sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(vel * 0.55, t + 0.01); sg.gain.setTargetAtTime(vel * 0.3, t + 0.01, 0.3); sg.gain.setTargetAtTime(0, rt, 0.07);
            s.connect(lp); lp.connect(g); g.connect(sum); x.connect(sg); sg.connect(sum); send(sum, dst, 0.05, 0, 0);
            s.start(t); x.start(t); s.stop(end); x.stop(rt + 0.4);
        }
        function kick(dst, t, vel) {
            var o = oscN('sine', 115), g = gainN(0);
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
        // Rubbed singing bowl: the stick circling the rim makes the tone swell and wobble
        function singBowl(dst, t, m, dur, vel, o) {
            o = o || {}; var f = mtof(m), end = t + dur + 8, g = gainN(0), am = gainN(1), lfo = oscN('sine', rnd(1.2, 2.4)), lg = gainN(0.3);
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + dur * 0.45); g.gain.setValueAtTime(vel, t + dur); g.gain.setTargetAtTime(0, t + dur, 2.2);
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
        // Frame drum / small taiko: marks section starts in the zen genre
        function taiko(dst, t, vel) {
            var o = oscN('sine', 95), g = gainN(0);
            o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(58, t + 0.3);
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.006); g.gain.setTargetAtTime(0, t + 0.006, 0.28);
            o.connect(g); send(g, dst, 0.45, 0, 0); o.start(t); o.stop(t + 1.6);
            noiseHit(dst, t, { kind: 'pink', type: 'lowpass', f: 500, q: 0.7, dur: 0.07, vel: vel * 0.5, wet: 0.4 });
        }
        function thock(dst, t, m, vel) {
            var f = mtof(m), x = oscN('sine', f * 1.5), g = gainN(0), lp = filt('lowpass', 900, 0.7);
            x.frequency.setValueAtTime(f * 1.5, t); x.frequency.exponentialRampToValueAtTime(f, t + 0.05);
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.004); g.gain.setTargetAtTime(0, t + 0.004, 0.07);
            x.connect(lp); lp.connect(g); send(g, dst, 0.15, 0, 0); x.start(t); x.stop(t + 0.6);
            noiseHit(dst, t, { kind: 'pink', type: 'lowpass', f: 700, q: 0.7, dur: 0.05, vel: vel * 0.6 });
        }
        // Progress chime in the timbre of the active stroke style
        function chime(style, dst, t, m, vel) {
            if (style === 'ink') pluck(dst, t, m, vel * 1.3, { decay: 1.2, bright: 6, q: 1.3, wet: 0.35, pick: true });
            else if (style === 'gel') tone('glass', dst, t, m, vel, { wet: 0.4 });
            else if (style === 'neon') pluck(dst, t, m, vel * 0.8, { synth: true, wave: 'square', decay: 0.5, bright: 12, q: 5, wet: 0.25, echo: 0.4 });
            else marimba(dst, t, m, vel * 1.2);
        }

        // ── Harmony ─────────────────────────────────────────────────────
        function chordOf(k, scale, c) {
            if (typeof c[1] === 'string') { var b = 60 + pc(k + c[0]); return CH[c[1]].map(function (i) { return b + i; }); }
            var n = scale.length, deg = c[0], r = 60 + pc(k + scale[deg % n]), base = scale[deg % n] + 12 * Math.floor(deg / n);
            return STACKS[c[1] || 0].map(function (o) { var d = deg + o; return r + scale[d % n] + 12 * Math.floor(d / n) - base; });
        }
        function chordNotes(s, idx) { return chordOf(s.k, s.scale, s.prog[idx % s.prog.length]); }
        function chordPcs(s, idx) {
            var r = [];
            chordNotes(s, idx == null ? s.ci : idx).forEach(function (m) { if (r.indexOf(pc(m)) < 0) r.push(pc(m)); });
            return r;
        }
        function scaleNotes(s, lo, hi) { var r = []; for (var m = lo; m <= hi; m++) if (s.scale.indexOf(pc(m - s.k)) >= 0) r.push(m); return r; }
        function low(m, base) { base = base || 36; return base + pc(m - base); }
        function rootNear(s, m) { var r = m - pc(m - s.k); return m - r > 6 ? r + 12 : r; }
        function nearestIdx(arr, m) { var bi = 0, bd = 1e9; for (var i = 0; i < arr.length; i++) { var d = Math.abs(arr[i] - m); if (d < bd) { bd = d; bi = i; } } return bi; }
        function voiceChord(notes, prev, lo, hi) {
            var out = [];
            notes.forEach(function (n) {
                var best = null, bd = 1e9;
                for (var m = lo; m <= hi; m++) {
                    if (pc(m) !== pc(n)) continue;
                    var d = prev && prev.length ? Math.min.apply(null, prev.map(function (p) { return Math.abs(p - m); })) : Math.abs(m - (lo + hi) / 2);
                    if (d < bd) { bd = d; best = m; }
                }
                if (best !== null && out.indexOf(best) < 0) out.push(best);
            });
            return out.sort(function (a, b) { return a - b; });
        }
        function pivotIndex(prev, s) {
            if (!prev || !prev.length) return 0;
            var best = 0, bs = -1;
            for (var i = 0; i < s.prog.length; i++) {
                var p = chordPcs(s, i), sc = 0;
                for (var j = 0; j < p.length; j++) if (prev.indexOf(p[j]) >= 0) sc++;
                if (p[0] === prev[0]) sc += 0.5;
                if (i === 0) sc += 0.2;
                if (sc > bs) { bs = sc; best = i; }
            }
            return best;
        }

        // ── Scenes (theme × mood × genre) ───────────────────────────────
        function sceneKeyOf(theme, dark, genre) { return theme + (dark ? '/n/' : '/d/') + genre; }
        function Scene(theme, dark, genre) {
            var th = THEMES[theme] || THEMES.neutral, gn = GENRES[genre] || GENRES.ambient;
            this.theme = theme; this.dark = !!dark; this.genre = genre; this.key = sceneKeyOf(theme, dark, genre);
            this.k0 = this.k = th.key; this.scale = th.scale; this.gn = gn;
            this.baseA = this.prog = this.dark ? th.night : th.day; this.baseB = (ALT[theme] || ALT.neutral)[this.dark ? 1 : 0];
            this.form = pick(FORMS); this.mod = pick([0, 0, 5, -2]); this.grooveB = pick([1, 2]); this.sec = null; this.secBar = 0; this.secLast = false; this.ph = {};
            this.bright = th.bright * (this.dark ? 0.72 : 1);
            var vo = VOPT[theme] || VOPT.neutral; this.V = chance(0.4) ? vo[0] : pick(vo);
            this.B = 60 / (gn.bpm * (this.dark ? 0.94 : 1) * rnd(0.95, 1.05)); this.barDur = this.B * 4; this.cpb = gn.cpb;
            this.offset = 0; this.bar0 = 0; this.bar = 0; this.nextT = 0; this.endT = null; this.ending = false; this.ci = 0; this.forcePad = true;
            this.prevVoice = null; this.lastKoto = null; this.busyUntil = 0; this.lhPat = null;
            this.cont = []; this.fv = null; this.hist = []; this.E = null; this.Ee = null; this.accent = false;
            var sp = this.sp = SPACE[theme] || SPACE.neutral;
            this.dry = gainN(gn.trim); this.nat = gainN(gn.nat); this.wet = gainN(sp.verb); this.nwet = gainN(gn.nat); this.echo = gainN(sp.echo);
            this.toneF = Math.min(18000, gn.tone * this.bright);
            this.tone = filt('lowpass', this.toneF, 0.5); this.damp = filt('lowpass', sp.damp, 0.5);
            this.fd = gainN(0); this.fw = gainN(0); this.fe = gainN(0);
            this.dry.connect(this.tone); this.nat.connect(this.tone); this.tone.connect(this.fd); this.fd.connect(G.music);
            this.nwet.connect(this.wet); this.wet.connect(this.damp); this.damp.connect(this.fw); this.fw.connect(G.verbIn);
            this.echo.connect(this.fe); this.fe.connect(G.echoIn);
            this.d = { dry: this.dry, wet: this.wet, echo: this.echo };
            this.nd = { dry: this.nat, wet: this.nwet, echo: null };
        }
        Scene.prototype.valAt = function (t) {
            var f = this.fv; if (!f) return 0;
            if (t <= f.t) return f.a; if (t >= f.t + f.d) return f.b;
            var x = (t - f.t) / f.d;
            return f.a + (f.b - f.a) * (f.b > f.a ? Math.sin(x * Math.PI / 2) : 1 - Math.cos(x * Math.PI / 2));
        };
        // Equal-power fade on all three scene faders (dry, reverb, echo)
        Scene.prototype.fade = function (to, t, dur) {
            var from = this.valAt(t);
            [this.fd, this.fw, this.fe].forEach(function (f) {
                var p = f.gain; p.cancelScheduledValues(t); p.setValueAtTime(from, t);
                for (var i = 1; i <= 16; i++) {
                    var x = i / 16, y = to > from ? Math.sin(x * Math.PI / 2) : 1 - Math.cos(x * Math.PI / 2);
                    p.linearRampToValueAtTime(from + (to - from) * y, t + dur * x);
                }
            });
            this.fv = { a: from, b: to, t: t, d: dur };
        };
        Scene.prototype.start = function (t, dur) {
            this.nextT = t; this.bar = this.bar0 = 0; this.forcePad = true;
            natureStart(this, t);
            var wl = {
                ambient: [['suikin', 72, 98], ['glass', 76, 96], ['koto', 76, 100]], zen: [[this.theme === 'okinawa' ? 'sanshin' : 'koto', 52, 96], ['bowl', 52, 78], ['kane', 40, 56]],
                piano: [['piano', 36, 96], ['celesta', 76, 96]], lofi: [['bass', 24, 60], ['ep', 52, 80], ['vibes', 60, 90]], nature: [['koto', 64, 98], ['suikin', 76, 98], ['kane', 40, 56]]
            }[this.genre] || [];
            wl.forEach(function (w) { warm(w[0], w[1], w[2]); });
            this.V.forEach(function (v) { if (STR[v]) warm(v, VREG[v][0] - (v === 'koto' ? 12 : 2), VREG[v][1] + 4); });
            if (this.gn.start) this.gn.start(this, t);
            this.fade(1, t, dur);
        };
        Scene.prototype.fadeOut = function (t, dur, force) {
            if (this.ending && !force) return;
            var end = t + dur;
            if (this.ending && this.endT !== null && this.endT <= end) return;
            this.ending = true; this.endT = end;
            this.fade(0, t, dur);
            this.cont.forEach(function (s) { try { s.stop(end + 0.3); } catch (e) { } });
        };
        Scene.prototype.dispose = function () {
            [this.fd, this.fw, this.fe].forEach(function (f) { try { f.disconnect(); } catch (e) { } });
            this.cont.forEach(function (s) { try { s.stop(); } catch (e) { } });
            this.cont = [];
        };
        Scene.prototype.save = function () {
            if (OFF) return;
            try { sessionStorage.setItem(SS, JSON.stringify({ key: this.key, idx: this.ci, pcs: chordPcs(this), ts: Date.now(), flow: Math.round(flowNow() * 100) / 100 })); } catch (e) { }
        };
        Scene.prototype.scheduleBar = function (b, t0) {
            var rel = b - this.bar0, si = Math.floor(rel / SEC), chordBar = rel % this.cpb === 0;
            this.secBar = rel % SEC; this.secLast = this.secBar === SEC - 1;
            // Song form: 8-bar sections A / B (second progression) / C (sparse bridge, sometimes in another key)
            if (this.sec === null || this.secBar === 0) {
                if (si > 0 && si % this.form.length === 0) { this.form = pick(FORMS); this.mod = pick([0, 0, 5, -2]); }
                this.sec = this.form[si % this.form.length];
                this.prog = colorize(this.sec === 'B' ? this.baseB : this.baseA);
                this.k = this.k0 + (this.sec === 'C' ? this.mod : 0);
                if (si > 0) this.forcePad = true;
            }
            this.ci = ((si === 0 ? this.offset : 0) + Math.floor(this.secBar / this.cpb)) % this.prog.length;
            this.hist.push({ t: t0, ci: this.ci, k: this.k, prog: this.prog }); if (this.hist.length > 4) this.hist.shift();
            var tgt = energy(t0);
            // ±1 step per bar keeps the build-up gradual; the bloom may jump
            this.E = this.E === null || tgt >= 4 || this.E >= 4 ? tgt : clamp(tgt, this.E - 1, this.E + 1);
            this.Ee = this.sec === 'C' && this.E < 4 ? Math.min(this.E, 1) : this.E;
            this.tone.frequency.setTargetAtTime(Math.min(18000, this.toneF * TONEMUL[this.Ee]), t0, 1.2);
            if (chordBar) this.save();
            this.gn.bar(this, rel, t0, chordBar || this.forcePad);
            if (this.accent) { this.accent = false; accentBar(this, t0); }
            else if (this.secBar === 0 && si > 0 && this.Ee >= 1) secHit(this, t0);
            this.forcePad = false;
            natureBar(this, t0);
        };
        function span(s, rel) { return (s.cpb - (rel % s.cpb)) * s.barDur; }
        var SEC = 8, FORMS = [['A', 'A', 'B', 'A', 'C', 'B'], ['A', 'B', 'A', 'B', 'C', 'A'], ['A', 'A', 'B', 'C', 'B', 'A'], ['A', 'B', 'C', 'A', 'B', 'B']];
        // Each pass recolours some chords: Western types swap colour tones, scale chords drop or keep their colour tone
        var COLORS = { maj7: ['maj9', 'add9', 'six9'], maj9: ['maj7', 'six9'], add9: ['maj9', 'six9', 'maj7'], six9: ['maj9', 'add9'], maj: ['add9'], m7: ['m9'], m9: ['m7'], sus2: ['sus4', 'add9'], sus4: ['sus2'] };
        function colorize(p) {
            return p.map(function (c) {
                if (!chance(0.35)) return c;
                if (typeof c[1] === 'string') return COLORS[c[1]] ? [c[0], pick(COLORS[c[1]])] : c;
                return c[1] === 1 ? c : [c[0], c[1] === 2 ? 0 : 2];
            });
        }

        // ── Genres ──────────────────────────────────────────────────────
        function ambientBar(s, rel, t0, cs) {
            var B = s.B, E = s.Ee, sec = s.sec, V = s.V, bd = s.barDur;
            if (cs) {
                var ch = chordNotes(s, s.ci), v = voiceChord(ch, s.prevVoice, 52, 74); s.prevVoice = v;
                pad(s.d, t0, v, span(s, rel), { type: 'triangle', type2: 'sine', cut: (sec === 'B' ? 1600 : 1300) * s.bright, att: 2.6, rel: 3.4, gain: 0.03, det: 6, wet: 0.6 });
                sub(s.d, t0, low(ch[0]), span(s, rel), 0.07);
                if (chance(sec === 'C' ? 0.9 : 0.5)) sho(s.d, t0 + B * pick([0, 1]), shoVoice(s, ch), span(s, rel), 0.014, { wet: 0.85 });
            }
            // Suikinkutsu: drops ring the buried jar, always within the scale
            var drops = scaleNotes(s, 74, 96), nd = poisson([0.6, 1.2, 1.8, 2.6, 3.5][E] * (sec === 'C' ? 0.6 : 1));
            for (var i = 0; i < nd; i++) {
                var tt = t0 + rnd(0, bd), pn = rnd(-0.6, 0.6);
                suikin(s.d, tt, pick(drops), rnd(0.02, 0.035), pn);
                if (chance(0.25)) suikin(s.d, tt + rnd(0.12, 0.3), pick(drops), 0.014, pn);
            }
            // Far-off phrases: the landscape's instrument (A), its partner (B)
            if (sec !== 'C' && E >= 1 && rel % 2 === 0 && chance(E === 1 ? 0.35 : E >= 3 ? 0.8 : 0.55)) lead(s, sec === 'B' ? V[1] : V[0], 'amb' + sec, rel, t0, 0.05, 0, true);
            // Koto harmonics: soft high tones with long echoes
            if (sec !== 'C' && rel % 2 === 1 && chance(0.4)) {
                var hn = chordTones(chordNotes(s, s.ci), 79, 98);
                for (var h = 0; h < 2 && hn.length; h++) pluck(s.d, t0 + B * (h * 1.5 + rnd(0, 0.5)), pick(hn), 0.03, { decay: 2, bright: 3, wet: 0.85, echo: 0.45, pan: rnd(-0.5, 0.5) });
            }
            // Bridge: a singing bowl under shō and glass
            if (sec === 'C' && s.secBar === 0) singBowl(s.d, t0, low(s.k, 57), bd * 4, 0.028, { wet: 0.7 });
            if (sec === 'C' && rel % 2 === 0) tone('glass', s.d, t0 + B * pick([0, 1, 2]), pick(voiceChord(chordNotes(s, s.ci), null, 79, 96)), 0.02, { wet: 0.9, echo: 0.4, pan: rnd(-0.6, 0.6) });
            if (s.secLast) noiseHit(s.d, t0 + B * 2, { kind: 'pink', type: 'bandpass', f: 500, f2: 2600, q: 1, dur: B * 2, att: B * 1.9, vel: 0.008, wet: 0.6 });
            if (E >= 4 || (E >= 3 && rel % 2 === 1)) arpLayer(s, t0, E);
        }
        var KOTO = [[[0, 0], [1, 1], [1.5, 1], [2, -1], [3, 0]], [[0, 0], [0.5, 2], [1, -1], [2, -2]], [[0, 0], [2, 1], [2.5, 1], [3, 2]],
        [[1, 0], [1.5, -1], [2, -1], [3.5, 1]], [[0, 0], [0.75, 1], [1, 1], [3, -3]], [[0, 0], [1.5, 2], [2, -1], [2.5, -1], [3, -1]]];
        var SANSHIN = [[[0, 0], [0.5, 1], [1, 1], [1.5, -1], [2, -1], [2.5, 1], [3, 1], [3.5, -2]], [[0, 0], [1, 2], [1.5, -1], [2, -1], [3, 1], [3.5, 1]],
        [[0, 0], [0.5, 0], [1, 1], [2, 0], [2.5, 2], [3, -1]]];
        function zenBar(s, rel, t0, cs) {
            var B = s.B, oki = s.theme === 'okinawa', E = s.Ee, sec = s.sec;
            if (cs) {
                var ch = chordNotes(s, s.ci);
                sho(s.d, t0, shoVoice(s, ch), span(s, rel), 0.022, { wet: 0.7 });
                sub(s.d, t0, low(ch[0]), span(s, rel), 0.06);
            }
            // Lead: the landscape's instrument (A), its partner (B), a bamboo flute alone in the bridge; Okinawa's A is the sanshin pattern
            var V = s.V, lv = sec === 'C' ? (oki ? 'fue' : 'shaku') : sec === 'B' ? V[1] : oki ? null : V[0], wind = lv === 'shaku' || lv === 'fue';
            if (lv && E >= 1 && rel % 2 === 0 && chance(sec === 'C' ? 0.7 : E === 1 ? 0.5 : E >= 3 ? 0.95 : s.dark ? 0.6 : 0.75)) { lead(s, lv, 'zen' + sec + lv, rel, t0, 0.075); s.busyUntil = t0 + 2 * s.barDur; }
            var notes = scaleNotes(s, oki ? 62 : 57, oki ? 84 : 79);
            // Koto (sanshin) patterns accompany a wind lead
            if (sec !== 'C' && E >= 1 && (wind || !lv) && chance((t0 < s.busyUntil ? 0.35 : (oki ? 0.85 : 0.65)) * (E === 1 ? 0.5 : E >= 3 ? 1.15 : 1))) {
                var pat = pick(oki ? SANSHIN : KOTO), cts = notes.filter(function (x) { return chordPcs(s).indexOf(pc(x)) >= 0; });
                var mk = s.lastKoto != null && chance(0.6) ? s.lastKoto : pick(cts.length ? cts : notes), pan = rnd(-0.35, 0.35);
                pat.forEach(function (p, j) {
                    mk = notes[clamp(nearestIdx(notes, mk) + p[1], 0, notes.length - 1)];
                    var tt = t0 + p[0] * B + (oki && p[0] % 1 ? B * 0.08 : 0) + rnd(0, 0.015), last = j === pat.length - 1;
                    pluck(s.d, tt, mk, rnd(0.06, 0.09) * (s.dark ? 0.8 : 1), oki
                        ? { wave: 'square', decay: 0.8, bright: 9, q: 2.5, wet: 0.35, pan: pan, pick: true }
                        : { decay: 1.6, bright: 7, q: 1.5, wet: 0.45, echo: 0.15, pan: pan, pick: true, bend: last && chance(0.3) ? 1 : 0, bendAt: 0.2 });
                });
                s.lastKoto = mk;
                // Occasional koto tremolo on the phrase's last note
                if (!oki && chance(0.15)) for (var tr = 1; tr <= 5; tr++) pluck(s.d, t0 + 3.5 * B + tr * 0.07, mk, 0.05 * (1 - tr * 0.12), { decay: 0.6, bright: 7, wet: 0.45, pan: pan, pick: true });
            }
            // Under a plucked lead, now and then a long shakuhachi tone on a nuclear tone
            if (lv && !wind && rel % 4 === 1 && E >= 2 && chance(0.3)) {
                var kn = scaleNotes(s, 62, 79).filter(function (x) { return [0, 5, 7].indexOf(pc(x - s.k)) >= 0; });
                if (kn.length) flute(s.d, t0 + B * 0.5, pick(kn), s.barDur * 0.6, 0.04, { wet: 0.7, echo: 0.25, pan: -0.2, vib: 0.02, fall: chance(0.5) ? 1 : 0 });
            }
            // B: a gentle ostinato on the chord tones
            if (sec === 'B' && E >= 2) {
                var ost = chordTones(chordNotes(s, s.ci), oki ? 64 : 62, 81), op = rnd(-0.4, 0.4);
                if (ost.length >= 3) for (var o = 0; o < 8; o++) if (o % 4 !== 3) pluck(s.d, t0 + o * B / 2 + rnd(0, 0.01), ost[[0, 2, 1][o % 4]], 0.032 * (o % 2 ? 0.7 : 1), oki ? { wave: 'square', decay: 0.6, bright: 8, wet: 0.35, pan: op } : { decay: 1, bright: 6, wet: 0.4, echo: 0.15, pan: op });
                // Mokugyo (temple woodblock) keeps a soft pulse
                for (var mg = 0; mg < 4; mg++) wood(s.d, t0 + mg * B, 470, mg === 0 ? 0.03 : 0.018, { wet: 0.35, pan: -0.25 });
            }
            if (!oki && sec !== 'C' && E >= 2 && ((rel % 8 === 0 && chance(0.4)) || (E >= 4 && rel % 2 === 0))) { // sararin: quick upward sweep at phrase start
                var i0 = Math.floor(Math.random() * 3);
                for (var g = 0; g < 6 && i0 + g < notes.length; g++) pluck(s.d, t0 + g * 0.06, notes[i0 + g], 0.045, { decay: 1.2, bright: 6, wet: 0.5, pan: -0.3 + g * 0.12 });
            }
            // Singing bowls: a struck bowl opens each section and answers now and then; in the bridge one is rubbed and sings
            var bw = scaleNotes(s, 55, 76).filter(function (x) { return [0, 5, 7].indexOf(pc(x - s.k)) >= 0; }), b0 = low(s.k, 55);
            if (s.secBar === 0) bowl(s.d, t0, b0, 0.075, { pan: -0.15 });
            else if (rel % 2 === 0 && chance(sec === 'C' ? 0.5 : 0.35)) bowl(s.d, t0 + B * pick([0, 1, 2]), pick(bw.length ? bw : [b0 + 12]), 0.05, { pan: rnd(-0.5, 0.5) });
            if (sec === 'C' && s.secBar === 0) singBowl(s.d, t0 + B, b0, s.barDur * 5, 0.04, { wet: 0.6 });
            else if (sec === 'A' && s.secBar === 4 && chance(0.35)) singBowl(s.d, t0, b0 + 12, s.barDur * 3, 0.025, { wet: 0.65, pan: 0.3 });
            // Temple bell at night (and in the forest), opening the bridge
            if (sec === 'C' && s.secBar === 0 && (s.dark || s.theme === 'sage')) kane(s.d, t0 + B * 2, low(s.k, 43), 0.05, { pan: 0.3 });
            if (E >= 4 || (E >= 3 && rel % 2 === 1)) arpLayer(s, t0, E);
        }
        // Left hand under the sustain pedal: [beat, voices (0 root, 1 fifth, 2/3 chord tones above, 4 octave), velocity]
        var LHP = [
            [[0, [0, 4], 0.3], [1, [2, 3], 0.15], [2.5, [1], 0.13], [3, [2, 3], 0.13]],
            [[0, [0], 0.3], [1, [1], 0.17], [2, [2], 0.19], [3, [3], 0.15]],
            [[0, [0, 4], 0.32], [2, [1, 2, 3], 0.16]],
            [[0, [0], 0.3], [0.5, [1], 0.15], [1, [4], 0.17], [2, [3], 0.16], [3, [2], 0.14]],
            [[0, [0, 1], 0.3], [1.5, [2], 0.15], [2, [3, 4], 0.15]]
        ];
        var LHP_SPARSE = [[0, [0, 4], 0.28], [2, [2, 3], 0.13]];
        // Two-bar phrase cells: [beat, scale step from the goal tone, beats, ornament], leaving space (ma) at the end.
        // Ornaments: g grace from above, o push up and release (oshi-hanashi), y vibrato (yuri), f falling release
        var JP = [
            [[0, 2, 1], [1, 1, 0.5], [1.5, 2, 0.5], [2, 1, 1, 'g'], [3, 0, 3, 'y']],
            [[0, 0, 1], [1, 1, 1], [2, 2, 0.5], [2.5, 3, 1.5], [4, 2, 1], [5, 1, 0.5], [5.5, 0, 2, 'y']],
            [[0, -2, 1.5], [1.5, 0, 0.5], [2, 0, 1], [3, 1, 1, 'o'], [4, 0, 3, 'f']],
            [[0, 1, 2, 'o'], [2.5, 0, 3.5, 'y']],
            [[0, -1, 0.25], [0.25, 0, 0.25], [0.5, 1, 0.25], [0.75, 2, 1.25], [2, 1, 1], [3, 0, 3, 'y']],
            [[0, 1, 0.5], [0.5, 1, 0.5], [1, 2, 1], [2, 1, 0.5], [2.5, 1, 0.5], [3, 0, 1], [4, -1, 1], [5, 0, 2.5, 'y']],
            [[0, 3, 1, 'g'], [1, 2, 1], [2, 0, 1], [3, -1, 1], [4, 0, 3, 'y']],
            [[0, 2, 3, 'o'], [3, 0, 1], [4, -2, 3, 'f']],
            [[0, 0, 1.5], [1.5, 2, 0.5], [2, 3, 2, 'o'], [4, 2, 1], [5, 1, 2.5, 'y']],
            [[0.5, 2, 0.5], [1, 1, 0.5], [1.5, 0, 2.5, 'y'], [4.5, 1, 0.5], [5, 0, 2, 'f']],
            [[0, 0, 0.5], [0.5, 1, 0.5], [1, 0, 0.5], [1.5, -1, 0.5], [2, 0, 2, 'y'], [5, 2, 0.5], [5.5, 1, 0.5], [6, 0, 2]],
            [[0, 3, 0.5, 'g'], [0.5, 2, 0.5], [1, 1, 0.5], [1.5, 2, 0.5], [2, 1, 0.5], [2.5, 0, 3.5, 'y']],
            [[0, -1, 1], [1, 0, 1], [2, 2, 2, 'o'], [4, 1, 0.5], [4.5, 0, 0.5], [5, -1, 0.5], [5.5, 0, 2.5, 'f']],
            [[0, 4, 2, 'y'], [2, 3, 0.5], [2.5, 2, 0.5], [3, 1, 1, 'g'], [4, 0, 4, 'y']],
            [[0, 0, 0.75], [0.75, 0, 0.25], [1, 1, 1], [2, 0, 0.75], [2.75, 0, 0.25], [3, -1, 1], [4, 0, 2, 'y']],
            [[1, 2, 1, 'g'], [2, 1, 2, 'o'], [4, 0, 1], [5, -2, 3, 'f']],
            [[0, 1, 0.33], [0.33, 2, 0.33], [0.67, 1, 0.33], [1, 0, 3, 'y'], [4.5, 2, 0.5], [5, 1, 1], [6, 0, 2]],
            [[0, -2, 2, 'o'], [2, 0, 2, 'y'], [4, 1, 1], [5, 0, 3, 'f']]
        ];
        // Phrases resolve onto the nuclear tones (kakuon: tonic, fourth, fifth). Per 8-bar section: call, answer,
        // the call again (thinned out) and a closing on the tonic; the motif returns with its section letter.
        function jphrase(s, slot, rel, lo, hi) {
            var notes = scaleNotes(s, lo, hi), n = notes.length, pi = Math.floor(s.secBar / 2) % 4, M = s.ph[slot], gs = [], ton = [];
            notes.forEach(function (m, i) { var p = pc(m - s.k); if (i >= 2 && i <= n - 4 && (p === 0 || p === 5 || p === 7)) { gs.push(i); if (!p) ton.push(i); } });
            if (!gs.length) gs = [Math.floor(n / 2)];
            if (!ton.length) ton = gs;
            if (!M || (pi === 0 && chance(0.3))) {
                var a = pick(gs), b = pick(gs.length > 1 ? gs.filter(function (i) { return i !== a; }) : gs), t1 = pick(JP);
                M = s.ph[slot] = { t: [t1, pick(JP), t1, pick([JP[0], JP[3], JP[6], JP[7]])], g: [a, b, a, pick(ton)] };
            }
            if (pi === 3 && chance(0.3)) return [];
            var tp = M.t[pi], g = clamp(M.g[pi], 2, n - 4), out = [];
            tp.forEach(function (c, j) {
                if (pi === 2 && j > 0 && j < tp.length - 1 && chance(0.25)) return;
                var i = clamp(g + c[1], 0, n - 1);
                out.push({ beat: c[0], dur: c[2], orn: c[3] || '', m: notes[i], up: i < n - 1 ? notes[i + 1] - notes[i] : 2, dn: i > 0 ? notes[i] - notes[i - 1] : 2 });
            });
            return out;
        }
        // One phrase note on a Japanese instrument, with its idiomatic ornament
        function jvoice(s, v, t, n, vel, pan, far) {
            var d = s.d, dur = n.dur * s.B, m = n.m, tg = Math.max(now(), t - 0.07), wet = far ? 0.8 : 0.4, o;
            vel *= VK[v] * rnd(0.85, 1.05);
            if (v === 'piano') {
                if (n.orn === 'g') piano(d, tg, m + n.up, vel * 0.55, 0.12, { wet: 0.45, pan: pan });
                piano(d, t, m, vel, dur + s.B * 0.5, { wet: 0.45, pan: pan, ped: true });
                // Long notes in octaves
                if (n.dur >= 1.5 && chance(0.4)) piano(d, t + 0.006, m - 12, vel * 0.5, dur + s.B * 0.5, { wet: 0.45, pan: pan, ped: true });
                return;
            }
            if (v === 'shaku' || v === 'fue') {
                flute(d, t, m, Math.max(0.3, dur * 0.9), vel, { wet: wet + 0.25, echo: far ? 0.35 : 0.25, pan: pan, fue: v === 'fue', grace: n.orn === 'g' ? m + n.up : n.orn === 'o' ? m - n.dn : 0, vib: n.orn === 'y' ? 0.02 : 0, fall: n.orn === 'f' ? 1 : 0 });
                return;
            }
            o = { kind: v === 'koto' ? null : v, decay: v === 'shamisen' || v === 'sanshin' ? 0.85 : 1.6, bright: v === 'koto' ? 7 : 9, wet: v === 'biwa' ? wet + 0.1 : wet, echo: far ? 0.35 : 0.15, pan: pan, pick: true };
            if (n.orn === 'g') pluck(d, tg, m + n.up, vel * 0.5, o);
            if (n.orn === 'o' && dur > 0.5) { o.bend = n.up; o.bendAt = Math.min(0.3, dur * 0.3); o.release = dur * 0.35; }
            else if (n.orn === 'y' && dur > 0.6) o.yuri = true;
            else if (n.orn === 'f' && dur > 0.6) { o.bend = -1; o.bendAt = dur * 0.55; }
            pluck(d, t, m, vel, o);
            // Koto: long notes doubled an octave below
            if (v === 'koto' && n.dur >= 2 && chance(0.3)) pluck(d, t + 0.012, m - 12, vel * 0.45, { decay: 1.6, bright: 6, wet: 0.45, pan: pan });
        }
        function lead(s, v, slot, rel, t0, vel, sw, far) {
            var r = VREG[v], pan = rnd(-0.3, 0.3);
            jphrase(s, slot, rel, r[0], r[1]).forEach(function (n) { jvoice(s, v, t0 + n.beat * s.B + (sw && n.beat % 1 ? sw : 0) + rnd(0, 0.012), n, vel, pan, far); });
        }
        function pianoBar(s, rel, t0, cs) {
            var B = s.B, E = s.Ee, sec = s.sec, ch = chordNotes(s, s.ci), R = low(ch[0], 40), dk = s.dark ? 0.85 : 1, V = s.V;
            var up = function (m) { return R + 12 + pc(m - R); };
            var lh = [R, R + 7, up(ch[1]), up(ch[3] != null ? ch[3] : ch[2]), R + 12];
            if (rel % 8 === 0 || !s.lhPat) s.lhPat = pick(LHP);
            if (sec === 'C') {
                // Bridge: sustained chords and a few celesta sparkles
                if (cs) voiceChord(ch, s.prevVoice, 55, 74).concat([R]).forEach(function (m, i) { piano(s.d, t0 + i * 0.015, m, 0.15 * dk, span(s, rel), { wet: 0.5, ped: true }); });
                if (rel % 2 === 0 && chance(0.6)) lead(s, V[1], 'pnoC' + V[1], rel, t0, 0.065);
                else if (chance(0.35)) tone('celesta', s.d, t0 + B * pick([1, 1.5, 2.5]), pick(scaleNotes(s, 79, 96)), 0.022, { wet: 0.6, echo: 0.3, pan: rnd(-0.4, 0.4) });
            } else if (sec === 'B') {
                // B: rolled chords under the pedal, the landscape's instrument sings above
                if (cs) { var rv = voiceChord(ch, s.prevVoice, 55, 76); s.prevVoice = rv;[R, R + 12].concat(rv).forEach(function (m, i) { piano(s.d, t0 + i * 0.045, m, (i < 2 ? 0.26 : 0.16) * dk, span(s, rel), { wet: 0.45, ped: true }); }); }
                else if (E >= 2) piano(s.d, t0 + 2 * B, R + 12, 0.14 * dk, 2 * B, { wet: 0.45, ped: true });
                if (cs && E >= 2) sho(s.d, t0, shoVoice(s, ch), span(s, rel), 0.012, { wet: 0.7 });
                if (E >= 1 && rel % 2 === 0 && chance(E === 1 ? 0.5 : E >= 3 ? 0.95 : (s.dark ? 0.65 : 0.85))) lead(s, V[0], 'pnoB' + V[0], rel, t0, 0.07);
            } else {
                var hold = span(s, rel);
                (E <= 1 || (s.dark && E < 3) ? LHP_SPARSE : s.lhPat).forEach(function (p) {
                    p[1].forEach(function (ix, j) { piano(s.d, t0 + p[0] * B + j * 0.012 + rnd(0, 0.01), lh[ix], p[2] * rnd(0.88, 1.04) * dk * (E <= 0 ? 0.8 : 1), Math.max(B, hold - p[0] * B), { wet: 0.4, ped: true }); });
                });
                if (E >= 1 && rel % 2 === 0 && chance(E === 1 ? 0.5 : E >= 3 ? 0.95 : (s.dark ? 0.65 : 0.85))) lead(s, 'piano', 'pnoA', rel, t0, 0.27);
                // Lead-in run into the next section
                if (s.secLast && E >= 2) { var rn = scaleNotes(s, 64, 88), i0 = nearestIdx(rn, 72); for (var q = 0; q < 4; q++) piano(s.d, t0 + 3 * B + q * B / 4, rn[Math.min(rn.length - 1, i0 + q)], 0.15 + q * 0.02, B * 0.4, { wet: 0.45, pan: 0.15 }); }
            }
            if (E >= 4 || (E >= 3 && rel % 2 === 1)) arpLayer(s, t0, E);
        }
        function lofiStart(s, t) {
            var c = noiseN('crackle'), g = gainN(0.9);
            c.connect(g); g.connect(s.dry); startNoise(c, t); s.cont.push(c);
        }
        function lofiBar(s, rel, t0) {
            var B = s.B, sw = B * 0.14, ch = chordNotes(s, s.ci), v = voiceChord(ch, s.prevVoice, 55, 76), R = low(ch[0], 36), dk = s.dark ? 0.75 : 1, E = s.Ee, sec = s.sec, gv = sec === 'B' ? s.grooveB : 0;
            s.prevVoice = v;
            v.forEach(function (m, i) { ep(s.d, t0 + 0.02 + i * 0.012, m, 0.05 * dk, B * 1.9, { wet: 0.35 }); });
            var stab = sec === 'B' ? 1.5 * B + sw : 2.5 * B + sw;
            if (chance(sec === 'B' ? 0.7 : 0.5)) v.forEach(function (m, i) { ep(s.d, t0 + stab + i * 0.01, m, 0.03 * dk, sec === 'B' ? B * 0.45 : B * 0.9, { wet: 0.35 }); });
            if (E >= 1) {
                bass(s.d, t0, R, 0.12, B * 1.6);
                if (chance(0.6)) bass(s.d, t0 + 2.5 * B + sw, R + pick([7, 12]), 0.09, B * 0.8);
                if (chance(E >= 3 ? 0.45 : 0.3)) bass(s.d, t0 + 3.5 * B + sw, R + pick([-2, -1, 2]), 0.07, B * 0.45);
                kick(s.d, t0, 0.5 * dk);
                // Grooves: 0 classic, 1 syncopated with 16th hats, 2 half-time
                if (gv === 1) { kick(s.d, t0 + 1.75 * B + sw, 0.3 * dk); kick(s.d, t0 + 3 * B, 0.4 * dk); }
                else if (gv === 0) { if (chance(0.65)) kick(s.d, t0 + 2.5 * B + sw, 0.38 * dk); else kick(s.d, t0 + 2 * B, 0.4 * dk); }
            }
            if (E >= 2) {
                if (gv === 2) brush(s.d, t0 + 2 * B, 0.34 * dk); else { brush(s.d, t0 + B, 0.3 * dk); brush(s.d, t0 + 3 * B, 0.32 * dk); }
                if (!s.secLast && chance(0.25)) brush(s.d, t0 + 3.75 * B, 0.12 * dk);
                var nh = gv === 1 ? 16 : 8;
                for (var i = 0; i < nh; i++) shaker(s.d, t0 + i * 4 * B / nh + (i % 2 ? (nh === 16 ? sw * 0.5 : sw) : 0), (i % 2 ? 0.1 : 0.16) * dk * (nh === 16 ? 0.7 : 1));
                if (E >= 3 && nh === 8) for (var h = 0; h < 8; h++) if (chance(0.6)) shaker(s.d, t0 + (h * 2 + 1) * B / 4 + sw * 0.5, 0.05 * dk);
                // Fill into the next section
                if (s.secLast) for (var f = 0; f < 4; f++) brush(s.d, t0 + 3 * B + f * B / 4 + (f % 2 ? sw * 0.5 : 0), (0.12 + f * 0.06) * dk);
            }
            if (E >= 4 || (E >= 3 && rel % 2 === 1)) arpLayer(s, t0, E);
            // Hook: the landscape's instrument (A), its partner (B), a bamboo flute in the bridge
            var V = s.V, lv = sec === 'B' ? V[1] : sec === 'A' ? V[0] : V[0] === 'shaku' ? 'koto' : 'shaku';
            if (E >= 1 && rel % 2 === 0 && chance((s.dark ? 0.45 : 0.6) * (E >= 3 || sec === 'B' ? 1.4 : 1))) lead(s, lv, 'lofi' + sec + lv, rel, t0, 0.06 * dk, sw);
        }

        // ── Nature soundscapes ──────────────────────────────────────────
        function loopLayer(s, kind, t) { var x = noiseN(kind); startNoise(x, t); s.cont.push(x); return x; }
        // Decorrelated stereo pair: a mono noise bed in the centre sounds like flat hiss
        function bed(s, kind, t, width) {
            var g = gainN(1);
            [-width, width].forEach(function (pn) {
                var x = loopLayer(s, kind, t), o = x;
                if (ctx.createStereoPanner) { o = ctx.createStereoPanner(); o.pan.value = pn; x.connect(o); }
                o.connect(g);
            });
            return g;
        }
        function natureStart(s, t) {
            var p = (NAT[s.theme] || NAT.neutral)[s.dark ? 'n' : 'd'], bg = gainN(s.genre === 'nature' ? 0.6 : 1);
            bg.connect(s.nat);
            s.np = p; s.L = {};
            if (p.wind) {
                var w = bed(s, 'pink', t, 0.6), bp = filt('bandpass', 420, 0.8), lp = filt('lowpass', 1100, 0.5), g = gainN(0);
                w.connect(bp); bp.connect(lp); lp.connect(g); g.connect(bg);
                g.gain.setTargetAtTime(p.wind * K.wind * 0.6, t, 0.8);
                s.L.wind = { g: g, bp: bp, lvl: p.wind * K.wind };
                if (p.leaves) s.L.leaves = { lvl: p.leaves };
            }
            if (p.water) {
                // Brook: low bed + smooth rush; the babble comes from discrete bubbles in natureBar
                var wb = bed(s, 'brown', t, 0.4), wlp = filt('lowpass', 600, 0.5), wg = gainN(0);
                wb.connect(wlp); wlp.connect(wg); wg.connect(bg); wg.gain.setTargetAtTime(p.water * K.gurgle, t, 1);
                var ru = bed(s, 'pink', t, 0.5), rbp = filt('bandpass', 1300, 0.7), rlp = filt('lowpass', 3500, 0.5), rg = gainN(0);
                ru.connect(rbp); rbp.connect(rlp); rlp.connect(rg); rg.connect(bg); rg.gain.setTargetAtTime(p.water * K.water, t, 1);
                s.L.water = { lvl: p.water, pan: rnd(-0.35, 0.35), rg: rg };
            }
            if (p.waves) {
                var wv = bed(s, 'pink', t, 0.7), wlp2 = filt('lowpass', 600, 0.5), wg2 = gainN(0);
                wv.connect(wlp2); wlp2.connect(wg2); wg2.connect(bg);
                s.L.waves = { g: wg2, lp: wlp2, lvl: p.waves * K.waves, next: t + 0.3 };
            }
            if (p.rain) {
                var r1 = bed(s, 'white', t, 0.8), rbp2 = filt('bandpass', 3000, 0.35), rg1 = gainN(0), r2 = bed(s, 'pink', t, 0.6), rlp2 = filt('lowpass', 900, 0.5), rg2 = gainN(0);
                r1.connect(rbp2); rbp2.connect(rg1); rg1.connect(bg); r2.connect(rlp2); rlp2.connect(rg2); rg2.connect(bg);
                rg1.gain.setTargetAtTime(p.rain * K.rain, t, 1); rg2.gain.setTargetAtTime(p.rain * K.rain * 0.8, t, 1);
                s.L.rain = { lvl: p.rain };
            }
            if (p.city) {
                var c1 = bed(s, 'brown', t, 0.5), clp = filt('lowpass', 200, 0.5), cg = gainN(0), c2 = bed(s, 'pink', t, 0.7), cbp = filt('bandpass', 650, 0.5), cg2 = gainN(0);
                c1.connect(clp); clp.connect(cg); cg.connect(bg); c2.connect(cbp); cbp.connect(cg2); cg2.connect(bg);
                cg.gain.setTargetAtTime(p.city * K.city, t, 1); cg2.gain.setTargetAtTime(p.city * K.city * 0.06, t, 1);
                s.L.city = { g: cg, lvl: p.city * K.city };
            }
        }
        function natureBar(s, t0) {
            var bd = s.barDur, L = s.L, p = s.np;
            if (L.wind) {
                var gt = t0 + rnd(0, bd * 0.5), v = L.wind.lvl * rnd(0.35, 1);
                L.wind.g.gain.setTargetAtTime(v, gt, rnd(1.2, 2.4)); L.wind.bp.frequency.setTargetAtTime(rnd(300, 700), gt, 2);
                // Foliage only stirs with a stronger gust: one soft swell instead of constant crackle
                if (L.leaves && v > L.wind.lvl * 0.65) noiseHit(s.nd, gt + rnd(0.3, 0.9), { kind: 'pink', type: 'bandpass', f: 1700, f2: 2600, q: 0.6, dur: rnd(2, 3.2), att: rnd(0.9, 1.5), vel: L.leaves.lvl * 0.05, wet: 0.35, pan: rnd(-0.6, 0.6) });
            }
            if (L.water) {
                var Wt = L.water;
                Wt.rg.gain.setTargetAtTime(Wt.lvl * K.water * rnd(0.75, 1.1), t0 + rnd(0, bd), 2);
                for (var bb = poisson(bd * 9 * Wt.lvl / 0.3); bb > 0; bb--) bubble(s.nd, t0 + rnd(0, bd), Wt);
            }
            if (L.waves) {
                var w = L.waves;
                while (w.next < t0 + bd) {
                    var up = rnd(2.6, 3.6), down = rnd(4, 6), peak = w.lvl * rnd(0.6, 1), wt = Math.max(w.next, t0);
                    w.g.gain.setTargetAtTime(peak, wt, up / 3); w.g.gain.setTargetAtTime(w.lvl * 0.18, wt + up, down / 3);
                    w.lp.frequency.setTargetAtTime(rnd(1300, 1900), wt, up / 3); w.lp.frequency.setTargetAtTime(500, wt + up, down / 3);
                    noiseHit(s.nd, wt + up * 0.8, { type: 'highpass', f: 2500, dur: 2.5, att: 0.6, vel: peak * K.foam, wet: 0.3, pan: rnd(-0.4, 0.4) });
                    w.next = wt + up + down * rnd(0.7, 1);
                }
            }
            if (L.city) L.city.g.gain.setTargetAtTime(L.city.lvl * rnd(0.7, 1), t0 + rnd(0, bd), 2);
            if (L.rain) for (var r = poisson(10 * L.rain.lvl); r > 0; r--) noiseHit(s.nd, t0 + rnd(0, bd), { f: rnd(2500, 6000), q: 3, dur: 0.015, vel: rnd(0.01, 0.03), pan: rnd(-0.8, 0.8) });
            var ev = p.ev || {}, mul = (s.genre === 'nature' ? 2.4 : 1) * EVMUL[s.E === null ? 2 : s.E] * (NOEV ? 0 : 1);
            for (var k in ev) {
                if (!EV.hasOwnProperty(k)) continue;
                for (var n = poisson(ev[k] * mul * bd / 60); n > 0; n--) EV[k](s.nd, t0 + rnd(0, bd), s);
            }
        }
        // Brook bubble: tiny sine whose pitch jumps up as the air pocket collapses
        function bubble(d, t, w) {
            var f = rnd(450, 1300), du = rnd(0.025, 0.07), x = oscN('sine', f), g = gainN(0), v = w.lvl * rnd(0.012, 0.04);
            x.frequency.setValueAtTime(f, t); x.frequency.exponentialRampToValueAtTime(f * rnd(1.4, 2.1), t + du);
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.setTargetAtTime(0, t + du * 0.4, du / 3);
            x.connect(g); send(g, d, 0.25, 0, clamp(w.pan + rnd(-0.25, 0.25), -0.8, 0.8)); x.start(t); x.stop(t + du * 2 + 0.03);
        }
        function birdCall(d, t, lvl) {
            var x = oscN('sine', 3000), g = gainN(0), n = 2 + Math.floor(Math.random() * 5), tt = t, base = rnd(2400, 4200), type = Math.floor(Math.random() * 3);
            g.gain.setValueAtTime(0, t);
            for (var i = 0; i < n; i++) {
                var du = rnd(0.04, 0.11), f0 = base * rnd(0.85, 1.2), f1 = f0 * (type === 0 ? rnd(1.2, 1.6) : type === 1 ? rnd(0.6, 0.85) : rnd(0.9, 1.1));
                x.frequency.setValueAtTime(f0, tt); x.frequency.exponentialRampToValueAtTime(f1, tt + du);
                g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(lvl, tt + 0.008); g.gain.linearRampToValueAtTime(0, tt + du);
                tt += du + rnd(0.03, 0.09);
            }
            var p0 = rnd(-0.8, 0.8);
            x.connect(g);
            if (chance(0.35)) sendMove(g, d, 0.45, p0, clamp(p0 + rnd(-0.9, 0.9), -0.9, 0.9), t, tt - t); else send(g, d, 0.45, 0, p0);
            x.start(t); x.stop(tt + 0.05);
        }
        // Japanese bush warbler (uguisu): "hōō — hokekyo"
        function uguisu(d, t, lvl) {
            var x = oscN('sine', 1000), g = gainN(0), F = x.frequency, s = rnd(0.95, 1.08), t2 = t + 1.05, t3 = t2 + 0.16, t4 = t3 + 0.17;
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
            var n = 2 + Math.floor(Math.random() * 2), tt = t, base = rnd(820, 1000), x = oscN('triangle', base), lp = filt('lowpass', 2600, 0.7), g = gainN(0);
            g.gain.setValueAtTime(0, t);
            for (var i = 0; i < n; i++) {
                x.frequency.setValueAtTime(base * 0.92, tt); x.frequency.linearRampToValueAtTime(base * 1.08, tt + 0.06); x.frequency.linearRampToValueAtTime(base, tt + 0.2);
                g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(lvl, tt + 0.03); g.gain.linearRampToValueAtTime(0, tt + 0.22);
                tt += rnd(0.3, 0.45);
            }
            var p0 = rnd(-0.8, 0.8);
            x.connect(lp); lp.connect(g); sendMove(g, d, 0.8, p0, clamp(p0 + (p0 < 0 ? 0.5 : -0.5), -0.9, 0.9), t, tt - t); x.start(t); x.stop(tt + 0.1);
        }
        // Bell cricket (suzumushi)
        function cricket(d, t, lvl) {
            var x = oscN('sine', rnd(4200, 4900)), g = gainN(0), reps = 2 + Math.floor(Math.random() * 3), pulses = 3 + Math.floor(Math.random() * 4), tt = t;
            g.gain.setValueAtTime(0, t);
            for (var r = 0; r < reps; r++) {
                for (var q = 0; q < pulses; q++) { g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(lvl, tt + 0.008); g.gain.linearRampToValueAtTime(0, tt + 0.03); tt += 0.045; }
                tt += rnd(0.25, 0.5);
            }
            x.connect(g); send(g, d, 0.3, 0, rnd(-0.9, 0.9)); x.start(t); x.stop(tt + 0.05);
        }
        function frog(d, t, lvl) {
            var n = 3 + Math.floor(Math.random() * 4), tt = t, base = rnd(110, 170), x = oscN('sawtooth', base), bp = filt('bandpass', rnd(600, 900), 4), g = gainN(0);
            g.gain.setValueAtTime(0, t);
            for (var i = 0; i < n; i++) {
                x.frequency.setValueAtTime(base * 1.1, tt); x.frequency.linearRampToValueAtTime(base * 0.9, tt + 0.08);
                g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(lvl, tt + 0.015); g.gain.linearRampToValueAtTime(0, tt + 0.09);
                tt += rnd(0.18, 0.3);
            }
            x.connect(bp); bp.connect(g); send(g, d, 0.35, 0, rnd(-0.8, 0.8)); x.start(t); x.stop(tt + 0.05);
        }
        function owl(d, t, lvl) {
            var x = oscN('sine', 390), g = gainN(0);
            g.gain.setValueAtTime(0, t);
            [[0, 0.42], [0.95, 0.22], [1.25, 0.5]].forEach(function (n) {
                var tt = t + n[0];
                x.frequency.setValueAtTime(400, tt); x.frequency.linearRampToValueAtTime(360, tt + n[1]);
                g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(lvl, tt + 0.08); g.gain.linearRampToValueAtTime(0, tt + n[1]);
            });
            x.connect(g); send(g, d, 0.7, 0, rnd(-0.7, 0.7)); x.start(t); x.stop(t + 2);
        }
        function drip(d, t, lvl) {
            var f = rnd(900, 2000), x = oscN('sine', f), g = gainN(0);
            x.frequency.setValueAtTime(f * 0.7, t); x.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.05);
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 0.004); g.gain.setTargetAtTime(0, t + 0.01, 0.025);
            x.connect(g); send(g, d, 0.8, 0, rnd(-0.8, 0.8)); x.start(t); x.stop(t + 0.25);
        }
        function knock(d, t, lvl) {
            var f = rnd(420, 700), pan = rnd(-0.7, 0.7);
            wood(d, t, f, lvl, { wet: 0.5, pan: pan, dec: 0.05 });
            if (chance(0.5)) wood(d, t + rnd(0.1, 0.18), f * rnd(0.9, 1.15), lvl * 0.7, { wet: 0.5, pan: pan, dec: 0.05 });
        }
        // Shishi-odoshi: water trickles into the bamboo, then the tock
        function shishi(d, t, lvl) {
            noiseHit(d, t, { type: 'bandpass', f: 2600, q: 2.5, dur: 2.2, att: 1.8, vel: lvl * 0.18, pan: -0.2, wet: 0.3 });
            wood(d, t + 2.3, 380, lvl, { wet: 0.75, pan: -0.2, dec: 0.07 });
            noiseHit(d, t + 2.33, { type: 'bandpass', f: 1400, q: 1, dur: 0.3, vel: lvl * 0.15, pan: -0.25, wet: 0.4 });
        }
        function chimes(d, t, lvl, s, lo, hi, dec, n) {
            var notes = scaleNotes(s, lo, hi), pan = rnd(-0.6, 0.6), tt = t;
            for (var i = 0; i < n; i++) { bell(d, tt, pick(notes), lvl * rnd(0.6, 1), { decay: dec, ratio: 2.4, index: 0.7, wet: 0.5, pan: pan }); tt += rnd(0.06, 0.2); }
        }
        function train(d, t, lvl) {
            var s = noiseN('pink'), bp = filt('bandpass', 280, 0.9), g = gainN(0), du = rnd(6, 9), out = g;
            bp.frequency.setValueAtTime(260, t); bp.frequency.linearRampToValueAtTime(520, t + du * 0.45); bp.frequency.linearRampToValueAtTime(300, t + du);
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + du * 0.45); g.gain.linearRampToValueAtTime(0, t + du);
            s.connect(bp); bp.connect(g);
            if (ctx.createStereoPanner) { out = ctx.createStereoPanner(); out.pan.setValueAtTime(-0.8, t); out.pan.linearRampToValueAtTime(0.8, t + du); g.connect(out); }
            out.connect(d.dry); startNoise(s, t); s.stop(t + du + 0.2);
            for (var tt = t + du * 0.25; tt < t + du * 0.75; tt += 0.42) {
                var a = lvl * 0.35 * (1 - Math.abs((tt - t) / du - 0.5) * 2);
                noiseHit(d, tt, { f: 1800, q: 4, dur: 0.02, vel: a }); noiseHit(d, tt + 0.11, { f: 1700, q: 4, dur: 0.02, vel: a * 0.8 });
            }
        }
        // Raspy insect tone: a carrier chopped by a fast pulse train
        function rasp(x, rate, depth) {
            var am = gainN(1 - depth), lf = oscN('square', rate), lg = gainN(depth);
            lf.connect(lg); lg.connect(am.gain); x.connect(am); return { out: am, lf: lf };
        }
        // Minmin-zemi (summer cicada): "miiin—min-min-min—" swell, pulses, fade
        function minmin(d, t, lvl) {
            var x = oscN('sine', rnd(3800, 4400)), r = rasp(x, rnd(90, 140), 0.6), g = gainN(0), du = rnd(5, 8), tt;
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl * 0.6, t + 1.2);
            for (tt = t + 1.2; tt < t + du - 1; tt += 0.32) { g.gain.linearRampToValueAtTime(lvl, tt + 0.08); g.gain.linearRampToValueAtTime(lvl * 0.35, tt + 0.3); }
            g.gain.linearRampToValueAtTime(0, t + du);
            r.out.connect(g); send(g, d, 0.3, 0, rnd(-0.8, 0.8));
            x.start(t); r.lf.start(t); x.stop(t + du + 0.1); r.lf.stop(t + du + 0.1);
        }
        // Higurashi (evening cicada): "kana-kana-kana…" falling in pitch and strength
        function higurashi(d, t, lvl) {
            var fc = rnd(4300, 4700), x = oscN('sine', fc), r = rasp(x, 160, 0.4), am = gainN(0), g = gainN(lvl), tt = t, n = 22 + Math.floor(Math.random() * 14);
            for (var i = 0; i < n; i++) {
                var a = Math.min(1, (i + 1) / 4) * (1 - i / n * 0.7);
                am.gain.setValueAtTime(0, tt); am.gain.linearRampToValueAtTime(a, tt + 0.012); am.gain.linearRampToValueAtTime(a * 0.25, tt + 0.05); am.gain.linearRampToValueAtTime(0, tt + 0.085);
                x.frequency.setValueAtTime(fc * (1 - i / n * 0.12), tt);
                tt += 0.11;
            }
            r.out.connect(am); am.connect(g); send(g, d, 0.5, 0, rnd(-0.8, 0.8));
            x.start(t); r.lf.start(t); x.stop(tt + 0.1); r.lf.stop(tt + 0.1);
        }
        // Sequence of whistled notes [Hz start, Hz end, s] with short gaps
        function whistle(d, t, lvl, notes, wet, type) {
            var x = oscN(type || 'sine', notes[0][0]), g = gainN(0), lp = filt('lowpass', 5000, 0.5), tt = t;
            g.gain.setValueAtTime(0, t);
            notes.forEach(function (n) {
                x.frequency.setValueAtTime(n[0], tt); x.frequency.exponentialRampToValueAtTime(n[1], tt + n[2]);
                g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(lvl * (n[3] || 1), tt + Math.min(0.03, n[2] * 0.3)); g.gain.setValueAtTime(lvl * (n[3] || 1), tt + n[2] * 0.7); g.gain.linearRampToValueAtTime(0, tt + n[2]);
                tt += n[2] + (n[4] || 0.04);
            });
            x.connect(lp); lp.connect(g); send(g, d, wet, 0, rnd(-0.7, 0.7)); x.start(t); x.stop(tt + 0.05);
        }
        // Hototogisu (lesser cuckoo): "tokkyo kyoka kyoku"
        function hototogisu(d, t, lvl) {
            var s = rnd(0.92, 1.08);
            whistle(d, t, lvl, [[1750 * s, 1900 * s, 0.1], [2500 * s, 2300 * s, 0.16, 1, 0.05], [2150 * s, 2350 * s, 0.09], [2600 * s, 2400 * s, 0.14, 1, 0.05], [2100 * s, 1850 * s, 0.24, 0.9]], 0.55);
        }
        // Kakkō (cuckoo): "kak-ko", a falling third, a few times
        function kakko(d, t, lvl) {
            var s = rnd(0.95, 1.05), seq = [], n = 2 + Math.floor(Math.random() * 3);
            for (var i = 0; i < n; i++) seq.push([760 * s, 740 * s, 0.16, 1, 0.08], [610 * s, 590 * s, 0.32, 0.85, 0.55]);
            whistle(d, t, lvl, seq, 0.7);
        }
        // Kajika frog: a flute-like rising trill by the mountain stream
        function kajika(d, t, lvl) {
            var seq = [], n = 8 + Math.floor(Math.random() * 8), f = rnd(1700, 2000);
            for (var i = 0; i < n; i++) { var fi = f * (1 + i / n * 0.35); seq.push([fi * 0.92, fi * 1.05, 0.05, 0.6 + 0.4 * i / n, 0.035]); }
            whistle(d, t, lvl, seq, 0.45);
        }
        // Karasu (crow): two or three hoarse caws
        function karasu(d, t, lvl) {
            var n = 2 + Math.floor(Math.random() * 2), tt = t, pn = rnd(-0.8, 0.8), f = rnd(520, 620);
            for (var i = 0; i < n; i++) {
                var x = oscN('sawtooth', f), b1 = filt('bandpass', 1250, 1.8), b2 = filt('bandpass', 2500, 2.5), g = gainN(0), du = rnd(0.28, 0.4);
                x.frequency.setValueAtTime(f * 1.05, tt); x.frequency.linearRampToValueAtTime(f * 0.88, tt + du);
                g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(lvl, tt + 0.04); g.gain.setValueAtTime(lvl, tt + du * 0.6); g.gain.linearRampToValueAtTime(0, tt + du);
                x.connect(b1); x.connect(b2); b1.connect(g); b2.connect(g); send(g, d, 0.6, 0, pn);
                x.start(tt); x.stop(tt + du + 0.05); tt += du + rnd(0.25, 0.45);
            }
        }
        // Railway crossing (fumikiri): the alternating "kan-kan" bell
        function fumikiri(d, t, lvl) {
            var du = rnd(5, 8), pn = rnd(-0.6, 0.6);
            for (var tt = t, i = 0; tt < t + du; tt += 0.48, i++) bell(d, tt, i % 2 ? 83 : 84, lvl * (1 - (tt - t) / du * 0.4), { decay: 0.25, ratio: 2.76, index: 1.2, wet: 0.6, pan: pn });
        }
        var EV = {
            minmin: function (d, t) { minmin(d, t, 0.009); },
            higurashi: function (d, t) { higurashi(d, t, 0.014); },
            hototogisu: function (d, t) { hototogisu(d, t, 0.024); },
            kakko: function (d, t) { kakko(d, t, 0.03); },
            kajika: function (d, t) { kajika(d, t, 0.018); },
            karasu: function (d, t) { karasu(d, t, 0.02); },
            fumikiri: function (d, t) { fumikiri(d, t, 0.01); },
            suikin: function (d, t, s) { var nt = scaleNotes(s, 79, 96), pn = rnd(-0.6, 0.6); suikin(d, t, pick(nt), rnd(0.015, 0.03), pn); if (chance(0.4)) suikin(d, t + rnd(0.15, 0.4), pick(nt), 0.012, pn); },
            chirp: function (d, t) { birdCall(d, t, 0.028); },
            uguisu: function (d, t) { uguisu(d, t, 0.03); },
            crane: function (d, t) { crane(d, t, 0.022); },
            cricket: function (d, t) { cricket(d, t, 0.011); },
            frog: function (d, t) { frog(d, t, 0.03); },
            owl: function (d, t) { owl(d, t, 0.03); },
            drip: function (d, t) { drip(d, t, 0.035); },
            knock: function (d, t) { knock(d, t, 0.045); },
            shishi: function (d, t) { shishi(d, t, 0.06); },
            bell: function (d, t, s) { kane(d, t, low(s.k, 43), 0.045, { wet: 0.95, pan: rnd(-0.5, 0.5) }); },
            furin: function (d, t, s) { chimes(d, t, 0.028, s, 86, 98, 1.1, 1 + Math.floor(Math.random() * 3)); },
            tinkle: function (d, t, s) { chimes(d, t, 0.012, s, 96, 108, 0.45, 2 + Math.floor(Math.random() * 4)); },
            train: function (d, t) { train(d, t, 0.07); }
        };

        // ── Flow: adaptive arrangement + beat-quantized, in-key responses ───
        var TONEMUL = [0.62, 0.8, 1, 1.12, 1.45], EVMUL = [0.55, 0.8, 1, 1.15, 1.3];
        var eFix = null, cBase = 0;
        function imm() { return cfg.level === 'off' ? 0 : (IMM[cfg.immersion] || 0); }
        function flowNow() { return flowFix !== null ? flowFix : flow * Math.exp(-Math.max(0, now() - flowT) / 45); }
        function addFlow(x) { if (!ctx) return; flow = clamp(flowNow() + x, 0, 1); flowT = lastIn = now(); }
        // Arrangement density 0..4: calm in thinking pauses, fuller while drawing, bloom after a kanji
        function energy(t0) {
            var m = imm();
            if (!m) return 2;
            if (eFix !== null) return eFix;
            var f = flowNow(), e = f < 0.15 ? 1 : f < 0.5 ? 2 : 3;
            if (flowFix === null && now() - lastIn > 40) e = 0;
            if (t0 < bloomUntil) e = 4;
            return clamp(e, m > 1 ? 0 : 1, m > 1 ? 4 : 3);
        }
        function nextGrid(s, div, t) { var st = s.B / div; return s.nextT + Math.ceil((t - s.nextT) / st - 1e-6) * st; }
        // Bars are scheduled ahead, so look up the chord that actually sounds at t
        function chordAt(s, t) {
            var h = s.hist, e = h.length ? h[0] : null;
            for (var i = h.length - 1; i >= 0; i--) if (h[i].t <= t + 0.01) { e = h[i]; break; }
            if (!e) return chordNotes(s, s.ci);
            return chordOf(e.k, s.scale, e.prog[e.ci % e.prog.length]);
        }
        function chordTones(ch, lo, hi) {
            var pcs = ch.map(pc), r = [];
            for (var m = lo; m <= hi; m++) if (pcs.indexOf(pc(m)) >= 0) r.push(m);
            return r;
        }
        function spot() { return clamp(panOf(lastX) * 1.6, -0.6, 0.6); }
        // Answering voice of the active genre, routed through the scene (same room, tone and fades)
        function answer(s, t, m, k) {
            var d = s.d, g = s.genre, pan = spot(), V = s.V, sv = STR[V[0]] ? V[0] : STR[V[1]] ? V[1] : 'koto';
            if (g === 'piano') piano(d, t, m, 0.26 * k, 0.9, { wet: 0.5, pan: pan });
            else if (g === 'lofi' || g === 'nature' || g === 'zen') pluck(d, t, m, 0.07 * k * VK[sv], { kind: sv === 'koto' ? null : sv, decay: sv === 'koto' || sv === 'biwa' ? 1.5 : 0.85, bright: 7, wet: g === 'nature' ? 0.55 : 0.4, echo: 0.2, pan: pan, pick: true });
            else tone('glass', d, t, m, 0.035 * k, { wet: 0.6, echo: 0.3, pan: pan });
        }
        // The strokes of a kanji trace a melody over the chord tones
        function contourNote(s, t, idx) {
            var r = LEADR[s.genre] || LEADR.ambient, tones = chordTones(chordAt(s, t), r[0], r[1]);
            return tones[clamp(cBase + CONTOUR[(idx || 0) % CONTOUR.length], 0, tones.length - 1)];
        }
        // Mistake: a muted note on the chord root — part of the groove, never a buzzer
        function ghost(s, t) {
            var d = s.d, g = s.genre, r = low(chordAt(s, t)[0], 43);
            if (g === 'piano') piano(d, t, r, 0.13, 0.12, { wet: 0.25 });
            else if (g === 'lofi') bass(d, t, low(r, 36), 0.06, 0.18);
            else if (g === 'zen') pluck(d, t, r + 12, 0.045, { decay: 0.3, bright: 3, q: 1, wet: 0.3 });
            else thock(d, t, r + 12, 0.04);
        }
        function penTick(s, t) {
            var d = s.d, g = s.genre, pan = spot(), r = LEADR[g] || LEADR.ambient;
            if (g === 'lofi') wood(d, t, 1700, 0.02, { dec: 0.015, pan: pan });
            else if (g === 'zen') wood(d, t, 900, 0.025, { dec: 0.03, wet: 0.3, pan: pan });
            else tone('celesta', d, t, pick(chordTones(chordAt(s, t), r[0] + 12, r[1] + 12)), 0.01, { wet: 0.4, pan: pan });
        }
        // Landing on the downbeat after a completed kanji or a theme change
        function accentBar(s, t0) {
            var ch = chordNotes(s, s.ci);
            sub(s.d, t0, low(ch[0], 36), s.barDur * 1.5, 0.05);
            tone('glass', s.d, t0 + 0.01, rootNear(s, 84), 0.024, { wet: 0.8, echo: 0.3 });
            noiseHit(s.d, t0, { type: 'highpass', f: 6500, dur: 1.4, att: 0.01, vel: 0.01, wet: 0.7 });
            if (s.genre === 'lofi') kick(s.d, t0, 0.4);
        }
        // Shimmer layer at high energy: soft chord arpeggio, wide stereo
        function arpLayer(s, t0, E) {
            var B = s.B, g = s.genre, full = E >= 4, tones = chordTones(chordNotes(s, s.ci), g === 'zen' ? 67 : 76, g === 'zen' ? 86 : 96);
            if (tones.length < 3) return;
            var pat = full ? [0, 1, 2, 3, 2, 1, 2, 3] : [0, 2, 1, 3], st = full ? B / 2 : B;
            pat.forEach(function (p, i) {
                var t = t0 + i * st + (g === 'lofi' && i % 2 ? B * 0.07 : 0), m = tones[p % tones.length], pan = i % 2 ? 0.5 : -0.5, v = i % 2 ? 0.7 : 1;
                if (g === 'zen') pluck(s.d, t, m, 0.028 * v, { decay: 1, bright: 6, wet: 0.5, echo: 0.2, pan: pan });
                else if (g === 'piano') piano(s.d, t, m, 0.1 * v, st * 1.5, { wet: 0.55, pan: pan });
                else tone(g === 'lofi' ? 'vibes' : 'celesta', s.d, t, m, (full ? 0.016 : 0.012) * v, { wet: 0.6, echo: 0.35, pan: pan, trem: g === 'lofi' ? 4.6 : 0 });
            });
        }
        // Section start: a soft high glass tone and some air (a small frame drum in zen)
        function secHit(s, t0) {
            if (s.genre === 'zen') {
                // Small taiko or the hyōshigi clappers
                if (chance(0.5)) taiko(s.d, t0, 0.06);
                else { wood(s.d, t0, 2300, 0.045, { wet: 0.4 }); wood(s.d, t0 + 0.09, 2200, 0.035, { wet: 0.4 }); }
                return;
            }
            tone('glass', s.d, t0 + 0.01, rootNear(s, 84), 0.014, { wet: 0.85, echo: 0.3, pan: rnd(-0.4, 0.4) });
            noiseHit(s.d, t0, { type: 'highpass', f: 7000, dur: 1.2, att: 0.01, vel: 0.006, wet: 0.7 });
        }
        function riser(t, dur) {
            noiseHit({ dry: G.music, wet: G.verbIn, echo: null }, t, { kind: 'pink', type: 'bandpass', f: 350, f2: 3200, q: 1.1, dur: dur, att: dur * 0.92, vel: 0.022, wet: 0.5 });
        }

        // ── Music control ───────────────────────────────────────────────
        function musicOn() { return cfg.level !== 'off' && GENRES.hasOwnProperty(cfg.music); }
        function live() { for (var i = scenes.length - 1; i >= 0; i--) if (!scenes[i].ending) return scenes[i]; return null; }
        function loadState() {
            try { var st = JSON.parse(sessionStorage.getItem(SS) || 'null'); if (st) st.recent = Date.now() - (st.ts || 0) < 20000; return st; } catch (e) { return null; }
        }
        function cancelPending() { clearTimeout(pendT); pendT = pendKey = null; }
        function syncMusic(go) {
            if (disposed) return;
            if (!musicOn()) { cancelPending(); fadeOutAll(1.8); return; }
            if (!ensureCtx()) return;
            if (!OFF && ctx.state !== 'running') { if (!D.hidden) { try { ctx.resume(); } catch (e) { } } return; }
            var key = sceneKeyOf(cur.theme, cur.dark, cfg.music), top = live();
            if (top && top.key === key) { cancelPending(); return; }
            // Flipping through cards quickly: follow the theme only once it settles, keep crossfades apart
            if (top && !OFF && go !== true) {
                if (pendKey === key) return;
                clearTimeout(pendT); pendKey = key;
                pendT = setTimeout(function () { pendT = pendKey = null; syncMusic(true); }, Math.max(DWELL, lastSwitch + MINGAP - Date.now()));
                return;
            }
            cancelPending();
            var s = new Scene(cur.theme, cur.dark, cfg.music), t = now() + 0.06, dur, m = imm();
            if (top) {
                lastSwitch = Date.now();
                s.offset = pivotIndex(chordPcs(top), s);
                // Tails of earlier switches make room so at most two scenes overlap
                scenes.forEach(function (x) { if (x.ending && x.endT > t + 1.5) x.fadeOut(t, 1.5, true); });
                if (m) t += 1.2;
                if (top.genre === s.genre) { t = Math.max(t, top.nextT + Math.ceil((t - top.nextT) / top.B) * top.B); dur = 6; }
                else dur = 3.5;
                top.fadeOut(t, dur);
                // Stage change: swell into the new scene's first downbeat
                if (m) { riser(t - 1.2, 1.2); s.accent = true; }
            } else {
                var st = OFF ? null : loadState();
                if (st && st.recent && st.flow != null) { flow = st.flow; flowT = lastIn = now(); }
                if (st && st.recent && st.key === key) { s.offset = (st.idx + 1) % s.prog.length; dur = 1.2; }
                else if (st && st.recent && st.pcs) { s.offset = pivotIndex(st.pcs, s); dur = 2; }
                else dur = 3.5;
            }
            s.start(t, dur);
            scenes.push(s);
            if (scenes.length > 3) scenes[0].fadeOut(now() + 0.01, 0.3, true);
            if (!OFF) { ensureTimer(); tick(); }
        }
        function fadeOutAll(dur) {
            if (!ctx) return;
            var t = now() + 0.02;
            scenes.forEach(function (s) { s.fadeOut(t, dur); });
            if (!OFF) { try { sessionStorage.removeItem(SS); } catch (e) { } }
        }
        function pump(horizon) {
            var tn = now();
            scenes.forEach(function (s) {
                if (!OFF && s.nextT < tn - 0.2) { var k = Math.ceil((tn - s.nextT) / s.barDur); s.bar += k; s.nextT += k * s.barDur; s.forcePad = true; }
                while (s.nextT < horizon && (s.endT === null || s.nextT < s.endT)) { s.scheduleBar(s.bar, s.nextT); s.bar++; s.nextT += s.barDur; }
            });
            if (OFF) return;
            scenes = scenes.filter(function (s) { if (s.endT !== null && tn > s.endT + 7) { s.dispose(); return false; } return true; });
            if (!scenes.length) stopTimer();
        }
        function tick() { if (!ctx || ctx.state !== 'running') return; try { pump(now() + 1.4); } catch (e) { if (W.__kdAudioDebug) console.error(e); } }
        function ensureTimer() { if (!timer) timer = setInterval(tick, 250); }
        function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

        // ── Public operations ───────────────────────────────────────────
        function setParam(p, v, t, tc) { p.cancelScheduledValues(t); p.setTargetAtTime(v, t, tc); }
        function configure(o) {
            o = o || {};
            var genreChange = o.music !== undefined && o.music !== cfg.music;
            cfg = {
                level: LEVEL.hasOwnProperty(o.level) ? o.level : cfg.level,
                music: (o.music === 'off' || GENRES.hasOwnProperty(o.music)) ? o.music : cfg.music,
                musicLevel: MLEVEL.hasOwnProperty(o.musicLevel) ? o.musicLevel : cfg.musicLevel,
                stroke: (o.stroke === 'on' || o.stroke === 'off') ? o.stroke : cfg.stroke,
                fx: (o.fx === 'on' || o.fx === 'off') ? o.fx : cfg.fx,
                immersion: IMM.hasOwnProperty(o.immersion) ? o.immersion : cfg.immersion
            };
            if (ctx && G) { var t = now(); setParam(G.master.gain, LEVEL[cfg.level], t, 0.08); setParam(G.music.gain, MLEVEL[cfg.musicLevel], t, 0.25); }
            if (cfg.stroke === 'off' || cfg.level === 'off') strokeEnd();
            if (cfg.level === 'off') { fadeOutAll(0.4); return; }
            syncMusic(genreChange);
        }
        function setScene(theme, dark) {
            theme = THEMES.hasOwnProperty(theme) ? theme : 'neutral'; dark = !!dark;
            if (theme === cur.theme && dark === cur.dark) return;
            cur = { theme: theme, dark: dark };
            if (OFF) { syncMusic(); return; }
            if (!musicOn() || !ctx) return;
            clearTimeout(sceneT); sceneT = setTimeout(syncMusic, 350);
        }
        function withCtx(fn) {
            if (!ensureCtx()) return;
            if (OFF || ctx.state === 'running') { fn(); return; }
            if (D.hidden) return;
            var asked = Date.now();
            try { var p = ctx.resume(); if (p && p.then) p.then(function () { if (ctx && ctx.state === 'running' && Date.now() - asked < 400) fn(); }, function () { }); } catch (e) { }
        }
        function fxOn() { return cfg.level !== 'off' && cfg.fx === 'on'; }
        function play(fn, delay) { touch(); withCtx(function () { fn(now() + 0.01 + (delay || 0)); }); }
        function cardShown(isBack) {
            touch();
            if (cfg.level === 'off') return;
            if (musicOn()) syncMusic();
            if (!isBack) cBase = Math.floor(Math.random() * 3);
            var s = live();
            if (s && imm()) {
                if (isBack) addFlow(0.05);
                if (fxOn()) play(function (tn) { FX[isBack ? 'cardBack' : 'cardFront'](isBack ? nextGrid(s, 4, tn + 0.02) : tn + 0.05); });
                return;
            }
            if (fxOn()) play(FX[isBack ? 'cardBack' : 'cardFront'], isBack ? 0.02 : 0.05);
        }
        function ks() {
            var top = live(); if (top) return top;
            var th = THEMES[cur.theme] || THEMES.neutral;
            return { k: th.key, scale: th.scale, prog: cur.dark ? th.night : th.day, ci: 0 };
        }
        function fxNotes(lo, hi) { return scaleNotes(ks(), lo, hi); }
        var FX = {
            tap: function (t) { wood(FXD(), t, 1350, 0.035); },
            tick: function (t) { wood(FXD(), t, 1900, 0.022); },
            select: function (t) { tone('celesta', FXD(), t, pick(fxNotes(79, 91)), 0.026, { wet: 0.25 }); wood(FXD(), t, 1500, 0.014); },
            open: function (t) {
                var r = rootNear(ks(), 84);
                swish(FXD(), t, 600, 2200, 0.22, 0.026);
                tone('celesta', FXD(), t + 0.06, r, 0.024, { wet: 0.35 }); tone('glass', FXD(), t + 0.06, r + 7, 0.01, { wet: 0.5 });
            },
            close: function (t) { swish(FXD(), t, 2000, 650, 0.2, 0.024); tone('celesta', FXD(), t + 0.04, rootNear(ks(), 79), 0.018, { wet: 0.3 }); },
            nav: function (t) { var n = fxNotes(76, 96), i = nearestIdx(n, 81); tone('celesta', FXD(), t, n[i], 0.022, { wet: 0.25 }); tone('celesta', FXD(), t + 0.07, n[Math.min(n.length - 1, i + 2)], 0.018, { wet: 0.25 }); },
            back: function (t) { var n = fxNotes(76, 96), i = nearestIdx(n, 86); tone('celesta', FXD(), t, n[i], 0.02, { wet: 0.25 }); tone('celesta', FXD(), t + 0.07, n[Math.max(0, i - 2)], 0.018, { wet: 0.25 }); },
            tab: function (t) { wood(FXD(), t, 1100, 0.03); },
            page: function (t) {
                noiseHit(FXD(), t, { type: 'bandpass', f: 1800, f2: 3800, q: 0.9, dur: 0.12, att: 0.03, vel: 0.03 });
                noiseHit(FXD(), t + 0.09, { type: 'bandpass', f: 3200, f2: 1500, q: 1, dur: 0.16, att: 0.02, vel: 0.022 });
            },
            play: function (t) { pluck(FXD(), t, rootNear(ks(), 79), 0.035, { decay: 1, bright: 7, wet: 0.3, pick: true }); },
            reveal: function (t) {
                var n = fxNotes(76, 96), i0 = nearestIdx(n, 79);
                for (var i = 0; i < 3; i++) tone(i < 2 ? 'celesta' : 'glass', FXD(), t + i * 0.06, n[Math.min(n.length - 1, i0 + i)], 0.026 - i * 0.004, { wet: 0.45 });
            },
            hide: function (t) {
                var n = fxNotes(76, 96), i0 = nearestIdx(n, 84);
                for (var i = 0; i < 2; i++) tone('celesta', FXD(), t + i * 0.07, n[Math.max(0, i0 - i)], 0.018, { wet: 0.35 });
            },
            hint: function (t) { var r = rootNear(ks(), 79); tone('glass', FXD(), t, r + 7, 0.024, { wet: 0.5 }); tone('glass', FXD(), t + 0.14, r, 0.022, { wet: 0.5 }); },
            reset: function (t) {
                noiseHit(FXD(), t, { kind: 'pink', type: 'bandpass', f: 2600, f2: 500, q: 0.9, dur: 0.45, att: 0.05, vel: 0.03, wet: 0.3 });
                pluck(FXD(), t + 0.3, rootNear(ks(), 55), 0.05, { decay: 0.6, bright: 4, wet: 0.3 });
            },
            undo: function (t) { var n = fxNotes(67, 88), i = nearestIdx(n, 79); pluck(FXD(), t, n[i], 0.03, { decay: 0.8, bright: 7, wet: 0.25, pick: true }); pluck(FXD(), t + 0.08, n[Math.max(0, i - 2)], 0.025, { decay: 0.8, bright: 7, wet: 0.25 }); },
            skip: function (t) { swish(FXD(), t, 500, 1900, 0.3, 0.028); tone('glass', FXD(), t + 0.2, rootNear(ks(), 79), 0.02, { wet: 0.45 }); },
            cardFront: function (t) { swish(FXD(), t, 800, 1700, 0.26, 0.05); },
            cardBack: function (t) {
                var r = rootNear(ks(), 76);
                swish(FXD(), t, 500, 2100, 0.34, 0.016);
                tone('glass', FXD(), t + 0.07, r, 0.026, { wet: 0.6, echo: 0.2 });
                tone('celesta', FXD(), t + 0.16, r + 7, 0.016, { wet: 0.5 });
            }
        };
        function strokeResult(ok, idx) {
            if (!fxOn()) return;
            var sc = live();
            if (sc && imm()) {
                addFlow(ok ? 0.08 : 0.02);
                play(function (tn) { var t = nextGrid(sc, 8, tn); if (ok) answer(sc, t, contourNote(sc, t, idx), 1); else ghost(sc, t); });
                return;
            }
            play(function (t) {
                var s = ks();
                if (ok) { var base = rootNear(s, 72), n = scaleNotes(s, base, base + 26); chime(lastStyle, FXD(), t, n[(idx || 0) % n.length], 0.04); }
                else thock(FXD(), t, rootNear(s, 50), 0.05);
            });
        }
        function complete() {
            if (!fxOn()) return;
            var sc = live();
            if (sc && imm()) {
                addFlow(0.25);
                play(function (tn) {
                    // Run in 16ths that lands on the tonic on the next beat, then the arrangement blooms
                    var st = sc.B / 4, land = nextGrid(sc, 1, tn + 4 * st), r = LEADR[sc.genre] || LEADR.ambient;
                    var tonic = rootNear(sc, r[1] - 5), run = chordTones(chordAt(sc, land), tonic - 14, tonic - 1).slice(-4);
                    run.push(tonic);
                    run.forEach(function (m, i) { answer(sc, land - (run.length - 1 - i) * st, m, 0.8 + i * 0.08); });
                    tone('glass', sc.d, land, tonic + 12, 0.018, { wet: 0.8, echo: 0.35 });
                    bloomUntil = sc.nextT + sc.barDur * 2; sc.accent = true;
                });
                return;
            }
            play(function (t) {
                var s = ks(), base = rootNear(s, 72), n = scaleNotes(s, base, base + 26);
                for (var i = 0; i < 6; i++) chime(lastStyle, FXD(), t + i * 0.075, n[Math.min(n.length - 1, i)], 0.034 + i * 0.004);
                tone('glass', FXD(), t + 0.5, base + 24, 0.02, { wet: 0.7, echo: 0.3 });
                pad(FXD(), t + 0.05, voiceChord(chordNotes(s, s.ci), null, 60, 79), 0.9, { type: 'sawtooth', type2: 'sine', cut: 2400, att: 0.3, rel: 1.6, gain: 0.012, det: 5, wet: 0.6 });
            }, 0.12);
        }

        // ── Stroke sounds ───────────────────────────────────────────────
        function panOf(x) { return clamp((x - 54.5) / 54.5, -1, 1) * 0.35; }
        function strokeStart(style, x, y, pressure, ptype) {
            lastStyle = SK.hasOwnProperty(style) ? style : 'standard'; lastX = +x || 54.5;
            var sc = live();
            if (sc && imm()) {
                addFlow(0.03);
                if (imm() > 1 && fxOn()) play(function (tn) { penTick(sc, nextGrid(sc, 4, tn)); });
            }
            if (cfg.level === 'off' || cfg.stroke !== 'on') return;
            touch();
            var tok = ++sTok, st = lastStyle;
            withCtx(function () { if (tok === sTok) buildStroke(st, x, y, pressure, ptype); });
        }
        function buildStroke(style, x, y, pressure, ptype) {
            if (SV) releaseStroke(SV);
            var t = now(), c = SK[style], v = { style: style, c: c, x: x, y: y, ms: clockMs(), sp: 0, upd: 0, m: 0, pen: ptype === 'pen', pr: +pressure || 0, src: [] };
            var amp = gainN(0), out = amp, d = { dry: G.stroke, wet: G.verbIn, echo: null };
            var sc = imm() ? live() : null, ch = sc ? chordAt(sc, t) : null;
            // Neon hum sits on the chord root and rises towards the fifth with speed
            if (ch && style === 'neon') v.root = mtof(low(ch[0], 38));
            var hz0 = v.root || 92;
            v.amp = amp;
            if (ctx.createStereoPanner) { v.pan = ctx.createStereoPanner(); v.pan.pan.value = panOf(x); amp.connect(v.pan); out = v.pan; }
            out.connect(G.stroke);
            function src(kind) { var s = noiseN(kind); startNoise(s, t); v.src.push(s); return s; }
            if (style === 'gel') {
                // Rolling ball: smooth, narrow "ssss" plus a faint glide tone
                var gs = src('pink'), gbp = filt('bandpass', c.f0, 1.3), glp = filt('lowpass', 3600, 0.5), tone = oscN('sine', 1200), tg = gainN(0);
                gs.connect(gbp); gbp.connect(glp); glp.connect(amp); tone.connect(tg); tg.connect(amp); tone.start(t); v.src.push(tone);
                v.f = gbp; v.tg = tg;
                blip(d, t, 2600, 2300, 0.02, 0.01);
            } else if (style === 'ink') {
                // Brush: breathy low band with bristle flutter; soft "dab" on contact
                var is = src('pink'), ilp = filt('lowpass', c.f0, 0.8), ihp = filt('highpass', 180, 0.5), ib = gainN(0.6), am = src('white'), amf = filt('lowpass', 14, 0.5), amg = gainN(20);
                is.connect(ilp); ilp.connect(ihp); ihp.connect(ib); ib.connect(amp); am.connect(amf); amf.connect(amg); amg.connect(ib.gain);
                v.f = ilp;
                thock(d, t, 45, 0.035);
            } else if (style === 'neon') {
                // Electric tube hum that brightens and rises with speed
                var o1 = oscN('sawtooth', hz0), o2 = oscN('sawtooth', hz0 * 1.007), o3 = oscN('sine', hz0 * 2), nlp = filt('lowpass', c.f0, 5), o3g = gainN(0.5);
                o1.connect(nlp); o2.connect(nlp); o3.connect(o3g); o3g.connect(nlp); nlp.connect(amp);
                [o1, o2, o3].forEach(function (o) { o.start(t); v.src.push(o); });
                var cs = src('white'), cbp = filt('bandpass', 5200, 2), cg = gainN(0.02);
                cs.connect(cbp); cbp.connect(cg); cg.connect(amp);
                v.f = nlp; v.o1 = o1; v.o2 = o2; v.o3 = o3;
                var z = oscN('sine', 280), zg = gainN(0);
                z.frequency.setValueAtTime(280, t); z.frequency.exponentialRampToValueAtTime(1500, t + 0.07);
                zg.gain.setValueAtTime(0, t); zg.gain.linearRampToValueAtTime(0.025, t + 0.01); zg.gain.setTargetAtTime(0, t + 0.04, 0.03);
                z.connect(zg); zg.connect(out); z.start(t); z.stop(t + 0.3);
            } else {
                // Soft pencil on smooth paper: warm friction band, slow fine graphite grain (no hiss, no crackle)
                var ps = src('pink'), pbp = filt('bandpass', c.f0, 0.7), plp = filt('lowpass', 4200, 0.5), gr = gainN(0.7), gm = src('pink'), gmf = filt('lowpass', 28, 0.5), gmg = gainN(1.6);
                ps.connect(pbp); pbp.connect(plp); plp.connect(gr); gr.connect(amp); gm.connect(gmf); gmf.connect(gmg); gmg.connect(gr.gain);
                var body = src('brown'), bbp = filt('bandpass', 480, 0.8), bg = gainN(0.5);
                body.connect(bbp); bbp.connect(bg); bg.connect(amp);
                v.f = pbp;
                noiseHit(d, t, { kind: 'pink', type: 'lowpass', f: 1600, q: 0.6, dur: 0.018, att: 0.003, vel: 0.02 });
            }
            if (ch) {
                // Pen resonance: the stroke texture rings in the current chord tones
                var r = RES[style], tones = chordTones(ch, r.lo, r.hi), rb = gainN(r.k * (imm() > 1 ? 1.4 : 1)), rw = gainN(0.7);
                if (tones.length > 3) tones = [tones[0], tones[Math.floor(tones.length / 2)], tones[tones.length - 1]];
                tones.forEach(function (m) { var bp = filt('bandpass', mtof(m), 40); amp.connect(bp); bp.connect(rb); });
                rb.connect(v.pan || G.stroke); rb.connect(rw); rw.connect(G.verbIn);
            }
            amp.gain.setValueAtTime(0, t); amp.gain.setTargetAtTime(c.base, t, 0.02);
            if (!OFF) v.iv = setInterval(function () { if (SV === v && clockMs() - v.ms > 45) { v.sp *= 0.5; applyStroke(v); } }, 40);
            duck(true);
            SV = v;
        }
        function applyStroke(v) {
            var t = now(), c = v.c, m = clamp((v.sp - 4) / 150, 0, 1), loud = Math.pow(m, 0.8);
            var pf = v.pen && v.pr > 0 ? 0.55 + 0.9 * clamp(v.pr, 0, 1) : 1;
            v.m = m;
            v.amp.gain.setTargetAtTime((c.base + c.k * loud) * pf, t, 0.03);
            v.f.frequency.setTargetAtTime(c.f0 + (c.f1 - c.f0) * m, t, 0.05);
            if (v.pan) v.pan.pan.setTargetAtTime(panOf(v.x), t, 0.1);
            if (v.tg) v.tg.gain.setTargetAtTime(0.012 * loud, t, 0.05);
            if (v.o1) { var hz = v.root ? v.root * (1 + 0.5 * m) : 92 + 46 * m; v.o1.frequency.setTargetAtTime(hz, t, 0.06); v.o2.frequency.setTargetAtTime(hz * 1.007, t, 0.06); v.o3.frequency.setTargetAtTime(hz * 2, t, 0.06); }
        }
        function strokeMove(x, y, pressure) {
            var v = SV; if (!v || !ctx) return;
            var ms = clockMs(), dt = Math.max(1, ms - v.ms) / 1000, dist = Math.sqrt((x - v.x) * (x - v.x) + (y - v.y) * (y - v.y));
            v.x = x; v.y = y; v.ms = ms; lastX = x; if (pressure > 0) v.pr = pressure;
            v.sp += (dist / dt - v.sp) * Math.min(1, dt / 0.06);
            if (ms - v.upd < 25) return;
            v.upd = ms; applyStroke(v);
        }
        function releaseStroke(v) {
            clearInterval(v.iv);
            var t = now(), c = v.c, d = { dry: G.stroke, wet: G.verbIn, echo: null };
            v.amp.gain.cancelScheduledValues(t); v.amp.gain.setTargetAtTime(0, t, c.rel);
            if (v.style === 'ink' && v.m > 0.4) noiseHit(d, t, { kind: 'pink', type: 'bandpass', f: 1400, f2: 3800, q: 1.4, dur: 0.14, att: 0.02, vel: 0.05 * v.m, pan: v.pan ? panOf(v.x) : 0 });
            if (v.o1) { var lo = v.root ? v.root / 2 : 55; v.o1.frequency.setTargetAtTime(lo, t, 0.12); v.o2.frequency.setTargetAtTime(lo * 1.007, t, 0.12); v.o3.frequency.setTargetAtTime(lo * 2, t, 0.12); }
            var end = t + c.rel * 8 + 0.05;
            v.src.forEach(function (s) { try { s.stop(end); } catch (e) { } });
            duck(false);
        }
        function strokeEnd() { sTok++; var v = SV; SV = null; if (v && ctx) releaseStroke(v); }
        function duck(on) {
            if (!G || !musicOn()) return;
            var p = G.duck.gain, t = now(), depth = imm() && live() ? 0.8 : 0.62;
            p.cancelScheduledValues(t); p.setTargetAtTime(on ? depth : 1, t + (on ? 0 : 0.25), on ? 0.12 : 0.7);
        }
        function demoStroke(style) {
            if (cfg.level === 'off') return;
            if (cfg.stroke !== 'on') { lastStyle = SK.hasOwnProperty(style) ? style : lastStyle; if (fxOn()) play(FX.select); return; }
            var i = 0;
            strokeStart(style, 20, 40, 0.5, 'mouse');
            var iv = setInterval(function () {
                i++; strokeMove(20 + i * 5, 40 + Math.sin(i / 14 * Math.PI) * 14, 0.5);
                if (i >= 14) { clearInterval(iv); strokeEnd(); }
            }, 30);
        }

        // ── Lifecycle ───────────────────────────────────────────────────
        function onGesture() {
            if (cfg.level === 'off' || disposed) return;
            touch();
            if (!ctx && !musicOn()) return;
            if (!ensureCtx()) return;
            if (ctx.state !== 'running') { try { ctx.resume(); } catch (e) { } }
        }
        function onVis() {
            if (!ctx) return;
            if (D.hidden) { var s = live(); if (s) s.save(); try { ctx.suspend(); } catch (e) { } }
            else if (cfg.level !== 'off' && (musicOn() || SV)) { try { ctx.resume(); } catch (e) { } }
        }
        function onHide() { var s = live(); if (s) s.save(); }
        var GEST = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];
        GEST.forEach(function (n) { D.addEventListener(n, onGesture, true); });
        D.addEventListener('visibilitychange', onVis);
        W.addEventListener('pagehide', onHide);
        // Idle: release the audio device when nothing has played for a while
        idleIv = setInterval(function () {
            if (ctx && ctx.state === 'running' && !scenes.length && !SV && Date.now() - lastAct > 15000) { try { ctx.suspend(); } catch (e) { } }
        }, 5000);
        function dispose() {
            disposed = true; stopTimer(); clearInterval(idleIv); clearTimeout(sceneT); cancelPending();
            GEST.forEach(function (n) { D.removeEventListener(n, onGesture, true); });
            D.removeEventListener('visibilitychange', onVis); W.removeEventListener('pagehide', onHide);
            if (ctx) { try { ctx.close(); } catch (e) { } }
            ctx = null; scenes = [];
            if (W.__kdAudio === api) W.__kdAudio = null;
        }

        // ── Offline render (tests / sound design): deterministic timeline ──
        function offline(o) {
            var OAC = W.OfflineAudioContext || W.webkitOfflineAudioContext, sr = o.sr || 44100;
            var off = new OAC(2, Math.ceil(sr * o.seconds), sr);
            var sv = { ctx: ctx, G: G, NB: NB, PW: PW, scenes: scenes, cfg: cfg, cur: cur, SV: SV, sTok: sTok, lastStyle: lastStyle, fl: [flow, flowT, lastIn, bloomUntil, flowFix, eFix, lastX, cBase] };
            try {
                OFF = true; ctx = off; scenes = []; SV = null;
                cfg = { level: o.level || 'mid', music: o.music || 'off', musicLevel: o.musicLevel || 'mid', stroke: o.stroke || 'on', fx: o.fx || 'on', immersion: o.immersion || 'off' };
                flow = 0; flowT = 0; lastIn = -1e9; bloomUntil = o.bloom ? 1e9 : 0; lastX = 54.5; cBase = 0;
                flowFix = o.flow != null ? o.flow : null; eFix = o.E != null ? o.E : null; NOEV = !!o.noEvents;
                cur = { theme: o.theme || 'neutral', dark: !!o.dark };
                setup(off);
                if (o.muteMusic) G.music.gain.value = 0;
                TO = 0; syncMusic();
                (o.events || []).slice().sort(function (a, b) { return a.at - b.at; }).forEach(function (ev) {
                    TO = ev.at; pump(ev.at + 1.4);
                    api[ev.fn].apply(null, ev.args || []);
                });
                TO = o.seconds; pump(o.seconds);
            } finally {
                OFF = false; TO = null;
                ctx = sv.ctx; G = sv.G; NB = sv.NB; PW = sv.PW; scenes = sv.scenes; cfg = sv.cfg; cur = sv.cur; SV = sv.SV; sTok = sv.sTok; lastStyle = sv.lastStyle;
                flow = sv.fl[0]; flowT = sv.fl[1]; lastIn = sv.fl[2]; bloomUntil = sv.fl[3]; flowFix = sv.fl[4]; eFix = sv.fl[5]; lastX = sv.fl[6]; cBase = sv.fl[7]; NOEV = false;
            }
            return off.startRendering();
        }

        function safe(fn) {
            return function () {
                try { return fn.apply(null, arguments); } catch (e) { if (OFF) throw e; if (W.__kdAudioDebug) console.error(e); }
            };
        }
        var api = {
            version: VERSION,
            configure: safe(configure),
            setScene: safe(setScene),
            cardShown: safe(cardShown),
            strokeStart: safe(strokeStart),
            strokeMove: safe(strokeMove),
            strokeEnd: safe(strokeEnd),
            strokeResult: safe(strokeResult),
            complete: safe(complete),
            fx: safe(function (name, delay) { if (fxOn() && FX.hasOwnProperty(name)) play(FX[name], delay); }),
            demoStroke: safe(demoStroke),
            state: function () {
                return { ctx: ctx ? ctx.state : 'none', scenes: scenes.map(function (s) { return s.key + (s.ending ? ' (fading)' : '') + ' E' + s.E + ' ' + (s.sec || ''); }), cfg: JSON.parse(JSON.stringify(cfg)), theme: cur.theme, dark: cur.dark, flow: Math.round(flowNow() * 100) / 100 };
            },
            dispose: dispose,
            _offline: offline,
            _t: { THEMES: THEMES, GENRES: GENRES, NAT: NAT, CH: CH, SK: SK, FX: FX, EV: EV, chordPcs: chordPcs, pivotIndex: pivotIndex, scaleNotes: scaleNotes, voiceChord: voiceChord, rootNear: rootNear, renderPiano: renderPiano, renderString: renderString }
        };
        W.__kdAudio = api;
    })();
