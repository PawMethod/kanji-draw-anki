// --- Cross-Platform Fixes ---

// Clean up sparkle particles in case of rapid card transition
if (window._kanjiSparkleCleanup) { window._kanjiSparkleCleanup(); window._kanjiSparkleCleanup = null; }

// checkScrollability + resize already managed by FrontSide script
checkScrollability();

// Scroll guards & AnkiMobile tappable isolation for info modal
if (window._kanjiSetupModalTouchGuards) window._kanjiSetupModalTouchGuards();

// Apple Pencil: pen-to-click for modal controls
if (typeof PointerEvent !== 'undefined') {
    window._kanjiModalEatClick = null;
    window._kanjiModalEatTimer = null;
    document.querySelectorAll('.settings-modal, .info-modal').forEach(function (modal) {
        if (modal._kanjiPenClick) return;
        modal._kanjiPenClick = true;
        modal.addEventListener('pointerdown', function (e) {
            if (e.pointerType !== 'pen') return;
            modal._penDownX = e.clientX;
            modal._penDownY = e.clientY;
        });
        modal.addEventListener('pointerup', function (e) {
            if (e.pointerType !== 'pen') return;
            if (modal._penDownX !== undefined && Math.hypot(e.clientX - modal._penDownX, e.clientY - modal._penDownY) > 14) return;
            var el = (e.target && e.target.nodeType === 1) ? e.target : (e.target && e.target.parentElement);
            if (el && el.closest && el.closest('.tree-touch-shield, .tree-zoom-btn')) return;
            var target = el && el.closest ? el.closest('input, button, label, select, a, .settings-link, [onclick], .segment-btn, .category-card, .close-settings, .back-btn, .info-tool-btn, .order-ctrl, .pitfall-filter-btn, .pitfall-card, .tree-node, .pt-node, .word-example-item') : null;
            if (!target || target === modal) {
                if (!el || !el.closest || !el.closest('.tree-children')) {
                    modal.querySelectorAll('.pt-node.pt-active').forEach(function (n) { n.classList.remove('pt-active'); });
                    modal.querySelectorAll('.pt-node.pt-dismissed').forEach(function (n) { n.classList.remove('pt-dismissed'); });
                }
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            window._kanjiLastModalPenTap = Date.now();
            if (window._kanjiModalEatClick) {
                document.removeEventListener('click', window._kanjiModalEatClick, true);
                clearTimeout(window._kanjiModalEatTimer);
            }
            var inp = target.tagName === 'LABEL' ? target.querySelector('input[type="radio"], input[type="checkbox"]') : null;
            if (inp && typeof inp.click === 'function') {
                inp.click();
            } else if (typeof target.click === 'function') {
                target.click();
            } else {
                target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            }
            window._kanjiEatNextClick();
        });
    });
}

// Stylus fix: Apple Pencil / S-Pen don't reliably fire onclick
(function () {
    var lastInfoOpen = 0, lastGearOpen = 0;
    function addPenHandler(selector, handler) {
        document.querySelectorAll(selector).forEach(function (el) {
            if (el._ankiPenFixed) return;
            el._ankiPenFixed = true;
            el.addEventListener('pointerup', function (e) {
                if (e.pointerType !== 'pen') return;
                var now = Date.now();
                if (handler === 'info' || handler === 'order') { if (now - lastInfoOpen < 400) return; lastInfoOpen = now; }
                if (handler === 'gear' && now - lastGearOpen < 400) return;
                if (handler === 'gear') lastGearOpen = now;
                e.preventDefault(); e.stopPropagation();
                if (window._kanjiModalEatClick) {
                    document.removeEventListener('click', window._kanjiModalEatClick, true);
                    clearTimeout(window._kanjiModalEatTimer);
                    window._kanjiModalEatClick = null;
                }
                if (handler === 'info') openInfoModal(e);
                else if (handler === 'order') openStrokeOrder(e);
                else openSettings(e);
                window._kanjiEatNextClick();
            });
        });
    }
    addPenHandler('.info-btn', 'info');
    addPenHandler('.order-btn', 'order');
    addPenHandler('.gear-btn', 'gear');
})();

// --- S-Pen / Stylus: backdrop-close verification ---
document.querySelectorAll('.settings-overlay, .info-overlay').forEach(function (ol) {
    if (ol._kanjiPointerDown) return;
    ol._kanjiPointerDown = true;
    var _trackBg = function (e) { ol._bgPointerDown = (e.target === ol); };
    ol.addEventListener('pointerdown', _trackBg);
    ol.addEventListener('touchstart', _trackBg, { passive: true });
});

// --- Global S-Pen defense ---
if (!window._kanjiGlobalPenDefenseAdded) {
    window._kanjiGlobalPenDefenseAdded = true;
    if (typeof PointerEvent !== 'undefined') {
        ['pointerdown', 'pointerup', 'click'].forEach(function (evtName) {
            document.addEventListener(evtName, function (e) {
                if (e.pointerType !== undefined && e.pointerType !== 'pen') return;
                if (evtName === 'click' && !e._penOrigin) return;
                var active = document.querySelector('.settings-overlay.active, .info-overlay.active');
                if (!active) return;
                if (active.contains(e.target)) return;
                e.stopImmediatePropagation();
                e.preventDefault();
            }, true);
        });
        document.addEventListener('pointerup', function (e) {
            if (e.pointerType !== 'pen') return;
            var mark = function (ev) { ev._penOrigin = true; document.removeEventListener('click', mark, true); };
            document.addEventListener('click', mark, true);
            setTimeout(function () { document.removeEventListener('click', mark, true); }, 600);
        }, true);
    }
} // end guard

// External links: URL-encode Kanji, switch non-WaniKani Kanji to JPDB (avoids 404),
// and ensure synchronous native <a target="_blank"> navigation on AnkiMobile iOS.
(function () {
    // Exact 237 RTK1 Kanji not in WaniKani's curriculum (wanikani.com/kanji/<k> returns HTTP 404 for these)
    var _NO_WK = '丑丙串乃之乞亘亥伊但侯侶倣僅儒允冥冶凄函刹剥勃勅勺勾勿匁匂匕卯厘只吏吾咽唾喉喩嗅嗣嘲嚇圭堆塑塞填墾壱妖妬嫉嫡嬌宛宵寅巳幌廿弄弐弘彙彦怨恣惧愁慄慌憬戚抄拉拭拶挨挫捉捗捻摯斑斤斥旭旺昌昧智曖曰曽朋朕杏柏柵柿栗桁桂桐梓梗梢棺椿楠楷楼毀氾汎汐沃沫淫渚溺漕潰濫烏煎爵猪玩璧璽瓜瓦畏畝畿痕痘痩瘍眉硝稽窟窪窯笠笹箇箋篭綻緻繕繭罵羞羨翁耗肘股肢脹腎腫腺膝膳臆臼舷艶苑苛荻菱萎葛蒲蓋蔦蔽薪薫虞蚕蝶衷袖裳裾褐訃詔詣詮諦諧謁謄貌貪賜賦踪蹴辣辰辻逐逓遡遵酉醒采釜銑錘錮阿附韻頁頒頓頬顎餅餌骸鯉鳩麓麺';
    document.querySelectorAll('.link-grid[data-kanji]').forEach(function (grid) {
        var kj = (grid.getAttribute('data-kanji') || '').trim();
        if (!kj) return;
        var enc = encodeURIComponent(kj);
        var links = grid.querySelectorAll('a.link-btn');
        if (links[0]) links[0].setAttribute('href', 'https://jisho.org/search/' + enc + '%20%23kanji');
        if (links[1]) links[1].setAttribute('href', 'https://tatoeba.org/de/sentences/search?query=' + enc + '&from=jpn&to=de');
        if (links[2]) {
            if (_NO_WK.indexOf(kj) !== -1) {
                links[2].setAttribute('href', 'https://jpdb.io/kanji/' + enc);
                var lbl = links[2].querySelector('.link-btn-label');
                if (lbl) lbl.textContent = 'JPDB';
            } else {
                links[2].setAttribute('href', 'https://www.wanikani.com/kanji/' + enc);
            }
        }
        if (links[3]) links[3].setAttribute('href', 'https://kanji.koohii.com/study/kanji/' + enc);
    });

    document.querySelectorAll('.link-btn[href]').forEach(function (link) {
        if (link._ankiLinkFixed) return;
        link._ankiLinkFixed = true;
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        link.addEventListener('touchstart', function (e) {
            e.stopPropagation();
            this.classList.add('link-btn-pressed');
        }, { passive: true });
        link.addEventListener('touchend', function (e) {
            e.stopPropagation();
            var self = this;
            setTimeout(function () { self.classList.remove('link-btn-pressed'); }, 150);
        }, { passive: true });
        link.addEventListener('touchcancel', function () {
            this.classList.remove('link-btn-pressed');
        }, { passive: true });
        link.addEventListener('pointerdown', function (e) {
            e.stopPropagation();
            this.classList.add('link-btn-pressed');
        });
        link.addEventListener('pointerup', function (e) {
            e.stopPropagation();
            var self = this;
            setTimeout(function () { self.classList.remove('link-btn-pressed'); }, 150);
        });
        link.addEventListener('click', function (e) {
            // Stop propagation so AnkiMobile tap-zones don't flip the card,
            // but do NOT call preventDefault() so WKWebView natively opens href in Safari on every tap.
            e.stopPropagation();
            this.classList.remove('link-btn-pressed');
        });
    });

    // Re-synchronize iOS WKWebView ScrollingTree hit-test offset & lock viewport when returning from Safari
    if (!window._kanjiModalScrollResyncAdded) {
        window._kanjiModalScrollResyncAdded = true;
        var resyncModalScroll = function () {
            if (document.documentElement.classList.contains('is-ankimobile')) {
                document.body.classList.add('no-scroll');
                document.documentElement.style.setProperty('overflow-y', 'hidden', 'important');
                if (window._amStableVH > 100) {
                    document.documentElement.style.setProperty('--am-vh', window._amStableVH + 'px');
                }
                try { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; } catch (e) { }
            }
            document.querySelectorAll('.info-overlay.active .info-modal, .settings-overlay.active .settings-modal').forEach(function (m) {
                var st = m.scrollTop;
                if (st > 0) {
                    m.scrollTop = st - 1;
                    m.scrollTop = st;
                }
            });
        };
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) { resyncModalScroll(); setTimeout(resyncModalScroll, 50); setTimeout(resyncModalScroll, 200); }
        });
        window.addEventListener('pageshow', function () { resyncModalScroll(); setTimeout(resyncModalScroll, 50); });
        window.addEventListener('focus', function () { resyncModalScroll(); setTimeout(resyncModalScroll, 50); });
    }
})();
