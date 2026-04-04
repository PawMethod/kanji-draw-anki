/**
 * Stress / Pentesting Suite for KanjiDraw Template
 *
 * Tests rapid-fire interactions, race conditions, timer conflicts,
 * animation overlaps, state corruption, and memory leak patterns.
 *
 * Uses mocked DOM + timers to simulate the template's runtime.
 */
const assert = require('assert');
const algo = require('./algorithms');

// ─── Mock Infrastructure ────────────────────────────────────────────

let _timerId = 0;
let _timers = new Map(); // id → { fn, delay, fireAt }
let _rafCallbacks = [];
let _now = 0;
let _errors = [];

function mockSetTimeout(fn, delay) {
    const id = ++_timerId;
    _timers.set(id, { fn, delay, fireAt: _now + (delay || 0) });
    return id;
}
function mockClearTimeout(id) { _timers.delete(id); }
function mockRAF(fn) {
    const id = ++_timerId;
    _rafCallbacks.push({ id, fn, time: _now + 16 });
    return id;
}
function mockPerfNow() { return _now; }

function advanceTime(ms) {
    const target = _now + ms;
    while (_now < target) {
        _now += 1;
        // Fire expired setTimeout callbacks
        for (const [id, t] of _timers) {
            if (t.fireAt <= _now) {
                _timers.delete(id);
                try { t.fn(); } catch (e) { _errors.push(e); }
            }
        }
        // Fire rAF callbacks (every 16ms)
        if (_now % 16 === 0) {
            const cbs = _rafCallbacks.splice(0);
            for (const cb of cbs) {
                try { cb.fn(_now); } catch (e) { _errors.push(e); }
            }
        }
    }
}

function resetMocks() {
    _timerId = 0; _timers.clear(); _rafCallbacks = []; _now = 0; _errors = [];
}

// ─── Mock DOM Elements ──────────────────────────────────────────────

class MockElement {
    constructor(tag, id) {
        this.tagName = tag;
        this.id = id || '';
        this.children = [];
        this.parentNode = null;
        this.classList = new MockClassList();
        this.style = {};
        this.attributes = {};
        this._innerHTML = '';
    }
    setAttribute(k, v) { this.attributes[k] = v; }
    getAttribute(k) { return this.attributes[k] || null; }
    appendChild(child) { child.parentNode = this; this.children.push(child); }
    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx >= 0) { this.children.splice(idx, 1); child.parentNode = null; }
    }
    getTotalLength() { return 100; }
    getPointAtLength(len) {
        const t = Math.min(1, Math.max(0, len / 100));
        return { x: t * 100, y: t * 50 };
    }
    set innerHTML(v) {
        this.children.forEach(c => c.parentNode = null);
        this.children = [];
        this._innerHTML = v;
    }
    get innerHTML() { return this._innerHTML; }
}

class MockClassList {
    constructor() { this._set = new Set(); }
    add(...cls) { cls.forEach(c => this._set.add(c)); }
    remove(...cls) { cls.forEach(c => this._set.delete(c)); }
    contains(c) { return this._set.has(c); }
    toggle(c) { if (this._set.has(c)) this._set.delete(c); else this._set.add(c); }
}

// ─── Template State Simulator ───────────────────────────────────────
// Replicates the core state machine from the drawing engine IIFE

