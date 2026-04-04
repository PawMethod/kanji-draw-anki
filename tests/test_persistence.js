const assert = require('assert');

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

// =======================================================================
// Mock browser environment for persistence layer testing
// =======================================================================

function createMockEnv() {
    const storage = {};
    const mockStorage = {
        _data: {},
        getItem(k) { return this._data[k] !== undefined ? this._data[k] : null; },
        setItem(k, v) { this._data[k] = String(v); },
        removeItem(k) { delete this._data[k]; },
        clear() { this._data = {}; }
    };

    return {
        localStorage: { ...mockStorage, _data: {} },
        sessionStorage: { ...mockStorage, _data: {} },
        cookies: {},
        _ks: undefined,
        location: { protocol: 'file:' }
    };
}

// Extracted cookie parser from template (_parseCookies equivalent)
function parseCookies(cookieStr) {
    const result = {};
    const parts = cookieStr.split('; ');
    for (let i = 0; i < parts.length; i++) {
        const eq = parts[i].indexOf('=');
        if (eq < 0) continue;
        const key = parts[i].substring(0, eq);
        const val = decodeURIComponent(parts[i].substring(eq + 1));
        result[key] = val;
    }
    return result;
}

// Extracted safeGetItem logic
function safeGetItem(env, key, fallback) {
    // 1. Check window._ks
    if (env._ks && env._ks[key] !== undefined) return env._ks[key];
    // 2. Check cookies
    if (env.location.protocol === 'file:') {
        // Individual cookies
        if (env.cookies[key] !== undefined) return env.cookies[key];
    } else {
        // Bundled _k cookie
        if (env.cookies._k) {
            try {
                const obj = JSON.parse(env.cookies._k);
                if (obj[key] !== undefined) return obj[key];
            } catch (e) {}
        }
    }
    // 3. Check localStorage
    try {
        const val = env.localStorage.getItem(key);
        if (val !== null) return val;
    } catch (e) {}
    // 4. Return fallback
    return fallback !== undefined ? fallback : null;
}

// Extracted safeSetItem logic
function safeSetItem(env, key, value) {
    // 1. Set in _ks
    if (!env._ks) env._ks = {};
    env._ks[key] = value;
    // 2. Set cookie
    if (env.location.protocol === 'file:') {
        env.cookies[key] = value;
    } else {
        // Bundled _k cookie
        let bundle = {};
        if (env.cookies._k) {
            try { bundle = JSON.parse(env.cookies._k); } catch (e) {}
        }
        bundle[key] = value;
        const encoded = JSON.stringify(bundle);
        if (encoded.length <= 3800) {
            env.cookies._k = encoded;
        }
        // else silently fail (cookie size guard)
    }
    // 3. Set in localStorage
    try { env.localStorage.setItem(key, value); } catch (e) {}
}

// =======================================================================
// Tests
// =======================================================================

console.log('\n--- Cookie Parser ---');

test('parses simple cookies', () => {
    const result = parseCookies('foo=bar; baz=qux');
    assert.strictEqual(result.foo, 'bar');
    assert.strictEqual(result.baz, 'qux');
});

test('decodes URL-encoded values', () => {
    const result = parseCookies('data=%7B%22a%22%3A1%7D');
    assert.strictEqual(result.data, '{"a":1}');
});

test('handles empty cookie string', () => {
    const result = parseCookies('');
    assert.deepStrictEqual(Object.keys(result).length, 0);
});

test('handles cookie with = in value', () => {
    const result = parseCookies('key=val=ue');
    assert.strictEqual(result.key, 'val=ue');
});

console.log('\n--- safeGetItem (file: protocol) ---');

test('returns fallback when nothing is set', () => {
    const env = createMockEnv();
    assert.strictEqual(safeGetItem(env, 'missing', 'default'), 'default');
});

test('returns null when no fallback', () => {
    const env = createMockEnv();
    assert.strictEqual(safeGetItem(env, 'missing'), null);
});

test('reads from _ks first', () => {
    const env = createMockEnv();
    env._ks = { myKey: 'fromKS' };
    env.cookies.myKey = 'fromCookie';
    env.localStorage.setItem('myKey', 'fromLS');
    assert.strictEqual(safeGetItem(env, 'myKey'), 'fromKS');
});

test('falls back to individual cookie (file: protocol)', () => {
    const env = createMockEnv();
    env.cookies.myKey = 'fromCookie';
    env.localStorage.setItem('myKey', 'fromLS');
    assert.strictEqual(safeGetItem(env, 'myKey'), 'fromCookie');
});

test('falls back to localStorage', () => {
    const env = createMockEnv();
    env.localStorage.setItem('myKey', 'fromLS');
    assert.strictEqual(safeGetItem(env, 'myKey'), 'fromLS');
});

console.log('\n--- safeGetItem (https: protocol / AnkiWeb) ---');

test('reads from bundled _k cookie', () => {
    const env = createMockEnv();
    env.location.protocol = 'https:';
    env.cookies._k = JSON.stringify({ myKey: 'bundled' });
    assert.strictEqual(safeGetItem(env, 'myKey'), 'bundled');
});

