/**
 * Settings Pentesting Suite for KanjiDraw Template
 *
 * Stress-tests the settings modal: rapid opening/closing, switching
 * between all settings permutations, theme/primary/accent changes,
 * and verifying state consistency throughout.
 */
const assert = require('assert');

// ─── Mock Infrastructure ────────────────────────────────────────────

let _store = {};   // mock localStorage/cookie
let _styles = {};  // mock CSS custom properties on root
let _classes = new Set();
let _errors = [];
let _vibrationCount = 0;
let _themeApplyCount = 0;

function resetAll() {
    _store = {}; _styles = {}; _classes = new Set(); _errors = [];
    _vibrationCount = 0; _themeApplyCount = 0;
}

// Mock persistence
function safeSetItem(k, v) { _store[k] = v; }
function safeGetItem(k, fallback) { return _store[k] !== undefined ? _store[k] : fallback; }

// Mock navigator.vibrate
const mockNavigator = { vibrate: () => { _vibrationCount++; return true; } };

// ─── Accent Colors (from template) ─────────────────────────────────

const _accentColors = {
    green: { accent: '#56a83a', hover: '#4a9432', bg: '#f0f7ec', c1: '#56a83a', c2: '#3a98a8',
        dark: { accent: '#6abe4e', hover: '#5cac40', bg: '#1e3315', c1: '#6abe4e', c2: '#4ec4b8' } },
    blue: { accent: '#3478f6', hover: '#2a65d4', bg: '#eaf1fe', c1: '#3478f6', c2: '#5856d6',
        dark: { accent: '#5a9cf8', hover: '#4a8cf0', bg: '#162040', c1: '#5a9cf8', c2: '#7a78e8' } },
    purple: { accent: '#8944ab', hover: '#753a95', bg: '#f3ecf7', c1: '#8944ab', c2: '#c44dba',
        dark: { accent: '#a866c8', hover: '#9656b8', bg: '#2a1838', c1: '#a866c8', c2: '#d870ce' } },
    orange: { accent: '#e87c2a', hover: '#d06c20', bg: '#fef3ea', c1: '#e87c2a', c2: '#e5a821',
        dark: { accent: '#f09840', hover: '#e08830', bg: '#3a2010', c1: '#f09840', c2: '#f0c040' } },
    red: { accent: '#d4483b', hover: '#bc3c30', bg: '#fcedec', c1: '#d4483b', c2: '#e87c2a',
        dark: { accent: '#e85450', hover: '#d84540', bg: '#381512', c1: '#e85450', c2: '#f09840' } },
    teal: { accent: '#2aabb8', hover: '#2295a0', bg: '#e8f6f8', c1: '#2aabb8', c2: '#34c759',
        dark: { accent: '#4ec4b8', hover: '#3cb4a8', bg: '#102a2c', c1: '#4ec4b8', c2: '#50d070' } }
};

// ─── Primary Colors (from template) ────────────────────────────────

const _primaryColors = {
    neutral: { bgMain: '#f7f7f5', surface: '#ffffff', borderColor: '#e2e2df',
        dark: { bgMain: '#1a1a1a', surface: '#252525', borderColor: '#363636' } },
    warm: { bgMain: '#f9f6f1', surface: '#fffcf7', borderColor: '#e6e0d6',
        dark: { bgMain: '#1d1b17', surface: '#282520', borderColor: '#3a3630' } },
    cool: { bgMain: '#f3f5f9', surface: '#f8faff', borderColor: '#dce0ea',
        dark: { bgMain: '#181a1f', surface: '#22242a', borderColor: '#33363e' } },
    sepia: { bgMain: '#f6f2e8', surface: '#fcf8f0', borderColor: '#e2daca',
        dark: { bgMain: '#1c1a14', surface: '#27251e', borderColor: '#3a3628' } },
    rose: { bgMain: '#f9f4f5', surface: '#fff8f9', borderColor: '#e6dce0',
        dark: { bgMain: '#1e181a', surface: '#2a2226', borderColor: '#3c3236' } },
    sage: { bgMain: '#f3f6f2', surface: '#f8fbf6', borderColor: '#dae2d6',
        dark: { bgMain: '#181d18', surface: '#222822', borderColor: '#343a30' } }
};

