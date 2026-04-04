const assert = require('assert');
const {
    resamplePoints,
    discreteFrechet,
    avgPointDist,
    segmentAngles,
    smoothInput,
    hungarianMatch
} = require('./algorithms');

let passed = 0, failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (e) {
        failed++;
        console.error(`  ✗ ${name}`);
        console.error(`    ${e.message}`);
    }
}

function approxEqual(a, b, eps = 1e-6) {
    if (Math.abs(a - b) > eps) throw new Error(`Expected ${a} ≈ ${b} (diff: ${Math.abs(a - b)})`);
}

// =======================================================================
// resamplePoints
// =======================================================================

console.log('\n--- resamplePoints ---');

test('empty input returns empty', () => {
    const result = resamplePoints([], 10);
    assert.deepStrictEqual(result, []);
});

test('single point returns single point', () => {
    const result = resamplePoints([{ x: 5, y: 5 }], 10);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].x, 5);
});

test('two points resampled to n equidistant points', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const result = resamplePoints(pts, 11);
    assert.strictEqual(result.length, 11);
    for (let i = 0; i < 11; i++) {
        approxEqual(result[i].x, i);
        approxEqual(result[i].y, 0);
    }
});

test('preserves first and last point', () => {
    const pts = [{ x: 1, y: 2 }, { x: 5, y: 5 }, { x: 10, y: 8 }];
    const result = resamplePoints(pts, 20);
    assert.strictEqual(result.length, 20);
    approxEqual(result[0].x, 1);
    approxEqual(result[0].y, 2);
    approxEqual(result[result.length - 1].x, 10);
    approxEqual(result[result.length - 1].y, 8);
});

test('all-same points returns single point', () => {
    const pts = [{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }];
    const result = resamplePoints(pts, 10);
    assert.strictEqual(result.length, 1);
});

test('diagonal line resampled correctly', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
    const result = resamplePoints(pts, 5);
    assert.strictEqual(result.length, 5);
    const expectedStep = 100 / 4;
    for (let i = 0; i < 5; i++) {
        approxEqual(result[i].x, i * expectedStep, 0.01);
        approxEqual(result[i].y, i * expectedStep, 0.01);
    }
});

// =======================================================================
// discreteFrechet
// =======================================================================

console.log('\n--- discreteFrechet ---');

test('identical curves return 0', () => {
    const pts = [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }];
    approxEqual(discreteFrechet(pts, pts), 0);
});

test('symmetric: d(P,Q) == d(Q,P)', () => {
    const P = [{ x: 0, y: 0 }, { x: 5, y: 5 }];
    const Q = [{ x: 1, y: 1 }, { x: 6, y: 6 }];
    approxEqual(discreteFrechet(P, Q), discreteFrechet(Q, P));
});

test('parallel shifted lines', () => {
    const P = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const Q = [{ x: 0, y: 5 }, { x: 10, y: 5 }];
    approxEqual(discreteFrechet(P, Q), 5);
});

test('different length inputs', () => {
    const P = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }];
    const Q = [{ x: 0, y: 1 }, { x: 10, y: 1 }];
    const d = discreteFrechet(P, Q);
    assert(d >= 1, `Fréchet distance should be >= 1, got ${d}`);
});

test('single point curves', () => {
    const P = [{ x: 0, y: 0 }];
    const Q = [{ x: 3, y: 4 }];
    approxEqual(discreteFrechet(P, Q), 5); // 3-4-5 triangle
});

test('Fréchet is always >= Hausdorff', () => {
    const P = resamplePoints([{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }], 20);
    const Q = resamplePoints([{ x: 0, y: 10 }, { x: 50, y: 60 }, { x: 100, y: 10 }], 20);
    const frechet = discreteFrechet(P, Q);
    // Hausdorff = max of min distances
    let hausdorff = 0;
    for (const p of P) {
        let minD = Infinity;
        for (const q of Q) minD = Math.min(minD, Math.hypot(p.x - q.x, p.y - q.y));
        hausdorff = Math.max(hausdorff, minD);
    }
    for (const q of Q) {
        let minD = Infinity;
        for (const p of P) minD = Math.min(minD, Math.hypot(p.x - q.x, p.y - q.y));
        hausdorff = Math.max(hausdorff, minD);
    }
    assert(frechet >= hausdorff - 1e-6, `Fréchet ${frechet} should be >= Hausdorff ${hausdorff}`);
});

