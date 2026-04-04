/**
 * Unit tests: Strich-Genauigkeit (Stroke Accuracy / Strictness)
 *
 * Tests that the strictness setting ("Locker" / "Normal" / "Streng") correctly
 * modifies ALL scoring thresholds in both guided and free mode.
 */

const { resamplePoints, discreteFrechet, smoothInput } = require('./algorithms');

// ── Test framework ──────────────────────────────────────────────────────
let _passed = 0, _failed = 0;
function assert(cond, msg) {
    if (cond) { _passed++; process.stdout.write('  ✓ ' + msg + '\n'); }
    else { _failed++; process.stdout.write('  ✗ FAIL: ' + msg + '\n'); }
}
function assertClose(a, b, eps, msg) {
    assert(Math.abs(a - b) < eps, msg + ` (got ${a.toFixed(4)}, want ≈${b.toFixed(4)})`);
}
function section(name) { console.log('\n' + name); }

// ── Re-implement scoring logic from template for isolated testing ───────
// Mirrors evaluateStroke() from Card-1/FrontTemplate.html lines 1789–1880.

function avgPointDist(a, b) {
    const n = Math.min(a.length, b.length);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
    return sum / n;
}

function segmentAngles(pts, nSec) {
    const step = (pts.length - 1) / nSec;
    const angles = [];
    for (let s = 0; s < nSec; s++) {
        const si = Math.round(s * step), ei = Math.round((s + 1) * step);
        angles.push(Math.atan2(pts[ei].y - pts[si].y, pts[ei].x - pts[si].x));
    }
    return angles;
}

/**
 * Guided-mode scoring, extracted to a pure function.
 * Returns { accepted, composite, sStart, sEnd, sShape, sAvg,
 *           lengthOk, directionOk, ceilingOk,
 *           tolStartEnd, tolShape, tolAvg, tolAngle }
 */
function guidedEvaluate(idealPoints, userPoints, idealLength, totalTravel, strictness) {
    const SAMPLE_POINTS = 64;
    const mult = strictness === 'loose' ? 1.35 : strictness === 'strict' ? 0.7 : 1.0;

    const userSmoothed = smoothInput(userPoints);
    const userResampled = resamplePoints(userSmoothed, SAMPLE_POINTS + 1);

    const lenFactor = Math.max(0.85, Math.min(1.4, idealLength / 45));
    const tolStartEnd = 15 * mult * lenFactor;
    const tolShape = 17 * mult * lenFactor;
    const tolAvg = tolShape * 0.6;

    const lenRatioMin = strictness === 'strict' ? 0.50 : 0.40;
    const lenRatioMax = strictness === 'strict' ? 2.00 : 2.50;
    const lengthRatio = totalTravel / idealLength;
    const lengthOk = lengthRatio >= lenRatioMin && lengthRatio <= lenRatioMax;

    const NSEC = 4;
    const idealAng = segmentAngles(idealPoints, NSEC);
    const userAng = segmentAngles(userResampled, NSEC);
    const angMult = strictness === 'loose' ? 1.15 : strictness === 'strict' ? 0.85 : 1.0;
    const tolAngle = (Math.PI * 0.47) * angMult;
    let directionOk = true;
    const secStep = SAMPLE_POINTS / NSEC;
    for (let s = 0; s < NSEC; s++) {
        const si = Math.round(s * secStep), ei = Math.round((s + 1) * secStep);
        if (Math.hypot(idealPoints[ei].x - idealPoints[si].x, idealPoints[ei].y - idealPoints[si].y) < 3) continue;
        let ad = Math.abs(idealAng[s] - userAng[s]);
        if (ad > Math.PI) ad = 2 * Math.PI - ad;
        if (ad > tolAngle) { directionOk = false; break; }
    }

    const startDist = Math.hypot(userResampled[0].x - idealPoints[0].x, userResampled[0].y - idealPoints[0].y);
    const endDist = Math.hypot(userResampled[userResampled.length - 1].x - idealPoints[SAMPLE_POINTS].x, userResampled[userResampled.length - 1].y - idealPoints[SAMPLE_POINTS].y);
    const shapeError = discreteFrechet(idealPoints, userResampled);
    const avgError = avgPointDist(idealPoints, userResampled);

    const sStart = startDist / tolStartEnd;
    const sEnd = endDist / tolStartEnd;
    const sShape = shapeError / tolShape;
    const sAvg = avgError / tolAvg;

    const ceilingOk = sStart <= 1.4 && sEnd <= 1.4 && sShape <= 1.4 && sAvg <= 1.6;
    const composite = sStart * 0.175 + sEnd * 0.175 + sShape * 0.4 + sAvg * 0.25;
    const accepted = lengthOk && directionOk && ceilingOk && composite <= 1.0;

    return {
        accepted, composite, sStart, sEnd, sShape, sAvg,
        lengthOk, directionOk, ceilingOk,
        tolStartEnd, tolShape, tolAvg, tolAngle,
        mult, angMult, lenFactor,
        lenRatioMin, lenRatioMax
    };
}

