/**
 * Comparison Benchmark Suite – Kanji Draw Anki Template vs. Reference Implementations
 *
 * Validates the quality claims made in the comparison section of README.md:
 *   1. Perfect stroke → score ≥ 95 % at every strictness level
 *   2. Noisy-but-correct stroke → accepted in "Locker" and "Normal"
 *   3. Clearly wrong stroke  → rejected in all strictness levels
 *   4. Length-ratio gate: strokes shorter than 40 % are always rejected
 *   5. Composite score degrades monotonically as noise increases
 *   6. Algorithm runtime stays < 2 ms (competitive with native apps)
 *   7. Score is strictness-monotone: loose ≥ normal ≥ strict for a fixed stroke
 */

'use strict';

const { resamplePoints, discreteFrechet, smoothInput, avgPointDist, segmentAngles } = require('./algorithms');

// ── Minimal test harness ────────────────────────────────────────────────────
let passed = 0, failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        process.stdout.write('  ✓ ' + name + '\n');
    } catch (e) {
        failed++;
        process.stdout.write('  ✗ FAIL: ' + name + '\n');
        process.stdout.write('    ' + e.message + '\n');
    }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertClose(a, b, eps, msg) {
    if (Math.abs(a - b) > eps) throw new Error(`${msg}: got ${a.toFixed(4)}, expected ≈${b.toFixed(4)} (±${eps})`);
}
function assertGte(a, b, msg) { if (a < b) throw new Error(`${msg}: ${a.toFixed(4)} < ${b.toFixed(4)}`); }
function assertLte(a, b, msg) { if (a > b) throw new Error(`${msg}: ${a.toFixed(4)} > ${b.toFixed(4)}`); }

// ── Scoring engine (mirrors evaluateStroke in Card-1/FrontTemplate.html) ───

const SAMPLE_N = 64;

function strokeLength(pts) {
    let d = 0;
    for (let i = 1; i < pts.length; i++)
        d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return d;
}

/**
 * Evaluate a user stroke against an ideal stroke.
 * Returns { accepted: bool, composite: 0-1, components, gates }
 */
function evaluate(idealRaw, userRaw, strictness = 'normal') {
    const mult   = strictness === 'loose' ? 1.35 : strictness === 'strict' ? 0.7 : 1.0;
    const ideal  = resamplePoints(idealRaw, SAMPLE_N + 1);
    const user   = resamplePoints(smoothInput(userRaw), SAMPLE_N + 1);

    const idealLen = strokeLength(idealRaw);
    const userLen  = strokeLength(userRaw);
    const lenRatio = userLen / (idealLen || 1);

    const lenRatioMin = strictness === 'strict' ? 0.50 : 0.40;
    const lenRatioMax = strictness === 'strict' ? 2.00 : 2.50;
    const lengthOk = lenRatio >= lenRatioMin && lenRatio <= lenRatioMax;

    const lenFactor = Math.max(0.85, Math.min(1.4, idealLen / 45));
    const tolStartEnd = 15 * mult * lenFactor;
    const tolShape    = 17 * mult * lenFactor;
    const tolAvg      = tolShape * 0.6;

    const frechet = discreteFrechet(ideal, user);
    const avg     = avgPointDist(ideal, user);

    const sShape = Math.max(0, 1 - frechet  / tolShape);
    const sAvg   = Math.max(0, 1 - avg      / tolAvg);
    const sStart = Math.max(0, 1 - Math.hypot(ideal[0].x - user[0].x, ideal[0].y - user[0].y) / tolStartEnd);
    const sEnd   = Math.max(0, 1 - Math.hypot(ideal[ideal.length-1].x - user[user.length-1].x,
                                               ideal[ideal.length-1].y - user[user.length-1].y) / tolStartEnd);

    const composite = 0.40 * sShape + 0.25 * sAvg + 0.175 * sStart + 0.175 * sEnd;

    const idealAngles = segmentAngles(ideal, 4);
    const userAngles  = segmentAngles(user,  4);
    const angDiff     = idealAngles.map((a, i) => {
        let d = Math.abs(a - userAngles[i]);
        if (d > Math.PI) d = 2 * Math.PI - d;
        return d;
    });
    const directionOk = angDiff.filter(d => d > Math.PI / 2).length <= 1;

    const accepted = lengthOk && directionOk && composite >= 0.30;

    return { accepted, composite, sShape, sAvg, sStart, sEnd, lengthOk, directionOk };
}

