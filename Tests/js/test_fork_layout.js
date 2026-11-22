// Pure helpers of the section layout (Templates/src/back/kd-fork-layout.js): parsing, folding, defaults.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = {window: {}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../Templates/src/back/kd-fork-layout.js'), 'utf8'), context);
const core = context.window._kdLayout.core;
const KEYS = ['elemente', 'eselsbruecken', 'strichfolge', 'notiz', 'schreibfehler', 'wortbeispiele', 'lesungen', 'links'];
const plain = v => JSON.parse(JSON.stringify(v));
const all = arr => Object.values(arr).flat().sort();
const store = saved => key => saved[key] || '';

test('slots are symmetric around the centre', () => {
    assert.deepEqual(plain(core.slotsFor(1)), ['C']);
    assert.deepEqual(plain(core.slotsFor(5)), ['L2', 'L1', 'C', 'R1', 'R2']);
    assert.deepEqual(plain(core.slotsFor(9)), ['L4', 'L3', 'L2', 'L1', 'C', 'R1', 'R2', 'R3', 'R4']);
});

test('folding adds outer columns below the outermost remaining one', () => {
    const arr = {L3: ['a'], L2: ['b'], L1: ['c'], C: ['d'], R1: ['e'], R2: [], R3: ['f']};
    assert.deepEqual(plain(core.fold(arr, 3)), {L1: ['c', 'b', 'a'], C: ['d'], R1: ['e', 'f']});
    assert.deepEqual(plain(core.fold(arr, 1)), {C: ['d', 'c', 'e', 'b', 'a', 'f']}); // centre outwards
});

test('every arrangement holds every section exactly once', () => {
    for (const n of [1, 3, 5, 7, 9]) {
        assert.deepEqual(all(plain(core.arrangement(n, store({}), KEYS))), [...KEYS].sort(), `n=${n}`);
    }
});

test('the one-column default is the KD_SECTIONS order', () => {
    assert.deepEqual(plain(core.arrangement(1, store({}), KEYS)), {C: KEYS});
});

test('broken or partial saved strings are repaired', () => {
    const one = core.arrangement(1, store({kdLayout1: 'links, unknown,links,elemente,,notiz'}), KEYS);
    assert.deepEqual(plain(one.C).slice(0, 3), ['links', 'elemente', 'eselsbruecken']);
    assert.deepEqual(all(plain(one)), [...KEYS].sort());
    const five = core.arrangement(5, store({kdLayout5: 'X9:links|C:elemente,elemente|R2:notiz|garbage'}), KEYS);
    assert.deepEqual(all(plain(five)), [...KEYS].sort());
    assert.deepEqual(plain(five.R2), ['notiz']);
});

test('an unarranged count folds the nearest larger saved one, a saved one wins', () => {
    const saved = {kdLayout7: 'L3:links|C:elemente|R1:lesungen|R3:notiz'};
    const three = core.arrangement(3, store(saved), KEYS);
    assert.ok(three.L1.includes('links'));
    assert.deepEqual(plain(three.R1).filter(k => k === 'lesungen' || k === 'notiz'), ['lesungen', 'notiz']);
    saved.kdLayout3 = 'C:links';
    assert.deepEqual(plain(core.arrangement(3, store(saved), KEYS).C), ['links', 'elemente', 'eselsbruecken']);
    assert.equal(core.serialize({C: ['a', 'b']}, 1), 'a,b');
    assert.equal(core.serialize({L1: ['a'], C: [], R1: ['b']}, 3), 'L1:a|R1:b');
});

test('column count: setting, window width and phones', () => {
    assert.equal(core.count('auto', 400, 2000, false), 3);   // 5 columns need 2096 px
    assert.equal(core.count('auto', 400, 2200, false), 5);
    assert.equal(core.count('auto', 300, 1000, true), 1);    // phone in landscape
    assert.equal(core.count('3', 400, 3000, false), 3);
    assert.equal(core.count('9', 400, 1000, false), 1);
    assert.equal(core.count('1', 400, 3000, false), 1);
});

test('empty outer pairs are dropped, inner gaps stay', () => {
    const arr = {L2: [], L1: ['a'], C: ['b'], R1: [], R2: ['c']};
    assert.equal(core.shownCount(arr, 5, []), 5);
    assert.equal(core.shownCount(arr, 5, ['c']), 3);
    assert.equal(core.shownCount({L1: ['a'], C: ['b'], R1: []}, 3, ['a']), 1);
});