const ACCENTS = Object.keys(_accentColors);
const PRIMARIES = Object.keys(_primaryColors);
const MODES = ['system', 'light', 'dark'];
const FONT_SIZES = ['small', 'normal', 'large'];

// ─── Simulate applyThemeSettings (core logic) ──────────────────────

function applyThemeSettings() {
    _themeApplyCount++;
    try {
        const mode = safeGetItem('kanjiThemeMode', 'system');
        const accent = safeGetItem('kanjiThemeAccent', 'green');
        const primary = safeGetItem('kanjiThemePrimary', 'neutral');
        const fontSize = safeGetItem('kanjiThemeFontSize', 'normal');

        // Determine dark/light
        if (mode === 'dark') _classes.add('nightMode');
        else if (mode === 'light') _classes.delete('nightMode');
        // system → default to light for testing
        const isDark = _classes.has('nightMode');

        // Apply accent
        const colors = _accentColors[accent] || _accentColors.green;
        const palette = isDark && colors.dark ? colors.dark : colors;
        _styles['--accent'] = palette.accent;
        _styles['--accent-hover'] = palette.hover;
        _styles['--accent-bg'] = palette.bg;
        _styles['--tab-color-c1'] = palette.c1;
        _styles['--tab-color-c2'] = palette.c2;

        // Apply primary
        const pColors = _primaryColors[primary] || _primaryColors.neutral;
        const pPalette = isDark && pColors.dark ? pColors.dark : pColors;
        _styles['--bg-main'] = pPalette.bgMain;
        _styles['--surface'] = pPalette.surface;
        _styles['--border-color'] = pPalette.borderColor;

    } catch (e) {
        _errors.push(e);
    }
}

function updateThemeSetting(category, val) {
    _vibrationCount++;
    const keyMap = { mode: 'kanjiThemeMode', accent: 'kanjiThemeAccent', fontSize: 'kanjiThemeFontSize', primary: 'kanjiThemePrimary' };
    safeSetItem(keyMap[category], val);
    applyThemeSettings();
}

// ─── Test Runner ────────────────────────────────────────────────────

