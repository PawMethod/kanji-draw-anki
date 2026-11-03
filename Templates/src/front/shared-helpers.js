// --- Shared helpers (the back side gets them via FrontSide) ---
// Anki marks dark mode on <html> or <body>, as nightMode or (older versions) night_mode
window._kanjiIsDark = function () {
    var h = document.documentElement.classList, b = document.body ? document.body.classList : h;
    return h.contains('nightMode') || h.contains('night_mode') || b.contains('nightMode') || b.contains('night_mode');
};
window._kanjiSwFactor = function (v) {
    if (v === undefined) v = safeGetItem('kanjiThemeStrokeWidth', 'normal');
    return v === 'thin' ? 0.7 : v === 'thick' ? 1.4 : 1;
};
// Gel pen: colour of a reference path (computed style, else inline/attribute, else the theme colour)
window._kanjiGelColor = function (refPath, cache) {
    var c = cache && cache.get(refPath);
    if (c) return c;
    try { c = getComputedStyle(refPath).stroke; } catch (e) { c = ''; }
    if (!c || c === 'none' || c === 'transparent' || /^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(c)) {
        c = refPath.style.stroke || refPath.getAttribute('stroke') || (refPath.classList.contains('hint-active') ? 'var(--stroke-hint)' : 'var(--stroke-active)');
    }
    if (cache) cache.set(refPath, c);
    return c;
};
// Gel pen: wide translucent copy behind the stroke (returned, not inserted) plus a faint ink spread on the stroke
window._kanjiMakeGelHalo = function (refPath, color, swf, opacity) {
    var halo = refPath.cloneNode(false), w = String(8.5 * swf);
    halo.setAttribute('class', 'gel-halo');
    halo.setAttribute('stroke-width', w);
    halo.setAttribute('stroke-linecap', 'round');
    halo.setAttribute('stroke-linejoin', 'round');
    halo.style.cssText = '';
    halo.style.setProperty('stroke-width', w, 'important');
    halo.style.setProperty('opacity', opacity, 'important');
    halo.style.setProperty('stroke', color, 'important');
    halo.removeAttribute('filter');
    refPath.style.setProperty('filter', 'drop-shadow(0 0 0.3px ' + color + ')');
    refPath.style.setProperty('-webkit-filter', 'drop-shadow(0 0 0.3px ' + color + ')');
    return halo;
};
// A pen tap is followed by a delayed synthetic click: swallow that one click
window._kanjiEatNextClick = function () {
    var h = function (ev) {
        ev.stopPropagation(); ev.stopImmediatePropagation(); ev.preventDefault();
        document.removeEventListener('click', h, true);
        if (window._kanjiModalEatClick === h) window._kanjiModalEatClick = null;
    };
    window._kanjiModalEatClick = h;
    document.addEventListener('click', h, true);
    clearTimeout(window._kanjiModalEatTimer);
    window._kanjiModalEatTimer = setTimeout(function () {
        document.removeEventListener('click', h, true);
        if (window._kanjiModalEatClick === h) window._kanjiModalEatClick = null;
    }, 300);
};