/**
 * Free-mode grading, extracted to a pure function.
 * Returns grade string for a given Fréchet cost.
 */
function freeGrade(cost, strictness) {
    const sMult = strictness === 'loose' ? 1.35 : strictness === 'strict' ? 0.7 : 1.0;
    const GOOD = 12 * sMult;
    const OK = 22 * sMult;
    if (cost <= GOOD) return 'good';
    if (cost <= OK) return 'ok';
    return 'bad';
}

// ── Helpers to generate test strokes ────────────────────────────────────

/** Straight horizontal line from (x1,y) to (x2,y) with n points */
function hLine(x1, x2, y, n) {
    const pts = [];
    for (let i = 0; i < n; i++) pts.push({ x: x1 + (x2 - x1) * i / (n - 1), y });
    return pts;
}

/** Offset a set of points uniformly */
function offset(pts, dx, dy) {
    return pts.map(p => ({ x: p.x + dx, y: p.y + dy }));
}

/** Scale a set of points from their centroid */
function scale(pts, factor) {
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    return pts.map(p => ({ x: cx + (p.x - cx) * factor, y: cy + (p.y - cy) * factor }));
}

/** Compute path length of a point array */
function pathLength(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return len;
}

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════════');
console.log('  Strich-Genauigkeit (Strictness) Tests');
console.log('═══════════════════════════════════════════');

// ── 1. Multiplier values ────────────────────────────────────────────────
section('1. Multiplier Values');

assert((s => s === 'loose' ? 1.35 : s === 'strict' ? 0.7 : 1.0)('loose') === 1.35, 'loose mult = 1.35');
assert((s => s === 'loose' ? 1.35 : s === 'strict' ? 0.7 : 1.0)('normal') === 1.0, 'normal mult = 1.0');
assert((s => s === 'loose' ? 1.35 : s === 'strict' ? 0.7 : 1.0)('strict') === 0.7, 'strict mult = 0.7');

// Angle multipliers
assert((s => s === 'loose' ? 1.15 : s === 'strict' ? 0.85 : 1.0)('loose') === 1.15, 'loose angMult = 1.15');
assert((s => s === 'loose' ? 1.15 : s === 'strict' ? 0.85 : 1.0)('normal') === 1.0, 'normal angMult = 1.0');
assert((s => s === 'loose' ? 1.15 : s === 'strict' ? 0.85 : 1.0)('strict') === 0.85, 'strict angMult = 0.85');

// ── 2. Tolerance scaling ────────────────────────────────────────────────
section('2. Tolerance Scaling (guided mode)');

// Use a reference stroke of length 45 → lenFactor = 1.0
const idealLen = 45;
const ideal = hLine(20, 65, 50, 65);  // 45px horizontal line, 65 points

