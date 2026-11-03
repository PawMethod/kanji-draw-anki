const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

// =======================================================================
// The real persistence layer, cut out of Card-1/FrontTemplate.html and run
// against a mock browser (cookie jar, localStorage, location, window._ks)
// =======================================================================

const ROOT = path.join(__dirname, '..', '..');
const tpl = fs.readFileSync(path.join(ROOT, 'Templates', 'Card-1', 'FrontTemplate.html'), 'utf8');
const PERSIST = tpl.match(/ {4}var _cookieCache = null[\s\S]*?\n {4}function safeSetItem[\s\S]*?\n {4}\}\n/);
if (!PERSIST) throw new Error('persistence layer not found in Card-1/FrontTemplate.html');

function createMockEnv() {
    const store = () => ({
        _data: {},
        getItem(k) { return this._data[k] !== undefined ? this._data[k] : null; },
        setItem(k, v) { this._data[k] = String(v); },
        removeItem(k) { delete this._data[k]; }
    });
    return { localStorage: store(), cookies: {}, _ks: undefined, location: { protocol: 'file:' } };
}

// env.cookies holds decoded values; document.cookie behaves like the browser's (encoded, "; "-joined)
function real(env) {
    const document = {
        get cookie() { return Object.keys(env.cookies).map(k => k + '=' + encodeURIComponent(env.cookies[k])).join('; '); },
        set cookie(s) { const kv = s.split(';')[0], eq = kv.indexOf('='); env.cookies[kv.slice(0, eq)] = decodeURIComponent(kv.slice(eq + 1)); }
    };
    return new Function('window', 'document', 'localStorage', 'location',
        PERSIST[0] + '\nreturn { _parseCookies: _parseCookies, safeGetItem: safeGetItem, safeSetItem: safeSetItem };')(env, document, env.localStorage, env.location);
}
const safeGetItem = (env, key, fallback) => real(env).safeGetItem(key, fallback);
const safeSetItem = (env, key, value) => real(env).safeSetItem(key, value);

// =======================================================================
// Tests
// =======================================================================

console.log('\n--- _parseCookies ---');

test('splits cookie pairs', () => {
    const env = createMockEnv();
    env.cookies = { foo: 'bar', baz: 'qux' };
    assert.deepStrictEqual(real(env)._parseCookies().pairs, ['foo=bar', 'baz=qux']);
});

test('decodes the _k settings bundle (https:)', () => {
    const env = createMockEnv();
    env.location.protocol = 'https:';
    env.cookies._k = JSON.stringify({ a: '1' });
    assert.strictEqual(real(env)._parseCookies()._kObj.a, '1');
});

test('ignores a malformed _k bundle', () => {
    const env = createMockEnv();
    env.location.protocol = 'https:';
    env.cookies._k = '{broken';
    assert.strictEqual(real(env)._parseCookies()._kObj, null);
});

test('does not parse _k on file:', () => {
    const env = createMockEnv();
    env.cookies._k = JSON.stringify({ a: '1' });
    assert.strictEqual(real(env)._parseCookies()._kObj, null);
});

console.log('\n--- safeGetItem (file: protocol) ---');

test('returns fallback when nothing is set', () => {
    const env = createMockEnv();
    assert.strictEqual(safeGetItem(env, 'missing', 'default'), 'default');
});

test('returns undefined when no fallback', () => {
    const env = createMockEnv();
    assert.strictEqual(safeGetItem(env, 'missing'), undefined);
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

test('decodes URL-encoded cookie values', () => {
    const env = createMockEnv();
    env.cookies.myKey = 'a b=c';
    assert.strictEqual(safeGetItem(env, 'myKey'), 'a b=c');
});

console.log('\n--- safeGetItem (https: protocol / AnkiWeb) ---');

test('reads from bundled _k cookie', () => {
    const env = createMockEnv();
    env.location.protocol = 'https:';
    env.cookies._k = JSON.stringify({ myKey: 'bundled' });
    assert.strictEqual(safeGetItem(env, 'myKey'), 'bundled');
});

test('_k bundle wins over a legacy individual cookie', () => {
    const env = createMockEnv();
    env.location.protocol = 'https:';
    env.cookies.myKey = 'individual';
    env.cookies._k = JSON.stringify({ myKey: 'bundled' });
    assert.strictEqual(safeGetItem(env, 'myKey'), 'bundled');
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
    assert.strictEqual(JSON.parse(env.cookies._k).foo, 'bar');
    assert.strictEqual(env.cookies.foo, undefined);
});

test('cookie size guard: rejects large bundles', () => {
    const env = createMockEnv();
    env.location.protocol = 'https:';
    const bigValue = 'x'.repeat(4000);
    safeSetItem(env, 'big', bigValue);
    assert.strictEqual(env._ks.big, bigValue);
    assert.strictEqual(env.localStorage.getItem('big'), bigValue);
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
    assert.strictEqual(safeGetItem(env, 'k', 'fb'), 'fb');
    env.localStorage.setItem('k', 'ls');
    assert.strictEqual(safeGetItem(env, 'k', 'fb'), 'ls');
    env.cookies.k = 'ck';
    assert.strictEqual(safeGetItem(env, 'k', 'fb'), 'ck');
    env._ks = { k: 'ks' };
    assert.strictEqual(safeGetItem(env, 'k', 'fb'), 'ks');
});

console.log('\n--- Settings Scoping (c1/c2 prefix) ---');

test('card-specific settings override global', () => {
    const env = createMockEnv();
    safeSetItem(env, 'kanjiOptStrictness', 'normal');
    safeSetItem(env, 'c1_kanjiOptStrictness', 'strict');
    assert.strictEqual(safeGetItem(env, 'c1_kanjiOptStrictness', safeGetItem(env, 'kanjiOptStrictness')), 'strict');
    assert.strictEqual(safeGetItem(env, 'c2_kanjiOptStrictness', safeGetItem(env, 'kanjiOptStrictness')), 'normal');
});

console.log('\n--- Defaults in Styling.css (read by getGlobalConfig) ---');

test('user defaults are declared with valid values', () => {
    const css = fs.readFileSync(path.join(ROOT, 'Templates', 'Styling.css'), 'utf8');
    const val = name => { const m = css.match(new RegExp(name + ':\\s*([^;]+);')); return m && m[1].trim().replace(/^["']|["']$/g, ''); };
    assert(['none', 'cross', 'full'].includes(val('--default-grid-type')), '--default-grid-type');
    assert(['on', 'off'].includes(val('--default-opt-color-front')), '--default-opt-color-front');
    assert(['system', 'light', 'dark'].includes(val('--default-theme-mode')), '--default-theme-mode');
});

// =======================================================================
// Summary
// =======================================================================

console.log('\n═══════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════\n');
process.exit(failed > 0 ? 1 : 0);
