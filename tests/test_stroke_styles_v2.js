/**
 * test_stroke_styles_v2.js — Stroke style architecture tests
 * Tests: Standard, Gelstift (Gel), Tusche (Ink), Neon
 *   - CSS only on reference kanji (#svg-bg, #svg-guide)
 *   - JS per-path via applyPathStyle for drawn strokes
 *   - Ink multi-segment brush with _inkGroup
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert').strict;

const base = path.resolve(__dirname, '..');
const c1f = fs.readFileSync(path.join(base, 'Templates/Card-1/FrontTemplate.html'), 'utf8');
const c2f = fs.readFileSync(path.join(base, 'Templates/Card-2/FrontTemplate.html'), 'utf8');
const c1b = fs.readFileSync(path.join(base, 'Templates/Card-1/BackTemplate.html'), 'utf8');
const c2b = fs.readFileSync(path.join(base, 'Templates/Card-2/BackTemplate.html'), 'utf8');
const css = fs.readFileSync(path.join(base, 'Templates/Styling.css'), 'utf8');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}: ${e.message}`); }
}

// ── 1. CSS architecture ──
console.log('── 1. CSS architecture ──');

test('Gel CSS: targets #svg-bg path and #svg-guide path', () => {
  const gelRules = css.match(/\.kanji-container\.stroke-style-gel\s+[^{]+/g) || [];
  assert(gelRules.some(r => r.includes('#svg-bg path')), 'Gel should target #svg-bg path');
  assert(gelRules.some(r => r.includes('#svg-guide path')), 'Gel should target #svg-guide path');
});

test('Gel CSS: bold rounded strokes (halo added by JS)', () => {
  const gelBlock = css.match(/\.stroke-style-gel\s+#svg-bg\s+path[^{]*\{([^}]+)\}/);
  assert(gelBlock, 'Must find gel CSS block');
  assert(gelBlock[1].includes('stroke-width'), 'Gel CSS should set stroke-width');
  assert(gelBlock[1].includes('stroke-linecap'), 'Gel CSS should set round linecap');
  assert(gelBlock[1].includes('paint-order'), 'Gel CSS should use paint-order for bolder edges');
  // Gel halo is added by JS — CSS no longer has drop-shadow
  assert(!gelBlock[1].includes('drop-shadow'), 'Gel CSS should NOT have drop-shadow (halo replaces it)');
});

test('Neon: uses SVG feGaussianBlur filter instead of CSS drop-shadow', () => {
  // CSS neon rules removed — SVG filter applied via JS
  assert(css.includes('feGaussianBlur') || c1f.includes('feGaussianBlur'), 'Neon must use SVG feGaussianBlur filter');
  assert(c1f.includes('neon-glow'), 'C1-Front must reference neon-glow SVG filter');
});

test('Ink CSS: square linecap on reference kanji paths', () => {
  const match = css.match(/\.stroke-style-ink\s+#svg-bg\s+path/);
  assert(match, 'Ink CSS should target #svg-bg path elements');
  const block = css.match(/\.stroke-style-ink\s+#svg-bg\s+path[^{]*\{([^}]+)\}/);
  assert(block && block[1].includes('square'), 'Ink CSS should use square linecap');
});

test('No CSS filter on #draw-layer for any style', () => {
  const drawLayerRefs = css.match(/stroke-style-(?:gel|ink|neon)[^{]*#draw-layer/g);
  assert(!drawLayerRefs, 'No stroke style should target #draw-layer');
});

// ── 2. JS applyPathStyle ──
console.log('\n── 2. JS applyPathStyle ──');

test('applyPathStyle function exists', () => {
  assert(c1f.includes('const applyPathStyle'), 'Must have applyPathStyle');
});

test('applyPathStyle signature: (pathEl, colorOverride)', () => {
  const match = c1f.match(/const applyPathStyle\s*=\s*\(pathEl,\s*colorOverride\)/);
  assert(match, 'Signature should be (pathEl, colorOverride)');
});

test('Gel case: sets stroke-width, paint-order, and drop-shadow', () => {
  const gelMatch = c1f.match(/case\s+'gel':[\s\S]*?break;/);
  assert(gelMatch, 'Must have gel case');
  assert(gelMatch[0].includes('stroke-width'), 'Gel should set stroke-width');
  assert(gelMatch[0].includes('paint-order'), 'Gel should set paint-order');
  assert(gelMatch[0].includes('drop-shadow'), 'Gel should apply drop-shadow filter');
});

test('Neon case: uses SVG filter attribute referencing #neon-defs', () => {
  const neonMatch = c1f.match(/case\s+'neon':[\s\S]*?break;/);
  assert(neonMatch, 'Must have neon case');
  assert(neonMatch[0].includes('setAttribute') && neonMatch[0].includes('filter'), 'Neon must set SVG filter attribute');
  assert(neonMatch[0].includes('_neonFilterRef'), 'Neon must use _neonFilterRef helper for filter URL');
});

test('Ink case: sets square linecap and opacity', () => {
  const inkMatch = c1f.match(/case\s+'ink':[\s\S]*?break;/);
  assert(inkMatch, 'Must have ink case');
  assert(inkMatch[0].includes('square') || inkMatch[0].includes('opacity'), 'Ink should set square linecap or opacity');
});

test('applyPathStyle resets all style-specific attributes before applying', () => {
  const fnMatch = c1f.match(/const applyPathStyle[\s\S]*?Full reset[\s\S]*?switch/);
  assert(fnMatch, 'applyPathStyle must have full reset before switch');
  assert(fnMatch[0].includes("removeProperty('filter')"), 'Must clear filter');
  assert(fnMatch[0].includes("removeProperty('opacity')"), 'Must clear opacity');
  assert(fnMatch[0].includes("removeAttribute('filter')"), 'Must clear filter attr');
  assert(fnMatch[0].includes("removeAttribute('paint-order')"), 'Must clear paint-order');
  // Verify drawing attributes reset to defaults before style switch
  assert(fnMatch[0].includes("setAttribute('stroke-width', '4')"), 'Must reset stroke-width to default 4');
  assert(fnMatch[0].includes("setAttribute('stroke-linecap', 'round')"), 'Must reset stroke-linecap to round');
  assert(fnMatch[0].includes("setAttribute('stroke-linejoin', 'round')"), 'Must reset stroke-linejoin to round');
});

test('applyPathStyle default case is clean (no leftover attributes)', () => {
  // After reset + no style match, path should have only default attributes
  const defaultMatch = c1f.match(/default:\s*\n\s*break;/);
  assert(defaultMatch, 'Default case should just break (defaults already set in reset)');
});

test('getActiveStrokeStyle reads from safeGetItem', () => {
  const match = c1f.match(/getActiveStrokeStyle\s*=\s*\(\)\s*=>\s*safeGetItem/);
  assert(match, 'Should read from safeGetItem');
});

// ── 2b. Gelstift double-path (halo) ──
console.log('\n── 2b. Gelstift double-path (halo) ──');

test('_gelHalo variable declared', () => {
  assert(c1f.includes('_gelHalo'), 'Must have _gelHalo variable');
});

test('startDrawing: creates _gelHalo for gel style', () => {
  assert(c1f.includes('isGel'), 'Should check for gel style');
  const match = c1f.match(/_gelHalo\s*=\s*document\.createElementNS/);
  assert(match, 'Should create gel halo path');
});

test('startDrawing: gel halo has wider stroke-width and low opacity', () => {
  const haloBlock = c1f.match(/_gelHalo\.setAttribute\("stroke-width"[^)]+\)/);
  assert(haloBlock, 'Halo should set stroke-width');
  const opBlock = c1f.match(/_gelHalo\.style\.setProperty\("opacity"[^)]+\)/);
  assert(opBlock, 'Halo should set low opacity');
});

test('draw handler: updates _gelHalo d-attribute', () => {
  assert(c1f.includes('_gelHalo.setAttribute("d"') || c1f.includes("_gelHalo.setAttribute('d'"),
    'Draw should update gel halo path');
});

test('clearDrawLayer resets _gelHalo', () => {
  assert(c1f.includes('_gelHalo = null'), 'clearDrawLayer should reset _gelHalo');
});

test('evaluateStroke: removes gel halo after snap', () => {
  const snapBlock = c1f.match(/afterSnap[\s\S]{0,500}gh.*parentNode.*removeChild/);
  assert(snapBlock, 'Gel halo should be removed in afterSnap');
});

test('evaluateStroke: recolors gel halo on error', () => {
  assert(c1f.includes('_gelHalo') && c1f.match(/_gelHalo\)?\s*.*setProperty.*stroke.*colorVar|_gelHalo.*stroke.*colorVar/),
    'Should recolor gel halo on correction feedback');
});

// ── 3. Ink multi-segment brush ──
console.log('\n── 3. Tusche (Ink) multi-segment brush ──');

test('_inkGroup variable declared', () => {
  assert(c1f.includes('_inkGroup'), 'Must have _inkGroup');
});

test('startDrawing: creates _inkGroup SVG <g> for ink', () => {
  assert(c1f.includes("_inkGroup = document.createElementNS"), 'Should create SVG g element');
});

test('startDrawing: hides master path for ink (opacity 0)', () => {
  // The ink branch sets currentSVGPath opacity to 0
  const match = c1f.match(/isInk[\s\S]{0,300}opacity.*0/);
  assert(match, 'Master path should be hidden when ink is active');
});

test('startDrawing: ink group gets square linecap matching SVG reference', () => {
  const match = c1f.match(/_inkGroup[\s\S]{0,200}stroke-linecap[\s\S]{0,20}square/);
  assert(match, 'Ink group should have square linecap to match SVG kanji');
});

test('draw handler: creates per-segment paths in _inkGroup directly', () => {
  assert(c1f.includes('_inkGroup.appendChild(seg)'), 'Should append segments directly to _inkGroup');
});

test('draw handler: speed-based width (viscous: 2-5.5px)', () => {
  const match = c1f.match(/Math\.max\(2.*Math\.min\(5\.5/);
  assert(match, 'Width should be clamped 2-5.5');
});

test('draw handler: EMA smoothing on width', () => {
  const match = c1f.match(/_inkLastWidth\s*\*\s*[\d.]+\s*\+\s*targetW\s*\*\s*[\d.]+/);
  assert(match, 'Width should use EMA smoothing');
});

test('draw handler: min distance threshold for segment creation', () => {
  assert(c1f.includes('dist > 1.5'), 'Should skip very short movements for smooth segments');
});

test('Correction feedback: recolors ink group', () => {
  assert(c1f.includes('_inkGroup.setAttribute("stroke", colorVar)'),
    'Correction should recolor all ink segments');
});

test('Snap animation: reveals master path, hides ink group', () => {
  assert(c1f.includes('ig.style.setProperty'), 'Should hide ink group before snap');
  assert(c1f.includes('ig.parentNode.removeChild(ig)'), 'Should remove ink group after snap');
});

test('Free mode: cleans up ink group on short stroke', () => {
  const match = c1f.match(/totalTravel < 4[\s\S]{0,400}_inkGroup[\s\S]{0,100}removeChild/);
  assert(match, 'Should remove ink group on too-short free strokes');
});

test('Free mode: shows master path with ink properties when saving', () => {
  const match = c1f.match(/_inkGroup[\s\S]{0,500}opacity.*0\.85/);
  assert(match, 'Should reveal master path with 0.85 opacity for ink look');
});

test('Ink bleed removed: no bleed timer', () => {
  assert(!c1f.includes('_inkBleedTimer'), 'Bleed timer should be completely removed');
});

test('Ink uses quadratic curves for smooth segments', () => {
  assert(c1f.includes("' Q '"), 'Segments should use Q (quadratic) curves');
});

test('Ink no joint dots (clean shape only)', () => {
  assert(!c1f.includes('frag.appendChild(jd)'), 'Joint dots should be removed for clean shape');
});

test('Ink no pool dot at touch-down (clean shape only)', () => {
  assert(!c1f.match(/Ink pool dot/), 'Pool dot should be removed for clean shape');
});

test('clearDrawLayer resets _inkGroup', () => {
  assert(c1f.includes('_inkGroup = null'), 'clearDrawLayer should null _inkGroup');
});

// ── 4. Integration ──
console.log('\n── 4. Integration ──');

test('startDrawing calls applyPathStyle', () => {
  const sd = c1f.match(/const startDrawing[\s\S]*?drawLayer\.appendChild/);
  assert(sd && sd[0].includes('applyPathStyle'), 'startDrawing must call applyPathStyle');
});

test('Correction applies applyPathStyle with colorVar', () => {
  assert(c1f.includes('applyPathStyle(currentSVGPath, colorVar)'), 'Must pass colorVar');
});

test('Correction sets inline stroke color', () => {
  const match = c1f.match(/currentSVGPath\.style\.setProperty\("stroke",\s*colorVar\)/);
  assert(match, 'Must set inline stroke color');
});

// ── 4b. Live style update for draw-layer ──
console.log('\n── 4b. Live style update for draw-layer ──');

test('applyPathStyle exposed on window', () => {
  assert(c1f.includes('window._kanjiApplyPathStyle = applyPathStyle'), 'Must expose applyPathStyle on window');
});

test('applyThemeSettings re-styles draw-layer paths', () => {
  assert(c1f.includes('draw-layer') && c1f.includes('_kanjiApplyPathStyle'), 'applyThemeSettings must re-apply style to draw-layer');
});

test('applyThemeSettings does NOT add gel halos on front (paths hidden until drawn)', () => {
  // Front templates should not create gel halos — halos are only for back templates
  const themeBlock = c1f.match(/applyThemeSettings[\s\S]*?\/\/ Re-apply stroke style/);
  assert(themeBlock, 'applyThemeSettings block must exist');
  assert(!themeBlock[0].includes('cloneNode'), 'Front applyThemeSettings must NOT clone halos');
});

// ── 5. feTurbulence removal ──
console.log('\n── 5. feTurbulence removal ──');

test('No SVG filter elements in templates', () => {
  assert(!c1f.includes('<feTurbulence'), 'C1: no feTurbulence');
  assert(!c2f.includes('<feTurbulence'), 'C2: no feTurbulence');
  assert(!css.includes('url(#ink-brush-filter)'), 'CSS: no ink-brush-filter ref');
});

// ── 6. Style-color consistency ──
console.log('\n── 6. Style-color consistency ──');

test('Neon JS uses _neonFilterRef helper for filter reference', () => {
  assert(c1f.includes('_neonFilterRef'),
    'Should use _neonFilterRef helper for dynamic filter URL');
});

test('CSS reference neon uses --stroke-active', () => {
  const match = css.match(/stroke-style-neon[\s\S]*?var\(--stroke-active\)/);
  assert(match, 'Reference glow should use --stroke-active');
});

// ── 7. Back-template stroke style reapplication ──
console.log('\n── 7. Back-template stroke style reapplication ──');

test('C1-Back applies stroke-style class on back side', () => {
  assert(c1b.includes('kanjiThemeStrokeStyle'), 'C1-Back must read stroke style setting');
  assert(c1b.includes('stroke-style-gel'), 'C1-Back must handle gel class');
  assert(c1b.includes('stroke-style-ink'), 'C1-Back must handle ink class');
  assert(c1b.includes('stroke-style-neon'), 'C1-Back must handle neon class');
});

test('C2-Back applies stroke-style class on back side', () => {
  assert(c2b.includes('kanjiThemeStrokeStyle'), 'C2-Back must read stroke style setting');
  assert(c2b.includes('stroke-style-gel'), 'C2-Back must handle gel class');
  assert(c2b.includes('stroke-style-ink'), 'C2-Back must handle ink class');
  assert(c2b.includes('stroke-style-neon'), 'C2-Back must handle neon class');
});

test('C1-Back has soft→gel migration', () => {
  assert(c1b.includes("ss === 'soft'") || c1b.includes("'soft'"), 'C1-Back must migrate soft→gel');
});

test('C2-Back has soft→gel migration', () => {
  assert(c2b.includes("ss === 'soft'") || c2b.includes("'soft'"), 'C2-Back must migrate soft→gel');
});

// ── 8. CSS coverage — all styles apply to both #svg-bg and #svg-guide ──
console.log('\n── 8. CSS coverage — styles on #svg-bg AND #svg-guide ──');

test('Gel CSS targets both #svg-bg and #svg-guide', () => {
  assert(css.includes('.stroke-style-gel #svg-bg path'), 'Gel must target #svg-bg path');
  assert(css.includes('.stroke-style-gel #svg-guide path'), 'Gel must target #svg-guide path');
});

test('Ink CSS targets both #svg-bg and #svg-guide', () => {
  assert(css.includes('.stroke-style-ink #svg-bg path'), 'Ink must target #svg-bg path');
  assert(css.includes('.stroke-style-ink #svg-guide path'), 'Ink must target #svg-guide path');
});

test('Back templates reference neon-glow filter from FrontSide #neon-defs', () => {
  assert(c1b.includes('neon-glow'), 'C1-Back must reference neon-glow SVG filter');
  assert(c2b.includes('neon-glow'), 'C2-Back must reference neon-glow SVG filter');
  assert(c1b.includes("setAttribute('filter'") || c1b.includes('setAttribute("filter"'), 'C1-Back must set filter attribute');
});

test('Gel CSS has paint-order: stroke for bolder appearance', () => {
  const block = css.match(/\.stroke-style-gel[^{]*\{([^}]+)\}/);
  assert(block && block[1].includes('paint-order'), 'Gel should have paint-order for bold look');
});

// ── 9. WebKit compatibility ──
console.log('\n── 9. WebKit compatibility ──');

test('Neon uses SVG feGaussianBlur for WebKit compatibility', () => {
  assert(c1f.includes('feGaussianBlur'), 'C1-Front must include SVG feGaussianBlur filter definition');
});

test('Neon SVG filter has light and dark mode variants in static HTML', () => {
  assert(c1f.includes('neon-glow-dk'), 'Must have dark mode variant neon-glow-dk');
  assert(c1f.includes('id="neon-glow"'), 'Must have light mode neon-glow filter in static SVG');
  assert(c1f.includes('<svg id="neon-defs"'), 'Must have static #neon-defs SVG element');
});

test('Gel CSS excludes gel-halo from main path styles', () => {
  const gelBlock = css.match(/\.stroke-style-gel[^{]*\{([^}]+)\}/);
  assert(gelBlock, 'Gel CSS block must exist');
  assert(!gelBlock[0].includes('-webkit-filter'), 'Gel CSS must NOT have -webkit-filter (halo replaces it)');
});

// ── 10. Missing strokes badge ──
console.log('\n── 10. Missing strokes badge ──');

test('C1-Back has missing-strokes-badge for ghost strokes', () => {
  assert(c1b.includes('missing-strokes-badge'), 'Back template must create missing-strokes-badge');
  assert(c1b.includes('zu wenig'), 'Badge must show "zu wenig" text');
});

test('CSS has missing-strokes-badge styling', () => {
  assert(css.includes('.missing-strokes-badge'), 'CSS must style missing-strokes-badge');
});

test('C1-Back cleanup removes both excess and missing badges', () => {
  assert(c1b.includes('.excess-strokes-badge, .missing-strokes-badge'), 'Teardown must remove both badge types');
});

// ── 11. Neon WebKit stacking-context fix ──
console.log('\n── 11. Neon WebKit stacking-context fix ──');

test('Neon CSS overrides isolation to auto', () => {
  const neonBlock = css.match(/\.kanji-container\.stroke-style-neon\s*\{[^}]+\}/);
  assert(neonBlock, 'Neon override block must exist');
  assert(neonBlock[0].includes('isolation: auto'), 'Must set isolation: auto for WebKit filter rendering');
});

test('Neon CSS overrides backface-visibility to visible', () => {
  const neonBlock = css.match(/\.kanji-container\.stroke-style-neon\s*\{[^}]+\}/);
  assert(neonBlock[0].includes('backface-visibility: visible'), 'Must set backface-visibility: visible');
  assert(neonBlock[0].includes('-webkit-backface-visibility: visible'), 'Must set -webkit-backface-visibility: visible');
});

// ── 12. Back-side makeStrokePath applies stroke style ──
console.log('\n── 12. Back-side makeStrokePath applies stroke style ──');

test('C1-Back makeStrokePath handles gel style with halo via appendStrokePath', () => {
  assert(c1b.includes("case 'gel':"), 'makeStrokePath must have gel case');
  assert(c1b.includes('_gelHaloColor'), 'gel must mark path for halo insertion');
  assert(c1b.includes('appendStrokePath'), 'Must have appendStrokePath helper for gel halo insertion');
});

test('C1-Back makeStrokePath handles neon style', () => {
  assert(c1b.includes("case 'neon':"), 'makeStrokePath must have neon case');
  assert(c1b.includes('nightMode'), 'neon must check dark mode for radius');
});

test('C1-Back makeStrokePath handles ink style', () => {
  const mspBlock = c1b.match(/const makeStrokePath[\s\S]*?return p;\s*\};/);
  assert(mspBlock, 'makeStrokePath must exist');
  assert(mspBlock[0].includes("case 'ink':"), 'makeStrokePath must have ink case');
  assert(mspBlock[0].includes('opacity'), 'ink must set opacity');
  assert(mspBlock[0].includes('square'), 'ink must set square linecap');
});

test('C1-Back stores stroke style on window._kanjiStrokeStyle', () => {
  assert(c1b.includes('window._kanjiStrokeStyle = ss'), 'Must store stroke style globally');
});

// ── 13. Back-side colored paths get matching neon glow ──
console.log('\n── 13. Back-side colored paths get matching neon glow ──');

test('C1-Back applyBackFeatures applies inline neon filter per path', () => {
  // The inline filter application loop after colorStyle.textContent
  const neonFilterInline = c1b.match(/paths\.forEach\(\(path,\s*i\)\s*=>\s*\{[\s\S]*?case 'neon':/);
  assert(neonFilterInline, 'C1-Back must apply inline neon filter per colored path');
});

test('C2-Back applyBackFeatures applies inline neon filter per path', () => {
  const neonFilterInline = c2b.match(/paths\.forEach\(\(path,\s*i\)\s*=>\s*\{[\s\S]*?case 'neon':/);
  assert(neonFilterInline, 'C2-Back must apply inline neon filter per colored path');
});

test('C2-Back stores stroke style on window._kanjiStrokeStyle', () => {
  assert(c2b.includes('window._kanjiStrokeStyle = ss'), 'Must store stroke style globally');
});

test('C2-Back gel halos use getComputedStyle for path color', () => {
  assert(c2b.includes('getComputedStyle(path).stroke') || c2b.includes('getComputedStyle(p).stroke'),
    'Gel halos must use getComputedStyle for accurate color');
});

// ── 7. Style-switch reliability ──
console.log('\n── 7. Style-switch reliability ──');

test('_addGelHaloToPath exposed on window for cross-scope access', () => {
  assert(c1f.includes('window._kanjiAddGelHaloToPath = _addGelHaloToPath'),
    '_addGelHaloToPath must be exposed on window (IIFE scope vs applyThemeSettings scope)');
});

test('applyThemeSettings uses window._kanjiAddGelHaloToPath (not local ref)', () => {
  const themeSection = c1f.match(/function applyThemeSettings[\s\S]*?finally/);
  assert(themeSection, 'Must have applyThemeSettings');
  assert(!themeSection[0].includes('typeof _addGelHaloToPath'),
    'Must NOT use local _addGelHaloToPath (inaccessible from outer scope)');
  assert(themeSection[0].includes('window._kanjiAddGelHaloToPath'),
    'Must use window._kanjiAddGelHaloToPath for cross-scope access');
});

test('applyThemeSettings nuclear cleanup removes ink groups from draw-layer', () => {
  const themeSection = c1f.match(/function applyThemeSettings[\s\S]*?finally/);
  assert(themeSection, 'Must have applyThemeSettings');
  assert(themeSection[0].includes("querySelectorAll('g').forEach"),
    'Must remove <g> ink groups from draw-layer during style switch');
});

test('applyThemeSettings resets opacity on svg-bg/svg-guide paths', () => {
  const themeSection = c1f.match(/function applyThemeSettings[\s\S]*?finally/);
  assert(themeSection, 'Must have applyThemeSettings');
  const svgBgReset = themeSection[0].match(/svg-bg.*svg-guide[\s\S]*?removeProperty\('opacity'\)/);
  assert(svgBgReset, 'Must clear inline opacity on svg-bg/svg-guide paths');
});

test('_addGelHaloToPath uses getComputedStyle first (not fallback)', () => {
  const fn = c1f.match(/const _addGelHaloToPath[\s\S]*?insertBefore/);
  assert(fn, 'Must have _addGelHaloToPath');
  const csIdx = fn[0].indexOf('getComputedStyle');
  const styleIdx = fn[0].indexOf('refPath.style.stroke');
  assert(csIdx < styleIdx, 'getComputedStyle must be tried BEFORE inline style fallback');
});

test('applyPathStyle resets stroke-width to 4 before gel sets 4.5', () => {
  const fn = c1f.match(/const applyPathStyle[\s\S]*?window\._kanjiApplyPathStyle/);
  assert(fn, 'Must have applyPathStyle');
  const resetIdx = fn[0].indexOf("setAttribute('stroke-width', '4')");
  const gelIdx = fn[0].indexOf("setAttribute('stroke-width', '4.5')");
  assert(resetIdx > -1 && gelIdx > -1 && resetIdx < gelIdx,
    'stroke-width:4 reset must come before gel stroke-width:4.5');
});

// ── 8. Back-side style reliability ──
console.log('\n── 8. Back-side style reliability ──');

test('C1-Back IIFE does NOT create gel halos (deferred to applyBackFeatures)', () => {
  const iife = c1b.match(/Re-apply stroke style class on back side[\s\S]*?\}\s*\}\)\(\);/);
  assert(iife, 'Must have stroke style IIFE');
  assert(!iife[0].includes("cloneNode"), 'IIFE must NOT create halo clones (halos deferred to applyBackFeatures)');
});

test('C2-Back IIFE does NOT create gel halos (deferred to applyBackFeatures)', () => {
  const iife = c2b.match(/Re-apply stroke style class on back side[\s\S]*?\}\s*\}\)\(\);/);
  assert(iife, 'Must have stroke style IIFE');
  assert(!iife[0].includes("cloneNode"), 'IIFE must NOT create halo clones (halos deferred to applyBackFeatures)');
});

test('C1-Back applyBackFeatures adds drop-shadow for gel paths', () => {
  const fn = c1b.match(/const applyBackFeatures[\s\S]*?addNumbersGPAL/);
  assert(fn, 'Must have applyBackFeatures');
  assert(fn[0].includes("drop-shadow(0 0 0.3px"), 'Gel paths must get drop-shadow filter on back side');
});

test('C2-Back applyBackFeatures adds drop-shadow for gel paths', () => {
  const fn = c2b.match(/const applyBackFeatures[\s\S]*?addNumbersGPAL/);
  assert(fn, 'Must have applyBackFeatures');
  assert(fn[0].includes("drop-shadow(0 0 0.3px"), 'Gel paths must get drop-shadow filter on back side');
});

test('C1-Back hideRefPaths cleans gel halos', () => {
  const fn = c1b.match(/const hideRefPaths[\s\S]*?\};/);
  assert(fn, 'Must have hideRefPaths');
  assert(fn[0].includes(".gel-halo"), 'hideRefPaths must remove gel halos');
});

test('C1-Back makeStrokePath adds drop-shadow for gel', () => {
  const fn = c1b.match(/const makeStrokePath[\s\S]*?return p;\s*\};/);
  assert(fn, 'Must have makeStrokePath');
  assert(fn[0].includes("drop-shadow"), 'makeStrokePath gel must include drop-shadow');
});

test('C1-Back appendStrokePath creates gel halo on append', () => {
  const fn = c1b.match(/const appendStrokePath[\s\S]*?\};/);
  assert(fn, 'Must have appendStrokePath');
  assert(fn[0].includes('gel-halo'), 'appendStrokePath must create gel-halo element');
  assert(fn[0].includes('_gelHaloColor'), 'appendStrokePath must check _gelHaloColor flag');
});

test('C1-Back applyBackFeatures uses pathColors for halo color fallback', () => {
  const fn = c1b.match(/Second pass: add gel halos[\s\S]*?insertBefore/);
  assert(fn, 'Must have gel halo second pass');
  assert(fn[0].includes('pathColors[i]'), 'Halo color fallback must use pathColors[i]');
});

test('updateThemeSetting calls kanjiSettingsGlobalHandler immediately (C1)', () => {
  const fn = c1f.match(/function updateThemeSetting[\s\S]*?\n    \}/);
  assert(fn, 'Must have updateThemeSetting');
  assert(fn[0].includes('kanjiSettingsGlobalHandler'), 'Must call kanjiSettingsGlobalHandler on every setting change');
});

test('updateThemeSetting calls kanjiSettingsGlobalHandlerC2 immediately (C2)', () => {
  const fn = c2f.match(/function updateThemeSetting[\s\S]*?\n    \}/);
  assert(fn, 'Must have updateThemeSetting');
  assert(fn[0].includes('kanjiSettingsGlobalHandlerC2'), 'Must call kanjiSettingsGlobalHandlerC2 on every setting change');
});

test('C1-Back applyBackFeatures re-reads stroke style from storage', () => {
  const fn = c1b.match(/const applyBackFeatures[\s\S]*?addNumbersGPAL/);
  assert(fn, 'Must have applyBackFeatures');
  assert(fn[0].includes("safeGetItem('kanjiThemeStrokeStyle'"), 'Must re-read stroke style from storage, not stale window variable');
  assert(fn[0].includes("window._kanjiStrokeStyle = ss"), 'Must update window._kanjiStrokeStyle cache');
});

test('C2-Back applyBackFeatures re-reads stroke style from storage', () => {
  const fn = c2b.match(/const applyBackFeatures[\s\S]*?addNumbersGPAL/);
  assert(fn, 'Must have applyBackFeatures');
  assert(fn[0].includes("safeGetItem('kanjiThemeStrokeStyle'"), 'Must re-read stroke style from storage');
  assert(fn[0].includes("window._kanjiStrokeStyle = ss"), 'Must update window._kanjiStrokeStyle cache');
});

test('C1-Back IIFE does NOT create gel halos inline (avoids nth-child shift)', () => {
  const iife = c1b.match(/Re-apply stroke style class on back side[\s\S]*?\}\s*\}\)\(\);/);
  assert(iife, 'Must have stroke style IIFE');
  assert(!iife[0].includes("cloneNode"), 'IIFE must NOT create halo clones inline');
  assert(iife[0].includes("halos added later"), 'IIFE should document that halos are deferred');
});

// ── Summary ──
console.log('\n' + '═'.repeat(50));
console.log(`  Results: ${passed}/${passed + failed} passed, ${failed} failed`);
console.log('═'.repeat(50));
process.exit(failed > 0 ? 1 : 0);
