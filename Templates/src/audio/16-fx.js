// UI effects, in the key of the running song (else a neutral Yo mode)

function ks() { const top = live(); return top && top.song ? top : { k: 4, scale: [0, 2, 5, 7, 9] }; }
function fxNotes(lo, hi) { return scaleNotes(ks(), lo, hi); }
const FX = {
    tap(t) { wood(FXD(), t, 1350, 0.035); },
    tick(t) { wood(FXD(), t, 1900, 0.022); },
    select(t) { tone('celesta', FXD(), t, pick(fxNotes(79, 91)), 0.026, { wet: 0.25 }); wood(FXD(), t, 1500, 0.014); },
    open(t) {
        const r = rootNear(ks(), 84);
        swish(FXD(), t, 600, 2200, 0.22, 0.026);
        tone('celesta', FXD(), t + 0.06, r, 0.024, { wet: 0.35 }); tone('glass', FXD(), t + 0.06, r + 7, 0.01, { wet: 0.5 });
    },
    close(t) { swish(FXD(), t, 2000, 650, 0.2, 0.024); tone('celesta', FXD(), t + 0.04, rootNear(ks(), 79), 0.018, { wet: 0.3 }); },
    nav(t) { const n = fxNotes(76, 96), i = nearestIdx(n, 81); tone('celesta', FXD(), t, n[i], 0.022, { wet: 0.25 }); tone('celesta', FXD(), t + 0.07, n[Math.min(n.length - 1, i + 2)], 0.018, { wet: 0.25 }); },
    back(t) { const n = fxNotes(76, 96), i = nearestIdx(n, 86); tone('celesta', FXD(), t, n[i], 0.02, { wet: 0.25 }); tone('celesta', FXD(), t + 0.07, n[Math.max(0, i - 2)], 0.018, { wet: 0.25 }); },
    tab(t) { wood(FXD(), t, 1100, 0.03); },
    page(t) {
        noiseHit(FXD(), t, { type: 'bandpass', f: 1800, f2: 3800, q: 0.9, dur: 0.12, att: 0.03, vel: 0.03 });
        noiseHit(FXD(), t + 0.09, { type: 'bandpass', f: 3200, f2: 1500, q: 1, dur: 0.16, att: 0.02, vel: 0.022 });
    },
    play(t) { pluck(FXD(), t, rootNear(ks(), 79), 0.035, { decay: 1, bright: 7, wet: 0.3, pick: true }); },
    reveal(t) {
        const n = fxNotes(76, 96), i0 = nearestIdx(n, 79);
        for (let i = 0; i < 3; i++) tone(i < 2 ? 'celesta' : 'glass', FXD(), t + i * 0.06, n[Math.min(n.length - 1, i0 + i)], 0.026 - i * 0.004, { wet: 0.45 });
    },
    hide(t) {
        const n = fxNotes(76, 96), i0 = nearestIdx(n, 84);
        for (let i = 0; i < 2; i++) tone('celesta', FXD(), t + i * 0.07, n[Math.max(0, i0 - i)], 0.018, { wet: 0.35 });
    },
    hint(t) { const r = rootNear(ks(), 79); tone('glass', FXD(), t, r + 7, 0.024, { wet: 0.5 }); tone('glass', FXD(), t + 0.14, r, 0.022, { wet: 0.5 }); },
    reset(t) {
        noiseHit(FXD(), t, { kind: 'pink', type: 'bandpass', f: 2600, f2: 500, q: 0.9, dur: 0.45, att: 0.05, vel: 0.03, wet: 0.3 });
        pluck(FXD(), t + 0.3, rootNear(ks(), 55), 0.05, { decay: 0.6, bright: 4, wet: 0.3 });
    },
    undo(t) { const n = fxNotes(67, 88), i = nearestIdx(n, 79); pluck(FXD(), t, n[i], 0.03, { decay: 0.8, bright: 7, wet: 0.25, pick: true }); pluck(FXD(), t + 0.08, n[Math.max(0, i - 2)], 0.025, { decay: 0.8, bright: 7, wet: 0.25 }); },
    skip(t) { swish(FXD(), t, 500, 1900, 0.3, 0.028); tone('glass', FXD(), t + 0.2, rootNear(ks(), 79), 0.02, { wet: 0.45 }); },
    cardFront(t) { swish(FXD(), t, 800, 1700, 0.26, 0.05); },
    // Kanji tree: the deeper the primitive, the higher the tone
    node(t, depth) {
        const n = fxNotes(72, 96), i = clamp(1 + 2 * (depth || 0), 0, n.length - 1);
        tone('celesta', FXD(), t, n[i], 0.022, { wet: 0.35 });
        tone('glass', FXD(), t + 0.05, n[Math.min(n.length - 1, i + 2)], 0.008, { wet: 0.5 });
    },
    nodeOff(t) { const n = fxNotes(67, 84); tone('celesta', FXD(), t, n[nearestIdx(n, 76)], 0.012, { wet: 0.3 }); },
    // Furigana: a short koto upturn when the reading appears, one soft note when it hides
    furigana(t) {
        const n = fxNotes(67, 88), i = nearestIdx(n, 74);
        pluck(FXD(), t, n[i], 0.03, { decay: 0.9, bright: 7, wet: 0.3, pick: true });
        pluck(FXD(), t + 0.07, n[Math.min(n.length - 1, i + 2)], 0.026, { decay: 1.1, bright: 7, wet: 0.35 });
    },
    furiganaOff(t) { const n = fxNotes(67, 88); pluck(FXD(), t, n[nearestIdx(n, 76)], 0.02, { decay: 0.7, bright: 5, wet: 0.3 }); },
    // Pitfall card: a soft wood tap and a koto note one scale step higher per card
    pitfall(t, i) {
        const n = fxNotes(64, 91), k = clamp(nearestIdx(n, 69) + (i || 0), 0, n.length - 1);
        wood(FXD(), t, 1250, 0.016);
        pluck(FXD(), t + 0.015, n[k], 0.028, { decay: 0.9, bright: 6, wet: 0.3, pick: true });
    },
    cardBack(t) {
        const r = rootNear(ks(), 76);
        swish(FXD(), t, 500, 2100, 0.34, 0.016);
        tone('glass', FXD(), t + 0.07, r, 0.026, { wet: 0.6, echo: 0.2 });
        tone('celesta', FXD(), t + 0.16, r + 7, 0.016, { wet: 0.5 });
    }
};