// =======================================================================
// avgPointDist
// =======================================================================

console.log('\n--- avgPointDist ---');

test('identical points return 0', () => {
    const pts = [{ x: 0, y: 0 }, { x: 5, y: 5 }];
    approxEqual(avgPointDist(pts, pts), 0);
});

test('uniform offset', () => {
    const P = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const Q = [{ x: 0, y: 3 }, { x: 10, y: 3 }];
    approxEqual(avgPointDist(P, Q), 3);
});

test('handles unequal lengths (uses shorter)', () => {
    const P = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];
    const Q = [{ x: 0, y: 4 }, { x: 10, y: 4 }];
    approxEqual(avgPointDist(P, Q), 4);
});

// =======================================================================
// segmentAngles
// =======================================================================

console.log('\n--- segmentAngles ---');

test('horizontal line has 0 angle', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const angles = segmentAngles(pts, 1);
    assert.strictEqual(angles.length, 1);
    approxEqual(angles[0], 0);
});

test('vertical down has PI/2 angle', () => {
    const pts = [{ x: 0, y: 0 }, { x: 0, y: 10 }];
    const angles = segmentAngles(pts, 1);
    approxEqual(angles[0], Math.PI / 2);
});

test('4-segment angles for an L-shape', () => {
    const pts = resamplePoints([
        { x: 0, y: 0 }, { x: 0, y: 50 }, { x: 50, y: 50 }
    ], 20);
    const angles = segmentAngles(pts, 4);
    assert.strictEqual(angles.length, 4);
    // First segments should be roughly downward (PI/2), last segments rightward (0)
    assert(angles[0] > Math.PI / 4, `First angle ${angles[0]} should be > PI/4`);
    assert(angles[3] < Math.PI / 4, `Last angle ${angles[3]} should be < PI/4`);
});

// =======================================================================
// smoothInput
// =======================================================================

console.log('\n--- smoothInput ---');

test('fewer than 3 points returned as-is', () => {
    const pts = [{ x: 0, y: 0 }, { x: 5, y: 5 }];
    const result = smoothInput(pts);
    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result, pts);
});

test('preserves first and last point', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 10, y: 10 }];
    const result = smoothInput(pts);
    assert.strictEqual(result[0].x, 0);
    assert.strictEqual(result[result.length - 1].x, 10);
});

test('smoothing reduces interior jitter', () => {
    // Create a line with jitter (exclude endpoints from extremes)
    const jittery = [{ x: 0, y: 0 }];
    for (let i = 1; i < 19; i++) {
        jittery.push({ x: i * 5, y: (i % 2 === 0 ? 10 : -10) });
    }
    jittery.push({ x: 100, y: 0 });
    const smoothed = smoothInput(jittery);
    // Interior smoothed points should have smaller y-variance than original
    const origInterior = jittery.slice(1, -1);
    const smoothInterior = smoothed.slice(1, -1);
    const origVar = origInterior.reduce((s, p) => s + p.y * p.y, 0) / origInterior.length;
    const smoothVar = smoothInterior.reduce((s, p) => s + p.y * p.y, 0) / smoothInterior.length;
    assert(smoothVar < origVar, `Smoothed variance ${smoothVar.toFixed(1)} should be < original ${origVar.toFixed(1)}`);
});

test('idempotent on straight line', () => {
    const pts = [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }];
    const result = smoothInput(pts);
    for (let i = 0; i < pts.length; i++) {
        approxEqual(result[i].x, pts[i].x, 0.01);
        approxEqual(result[i].y, pts[i].y, 0.01);
    }
});

// =======================================================================
// hungarianMatch
// =======================================================================

console.log('\n--- hungarianMatch ---');

test('empty matrix returns empty', () => {
    assert.deepStrictEqual(hungarianMatch([]), []);
});

test('1x1 matrix returns single assignment', () => {
    const result = hungarianMatch([[5]]);
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0], [0, 0]);
});