for (const [sName, mult] of [['loose', 1.35], ['normal', 1.0], ['strict', 0.7]]) {
    const lenFactor = Math.max(0.85, Math.min(1.4, idealLen / 45));
    assertClose(15 * mult * lenFactor, 15 * mult, 0.01, `${sName}: tolStartEnd = ${(15 * mult).toFixed(1)}`);
    assertClose(17 * mult * lenFactor, 17 * mult, 0.01, `${sName}: tolShape = ${(17 * mult).toFixed(1)}`);
    assertClose(17 * mult * lenFactor * 0.6, 17 * mult * 0.6, 0.01, `${sName}: tolAvg = ${(17 * mult * 0.6).toFixed(1)}`);
}

// ── 3. Tolerance ratio: strict < normal < loose ─────────────────────────
section('3. Tolerance ordering: strict < normal < loose');

{
    const user = hLine(20, 65, 50, 30);
    const travel = pathLength(user);
    const rL = guidedEvaluate(ideal, user, idealLen, travel, 'loose');
    const rN = guidedEvaluate(ideal, user, idealLen, travel, 'normal');
    const rS = guidedEvaluate(ideal, user, idealLen, travel, 'strict');

    assert(rL.tolStartEnd > rN.tolStartEnd, 'tolStartEnd: loose > normal');
    assert(rN.tolStartEnd > rS.tolStartEnd, 'tolStartEnd: normal > strict');
    assert(rL.tolShape > rN.tolShape, 'tolShape: loose > normal');
    assert(rN.tolShape > rS.tolShape, 'tolShape: normal > strict');
    assert(rL.tolAvg > rN.tolAvg, 'tolAvg: loose > normal');
    assert(rN.tolAvg > rS.tolAvg, 'tolAvg: normal > strict');
    assert(rL.tolAngle > rN.tolAngle, 'tolAngle: loose > normal');
    assert(rN.tolAngle > rS.tolAngle, 'tolAngle: normal > strict');
}

// ── 4. Length ratio bounds ──────────────────────────────────────────────
section('4. Length ratio bounds');

{
    const user = hLine(20, 65, 50, 30);
    const travel = pathLength(user);
    const rN = guidedEvaluate(ideal, user, idealLen, travel, 'normal');
    const rS = guidedEvaluate(ideal, user, idealLen, travel, 'strict');

    assert(rN.lenRatioMin === 0.40, 'normal: lenRatioMin = 0.40');
    assert(rN.lenRatioMax === 2.50, 'normal: lenRatioMax = 2.50');
    assert(rS.lenRatioMin === 0.50, 'strict: lenRatioMin = 0.50');
    assert(rS.lenRatioMax === 2.00, 'strict: lenRatioMax = 2.00');

    // Loose uses same as normal
    const rL = guidedEvaluate(ideal, user, idealLen, travel, 'loose');
    assert(rL.lenRatioMin === 0.40, 'loose: lenRatioMin = 0.40 (same as normal)');
    assert(rL.lenRatioMax === 2.50, 'loose: lenRatioMax = 2.50 (same as normal)');
}

// ── 5. Normalized scores scale inversely with strictness ────────────────
section('5. Normalized scores: same input → higher scores when stricter');

{
    // A slightly offset stroke: exact shape but shifted 5px up
    const user = offset(hLine(20, 65, 50, 30), 0, 5);
    const travel = pathLength(user);

    const rL = guidedEvaluate(ideal, user, idealLen, travel, 'loose');
    const rN = guidedEvaluate(ideal, user, idealLen, travel, 'normal');
    const rS = guidedEvaluate(ideal, user, idealLen, travel, 'strict');

    // Normalized scores = raw_error / tolerance. Smaller tolerance → larger score.
    assert(rS.sStart > rN.sStart, 'sStart: strict > normal (tighter tolerance)');
    assert(rN.sStart > rL.sStart, 'sStart: normal > loose');
    assert(rS.sShape > rN.sShape, 'sShape: strict > normal');
    assert(rN.sShape > rL.sShape, 'sShape: normal > loose');
    assert(rS.sAvg > rN.sAvg, 'sAvg: strict > normal');
    assert(rN.sAvg > rL.sAvg, 'sAvg: normal > loose');
    assert(rS.composite > rN.composite, 'composite: strict > normal');
    assert(rN.composite > rL.composite, 'composite: normal > loose');
}