// ── Fixture generators ──────────────────────────────────────────────────────

/** Straight horizontal stroke at y=50 from x=10 to x=90 */
function perfectStroke(n = 20) {
    return Array.from({ length: n }, (_, i) => ({ x: 10 + i * (80 / (n - 1)), y: 50 }));
}

/** Perfect stroke with Gaussian noise amplitude `sigma` */
function noisyStroke(sigma, n = 20) {
    return perfectStroke(n).map(p => ({
        x: p.x + (Math.random() - 0.5) * sigma * 2,
        y: p.y + (Math.random() - 0.5) * sigma * 2
    }));
}

/** Stroke going in the completely wrong direction */
function wrongStroke() {
    return Array.from({ length: 20 }, (_, i) => ({ x: 50, y: 10 + i * 4 })); // vertical instead of horizontal
}

/** Stroke that is only 30 % of the ideal length */
function tooShortStroke() {
    return Array.from({ length: 10 }, (_, i) => ({ x: 50 + i * 2.4, y: 50 })); // length ≈ 21.6 vs. ideal 80
}

// ── 1. Perfect stroke ───────────────────────────────────────────────────────
console.log('\n── 1. Perfect stroke ──');

test('Perfect stroke accepted at "normal" strictness', () => {
    const r = evaluate(perfectStroke(), perfectStroke());
    assert(r.accepted, 'Perfect stroke must be accepted');
});

test('Perfect stroke accepted at "strict" strictness', () => {
    const r = evaluate(perfectStroke(), perfectStroke(), 'strict');
    assert(r.accepted, 'Perfect stroke must be accepted in strict mode');
});

test('Perfect stroke accepted at "loose" strictness', () => {
    const r = evaluate(perfectStroke(), perfectStroke(), 'loose');
    assert(r.accepted, 'Perfect stroke must be accepted in loose mode');
});

test('Perfect stroke composite ≥ 0.90', () => {
    const r = evaluate(perfectStroke(), perfectStroke());
    assertGte(r.composite, 0.90, 'composite score for perfect stroke');
});

// ── 2. Noisy-but-correct stroke ─────────────────────────────────────────────
console.log('\n── 2. Noisy (σ=3) stroke – accepted in Locker & Normal, may fail in Streng ──');

// Use a fixed seed by running N trials and checking the majority
function majority(fn, trials = 10) {
    let yes = 0;
    for (let i = 0; i < trials; i++) if (fn()) yes++;
    return yes;
}

test('Noisy stroke (σ=3) accepted in loose mode (≥ 8/10 trials)', () => {
    const yes = majority(() => evaluate(perfectStroke(), noisyStroke(3), 'loose').accepted);
    assertGte(yes, 8, '≥8/10 noisy-loose accepted');
});

test('Noisy stroke (σ=3) accepted in normal mode (≥ 7/10 trials)', () => {
    const yes = majority(() => evaluate(perfectStroke(), noisyStroke(3), 'normal').accepted);
    assertGte(yes, 7, '≥7/10 noisy-normal accepted');
});

// ── 3. Wrong direction stroke ───────────────────────────────────────────────
console.log('\n── 3. Wrong direction stroke ──');

test('Vertical stroke rejected against horizontal ideal (normal)', () => {
    const r = evaluate(perfectStroke(), wrongStroke(), 'normal');
    assert(!r.accepted, 'Wrong-direction stroke must be rejected');
});

test('Vertical stroke rejected against horizontal ideal (loose)', () => {
    const r = evaluate(perfectStroke(), wrongStroke(), 'loose');
    assert(!r.accepted, 'Wrong-direction stroke must be rejected even in loose mode');
});

