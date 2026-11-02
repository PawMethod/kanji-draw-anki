// Repertoire: songs, their parsing and the plan of one rendition

// mel: bars split by '|', notes 'semitones above the tonic:beats' ('r' = rest); ch: chord per bar ('5m' = minor
// chord on the 4th degree, 'q' = sus4/open quartal colour), two chords split the bar. Public-domain melodies were
// transcribed from free scores (pianojuku.info, lalarieze.blogspot.com, co0-sky.com); th = landscapes it suits.
const CHT = { M: [0, 4, 7], m: [0, 3, 7], q: [0, 5, 7] };

class Song {
    constructor(def) {
        Object.assign(this, def);
        const chs = def.ch.split('|');
        let lo = 99, hi = -99;
        this.bars = def.mel.split('|').map((b, i) => {
            const notes = [];
            let t = 0;
            b.trim().split(/\s+/).forEach(tok => {
                const a = tok.split(':'), d = +a[1];
                if (a[0] !== 'r') { const p = +a[0]; notes.push({ b: t, p: p, d: d }); lo = Math.min(lo, p); hi = Math.max(hi, p); }
                t += d;
            });
            const segs = (chs[i] || chs[chs.length - 1]).trim().split(/\s+/), L = def.beats / segs.length;
            return {
                notes: notes, len: t, ch: segs.map((c, j) => {
                    const m = /^(-?\d+)([a-zA-Z])$/.exec(c) || [0, '0', 'M'];
                    return { r: +m[1], q: CHT[m[2]] ? m[2] : 'M', b0: j * L, len: L };
                })
            };
        });
        this.nb = this.bars.length; this.lo = lo; this.hi = hi; this.chn = chs.length;
    }
    // Transcription check for the selftest: every bar must fill the meter, one chord entry per bar
    errors() {
        const e = [];
        this.bars.forEach((b, i) => { if (Math.abs(b.len - this.beats) > 1e-6) e.push(this.id + ' bar ' + (i + 1) + ' = ' + b.len); });
        if (this.chn !== this.nb) e.push(this.id + ' chords ' + this.chn + ' / bars ' + this.nb);
        return e;
    }
    // Rendition: intro, verses with changing treatment, interlude, outro, a bar of silence.
    // Treatments: plain, orn (ornamented), het (heterophony: partner shadows the line), call (phrases alternate
    // between the pair), hi (partner sings, an octave up on koto/piano), frag (only every other bar — ma)
    plan(genre) {
        const vd = this.nb * this.beats * 60 / this.bpm, amb = genre === 'ambient', trs = shuffle(amb ? ['frag', 'het', 'call'] : ['orn', 'het', 'call', 'hi']);
        const pl = [{ k: 'in', n: 2 }, { k: 'v', n: this.nb, tr: amb ? 'frag' : 'plain' }];
        if (vd < 45) pl.push({ k: 'v', n: this.nb, tr: trs[0] }, { k: 'br', n: 4 }, { k: 'v', n: this.nb, tr: trs[1] });
        else pl.push({ k: 'br', n: 4 }, { k: 'v', n: this.nb, tr: trs[0] });
        pl.push({ k: 'out', n: 2 }, { k: 'ma', n: 1 });
        return pl;
    }
    // Weight for the next pick: suits the landscape and time of day, not heard recently
    weight(theme, dark, recent) {
        const x = (this.th.indexOf(theme) >= 0 ? 3 : 1) * (dark ? 0.4 + this.night : 1.4 - this.night);
        return recent.indexOf(this.id) >= 0 ? x * 0.04 : x;
    }
}

const SONGS = [
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
].map(d => new Song(d));
const SONG_BY = {};
SONGS.forEach(s => { SONG_BY[s.id] = s; });

function songErrors() { return SONGS.reduce((e, s) => e.concat(s.errors()), []); }
function pickSong(theme, dark, recent) {
    const w = SONGS.map(s => s.weight(theme, dark, recent)), sum = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return SONGS[i]; }
    return SONGS[0];
}