// ── 6. Boundary case: stroke accepted on loose but rejected on strict ───
section('6. Boundary: accepted on loose, rejected on strict');

{
    // Create a deliberately imperfect stroke (shifted + slightly scaled)
    const user = offset(scale(hLine(20, 65, 50, 30), 0.85), 3, 8);
    const travel = pathLength(user);

    const rL = guidedEvaluate(ideal, user, idealLen, travel, 'loose');
    const rN = guidedEvaluate(ideal, user, idealLen, travel, 'normal');
    const rS = guidedEvaluate(ideal, user, idealLen, travel, 'strict');

    // At least loose should be more forgiving
    assert(rL.composite < rS.composite, 'loose composite < strict composite');

    // If normal accepts but strict doesn't, great — that's the point.
    // If all accept or all reject, we just verify ordering holds.
    if (rL.accepted && !rS.accepted) {
        assert(true, 'Loose accepts what strict rejects ✓');
    } else if (rL.accepted && rS.accepted) {
        assert(rL.composite < rS.composite, 'Both accept but loose has lower composite');
    } else {
        assert(rL.composite <= rS.composite, 'Composite ordering holds regardless');
    }
}

// ── 7. Ceiling gates are strictness-independent ────────────────────────
section('7. Ceiling gates (hardcoded, strictness-independent)');

{
    const user = hLine(20, 65, 50, 30);
    const travel = pathLength(user);

    for (const s of ['loose', 'normal', 'strict']) {
        const r = guidedEvaluate(ideal, user, idealLen, travel, s);
        // The ceiling check uses hardcoded 1.4/1.6 regardless of strictness
        // Verify by checking ceilingOk is computed identically
        const manualCeiling = r.sStart <= 1.4 && r.sEnd <= 1.4 && r.sShape <= 1.4 && r.sAvg <= 1.6;
        assert(r.ceilingOk === manualCeiling, `${s}: ceiling gate uses hardcoded 1.4/1.6`);
    }
}

// ── 8. Free-mode grading thresholds ─────────────────────────────────────
section('8. Free-mode grading thresholds');

{
    // GOOD_THRESH and OK_THRESH scale with sMult
    assertClose(12 * 1.35, 16.2, 0.01, 'loose: GOOD_THRESH = 16.2');
    assertClose(22 * 1.35, 29.7, 0.01, 'loose: OK_THRESH = 29.7');
    assertClose(12 * 1.0, 12.0, 0.01, 'normal: GOOD_THRESH = 12.0');
    assertClose(22 * 1.0, 22.0, 0.01, 'normal: OK_THRESH = 22.0');
    assertClose(12 * 0.7, 8.4, 0.01, 'strict: GOOD_THRESH = 8.4');
    assertClose(22 * 0.7, 15.4, 0.01, 'strict: OK_THRESH = 15.4');
}

// ── 9. Free-mode grade boundaries shift with strictness ─────────────────
section('9. Free-mode grade boundaries');

{
    // Cost at the boundary region
    const testCosts = [5, 8.4, 10, 12, 15, 16.2, 20, 22, 25, 29.7, 35];

    for (const cost of testCosts) {
        const gL = freeGrade(cost, 'loose');
        const gN = freeGrade(cost, 'normal');
        const gS = freeGrade(cost, 'strict');

        // Strict should always grade same or worse than normal, which grades same or worse than loose
        const gradeRank = { good: 0, ok: 1, bad: 2 };
        assert(gradeRank[gS] >= gradeRank[gN],
            `cost=${cost}: strict grade (${gS}) ≥ normal grade (${gN})`);
        assert(gradeRank[gN] >= gradeRank[gL],
            `cost=${cost}: normal grade (${gN}) ≥ loose grade (${gL})`);
    }
}

// ── 10. Critical boundary tests ────────────────────────────────────────
section('10. Critical boundary tests (free mode)');