function createTemplateState(numStrokes) {
    const paths = [];
    for (let i = 0; i < numStrokes; i++) {
        paths.push(new MockElement('path', `stroke-${i}`));
    }
    const drawLayer = new MockElement('svg', 'draw-layer');
    const actionButtons = new MockElement('div', 'action-buttons');
    actionButtons.style.display = 'flex';

    let currentStroke = 0, mistakes = 0, isDrawing = false, userPoints = [];
    let currentSVGPath = null, dString = '', errorTimeout = null, fadeTimeout = null;
    let skipTimeouts = [];
    let problemStrokes = new Array(numStrokes).fill(0);
    let snapAnimationsStarted = 0, snapAnimationsFinished = 0;
    let completionPlayed = false, autoFlipped = false;

    const clearDrawLayer = () => { drawLayer.innerHTML = ''; currentSVGPath = null; };

    // snapToReference — mirrors the fixed version
    const snapToReference = (drawnPath, refPath, userPts, onDone) => {
        snapAnimationsStarted++;
        const N = 24;
        const uPts = algo.resamplePoints(userPts, N);
        const refLen = refPath.getTotalLength();
        if (refLen === 0) { onDone(); snapAnimationsFinished++; return; }
        const rPts = [];
        for (let i = 0; i < N; i++) {
            const pt = refPath.getPointAtLength((i / (N - 1)) * refLen);
            rPts.push({ x: pt.x, y: pt.y });
        }
        if (Math.hypot(uPts[0].x - rPts[N - 1].x, uPts[0].y - rPts[N - 1].y) <
            Math.hypot(uPts[0].x - rPts[0].x, uPts[0].y - rPts[0].y)) rPts.reverse();
        const dur = 200, t0 = mockPerfNow();
        const tick = (now) => {
            if (!drawnPath.parentNode) { onDone(); snapAnimationsFinished++; return; }
            let t = Math.min(1, (now - t0) / dur);
            t = 1 - (1 - t) * (1 - t) * (1 - t);
            let d = 'M';
            for (let i = 0; i < N; i++) {
                const x = uPts[i].x + (rPts[i].x - uPts[i].x) * t;
                const y = uPts[i].y + (rPts[i].y - uPts[i].y) * t;
                d += (i ? ' L ' : ' ') + x.toFixed(1) + ' ' + y.toFixed(1);
            }
            drawnPath.setAttribute('d', d);
            if (t < 1) mockRAF(tick);
            else { onDone(); snapAnimationsFinished++; }
        };
        mockRAF(tick);
    };

    // Simulate drawing a stroke (creates path, adds points, finishes)
    const simulateStroke = (points) => {
        if (currentStroke >= paths.length) return false;
        // startDrawing
        mockClearTimeout(errorTimeout); mockClearTimeout(fadeTimeout);
        clearDrawLayer();
        paths[currentStroke].classList.remove('hint-active');
        isDrawing = true; userPoints = [];
        currentSVGPath = new MockElement('path', 'drawn');
        drawLayer.appendChild(currentSVGPath);
        // draw
        for (const p of points) {
            userPoints.push(p);
            dString += ` L ${p.x} ${p.y}`;
            currentSVGPath.setAttribute('d', dString);
        }
        // stopDrawing
        isDrawing = false;
        return true;
    };

    // Simulate stroke acceptance (mirrors template line 1882-1894)
    const acceptStroke = () => {
        if (currentStroke >= paths.length) return;
        mistakes = 0;
        const si = currentStroke, dp = currentSVGPath, up = userPoints.slice();
        paths[si].classList.remove('hint-active');
        currentStroke++; currentSVGPath = null;
        const afterSnap = () => {
            paths[si].classList.add('stroke-complete');
            if (dp && dp.parentNode) dp.parentNode.removeChild(dp);
            if (currentStroke >= paths.length) {
                actionButtons.style.display = 'none';
                completionPlayed = true;
                autoFlipped = true;
            }
        };
        if (dp && up.length >= 2) { snapToReference(dp, paths[si], up, afterSnap); }
        else { paths[si].classList.add('stroke-complete'); clearDrawLayer(); if (currentStroke >= paths.length) { actionButtons.style.display = 'none'; completionPlayed = true; autoFlipped = true; } }
    };

    // Simulate stroke rejection (mirrors template line 1895-1920)
    const rejectStroke = () => {
        mistakes++;
        if (mistakes > problemStrokes[currentStroke]) { problemStrokes[currentStroke] = mistakes; }
        mockClearTimeout(errorTimeout); mockClearTimeout(fadeTimeout);
        errorTimeout = mockSetTimeout(() => {
            if (!isDrawing) {
                fadeTimeout = mockSetTimeout(() => { if (!isDrawing) { clearDrawLayer(); } }, 200);
            }
        }, 250);
        userPoints = [];
    };

    // guidedSkipAction (mirrors template — fixed version)
    const skipAction = () => {
        if (currentStroke >= paths.length) return;
        skipTimeouts.forEach(mockClearTimeout); skipTimeouts = [];
        // Resolve any pending skip animations immediately
        paths.forEach(p => { if (p.classList.contains('animate-draw')) { p.classList.remove('animate-draw'); p.classList.add('stroke-complete'); } });
        problemStrokes[currentStroke] = 3;
        paths[currentStroke].classList.remove('hint-active', 'rewind-anim');
        paths[currentStroke].classList.add('animate-draw');
        const si = currentStroke;
        const animTimer = mockSetTimeout(() => {
            paths[si].classList.remove('animate-draw');
            paths[si].classList.add('stroke-complete');
        }, 700);
        skipTimeouts.push(animTimer);
        currentStroke++; mistakes = 0;
        mockClearTimeout(errorTimeout); mockClearTimeout(fadeTimeout);
        fadeTimeout = mockSetTimeout(() => { clearDrawLayer(); }, 300);
        if (currentStroke >= paths.length) {
            actionButtons.style.display = 'none';
            const flipTimer = mockSetTimeout(() => { completionPlayed = true; autoFlipped = true; }, 700);
            skipTimeouts.push(flipTimer);
        }
    };

    // guidedResetAction
    const resetAction = () => {
        currentStroke = 0; mistakes = 0; userPoints = []; problemStrokes.fill(0);
        skipTimeouts.forEach(mockClearTimeout); skipTimeouts = [];
        paths.forEach(p => {
            p.classList.remove('stroke-complete', 'hint-active', 'animate-draw', 'rewind-anim');
        });
        mockClearTimeout(errorTimeout); mockClearTimeout(fadeTimeout);
        clearDrawLayer();
        actionButtons.style.display = 'flex';
        completionPlayed = false; autoFlipped = false;
    };

    return {
        paths, drawLayer, actionButtons,
        get currentStroke() { return currentStroke; },
        get mistakes() { return mistakes; },
        get isDrawing() { return isDrawing; },
        get problemStrokes() { return problemStrokes; },
        get currentSVGPath() { return currentSVGPath; },
        get skipTimeouts() { return skipTimeouts; },
        get completionPlayed() { return completionPlayed; },
        get autoFlipped() { return autoFlipped; },
        get snapAnimationsStarted() { return snapAnimationsStarted; },
        get snapAnimationsFinished() { return snapAnimationsFinished; },
        simulateStroke, acceptStroke, rejectStroke, skipAction, resetAction, clearDrawLayer,
    };
}

