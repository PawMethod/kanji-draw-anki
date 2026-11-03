// Configuration tables: levels, landscapes, nature, stroke voices, rooms, instruments

const LEVEL = { off: 0, low: 0.4, mid: 0.7, high: 1 };
const MLEVEL = { low: 0.45, mid: 0.7, high: 1 };
// A landscape only colours the music: key, scale and tempo belong to the song
const THEMES = {
    neutral: { bright: 1, sig: 'koto' }, warm: { bright: 0.95, sig: 'shamisen' }, cool: { bright: 0.9, sig: 'suikin' },
    sepia: { bright: 0.85, sig: 'biwa' }, rose: { bright: 1.05, sig: 'furin' }, sage: { bright: 0.95, sig: 'mokugyo' },
    hokkaido: { bright: 1.15, sig: 'taiko' }, tokyo: { bright: 0.9, sig: 'hyoshigi' }, okinawa: { bright: 1.05, sig: 'paranku' }
};
// Soundscape per theme: continuous layers (0..1) + events per minute
const NAT = {
    neutral: { d: { wind: 0.5, ev: { chirp: 4, crane: 0.6, kakko: 0.8, karasu: 0.4 } }, n: { wind: 0.55, ev: { cricket: 9, owl: 0.5, higurashi: 0.8 } } },
    warm: { d: { water: 0.3, wind: 0.2, ev: { chirp: 3, furin: 2, bell: 0.4, minmin: 1.2, suikin: 2 } }, n: { water: 0.25, ev: { frog: 5, cricket: 4, bell: 0.3, higurashi: 1.5 } } },
    cool: { d: { water: 0.3, ev: { drip: 4, chirp: 1.5, suikin: 3, kakko: 0.5 } }, n: { water: 0.28, ev: { drip: 4, cricket: 4, kajika: 2.5 } } },
    sepia: { d: { wind: 0.68, leaves: 0.5, ev: { chirp: 1.5, bell: 0.3, karasu: 0.8, higurashi: 1 } }, n: { wind: 0.5, leaves: 0.35, ev: { cricket: 14, higurashi: 1, bell: 0.3 } } },
    rose: { d: { wind: 0.5, ev: { uguisu: 1.5, chirp: 4, hototogisu: 0.6 } }, n: { wind: 0.55, ev: { frog: 5, cricket: 2, hototogisu: 0.5 } } },
    sage: { d: { wind: 0.55, leaves: 0.5, ev: { knock: 2, shishi: 0.8, chirp: 2, kakko: 0.8, suikin: 1.5 } }, n: { wind: 0.45, leaves: 0.35, ev: { shishi: 0.8, cricket: 6, owl: 0.3, bell: 0.3 } } },
    hokkaido: { d: { wind: 0.6, ev: { tinkle: 3, chirp: 0.6, karasu: 0.5, crane: 0.5 } }, n: { wind: 0.6, ev: { owl: 0.7, tinkle: 1 } } },
    tokyo: { d: { city: 0.05, ev: { car: 1.5, train: 0.5, chirp: 1, karasu: 1.2, fumikiri: 0.4, minmin: 0.6 } }, n: { city: 0.04, ev: { car: 1, train: 0.4, fumikiri: 0.3, cricket: 2 } } },
    okinawa: { d: { waves: 0.5, wind: 0.2, ev: { furin: 1.5, chirp: 0.8, minmin: 1 } }, n: { waves: 0.45, ev: { cricket: 6, frog: 2 } } }
};
// Continuous-layer calibration (pre-scene gain)
const K = { wind: 0.9, leaves: 0.06, water: 0.6, waves: 0.75, foam: 0.05, rain: 0.17, city: 1 };
// Stroke voices: base hum, speed gain, filter range, release
const SK = {
    standard: { base: 0, k: 0.5, f0: 1300, f1: 2500, rel: 0.035 },
    gel: { base: 0, k: 0.5, f0: 1300, f1: 2400, rel: 0.04 },
    ink: { base: 0, k: 0.48, f0: 650, f1: 2100, rel: 0.06 },
    neon: { base: 0, k: 0.03, f0: 500, f1: 1600, rel: 0.12 }
};
// Acoustic space per theme: reverb send, reverb damping (Hz), echo send
const SPACE = {
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
const IMM = { off: 0, low: 1, high: 2 };
// Melodic contour over the strokes of a kanji (indices into the scale tones of the register)
const CONTOUR = [0, 1, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 3, 4, 2, 3];
// Register of the answering voice per genre
const LEADR = { ambient: [72, 93], zen: [62, 86], piano: [67, 88], lofi: [62, 84], nature: [74, 96] };
// Instrument pair per landscape (lead, partner); each change of landscape picks one (the first is the most likely)
const VOPT = {
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
const VREG = { koto: [62, 86], shamisen: [60, 81], biwa: [50, 72], sanshin: [60, 81], shaku: [62, 81], fue: [74, 93], piano: [64, 86] };
// Velocity scale per instrument, loudness-matched: sustained flutes need far less than decaying strings, the piano sample much more
const VK = { koto: 1.5, shamisen: 1.25, biwa: 1.35, sanshin: 1.4, shaku: 0.5, fue: 0.38, piano: 3.6 };
const STR = { koto: 1, shamisen: 1, biwa: 1, sanshin: 1 };
// Pen resonance: register and makeup gain per stroke style
const RES = { standard: { lo: 76, hi: 91, k: 1.1 }, gel: { lo: 79, hi: 93, k: 1.3 }, ink: { lo: 69, hi: 84, k: 1 }, neon: { lo: 74, hi: 89, k: 0.8 } };
// Jo-ha-kyū: kanji completed per cycle and stage boundaries; a new landscape takes effect once it has settled
const CYCLE = 8, STAGE_AT = [2, 6], SETTLE = 2500;
// Arrangement density 0..4 → tone filter and nature-event rate
const TONEMUL = [0.62, 0.8, 1, 1.12, 1.45], EVMUL = [0.55, 0.8, 1, 1.15, 1.3];