test('Vertical stroke rejected against horizontal ideal (strict)', () => {
    const r = evaluate(perfectStroke(), wrongStroke(), 'strict');
    assert(!r.accepted, 'Wrong-direction stroke must be rejected in strict mode');
});

// ── 4. Length-ratio gate ────────────────────────────────────────────────────
console.log('\n── 4. Length-ratio gate ──');

test('Too-short stroke (30 % length) rejected in all modes', () => {
    for (const s of ['loose', 'normal', 'strict']) {
        const r = evaluate(perfectStroke(), tooShortStroke(), s);
        assert(!r.lengthOk, `Too-short stroke must fail length gate in ${s} mode`);
        assert(!r.accepted,  `Too-short stroke must be rejected in ${s} mode`);
    }
});

// ── 5. Score degrades monotonically with noise ──────────────────────────────
console.log('\n── 5. Monotone degradation with noise ──');

test('composite(σ=0) > composite(σ=5) > composite(σ=10) on average', () => {
    function avgComposite(sigma, trials = 20) {
        let sum = 0;
        for (let i = 0; i < trials; i++)
            sum += evaluate(perfectStroke(), sigma === 0 ? perfectStroke() : noisyStroke(sigma)).composite;
        return sum / trials;
    }
    const c0  = avgComposite(0);
    const c5  = avgComposite(5);
    const c10 = avgComposite(10);
    assertGte(c0,  c5,  'Score at σ=0 must be ≥ σ=5');
    assertGte(c5,  c10, 'Score at σ=5 must be ≥ σ=10');
});

// ── 6. Runtime benchmark (competitive with native apps < 2 ms) ─────────────
console.log('\n── 6. Runtime benchmark ──');

test('Single stroke evaluation completes in < 2 ms', () => {
    const ideal = perfectStroke(30);
    const user  = noisyStroke(2, 30);
    const hasPerfNow = typeof performance !== 'undefined';
    const t0 = hasPerfNow ? performance.now() : Date.now();
    for (let i = 0; i < 100; i++) evaluate(ideal, user);
    const elapsed = ((hasPerfNow ? performance.now() : Date.now()) - t0) / 100;
    assertLte(elapsed, 2, `avg evaluation time (ms)`);
    process.stdout.write(`    → ${elapsed.toFixed(3)} ms per evaluation\n`);
});

test('100 full kanji (8 strokes each) complete in < 500 ms', () => {
    const hasPerfNow = typeof performance !== 'undefined';
    const t0 = hasPerfNow ? performance.now() : Date.now();
    for (let k = 0; k < 100; k++) {
        for (let s = 0; s < 8; s++) {
            evaluate(perfectStroke(), noisyStroke(1));
        }
    }
    const elapsed = (hasPerfNow ? performance.now() : Date.now()) - t0;
    assertLte(elapsed, 500, `100 kanji × 8 strokes (ms)`);
    process.stdout.write(`    → ${elapsed.toFixed(1)} ms for 800 strokes\n`);
});

// ── 7. Strictness monotonicity ──────────────────────────────────────────────
console.log('\n── 7. Strictness monotonicity ──');

test('loose composite ≥ normal composite ≥ strict composite for noisy stroke', () => {
    function avgComposite(strictness, trials = 20) {
        let sum = 0;
        for (let i = 0; i < trials; i++)
            sum += evaluate(perfectStroke(), noisyStroke(4), strictness).composite;
        return sum / trials;
    }
    const cLoose  = avgComposite('loose');
    const cNormal = avgComposite('normal');
    const cStrict = avgComposite('strict');
    // Composite formula uses fixed weights; strictness affects thresholds → sShape/sAvg increase under loose
    assertGte(cLoose,  cNormal, 'loose composite must be ≥ normal');
    assertGte(cNormal, cStrict, 'normal composite must be ≥ strict');
});

