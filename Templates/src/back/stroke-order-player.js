// --- Stroke-Order Player ---

(function () {
    var NS = 'http://www.w3.org/2000/svg';
    if (window._kanjiOrder && window._kanjiOrder.st.raf) cancelAnimationFrame(window._kanjiOrder.st.raf);
    var st = { n: 0, idx: 0, prog: 0, playing: false, raf: null, speed: 1, last: 0, waitUntil: 0, strokes: [], marks: [], nums: [], lens: [], svg: null };
    var SPEEDS = [1, 0.5, 2], SPEED_LABELS = { 1: '1×', 0.5: '0,5×', 2: '2×' };
    var ICONS = {
        play: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="7 4 20 12 7 20 7 4"></polygon></svg>',
        pause: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>',
        replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>'
    };
    var reducedMotion = function () {
        return document.body.classList.contains('reduce-motion') ||
            !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };
    var mk = function (tag, attrs) {
        var e = document.createElementNS(NS, tag);
        for (var k in attrs) e.setAttribute(k, attrs[k]);
        return e;
    };
    var build = function () {
        var svg = document.getElementById('order-svg'), src = document.getElementById('svg-bg');
        if (!svg || !src) return false;
        var ds = [];
        for (var c = 0; c < src.children.length; c++) {
            var p = src.children[c];
            if (p.tagName.toLowerCase() === 'path' && p.getAttribute('d') && !p.classList.contains('gel-halo')) ds.push(p.getAttribute('d'));
        }
        if (!ds.length) return false;
        svg.innerHTML = '';
        svg.appendChild(mk('path', { 'class': 'order-grid', d: 'M54.5 0V109M0 54.5H109' }));
        var ghosts = ds.map(function (d) { var g = mk('path', { 'class': 'order-ghost', d: d }); svg.appendChild(g); return g; });
        st.strokes = ds.map(function (d) { var s = mk('path', { 'class': 'order-stroke', d: d, pathLength: '100' }); svg.appendChild(s); return s; });
        st.lens = []; st.marks = []; st.nums = [];
        ghosts.forEach(function (g, i) {
            var L = 0;
            try { L = g.getTotalLength(); } catch (e) { }
            st.lens.push(L || 40);
            var p0 = L ? g.getPointAtLength(0) : { x: 0, y: 0 }, p1 = L ? g.getPointAtLength(Math.min(8, L)) : p0;
            var dl = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1, ux = (p1.x - p0.x) / dl, uy = (p1.y - p0.y) / dl;
            var bx = p0.x + ux * 12, by = p0.y + uy * 12, hx = -ux * 3, hy = -uy * 3, nx = -uy * 2.4, ny = ux * 2.4;
            var mark = mk('g', {});
            mark.appendChild(mk('circle', { 'class': 'order-dot', cx: p0.x.toFixed(2), cy: p0.y.toFixed(2), r: '2.4' }));
            mark.appendChild(mk('path', {
                'class': 'order-arrow',
                d: 'M' + (p0.x + ux * 5).toFixed(2) + ',' + (p0.y + uy * 5).toFixed(2) + 'L' + bx.toFixed(2) + ',' + by.toFixed(2) +
                    'M' + (bx + hx + nx).toFixed(2) + ',' + (by + hy + ny).toFixed(2) + 'L' + bx.toFixed(2) + ',' + by.toFixed(2) +
                    'L' + (bx + hx - nx).toFixed(2) + ',' + (by + hy - ny).toFixed(2)
            }));
            svg.appendChild(mark); st.marks.push(mark);
            var num = mk('text', { 'class': 'order-num', x: (p0.x - ux * 5).toFixed(2), y: (p0.y - uy * 5).toFixed(2) });
            num.textContent = String(i + 1);
            svg.appendChild(num); st.nums.push(num);
        });
        st.svg = svg; st.n = ds.length;
        return true;
    };
    var render = function () {
        for (var i = 0; i < st.n; i++) {
            var off = i < st.idx ? 0 : (i === st.idx ? 105 * (1 - st.prog) : 105);
            st.strokes[i].style.strokeDashoffset = off.toFixed(2);
            st.strokes[i].classList.toggle('order-current', i === st.idx);
            st.marks[i].style.display = (i === st.idx) ? '' : 'none';
            st.nums[i].style.display = (i < st.idx || (i === st.idx && st.prog > 0)) ? '' : 'none';
        }
        var prog = document.getElementById('order-progress');
        if (prog) prog.textContent = 'Strich ' + Math.min(st.idx + (st.prog > 0 ? 1 : 0), st.n) + ' / ' + st.n;
        var tg = document.getElementById('order-toggle');
        if (tg) tg.innerHTML = st.playing ? ICONS.pause : (st.idx >= st.n ? ICONS.replay : ICONS.play);
        var sp = document.getElementById('order-speed');
        if (sp) sp.textContent = SPEED_LABELS[st.speed];
    };
    var duration = function (i) { return Math.max(450, Math.min(1400, 300 + st.lens[i] * 11)); };
    var tick = function (ts) {
        st.raf = null;
        if (!st.playing || !st.svg || !st.svg.isConnected) { st.playing = false; return; }
        var dt = st.last ? Math.min(ts - st.last, 100) : 0;
        st.last = ts;
        if (st.waitUntil <= ts) {
            var rm = reducedMotion();
            st.prog = rm ? 1 : st.prog + dt * st.speed / duration(st.idx);
            if (st.prog >= 1) {
                st.prog = 0; st.idx++;
                st.waitUntil = ts + (rm ? 700 : 280) / st.speed;
                if (st.idx >= st.n) { st.idx = st.n; st.playing = false; }
            }
            render();
        }
        if (st.playing) st.raf = requestAnimationFrame(tick);
    };
    var pause = function () {
        st.playing = false;
        if (st.raf) { cancelAnimationFrame(st.raf); st.raf = null; }
    };
    var play = function () {
        if (st.idx >= st.n) { st.idx = 0; st.prog = 0; }
        st.playing = true; st.last = 0; st.waitUntil = 0;
        if (!st.raf) st.raf = requestAnimationFrame(tick);
        render();
    };
    var open = function () {
        if (st.svg !== document.getElementById('order-svg') && !build()) return;
        pause(); st.idx = 0; st.prog = 0; render();
        var pOrder = document.getElementById('info-page-order');
        setTimeout(function () {
            if (pOrder && pOrder.classList.contains('active')) play();
        }, 220);
    };
    var close = function () {
        pause();
    };
    var action = function (act) {
        if (!st.n) return;
        if (act === 'toggle') { if (st.playing) pause(); else play(); }
        else if (act === 'next') { pause(); st.idx = Math.min(st.n, st.idx + 1); st.prog = 0; }
        else if (act === 'prev') { pause(); if (st.prog > 0) st.prog = 0; else st.idx = Math.max(0, st.idx - 1); }
        else if (act === 'speed') { st.speed = SPEEDS[(SPEEDS.indexOf(st.speed) + 1) % SPEEDS.length]; }
        render();
    };
    window._kanjiOrder = { st: st, open: open, close: close, action: action };
})();

function openStrokeOrder(e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    if (window._kanjiOrder) window._kanjiOrder.open();
}
function strokeOrderAction(act, e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    if (window._kanjiOrder) window._kanjiOrder.action(act);
}