test('identity assignment for diagonal matrix', () => {
    const cost = [
        [1, 100, 100],
        [100, 1, 100],
        [100, 100, 1]
    ];
    const result = hungarianMatch(cost);
    assert.strictEqual(result.length, 3);
    const totalCost = result.reduce((s, [r, c]) => s + cost[r][c], 0);
    assert.strictEqual(totalCost, 3);
});

test('optimal assignment for non-trivial matrix', () => {
    const cost = [
        [10, 5, 13],
        [3, 7, 15],
        [12, 8, 2]
    ];
    const result = hungarianMatch(cost);
    assert.strictEqual(result.length, 3);
    const totalCost = result.reduce((s, [r, c]) => s + cost[r][c], 0);
    // Optimal: row0→col1(5), row1→col0(3), row2→col2(2) = 10
    assert.strictEqual(totalCost, 10);
});

test('each row and column assigned exactly once', () => {
    const n = 5;
    const cost = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => Math.random() * 100)
    );
    const result = hungarianMatch(cost);
    assert.strictEqual(result.length, n);
    const rows = new Set(result.map(([r]) => r));
    const cols = new Set(result.map(([, c]) => c));
    assert.strictEqual(rows.size, n, 'Each row should be assigned once');
    assert.strictEqual(cols.size, n, 'Each column should be assigned once');
});

test('symmetric cost matrix gives same total cost', () => {
    const cost = [
        [0, 3, 5],
        [3, 0, 4],
        [5, 4, 0]
    ];
    const result = hungarianMatch(cost);
    const totalCost = result.reduce((s, [r, c]) => s + cost[r][c], 0);
    // Verify it's optimal by brute force for 3x3
    let minCost = Infinity;
    const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    for (const perm of perms) {
        let c = 0;
        for (let i = 0; i < 3; i++) c += cost[i][perm[i]];
        minCost = Math.min(minCost, c);
    }
    assert.strictEqual(totalCost, minCost, `Hungarian ${totalCost} should match brute-force ${minCost}`);
});

test('large matrix (10x10) completes correctly', () => {
    const n = 10;
    const cost = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i * 7 + j * 13 + 3) % 100)
    );
    const result = hungarianMatch(cost);
    assert.strictEqual(result.length, n);
    const rows = new Set(result.map(([r]) => r));
    const cols = new Set(result.map(([, c]) => c));
    assert.strictEqual(rows.size, n);
    assert.strictEqual(cols.size, n);
});

// =======================================================================
// Integration: resample → smooth → Fréchet pipeline
// =======================================================================

console.log('\n--- Integration: full scoring pipeline ---');

test('identical stroke scores perfectly', () => {
    const stroke = [
        { x: 10, y: 50 }, { x: 30, y: 20 }, { x: 50, y: 50 },
        { x: 70, y: 80 }, { x: 90, y: 50 }
    ];
    const smoothed = smoothInput(stroke);
    const resampled = resamplePoints(smoothed, 64);
    const frechet = discreteFrechet(resampled, resampled);
    const avg = avgPointDist(resampled, resampled);
    approxEqual(frechet, 0);
    approxEqual(avg, 0);
});

test('slightly offset stroke has small Fréchet distance', () => {
    const ref = resamplePoints([{ x: 0, y: 0 }, { x: 100, y: 0 }], 64);
    const user = resamplePoints([{ x: 0, y: 2 }, { x: 100, y: 2 }], 64);
    const frechet = discreteFrechet(ref, user);
    approxEqual(frechet, 2, 0.1);
});

test('reversed stroke has large Fréchet distance', () => {
    const ref = resamplePoints([{ x: 0, y: 0 }, { x: 100, y: 0 }], 32);
    const user = resamplePoints([{ x: 100, y: 0 }, { x: 0, y: 0 }], 32);
    const frechet = discreteFrechet(ref, user);
    assert(frechet > 50, `Reversed stroke Fréchet ${frechet} should be > 50`);
});

test('perpendicular stroke gets bad score', () => {
    const ref = resamplePoints([{ x: 0, y: 54 }, { x: 109, y: 54 }], 64);
    const user = resamplePoints([{ x: 54, y: 0 }, { x: 54, y: 109 }], 64);
    const frechet = discreteFrechet(ref, user);
    assert(frechet > 30, `Perpendicular stroke Fréchet ${frechet} should be > 30`);
});