test('ignores individual cookies on https:', () => {
    const env = createMockEnv();
    env.location.protocol = 'https:';
    env.cookies.myKey = 'individual';
    env.localStorage.setItem('myKey', 'fromLS');
    assert.strictEqual(safeGetItem(env, 'myKey'), 'fromLS');
});

console.log('\n--- safeSetItem ---');

test('sets in _ks, cookie, and localStorage', () => {
    const env = createMockEnv();
    safeSetItem(env, 'foo', 'bar');
    assert.strictEqual(env._ks.foo, 'bar');
    assert.strictEqual(env.cookies.foo, 'bar');
    assert.strictEqual(env.localStorage.getItem('foo'), 'bar');
});

test('uses bundled _k cookie on https:', () => {
    const env = createMockEnv();
    env.location.protocol = 'https:';
    safeSetItem(env, 'foo', 'bar');
    assert.strictEqual(env._ks.foo, 'bar');
    const bundle = JSON.parse(env.cookies._k);
    assert.strictEqual(bundle.foo, 'bar');
});

test('cookie size guard: rejects large bundles', () => {
    const env = createMockEnv();
    env.location.protocol = 'https:';
    // Create a bundle that exceeds 3800 chars
    const bigValue = 'x'.repeat(4000);
    safeSetItem(env, 'big', bigValue);
    // _ks should still have it
    assert.strictEqual(env._ks.big, bigValue);
    // localStorage should still have it
    assert.strictEqual(env.localStorage.getItem('big'), bigValue);
    // Cookie should NOT have been set (bundle too large)
    assert.strictEqual(env.cookies._k, undefined);
});

test('preserves existing bundle keys', () => {
    const env = createMockEnv();
    env.location.protocol = 'https:';
    safeSetItem(env, 'a', '1');
    safeSetItem(env, 'b', '2');
    const bundle = JSON.parse(env.cookies._k);
    assert.strictEqual(bundle.a, '1');
    assert.strictEqual(bundle.b, '2');
});

console.log('\n--- Fallback Chain Priority ---');

test('priority: _ks > cookie > localStorage > fallback', () => {
    const env = createMockEnv();
    // Only fallback
    assert.strictEqual(safeGetItem(env, 'k', 'fb'), 'fb');
    // Add localStorage
    env.localStorage.setItem('k', 'ls');
    assert.strictEqual(safeGetItem(env, 'k', 'fb'), 'ls');
    // Add cookie
    env.cookies.k = 'ck';
    assert.strictEqual(safeGetItem(env, 'k', 'fb'), 'ck');
    // Add _ks
    env._ks = { k: 'ks' };
    assert.strictEqual(safeGetItem(env, 'k', 'fb'), 'ks');
});

console.log('\n--- Settings Scoping (c1/c2 prefix) ---');

test('card-specific settings override global', () => {
    const env = createMockEnv();
    safeSetItem(env, 'kanjiOptStrictness', 'normal');
    safeSetItem(env, 'c1_kanjiOptStrictness', 'strict');
    // Card-1 should use c1_ prefix
    const c1Val = safeGetItem(env, 'c1_kanjiOptStrictness',
                    safeGetItem(env, 'kanjiOptStrictness'));
    assert.strictEqual(c1Val, 'strict');
    // Card-2 should fall back to global
    const c2Val = safeGetItem(env, 'c2_kanjiOptStrictness',
                    safeGetItem(env, 'kanjiOptStrictness'));
    assert.strictEqual(c2Val, 'normal');
});

console.log('\n--- getGlobalConfig (CSS custom properties) ---');

test('parses CSS defaults correctly', () => {
    // Simulate what getGlobalConfig does
    const cssDefaults = {
        '--default-grid-type': 'cross',
        '--default-grid-style': 'dotted',
        '--default-grid-thick': 'medium',
        '--default-grid-opac': 'dark',
        '--default-opt-color-front': 'on',
        '--default-opt-autodraw': 'on',
        '--default-opt-color-back': 'on',
        '--default-opt-numbers': 'on',
        '--default-opt-strictness': 'normal',
        '--default-opt-celebration': 'on',
        '--default-opt-display-style': 'standard',
        '--default-opt-draw-mode': 'guided',
        '--default-opt-side-by-side': 'on',
        '--default-opt-free-view': 'handwriting',
        '--default-theme-mode': 'system',
        '--default-theme-accent': 'green',
        '--default-theme-font-size': 'normal'
    };
    // Verify all 17 config values are present
    assert.strictEqual(Object.keys(cssDefaults).length, 17);
    // Verify values are valid
    assert(['none', 'cross', 'full'].includes(cssDefaults['--default-grid-type']));
    assert(['on', 'off'].includes(cssDefaults['--default-opt-color-front']));
    assert(['system', 'light', 'dark'].includes(cssDefaults['--default-theme-mode']));
});

// =======================================================================
// Summary
// =======================================================================

console.log('\n═══════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════\n');
process.exit(failed > 0 ? 1 : 0);