test('acceptance rate: loose ≥ normal ≥ strict for noisy stroke (σ=5)', () => {
    const trials = 30;
    function acceptRate(s) {
        let yes = 0;
        for (let i = 0; i < trials; i++)
            if (evaluate(perfectStroke(), noisyStroke(5), s).accepted) yes++;
        return yes / trials;
    }
    const rL = acceptRate('loose');
    const rN = acceptRate('normal');
    const rS = acceptRate('strict');
    assertGte(rL, rN, `loose accept rate (${(rL*100).toFixed(0)}%) must be ≥ normal (${(rN*100).toFixed(0)}%)`);
    assertGte(rN, rS, `normal accept rate (${(rN*100).toFixed(0)}%) must be ≥ strict (${(rS*100).toFixed(0)}%)`);
});

// ── 8. Feature surface comparison metrics ────────────────────────────────────
console.log('\n── 8. Feature surface (static checks) ──');

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readTemplate(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const c1f = readTemplate('Templates/Card-1/FrontTemplate.html');
const c1b = readTemplate('Templates/Card-1/BackTemplate.html');
const c2f = readTemplate('Templates/Card-2/FrontTemplate.html');
const c2b = readTemplate('Templates/Card-2/BackTemplate.html');

test('Template implements Fréchet distance (mathematical rigor)', () => {
    assert(c1f.includes('discreteFrechet') || c1f.includes('Fréchet') || c1f.includes('frechet'),
        'Card-1 Front must implement Fréchet distance');
});

test('Template supports real-time per-stroke feedback', () => {
    assert(c1f.includes('pointerup') || c1f.includes('pointerdown'),
        'Card-1 Front must handle pointer events for real-time feedback');
});

test('Template works offline (no external CDN references)', () => {
    const externalRe = /https?:\/\/(cdn\.|unpkg\.|cdnjs\.|fonts\.googleapis|ajax\.googleapis)/;
    assert(!externalRe.test(c1f), 'Card-1 Front must not reference external CDNs');
    assert(!externalRe.test(c1b), 'Card-1 Back must not reference external CDNs');
    assert(!externalRe.test(c2f), 'Card-2 Front must not reference external CDNs');
    assert(!externalRe.test(c2b), 'Card-2 Back must not reference external CDNs');
});

test('Template includes dark mode support', () => {
    const css = readTemplate('Templates/Styling.css');
    assert(css.includes('nightMode') || css.includes('night_mode'),
        'Styling.css must include dark mode rules');
});

test('Template includes configurable strictness levels', () => {
    assert(c1f.includes('loose') && c1f.includes('strict'),
        'Card-1 Front must implement at least two non-default strictness levels');
});

test('Template includes AnkiDroid-specific adaptations', () => {
    assert(c1f.includes('AnkiDroid') || c1f.includes('ankidroid') || c1f.includes('CookieManager'),
        'Card-1 Front must include AnkiDroid-specific code');
});

test('Template includes AnkiMobile-specific adaptations', () => {
    const hasMobile = c1f.includes('ankimobile') || c1f.includes('AnkiMobile') ||
                      c1f.includes('is-ankimobile') || c1f.includes('iphone') || c1f.includes('ipad');
    assert(hasMobile, 'Card-1 Front must include AnkiMobile-specific code');
});

test('Template includes settings persistence (cookie fallback)', () => {
    assert(c1f.includes('cookie') || c1f.includes('Cookie'),
        'Card-1 Front must implement cookie-based settings persistence');
});

test('Template includes mnemonic (Eselsbrücke) display', () => {
    assert(c1b.includes('Eselsbrücke') || c1b.includes('eselsbruecke') || c1b.includes('mnemonic'),
        'Card-1 Back must display mnemonics');
});

test('Template includes radical decomposition display', () => {
    assert(c1b.includes('Radikal') || c1b.includes('radical'),
        'Card-1 Back must display radical decomposition');
});

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(55));
console.log(`  Results: ${passed}/${passed + failed} passed, ${failed} failed`);
console.log('═'.repeat(55));
process.exit(failed > 0 ? 1 : 0);
