// fork: section layout on the back: order, hiding, columns and the edit mode ("Abschnitte", FORK.md).
// Runs before kd-fork-sections.js, which calls window._kdLayout.attach(host, KD_SECTIONS) before it builds
// the headers and L.start() after. Everything is global per device (persistence.js); '' counts as unset.
//   kdSecHidden   hidden section keys, comma-separated (all column counts)
//   kdLayout1     order for one column, comma-separated
//   kdLayout<n>   arrangement for n columns (3–9), e.g. "L1:strichfolge|C:elemente,eselsbruecken|R1:lesungen"
//   kdLayoutCols  auto | 1 | 3 | 5 | 7 | 9   kdLayoutSide  below | top   kdLayoutScroll  page | sticky
//                 (deck defaults: --default-layout-cols / -side / -scroll in Styling.css)
// Open/closed state: kdSec_<key> for one column, kdSecW_<key> for several.
(function () {
    var SLOTS = ['L4', 'L3', 'L2', 'L1', 'C', 'R1', 'R2', 'R3', 'R4'];
    var BY_DISTANCE = ['C', 'L1', 'R1', 'L2', 'R2', 'L3', 'R3', 'L4', 'R4'];
    var COUNTS = [1, 3, 5, 7, 9];
    var GAP = 16, EDGE = 16;
    var DEFAULT_WIDE = {
        5: { L2: ['links'], L1: ['strichfolge', 'schreibfehler'], C: ['elemente', 'eselsbruecken'], R1: ['lesungen', 'wortbeispiele'], R2: ['notiz'] },
        7: { L3: ['links'], L2: ['schreibfehler'], L1: ['strichfolge'], C: ['elemente', 'eselsbruecken'], R1: ['lesungen'], R2: ['wortbeispiele'], R3: ['notiz'] }
    };

    // --- Pure helpers (Tests/js/test_fork_layout.js) ---
    var core = {};
    core.slotsFor = function (n) { var h = (n - 1) / 2; return SLOTS.slice(4 - h, 5 + h); };
    // Columns beyond n go below the outermost remaining column on the same side (or the centre for n = 1).
    core.fold = function (arr, n) {
        var out = {}, h = (n - 1) / 2;
        core.slotsFor(n).forEach(function (s) { out[s] = []; });
        BY_DISTANCE.forEach(function (s) {
            var list = arr[s];
            if (!list || !list.length) return;
            var target = s === 'C' || +s.slice(1) <= h ? s : (h ? s.charAt(0) + h : 'C');
            out[target] = out[target].concat(list);
        });
        return out;
    };
    core.parseList = function (str, keys, seen) {
        seen = seen || {};
        var out = [];
        String(str || '').split(',').forEach(function (k) {
            k = k.trim();
            if (keys.indexOf(k) >= 0 && !seen[k]) { seen[k] = 1; out.push(k); }
        });
        return out;
    };
    core.parseCols = function (str, n, keys) {
        var raw = {}, seen = {};
        String(str || '').split('|').forEach(function (part) {
            var i = part.indexOf(':');
            var slot = i < 0 ? '' : part.slice(0, i).trim();
            if (SLOTS.indexOf(slot) >= 0) raw[slot] = (raw[slot] || []).concat(core.parseList(part.slice(i + 1), keys, seen));
        });
        return core.fold(raw, n);
    };
    core.serialize = function (arr, n) {
        if (n === 1) return (arr.C || []).join(',');
        return SLOTS.filter(function (s) { return arr[s] && arr[s].length; }).map(function (s) { return s + ':' + arr[s].join(','); }).join('|');
    };
    core.defaultFor = function (n, keys) {
        if (n === 1) return { C: keys.slice() };
        var def = core.fold(DEFAULT_WIDE[n >= 7 ? 7 : 5], n);
        Object.keys(def).forEach(function (s) { def[s] = def[s].filter(function (k) { return keys.indexOf(k) >= 0; }); });
        return def;
    };
    // Every key exactly once: a missing one goes into its default column, after its default predecessor.
    core.complete = function (arr, keys, def) {
        var have = {};
        Object.keys(arr).forEach(function (s) { arr[s].forEach(function (k) { have[k] = 1; }); });
        keys.forEach(function (k) {
            if (have[k]) return;
            var slot = 'C';
            Object.keys(def).forEach(function (s) { if (def[s].indexOf(k) >= 0 && arr[s]) slot = s; });
            var list = arr[slot], order = def[slot] || keys, at = list.length;
            for (var i = 0, known = false; i < list.length; i++) {
                var di = order.indexOf(list[i]);
                if (di < 0) continue;
                if (!known) { known = true; at = 0; }
                if (di < order.indexOf(k)) at = i + 1;
            }
            list.splice(at, 0, k);
            have[k] = 1;
        });
        return arr;
    };
    // Saved arrangement for n, else the nearest larger saved one folded down, else the default.
    core.arrangement = function (n, read, keys) {
        var arr = null;
        if (n === 1) {
            var one = read('kdLayout1');
            if (one) arr = { C: core.parseList(one, keys) };
        } else {
            for (var m = n; m <= 9 && !arr; m += 2) {
                var saved = read('kdLayout' + m);
                if (saved) arr = core.parseCols(saved, n, keys);
            }
        }
        return core.complete(arr || core.defaultFor(n, keys), keys, core.defaultFor(n, keys));
    };
    core.fits = function (n, size, width) { return n * size + (n - 1) * GAP + 2 * EDGE <= width; };
    // Column count: the setting (auto = 1 on phones, otherwise up to 9) capped by what fits the window.
    core.count = function (setting, size, width, phone) {
        var max = setting === 'auto' || !(+setting) ? (phone ? 1 : 9) : +setting, best = 1;
        COUNTS.forEach(function (n) { if (n <= max && core.fits(n, size, width)) best = n; });
        return best;
    };
    // Outside the edit mode, outer column pairs without a shown section are dropped.
    core.shownCount = function (arr, n, hidden) {
        var used = function (s) { return (arr[s] || []).some(function (k) { return hidden.indexOf(k) < 0; }); };
        while (n > 1 && !used('L' + (n - 1) / 2) && !used('R' + (n - 1) / 2)) n -= 2;
        return n;
    };
    // Move key to slot before beforeKey (or to the end).
    core.move = function (arr, key, slot, beforeKey) {
        Object.keys(arr).forEach(function (s) { var i = arr[s].indexOf(key); if (i >= 0) arr[s].splice(i, 1); });
        var list = arr[slot], at = beforeKey ? list.indexOf(beforeKey) : -1;
        if (at >= 0) list.splice(at, 0, key); else list.push(key);
        return arr;
    };

    var api = window._kdLayout = { core: core, gap: GAP };
    if (typeof document === 'undefined') return;

    var get = function (k, d) { try { var v = typeof safeGetItem === 'function' ? safeGetItem(k, d) : d; return v == null ? d : v; } catch (e) { return d; } };
    var set = function (k, v) { try { if (typeof safeSetItem === 'function') safeSetItem(k, v); } catch (e) { } };
    var el = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
    var SVG = function (inner) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '<' + '/svg>'; };
    var ICONS = {
        grip: '<circle cx="9" cy="6" r="1.3"></circle><circle cx="15" cy="6" r="1.3"></circle><circle cx="9" cy="12" r="1.3"></circle><circle cx="15" cy="12" r="1.3"></circle><circle cx="9" cy="18" r="1.3"></circle><circle cx="15" cy="18" r="1.3"></circle>',
        up: '<path d="M6 15l6-6 6 6"></path>', down: '<path d="M6 9l6 6 6-6"></path>',
        left: '<path d="M15 6l-6 6 6 6"></path>', right: '<path d="M9 6l6 6-6 6"></path>',
        eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>',
        eyeOff: '<path d="M3 3l18 18"></path><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.6 3.4M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"></path>'
    };

    var S = null; // state of the attached back

    api.attach = function (host, sections) {
        var keys = sections.map(function (c) { return c.key; });
        if (S && S.ro) S.ro.disconnect(); // Anki Desktop keeps the document between cards
        S = {
            host: host, keys: keys, secs: {}, cols: {}, editing: false, n: 1,
            hidden: core.parseList(get('kdSecHidden', ''), keys)
        };
        // Sections whose fields are empty are not in the markup (Anki field conditions); a bare one keeps their place in the edit mode.
        keys.forEach(function (k) {
            var s = host.querySelector('.kd-section[data-sec="' + k + '"]');
            if (!s) {
                s = el('section', 'kd-section kd-sec-empty');
                s.setAttribute('data-sec', k);
                s.appendChild(el('div', 'kd-section-body'));
                host.appendChild(s);
            }
            S.secs[k] = s;
        });
        S.n = measureCount();
        S.arr = core.arrangement(S.n, function (k) { return get(k, ''); }, keys);
        return {
            wide: function () { return S && S.n > 1; },
            secKey: function (key) { return (S && S.n > 1 ? 'kdSecW_' : 'kdSec_') + key; },
            start: start
        };
    };
    api.alive = function () { return !!(S && S.host.isConnected); };
    api.count = function () { return S ? S.n : 1; };

    // Deck default from Styling.css (getGlobalConfig), overridden by the saved choice.
    function option(name) {
        var gc = {}, fallback = { cols: 'auto', side: 'below', scroll: 'page' }[name];
        try { gc = getGlobalConfig() || {}; } catch (e) { }
        var cap = name.charAt(0).toUpperCase() + name.slice(1); // cols → kdLayoutCols (saved), layoutCols (deck)
        return get('kdLayout' + cap, '') || gc['layout' + cap] || fallback;
    }
    api.option = option;
    // Columns are as wide as the drawing area (--dynamic-size) and must fit the space beside the page padding.
    function measureCount() {
        var probe = el('div');
        probe.style.cssText = 'position:absolute;visibility:hidden;height:0;width:var(--dynamic-size)';
        S.host.appendChild(probe);
        var size = probe.getBoundingClientRect().width || 400;
        probe.remove();
        var parent = S.host.parentElement, width = parent ? parent.getBoundingClientRect().width : window.innerWidth;
        var phone = false;
        try { phone = window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600; } catch (e) { }
        return core.count(option('cols'), size, width, phone);
    }

    function start(onModeChange) {
        var host = S.host;
        S.onModeChange = onModeChange;
        S.wrap = el('div', 'kd-cols');
        var tags = host.querySelector('.kd-info-tags');
        if (tags && tags.parentNode === host) host.insertBefore(S.wrap, tags.nextSibling); else host.insertBefore(S.wrap, host.firstChild);
        S.strip = el('div', 'kd-hidden-strip');
        S.strip.appendChild(el('div', 'kd-hidden-strip-label', 'Ausgeblendet <span>· hierher ziehen oder das Auge antippen</span>'));
        host.appendChild(S.strip);
        Object.keys(S.secs).forEach(function (k) { decorate(S.secs[k], k); });
        render();
        if (window.ResizeObserver) {
            var queued = false;
            S.ro = new ResizeObserver(function () {
                if (queued) return;
                queued = true;
                requestAnimationFrame(function () {
                    queued = false;
                    if (api.alive()) place(); else if (S && S.ro) S.ro.disconnect();
                });
            });
            S.ro.observe(document.body);
            S.ro.observe(S.wrap);
        }
        if (window._kdLayoutResize) window.removeEventListener('resize', window._kdLayoutResize);
        var t = null;
        window._kdLayoutResize = function () {
            if (!api.alive()) { window.removeEventListener('resize', window._kdLayoutResize); return; }
            clearTimeout(t);
            t = setTimeout(refresh, 120);
        };
        window.addEventListener('resize', window._kdLayoutResize);
    }

    // Recompute the column count; switching between one and several columns swaps the open/closed set.
    function refresh() {
        if (!api.alive()) return;
        var n = measureCount();
        if (n !== S.n) {
            var wasWide = S.n > 1;
            S.n = n;
            S.arr = core.arrangement(n, function (k) { return get(k, ''); }, S.keys);
            render();
            if (wasWide !== (n > 1) && S.onModeChange) S.onModeChange();
        } else render();
    }
    api.refresh = refresh;

    function render() {
        var n = S.n, arr = S.arr;
        var shown = S.editing ? n : core.shownCount(arr, n, S.hidden);
        var slots = core.slotsFor(shown);
        slots.forEach(function (s) {
            var col = S.cols[s] || (S.cols[s] = el('div', 'kd-col'));
            col.setAttribute('data-slot', s);
            S.wrap.appendChild(col);
        });
        slots.forEach(function (s) {
            (arr[s] || []).forEach(function (k) {
                var sec = S.secs[k];
                if (sec) (S.hidden.indexOf(k) >= 0 ? S.strip : S.cols[s]).appendChild(sec);
            });
        });
        Object.keys(S.cols).forEach(function (s) { if (slots.indexOf(s) < 0 && S.cols[s].parentNode) S.cols[s].remove(); });
        S.host.classList.toggle('kd-editing', S.editing);
        S.host.classList.toggle('kd-wide', shown > 1);
        S.host.classList.toggle('kd-side-top', shown > 1 && option('side') === 'top');
        S.host.classList.toggle('kd-sticky', shown > 1 && !S.editing && option('scroll') === 'sticky');
        S.host.style.setProperty('--kd-cols', shown);
        Object.keys(S.secs).forEach(function (k) {
            var off = S.hidden.indexOf(k) >= 0, eye = S.secs[k].querySelector('.kd-edit-eye');
            if (eye) {
                eye.innerHTML = SVG(off ? ICONS.eyeOff : ICONS.eye);
                eye.setAttribute('aria-label', (off ? 'Einblenden: ' : 'Ausblenden: ') + S.secs[k]._kdTitle);
                eye.setAttribute('aria-pressed', off ? 'true' : 'false');
            }
        });
        if (S.bar) S.bar.querySelector('.kd-edit-count').textContent = 'Bearbeite: ' + n + (n === 1 ? ' Spalte' : ' Spalten');
        place();
    }

    // "Oben": side columns start beside the drawings, below the keyword row. "Lange Spalten scrollen allein":
    // every column is sticky; one taller than the window keeps scrolling until its end is visible.
    function place() {
        var host = S.host, lift = 0;
        if (host.classList.contains('kd-side-top')) {
            var row = document.querySelector('.kd-title-row'), top = row ? row.getBoundingClientRect().bottom + 16 : 0;
            lift = Math.max(0, Math.round(S.wrap.getBoundingClientRect().top - top));
        }
        host.style.setProperty('--kd-lift', lift + 'px');
        var sticky = host.classList.contains('kd-sticky'), vh = window.innerHeight;
        Object.keys(S.cols).forEach(function (s) {
            var col = S.cols[s];
            col.style.top = sticky ? Math.min(12, vh - col.offsetHeight - 12) + 'px' : '';
        });
    }

    function save() {
        set('kdLayout' + S.n, core.serialize(S.arr, S.n));
        set('kdSecHidden', S.hidden.join(','));
    }
    function slotOf(key) {
        var found = 'C';
        Object.keys(S.arr).forEach(function (s) { if (S.arr[s].indexOf(key) >= 0) found = s; });
        return found;
    }
    function setHidden(key, off) {
        var i = S.hidden.indexOf(key);
        if (off && i < 0) S.hidden.push(key);
        if (!off && i >= 0) S.hidden.splice(i, 1);
    }
    function apply(focus) {
        save();
        render();
        if (focus && focus.isConnected) { try { focus.focus({ preventScroll: true }); } catch (e) { focus.focus(); } }
    }
    // Arrow buttons: up/down skip hidden neighbours; left/right keep the visible position in the next column.
    function step(key, dir, btn) {
        var slot = slotOf(key), list = S.arr[slot], i = list.indexOf(key);
        if (dir === 'up' || dir === 'down') {
            var d = dir === 'up' ? -1 : 1, j = i + d;
            while (j >= 0 && j < list.length && S.hidden.indexOf(list[j]) >= 0) j += d;
            if (j < 0 || j >= list.length) return;
            list.splice(i, 1);
            list.splice(j, 0, key);
        } else {
            var slots = core.slotsFor(S.n), to = slots[slots.indexOf(slot) + (dir === 'left' ? -1 : 1)];
            if (!to) return;
            var pos = list.filter(function (k) { return S.hidden.indexOf(k) < 0; }).indexOf(key);
            var target = S.arr[to].filter(function (k) { return S.hidden.indexOf(k) < 0; });
            core.move(S.arr, key, to, target[pos] || null);
        }
        apply(btn);
    }

    function decorate(sec, key) {
        var header = sec.querySelector('.kd-section-header');
        if (!header || header._kdEdit) return;
        header._kdEdit = true;
        sec._kdTitle = (header.querySelector('.kd-section-title') || {}).textContent || key;
        var stop = function (e) { e.stopPropagation(); };
        var grip = el('span', 'kd-edit-grip tappable', SVG(ICONS.grip));
        grip.setAttribute('aria-hidden', 'true');
        grip.title = 'Ziehen zum Verschieben';
        header.insertBefore(grip, header.firstChild);
        grip.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); });
        grip.addEventListener('pointerdown', function (e) { dragStart(e, sec, key); });
        var empty = el('span', 'kd-edit-empty', 'leer auf dieser Karte');
        var title = header.querySelector('.kd-section-title');
        if (title) title.appendChild(empty);
        var ctl = el('span', 'kd-edit-ctl');
        [['left', 'nach links'], ['up', 'nach oben'], ['down', 'nach unten'], ['right', 'nach rechts']].forEach(function (b) {
            var btn = el('button', 'kd-edit-btn kd-edit-' + b[0] + ' tappable', SVG(ICONS[b[0]]));
            btn.type = 'button';
            btn.setAttribute('aria-label', sec._kdTitle + ' ' + b[1]);
            btn.addEventListener('click', function (e) { stop(e); e.preventDefault(); step(key, b[0], btn); });
            btn.addEventListener('keydown', stop);
            ctl.appendChild(btn);
        });
        var eye = el('button', 'kd-edit-btn kd-edit-eye tappable');
        eye.type = 'button';
        eye.addEventListener('click', function (e) {
            stop(e); e.preventDefault();
            setHidden(key, S.hidden.indexOf(key) < 0);
            apply(eye);
        });
        eye.addEventListener('keydown', stop);
        ctl.appendChild(eye);
        var chevron = header.querySelector('.kd-section-chevron');
        header.insertBefore(ctl, chevron || null);
    }

    // --- Drag by the grip (mouse, touch, pen) ---
    function dragStart(e, sec, key) {
        if (!S.editing || (e.pointerType === 'mouse' && e.button !== 0)) return;
        e.preventDefault();
        e.stopPropagation();
        var grip = e.currentTarget, rect = sec.getBoundingClientRect(), header = sec.querySelector('.kd-section-header');
        var ph = el('div', 'kd-drop-ph');
        ph.style.height = (header ? header.offsetHeight : 52) + 'px';
        sec.parentNode.insertBefore(ph, sec);
        var dx = e.clientX - rect.left, dy = e.clientY - rect.top;
        sec.classList.add('kd-dragging');
        sec.style.width = rect.width + 'px';
        var lastX = e.clientX, lastY = e.clientY, raf = 0;
        var place = function () {
            sec.style.left = (lastX - dx) + 'px';
            sec.style.top = (lastY - Math.min(dy, 40)) + 'px';
            var target = hitContainer(lastX, lastY);
            if (!target) return;
            var before = null, items = target === S.strip ? [] : target.querySelectorAll('.kd-section');
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                if (it === sec || !it.getClientRects().length) continue;
                var r = it.getBoundingClientRect();
                if (lastY < r.top + r.height / 2) { before = it; break; }
            }
            if (before) { if (ph.nextSibling !== before) target.insertBefore(ph, before); } else if (ph.parentNode !== target || ph.nextSibling) target.appendChild(ph);
        };
        var tick = function () {
            var edge = 70, h = window.innerHeight, v = 0;
            if (lastY < edge) v = -Math.ceil((edge - lastY) / 5);
            else if (lastY > h - edge) v = Math.ceil((lastY - (h - edge)) / 5);
            if (v) { window.scrollBy(0, v); place(); }
            raf = requestAnimationFrame(tick);
        };
        try { grip.setPointerCapture(e.pointerId); } catch (err) { }
        var move = function (ev) { lastX = ev.clientX; lastY = ev.clientY; place(); };
        var end = function () {
            cancelAnimationFrame(raf);
            grip.removeEventListener('pointermove', move);
            grip.removeEventListener('pointerup', end);
            grip.removeEventListener('pointercancel', end);
            sec.classList.remove('kd-dragging');
            sec.style.left = sec.style.top = sec.style.width = '';
            var parent = ph.parentNode, next = ph.nextElementSibling;
            while (next && !next.classList.contains('kd-section')) next = next.nextElementSibling;
            ph.remove();
            if (!parent || !S.host.isConnected) return;
            if (parent === S.strip) setHidden(key, true);
            else {
                setHidden(key, false);
                core.move(S.arr, key, parent.getAttribute('data-slot') || 'C', next ? next.getAttribute('data-sec') : null);
            }
            apply();
            if (typeof _kdSnd === 'function') _kdSnd('fx', 'tick');
        };
        grip.addEventListener('pointermove', move);
        grip.addEventListener('pointerup', end);
        grip.addEventListener('pointercancel', end);
        place();
        raf = requestAnimationFrame(tick);
    }
    function hitContainer(x, y) {
        var r = S.strip.getBoundingClientRect();
        if (y >= r.top - 8 && y <= r.bottom + 8 && x >= r.left && x <= r.right) return S.strip;
        var best = null, dist = Infinity;
        core.slotsFor(S.n).forEach(function (s) {
            var col = S.cols[s];
            if (!col || !col.isConnected) return;
            var cr = col.getBoundingClientRect(), d = x < cr.left ? cr.left - x : x > cr.right ? x - cr.right : 0;
            if (d < dist) { dist = d; best = col; }
        });
        return best;
    }

    // --- Edit mode ---
    api.edit = function (on) {
        if (!api.alive()) return false;
        on = on !== false;
        if (on === S.editing) return true;
        S.editing = on;
        if (on) {
            S.bar = el('div', 'kd-edit-bar tappable');
            S.bar.setAttribute('role', 'toolbar');
            S.bar.setAttribute('aria-label', 'Layout bearbeiten');
            S.bar.innerHTML = '<span class="kd-edit-count"></span>';
            var reset = el('button', 'kd-edit-bar-btn tappable', 'Zurücksetzen');
            var done = el('button', 'kd-edit-bar-btn kd-edit-done tappable', 'Fertig');
            reset.type = done.type = 'button';
            reset.addEventListener('click', function (e) {
                e.stopPropagation();
                set('kdLayout' + S.n, '');
                S.arr = core.arrangement(S.n, function (k) { return get(k, ''); }, S.keys);
                render();
            });
            done.addEventListener('click', function (e) { e.stopPropagation(); api.edit(false); });
            S.bar.appendChild(reset);
            S.bar.appendChild(done);
            S.host.appendChild(S.bar);
        } else if (S.bar) {
            S.bar.remove();
            S.bar = null;
        }
        render();
        if (on) S.host.scrollIntoView({ block: 'start', behavior: 'smooth' });
        return true;
    };
    api.editing = function () { return !!(S && S.editing); };
    // Settings page: save an option and redraw the visible back.
    api.setOption = function (key, value) {
        set(key, value);
        refresh();
    };
    // "Alle Layouts zurücksetzen": every column count and the hidden sections.
    api.resetAll = function () {
        COUNTS.forEach(function (n) { set('kdLayout' + n, ''); });
        set('kdSecHidden', '');
        if (!api.alive()) return;
        S.hidden = [];
        S.arr = core.arrangement(S.n, function (k) { return get(k, ''); }, S.keys);
        render();
    };
})();
