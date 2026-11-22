// fork: "Abschnitte" settings page. The layout itself is back-only (src/back/kd-fork-layout.js); on the front
// window._kdLayout is missing or belongs to a back that is no longer shown.
function kdLayoutLive() {
    var L = window._kdLayout;
    return L && L.alive && L.alive() ? L : null;
}
function kdSectionsPageSync() {
    var live = !!kdLayoutLive(), btn = document.getElementById('kd-layout-edit'), note = document.getElementById('kd-layout-edit-note');
    if (btn) btn.disabled = !live;
    if (note) note.hidden = live;
    var reset = document.getElementById('kd-layout-reset');
    if (reset) { reset.textContent = 'Alle Layouts zurücksetzen'; reset._kdArmed = false; }
}
function kdLayoutEdit(e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    var L = kdLayoutLive();
    if (!L) return;
    // closeSettings ignores calls right after a page change (S-Pen ghost clicks)
    var wait = Math.max(0, 520 - (Date.now() - (typeof _lastNavTime === 'number' ? _lastNavTime : 0)));
    setTimeout(function () {
        closeSettings();
        L.edit(true);
    }, wait);
}
// Two taps: the first arms the button, the second resets.
function kdLayoutResetAll(e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    var btn = document.getElementById('kd-layout-reset');
    if (btn && !btn._kdArmed) {
        btn._kdArmed = true;
        btn.textContent = 'Wirklich alle zurücksetzen?';
        clearTimeout(btn._kdTimer);
        btn._kdTimer = setTimeout(kdSectionsPageSync, 4000);
        return;
    }
    if (window._kdLayout && window._kdLayout.resetAll) window._kdLayout.resetAll();
    else ['kdLayout1', 'kdLayout3', 'kdLayout5', 'kdLayout7', 'kdLayout9', 'kdSecHidden'].forEach(function (k) { safeSetItem(k, ''); });
    kdSectionsPageSync();
    if (btn) btn.textContent = 'Zurückgesetzt';
}
