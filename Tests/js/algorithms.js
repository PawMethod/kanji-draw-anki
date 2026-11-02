// Scoring algorithms, loaded from the real template (window._kanjiAlgo in Card-1/FrontTemplate.html)
// so the tests always exercise the code that actually ships.
const fs = require('fs');
const path = require('path');

const tpl = fs.readFileSync(path.join(__dirname, '..', '..', 'Templates', 'Card-1', 'FrontTemplate.html'), 'utf8');
const block = tpl.match(/window\._kanjiAlgo = \{[\s\S]*?\n {4}\};\n/);
if (!block) throw new Error('window._kanjiAlgo not found in Card-1/FrontTemplate.html');

// Same realm as the tests, so arrays compare equal under assert.deepStrictEqual
const win = {};
new Function('window', block[0])(win);

module.exports = win._kanjiAlgo;