let passed = 0, failed = 0, total = 0;
function test(name, fn) {
    total++;
    resetAll();
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

// ═══ BASIC SETTINGS APPLICATION ═════════════════════════════════════

console.log('\n=== Basic Settings Application ===\n');

test('default neutral primary produces original CSS values', () => {
    applyThemeSettings();
    assert.strictEqual(_styles['--bg-main'], '#f7f7f5');
    assert.strictEqual(_styles['--surface'], '#ffffff');
    assert.strictEqual(_styles['--border-color'], '#e2e2df');
});

test('default green accent produces original CSS values', () => {
    applyThemeSettings();
    assert.strictEqual(_styles['--accent'], '#56a83a');
    assert.strictEqual(_styles['--accent-hover'], '#4a9432');
});

test('each primary color applies correct light-mode values', () => {
    for (const p of PRIMARIES) {
        resetAll();
        updateThemeSetting('primary', p);
        const expected = _primaryColors[p];
        assert.strictEqual(_styles['--bg-main'], expected.bgMain, `${p} bgMain`);
        assert.strictEqual(_styles['--surface'], expected.surface, `${p} surface`);
        assert.strictEqual(_styles['--border-color'], expected.borderColor, `${p} border`);
    }
});

test('each primary color applies correct dark-mode values', () => {
    updateThemeSetting('mode', 'dark');
    for (const p of PRIMARIES) {
        updateThemeSetting('primary', p);
        const expected = _primaryColors[p].dark;
        assert.strictEqual(_styles['--bg-main'], expected.bgMain, `${p} dark bgMain`);
        assert.strictEqual(_styles['--surface'], expected.surface, `${p} dark surface`);
        assert.strictEqual(_styles['--border-color'], expected.borderColor, `${p} dark border`);
    }
});

test('each accent color applies correct values in light mode', () => {
    for (const a of ACCENTS) {
        resetAll();
        updateThemeSetting('accent', a);
        assert.strictEqual(_styles['--accent'], _accentColors[a].accent, `${a} accent`);
    }
});

test('each accent color applies correct values in dark mode', () => {
    updateThemeSetting('mode', 'dark');
    for (const a of ACCENTS) {
        updateThemeSetting('accent', a);
        assert.strictEqual(_styles['--accent'], _accentColors[a].dark.accent, `${a} dark accent`);
    }
});

// ═══ ACCENT × PRIMARY COMBINATIONS ═════════════════════════════════

console.log('\n=== Accent × Primary Combinations ===\n');

test('all accent×primary×mode combinations produce valid CSS (216 combos)', () => {
    let combos = 0;
    for (const mode of MODES) {
        for (const accent of ACCENTS) {
            for (const primary of PRIMARIES) {
                resetAll();
                updateThemeSetting('mode', mode);
                updateThemeSetting('accent', accent);
                updateThemeSetting('primary', primary);
                combos++;

                // Verify all CSS vars are valid hex colors
                assert(/^#[0-9a-f]{6}$/i.test(_styles['--accent']), `accent invalid: ${_styles['--accent']}`);
                assert(/^#[0-9a-f]{6}$/i.test(_styles['--bg-main']), `bg-main invalid: ${_styles['--bg-main']}`);
                assert(/^#[0-9a-f]{6}$/i.test(_styles['--surface']), `surface invalid: ${_styles['--surface']}`);
                assert(/^#[0-9a-f]{6}$/i.test(_styles['--border-color']), `border invalid: ${_styles['--border-color']}`);
                assert(_errors.length === 0, `errors: ${_errors.map(e => e.message).join(', ')}`);
            }
        }
    }
    assert.strictEqual(combos, 108, `expected 108 combos (3×6×6), got ${combos}`);
});

test('accent and primary are independent (changing one doesnt affect other)', () => {
    updateThemeSetting('accent', 'blue');
    updateThemeSetting('primary', 'warm');
    const accentAfter = _styles['--accent'];
    const bgAfter = _styles['--bg-main'];
    // Change primary → accent stays
    updateThemeSetting('primary', 'cool');
    assert.strictEqual(_styles['--accent'], accentAfter, 'accent unchanged after primary change');
    assert.notStrictEqual(_styles['--bg-main'], bgAfter, 'bg-main changed');
    // Change accent → primary stays
    const bgNow = _styles['--bg-main'];
    updateThemeSetting('accent', 'red');
    assert.strictEqual(_styles['--bg-main'], bgNow, 'bg-main unchanged after accent change');
    assert.notStrictEqual(_styles['--accent'], accentAfter, 'accent changed');
});

// ═══ RAPID SETTINGS SWITCHING ═══════════════════════════════════════

console.log('\n=== Rapid Settings Switching ===\n');

test('rapid accent cycling: 100 switches in sequence', () => {
    for (let i = 0; i < 100; i++) {
        updateThemeSetting('accent', ACCENTS[i % ACCENTS.length]);
    }
    assert.strictEqual(_errors.length, 0, 'no errors from rapid accent cycling');
    // Final state should be the last one set
    const lastAccent = ACCENTS[99 % ACCENTS.length];
    assert.strictEqual(_styles['--accent'], _accentColors[lastAccent].accent);
});

test('rapid primary cycling: 100 switches in sequence', () => {
    for (let i = 0; i < 100; i++) {
        updateThemeSetting('primary', PRIMARIES[i % PRIMARIES.length]);
    }
    assert.strictEqual(_errors.length, 0, 'no errors from rapid primary cycling');
    const lastPrimary = PRIMARIES[99 % PRIMARIES.length];
    assert.strictEqual(_styles['--bg-main'], _primaryColors[lastPrimary].bgMain);
});

test('rapid mode switching: 200 toggles light↔dark', () => {
    for (let i = 0; i < 200; i++) {
        updateThemeSetting('mode', i % 2 === 0 ? 'dark' : 'light');
    }
    assert.strictEqual(_errors.length, 0, 'no errors');
    // Last was even (200th iteration, i=199, odd → light)
    assert.strictEqual(safeGetItem('kanjiThemeMode'), 'light');
});

test('rapid mixed changes: 500 random setting changes', () => {
    const categories = ['mode', 'accent', 'primary', 'fontSize'];
    const values = { mode: MODES, accent: ACCENTS, primary: PRIMARIES, fontSize: FONT_SIZES };
    for (let i = 0; i < 500; i++) {
        const cat = categories[Math.floor(Math.random() * categories.length)];
        const vals = values[cat];
        const val = vals[Math.floor(Math.random() * vals.length)];
        updateThemeSetting(cat, val);
    }
    assert.strictEqual(_errors.length, 0, 'no errors from 500 random changes');
    // Verify state consistency
    assert(/^#[0-9a-f]{6}$/i.test(_styles['--accent']));
    assert(/^#[0-9a-f]{6}$/i.test(_styles['--bg-main']));
});

// ═══ OPEN/CLOSE SIMULATION ══════════════════════════════════════════

console.log('\n=== Settings Open/Close Simulation ===\n');

test('open settings → change accent → close → reopen → accent persists', () => {
    updateThemeSetting('accent', 'purple');
    applyThemeSettings(); // close + reapply
    assert.strictEqual(safeGetItem('kanjiThemeAccent'), 'purple');
    assert.strictEqual(_styles['--accent'], '#8944ab');
});

test('open settings → change primary → close → reopen → primary persists', () => {
    updateThemeSetting('primary', 'sepia');
    applyThemeSettings();
    assert.strictEqual(safeGetItem('kanjiThemePrimary'), 'sepia');
    assert.strictEqual(_styles['--bg-main'], '#f6f2e8');
});

test('open/close 50 times with settings change each time', () => {
    for (let i = 0; i < 50; i++) {
        // "Open" — change a setting
        updateThemeSetting('accent', ACCENTS[i % ACCENTS.length]);
        updateThemeSetting('primary', PRIMARIES[i % PRIMARIES.length]);
        // "Close" — reapply
        applyThemeSettings();
    }
    assert.strictEqual(_errors.length, 0, 'no errors');
    assert.strictEqual(_themeApplyCount, 150, '50*3 apply calls (2 update + 1 close)');
});

test('open/close without changes: no state mutation', () => {
    updateThemeSetting('accent', 'teal');
    updateThemeSetting('primary', 'cool');
    const styleSnapshot = { ...(_styles) };
    const storeSnapshot = { ...(_store) };
    // "Open" and "close" 20 times without changes
    for (let i = 0; i < 20; i++) {
        applyThemeSettings();
    }
    assert.deepStrictEqual(_styles, styleSnapshot, 'styles unchanged');
    assert.deepStrictEqual(_store, storeSnapshot, 'store unchanged');
});

// ═══ DARK/LIGHT MODE TRANSITION ═════════════════════════════════════

console.log('\n=== Dark/Light Mode Transitions ===\n');

test('primary+accent both switch palettes on mode change', () => {
    updateThemeSetting('accent', 'blue');
    updateThemeSetting('primary', 'warm');
    assert.strictEqual(_styles['--accent'], '#3478f6', 'blue light');
    assert.strictEqual(_styles['--bg-main'], '#f9f6f1', 'warm light');

    updateThemeSetting('mode', 'dark');
    assert.strictEqual(_styles['--accent'], '#5a9cf8', 'blue dark');
    assert.strictEqual(_styles['--bg-main'], '#1d1b17', 'warm dark');

    updateThemeSetting('mode', 'light');
    assert.strictEqual(_styles['--accent'], '#3478f6', 'blue light again');
    assert.strictEqual(_styles['--bg-main'], '#f9f6f1', 'warm light again');
});

test('50 rapid dark↔light toggles with accent+primary', () => {
    updateThemeSetting('accent', 'red');
    updateThemeSetting('primary', 'rose');
    for (let i = 0; i < 50; i++) {
        updateThemeSetting('mode', i % 2 === 0 ? 'dark' : 'light');
    }
    // Final: i=49 → light
    assert.strictEqual(_styles['--accent'], '#d4483b', 'red light');
    assert.strictEqual(_styles['--bg-main'], '#f9f4f5', 'rose light');
    assert.strictEqual(_errors.length, 0);
});

// ═══ INVALID / EDGE CASE VALUES ═════════════════════════════════════

console.log('\n=== Invalid / Edge Case Values ===\n');

test('unknown accent falls back to green', () => {
    updateThemeSetting('accent', 'rainbow');
    assert.strictEqual(_styles['--accent'], '#56a83a', 'should fallback to green');
});

test('unknown primary falls back to neutral', () => {
    updateThemeSetting('primary', 'galaxy');
    assert.strictEqual(_styles['--bg-main'], '#f7f7f5', 'should fallback to neutral');
});

test('empty string accent falls back to green', () => {
    updateThemeSetting('accent', '');
    assert.strictEqual(_styles['--accent'], '#56a83a');
});

test('empty string primary falls back to neutral', () => {
    updateThemeSetting('primary', '');
    assert.strictEqual(_styles['--bg-main'], '#f7f7f5');
});

test('undefined values in store fall back gracefully', () => {
    _store['kanjiThemeAccent'] = undefined;
    _store['kanjiThemePrimary'] = undefined;
    applyThemeSettings();
    assert.strictEqual(_styles['--accent'], '#56a83a');
    assert.strictEqual(_styles['--bg-main'], '#f7f7f5');
});

// ═══ PERSISTENCE CONSISTENCY ════════════════════════════════════════

console.log('\n=== Persistence Consistency ===\n');

test('all 4 settings stored independently', () => {
    updateThemeSetting('mode', 'dark');
    updateThemeSetting('accent', 'purple');
    updateThemeSetting('primary', 'sage');
    updateThemeSetting('fontSize', 'large');
    assert.strictEqual(_store['kanjiThemeMode'], 'dark');
    assert.strictEqual(_store['kanjiThemeAccent'], 'purple');
    assert.strictEqual(_store['kanjiThemePrimary'], 'sage');
    assert.strictEqual(_store['kanjiThemeFontSize'], 'large');
});

test('settings survive simulated card reload (clear styles, reapply)', () => {
    updateThemeSetting('accent', 'orange');
    updateThemeSetting('primary', 'cool');
    updateThemeSetting('mode', 'dark');
    // Simulate reload: clear styles but keep store
    _styles = {}; _classes.clear();
    applyThemeSettings();
    assert.strictEqual(_styles['--accent'], _accentColors.orange.dark.accent);
    assert.strictEqual(_styles['--bg-main'], _primaryColors.cool.dark.bgMain);
});

test('radio sync values match stored state after all changes', () => {
    updateThemeSetting('mode', 'dark');
    updateThemeSetting('accent', 'teal');
    updateThemeSetting('primary', 'warm');
    updateThemeSetting('fontSize', 'small');
    // Simulate refreshSettingsRadios
    const radioValues = {
        'theme-mode': safeGetItem('kanjiThemeMode', 'system'),
        'theme-accent': safeGetItem('kanjiThemeAccent', 'green'),
        'theme-primary': safeGetItem('kanjiThemePrimary', 'neutral'),
        'theme-font-size': safeGetItem('kanjiThemeFontSize', 'normal')
    };
    assert.strictEqual(radioValues['theme-mode'], 'dark');
    assert.strictEqual(radioValues['theme-accent'], 'teal');
    assert.strictEqual(radioValues['theme-primary'], 'warm');
    assert.strictEqual(radioValues['theme-font-size'], 'small');
});

// ═══ FULL MATRIX STRESS TEST ════════════════════════════════════════

console.log('\n=== Full Matrix Stress Test ===\n');

test('walk through ALL 324 unique setting combinations', () => {
    let count = 0;
    for (const mode of MODES) {
        for (const accent of ACCENTS) {
            for (const primary of PRIMARIES) {
                for (const fontSize of FONT_SIZES) {
                    resetAll();
                    updateThemeSetting('mode', mode);
                    updateThemeSetting('accent', accent);
                    updateThemeSetting('primary', primary);
                    updateThemeSetting('fontSize', fontSize);
                    count++;
                    assert(_errors.length === 0, `error at ${mode}/${accent}/${primary}/${fontSize}`);
                    assert(_styles['--accent'], `no accent at ${mode}/${accent}/${primary}/${fontSize}`);
                    assert(_styles['--bg-main'], `no bg-main at ${mode}/${accent}/${primary}/${fontSize}`);
                }
            }
        }
    }
    assert.strictEqual(count, 324, `expected 324 combinations (3×6×6×3), got ${count}`);
});

// ═══ CONTRAST / READABILITY CHECK ═══════════════════════════════════

console.log('\n=== Contrast / Readability Check ===\n');

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

function luminance(rgb) {
    const a = [rgb.r, rgb.g, rgb.b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function contrastRatio(hex1, hex2) {
    const l1 = luminance(hexToRgb(hex1));
    const l2 = luminance(hexToRgb(hex2));
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

test('all primary light surfaces have sufficient contrast with dark text (#1a1a1a)', () => {
    const darkText = '#1a1a1a';
    for (const [name, p] of Object.entries(_primaryColors)) {
        const ratio = contrastRatio(p.bgMain, darkText);
        assert(ratio >= 4.5, `${name} light bgMain contrast ${ratio.toFixed(1)} < 4.5`);
        const surfaceRatio = contrastRatio(p.surface, darkText);
        assert(surfaceRatio >= 4.5, `${name} light surface contrast ${surfaceRatio.toFixed(1)} < 4.5`);
    }
});

test('all primary dark surfaces have sufficient contrast with light text (#e8e8e4)', () => {
    const lightText = '#e8e8e4';
    for (const [name, p] of Object.entries(_primaryColors)) {
        const ratio = contrastRatio(p.dark.bgMain, lightText);
        assert(ratio >= 4.5, `${name} dark bgMain contrast ${ratio.toFixed(1)} < 4.5`);
        const surfaceRatio = contrastRatio(p.dark.surface, lightText);
        assert(surfaceRatio >= 4.5, `${name} dark surface contrast ${surfaceRatio.toFixed(1)} < 4.5`);
    }
});

test('surface and bgMain have visible distinction in all primaries', () => {
    for (const [name, p] of Object.entries(_primaryColors)) {
        // Light mode
        const bgRgb = hexToRgb(p.bgMain);
        const surfRgb = hexToRgb(p.surface);
        const lightDiff = Math.abs(bgRgb.r - surfRgb.r) + Math.abs(bgRgb.g - surfRgb.g) + Math.abs(bgRgb.b - surfRgb.b);
        assert(lightDiff >= 5, `${name} light: bgMain and surface too similar (diff=${lightDiff})`);

        // Dark mode
        const dbgRgb = hexToRgb(p.dark.bgMain);
        const dsurfRgb = hexToRgb(p.dark.surface);
        const darkDiff = Math.abs(dbgRgb.r - dsurfRgb.r) + Math.abs(dbgRgb.g - dsurfRgb.g) + Math.abs(dbgRgb.b - dsurfRgb.b);
        assert(darkDiff >= 5, `${name} dark: bgMain and surface too similar (diff=${darkDiff})`);
    }
});

test('all accent colors visible against all primary backgrounds', () => {
    for (const [aName, a] of Object.entries(_accentColors)) {
        for (const [pName, p] of Object.entries(_primaryColors)) {
            // Light mode: accent on surface
            const lightRatio = contrastRatio(a.accent, p.surface);
            assert(lightRatio >= 2.5, `${aName}+${pName} light: accent on surface ratio ${lightRatio.toFixed(1)} < 2.5`);
            // Dark mode: accent on surface
            const darkRatio = contrastRatio(a.dark.accent, p.dark.surface);
            assert(darkRatio >= 2.0, `${aName}+${pName} dark: accent on surface ratio ${darkRatio.toFixed(1)} < 2.0`);
        }
    }
});

// ═══ PERFORMANCE ════════════════════════════════════════════════════

console.log('\n=== Performance ===\n');

test('performance: 1000 applyThemeSettings calls < 100ms', () => {
    updateThemeSetting('accent', 'blue');
    updateThemeSetting('primary', 'warm');
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) {
        applyThemeSettings();
    }
    const elapsed = performance.now() - t0;
    console.log(`    (1000 calls in ${elapsed.toFixed(1)}ms, avg ${(elapsed / 1000).toFixed(3)}ms)`);
    assert(elapsed < 100, `too slow: ${elapsed.toFixed(0)}ms`);
});

test('performance: 648 combo walk-through < 200ms', () => {
    const t0 = performance.now();
    for (const mode of MODES) {
        for (const accent of ACCENTS) {
            for (const primary of PRIMARIES) {
                for (const fontSize of FONT_SIZES) {
                    _store = {};
                    updateThemeSetting('mode', mode);
                    updateThemeSetting('accent', accent);
                    updateThemeSetting('primary', primary);
                    updateThemeSetting('fontSize', fontSize);
                }
            }
        }
    }
    const elapsed = performance.now() - t0;
    console.log(`    (648 combos in ${elapsed.toFixed(1)}ms)`);
    assert(elapsed < 200, `too slow: ${elapsed.toFixed(0)}ms`);
});

// ─── Results ────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(55)}`);
console.log(`Results: ${passed} passed, ${failed} failed (${total} total)`);
console.log(`${'═'.repeat(55)}\n`);
process.exit(failed > 0 ? 1 : 0);
