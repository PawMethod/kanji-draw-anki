const assert = require('assert');

// Import shared algorithms
const algo = require('./algorithms');

// Mock SVG path for testing
function mockRefPath(points) {
    const dists = [0];
    for (let i = 1; i < points.length; i++) {
        dists.push(dists[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    }
    const totalLen = dists[dists.length - 1];
    return {
        getTotalLength: () => totalLen,
        getPointAtLength: (len) => {
            if (len <= 0) return { x: points[0].x, y: points[0].y };
            if (len >= totalLen) return { x: points[points.length - 1].x, y: points[points.length - 1].y };
            for (let i = 1; i < dists.length; i++) {
                if (dists[i] >= len) {
                    const seg = dists[i] - dists[i - 1] || 1;
                    const t = (len - dists[i - 1]) / seg;
                    return {
                        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
                        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t
                    };
                }
            }
            return { x: points[points.length - 1].x, y: points[points.length - 1].y };
        }
    };
}

// Extract snap logic for testing (pure computation, no DOM/rAF)
function computeSnapFrames(userPts, refPath, numFrames) {
    const N = 24;
    const uPts = algo.resamplePoints(userPts, N);
    const refLen = refPath.getTotalLength();
    if (refLen === 0) return [];
    const rPts = [];
    for (let i = 0; i < N; i++) {
        const pt = refPath.getPointAtLength((i / (N - 1)) * refLen);
        rPts.push({ x: pt.x, y: pt.y });
    }
    // Direction alignment
    if (Math.hypot(uPts[0].x - rPts[N - 1].x, uPts[0].y - rPts[N - 1].y) <
        Math.hypot(uPts[0].x - rPts[0].x, uPts[0].y - rPts[0].y)) rPts.reverse();

    const frames = [];
    for (let f = 0; f <= numFrames; f++) {
        let t = f / numFrames;
        t = 1 - (1 - t) * (1 - t) * (1 - t); // ease-out cubic
        const pts = [];
        for (let i = 0; i < N; i++) {
            pts.push({
                x: uPts[i].x + (rPts[i].x - uPts[i].x) * t,
                y: uPts[i].y + (rPts[i].y - uPts[i].y) * t
            });
        }
        frames.push({ t, pts });
    }
    return frames;
}

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; console.error(`  ✗ ${name}: ${e.message}`); }
}

console.log('\n=== Snap Animation Unit Tests ===\n');

// --- Basic interpolation ---
test('frame at t=0 matches user stroke start', () => {
    const user = [{x:10,y:10},{x:20,y:20},{x:30,y:30},{x:40,y:40},{x:50,y:50}];
    const ref = mockRefPath([{x:10,y:50},{x:30,y:30},{x:50,y:10}]);
    const frames = computeSnapFrames(user, ref, 10);
    // First frame (t=0 raw, but ease-out cubic gives t=0)
    assert(frames[0].t === 0, 'first frame t=0');
    // Points should be very close to resampled user points
    const uResampled = algo.resamplePoints(user, 24);
    assert(Math.abs(frames[0].pts[0].x - uResampled[0].x) < 0.01);
    assert(Math.abs(frames[0].pts[0].y - uResampled[0].y) < 0.01);
});

test('frame at t=1 matches reference path end', () => {
    const user = [{x:10,y:10},{x:20,y:20},{x:30,y:30},{x:40,y:40},{x:50,y:50}];
    const ref = mockRefPath([{x:10,y:50},{x:30,y:30},{x:50,y:10}]);
    const frames = computeSnapFrames(user, ref, 10);
    const last = frames[frames.length - 1];
    assert(last.t === 1, 'last frame t=1');
    // Last frame should match reference points (resampled to 24)
    const refLen = ref.getTotalLength();
    const firstRefPt = ref.getPointAtLength(0);
    const lastRefPt = ref.getPointAtLength(refLen);
    // Check start and end of animation match reference start and end
    assert(Math.abs(last.pts[0].x - firstRefPt.x) < 0.5);
    assert(Math.abs(last.pts[23].x - lastRefPt.x) < 0.5);
});

test('all 24 points per frame', () => {
    const user = [{x:0,y:0},{x:50,y:50},{x:100,y:0}];
    const ref = mockRefPath([{x:0,y:50},{x:50,y:0},{x:100,y:50}]);
    const frames = computeSnapFrames(user, ref, 5);
    frames.forEach(f => assert(f.pts.length === 24, `expected 24 pts, got ${f.pts.length}`));
});

// --- Ease-out cubic ---
test('ease-out cubic: fast start, slow end', () => {
    const frames = computeSnapFrames(
        [{x:0,y:0},{x:100,y:0}],
        mockRefPath([{x:0,y:100},{x:100,y:100}]),
        10
    );
    // At 50% raw time, eased t should be > 0.5 (ease-out moves fast initially)
    const midFrame = frames[5];
    assert(midFrame.t > 0.5, `ease-out at 50% should be > 0.5, got ${midFrame.t}`);
    // At 20% raw time, eased t should already be significant
    const earlyFrame = frames[2];
    assert(earlyFrame.t > 0.15, `ease-out at 20% should be > 0.15, got ${earlyFrame.t}`);
});

test('t values are monotonically increasing', () => {
    const frames = computeSnapFrames(
        [{x:0,y:0},{x:50,y:50}],
        mockRefPath([{x:0,y:50},{x:50,y:0}]),
        20
    );
    for (let i = 1; i < frames.length; i++) {
        assert(frames[i].t >= frames[i - 1].t, `t not monotonic at frame ${i}`);
    }
});

