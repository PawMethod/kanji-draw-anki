// =======================================================================
// Extracted scoring algorithms from Card-1 FrontTemplate
// Used for unit testing, benchmarking, and validation
// =======================================================================

/**
 * Resample a polyline to exactly `n` equidistant points.
 */
function resamplePoints(pts, n) {
    if (pts.length < 2) return pts.slice();
    const dists = [0];
    for (let i = 1; i < pts.length; i++)
        dists.push(dists[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const totalLen = dists[dists.length - 1];
    if (totalLen === 0) return pts.slice(0, 1);
    const out = [pts[0]];
    let j = 1;
    for (let i = 1; i < n; i++) {
        const target = (i / (n - 1)) * totalLen;
        while (j < dists.length && dists[j] < target) j++;
        if (j >= pts.length) { out.push(pts[pts.length - 1]); continue; }
        const seg = dists[j] - dists[j - 1] || 1;
        const t = (target - dists[j - 1]) / seg;
        out.push({
            x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * t,
            y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * t
        });
    }
    return out;
}

/**
 * Discrete Fréchet distance between two polylines P and Q.
 */
function discreteFrechet(P, Q) {
    const n = P.length, m = Q.length;
    const dp = new Float64Array(n * m);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < m; j++) {
            const dist = Math.hypot(P[i].x - Q[j].x, P[i].y - Q[j].y);
            if (i === 0 && j === 0) dp[j] = dist;
            else if (i === 0) dp[j] = Math.max(dp[j - 1], dist);
            else if (j === 0) dp[i * m] = Math.max(dp[(i - 1) * m], dist);
            else dp[i * m + j] = Math.max(
                Math.min(dp[(i - 1) * m + j], dp[(i - 1) * m + j - 1], dp[i * m + j - 1]),
                dist
            );
        }
    }
    return dp[n * m - 1];
}

/**
 * Average point-to-point distance between two equal-length polylines.
 */
function avgPointDist(P, Q) {
    let sum = 0;
    const n = Math.min(P.length, Q.length);
    for (let i = 0; i < n; i++) sum += Math.hypot(P[i].x - Q[i].x, P[i].y - Q[i].y);
    return sum / n;
}

/**
 * Compute segment angles for a polyline, dividing it into `n` segments.
 */
function segmentAngles(pts, n) {
    const step = (pts.length - 1) / n;
    const out = [];
    for (let s = 0; s < n; s++) {
        const si = Math.round(s * step), ei = Math.round((s + 1) * step);
        out.push(Math.atan2(pts[ei].y - pts[si].y, pts[ei].x - pts[si].x));
    }
    return out;
}

/**
 * 3-point moving average smoothing for noisy input strokes.
 */
function smoothInput(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
        out.push({
            x: (pts[i - 1].x + pts[i].x + pts[i + 1].x) / 3,
            y: (pts[i - 1].y + pts[i].y + pts[i + 1].y) / 3
        });
    }
    out.push(pts[pts.length - 1]);
    return out;
}

/**
 * Hungarian algorithm (Kuhn-Munkres) for optimal assignment.
 * Takes a square cost matrix, returns array of [row, col] pairs.
 */
function hungarianMatch(costMatrix) {
    const n = costMatrix.length;
    if (n === 0) return [];
    const u = new Float64Array(n + 1);
    const v = new Float64Array(n + 1);
    const p = new Int32Array(n + 1);
    const way = new Int32Array(n + 1);
    for (let i = 1; i <= n; i++) {
        p[0] = i;
        let j0 = 0;
        const minv = new Float64Array(n + 1).fill(Infinity);
        const used = new Uint8Array(n + 1);
        do {
            used[j0] = 1;
            let i0 = p[j0], delta = Infinity, j1 = 0;
            for (let j = 1; j <= n; j++) {
                if (used[j]) continue;
                const cur = costMatrix[i0 - 1][j - 1] - u[i0] - v[j];
                if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
                if (minv[j] < delta) { delta = minv[j]; j1 = j; }
            }
            for (let j = 0; j <= n; j++) {
                if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
                else minv[j] -= delta;
            }
            j0 = j1;
        } while (p[j0] !== 0);
        do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const result = [];
    for (let j = 1; j <= n; j++) {
        if (p[j] !== 0) result.push([p[j] - 1, j - 1]);
    }
    return result;
}

module.exports = {
    resamplePoints,
    discreteFrechet,
    avgPointDist,
    segmentAngles,
    smoothInput,
    hungarianMatch
};
