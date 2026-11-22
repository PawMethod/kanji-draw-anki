// fork: inline info sections on the back (replaces upstream's info modal, docs/fork/v3-migration.md D3).
// KD_SECTIONS is the single source for order, titles, icons and the default collapsed state; the markup
// in the back templates only holds the section bodies. Each section remembers its state in kdSec_<key>
// ('1' = collapsed; kdSecW_<key> with several columns). Lazy sections (Strichfolge, Schreibfehler) initialise
// on first open. Order, hiding, columns and the edit mode live in kd-fork-layout.js.
(function () {
    var host = document.getElementById('kd-info-inline');
    if (!host || host._kdReady) return;
    host._kdReady = true;

    var ICON = {
        elemente: '<circle cx="12" cy="5" r="3" class="fi-gold"></circle><circle cx="5.5" cy="18" r="3" class="fi-cream"></circle>' +
            '<circle cx="18.5" cy="18" r="3" class="fi-teal"></circle><path d="M12 8v3.5M12 11.5H5.5V15M12 11.5h6.5V15"></path>',
        strichfolge: '<circle cx="12" cy="12" r="9.5" class="fi-cream"></circle><polygon points="9.8,7.4 17.4,12 9.8,16.6" class="fi-coral"></polygon>',
        eselsbruecken: '<path d="M15.1 14.5c.2-.9.6-1.7 1.4-2.5A4.6 4.6 0 0 0 18 8.2a6 6 0 0 0-12 0c0 1 .2 2.2 1.5 3.8.7.8 1.2 1.6 1.4 2.5z" class="fi-gold"></path>' +
            '<rect x="8.8" y="14.5" width="6.4" height="5.5" rx="1.6" class="fi-cream"></rect><line x1="9" y1="17.2" x2="15" y2="17.2"></line>',
        notiz: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" class="fi-cream"></path><path d="M14 2v6h6" class="fi-gold"></path>' +
            '<line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>',
        schreibfehler: '<circle cx="12" cy="12" r="9.5" class="fi-cream"></circle><circle cx="12" cy="12" r="5.6" class="fi-coral"></circle><circle cx="12" cy="12" r="2.2" class="fi-gold"></circle>',
        wortbeispiele: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" class="fi-teal"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" class="fi-cream"></path>',
        lesungen: '<path d="M10.5 4C6.4 4 3 6.7 3 10c0 1.8 1 3.4 2.5 4.5L4.5 17l3.2-1.4c.9.3 1.8.4 2.8.4 4.1 0 7.5-2.7 7.5-6S14.6 4 10.5 4z" class="fi-gold"></path>' +
            '<path d="M16 11.5c-2.8 0-5 2-5 4.4s2.2 4.4 5 4.4c.6 0 1.2-.1 1.8-.3l2.2 1-0.6-2c1-0.8 1.6-1.9 1.6-3.1 0-2.4-2.2-4.4-5-4.4z" class="fi-cream"></path>',
        links: '<circle cx="12" cy="12" r="10" class="fi-teal"></circle><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" class="fi-mint"></path>' +
            '<line x1="2" y1="12" x2="22" y2="12"></line>'
    };

    // Minimal design (D25): the pre-v3 outline icons (feathericons.com)
    var ICON_MIN = {
        elemente: '<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline>',
        strichfolge: '<circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon>',
        eselsbruecken: '<path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path>',
        notiz: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>',
        schreibfehler: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
        wortbeispiele: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>',
        lesungen: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
        links: '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>'
    };
    var iconFor = function (key) {
        var set = document.documentElement.classList.contains('kd-design-minimal') ? ICON_MIN : ICON;
        return set[key] || '';
    };
    window._kdSectionIcons = function () {
        document.querySelectorAll('#kd-info-inline .kd-section[data-sec]').forEach(function (sec) {
            var svg = sec.querySelector('.kd-section-icon');
            if (svg) svg.innerHTML = iconFor(sec.getAttribute('data-sec'));
        });
    };

    var KD_SECTIONS = [
        { key: 'elemente', title: 'Elemente' },
        { key: 'eselsbruecken', title: 'Eselsbrücken' },
        { key: 'strichfolge', title: 'Strichfolge', collapsed: true, wideCollapsed: false, onOpen: openOrder, onClose: closeOrder },
        { key: 'notiz', title: 'Notiz' },
        { key: 'schreibfehler', title: 'Schreibfehler', collapsed: true, onOpen: openPitfalls },
        { key: 'wortbeispiele', title: 'Wortbeispiele' },
        { key: 'lesungen', title: 'Lesungen' },
        { key: 'links', title: 'Externe Links' }
    ];
    window._kdSections = KD_SECTIONS;

    var get = function (k, d) { try { return typeof safeGetItem === 'function' ? safeGetItem(k, d) : d; } catch (e) { return d; } };
    var set = function (k, v) { try { if (typeof safeSetItem === 'function') safeSetItem(k, v); } catch (e) { } };
    var buzz = function () { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8); };
    var isOpen = function (sec) { return sec && !sec.classList.contains('collapsed') && !sec.classList.contains('kd-sec-empty') && sec.style.display !== 'none'; };

    // --- Lazy content ---
    var orderTimer = null;
    function openOrder(sec) {
        if (!window._kanjiOrder || sec.classList.contains('kd-sec-empty')) return;
        window._kanjiOrder.open();
        clearTimeout(orderTimer);
        // upstream's open() only autoplays inside its modal page, so start playback here
        orderTimer = setTimeout(function () {
            var o = window._kanjiOrder;
            if (o && isOpen(sec) && !o.st.playing && o.st.idx === 0) o.action('toggle');
        }, 260);
    }
    function closeOrder() {
        clearTimeout(orderTimer);
        if (window._kanjiOrder) window._kanjiOrder.close();
    }
    function openPitfalls(sec) {
        if (sec._kdPitDone || !window._kanjiRenderPitfalls) return;
        var raw = document.getElementById('kd-raw-pitfalls-data');
        var list = document.getElementById('pitfalls-list-target');
        if (!raw || !list) return;
        sec._kdPitDone = true;
        var txt = raw.innerHTML.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim();
        if (!txt) return;
        try {
            window._kanjiRenderPitfalls(txt, list, document.getElementById('pitfalls-preview-pad'),
                document.getElementById('pitfalls-filter-bar'), null, null);
        } catch (e) { }
    }

    // --- Empty content: drop groups; mark sections that would only show a header (the edit mode still lists them) ---
    var hide = function (key) { var s = host.querySelector('.kd-section[data-sec="' + key + '"]'); if (s) s.classList.add('kd-sec-empty'); };
    host.querySelectorAll('.kd-story-group').forEach(function (g) {
        if (!g.querySelector('.story-box, .visuell-hinweis, .info-text-story')) g.remove();
    });
    var esel = host.querySelector('.kd-section[data-sec="eselsbruecken"]');
    if (esel && !esel.querySelector('.story-box, .visuell-hinweis, .info-text-story')) hide('eselsbruecken');
    var note = host.querySelector('.kd-note-box');
    if (note && !note.textContent.replace(/ /g, ' ').trim() && !note.querySelector('img, video, audio, svg')) hide('notiz');
    if (!host.querySelector('.readings-container--backside .reading-row')) hide('lesungen');
    if (!document.querySelector('#svg-bg path')) hide('strichfolge');

    // --- Primitives ("[name]" in Kanji): no font samples; no tree if Radikale only names the primitive itself ---
    var rootEl = host.querySelector('.tree-root-kanji');
    if (rootEl && /^\s*\[/.test(rootEl.textContent)) {
        var box = rootEl.closest('.custom-tree-box');
        if (box) box.classList.add('is-primitive');
        var fe = host.querySelector('.kanji-font-examples');
        if (fe) fe.classList.add('is-primitive');
        var rawTree = document.getElementById('raw-tree-data');
        var t = rawTree ? rawTree.textContent.replace(/<[^>]*>/g, '').trim() : '';
        var depth = 0, top = 1;
        for (var i = 0; i < t.length; i++) {
            var ch = t[i];
            if (ch === '[' || ch === '{') depth++;
            else if (ch === ']' || ch === '}') depth--;
            else if (ch === ',' && depth === 0) top++;
        }
        if (top <= 1 && t.indexOf('{') === -1) hide('elemente');
    }

    // --- Handschriftbeispiele: per-card setting (c1_/c2_kanjiOptHandwriting), re-applied live from the settings radios ---
    window._kdApplyHandwriting = function () {
        var fe = document.querySelector('#kd-info-inline .kanji-font-examples');
        if (!fe) return;
        var card = typeof _hostCard === 'string' ? _hostCard : 'c1';
        var def = 'off';
        try { def = getGlobalConfig().handwriting || 'off'; } catch (e) { }
        fe.classList.toggle('is-visible', get(card + '_kanjiOptHandwriting', get('kanjiOptHandwriting', def)) === 'on');
    };
    window._kdApplyHandwriting();

    // --- Headers, order and collapse state ---
    var layout = window._kdLayout && window._kdLayout.attach ? window._kdLayout.attach(host, KD_SECTIONS) : null;
    var stateKey = function (key) { return layout ? layout.secKey(key) : 'kdSec_' + key; };
    var startsCollapsed = function (cfg) {
        var def = layout && layout.wide() && cfg.wideCollapsed !== undefined ? cfg.wideCollapsed : cfg.collapsed;
        return get(stateKey(cfg.key), def ? '1' : '0') === '1';
    };
    var CHEVRON = '<svg class="kd-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"></path></svg>';
    var initialOpen = [];
    KD_SECTIONS.forEach(function (cfg) {
        var sec = host.querySelector('.kd-section[data-sec="' + cfg.key + '"]');
        if (!sec) return;
        host.appendChild(sec);
        var body = sec.querySelector('.kd-section-body');
        var header = document.createElement('div');
        header.className = 'kd-section-header tappable';
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.innerHTML = '<svg class="kd-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            iconFor(cfg.key) + '<' + '/svg><span class="kd-section-title"><' + '/span>' + CHEVRON;
        header.querySelector('.kd-section-title').textContent = cfg.title;
        sec.insertBefore(header, body);

        var collapsed = startsCollapsed(cfg);
        if (collapsed) sec.classList.add('collapsed');
        header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        if (!collapsed && cfg.onOpen) initialOpen.push([cfg, sec]);
        sec._kdCfg = cfg;

        // after a height transition settle into a clean steady state (no half-set inline cap)
        body.addEventListener('transitionend', function (e) {
            if (e.target !== body || e.propertyName !== 'max-height') return;
            body.style.maxHeight = sec.classList.contains('collapsed') ? '' : 'none';
        });
        var toggle = function (e) {
            if (e) { e.stopPropagation(); e.preventDefault(); }
            buzz();
            var willCollapse = !sec.classList.contains('collapsed');
            if (willCollapse) {
                body.style.maxHeight = body.scrollHeight + 'px';
                void body.offsetHeight;
                sec.classList.add('collapsed');
                body.style.maxHeight = '0px';
                if (cfg.onClose) cfg.onClose(sec);
            } else {
                sec.classList.remove('collapsed');
                if (cfg.onOpen) cfg.onOpen(sec);
                body.style.transition = 'none';
                body.style.maxHeight = 'none';
                var h = body.scrollHeight;
                body.style.maxHeight = '0px';
                void body.offsetHeight;
                body.style.transition = '';
                void body.offsetHeight;
                body.style.maxHeight = h + 'px';
                if (cfg.key === 'elemente' && window._kanjiRefreshTreeViewport) window._kanjiRefreshTreeViewport();
            }
            header.setAttribute('aria-expanded', willCollapse ? 'false' : 'true');
            set(stateKey(cfg.key), willCollapse ? '1' : '0');
            if (typeof _kdSnd === 'function') _kdSnd('fx', 'tick');
        };
        header.addEventListener('click', toggle);
        header.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') toggle(e);
        });
    });
    // Sections that start open run their init once the rest of the back script (player, pitfalls) exists.
    // A timeout alone is not enough: the parser may run it between script elements, before that code.
    var tries = 0;
    var runInitial = function () {
        if (!(window._kanjiOrder && window._kanjiRenderPitfalls) && tries++ < 40) { setTimeout(runInitial, 25); return; }
        initialOpen.forEach(function (p) { if (isOpen(p[1])) p[0].onOpen(p[1]); });
    };
    if (initialOpen.length) setTimeout(runInitial, 0);
    // fork: one column and several columns keep separate open/closed states; switch without animation.
    var syncCollapsed = function () {
        host.querySelectorAll('.kd-section[data-sec]').forEach(function (sec) {
            var cfg = sec._kdCfg, header = sec.querySelector('.kd-section-header'), body = sec.querySelector('.kd-section-body');
            if (!cfg || !header || !body) return;
            var collapsed = startsCollapsed(cfg);
            if (collapsed === sec.classList.contains('collapsed')) return;
            sec.classList.toggle('collapsed', collapsed);
            body.style.maxHeight = collapsed ? '' : 'none';
            header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            if (collapsed && cfg.onClose) cfg.onClose(sec);
            if (!collapsed && cfg.onOpen) cfg.onOpen(sec);
        });
    };
    if (layout) layout.start(syncCollapsed);
    // fork: optional back content follows the host card, even when the other settings tab is open.
    window._kdApplyBackOptions = function () {
        if (!host.isConnected) return;
        var card = typeof _hostCard === 'string' ? _hostCard : 'c1';
        var gc = typeof getGlobalConfig === 'function' ? getGlobalConfig() : {};
        var enabled = function (key, def) { return get(card + '_kanjiOpt' + key, get('kanjiOpt' + key, def || 'on')) === 'on'; };
        [['merksaetze', 'Merksaetze', gc.merksaetze], ['kd', 'KanjiDraw', gc.kanjiDraw], ['ref', 'Heisig', gc.heisig]].forEach(function (source) {
            var group = host.querySelector('.kd-story-group-' + source[0]);
            if (group) group.hidden = !enabled(source[1], source[2]);
        });
        var stories = host.querySelector('[data-sec="eselsbruecken"]');
        if (stories) stories.hidden = !stories.querySelector('.kd-story-group:not([hidden])');
        var nanori = host.querySelector('.kd-nanori-row');
        if (nanori) nanori.hidden = !enabled('Nanori', gc.nanori);
        var readings = host.querySelector('[data-sec="lesungen"]');
        if (readings) readings.hidden = !readings.querySelector('.reading-row:not([hidden])');
        host.querySelectorAll('.kd-section:not(.collapsed) .kd-section-body').forEach(function (body) {
            body.style.maxHeight = 'none'; // keep responsive wrapping and late font loads unclipped
        });
    };
    window._kdApplyBackOptions();
    // fork: back-only badges appear after FrontSide's initial design pass.
    if (window._kdApplyDesign) window._kdApplyDesign();
})();