// --- Direction alignment ---
test('direction alignment: same direction preserved', () => {
    const user = [{x:0,y:0},{x:50,y:0},{x:100,y:0}]; // left to right
    const ref = mockRefPath([{x:0,y:10},{x:50,y:10},{x:100,y:10}]); // also left to right
    const frames = computeSnapFrames(user, ref, 10);
    const last = frames[frames.length - 1];
    // Start should be near ref start (0,10), not ref end (100,10)
    assert(Math.abs(last.pts[0].x - 0) < 1, `start.x should be ~0, got ${last.pts[0].x}`);
    assert(Math.abs(last.pts[23].x - 100) < 1, `end.x should be ~100, got ${last.pts[23].x}`);
});

test('direction alignment: reversed reference gets flipped', () => {
    const user = [{x:0,y:0},{x:50,y:0},{x:100,y:0}]; // left to right
    // Reference stored right-to-left but user drew left-to-right
    const ref = mockRefPath([{x:100,y:10},{x:50,y:10},{x:0,y:10}]);
    const frames = computeSnapFrames(user, ref, 10);
    const last = frames[frames.length - 1];
    // After reversal, final frame start should be near (0,10)
    assert(Math.abs(last.pts[0].x - 0) < 1, `reversed: start.x ~0, got ${last.pts[0].x}`);
    assert(Math.abs(last.pts[23].x - 100) < 1, `reversed: end.x ~100, got ${last.pts[23].x}`);
});

// --- Edge cases ---
test('zero-length reference path returns empty frames', () => {
    const user = [{x:10,y:10},{x:20,y:20}];
    const ref = mockRefPath([{x:50,y:50}]); // single point → 0 length
    const frames = computeSnapFrames(user, ref, 5);
    assert(frames.length === 0, 'should return empty for zero-length ref');
});

test('minimal 2-point user stroke works', () => {
    const user = [{x:0,y:0},{x:100,y:100}];
    const ref = mockRefPath([{x:0,y:100},{x:100,y:0}]);
    const frames = computeSnapFrames(user, ref, 5);
    assert(frames.length === 6, `expected 6 frames, got ${frames.length}`);
    assert(frames[0].pts.length === 24);
});

test('user stroke already on reference: minimal animation', () => {
    const pts = [{x:0,y:0},{x:25,y:25},{x:50,y:50},{x:75,y:75},{x:100,y:100}];
    const ref = mockRefPath(pts);
    const frames = computeSnapFrames(pts, ref, 10);
    // All frames should be very close to the same points
    for (const f of frames) {
        for (let i = 0; i < 24; i++) {
            const refPt = ref.getPointAtLength((i / 23) * ref.getTotalLength());
            // Distance should be small throughout animation
            const dist = Math.hypot(f.pts[i].x - refPt.x, f.pts[i].y - refPt.y);
            assert(dist < 5, `deviation ${dist.toFixed(1)} at frame t=${f.t.toFixed(2)}, pt ${i}`);
        }
    }
});

// --- Large displacement ---
test('large displacement: animation moves points significantly', () => {
    const user = [{x:0,y:0},{x:50,y:0},{x:100,y:0}]; // horizontal
    const ref = mockRefPath([{x:0,y:100},{x:50,y:100},{x:100,y:100}]); // 100px below
    const frames = computeSnapFrames(user, ref, 10);
    // Mid-animation y values should be between 0 and 100
    const mid = frames[5];
    assert(mid.pts[12].y > 10 && mid.pts[12].y < 95, `mid y should be between, got ${mid.pts[12].y}`);
});

// --- Performance ---
test('performance: snap computation < 2ms for typical stroke', () => {
    // Generate a realistic user stroke (30 points with slight noise)
    const user = [];
    for (let i = 0; i <= 30; i++) {
        user.push({ x: i * 3, y: 50 + Math.sin(i * 0.5) * 10 + Math.random() * 3 });
    }
    const refPts = [];
    for (let i = 0; i <= 20; i++) {
        refPts.push({ x: i * 5, y: 50 + Math.cos(i * 0.3) * 15 });
    }
    const ref = mockRefPath(refPts);

    const t0 = performance.now();
    for (let iter = 0; iter < 100; iter++) {
        computeSnapFrames(user, ref, 12); // ~12 frames at 60fps over 200ms
    }
    const elapsed = performance.now() - t0;
    const avg = elapsed / 100;
    console.log(`    (avg ${avg.toFixed(2)}ms per computation)`);
    assert(avg < 2, `should be < 2ms, got ${avg.toFixed(2)}ms`);
});

// --- Frame count ---
test('correct number of frames generated', () => {
    const user = [{x:0,y:0},{x:100,y:100}];
    const ref = mockRefPath([{x:0,y:100},{x:100,y:0}]);
    assert(computeSnapFrames(user, ref, 1).length === 2);
    assert(computeSnapFrames(user, ref, 5).length === 6);
    assert(computeSnapFrames(user, ref, 12).length === 13);
});

// --- Interpolation linearity check ---
test('interpolated points stay bounded between user and ref', () => {
    const user = [{x:0,y:0},{x:50,y:0},{x:100,y:0}];
    const ref = mockRefPath([{x:0,y:100},{x:50,y:100},{x:100,y:100}]);
    const frames = computeSnapFrames(user, ref, 20);
    for (const f of frames) {
        for (const p of f.pts) {
            assert(p.y >= -1 && p.y <= 101, `y=${p.y} out of bounds at t=${f.t}`);
        }
    }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
