// --- Persistence Layer: settings in window._ks (add-on) → cookie _k → localStorage ---

var _cookieCache = null, _cookieCacheRaw = null;
function _parseCookies() {
    var raw = document.cookie;
    if (raw === _cookieCacheRaw) return _cookieCache;
    _cookieCacheRaw = raw;
    _cookieCache = { _kObj: null, pairs: raw.split('; ') };
    if (location.protocol !== 'file:') {
        for (var i = 0; i < _cookieCache.pairs.length; i++) {
            if (_cookieCache.pairs[i].indexOf('_k=') === 0) { try { _cookieCache._kObj = JSON.parse(decodeURIComponent(_cookieCache.pairs[i].substring(3))); } catch (x) { } break; }
        }
    }
    return _cookieCache;
}
// Copy of the settings object stored in the _k cookie
function _kCookieObj() { var o = _parseCookies()._kObj, r = {}; for (var k in o) r[k] = o[k]; return r; }
function safeGetItem(key, fallback) {
    if (window._ks && window._ks[key] !== undefined) return window._ks[key];
    try {
        var cc = _parseCookies();
        if (cc._kObj && cc._kObj[key] !== undefined) return cc._kObj[key];
        for (var i = cc.pairs.length - 1; i >= 0; i--) { if (cc.pairs[i].indexOf(key + '=') === 0) return decodeURIComponent(cc.pairs[i].substring(key.length + 1)); }
    } catch (e) { }
    try { var v = localStorage.getItem(key); if (v) return v; } catch (e) { }
    return fallback;
}
function safeSetItem(key, value) {
    if (!window._ks) window._ks = {}; window._ks[key] = value;
    _cookieCacheRaw = null;
    try { localStorage.setItem(key, value); } catch (e) { }
    if (location.protocol === 'file:') {
        try { document.cookie = key + '=' + encodeURIComponent(value) + ';path=/;max-age=31536000;SameSite=Lax'; } catch (e) { }
    } else {
        var obj = _kCookieObj();
        obj[key] = value;
        var encoded = '_k=' + encodeURIComponent(JSON.stringify(obj)) + ';path=/;max-age=31536000;SameSite=Lax';
        if (encoded.length < 3800) { document.cookie = encoded; }
    }
    // Desktop add-on bridge: flush settings to persistent JSON (debounced)
    if (typeof pycmd === 'function') { clearTimeout(window._kdpT); window._kdpT = setTimeout(function () { try { pycmd('kdp:' + JSON.stringify(window._ks)); } catch (e) { } }, 500); }
}
// Android CookieManager only persists cookies on lifecycle events - flush proactively
if (location.protocol !== 'file:') {
    var _fc = function () { if (!window._ks) return; var o = _kCookieObj(); for (var k in window._ks) o[k] = window._ks[k]; var enc = '_k=' + encodeURIComponent(JSON.stringify(o)) + ';path=/;max-age=31536000;SameSite=Lax'; if (enc.length < 3800) document.cookie = enc; };
    if (window._kanjiFlushVis) document.removeEventListener('visibilitychange', window._kanjiFlushVis);
    if (window._kanjiFlushPH) { window.removeEventListener('pagehide', window._kanjiFlushPH); window.removeEventListener('beforeunload', window._kanjiFlushPH); }
    window._kanjiFlushVis = function () { if (document.hidden) _fc(); };
    window._kanjiFlushPH = _fc;
    document.addEventListener('visibilitychange', window._kanjiFlushVis);
    window.addEventListener('pagehide', window._kanjiFlushPH);
    window.addEventListener('beforeunload', window._kanjiFlushPH);
}