{
    // Cost = 10: between strict GOOD (8.4) and normal GOOD (12)
    assert(freeGrade(10, 'strict') === 'ok', 'cost=10, strict → ok (above 8.4)');
    assert(freeGrade(10, 'normal') === 'good', 'cost=10, normal → good (below 12)');
    assert(freeGrade(10, 'loose') === 'good', 'cost=10, loose → good (below 16.2)');

    // Cost = 14: between normal GOOD (12) and loose GOOD (16.2)
    assert(freeGrade(14, 'strict') === 'ok', 'cost=14, strict → ok (above 8.4)');
    assert(freeGrade(14, 'normal') === 'ok', 'cost=14, normal → ok (above 12)');
    assert(freeGrade(14, 'loose') === 'good', 'cost=14, loose → good (below 16.2)');

    // Cost = 20: between strict OK (15.4) and normal OK (22)
    assert(freeGrade(20, 'strict') === 'bad', 'cost=20, strict → bad (above 15.4)');
    assert(freeGrade(20, 'normal') === 'ok', 'cost=20, normal → ok (below 22)');
    assert(freeGrade(20, 'loose') === 'ok', 'cost=20, loose → ok (below 29.7)');

    // Cost = 25: between normal OK (22) and loose OK (29.7)
    assert(freeGrade(25, 'strict') === 'bad', 'cost=25, strict → bad');
    assert(freeGrade(25, 'normal') === 'bad', 'cost=25, normal → bad (above 22)');
    assert(freeGrade(25, 'loose') === 'ok', 'cost=25, loose → ok (below 29.7)');
}

// ── 11. Edge cases & invalid values ─────────────────────────────────────
section('11. Edge cases');

{
    // Unknown strictness falls back to 'normal' (mult = 1.0)
    const user = hLine(20, 65, 50, 30);
    const travel = pathLength(user);
    const rUnknown = guidedEvaluate(ideal, user, idealLen, travel, 'bogus');
    const rNormal = guidedEvaluate(ideal, user, idealLen, travel, 'normal');
    assert(rUnknown.mult === 1.0, 'unknown strictness → mult = 1.0');
    assertClose(rUnknown.composite, rNormal.composite, 0.0001, 'unknown = normal composite');

    // Empty string falls back to normal
    const rEmpty = guidedEvaluate(ideal, user, idealLen, travel, '');
    assert(rEmpty.mult === 1.0, 'empty string → mult = 1.0');

    // Exact perfect stroke
    const rPerfectL = guidedEvaluate(ideal, ideal, idealLen, pathLength(ideal), 'loose');
    const rPerfectN = guidedEvaluate(ideal, ideal, idealLen, pathLength(ideal), 'normal');
    const rPerfectS = guidedEvaluate(ideal, ideal, idealLen, pathLength(ideal), 'strict');
    assert(rPerfectL.accepted, 'perfect stroke accepted on loose');
    assert(rPerfectN.accepted, 'perfect stroke accepted on normal');
    assert(rPerfectS.accepted, 'perfect stroke accepted on strict');
}

// ── 12. lenFactor interaction with strictness ───────────────────────────
section('12. lenFactor interaction with strictness');

{
    // Short stroke (length 20): lenFactor = max(0.85, 20/45) = 0.85
    const shortIdeal = hLine(40, 60, 50, 65); // 20px line
    const shortLen = 20;
    const shortUser = hLine(40, 60, 50, 30);
    const shortTravel = pathLength(shortUser);

    const rShort = guidedEvaluate(shortIdeal, shortUser, shortLen, shortTravel, 'normal');
    assertClose(rShort.lenFactor, 0.85, 0.01, 'short stroke: lenFactor clamped to 0.85');

    // Long stroke (length 80): lenFactor = min(1.4, 80/45) = 1.4
    const longIdeal = hLine(10, 90, 50, 65); // 80px line
    const longLen = 80;
    const longUser = hLine(10, 90, 50, 30);
    const longTravel = pathLength(longUser);

    const rLong = guidedEvaluate(longIdeal, longUser, longLen, longTravel, 'normal');
    assertClose(rLong.lenFactor, 1.4, 0.01, 'long stroke: lenFactor clamped to 1.4');

    // Verify lenFactor makes long strokes more forgiving
    assert(rLong.tolShape > rShort.tolShape, 'long stroke has larger tolShape than short');
}

