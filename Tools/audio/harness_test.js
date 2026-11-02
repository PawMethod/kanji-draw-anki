// Scripted interaction for harness_*.html (see make_harness.py)
(async function () {
    var H = window.__kdHarness;
    var out = function (k, v) { console.log('KDR ' + H + '/' + k + ' ' + JSON.stringify(v)); };
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var calls = function () { return (window.__kdCalls || []).map(function (c) { return c.join(','); }); };
    var reset = function () { if (window.__kdCalls) window.__kdCalls.length = 0; };
    var summarize = function () {
        var cnt = {};
        (window.__kdCalls || []).forEach(function (x) { cnt[x[0]] = (cnt[x[0]] || 0) + 1; });
        return { counts: cnt, key: calls().filter(function (s) { return /^(strokeStart|strokeResult|complete|fx|demoStroke)/.test(s); }).slice(0, 24) };
    };
    var fire = function (type, pt, target, ptype) {
        target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: pt.x, clientY: pt.y, pointerId: 7, pointerType: ptype || 'pen', pressure: 0.6, isPrimary: true }));
    };
    var tap = async function (el) {
        var r = el.getBoundingClientRect(), c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        fire('pointerdown', c, el, 'mouse'); fire('pointerup', c, el, 'mouse'); el.click(); await wait(250);
    };
    window.addEventListener('unhandledrejection', function (e) { (window.__kdErrors || []).push('rejection: ' + String(e.reason && e.reason.message || e.reason)); });
    try {
        if (/shot=/.test(location.search)) {
            await wait(1200);
            var fe = { isTrusted: true, stopPropagation: function () { }, preventDefault: function () { } };
            openSettings(fe);
            await wait(400);
            var pg = (location.search.match(/shot=([\w-]+)/) || [])[1];
            if (pg && pg !== 'main') { var cc = document.querySelector('.category-card[onclick*="' + (pg === 'sound' ? 'page-sound' : pg) + '"]'); navigateToPage(pg === 'sound' ? 'page-sound' : pg, cc, fe); }
            if (/scroll/.test(location.search)) { await wait(500); var md = document.querySelector('.settings-modal'); if (md) md.scrollTop = md.scrollHeight; }
            return;
        }
        await wait(500);
        var a = window.__kdAudio;
        out('engine', { present: !!a, version: a && a.version, spied: !!(a && a.__spied) });
        out('enter', { beforeMain: window.__kdThemeBeforeMain, theme: document.documentElement.getAttribute('data-jp-theme'), active: sessionStorage.getItem('kanjiRandomThemeActive'), kdEnter: document.documentElement.classList.contains('kd-enter'), preRollLeft: window._kdPreRoll || null, pal: sessionStorage.getItem('kdPal:' + document.documentElement.getAttribute('data-jp-theme') + ':d'), backBtns: document.querySelectorAll('.back-to-main').length });
        out('init', { calls: calls().slice(0, 10), theme: document.documentElement.getAttribute('data-jp-theme'), soundPage: !!document.getElementById('page-sound'), soundRadios: document.querySelectorAll('input[name^="sound-"]').length, subDisabled: (document.getElementById('sound-sub-settings') || {}).className });

        reset();
        updateSoundSetting('level', 'mid'); updateSoundSetting('music', 'piano');
        await wait(1500);
        out('enable', { calls: calls(), state: a.state(), sub: document.getElementById('sound-sub-settings').className });

        reset();
        updateThemeSetting('primary', 'tokyo');
        await wait(900);
        out('themeChange', { calls: calls().filter(function (s) { return s.indexOf('setScene') === 0; }), state: a.state() });

        reset();
        var gear = document.querySelector('.gear-btn');
        if (gear) await tap(gear);
        var chk = {}; document.querySelectorAll('input[name^="sound-"]:checked').forEach(function (r) { chk[r.name] = r.value; });
        var card = document.querySelector('.category-card[onclick*="page-sound"]');
        if (card) await tap(card);
        var zen = document.querySelector('input[name="sound-music"][value="zen"]');
        if (zen) { zen.click(); await wait(200); }
        var ink = document.querySelector('input[name="theme-stroke-style"][value="ink"]');
        if (ink) { ink.click(); await wait(200); }
        var close = document.querySelector('#page-sound .back-to-main');
        if (close) await tap(close);
        var close2 = document.querySelector('#settings-main .close-settings');
        if (close2) await tap(close2);
        out('ui', { radios: chk, pageSoundActive: !!(document.getElementById('page-sound') || {}).classList && document.getElementById('page-sound').classList.contains('active'), summary: summarize(), music: a.state() });

        if (H === 'c1') {
            var layer = document.getElementById('draw-layer');
            var shield = document.getElementById('touch-shield');
            var target = (shield && document.documentElement.classList.contains('is-ankimobile')) ? shield : layer;
            var rect = layer.getBoundingClientRect();
            var toClient = function (p) { return { x: rect.left + p.x / 109 * rect.width, y: rect.top + p.y / 109 * rect.height }; };
            var drawPts = async function (pts) {
                fire('pointerdown', pts[0], target);
                for (var i = 1; i < pts.length; i++) { fire('pointermove', pts[i], target); await wait(14); }
                fire('pointerup', pts[pts.length - 1], document);
                await wait(150);
            };
            reset();
            var line = []; for (var i = 0; i <= 20; i++) line.push(toClient({ x: 95 - i * 4, y: 104 - i * 0.5 }));
            await drawPts(line);
            out('wrongStroke', summarize());

            reset();
            var refs = document.querySelectorAll('.svg-stroke');
            for (var s = 0; s < refs.length; s++) {
                var p = refs[s], L = p.getTotalLength(), pts = [];
                for (var k = 0; k <= 24; k++) pts.push(toClient(p.getPointAtLength(L * k / 24)));
                await drawPts(pts);
                await wait(650);
            }
            await wait(1000);
            out('traceAll', { strokes: refs.length, summary: summarize(), state: a.state() });
        }
    } catch (e) { out('EXC', String(e && e.stack || e).slice(0, 500)); }
    out('errors', window.__kdErrors || []);
    console.log('KDR DONE');
})();