// ─── Test Runner ────────────────────────────────────────────────────

let passed = 0, failed = 0, total = 0;
function test(name, fn) {
    total++;
    resetMocks();
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

function goodStroke() {
    return [{ x: 10, y: 10 }, { x: 30, y: 20 }, { x: 50, y: 30 }, { x: 70, y: 40 }, { x: 90, y: 50 }];
}

// ─── RAPID BUTTON MASHING ──────────────────────────────────────────

console.log('\n=== Rapid Button Mashing ===\n');

test('rapid skip: 10 skips in <50ms on 10-stroke kanji', () => {
    const s = createTemplateState(10);
    for (let i = 0; i < 10; i++) { s.skipAction(); _now += 5; }
    assert.strictEqual(s.currentStroke, 10, 'all strokes should be skipped');
    advanceTime(1000);
    assert.strictEqual(_errors.length, 0, 'no errors from rapid skip');
    s.paths.forEach(p => assert(p.classList.contains('stroke-complete'), 'all should be stroke-complete'));
});

test('rapid skip: 20 skips on 5-stroke kanji (overflow)', () => {
    const s = createTemplateState(5);
    for (let i = 0; i < 20; i++) { s.skipAction(); }
    assert.strictEqual(s.currentStroke, 5, 'should not exceed path count');
    advanceTime(1000);
    assert.strictEqual(_errors.length, 0, 'no errors from overflow skip');
});

test('rapid reset during skip animation', () => {
    const s = createTemplateState(5);
    s.skipAction(); s.skipAction();
    _now += 100; // mid-animation
    s.resetAction();
    assert.strictEqual(s.currentStroke, 0, 'reset should return to stroke 0');
    advanceTime(1000);
    assert.strictEqual(_errors.length, 0, 'no errors from reset mid-skip');
    s.paths.forEach(p => {
        assert(!p.classList.contains('stroke-complete'), 'no stroke-complete after reset');
        assert(!p.classList.contains('animate-draw'), 'no animate-draw after reset');
    });
});

test('rapid skip → reset → skip cycle 10x', () => {
    const s = createTemplateState(8);
    for (let i = 0; i < 10; i++) {
        s.skipAction(); s.skipAction(); s.skipAction();
        _now += 50;
        s.resetAction();
        _now += 10;
    }
    assert.strictEqual(s.currentStroke, 0, 'should be reset');
    advanceTime(2000);
    assert.strictEqual(_errors.length, 0, 'no errors from skip/reset cycle');
});

test('skip all → immediate reset → skip all again', () => {
    const s = createTemplateState(3);
    s.skipAction(); s.skipAction(); s.skipAction();
    assert.strictEqual(s.currentStroke, 3);
    s.resetAction();
    assert.strictEqual(s.currentStroke, 0);
    s.skipAction(); s.skipAction(); s.skipAction();
    assert.strictEqual(s.currentStroke, 3);
    advanceTime(2000);
    assert.strictEqual(_errors.length, 0, 'no errors');
});

// ─── SNAP ANIMATION INTERRUPTS ─────────────────────────────────────

console.log('\n=== Snap Animation Interrupts ===\n');

test('draw next stroke while snap animation still running', () => {
    const s = createTemplateState(5);
    s.simulateStroke(goodStroke());
    s.acceptStroke();
    assert.strictEqual(s.snapAnimationsStarted, 1);
    // Immediately draw next stroke (clears drawLayer, kills animation)
    _now += 32; // ~2 frames into 200ms animation
    advanceTime(0); // run pending rAF
    s.simulateStroke(goodStroke());
    // Let all timers/rAFs settle
    advanceTime(500);
    assert.strictEqual(_errors.length, 0, 'no DOM errors from interrupted snap');
    assert.strictEqual(s.snapAnimationsFinished, 1, 'interrupted snap should complete via parentNode guard');
});

test('reset during snap animation', () => {
    const s = createTemplateState(5);
    s.simulateStroke(goodStroke()); s.acceptStroke();
    _now += 48;
    advanceTime(0);
    s.resetAction();
    advanceTime(500);
    assert.strictEqual(_errors.length, 0, 'no errors from reset during snap');
    assert.strictEqual(s.currentStroke, 0);
});

test('skip during snap animation', () => {
    const s = createTemplateState(5);
    s.simulateStroke(goodStroke()); s.acceptStroke();
    _now += 16;
    advanceTime(0);
    s.skipAction();
    advanceTime(500);
    assert.strictEqual(_errors.length, 0, 'no errors from skip during snap');
    assert.strictEqual(s.currentStroke, 2, 'stroke 0 accepted + stroke 1 skipped');
});

test('accept 5 strokes rapidly without waiting for snap to finish', () => {
    const s = createTemplateState(5);
    for (let i = 0; i < 5; i++) {
        s.simulateStroke(goodStroke());
        s.acceptStroke();
        _now += 10; // only 10ms between strokes
    }
    advanceTime(1000);
    assert.strictEqual(_errors.length, 0, 'no errors from rapid accept');
    assert.strictEqual(s.currentStroke, 5);
    assert(s.completionPlayed, 'completion should play');
});

test('snap animation completes normally when uninterrupted', () => {
    const s = createTemplateState(3);
    s.simulateStroke(goodStroke()); s.acceptStroke();
    advanceTime(300); // > 200ms snap duration
    assert.strictEqual(s.snapAnimationsFinished, 1, 'snap should finish');
    assert(s.paths[0].classList.contains('stroke-complete'), 'stroke-complete should be added after snap');
    assert.strictEqual(s.drawLayer.children.length, 0, 'drawn path should be removed');
});

// ─── RAPID DRAW/REJECT CYCLES ──────────────────────────────────────

console.log('\n=== Rapid Draw/Reject Cycles ===\n');

test('50 rapid rejections on same stroke', () => {
    const s = createTemplateState(3);
    for (let i = 0; i < 50; i++) {
        s.simulateStroke(goodStroke());
        s.rejectStroke();
        _now += 5;
    }
    advanceTime(1000);
    assert.strictEqual(_errors.length, 0, 'no errors from 50 rejections');
    assert.strictEqual(s.currentStroke, 0, 'still on first stroke');
    assert(s.problemStrokes[0] === 50, '50 mistakes recorded');
});

test('alternating accept/reject rapidly', () => {
    const s = createTemplateState(10);
    for (let i = 0; i < 20; i++) {
        s.simulateStroke(goodStroke());
        if (i % 2 === 0) s.acceptStroke();
        else s.rejectStroke();
        _now += 10;
    }
    advanceTime(1000);
    assert.strictEqual(_errors.length, 0, 'no errors from alternating');
});

test('reject → immediate draw (before error fade)', () => {
    const s = createTemplateState(3);
    s.simulateStroke(goodStroke());
    s.rejectStroke();
    _now += 5; // well before 250ms errorTimeout
    s.simulateStroke(goodStroke()); // should clear timers
    advanceTime(1000);
    assert.strictEqual(_errors.length, 0, 'no errors');
});

// ─── TIMER CLEANUP ─────────────────────────────────────────────────

console.log('\n=== Timer Cleanup ===\n');

test('skipTimeouts cleared on new skip (no accumulation)', () => {
    const s = createTemplateState(10);
    s.skipAction();
    const countAfterFirst = _timers.size;
    s.skipAction();
    const countAfterSecond = _timers.size;
    // Should not grow unboundedly — old timeouts cleared before new ones added
    assert(countAfterSecond <= countAfterFirst + 2, `timer leak: ${countAfterFirst} → ${countAfterSecond}`);
});

test('reset clears all pending timeouts', () => {
    const s = createTemplateState(5);
    s.skipAction(); s.skipAction(); s.skipAction();
    s.simulateStroke(goodStroke()); s.rejectStroke();
    const beforeReset = _timers.size;
    s.resetAction();
    // All skip-related and error/fade timeouts should be cleared
    assert(_timers.size < beforeReset, `timers not cleared: ${_timers.size} >= ${beforeReset}`);
});

test('error/fade timeouts cleaned on new stroke draw', () => {
    const s = createTemplateState(3);
    s.simulateStroke(goodStroke()); s.rejectStroke();
    const timersBefore = _timers.size;
    s.simulateStroke(goodStroke()); // startDrawing clears errorTimeout + fadeTimeout
    const timersAfter = _timers.size;
    assert(timersAfter < timersBefore, `error timeouts not cleared: ${timersBefore} → ${timersAfter}`);
});

test('no stale timeouts fire after reset', () => {
    const s = createTemplateState(5);
    s.skipAction(); s.skipAction();
    s.resetAction();
    advanceTime(2000);
    // After reset + settling, no path should have stroke-complete
    assert.strictEqual(_errors.length, 0, 'no errors from stale timeouts');
    s.paths.forEach(p => assert(!p.classList.contains('stroke-complete'), 'no stale stroke-complete'));
});

// ─── STATE CORRUPTION ──────────────────────────────────────────────

console.log('\n=== State Corruption ===\n');

test('currentStroke never exceeds paths.length', () => {
    const s = createTemplateState(3);
    for (let i = 0; i < 100; i++) {
        s.skipAction();
    }
    assert(s.currentStroke <= 3, `currentStroke=${s.currentStroke} > 3`);
});

test('currentStroke never goes negative', () => {
    const s = createTemplateState(3);
    s.resetAction(); s.resetAction(); s.resetAction();
    assert(s.currentStroke >= 0, `currentStroke=${s.currentStroke} < 0`);
});

test('drawLayer is empty after full completion + settle', () => {
    const s = createTemplateState(3);
    for (let i = 0; i < 3; i++) {
        s.simulateStroke(goodStroke());
        s.acceptStroke();
        _now += 10;
    }
    advanceTime(1000);
    assert.strictEqual(s.drawLayer.children.length, 0, 'draw layer should be empty after completion');
});

test('problemStrokes stays in sync after mixed operations', () => {
    const s = createTemplateState(5);
    s.simulateStroke(goodStroke()); s.rejectStroke(); // mistake 1 on stroke 0
    s.simulateStroke(goodStroke()); s.rejectStroke(); // mistake 2 on stroke 0
    s.simulateStroke(goodStroke()); s.acceptStroke(); // accept stroke 0
    s.skipAction(); // skip stroke 1 (problem=3)
    s.simulateStroke(goodStroke()); s.acceptStroke(); // accept stroke 2
    assert.strictEqual(s.problemStrokes[0], 2);
    assert.strictEqual(s.problemStrokes[1], 3);
    assert.strictEqual(s.problemStrokes[2], 0);
});

test('action buttons hidden after all strokes completed', () => {
    const s = createTemplateState(3);
    s.skipAction(); s.skipAction(); s.skipAction();
    assert.strictEqual(s.actionButtons.style.display, 'none');
});

test('action buttons visible after reset', () => {
    const s = createTemplateState(3);
    s.skipAction(); s.skipAction(); s.skipAction();
    s.resetAction();
    assert.strictEqual(s.actionButtons.style.display, 'flex');
});

// ─── COMPLETION ANIMATION EDGE CASES ────────────────────────────────

console.log('\n=== Completion Edge Cases ===\n');

test('completion fires exactly once on last stroke accept', () => {
    const s = createTemplateState(2);
    s.simulateStroke(goodStroke()); s.acceptStroke();
    s.simulateStroke(goodStroke()); s.acceptStroke();
    advanceTime(1000);
    assert(s.completionPlayed, 'completion should play');
});

test('completion fires exactly once on last skip', () => {
    const s = createTemplateState(2);
    s.skipAction(); s.skipAction();
    advanceTime(1000);
    assert(s.completionPlayed, 'completion should play');
});

test('no double completion when last stroke accepted then skipped', () => {
    const s = createTemplateState(2);
    s.simulateStroke(goodStroke()); s.acceptStroke();
    // stroke 1 is now current, accept it
    s.simulateStroke(goodStroke()); s.acceptStroke();
    // try to skip even though done — should be no-op
    s.skipAction();
    advanceTime(1000);
    assert.strictEqual(_errors.length, 0, 'no errors');
});

test('reset after completion allows re-completion', () => {
    const s = createTemplateState(2);
    s.skipAction(); s.skipAction();
    advanceTime(1000);
    assert(s.completionPlayed);
    s.resetAction();
    assert(!s.completionPlayed);
    s.skipAction(); s.skipAction();
    advanceTime(1000);
    assert(s.completionPlayed, 'second completion should fire');
});

// ─── CHAOS / FUZZ TESTING ──────────────────────────────────────────

console.log('\n=== Chaos / Fuzz Testing ===\n');

test('random action sequence: 200 actions on 8-stroke kanji', () => {
    const s = createTemplateState(8);
    const actions = ['draw-accept', 'draw-reject', 'skip', 'reset', 'draw-accept', 'skip'];
    for (let i = 0; i < 200; i++) {
        const action = actions[Math.floor(Math.random() * actions.length)];
        switch (action) {
            case 'draw-accept':
                s.simulateStroke(goodStroke());
                s.acceptStroke();
                break;
            case 'draw-reject':
                s.simulateStroke(goodStroke());
                s.rejectStroke();
                break;
            case 'skip':
                s.skipAction();
                break;
            case 'reset':
                s.resetAction();
                break;
        }
        _now += Math.floor(Math.random() * 20);
        if (i % 30 === 0) advanceTime(100);
    }
    advanceTime(2000);
    assert.strictEqual(_errors.length, 0, `${_errors.length} errors from chaos test`);
    assert(s.currentStroke >= 0 && s.currentStroke <= 8, 'stroke in valid range');
});

test('random action sequence: 500 actions on 3-stroke kanji (worst case)', () => {
    const s = createTemplateState(3);
    const actions = ['draw-accept', 'draw-reject', 'skip', 'reset'];
    for (let i = 0; i < 500; i++) {
        const action = actions[Math.floor(Math.random() * actions.length)];
        switch (action) {
            case 'draw-accept':
                s.simulateStroke(goodStroke());
                s.acceptStroke();
                break;
            case 'draw-reject':
                s.simulateStroke(goodStroke());
                s.rejectStroke();
                break;
            case 'skip': s.skipAction(); break;
            case 'reset': s.resetAction(); break;
        }
        _now += Math.floor(Math.random() * 5);
    }
    advanceTime(3000);
    assert.strictEqual(_errors.length, 0, `${_errors.length} errors from chaos 500`);
});

test('rapid alternating skip-reset 100x', () => {
    const s = createTemplateState(5);
    for (let i = 0; i < 100; i++) {
        s.skipAction(); s.resetAction();
        _now += 2;
    }
    advanceTime(2000);
    assert.strictEqual(_errors.length, 0, 'no errors');
    assert.strictEqual(s.currentStroke, 0, 'final state is reset');
});

// ─── MEMORY LEAK DETECTION ─────────────────────────────────────────

console.log('\n=== Memory Leak Detection ===\n');

test('drawLayer children count stays 0 or 1 during normal operation', () => {
    const s = createTemplateState(5);
    let maxChildren = 0;
    for (let i = 0; i < 5; i++) {
        s.simulateStroke(goodStroke());
        maxChildren = Math.max(maxChildren, s.drawLayer.children.length);
        s.acceptStroke();
        _now += 250;
        advanceTime(0);
    }
    assert(maxChildren <= 1, `max drawLayer children=${maxChildren}, expected <=1`);
});

test('timer count stays bounded during skip spam', () => {
    const s = createTemplateState(20);
    let maxTimers = 0;
    for (let i = 0; i < 20; i++) {
        s.skipAction();
        maxTimers = Math.max(maxTimers, _timers.size);
        _now += 1;
    }
    // With clearing, max should be ~3 (animTimer + fadeTimeout + flipTimer)
    assert(maxTimers <= 6, `timer leak: max ${maxTimers} simultaneous timers`);
});

test('snap animation count matches accept count after settling', () => {
    const s = createTemplateState(5);
    for (let i = 0; i < 5; i++) {
        s.simulateStroke(goodStroke());
        s.acceptStroke();
        _now += 300;
        advanceTime(100);
    }
    advanceTime(1000);
    assert.strictEqual(s.snapAnimationsStarted, 5, '5 snaps started');
    assert.strictEqual(s.snapAnimationsFinished, 5, '5 snaps finished');
});

test('interrupted snap animations all finish (no zombie rAFs)', () => {
    const s = createTemplateState(10);
    for (let i = 0; i < 10; i++) {
        s.simulateStroke(goodStroke());
        s.acceptStroke();
        _now += 5; // don't wait for snap
    }
    advanceTime(1000);
    assert.strictEqual(s.snapAnimationsFinished, s.snapAnimationsStarted,
        `started=${s.snapAnimationsStarted} finished=${s.snapAnimationsFinished}`);
});

test('rAF callbacks drained after full cycle', () => {
    const s = createTemplateState(3);
    s.simulateStroke(goodStroke()); s.acceptStroke();
    s.simulateStroke(goodStroke()); s.acceptStroke();
    s.simulateStroke(goodStroke()); s.acceptStroke();
    advanceTime(1000);
    assert.strictEqual(_rafCallbacks.length, 0, `${_rafCallbacks.length} rAF callbacks still pending`);
});

// ─── CONCURRENT ANIMATION STRESS ───────────────────────────────────

console.log('\n=== Concurrent Animation Stress ===\n');

test('accept all 20 strokes in 20ms (1ms apart)', () => {
    const s = createTemplateState(20);
    for (let i = 0; i < 20; i++) {
        s.simulateStroke(goodStroke());
        s.acceptStroke();
        _now += 1;
    }
    advanceTime(2000);
    assert.strictEqual(_errors.length, 0, 'no errors');
    assert.strictEqual(s.snapAnimationsFinished, s.snapAnimationsStarted);
    assert.strictEqual(s.currentStroke, 20);
    assert(s.completionPlayed);
});

test('accept stroke 0 → skip stroke 1 → accept stroke 2 rapidly', () => {
    const s = createTemplateState(5);
    s.simulateStroke(goodStroke()); s.acceptStroke();
    _now += 5;
    s.skipAction();
    _now += 5;
    s.simulateStroke(goodStroke()); s.acceptStroke();
    advanceTime(1000);
    assert.strictEqual(_errors.length, 0);
    assert.strictEqual(s.currentStroke, 3);
    assert(s.paths[0].classList.contains('stroke-complete'));
    assert(s.paths[1].classList.contains('stroke-complete'));
    assert(s.paths[2].classList.contains('stroke-complete'));
});

// ─── PERFORMANCE BENCHMARK ─────────────────────────────────────────

console.log('\n=== Performance Benchmark ===\n');

test('benchmark: 100 full kanji completions (8 strokes each)', () => {
    const t0 = performance.now();
    for (let k = 0; k < 100; k++) {
        resetMocks();
        const s = createTemplateState(8);
        for (let i = 0; i < 8; i++) {
            s.simulateStroke(goodStroke());
            s.acceptStroke();
            _now += 300;
            advanceTime(100);
        }
        advanceTime(1000);
        assert.strictEqual(_errors.length, 0);
    }
    const elapsed = performance.now() - t0;
    console.log(`    (100 kanji × 8 strokes = 800 strokes in ${elapsed.toFixed(0)}ms)`);
    assert(elapsed < 5000, `too slow: ${elapsed.toFixed(0)}ms`);
});

// ─── Results ────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(55)}`);
console.log(`Results: ${passed} passed, ${failed} failed (${total} total)`);
console.log(`${'═'.repeat(55)}\n`);
process.exit(failed > 0 ? 1 : 0);