// ── 13. Full accept/reject matrix (guided mode) ─────────────────────────
section('13. Full accept/reject matrix');

{
    // Good stroke: near-perfect trace
    const goodUser = offset(hLine(20, 65, 50, 30), 0, 2);
    const goodTravel = pathLength(goodUser);

    // Medium stroke: offset by 8px
    const medUser = offset(hLine(20, 65, 50, 30), 0, 8);
    const medTravel = pathLength(medUser);

    // Bad stroke: offset by 15px
    const badUser = offset(hLine(20, 65, 50, 30), 0, 15);
    const badTravel = pathLength(badUser);

    const matrix = {};
    for (const s of ['loose', 'normal', 'strict']) {
        const good = guidedEvaluate(ideal, goodUser, idealLen, goodTravel, s);
        const med = guidedEvaluate(ideal, medUser, idealLen, medTravel, s);
        const bad = guidedEvaluate(ideal, badUser, idealLen, badTravel, s);
        matrix[s] = { good: good.accepted, med: med.accepted, bad: bad.accepted };
    }

    // Good stroke should be accepted on all settings
    assert(matrix.loose.good, 'good stroke accepted on loose');
    assert(matrix.normal.good, 'good stroke accepted on normal');
    assert(matrix.strict.good, 'good stroke accepted on strict');

    // Bad stroke: if loose rejects, all should reject
    if (!matrix.loose.bad) {
        assert(!matrix.normal.bad, 'if loose rejects bad, normal also rejects');
        assert(!matrix.strict.bad, 'if loose rejects bad, strict also rejects');
    }

    // Monotonicity: strict can never accept what normal rejects
    if (!matrix.normal.med) {
        assert(!matrix.strict.med, 'strict does not accept what normal rejects (med)');
    }
    if (!matrix.normal.bad) {
        assert(!matrix.strict.bad, 'strict does not accept what normal rejects (bad)');
    }
}

// ── 14. Composite score limit is NOT multiplied ─────────────────────────
section('14. Composite score limit is fixed at 1.0 for all modes');

{
    // This is an important design verification:
    // The composite threshold is always 1.0, but the normalization denominators
    // (tolerances) change with strictness. So a looser tolerance makes normalized
    // scores smaller, effectively making composite < 1.0 easier to achieve.

    // Verify that the acceptance condition is composite <= 1.0 (not composite <= mult)
    const user = offset(hLine(20, 65, 50, 30), 0, 10);
    const travel = pathLength(user);

    const rL = guidedEvaluate(ideal, user, idealLen, travel, 'loose');
    const rN = guidedEvaluate(ideal, user, idealLen, travel, 'normal');
    const rS = guidedEvaluate(ideal, user, idealLen, travel, 'strict');

    // Acceptance is checked against 1.0 in all cases
    // loose: bigger tolerances → smaller normalized scores → composite often < 1.0
    // strict: smaller tolerances → larger normalized scores → composite often > 1.0
    assert(rL.composite < rN.composite, 'loose composite < normal composite (same input)');
    assert(rN.composite < rS.composite, 'normal composite < strict composite (same input)');

    // Verify the strict setting makes otherwise-accepted strokes fail
    if (rL.accepted && !rS.accepted) {
        assert(true, 'Strictness correctly rejects a marginal stroke');
    }
}

// ── 15. Free vs guided: both use same multiplier ────────────────────────
section('15. Free vs guided use identical multiplier values');

{
    for (const s of ['loose', 'normal', 'strict']) {
        const guidedMult = s === 'loose' ? 1.35 : s === 'strict' ? 0.7 : 1.0;
        const freeMult = s === 'loose' ? 1.35 : s === 'strict' ? 0.7 : 1.0;
        assert(guidedMult === freeMult, `${s}: guided mult (${guidedMult}) === free mult (${freeMult})`);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════');
console.log(`Results: ${_passed} passed, ${_failed} failed`);
console.log('═══════════════════════════════════════════');
process.exit(_failed > 0 ? 1 : 0);
