// --- Scroll Guards & AnkiMobile Tappable Isolation ---

window._kanjiSetupModalTouchGuards = function () {
    document.querySelectorAll('.settings-overlay, .info-overlay').forEach(function (ol) {
        ol.classList.add('tappable');
        ol.querySelectorAll('*').forEach(function (el) { el.classList.add('tappable'); });
    });

    document.querySelectorAll('.settings-modal, .info-modal').forEach(function (modal) {
        if (!modal._kanjiTouchStartGuarded) {
            modal._kanjiTouchStartGuarded = true;
            modal.addEventListener('touchstart', function (e) {
                if (e.touches && e.touches.length === 1) {
                    this._tsX = e.touches[0].clientX;
                    this._tsY = e.touches[0].clientY;
                }
            }, { passive: true });
        }
        if (modal._kanjiScrollGuardFn) modal.removeEventListener('touchmove', modal._kanjiScrollGuardFn);
        modal._kanjiScrollGuardFn = function (e) {
            if (e.target && e.target.closest && e.target.closest('.tree-viewport')) return;
            if (e.touches && e.touches.length === 1 && this._tsX !== undefined) {
                var dx = Math.abs(e.touches[0].clientX - this._tsX);
                var dy = Math.abs(e.touches[0].clientY - this._tsY);
                if (dx > dy * 1.3 && dx > 10) {
                    if (e.cancelable !== false) e.preventDefault();
                    return;
                }
            }
            if (document.documentElement.classList.contains('is-ankimobile') && this.scrollHeight <= this.clientHeight) {
                if (e.cancelable !== false) e.preventDefault();
            }
        };
        modal.addEventListener('touchmove', modal._kanjiScrollGuardFn, { passive: false });
    });

    document.querySelectorAll('.settings-overlay, .info-overlay').forEach(function (overlay) {
        if (overlay._kanjiScrollGuardFn) overlay.removeEventListener('touchmove', overlay._kanjiScrollGuardFn);
        overlay._kanjiScrollGuardFn = function (e) {
            if (e.target === this && e.cancelable !== false) e.preventDefault();
        };
        overlay.addEventListener('touchmove', overlay._kanjiScrollGuardFn, { passive: false });

        if (!overlay._kanjiAmTouchBound) {
            overlay._kanjiAmTouchBound = true;
            var amStartX = 0, amStartY = 0, amLastY = 0, amLastT = 0, amVelY = 0;
            var amMoved = false, amActive = false, amModal = null, amStartScroll = 0, amMomentumRaf = null;
            var stopMomentum = function () {
                if (amMomentumRaf) { cancelAnimationFrame(amMomentumRaf); amMomentumRaf = null; }
            };
            overlay.addEventListener('touchstart', function (e) {
                if (!document.documentElement.classList.contains('is-ankimobile')) return;
                stopMomentum();
                var el = (e.target && e.target.nodeType === 1) ? e.target : (e.target && e.target.parentElement);
                if (el && el.closest && el.closest('a[href]')) {
                    amActive = false;
                    return;
                }
                if (e.cancelable !== false) e.preventDefault();
                if (el && el.closest && el.closest('.tree-viewport, .tree-touch-shield, .tree-zoom-btn, .custom-scroll-thumb')) {
                    amActive = false;
                    return;
                }
                if (!e.touches || e.touches.length !== 1) { amActive = false; return; }
                amActive = true;
                amMoved = false;
                amStartX = e.touches[0].clientX;
                amStartY = e.touches[0].clientY;
                amLastY = amStartY;
                amLastT = performance.now();
                amVelY = 0;
                amModal = el && el.closest ? el.closest('.settings-modal, .info-modal') : null;
                amStartScroll = amModal ? amModal.scrollTop : 0;
            }, { passive: false });

            overlay.addEventListener('touchmove', function (e) {
                if (!document.documentElement.classList.contains('is-ankimobile') || !amActive) return;
                if (e.cancelable !== false) e.preventDefault();
                if (!e.touches || e.touches.length !== 1) return;
                var cx = e.touches[0].clientX;
                var cy = e.touches[0].clientY;
                var dx = cx - amStartX;
                var dy = cy - amStartY;
                if (Math.hypot(dx, dy) > 10) amMoved = true;
                if (amModal && amModal.scrollHeight > amModal.clientHeight) {
                    var now = performance.now();
                    var dt = now - amLastT;
                    if (dt > 0) amVelY = (amLastY - cy) / dt;
                    amLastY = cy;
                    amLastT = now;
                    amModal.scrollTop = amStartScroll - dy;
                }
            }, { passive: false });

            overlay.addEventListener('touchend', function (e) {
                if (!document.documentElement.classList.contains('is-ankimobile') || !amActive) return;
                if (e.cancelable !== false) e.preventDefault();
                amActive = false;
                if (amMoved) {
                    if (amModal && Math.abs(amVelY) > 0.15) {
                        var v = Math.max(-2.8, Math.min(2.8, amVelY)) * 16;
                        var mTarget = amModal;
                        var stepMomentum = function () {
                            if (!mTarget || Math.abs(v) < 0.5) { amMomentumRaf = null; return; }
                            var prev = mTarget.scrollTop;
                            mTarget.scrollTop = prev + v;
                            if (mTarget.scrollTop === prev) { amMomentumRaf = null; return; }
                            v *= 0.92;
                            amMomentumRaf = requestAnimationFrame(stepMomentum);
                        };
                        amMomentumRaf = requestAnimationFrame(stepMomentum);
                    }
                    return;
                }
                if (Date.now() - (window._kanjiLastModalPenTap || 0) < 350) return;
                var el = (e.target && e.target.nodeType === 1) ? e.target : (e.target && e.target.parentElement);
                if (e.target === overlay && overlay._bgPointerDown) {
                    if (overlay.id === 'info-overlay' && typeof closeInfoModal === 'function') closeInfoModal(e);
                    else if (typeof closeSettings === 'function') closeSettings(e);
                    return;
                }
                var ctrl = el && el.closest ? el.closest('input, button, label, select, a, .settings-link, [onclick], .segment-btn, .category-card, .close-settings, .back-btn, .info-tool-btn, .order-ctrl, .pitfall-filter-btn, .pitfall-card, .word-example-item') : null;
                if (!ctrl || ctrl === overlay || ctrl === amModal) return;
                var inp = ctrl.tagName === 'LABEL' ? ctrl.querySelector('input[type="radio"], input[type="checkbox"]') : null;
                if (inp && typeof inp.click === 'function') {
                    inp.click();
                } else if (typeof ctrl.click === 'function') {
                    ctrl.click();
                } else {
                    ctrl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                }
            }, { passive: false });

            overlay.addEventListener('touchcancel', function () {
                amActive = false;
                amMoved = false;
            }, { passive: true });
        }
    });
};
window._kanjiSetupModalTouchGuards();