// =======================================================================
// Edge cases / Robustness
// =======================================================================

console.log('\n--- Edge Cases ---');

test('resample with n=2 gives first and last', () => {
    const pts = [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }];
    const result = resamplePoints(pts, 2);
    assert.strictEqual(result.length, 2);
    approxEqual(result[0].x, 0);
    approxEqual(result[1].x, 100);
});

test('resample with n=1 gives first point', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const result = resamplePoints(pts, 1);
    assert.strictEqual(result.length, 1);
    approxEqual(result[0].x, 0);
});

test('Fréchet with 1 point each', () => {
    const d = discreteFrechet([{ x: 0, y: 0 }], [{ x: 3, y: 4 }]);
    approxEqual(d, 5);
});

test('Hungarian with all-zero cost matrix', () => {
    const cost = [[0, 0], [0, 0]];
    const result = hungarianMatch(cost);
    assert.strictEqual(result.length, 2);
    const totalCost = result.reduce((s, [r, c]) => s + cost[r][c], 0);
    assert.strictEqual(totalCost, 0);
});

test('Hungarian with all-equal cost matrix', () => {
    const cost = [[7, 7, 7], [7, 7, 7], [7, 7, 7]];
    const result = hungarianMatch(cost);
    assert.strictEqual(result.length, 3);
    const totalCost = result.reduce((s, [r, c]) => s + cost[r][c], 0);
    assert.strictEqual(totalCost, 21);
});

// =======================================================================
// Performance Benchmarks
// =======================================================================

console.log('\n--- Performance Benchmarks ---');

test('Hungarian 30x30 completes in < 50ms', () => {
    const n = 30;
    const cost = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => Math.random() * 1000)
    );
    const start = performance.now();
    const result = hungarianMatch(cost);
    const elapsed = performance.now() - start;
    assert.strictEqual(result.length, n);
    console.log(`    → ${elapsed.toFixed(2)}ms for 30x30`);
    assert(elapsed < 50, `30x30 Hungarian took ${elapsed}ms (> 50ms)`);
});

test('Fréchet 64x64 completes in < 5ms', () => {
    const P = Array.from({ length: 64 }, (_, i) => ({ x: i, y: Math.sin(i / 10) * 50 }));
    const Q = Array.from({ length: 64 }, (_, i) => ({ x: i + 2, y: Math.sin(i / 10) * 50 + 3 }));
    const start = performance.now();
    const d = discreteFrechet(P, Q);
    const elapsed = performance.now() - start;
    console.log(`    → ${elapsed.toFixed(2)}ms for 64×64 (dist: ${d.toFixed(2)})`);
    assert(elapsed < 5, `64x64 Fréchet took ${elapsed}ms (> 5ms)`);
});

test('Full pipeline (resample+smooth+Fréchet) in < 2ms', () => {
    const raw = Array.from({ length: 100 }, (_, i) => ({
        x: i + Math.random() * 5,
        y: Math.sin(i / 15) * 50 + Math.random() * 3
    }));
    const start = performance.now();
    const smoothed = smoothInput(raw);
    const resampled = resamplePoints(smoothed, 64);
    const ref = resamplePoints([{ x: 0, y: 0 }, { x: 100, y: 50 }], 64);
    const d = discreteFrechet(resampled, ref);
    const elapsed = performance.now() - start;
    console.log(`    → ${elapsed.toFixed(2)}ms for full pipeline (dist: ${d.toFixed(2)})`);
    assert(elapsed < 2, `Pipeline took ${elapsed}ms (> 2ms)`);
});

test('Resample 1000 points to 64 in < 1ms', () => {
    const pts = Array.from({ length: 1000 }, (_, i) => ({
        x: Math.cos(i / 50) * 50 + 50,
        y: Math.sin(i / 50) * 50 + 50
    }));
    const start = performance.now();
    const result = resamplePoints(pts, 64);
    const elapsed = performance.now() - start;
    assert.strictEqual(result.length, 64);
    console.log(`    → ${elapsed.toFixed(2)}ms for 1000→64 resample`);
    assert(elapsed < 1, `Resample took ${elapsed}ms (> 1ms)`);
});

// =======================================================================
// Summary
// =======================================================================

console.log('\n═══════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
