    /* ═══════════════════════════════════════════════════════════════════
       KanjiDraw Audio — prozedurale Klangwelt (Web Audio API, keine Dateien)
       · Musik aus einem Repertoire echter Lieder: gemeinfreie japanische
         Klassiker (Sakura Sakura, Kōjō no Tsuki, Tōryanse, Furusato,
         Nanatsu no Ko) und eigene Stücke in Ryukyu-, Min'yō-, In- und
         Yo-Tonleiter. Jedes Lied läuft in einer Form aus Vorspiel, Strophen
         mit wechselnder Behandlung (verziert, Heterophonie, Ruf und
         Antwort, Fragment), Zwischenspiel, Nachspiel und Ma (Stille)
       · Die Landschaft färbt nur: Instrumentenpaar (ab dem nächsten
         Abschnitt), Raum, Helligkeit, Naturkulisse und Schlagwerk gleiten
         über; Lied, Tonart und Tempo bleiben — schnelles Durchblättern von
         Karten ändert die Musik nur dezent
       · Jo-Ha-Kyū und Lernfluss (nach dem Vorbild von Tetris Effect): fertige
         Kanji steigern das Arrangement, Denkpausen lichten es aus; Treffer
         antworten im Takt und in der Tonart, schnelle Striche werden
         zusammengefasst
       · Strichgeräusche je Strichstil, dezente UI-Effekte, Naturkulisse
       Singleton window.__kdAudio überlebt Kartenwechsel (Anki Desktop und
       AnkiMobile ersetzen nur #qa); bei Seiten-Reloads (AnkiDroid) setzt das
       Lied über sessionStorage an derselben Stelle fort.
       [SHARED c1-front/c2-front — beide Kopien identisch halten]
       ═══════════════════════════════════════════════════════════════════ */
    (function () {
        'use strict';
        var VERSION = '1.0.0';
        var W = window, D = document;
        var prior = W.__kdAudio;
        if (prior && prior.version === VERSION) return;
        if (prior && typeof prior.dispose === 'function') { try { prior.dispose(); } catch (e) { } }
        var AC = W.AudioContext || W.webkitAudioContext;
        if (!AC) { W.__kdAudio = null; return; }

        // ── Tables ──────────────────────────────────────────────────────
        var LEVEL = { off: 0, low: 0.4, mid: 0.7, high: 1 };
        var MLEVEL = { low: 0.45, mid: 0.7, high: 1 };
        // A landscape only colours the music: key, scale and tempo belong to the song
        var THEMES = {
            neutral: { bright: 1, sig: 'koto' }, warm: { bright: 0.95, sig: 'shamisen' }, cool: { bright: 0.9, sig: 'suikin' },
            sepia: { bright: 0.85, sig: 'biwa' }, rose: { bright: 1.05, sig: 'furin' }, sage: { bright: 0.95, sig: 'mokugyo' },
            hokkaido: { bright: 1.15, sig: 'taiko' }, tokyo: { bright: 0.9, sig: 'hyoshigi' }, okinawa: { bright: 1.05, sig: 'paranku' }
        };
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
        var K = { wind: 0.9, leaves: 0.06, water: 0.6, waves: 0.75, foam: 0.05, rain: 0.17, city: 1 };
        // tm = tempo factor on the song's own tempo
        var GENRES = {
            ambient: { tm: 0.8, tone: 9000, nat: 0.55, gain: 2.2, bar: ambientBar },
            zen: { tm: 0.85, tone: 11000, nat: 0.6, gain: 3.6, bar: zenBar },
            piano: { tm: 1, tone: 9000, nat: 0.35, gain: 0.9, bar: pianoBar },
            lofi: { tm: 1.08, tone: 3600, nat: 0.45, gain: 1.2, bar: lofiBar, start: lofiStart },
            nature: { tm: 1, tone: 16000, nat: 1.5, gain: 1.2, bar: function () { } }
        };
        // Stroke voices: base hum, speed gain, filter range, release
        var SK = {
            standard: { base: 0, k: 0.5, f0: 1300, f1: 2500, rel: 0.035 },
            gel: { base: 0, k: 0.5, f0: 1300, f1: 2400, rel: 0.04 },
            ink: { base: 0, k: 0.48, f0: 650, f1: 2100, rel: 0.06 },
            neon: { base: 0.01, k: 0.05, f0: 380, f1: 2600, rel: 0.09 }
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
        // Melodic contour over the strokes of a kanji (indices into the scale tones of the register)
        var CONTOUR = [0, 1, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 3, 4, 2, 3];
        // Register of the answering voice per genre
        var LEADR = { ambient: [72, 93], zen: [62, 86], piano: [67, 88], lofi: [62, 84], nature: [74, 96] };
        // Instrument pair per landscape (lead, partner); each change of landscape picks one (the first is the most likely)
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
        // Velocity scale per instrument, loudness-matched: sustained flutes need far less than decaying strings, the piano sample much more
        var VK = { koto: 1.5, shamisen: 1.25, biwa: 1.35, sanshin: 1.4, shaku: 0.5, fue: 0.38, piano: 3.6 };
        var STR = { koto: 1, shamisen: 1, biwa: 1, sanshin: 1 };
        // Pen resonance: register and makeup gain per stroke style
        var RES = { standard: { lo: 76, hi: 91, k: 1.1 }, gel: { lo: 79, hi: 93, k: 1.3 }, ink: { lo: 69, hi: 84, k: 1 }, neon: { lo: 74, hi: 89, k: 0.8 } };
        // Jo-ha-kyū: kanji completed per cycle and stage boundaries; a new landscape takes effect once it has settled
        var CYCLE = 8, STAGE_AT = [2, 6], SETTLE = 2500;

        // ── Repertoire ──────────────────────────────────────────────────
        // mel: bars split by '|', notes 'semitones above the tonic:beats' ('r' = rest); ch: chord per bar ('5m' = minor
        // chord on the 4th degree, 'q' = sus4/open quartal colour), two chords split the bar. Public-domain melodies were
        // transcribed from free scores (pianojuku.info, lalarieze.blogspot.com, co0-sky.com); th = landscapes it suits.
        var CHT = { M: [0, 4, 7], m: [0, 3, 7], q: [0, 5, 7] };
        var SONGS = [
            {
                id: 'sakura', t: 'Sakura Sakura', src: 'traditionell (Edo-Zeit)', key: 4, bpm: 66, beats: 4, scale: [0, 1, 5, 7, 8], th: ['rose', 'neutral', 'cool'], night: 0.5,
                mel: '5:1 5:1 7:2|5:1 5:1 7:2|5:1 7:1 8:1 7:1|5:1 7:.5 5:.5 1:2|0:1 -4:1 0:1 1:1|0:1 0:.5 -4:.5 -5:2|5:1 7:1 8:1 7:1|5:1 7:.5 5:.5 1:2|0:1 -4:1 0:1 1:1|0:1 0:.5 -4:.5 -5:2|5:1 5:1 7:2|5:1 5:1 7:2|0:1 1:1 7:.5 5:.5 1:1|0:4',
                ch: '5m|5m|5m|1M|8M|0q|5m|1M|8M|0q|5m|5m|1M|0q'
            },
            {
                id: 'kojo', t: 'Kōjō no Tsuki', src: 'Rentarō Taki, 1901', key: 11, bpm: 60, beats: 4, scale: [0, 2, 3, 7, 8], th: ['sepia', 'hokkaido', 'neutral'], night: 0.85,
                mel: '-5:.5 -5:.5 0:.5 2:.5 3:.5 2:.5 0:1|-4:.5 -4:.5 -5:.5 -6:.5 -5:1 r:1|-5:.5 -5:.5 0:.5 2:.5 3:.5 2:.5 0:1|-4:.5 -7:.5 -5:.75 -5:.25 -12:1 r:1|-9:.5 -9:.5 -10:.5 -12:.5 -4:.75 -4:.25 -5:1|-7:.5 -5:.5 -4:.75 -4:.25 -5:1 r:1|-5:.5 -5:.5 0:.5 2:.5 3:.5 2:.5 0:1|-4:.5 -7:.5 -5:.75 -5:.25 -12:1 r:1',
                ch: '0m|5m 7M|0m|5m 0m|8M 5m|5m 7M|0m|5m 0m'
            },
            {
                id: 'toryanse', t: 'Tōryanse', src: 'Warabe-uta (Edo-Zeit)', key: 9, bpm: 76, beats: 4, scale: [0, 1, 5, 7, 8], th: ['tokyo', 'sepia', 'neutral'], night: 0.6,
                mel: '0:2 0:1 -2:1|0:1 0:.5 -2:.5 -5:1 r:1|1:1 1:.5 1:.5 5:1 1:.5 0:.5|1:.5 0:.5 -2:.5 -2:.5 0:1 r:1|1:1 1:1.5 5:.5 1:.5 0:.5|1:.5 0:.5 -2:.5 -2:.5 0:1 r:1|-4:1.5 -4:.5 0:1 -4:.5 -5:.5|-4:.5 -5:.5 -7:.5 -7:.5 -5:1 r:1|-4:.5 -4:1 -4:.5 0:.5 0:.5 -4:.5 -5:.5|-4:.5 -5:.5 -7:.5 -7:.5 -5:1 r:1|1:.5 1:.5 1:.5 1:.5 5:.5 5:.5 1:.5 0:.5|1:.5 0:.5 -2:.5 -2:.5 0:1 r:1|-4:.5 -4:.5 -4:.5 -4:.5 -4:.5 0:.5 -4:.5 -5:.5|-4:.5 -5:.5 -7:.5 -7:.5 -5:1 r:1|r:.5 0:.5 0:.5 0:.5 0:.5 0:.5 0:.5 -2:.5|0:.5 0:.5 0:.5 -2:.5 -7:.5 -7:.5 -5:1|r:.5 -7:.5 -5:.5 -4:.5 -2:.5 0:.5 1:.5 0:.5|1:1 5:1 7:.5 5:.5 1:1|0:1 0:.5 -2:.5 0:2',
                ch: '0q|0q|1M|0q|1M|0q|-4M|0q|-4M|0q|1M|0q|-4M|0q|0q|5m|0q|1M|0q'
            },
            {
                id: 'furusato', t: 'Furusato', src: 'Teiichi Okano, 1914', key: 5, bpm: 84, beats: 3, scale: [0, 2, 4, 7, 9], th: ['sage', 'warm', 'hokkaido'], night: 0.3,
                mel: '0:1 0:1 0:1|2:1.5 4:.5 2:1|4:1 4:1 5:1|7:2 r:1|5:1 7:1 9:1|4:1.5 5:.5 4:1|2:1 2:1 -1:1|0:2 r:1|2:.5 0:.5 2:1 -5:1|0:.5 2:.5 4:1 4:1|5:.5 4:.5 5:1.5 9:.5|7:.5 5:.5 4:1 r:1|7:1 7:1 7:1|0:1.5 2:.5 4:1|5:1 5:1 2:1|0:2 r:1',
                ch: '0M|7M|0M|0M|5M|0M|7M|0M|7M|0M|5M|0M|0M|9m|5M 7M|0M'
            },
            {
                id: 'nanatsu', t: 'Nanatsu no Ko', src: 'Nagayo Motoori, 1921', key: 0, bpm: 84, beats: 4, scale: [0, 2, 4, 7, 9], th: ['warm', 'sage', 'sepia'], night: 0.55,
                mel: '4:1 2:.5 0:.5 2:2|4:.5 0:.5 -3:.5 0:.5 -5:2|-3:.5 -5:.5 -8:.5 -5:.5 -3:1 0:1|2:3 r:1|4:1.5 5:.5 7:1 4:1|7:1 9:.5 7:.5 4:1 0:1|2:.5 2:.5 4:.5 0:.5 -3:1 -5:1|0:3 r:1|2:1.5 2:.5 2:2|2:1.5 2:.5 2:1 4:1|5:1 4:1 2:1 2:1|2:1 4:1 -3:2|-5:1.5 -5:.5 -5:2|0:1.5 0:.5 0:1 2:1|4:1 5:1 -3:1 0:1|2:3 r:1|4:1 2:.5 0:.5 2:2|4:.5 0:.5 -3:.5 0:.5 -5:2|-3:.5 -5:.5 -8:.5 -5:.5 -3:1 0:1|2:3 r:1|4:1.5 5:.5 7:1 4:1|7:1 9:.5 7:.5 4:1 0:1|2:.5 2:.5 4:.5 0:.5 -3:1 -5:1|0:3 r:1',
                ch: '0M|0M|9m 5M|7M|0M|0M|2m 7M|0M|7M|7M|2m|9m|7M|0M|0M 2M|7M|0M|0M|9m 5M|7M|0M|0M|2m 7M|0M'
            },
            {
                id: 'nirai', t: 'Nirai no Kaze', src: 'eigenes Stück (Ryukyu-Tonleiter)', key: 7, bpm: 92, beats: 4, scale: [0, 4, 5, 7, 11], th: ['okinawa', 'warm', 'rose'], night: 0.3,
                mel: '0:1 4:1 5:1 7:1|11:1 12:1 11:.5 7:.5 7:1|5:.5 7:.5 5:.5 4:.5 0:1 4:1|5:3 r:1|7:1 7:.5 11:.5 12:1 11:1|7:.5 5:.5 4:.5 5:.5 7:2|4:.5 5:.5 4:.5 0:.5 -1:1 0:1|0:3 r:1|12:1.5 11:.5 12:1 16:1|17:.5 16:.5 12:.5 11:.5 12:2|7:1 11:1 12:.5 11:.5 7:1|5:3 r:1|4:1 5:.5 7:.5 11:1 7:1|5:.5 4:.5 0:.5 4:.5 5:2|4:.5 5:.5 7:.5 5:.5 4:1 -1:1|0:3 r:1',
                ch: '0M|4m|5M|5M|7M|0M|0M|0M|0M|5M|4m|5M|0M|5M|7M|0M'
            },
            {
                id: 'yuki', t: 'Yuki no Michi', src: "eigenes Stück (Min'yō-Tonleiter)", key: 9, bpm: 72, beats: 4, scale: [0, 3, 5, 7, 10], th: ['hokkaido', 'cool', 'sepia'], night: 0.5,
                mel: '7:1 10:.5 7:.5 5:1 3:1|5:.5 7:.5 5:.5 3:.5 0:2|3:1 5:1 7:1.5 10:.5|12:2 10:1 7:1|10:.5 12:.5 10:.5 7:.5 5:1 7:1|3:.5 5:.5 3:.5 0:.5 -2:1 0:1|3:1.5 5:.5 3:1 -2:1|0:3 r:1',
                ch: '0m|0m|3M|0m|7m|5m|10M|0m'
            },
            {
                id: 'tsuki', t: 'Tsuki no Michi', src: 'eigenes Stück (In-Tonleiter)', key: 6, bpm: 58, beats: 4, scale: [0, 1, 5, 7, 8], th: ['cool', 'neutral', 'rose', 'sage'], night: 0.95,
                mel: '0:1 1:1 5:2|7:1 8:.5 7:.5 5:2|8:1 12:1 8:.5 7:.5 5:1|7:3 r:1|12:1.5 13:.5 12:1 8:1|7:.5 8:.5 7:.5 5:.5 1:2|0:1 1:.5 0:.5 -4:1 -5:1|0:3 r:1',
                ch: '0q|5m|8M|0q|8M|1M|5m|0q'
            },
            {
                id: 'hinata', t: 'Hinata', src: 'eigenes Stück (Yo-Tonleiter)', key: 2, bpm: 80, beats: 4, scale: [0, 2, 5, 7, 9], th: ['warm', 'sage', 'tokyo', 'okinawa'], night: 0.15,
                mel: '0:.5 2:.5 5:1 7:1 5:.5 2:.5|0:1 2:1 0:2|7:.5 9:.5 12:1 9:1 7:.5 5:.5|7:3 r:1|9:1 12:.5 9:.5 7:1 5:1|7:.5 5:.5 2:.5 0:.5 2:2|5:.5 7:.5 5:.5 2:.5 0:1 -3:1|0:3 r:1',
                ch: '0q|5M|9m|7q|9m|2m|5M|0q'
            }
        ];
        var SONG_BY = {};
        function parseSong(s) {
            var chs = s.ch.split('|'), lo = 99, hi = -99;
            s.bars = s.mel.split('|').map(function (b, i) {
                var t = 0, notes = [];
                b.trim().split(/\s+/).forEach(function (tok) {
                    var a = tok.split(':'), d = +a[1];
                    if (a[0] !== 'r') { var p = +a[0]; notes.push({ b: t, p: p, d: d }); if (p < lo) lo = p; if (p > hi) hi = p; }
                    t += d;
                });
                var segs = (chs[i] || chs[chs.length - 1]).trim().split(/\s+/), L = s.beats / segs.length;
                return {
                    notes: notes, len: t, ch: segs.map(function (c, j) {
                        var m = /^(-?\d+)([a-zA-Z])$/.exec(c) || [0, '0', 'M'];
                        return { r: +m[1], q: CHT[m[2]] ? m[2] : 'M', b0: j * L, len: L };
                    })
                };
            });
            s.nb = s.bars.length; s.lo = lo; s.hi = hi; s.chn = chs.length;
            SONG_BY[s.id] = s;
        }
        SONGS.forEach(parseSong);
        // Transcription check for the selftest: every bar must fill the meter, one chord entry per bar
        function songErrors() {
            var e = [];
            SONGS.forEach(function (s) {
                s.bars.forEach(function (b, i) { if (Math.abs(b.len - s.beats) > 1e-6) e.push(s.id + ' bar ' + (i + 1) + ' = ' + b.len); });
                if (s.chn !== s.nb) e.push(s.id + ' chords ' + s.chn + ' / bars ' + s.nb);
            });
            return e;
        }

        // ── State ───────────────────────────────────────────────────────
        var cfg = { level: 'off', music: 'off', musicLevel: 'mid', stroke: 'on', fx: 'on', immersion: 'low' };
        var cur = { theme: 'neutral', dark: false };
        var ctx = null, G = null, NB = null, PW = null;
        var players = [], timer = null, idleIv = null, disposed = false;
        var OFF = false, TO = null, lastAct = 0, SV = null, sTok = 0, lastStyle = 'standard', lastX = 54.5;
        var flow = 0, flowT = 0, lastIn = -1e9, bloomUntil = 0, calmUntil = 0, flowFix = null, eFix = null, sFix = null, NOEV = false, cBase = 0;
        var PROG = { done: 0, t: 0 }; // kanji completed in the current jo-ha-kyū cycle
        var AQ = { t: -1 }, RATE = { n: 0, t: 0 }, lastTick = -1e9, NV = 0, SFORCE = null;
        var SS = 'kdAudioState';

        function now() { return TO !== null ? TO : (ctx ? ctx.currentTime : 0); }
        function clockMs() { return TO !== null ? TO * 1000 : (W.performance && performance.now ? performance.now() : Date.now()); }
        function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
        function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
        function ftom(f) { return 69 + 12 * Math.log(f / 440) / Math.LN2; }
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
            wood: { dur: 0.35, ref: 84, click: 0.25, parts: [[1, 1, 0.09], [2.42, 0.5, 0.05], [4.07, 0.22, 0.03], [6.7, 0.08, 0.02]] },
            // Taiko: skin mode plus body resonance, short
            taiko: { dur: 1.2, ref: 45, sr: 11025, click: 0.5, att: 0.002, parts: [[1, 1, 0.55], [1.59, 0.45, 0.25], [2.14, 0.25, 0.15], [2.9, 0.12, 0.08]] }
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
        // Plays a rendered tuned-percussion note; optional damping (dur), tremolo (trem Hz) or auto-pan (autopan Hz)
        function tone(kind, dst, t, m, vel, o) {
            o = o || {}; var z = zoneOf(m), b = sampleBuf(kind, z), r = Math.pow(2, (m - z) / 12), len = b.duration / r;
            var s = ctx.createBufferSource(), lp = filt('lowpass', Math.min(16000, mtof(m) * (o.bright || 12)), 0.5), g = gainN(vel), out = g;
            s.buffer = b; s.playbackRate.value = r; NV++;
            if (o.dur && o.dur < len) { g.gain.setValueAtTime(vel, t + o.dur); g.gain.setTargetAtTime(0, t + o.dur, 0.1); len = o.dur + 0.6; }
            s.connect(lp); lp.connect(g);
            if (o.trem) { var tl = oscN('sine', o.trem), tg = gainN(0.3), tm = gainN(0.7); tl.connect(tg); tg.connect(tm.gain); g.connect(tm); out = tm; tl.start(t); tl.stop(t + len); }
            if (o.autopan && ctx.createStereoPanner) { var ap = ctx.createStereoPanner(), al = oscN('sine', o.autopan), ag = gainN(0.45); al.connect(ag); ag.connect(ap.pan); out.connect(ap); out = ap; al.start(t); al.stop(t + len); }
            send(out, dst, o.wet || 0, o.echo || 0, o.autopan ? 0 : o.pan || 0);
            s.start(t); s.stop(t + len);
        }
        // Plucked strings (Karplus-Strong with fractional-delay tuning): koto, shamisen, biwa, sanshin, upright bass
        function renderString(sr, m, kind) {
            var f = mtof(m), K2 = kind === 'sanshin' ? { dur: 1.6, t60: 1.1, S: 0.32, ex: 0.85, pk: 0.13 }
                : kind === 'shamisen' ? { dur: 1.6, t60: 0.9, S: 0.2, ex: 0.95, pk: 0.07, buzz: 2.5 }
                    : kind === 'biwa' ? { dur: 2.6, t60: 1.8, S: 0.25, ex: 0.8, pk: 0.09, buzz: 3.5 }
                        : kind === 'bass' ? { dur: 2.2, t60: 2.4, S: 0.5, ex: 0.22, pk: 0.25 }
                            : { dur: 3.2, t60: clamp(3.8 - (m - 55) * 0.05, 1.2, 3.8), S: 0.45, ex: 0.68, pk: 0.13 };
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
            // Shamisen/biwa: sawari buzz (odd-harmonic waveshaping) and the hard bachi strike
            if (K2.buzz) {
                var pk2 = 0;
                for (i = 0; i < n; i++) if (Math.abs(d[i]) > pk2) pk2 = Math.abs(d[i]);
                for (i = 0; i < n; i++) { var y2 = d[i] / (pk2 || 1); d[i] = y2 + K2.buzz * y2 * y2 * y2 * 0.4; }
                var bn = Math.floor(sr * 0.005);
                for (i = 0; i < bn; i++) d[i] += (Math.random() * 2 - 1) * 0.5 * (1 - i / bn);
            }
            return finish(d, sr, 0.001, 0.15);
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
            var kind = o.kind || 'koto', z = zoneOf(m), b = sampleBuf(kind, z), r = Math.pow(2, (m - z) / 12), f = mtof(m), dec = o.decay || 1.4;
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
            o = o || {}; var z = zoneOf(m), b = sampleBuf('piano', z), r = Math.pow(2, (m - z) / 12), f = mtof(m), A = vel * 0.92, rt = t + Math.max(0.15, dur), rel = o.ped ? 0.7 : 0.16, end = Math.min(t + b.duration / r, rt + rel * 5);
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
            var z = zoneOf(m), b = sampleBuf('bass', z), r = Math.pow(2, (m - z) / 12), rt = t + dur, end = Math.min(t + b.duration / r, rt + 0.4);
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
            else if (style === 'neon') pluck(dst, t, m, vel * 0.8, { synth: true, wave: 'square', decay: 0.5, bright: 12, q: 5, wet: 0.25, echo: 0.4 });
            else marimba(dst, t, m, vel * 1.2);
        }

        // ── Harmony helpers ─────────────────────────────────────────────
        function tonesIn(pcs, lo, hi) { var r = []; for (var m = lo; m <= hi; m++) if (pcs.indexOf(pc(m)) >= 0) r.push(m); return r; }
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
        function voiceOf(seg, prev, lo, hi) { return voiceChord(seg.pcs.map(function (x) { return 60 + x; }), prev, lo, hi); }
        // Neighbouring scale tone above (dir 1) or below (dir -1), within the song's mode
        function neighbor(p, m, dir) {
            for (var i = 1; i <= 4; i++) if (p.scale.indexOf(pc(m + dir * i - p.k)) >= 0) return m + dir * i;
            return m + dir * 2;
        }
        // Bars are scheduled ahead, so look up the chord that actually sounds at t
        function chordAt(p, t) {
            var h = p.hist;
            for (var i = h.length - 1; i >= 0; i--) {
                if (h[i].t > t + 0.01) continue;
                var sg = h[i].segs;
                for (var j = sg.length - 1; j >= 0; j--) if (sg[j].t <= t + 0.01) return sg[j];
                return sg[0];
            }
            return h.length ? h[0].segs[0] : { root: p.k, pcs: [p.k, pc(p.k + 7)] };
        }
        function ctones(p, t, lo, hi) { return tonesIn(chordAt(p, t).pcs, lo, hi); }

        // ── Player (one per genre) ──────────────────────────────────────
        function pickV(theme) { var vo = VOPT[theme] || VOPT.neutral; return chance(0.4) ? vo[0] : pick(vo); }
        function pickSong(p) {
            var w = SONGS.map(function (s) {
                var x = s.th.indexOf(p.th) >= 0 ? 3 : 1;
                x *= p.dark ? 0.4 + s.night : 1.4 - s.night;
                return p.recent.indexOf(s.id) >= 0 ? x * 0.04 : x;
            }), sum = 0, i;
            for (i = 0; i < w.length; i++) sum += w[i];
            var r = Math.random() * sum;
            for (i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return SONGS[i]; }
            return SONGS[0];
        }
        // Rendition of a song: intro, verses with changing treatment, interlude, outro, a bar of silence.
        // Treatments: plain, orn (ornamented), het (heterophony: partner shadows the line), call (phrases alternate
        // between the pair), hi (partner sings, an octave up on koto/piano), frag (only every other bar — ma)
        function buildPlan(s, genre) {
            var vd = s.nb * s.beats * 60 / s.bpm, amb = genre === 'ambient', trs = amb ? ['frag', 'het', 'call'] : ['orn', 'het', 'call', 'hi'];
            for (var i = trs.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = trs[i]; trs[i] = trs[j]; trs[j] = x; }
            var pl = [{ k: 'in', n: 2 }, { k: 'v', n: s.nb, tr: amb ? 'frag' : 'plain' }];
            if (vd < 45) pl.push({ k: 'v', n: s.nb, tr: trs[0] }, { k: 'br', n: 4 }, { k: 'v', n: s.nb, tr: trs[1] });
            else pl.push({ k: 'br', n: 4 }, { k: 'v', n: s.nb, tr: trs[0] });
            pl.push({ k: 'out', n: 2 }, { k: 'ma', n: 1 });
            return pl;
        }
        function Player(genre) {
            var gn = GENRES[genre] || GENRES.ambient, th = THEMES[cur.theme] || THEMES.neutral, sp = SPACE[cur.theme] || SPACE.neutral;
            this.genre = genre; this.gn = gn; this.th = cur.theme; this.dark = cur.dark;
            this.bar = 0; this.nextT = 0; this.endT = null; this.ending = false; this.fv = null; this.cont = []; this.N = [];
            this.hist = []; this.E = null; this.st = stageNow(); this.hit = null; this.accent = false; this.want = null; this.recent = [];
            this.plan = []; this.si = 0; this.sb = 0; this.needSong = true; this.prevVoice = null;
            this.V = pickV(this.th); this.sig = th.sig; this.pendV = null; this.pendSig = null;
            this.bright = th.bright * (this.dark ? 0.72 : 1); this.dyn = this.dark ? 0.85 : 1;
            this.dry = gainN(gn.gain); this.nat = gainN(gn.nat); this.wet = gainN(sp.verb); this.mwet = gainN(gn.gain); this.nwet = gainN(gn.nat); this.echo = gainN(sp.echo * gn.gain);
            this.toneF = Math.min(18000, gn.tone * this.bright);
            this.tone = filt('lowpass', this.toneF, 0.5); this.damp = filt('lowpass', sp.damp, 0.5);
            this.fd = gainN(0); this.fw = gainN(0); this.fe = gainN(0);
            this.dry.connect(this.tone); this.nat.connect(this.tone); this.tone.connect(this.fd); this.fd.connect(G.music);
            this.mwet.connect(this.wet); this.nwet.connect(this.wet); this.wet.connect(this.damp); this.damp.connect(this.fw); this.fw.connect(G.verbIn);
            this.echo.connect(this.fe); this.fe.connect(G.echoIn);
            this.d = { dry: this.dry, wet: this.mwet, echo: this.echo };
        }
        Player.prototype.valAt = function (t) {
            var f = this.fv; if (!f) return 0;
            if (t <= f.t) return f.a; if (t >= f.t + f.d) return f.b;
            var x = (t - f.t) / f.d;
            return f.a + (f.b - f.a) * (f.b > f.a ? Math.sin(x * Math.PI / 2) : 1 - Math.cos(x * Math.PI / 2));
        };
        // Equal-power fade on all three faders (dry, reverb, echo)
        Player.prototype.fade = function (to, t, dur) {
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
        // st: saved position (sessionStorage) or the player of the previous genre — the song continues where it was
        Player.prototype.begin = function (t, dur, st) {
            this.nextT = t;
            var ok = st && SONG_BY[st.id] && st.plan && st.plan.length && st.si < st.plan.length && st.plan.every(function (x) { return x && typeof x.k === 'string' && x.n > 0; });
            if (ok) { this.recent = (st.rec || []).slice(-3); this.load(SONG_BY[st.id], +st.tp || 0); this.plan = st.plan; this.si = st.si; this.sb = Math.min(st.sb, st.plan[st.si].n - 1); this.needSong = false; }
            else this.newSong();
            this.N.push(new Nature(this, this.th, this.dark, t, Math.min(dur, 2)));
            if (this.gn.start) this.gn.start(this, t);
            this.fade(1, t, dur);
        };
        Player.prototype.load = function (song, tp) {
            this.song = song; this.tp = tp; this.k = pc(song.key + tp); this.scale = song.scale; this.beats = song.beats;
            this.B = 60 / (song.bpm * this.gn.tm); this.barDur = this.B * this.beats;
            this.recent.push(song.id); if (this.recent.length > 4) this.recent.shift();
            warmFor(this);
        };
        Player.prototype.newSong = function () {
            var s = SFORCE && SONG_BY[SFORCE] ? SONG_BY[SFORCE] : pickSong(this);
            SFORCE = null;
            this.load(s, pick([0, 0, 0, 2, -2, -3]));
            this.plan = buildPlan(s, this.genre); this.si = 0; this.sb = 0; this.needSong = false;
        };
        Player.prototype.step = function () {
            if (++this.sb >= this.plan[this.si].n) { this.sb = 0; if (++this.si >= this.plan.length) this.needSong = true; }
        };
        // A new landscape is noted now and applied once it has stayed for SETTLE ms
        Player.prototype.retheme = function (theme, dark) {
            if (theme === this.th && dark === this.dark && !this.want) return;
            this.want = { theme: theme, dark: dark, at: clockMs() };
        };
        Player.prototype.applyWant = function (t0) {
            var w = this.want;
            if (!w || clockMs() - w.at < SETTLE) return;
            this.want = null;
            if (w.theme === this.th && w.dark === this.dark) return;
            var sp = SPACE[w.theme] || SPACE.neutral, th = THEMES[w.theme] || THEMES.neutral;
            if (w.theme !== this.th) { this.pendV = pickV(w.theme); this.pendSig = th.sig; }
            this.th = w.theme; this.dark = w.dark;
            this.wet.gain.setTargetAtTime(sp.verb, t0, 1.5); this.echo.gain.setTargetAtTime(sp.echo * this.gn.gain, t0, 1.5); this.damp.frequency.setTargetAtTime(sp.damp, t0, 1.5);
            this.bright = th.bright * (this.dark ? 0.72 : 1); this.toneF = Math.min(18000, this.gn.tone * this.bright); this.dyn = this.dark ? 0.85 : 1;
            this.N.forEach(function (n) { n.fadeOut(t0, 4); });
            this.N.push(new Nature(this, this.th, this.dark, t0, 4));
            while (this.N.length > 3) { var o = this.N.shift(); o.fadeOut(t0, 0.3); o.dispose(t0 + 0.5); }
            if (this.pendV) warmV(this.pendV);
        };
        Player.prototype.scheduleBar = function (t0) {
            if (this.needSong) this.newSong();
            var sec = this.plan[this.si], sb = this.sb, s = this.song, k = this.k, B = this.B, i;
            if (sb === 0 && this.pendV) { this.V = this.pendV; this.sig = this.pendSig || this.sig; this.pendV = this.pendSig = null; }
            var idx = sec.k === 'v' ? sb % s.nb : sec.k === 'in' ? Math.max(0, s.nb - sec.n + sb) : sec.k === 'br' ? sb % Math.min(4, s.nb) : s.nb - 1;
            var bar = s.bars[idx], segs = bar.ch.map(function (c) { var r = pc(k + c.r); return { t: t0 + c.b0 * B, b0: c.b0, len: c.len, root: r, pcs: CHT[c.q].map(function (x) { return pc(r + x); }) }; });
            this.hist.push({ t: t0, segs: segs }); if (this.hist.length > 8) this.hist.shift();
            this.applyWant(t0);
            var sg = stageNow();
            if (sg !== this.st) { this.hit = sg > this.st ? 'up' : 'down'; this.st = sg; if (this.hit === 'down') calmUntil = t0 + this.barDur * 2; }
            var tgt = energy(t0, sg);
            // ±1 step per bar keeps the build-up gradual; the bloom may jump
            this.E = this.E === null || tgt >= 4 || this.E >= 4 ? tgt : clamp(tgt, this.E - 1, this.E + 1);
            this.tone.frequency.setTargetAtTime(Math.min(18000, this.toneF * TONEMUL[this.E]), t0, 1.2);
            NV = 0;
            this.gn.bar(this, t0, { sec: sec, sb: sb, first: sb === 0, last: sb === sec.n - 1, bar: bar, segs: segs, idx: idx });
            if (this.accent) { this.accent = false; accentBar(this, t0, !this.hit); }
            if (this.hit) { stageHit(this, t0, this.hit); this.hit = null; }
            for (i = 0; i < this.N.length; i++) natureBar(this, this.N[i], t0);
            this.N = this.N.filter(function (n) { if (n.end !== null && t0 > n.end + 1) { n.dispose(); return false; } return true; });
            this.step();
            this.save();
        };
        Player.prototype.fadeOut = function (t, dur, force) {
            if (this.ending && !force) return;
            var end = t + dur;
            if (this.ending && this.endT !== null && this.endT <= end) return;
            this.ending = true; this.endT = end;
            this.fade(0, t, dur);
            this.cont.forEach(function (s) { try { s.stop(end + 0.3); } catch (e) { } });
            this.N.forEach(function (n) { n.dispose(end + 0.3); });
        };
        Player.prototype.dispose = function () {
            [this.fd, this.fw, this.fe].forEach(function (f) { try { f.disconnect(); } catch (e) { } });
            this.cont.forEach(function (s) { try { s.stop(); } catch (e) { } });
            this.N.forEach(function (n) { n.dispose(); });
            this.cont = []; this.N = [];
        };
        Player.prototype.snapshot = function () {
            return { g: this.genre, id: this.song.id, tp: this.tp, plan: this.plan, si: this.si, sb: this.sb, rec: this.recent, flow: Math.round(flowNow() * 100) / 100, done: PROG.done };
        };
        Player.prototype.save = function () {
            if (OFF || this.ending) return;
            try { var st = this.snapshot(); st.ts = Date.now(); sessionStorage.setItem(SS, JSON.stringify(st)); } catch (e) { }
        };
        var SIGW = { koto: ['koto', 56, 84], shamisen: ['shamisen', 52, 76], suikin: ['suikin', 76, 96], biwa: ['biwa', 44, 66], taiko: ['taiko', 40, 48], paranku: ['sanshin', 56, 80] };
        function warmV(V) { V.forEach(function (v) { if (STR[v]) warm(v, VREG[v][0] - 14, VREG[v][1] + 14); }); }
        function warmFor(p) {
            var wl = {
                ambient: [['suikin', 72, 98], ['glass', 76, 96], ['koto', 72, 100], ['piano', 36, 56]], zen: [['koto', 40, 76], ['bowl', 52, 78], ['kane', 40, 56]],
                piano: [['piano', 36, 96], ['celesta', 76, 96]], lofi: [['bass', 24, 60], ['ep', 52, 80], ['vibes', 60, 90]], nature: [['suikin', 76, 98], ['kane', 40, 56]]
            }[p.genre] || [];
            wl.forEach(function (w) { warm(w[0], w[1], w[2]); });
            warmV(p.V);
            if (SIGW[p.sig]) warm.apply(null, SIGW[p.sig]);
        }

        // ── Jo-ha-kyū ───────────────────────────────────────────────────
        function stageNow() {
            if (sFix !== null) return sFix;
            if (!imm()) return 1;
            // Without new kanji the cycle slowly sinks back towards the introduction
            var ms = clockMs();
            while (PROG.done > 0 && ms - PROG.t > 150000) { PROG.done = Math.max(0, PROG.done - 2); PROG.t += 150000; }
            return PROG.done < STAGE_AT[0] ? 0 : PROG.done < STAGE_AT[1] ? 1 : 2;
        }
        function advance() { PROG.t = clockMs(); if (++PROG.done >= CYCLE) PROG.done = 0; }
        function room(n) { return NV + n <= 44; }

        // ── Melody ──────────────────────────────────────────────────────
        // Octave that puts the middle of the song's range into the middle of the instrument's register
        function regBase(p, v) {
            var r = VREG[v] || VREG.koto, mid = (r[0] + r[1]) / 2 - (p.song.lo + p.song.hi) / 2;
            return p.k + 12 * Math.round((mid - p.k) / 12);
        }
        // One melody note on a Japanese instrument, with its idiomatic ornament:
        // g grace from above, o push up and release (oshi-hanashi), y vibrato (yuri), f falling release
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
            var base = regBase(p, v) + (o.oct || 0);
            notes.forEach(function (n, i) {
                if (o.skel && !(n.b % 1 === 0 && (n.b === 0 || n.d >= 1))) return;
                var orn = '';
                if (o.orn) { if (n.d >= 1.5) orn = chance(0.6) ? 'y' : 'o'; else if (n.d >= 0.5 && chance(0.15)) orn = 'g'; }
                if (o.fall && i === notes.length - 1 && n.d >= 1) orn = 'f';
                playNote(p, v, t0 + n.b * p.B + (o.sw && n.b % 1 ? o.sw : 0) + (o.lag || 0) + rnd(0, 0.01), base + n.p, n.d, vel, pan, orn, far);
            });
        }
        // Koto harmonics: two soft high tones with long echoes
        function harmonics(p, t0, c) {
            var hn = ctones(p, t0 + 0.01, 79, 98);
            for (var h = 0; h < 2 && hn.length; h++) pluck(p.d, t0 + p.B * (h * 1.5 + rnd(0, 0.5)), pick(hn), 0.03, { decay: 2, bright: 3, wet: 0.85, echo: 0.45, pan: rnd(-0.5, 0.5) });
        }
        // The melodic layer of a bar; o: lead/part (instrument override), far, sw
        function melody(p, t0, c, vel, o) {
            var sec = c.sec, s = p.song, E = p.E, lead = o.lead || p.V[0], part = o.part || p.V[1];
            if (E < 1 && sec.k !== 'v') return;
            if (sec.k === 'br') {
                // Interlude: the partner quotes the opening, the lead answers with the second bar; ma in between
                if (c.sb % 2 === 0) phrase(p, c.sb ? lead : part, t0, s.bars[c.sb ? Math.min(1, s.nb - 1) : 0].notes, vel * 0.85, c.sb ? -0.2 : 0.25, c.sb === 0, { orn: true, fall: true });
                else if (chance(0.7)) harmonics(p, t0, c);
                return;
            }
            if (sec.k === 'out') { if (c.first) phrase(p, part, t0, s.bars[s.nb - 1].notes, vel * 0.7, 0.3, true, { orn: true, fall: true }); return; }
            if (sec.k !== 'v') return;
            var tr = sec.tr, notes = c.bar.notes, v = lead, het = null, skel = E <= 0, alt = Math.floor(c.sb / 2) % 2;
            if (tr === 'call' && alt) v = part;
            else if (tr === 'hi') v = part;
            else if (tr === 'frag' && c.sb % 2) { if (E >= 2 && notes.length) phrase(p, part, t0, notes.slice(-1), vel * 0.6, 0.35, true, { orn: true }); return; }
            if (tr === 'het' && p.st >= 1 && E >= 2 && !skel) het = part;
            phrase(p, v, t0, notes, vel * (skel ? 0.7 : 1) * (v === part ? 0.9 : 1), v === part ? 0.25 : -0.2, o.far, { orn: tr === 'orn' || tr === 'hi' || tr === 'call', skel: skel, sw: o.sw, oct: tr === 'hi' && (v === 'koto' || v === 'piano') ? 12 : 0, fall: c.last });
            if (het) phrase(p, het, t0, notes, vel * 0.55, 0.3, true, { skel: true, lag: 0.03 });
        }

        // ── Signature percussion per landscape (one bar each) ───────────
        var OST = [[0, 0.5, 1.5, 2, 3], [0, 1, 1.5, 2.5, 3], [0, 0.75, 1.5, 2, 3.5], [0.5, 1, 2, 2.5, 3]];
        function fits(p) { return function (b) { return b < p.beats - 0.01; }; }
        var SIG = {
            koto: function (p, t0, E) {
                var tn = ctones(p, t0 + 0.01, 60, 79), pat = pick(OST).filter(fits(p)), pan = rnd(-0.3, 0.3);
                if (tn.length < 2) return;
                pat.forEach(function (b, i) { if (E < 4 && chance(0.2)) return; pluck(p.d, t0 + b * p.B + rnd(0, 0.01), tn[(i * 2 + p.sb) % tn.length], (i ? 0.028 : 0.038) * (E >= 4 ? 1.2 : 1), { decay: 1, bright: 6, wet: 0.45, echo: 0.1, pan: pan, pick: true }); });
            },
            shamisen: function (p, t0, E) {
                var nt = scaleNotes(p, 55, 72), i0 = nearestIdx(nt, 60 + chordAt(p, t0 + 0.01).root), pan = rnd(-0.2, 0.2);
                pick(OST).filter(fits(p)).forEach(function (b, i) { var ix = clamp(i0 + [0, 2, 1, 3, 0][i % 5] - (i % 2), 0, nt.length - 1); pluck(p.d, t0 + b * p.B + rnd(0, 0.012), nt[ix], (i ? 0.04 : 0.055), { kind: 'shamisen', decay: 0.8, bright: 9, wet: 0.35, pan: pan }); });
            },
            suikin: function (p, t0, E) {
                var tn = ctones(p, t0 + 0.01, 79, 96), pn = rnd(-0.5, 0.5);
                for (var i = 0, n = 2 + (E >= 4 ? 2 : 0); i < n && tn.length; i++) suikin(p.d, t0 + rnd(0, p.barDur), pick(tn), rnd(0.02, 0.035), pn + rnd(-0.2, 0.2));
            },
            biwa: function (p, t0, E) {
                var r = low(chordAt(p, t0 + 0.01).root, 46);
                pluck(p.d, t0, r, 0.07, { kind: 'biwa', decay: 2, bright: 8, wet: 0.5, pan: -0.2, bend: chance(0.5) ? 1 : 0, bendAt: 0.3 });
                if (chance(0.6)) pluck(p.d, t0 + (p.beats - 1.5) * p.B, r + 7, 0.05, { kind: 'biwa', decay: 1.6, bright: 8, wet: 0.5, pan: -0.2 });
            },
            furin: function (p, t0, E) {
                var nt = scaleNotes(p, 86, 98), pan = rnd(-0.6, 0.6), tt = t0 + p.B * (1 + Math.floor(Math.random() * (p.beats - 1)));
                for (var i = 0, n = 1 + Math.floor(Math.random() * 3); i < n; i++) { bell(p.d, tt, pick(nt), 0.022 * rnd(0.6, 1), { decay: 1.2, ratio: 2.4, index: 0.7, wet: 0.55, pan: pan }); tt += rnd(0.06, 0.2); }
            },
            mokugyo: function (p, t0, E) {
                for (var i = 0; i < p.beats; i++) if (i !== 3 || E >= 4) wood(p.d, t0 + i * p.B, 470, i ? 0.018 : 0.03, { wet: 0.35, pan: -0.25 });
                if (E >= 4) for (var j = 0; j < p.beats; j++) wood(p.d, t0 + (j + 0.5) * p.B, 470, 0.012, { wet: 0.35, pan: -0.25 });
            },
            taiko: function (p, t0, E) {
                taiko(p.d, t0, 0.07 * (E >= 4 ? 1.2 : 1), { m: 43 });
                taiko(p.d, t0 + (p.beats - 1.5) * p.B, 0.05, { m: 47, pan: 0.2 });
                if (E >= 4 || chance(0.4)) taiko(p.d, t0 + (p.beats - 0.5) * p.B, 0.04, { m: 47, pan: 0.2 });
                if (chance(0.5)) { var tw = t0 + (p.beats - 1) * p.B; wood(p.d, tw, 2300, 0.03, { wet: 0.4, pan: 0.3 }); wood(p.d, tw + 0.09, 2200, 0.022, { wet: 0.4, pan: 0.3 }); }
            },
            hyoshigi: function (p, t0, E) {
                (p.beats >= 4 ? [0, 2] : [0]).forEach(function (b) { wood(p.d, t0 + b * p.B, 2300, 0.035, { wet: 0.45, pan: 0.3 }); wood(p.d, t0 + b * p.B + 0.085, 2200, 0.025, { wet: 0.45, pan: 0.3 }); });
                if (E >= 4) wood(p.d, t0 + (p.beats - 0.5) * p.B, 2400, 0.025, { wet: 0.45, pan: 0.3 });
            },
            paranku: function (p, t0, E) {
                [[0, 0.06, 41], [1.5, 0.04, 48], [2, 0.05, 41], [3.5, 0.035, 48]].forEach(function (h) { if (h[0] < p.beats) taiko(p.d, t0 + h[0] * p.B, h[1], { m: h[2], pan: 0.15 }); });
                var tn = ctones(p, t0 + 0.01, 62, 79);
                if (tn.length >= 2) [0, 0.5, 1, 2, 2.5, 3].filter(fits(p)).forEach(function (b, i) { pluck(p.d, t0 + b * p.B + (b % 1 ? p.B * 0.08 : 0), tn[[0, 1, 0, 2, 1, 0][i] % tn.length], i % 2 ? 0.03 : 0.045, { kind: 'sanshin', decay: 0.8, bright: 9, wet: 0.3, pan: -0.2 }); });
            }
        };
        // One accent of the signature (completed kanji, stage changes)
        function sigHit(p, t0, vel) {
            var d = p.d, B = p.B, ch = chordAt(p, t0 + 0.01);
            switch (p.sig) {
                case 'koto': var nt = scaleNotes(p, 60, 84), i0 = Math.floor(Math.random() * 3); for (var g = 0; g < 6 && i0 + g < nt.length; g++) pluck(d, t0 + g * 0.06, nt[i0 + g], 0.05 * vel, { decay: 1.4, bright: 6, wet: 0.5, pan: -0.3 + g * 0.12 }); break;
                case 'shamisen': tonesIn(ch.pcs, 57, 72).slice(0, 3).forEach(function (m, i) { pluck(d, t0 + i * 0.035, m, 0.06 * vel, { kind: 'shamisen', decay: 1, bright: 9, wet: 0.4 }); }); break;
                case 'suikin': for (var i = 0; i < 3; i++) suikin(d, t0 + i * rnd(0.1, 0.25), pick(tonesIn(ch.pcs, 79, 96)), 0.03 * vel, rnd(-0.5, 0.5)); break;
                case 'biwa': pluck(d, t0, low(ch.root, 46), 0.08 * vel, { kind: 'biwa', decay: 2.2, bright: 9, wet: 0.5, bend: 1, bendAt: 0.25 }); noiseHit(d, t0, { f: 2500, q: 1.2, dur: 0.03, vel: 0.03 * vel }); break;
                case 'furin': var fn = scaleNotes(p, 86, 98); for (var j = 0; j < 4; j++) bell(d, t0 + j * rnd(0.05, 0.12), pick(fn), 0.024 * vel, { decay: 1.4, ratio: 2.4, index: 0.7, wet: 0.6 }); break;
                case 'mokugyo': wood(d, t0, 470, 0.04 * vel, { wet: 0.4 }); wood(d, t0 + 0.14, 470, 0.028 * vel, { wet: 0.4 }); break;
                case 'taiko': taiko(d, t0, 0.09 * vel, { m: 41 }); taiko(d, t0 + B / 2, 0.06 * vel, { m: 47, pan: 0.2 }); break;
                case 'hyoshigi': wood(d, t0, 2300, 0.045 * vel, { wet: 0.45 }); wood(d, t0 + 0.09, 2200, 0.035 * vel, { wet: 0.45 }); break;
                case 'paranku': [0, 0.25, 0.5].forEach(function (b, i) { taiko(d, t0 + b * B, (0.07 - i * 0.015) * vel, { m: i === 2 ? 48 : 41 }); }); break;
            }
        }

        // ── Shared layers ───────────────────────────────────────────────
        // Shimmer at full bloom: high chord tones on the half beats, wide stereo
        function shimmer(p, t0) {
            var g = p.genre, tn = ctones(p, t0 + 0.01, g === 'zen' ? 72 : 79, g === 'zen' ? 91 : 98), n = p.beats * 2;
            if (tn.length < 2 || !room(n)) return;
            for (var i = 0; i < n; i++) {
                if (i % 4 === 3) continue;
                var t = t0 + i * p.B / 2 + (g === 'lofi' && i % 2 ? p.B * 0.07 : 0), m = tn[[0, 2, 1, 3, 1, 2, 0, 3][i] % tn.length], pan = i % 2 ? 0.55 : -0.55, v = i % 2 ? 0.7 : 1;
                if (g === 'zen' || g === 'nature') pluck(p.d, t, m, 0.028 * v, { decay: 1.6, bright: 3, wet: 0.8, echo: 0.3, pan: pan });
                else if (g === 'piano') piano(p.d, t, m, 0.09 * v, p.B, { wet: 0.6, pan: pan });
                else tone(g === 'lofi' ? 'vibes' : 'glass', p.d, t, m, 0.014 * v, { wet: 0.7, echo: 0.35, pan: pan, trem: g === 'lofi' ? 4.6 : 0 });
            }
        }
        function rhythmOn(p) { return p.E >= (p.st >= 2 ? 2 : 3) && room(14); }

        // ── Genres (one bar each; c: section, bar, chord segments) ──────
        function ambientBar(p, t0, c) {
            var B = p.B, E = p.E, sec = c.sec, bd = p.barDur;
            // Ground: one soft low piano tone per chord under the pedal — then nothing but decay
            if (sec.k !== 'ma' && (E >= 1 || c.sb % 2 === 0)) c.segs.forEach(function (sg) { piano(p.d, sg.t, low(sg.root, 40), 0.12 * p.dyn, sg.len * B, { wet: 0.6, ped: true }); });
            // Suikinkutsu: drops ring the buried jar, always within the mode
            var drops = scaleNotes(p, 74, 96), nd = poisson([0.3, 0.7, 1.1, 1.6, 2.2][E]);
            for (var i = 0; i < nd; i++) {
                var tt = t0 + rnd(0, bd), pn = rnd(-0.6, 0.6);
                suikin(p.d, tt, pick(drops), rnd(0.02, 0.035), pn);
                if (chance(0.25)) suikin(p.d, tt + rnd(0.12, 0.3), pick(drops), 0.014, pn);
            }
            if (sec.k === 'in' && c.first) tone('glass', p.d, t0 + 0.01, rootNear(p, 84), 0.02, { wet: 0.85, echo: 0.3 });
            melody(p, t0, c, 0.05, { far: true });
            if (sec.k === 'v' && c.sb % 2 === 1 && E >= 1 && chance(0.3)) harmonics(p, t0, c);
            if (sec.k === 'out' && c.last) singBowl(p.d, t0, low(p.k, 57), bd * 1.5, 0.026, { wet: 0.7 });
            if (rhythmOn(p) && p.sig === 'suikin') SIG.suikin(p, t0, E);
            if (E >= 4) shimmer(p, t0);
        }
        function zenBar(p, t0, c) {
            var B = p.B, E = p.E, sec = c.sec, str = p.th === 'okinawa' ? 'sanshin' : 'koto', dk = p.dyn;
            if (sec.k === 'ma') { if (c.first && E >= 1) bowl(p.d, t0 + B, low(p.k, 55), 0.035, { pan: -0.2 }); return; }
            // A struck bowl on the tonic opens every section
            if (c.first && sec.k !== 'out') bowl(p.d, t0, low(p.k, 55), (sec.k === 'v' ? 0.06 : 0.045) * dk, { pan: -0.15 });
            c.segs.forEach(function (sg, i) {
                if (E <= 0 && i > 0) return;
                pluck(p.d, sg.t + 0.02, low(sg.root, 43), 0.06 * dk, { kind: str, decay: 2.4, bright: 5, wet: 0.5, pan: 0.1 });
                if (E >= 2 && sec.k !== 'out' && room(3)) {
                    var tn = tonesIn(sg.pcs, 55, 74);
                    for (var j = 1; j < sg.len && j <= 3 && tn.length; j++) pluck(p.d, sg.t + j * B, tn[(j * 2 + i) % tn.length], 0.026 * dk, { kind: str, decay: 1.4, bright: 5, wet: 0.5, echo: 0.1, pan: 0.2 });
                }
            });
            if (sec.k === 'v' && c.first && E >= 2 && p.st >= 1) sho(p.d, t0, voiceOf(c.segs[0], null, 67, 86), B * 3, 0.016, { wet: 0.85 });
            if (sec.k === 'out' && c.last) { bowl(p.d, t0, low(p.k, 55), 0.06 * dk); if (p.dark || p.th === 'sage') kane(p.d, t0 + B, low(p.k, 43), 0.045, { pan: 0.3 }); }
            melody(p, t0, c, 0.075, {});
            if (rhythmOn(p) && sec.k !== 'out') SIG[p.sig](p, t0, E);
            if (E >= 4) shimmer(p, t0);
        }
        function pianoBar(p, t0, c) {
            var B = p.B, E = p.E, sec = c.sec, dk = p.dyn, three = p.beats === 3;
            if (sec.k === 'ma') return;
            c.segs.forEach(function (sg) {
                var R = low(sg.root, 40), hold = sg.len * B, v = voiceOf(sg, p.prevVoice, 55, 72), pat;
                p.prevVoice = v;
                // Intro and final bar: rolled chords under the pedal
                if (sec.k === 'in' || (sec.k === 'out' && c.last)) { [R].concat(v).forEach(function (m, j) { piano(p.d, sg.t + j * 0.04, m, (j ? 0.13 : 0.24) * dk, hold, { wet: 0.5, ped: true }); }); return; }
                if (E <= 0) pat = [[0, R, 0.22]];
                else if (three) pat = [[0, R, 0.26], [1, v[0], 0.11], [2, v[1] || v[0], 0.1]];
                else if (sg.len >= 4) pat = [[0, R, 0.26], [1, R + 7, 0.15], [2, R + 12, 0.16], [3, v[v.length - 1], 0.12]];
                else pat = [[0, R, 0.25], [1, R + 7, 0.14]];
                if (E >= 3 && !three && sg.len >= 4) pat.push([2.5, v[0], 0.1]);
                pat.forEach(function (q) { if (q[0] < sg.len) piano(p.d, sg.t + q[0] * B + rnd(0, 0.01), q[1], q[2] * rnd(0.9, 1.04) * dk, Math.max(B, hold - q[0] * B), { wet: 0.4, ped: true }); });
            });
            melody(p, t0, c, 0.075, { lead: 'piano', part: p.V[0] });
            if (rhythmOn(p) && p.sig !== 'koto' && p.sig !== 'biwa' && sec.k !== 'out') SIG[p.sig](p, t0, E);
            if (E >= 4) shimmer(p, t0);
        }
        function lofiStart(p, t) {
            var c = noiseN('crackle'), g = gainN(0.6);
            c.connect(g); g.connect(p.dry); startNoise(c, t); p.cont.push(c);
        }
        function lofiBar(p, t0, c) {
            var B = p.B, sw = B * 0.14, E = p.E, sec = c.sec, dk = p.dyn * 0.9, nb = p.beats, gv = p.st === 2 ? 1 : p.st === 0 ? 2 : 0, play = sec.k !== 'ma';
            c.segs.forEach(function (sg) {
                var v = voiceOf(sg, p.prevVoice, 57, 76), R = low(sg.root, 36);
                p.prevVoice = v;
                // EP: a short stab on the chord, an answering stab later — chords that decay, no sustain
                v.forEach(function (m, j) { ep(p.d, sg.t + 0.02 + j * 0.012, m, (play ? 0.05 : 0.03) * dk, Math.min(sg.len, 1.5) * B, { wet: 0.35 }); });
                if (!play || E < 1) return;
                if (sg.len >= 2 && chance(0.6)) v.forEach(function (m, j) { ep(p.d, sg.t + (sg.len - 1.5) * B + sw + j * 0.01, m, 0.03 * dk, B * 0.6, { wet: 0.35 }); });
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
                    var nh = gv === 1 ? nb * 4 : nb * 2;
                    for (var i = 0; i < nh; i++) shaker(p.d, t0 + i * nb * B / nh + (i % 2 ? (nh > nb * 2 ? sw * 0.5 : sw) : 0), (i % 2 ? 0.1 : 0.16) * dk * (nh > nb * 2 ? 0.7 : 1));
                    if (c.last && sec.k === 'v') for (var f = 0; f < 4; f++) brush(p.d, t0 + (nb - 1) * B + f * B / 4 + (f % 2 ? sw * 0.5 : 0), (0.12 + f * 0.06) * dk);
                }
            }
            melody(p, t0, c, 0.06, { sw: sw });
            if (rhythmOn(p) && p.sig !== 'koto' && p.sig !== 'suikin' && sec.k !== 'out') SIG[p.sig](p, t0, E);
            if (E >= 4) shimmer(p, t0);
        }

        // ── Nature soundscapes (one layer per landscape; crossfaded on change) ──
        function Nature(p, theme, dark, t, fin) {
            var pr = (NAT[theme] || NAT.neutral)[dark ? 'n' : 'd'], self = this;
            this.np = pr; this.L = {}; this.cont = []; this.end = null; this.t0 = t; this.fin = Math.max(0.05, fin);
            this.g = gainN(0); this.wg = gainN(0); this.g.connect(p.nat); this.wg.connect(p.nwet);
            [this.g, this.wg].forEach(function (x) { x.gain.setValueAtTime(0, t); x.gain.linearRampToValueAtTime(1, t + self.fin); });
            this.nd = { dry: this.g, wet: this.wg, echo: null };
            var bg = gainN(p.genre === 'nature' ? 0.6 : 1);
            bg.connect(this.g);
            if (pr.wind) {
                // Wind lives in its gusts: a low resting level, swells per bar
                var w = this.bed('pink', t, 0.6), bp = filt('bandpass', 420, 0.8), lp = filt('lowpass', 1100, 0.5), g = gainN(0);
                w.connect(bp); bp.connect(lp); lp.connect(g); g.connect(bg);
                g.gain.setTargetAtTime(pr.wind * K.wind * 0.3, t, 0.8);
                this.L.wind = { g: g, bp: bp, lvl: pr.wind * K.wind };
                if (pr.leaves) this.L.leaves = { lvl: pr.leaves };
            }
            if (pr.water) {
                // Brook: a smooth rush; the babble comes from discrete bubbles in natureBar
                var ru = this.bed('pink', t, 0.5), rbp = filt('bandpass', 1300, 0.7), rlp = filt('lowpass', 3500, 0.5), rg = gainN(0);
                ru.connect(rbp); rbp.connect(rlp); rlp.connect(rg); rg.connect(bg); rg.gain.setTargetAtTime(pr.water * K.water, t, 1);
                this.L.water = { lvl: pr.water, pan: rnd(-0.35, 0.35), rg: rg };
            }
            if (pr.waves) {
                var wv = this.bed('pink', t, 0.7), wlp2 = filt('lowpass', 600, 0.5), wg2 = gainN(0);
                wv.connect(wlp2); wlp2.connect(wg2); wg2.connect(bg);
                this.L.waves = { g: wg2, lp: wlp2, lvl: pr.waves * K.waves, next: t + 0.3 };
            }
            if (pr.rain) {
                var r1 = this.bed('white', t, 0.8), rbp2 = filt('bandpass', 2800, 0.4), rg1 = gainN(0);
                r1.connect(rbp2); rbp2.connect(rg1); rg1.connect(bg); rg1.gain.setTargetAtTime(pr.rain * K.rain, t, 1);
                this.L.rain = { lvl: pr.rain };
            }
            if (pr.city) {
                // Distant traffic: a soft mid-band wash that breathes, no rumble
                var c2 = this.bed('pink', t, 0.7), cbp = filt('bandpass', 520, 0.6), cg2 = gainN(0);
                c2.connect(cbp); cbp.connect(cg2); cg2.connect(bg); cg2.gain.setTargetAtTime(pr.city * K.city, t, 1);
                this.L.city = { g: cg2, lvl: pr.city * K.city };
            }
        }
        // Decorrelated stereo pair: a mono noise bed in the centre sounds like flat hiss
        Nature.prototype.bed = function (kind, t, width) {
            var g = gainN(1), self = this;
            [-width, width].forEach(function (pn) {
                var x = noiseN(kind), o = x;
                startNoise(x, t); self.cont.push(x);
                if (ctx.createStereoPanner) { o = ctx.createStereoPanner(); o.pan.value = pn; x.connect(o); }
                o.connect(g);
            });
            return g;
        };
        Nature.prototype.fadeOut = function (t, dur) {
            if (this.end !== null) return;
            var v = clamp((t - this.t0) / this.fin, 0, 1);
            this.end = t + dur;
            [this.g, this.wg].forEach(function (x) { x.gain.cancelScheduledValues(t); x.gain.setValueAtTime(v, t); x.gain.linearRampToValueAtTime(0, t + dur); });
            this.dispose(t + dur + 0.2);
        };
        Nature.prototype.dispose = function (at) {
            this.cont.forEach(function (s) { try { if (at) s.stop(at); else s.stop(); } catch (e) { } });
            this.cont = [];
        };
        function natureBar(p, n, t0) {
            var bd = p.barDur, L = n.L, pr = n.np, nd = n.nd;
            if (n.end !== null && t0 > n.end) return;
            if (L.wind) {
                var gt = t0 + rnd(0, bd * 0.5), v = L.wind.lvl * (chance(0.4) ? rnd(0.5, 1) : rnd(0.15, 0.4));
                L.wind.g.gain.setTargetAtTime(v, gt, rnd(1.2, 2.4)); L.wind.bp.frequency.setTargetAtTime(rnd(300, 700), gt, 2);
                // Foliage only stirs with a stronger gust: one soft swell instead of constant crackle
                if (L.leaves && v > L.wind.lvl * 0.65) noiseHit(nd, gt + rnd(0.3, 0.9), { kind: 'pink', type: 'bandpass', f: 1700, f2: 2600, q: 0.6, dur: rnd(2, 3.2), att: rnd(0.9, 1.5), vel: L.leaves.lvl * 0.05, wet: 0.35, pan: rnd(-0.6, 0.6) });
            }
            if (L.water) {
                var Wt = L.water;
                Wt.rg.gain.setTargetAtTime(Wt.lvl * K.water * rnd(0.7, 1.1), t0 + rnd(0, bd), 2);
                for (var bb = poisson(bd * 9 * Wt.lvl / 0.3); bb > 0; bb--) bubble(nd, t0 + rnd(0, bd), Wt);
            }
            if (L.waves) {
                var w = L.waves;
                while (w.next < t0 + bd) {
                    var up = rnd(2.6, 3.6), down = rnd(4, 6), peak = w.lvl * rnd(0.6, 1), wt = Math.max(w.next, t0);
                    w.g.gain.setTargetAtTime(peak, wt, up / 3); w.g.gain.setTargetAtTime(w.lvl * 0.12, wt + up, down / 3);
                    w.lp.frequency.setTargetAtTime(rnd(1300, 1900), wt, up / 3); w.lp.frequency.setTargetAtTime(500, wt + up, down / 3);
                    noiseHit(nd, wt + up * 0.8, { type: 'highpass', f: 2500, dur: 2.5, att: 0.6, vel: peak * K.foam, wet: 0.3, pan: rnd(-0.4, 0.4) });
                    w.next = wt + up + down * rnd(0.7, 1);
                }
            }
            if (L.city) L.city.g.gain.setTargetAtTime(L.city.lvl * rnd(0.5, 1), t0 + rnd(0, bd), 2.5);
            if (L.rain) for (var r = poisson(10 * L.rain.lvl * bd / 4); r > 0; r--) noiseHit(nd, t0 + rnd(0, bd), { f: rnd(2500, 6000), q: 3, dur: 0.015, vel: rnd(0.01, 0.03), pan: rnd(-0.8, 0.8) });
            if (n.end !== null) return;
            var ev = pr.ev || {}, mul = (p.genre === 'nature' ? 2.4 : 1) * EVMUL[p.E === null ? 2 : p.E] * (NOEV ? 0 : 1);
            for (var k in ev) {
                if (!EV.hasOwnProperty(k)) continue;
                for (var m = poisson(ev[k] * mul * bd / 60); m > 0; m--) EV[k](nd, t0 + rnd(0, bd), p);
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
            wood(d, t, f, lvl, { wet: 0.5, pan: pan });
            if (chance(0.5)) wood(d, t + rnd(0.1, 0.18), f * rnd(0.9, 1.15), lvl * 0.7, { wet: 0.5, pan: pan });
        }
        // Shishi-odoshi: water trickles into the bamboo, then the tock
        function shishi(d, t, lvl) {
            noiseHit(d, t, { type: 'bandpass', f: 2600, q: 2.5, dur: 2.2, att: 1.8, vel: lvl * 0.18, pan: -0.2, wet: 0.3 });
            wood(d, t + 2.3, 380, lvl, { wet: 0.75, pan: -0.2 });
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

        // ── Flow: adaptive density + beat-quantized, in-key responses ───────
        var TONEMUL = [0.62, 0.8, 1, 1.12, 1.45], EVMUL = [0.55, 0.8, 1, 1.15, 1.3];
        function imm() { return cfg.level === 'off' ? 0 : (IMM[cfg.immersion] || 0); }
        function flowNow() { return flowFix !== null ? flowFix : flow * Math.exp(-Math.max(0, now() - flowT) / 45); }
        function addFlow(x) { if (!ctx) return; flow = clamp(flowNow() + x, 0, 1); flowT = lastIn = now(); }
        // Arrangement density 0..4: ma in thinking pauses, fuller while drawing, bloom after a kanji; the stage sets the frame
        function energy(t0, sg) {
            var m = imm();
            if (!m) return 2;
            if (eFix !== null) return eFix;
            var f = flowNow(), e = f < 0.15 ? 1 : f < 0.5 ? 2 : 3, idle = flowFix === null && now() - lastIn > 30;
            if (idle || t0 < calmUntil) e = 0;
            else if (sg === 0) e = Math.min(e, 2);
            else if (sg === 2) e = Math.max(e, 2);
            if (t0 < bloomUntil) e = 4;
            return clamp(e, m > 1 ? 0 : 1, m > 1 ? 4 : 3);
        }
        function nextGrid(s, div, t) { var st = s.B / div; return s.nextT + Math.ceil((t - s.nextT) / st - 1e-6) * st; }
        // Answers fall on eighth notes; strokes faster than the grid take the next free slot or are dropped, never stacked
        function slot(s, tn) {
            var st = s.B / 2, g = nextGrid(s, 2, tn);
            if (g <= AQ.t + 1e-3) g = AQ.t + st;
            if (g - tn > st * 2.5) return null;
            AQ.t = g; return g;
        }
        // Stroke rate over the last seconds: dense playing gets softer answers
        function bump() { var ms = clockMs(); RATE.n = RATE.n * Math.exp(-(ms - RATE.t) / 2500) + 1; RATE.t = ms; }
        function dens() { var n = RATE.n * Math.exp(-(clockMs() - RATE.t) / 2500); return 1 / (1 + 0.3 * Math.max(0, n - 1)); }
        function spot() { return clamp(panOf(lastX) * 1.6, -0.6, 0.6); }
        // Answering voice: the landscape's string instrument (piano in the piano genre)
        function answer(s, t, m, k) {
            var d = s.d, g = s.genre, pan = spot(), V = s.V, sv = STR[V[0]] ? V[0] : STR[V[1]] ? V[1] : 'koto';
            if (g === 'piano') piano(d, t, m, 0.26 * k, 0.9, { wet: 0.5, pan: pan });
            else if (g === 'ambient') tone('glass', d, t, m, 0.035 * k, { wet: 0.6, echo: 0.3, pan: pan });
            else pluck(d, t, m, 0.047 * k * VK[sv], { kind: sv, decay: sv === 'koto' || sv === 'biwa' ? 1.5 : 0.85, bright: 7, wet: g === 'nature' ? 0.55 : 0.4, echo: 0.2, pan: pan, pick: true });
        }
        // The strokes of a kanji trace a melody through the song's mode; every second step lands on a chord tone
        function contourNote(s, t, idx) {
            var r = LEADR[s.genre] || LEADR.ambient, sc = scaleNotes(s, r[0], r[1]), m = sc[clamp(cBase + CONTOUR[(idx || 0) % CONTOUR.length], 0, sc.length - 1)];
            if (idx % 2 === 1) { var ct = ctones(s, t, r[0], r[1]); if (ct.length) m = ct[nearestIdx(ct, m)]; }
            return m;
        }
        // Mistake: a muted low note on the chord root — part of the music, never a buzzer
        function ghost(s, t) {
            var d = s.d, g = s.genre, r = low(chordAt(s, t).root, 43);
            if (g === 'piano') piano(d, t, r, 0.13, 0.12, { wet: 0.25 });
            else if (g === 'lofi') bass(d, t, low(r, 36), 0.06, 0.18);
            else if (g === 'zen') pluck(d, t, r + 12, 0.045, { decay: 0.3, bright: 3, wet: 0.3 });
            else thock(d, t, r + 12, 0.04);
        }
        function penTick(s, t) {
            var d = s.d, g = s.genre, pan = spot(), r = LEADR[g] || LEADR.ambient, ct = ctones(s, t, r[0] + 12, r[1] + 12);
            if (g === 'lofi') wood(d, t, 1700, 0.014, { pan: pan });
            else if (g === 'zen') wood(d, t, 900, 0.018, { wet: 0.3, pan: pan });
            else if (ct.length) tone('celesta', d, t, pick(ct), 0.007, { wet: 0.4, pan: pan });
        }
        // Landing on the downbeat after a completed kanji or a genre change: the signature answers, a high glass tone, some air
        function accentBar(s, t0, withSig) {
            if (withSig) sigHit(s, t0, 0.8);
            tone('glass', s.d, t0 + 0.01, rootNear(s, 84), 0.022, { wet: 0.8, echo: 0.3 });
            noiseHit(s.d, t0, { type: 'highpass', f: 6500, dur: 1.4, att: 0.01, vel: 0.008, wet: 0.7 });
        }
        // Stage change: up = a gesture into the fuller stage, down = release into stillness
        function stageHit(s, t0, dir) {
            var d = s.d, g = s.genre, R = low(s.k, 40);
            if (dir === 'down') {
                if (g === 'lofi') { kick(d, t0, 0.4); brush(d, t0, 0.3); }
                else if (g === 'piano') { piano(d, t0, R, 0.3, s.barDur * 2, { wet: 0.6, ped: true }); piano(d, t0 + 0.02, R + 12, 0.18, s.barDur * 2, { wet: 0.6, ped: true }); }
                else if (s.dark || g === 'zen') kane(d, t0, low(s.k, 43), 0.06, { pan: 0.2 });
                else singBowl(d, t0, low(s.k, 67), s.barDur * 1.5, 0.035, { wet: 0.7 });
                noiseHit(d, t0, { kind: 'pink', type: 'bandpass', f: 2600, f2: 500, q: 1, dur: s.barDur, att: 0.3, vel: 0.012, wet: 0.6 });
                return;
            }
            riser(t0 - 1.2, 1.2);
            sigHit(s, t0, 1);
            if (g === 'piano') { piano(d, t0, R, 0.32, s.barDur, { wet: 0.5, ped: true }); piano(d, t0 + 0.015, R - 12, 0.2, s.barDur, { wet: 0.5, ped: true }); }
            else if (g === 'lofi') { kick(d, t0, 0.5); for (var f = 0; f < 3; f++) brush(d, Math.max(now(), t0 - (3 - f) * s.B / 4), 0.15 + f * 0.08); }
            else if (g === 'zen' && s.dark) kane(d, t0, low(s.k, 43), 0.05, { pan: 0.3 });
        }
        function riser(t, dur) {
            if (t < now()) { dur -= now() - t; t = now(); if (dur < 0.3) return; }
            noiseHit({ dry: G.music, wet: G.verbIn, echo: null }, t, { kind: 'pink', type: 'bandpass', f: 350, f2: 3200, q: 1.1, dur: dur, att: dur * 0.92, vel: 0.02, wet: 0.5 });
        }

        // ── Music control ───────────────────────────────────────────────
        function musicOn() { return cfg.level !== 'off' && GENRES.hasOwnProperty(cfg.music); }
        function live() { for (var i = players.length - 1; i >= 0; i--) if (!players[i].ending) return players[i]; return null; }
        function loadState() {
            try { var st = JSON.parse(sessionStorage.getItem(SS) || 'null'); if (st) st.recent = Date.now() - (st.ts || 0) < 20000; return st; } catch (e) { return null; }
        }
        // The landscape only recolours the running player; a new player is created for a genre change (the song continues)
        function syncMusic() {
            if (disposed) return;
            if (!musicOn()) { fadeOutAll(1.8); return; }
            if (!ensureCtx()) return;
            if (!OFF && ctx.state !== 'running') { if (!D.hidden) { try { ctx.resume(); } catch (e) { } } return; }
            var top = live();
            if (top && top.genre === cfg.music) { top.retheme(cur.theme, cur.dark); return; }
            var p = new Player(cfg.music), t = now() + 0.06, dur, st = null;
            if (top) {
                st = top.snapshot();
                // Tails of earlier switches make room so at most two players overlap
                players.forEach(function (x) { if (x.ending && x.endT > t + 1.5) x.fadeOut(t, 1.5, true); });
                t = Math.max(t, Math.min(top.nextT, t + 2.5)); dur = 3.5;
                top.fadeOut(t, dur);
                if (imm()) p.accent = true;
            } else {
                var ls = OFF ? null : loadState();
                if (ls && ls.recent) {
                    st = ls;
                    if (ls.flow != null) { flow = ls.flow; flowT = lastIn = now(); }
                    if (ls.done != null && !PROG.done) { PROG.done = ls.done; PROG.t = clockMs(); }
                    dur = 1.5;
                } else dur = 3;
            }
            p.begin(t, dur, st);
            players.push(p);
            if (players.length > 3) players[0].fadeOut(now() + 0.01, 0.3, true);
            if (!OFF) { ensureTimer(); tick(); }
        }
        function fadeOutAll(dur) {
            if (!ctx) return;
            var t = now() + 0.02;
            players.forEach(function (s) { s.fadeOut(t, dur); });
            if (!OFF) { try { sessionStorage.removeItem(SS); } catch (e) { } }
        }
        function pump(horizon) {
            var tn = now();
            players.forEach(function (p) {
                // Missed bars (suspended tab, throttled timer): skip ahead in the song without playing them
                if (!OFF && p.nextT < tn - 0.2) {
                    for (var k = 0; p.nextT < tn - 0.2 && k < 64; k++) { if (p.needSong) p.newSong(); p.step(); p.bar++; p.nextT += p.barDur; }
                    if (p.nextT < tn) p.nextT = tn + 0.05;
                }
                if (!p.ending) p.applyWant(tn + 0.05);
                while (p.nextT < horizon && (p.endT === null || p.nextT < p.endT)) { p.scheduleBar(p.nextT); p.bar++; p.nextT += p.barDur; }
            });
            if (OFF) return;
            players = players.filter(function (s) { if (s.endT !== null && tn > s.endT + 7) { s.dispose(); return false; } return true; });
            if (!players.length) stopTimer();
        }
        function tick() { if (!ctx || ctx.state !== 'running') return; try { pump(now() + 1.4); } catch (e) { if (W.__kdAudioDebug) console.error(e); } }
        function ensureTimer() { if (!timer) timer = setInterval(tick, 250); }
        function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

        // ── Public operations ───────────────────────────────────────────
        function setParam(p, v, t, tc) { p.cancelScheduledValues(t); p.setTargetAtTime(v, t, tc); }
        function configure(o) {
            o = o || {};
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
            syncMusic();
        }
        function setScene(theme, dark) {
            theme = THEMES.hasOwnProperty(theme) ? theme : 'neutral'; dark = !!dark;
            if (theme === cur.theme && dark === cur.dark) return;
            cur = { theme: theme, dark: dark };
            var p = live();
            if (p) p.retheme(theme, dark);
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
        // Key for UI sounds: the running song, else a neutral Yo mode
        function ks() { var top = live(); return top && top.song ? top : { k: 4, scale: [0, 2, 5, 7, 9] }; }
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
                addFlow(ok ? 0.06 : 0.015); bump();
                play(function (tn) { var t = slot(sc, tn); if (t === null) return; if (ok) answer(sc, t, contourNote(sc, t, idx), dens()); else ghost(sc, t); });
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
                    // Sararin: a run up the mode in 16ths that lands on the chord root on the next beat, then the arrangement blooms
                    var st = sc.B / 4, land = nextGrid(sc, 1, tn + 6 * st), r = LEADR[sc.genre] || LEADR.ambient, top = r[1] - 5;
                    var tonic = top - pc(top - chordAt(sc, land).root), run = scaleNotes(sc, tonic - 14, tonic - 1).slice(-6);
                    run.push(tonic);
                    run.forEach(function (m, i) { answer(sc, land - (run.length - 1 - i) * st, m, 0.55 + i * 0.08); });
                    tone('glass', sc.d, land, tonic + 12, 0.018, { wet: 0.8, echo: 0.35 });
                    AQ.t = land;
                    bloomUntil = sc.nextT + sc.barDur * 2; sc.accent = true;
                    advance();
                });
                return;
            }
            play(function (t) {
                var s = ks(), base = rootNear(s, 72), n = scaleNotes(s, base, base + 26);
                for (var i = 0; i < 6; i++) chime(lastStyle, FXD(), t + i * 0.075, n[Math.min(n.length - 1, i)], 0.034 + i * 0.004);
                tone('glass', FXD(), t + 0.5, base + 24, 0.02, { wet: 0.7, echo: 0.3 });
            }, 0.12);
        }

        // ── Stroke sounds ───────────────────────────────────────────────
        function panOf(x) { return clamp((x - 54.5) / 54.5, -1, 1) * 0.35; }
        function strokeStart(style, x, y, pressure, ptype) {
            lastStyle = SK.hasOwnProperty(style) ? style : 'standard'; lastX = +x || 54.5;
            var sc = live();
            if (sc && imm()) {
                addFlow(0.03);
                // Pen-down tick (full immersion only), at most twice a second and never when answers are queued
                if (imm() > 1 && fxOn() && now() - lastTick > 0.5 && dens() > 0.7) { lastTick = now(); play(function (tn) { penTick(sc, nextGrid(sc, 4, tn)); }); }
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
            var sc = imm() ? live() : null, r = RES[style], tones = sc && sc.song ? ctones(sc, t, r.lo, r.hi) : null;
            // Neon hum sits on the chord root and rises towards the fifth with speed
            if (sc && sc.song && style === 'neon') v.root = mtof(low(chordAt(sc, t).root, 38));
            var hz0 = v.root || 92;
            v.amp = amp;
            if (ctx.createStereoPanner) { v.pan = ctx.createStereoPanner(); v.pan.pan.value = panOf(x); amp.connect(v.pan); out = v.pan; }
            out.connect(G.stroke);
            function src(kind) { var s = noiseN(kind); startNoise(s, t); v.src.push(s); return s; }
            if (style === 'gel') {
                // Rolling ball: smooth, narrow "ssss" plus a faint glide tone
                var gs = src('pink'), gbp = filt('bandpass', c.f0, 1.3), glp = filt('lowpass', 3600, 0.5), tn = oscN('sine', 1200), tg = gainN(0);
                gs.connect(gbp); gbp.connect(glp); glp.connect(amp); tn.connect(tg); tg.connect(amp); tn.start(t); v.src.push(tn);
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
            if (tones && tones.length) {
                // Pen resonance: the stroke texture rings faintly in two tones of the current chord
                var rb = gainN(r.k), rw = gainN(0.7);
                if (tones.length > 2) tones = [tones[0], tones[Math.floor(tones.length / 2)]];
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
        // Gentle, slow ducking: the music steps back a little while the pen moves and never pumps with quick strokes
        function duck(on) {
            if (!G || !musicOn()) return;
            var p = G.duck.gain, t = now();
            p.cancelScheduledValues(t); p.setTargetAtTime(on ? 0.82 : 1, t + (on ? 0 : 0.4), on ? 0.2 : 1.2);
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
            if (ctx && ctx.state === 'running' && !players.length && !SV && Date.now() - lastAct > 15000) { try { ctx.suspend(); } catch (e) { } }
        }, 5000);
        function dispose() {
            disposed = true; stopTimer(); clearInterval(idleIv);
            GEST.forEach(function (n) { D.removeEventListener(n, onGesture, true); });
            D.removeEventListener('visibilitychange', onVis); W.removeEventListener('pagehide', onHide);
            if (ctx) { try { ctx.close(); } catch (e) { } }
            ctx = null; players = [];
            if (W.__kdAudio === api) W.__kdAudio = null;
        }

        // ── Offline render (tests / sound design): deterministic timeline ──
        function offline(o) {
            var OAC = W.OfflineAudioContext || W.webkitOfflineAudioContext, sr = o.sr || 44100;
            var off = new OAC(2, Math.ceil(sr * o.seconds), sr);
            var sv = { ctx: ctx, G: G, NB: NB, PW: PW, players: players, cfg: cfg, cur: cur, SV: SV, sTok: sTok, lastStyle: lastStyle, fl: [flow, flowT, lastIn, bloomUntil, flowFix, eFix, lastX, cBase, calmUntil, sFix, lastTick, SFORCE], prog: PROG, aq: AQ, rate: RATE };
            try {
                OFF = true; ctx = off; players = []; SV = null;
                cfg = { level: o.level || 'mid', music: o.music || 'off', musicLevel: o.musicLevel || 'mid', stroke: o.stroke || 'on', fx: o.fx || 'on', immersion: o.immersion || 'off' };
                flow = 0; flowT = 0; lastIn = -1e9; bloomUntil = o.bloom ? 1e9 : 0; calmUntil = 0; lastX = 54.5; cBase = 0; lastTick = -1e9;
                flowFix = o.flow != null ? o.flow : null; eFix = o.E != null ? o.E : null; sFix = o.stage != null ? o.stage : null; NOEV = !!o.noEvents; SFORCE = o.song || null;
                PROG = { done: o.done || 0, t: 0 }; AQ = { t: -1 }; RATE = { n: 0, t: 0 };
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
                ctx = sv.ctx; G = sv.G; NB = sv.NB; PW = sv.PW; players = sv.players; cfg = sv.cfg; cur = sv.cur; SV = sv.SV; sTok = sv.sTok; lastStyle = sv.lastStyle;
                flow = sv.fl[0]; flowT = sv.fl[1]; lastIn = sv.fl[2]; bloomUntil = sv.fl[3]; flowFix = sv.fl[4]; eFix = sv.fl[5]; lastX = sv.fl[6]; cBase = sv.fl[7]; calmUntil = sv.fl[8]; sFix = sv.fl[9]; lastTick = sv.fl[10]; SFORCE = sv.fl[11];
                PROG = sv.prog; AQ = sv.aq; RATE = sv.rate; NOEV = false;
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
                return {
                    ctx: ctx ? ctx.state : 'none', cfg: JSON.parse(JSON.stringify(cfg)), theme: cur.theme, dark: cur.dark, flow: Math.round(flowNow() * 100) / 100, done: PROG.done,
                    scenes: players.map(function (p) {
                        var sec = p.plan[p.si] || {};
                        return p.genre + ' ' + (p.song ? p.song.id : '-') + ' ' + p.th + (p.dark ? '/n' : '/d') + (p.ending ? ' (fading)' : '') + ' E' + p.E + ' ' + ['jo', 'ha', 'kyu'][p.st] + ' ' + (sec.k || '') + (sec.tr ? ':' + sec.tr : '') + ' ' + p.sb;
                    })
                };
            },
            dispose: dispose,
            _offline: offline,
            _t: { THEMES: THEMES, GENRES: GENRES, NAT: NAT, SK: SK, FX: FX, EV: EV, SIG: SIG, SONGS: SONGS, songErrors: songErrors, scaleNotes: scaleNotes, voiceChord: voiceChord, rootNear: rootNear, renderPiano: renderPiano, renderString: renderString }
        };
        W.__kdAudio = api;
    })();
