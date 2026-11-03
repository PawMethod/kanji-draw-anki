// --- Sound & music: bridge to the audio engine (window.__kdAudio) ---
// Settings are global (not c1_/c2_-scoped), like the theme keys. Default: off.
function _kdSnd(method) {
    var a = window.__kdAudio;
    if (!a || typeof a[method] !== 'function') return;
    try { return a[method].apply(a, Array.prototype.slice.call(arguments, 1)); } catch (e) { }
}

function _kdSoundConf() {
    return {
        level: safeGetItem('kanjiSoundLevel', 'off'),
        music: safeGetItem('kanjiSoundMusic', 'off'),
        musicLevel: safeGetItem('kanjiSoundMusicLevel', 'mid'),
        stroke: safeGetItem('kanjiSoundStroke', 'on'),
        fx: safeGetItem('kanjiSoundFx', 'on'),
        immersion: safeGetItem('kanjiSoundImmersion', 'low')
    };
}

function applySoundSettings() {
    var c = _kdSoundConf();
    _kdSnd('configure', c);
    var sub = document.getElementById('sound-sub-settings');
    if (sub) sub.classList.toggle('setting-disabled', c.level === 'off');
    var msub = document.getElementById('sound-music-sub');
    if (msub) msub.classList.toggle('setting-disabled', c.music === 'off');
    [['sound-hint-music', 'sound-music', c.music], ['sound-hint-flow', 'sound-immersion', c.immersion]].forEach(function (h) {
        var el = document.getElementById(h[0]), r = document.querySelector('input[name="' + h[1] + '"][value="' + h[2] + '"]');
        if (el) el.textContent = r ? (r.getAttribute('data-hint') || '') : '';
    });
    var ve = document.getElementById('sound-engine-version');
    if (ve) ve.textContent = window.__kdAudio ? 'Klang-Engine ' + window.__kdAudio.version : 'Klang-Engine nicht geladen';
}

function updateSoundSetting(category, val) {
    var keyMap = { level: 'kanjiSoundLevel', music: 'kanjiSoundMusic', musicLevel: 'kanjiSoundMusicLevel', stroke: 'kanjiSoundStroke', fx: 'kanjiSoundFx', immersion: 'kanjiSoundImmersion' };
    if (!keyMap[category]) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    safeSetItem(keyMap[category], val);
    applySoundSettings();
}

// Effect sounds via delegation — bound once per WebView (Anki Desktop keeps
// the document across card changes, only #qa is replaced).
if (!window._kdSndUiBound) {
    window._kdSndUiBound = true;
    (function () {
        var rules = [
            ['#button-reveal', 'hint'], ['#button-undo', 'undo'], ['#button-skip', 'skip'], ['#button-reset', 'reset'],
            ['.gear-btn', 'open'], ['.info-btn', 'open'], ['.settings-about-btn', 'nav'], ['.back-to-main', 'back'], ['.close-settings', 'close'], ['.back-btn', 'back'],
            ['.category-card', 'nav'], ['.segment-btn', 'tab'], ['button, [role="button"]', 'tap']
        ];
        var down = null;
        var match = function (el) {
            if (!el || !el.closest) return null;
            if (el.id === 'settings-overlay' || (el.classList && el.classList.contains('info-overlay'))) return 'close';
            for (var i = 0; i < rules.length; i++) if (el.closest(rules[i][0])) return rules[i][1];
            return null;
        };
        document.addEventListener('pointerdown', function (e) {
            var fx = match(e.target);
            down = fx ? { fx: fx, x: e.clientX, y: e.clientY } : null;
        }, true);
        document.addEventListener('pointerup', function (e) {
            var d = down; down = null;
            if (d && Math.abs(e.clientX - d.x) < 12 && Math.abs(e.clientY - d.y) < 12) _kdSnd('fx', d.fx);
        }, true);
        // Bubble phase: runs after the inline onchange, i.e. with the new setting applied
        document.addEventListener('change', function (e) {
            var t = e.target;
            if (!t || t.type !== 'radio' || !t.closest || !t.closest('.settings-modal')) return;
            if (t.name === 'theme-stroke-style') _kdSnd('demoStroke', t.value);
            else _kdSnd('fx', 'select');
        });
    })();
}
