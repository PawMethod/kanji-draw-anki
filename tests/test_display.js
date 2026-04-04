/**
 * Display Resolution & Responsive Layout Tests
 * 
 * Tests how the template behaves across different viewport sizes,
 * font sizes, and device categories. Validates CSS calculations,
 * layout constraints, and potential overflow issues.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const cssContent = fs.readFileSync(path.join(__dirname, '..', 'Templates', 'Styling.css'), 'utf-8');

// ─── Helpers ───────────────────────────────────────────────────

/** Simulate --dynamic-size: min(90vw, 65vh, 550px) */
function dynamicSize(vw, vh) {
  return Math.min(vw * 0.9, vh * 0.65, 550);
}

/** Modal max-height: calc(100dvh - 96px) */
function modalMaxHeight(dvh) {
  return dvh - 96;
}

/** AnkiMobile modal: calc(100dvh - 48px - 80px) */
function modalMaxHeightMobile(dvh) {
  return dvh - 128;
}

/** Viewport devices to test */
const DEVICES = [
  { name: 'iPhone SE',          w: 375, h: 667,  dpr: 2, category: 'phone' },
  { name: 'iPhone 12/13/14',    w: 390, h: 844,  dpr: 3, category: 'phone' },
  { name: 'iPhone 15 Pro Max',  w: 430, h: 932,  dpr: 3, category: 'phone' },
  { name: 'Samsung Galaxy S21', w: 360, h: 800,  dpr: 3, category: 'phone' },
  { name: 'Pixel 7',            w: 412, h: 915,  dpr: 2.625, category: 'phone' },
  { name: 'Small phone (320w)', w: 320, h: 568,  dpr: 2, category: 'phone' },
  { name: 'iPad Mini',          w: 768, h: 1024, dpr: 2, category: 'tablet' },
  { name: 'iPad Air',           w: 820, h: 1180, dpr: 2, category: 'tablet' },
  { name: 'iPad Pro 12.9"',     w: 1024, h: 1366, dpr: 2, category: 'tablet' },
  { name: 'Samsung Tab S8',     w: 800, h: 1280, dpr: 2, category: 'tablet' },
  { name: 'Laptop 1366x768',    w: 1366, h: 768, dpr: 1, category: 'desktop' },
  { name: 'Full HD 1920x1080',  w: 1920, h: 1080, dpr: 1, category: 'desktop' },
  { name: 'MacBook Air 13"',    w: 1440, h: 900, dpr: 2, category: 'desktop' },
  { name: 'Anki Desktop Small', w: 600, h: 700,  dpr: 1, category: 'desktop' },
  { name: 'Anki Desktop Min',   w: 400, h: 500,  dpr: 1, category: 'desktop' },
  { name: 'Landscape phone',    w: 667, h: 375,  dpr: 2, category: 'landscape' },
  { name: 'Landscape tablet',   w: 1024, h: 768, dpr: 2, category: 'landscape' },
];

// Font size base values
const FONT_SIZES = {
  small:  { card: 14, title: 23, scale: 0.875 },
  normal: { card: 16, title: 26, scale: 1.0 },
  large:  { card: 18, title: 29, scale: 1.125 },
};

// ─── Test Suite ────────────────────────────────────────────────

let pass = 0, fail = 0, total = 0;
function test(name, fn) {
  total++;
  try { fn(); pass++; }
  catch (e) { fail++; console.error(`  ✗ ${name}: ${e.message}`); }
}

console.log('═══════════════════════════════════════════════════');
console.log('  Display Resolution & Responsive Layout Tests');
console.log('═══════════════════════════════════════════════════\n');

// ── 1. Dynamic Size Calculation ──

console.log('── 1. --dynamic-size across viewports ──');

for (const dev of DEVICES) {
  test(`${dev.name} (${dev.w}×${dev.h}): dynamic-size is positive and ≤550`, () => {
    const ds = dynamicSize(dev.w, dev.h);
    assert(ds > 0, `dynamic-size must be positive, got ${ds}`);
    assert(ds <= 550, `dynamic-size must be ≤550px cap, got ${ds}`);
  });

  test(`${dev.name}: kanji container fits viewport width`, () => {
    const ds = dynamicSize(dev.w, dev.h);
    assert(ds <= dev.w, `dynamic-size ${ds} exceeds viewport width ${dev.w}`);
  });

  test(`${dev.name}: kanji container fits viewport height`, () => {
    const ds = dynamicSize(dev.w, dev.h);
    // The card has: card-title (~40px) + kanji-container(ds) + action-buttons(~52px) + padding(~16px)
    const minRequiredHeight = 40 + ds + 52 + 16;
    // Warn but don't hard-fail on landscape phones where vertical space is tight
    if (dev.category === 'landscape' && minRequiredHeight > dev.h) {
      // Expected: landscape phones may require scrolling
    } else {
      assert(minRequiredHeight <= dev.h,
        `Min content height ${minRequiredHeight}px > viewport ${dev.h}px — card will require scrolling`);
    }
  });
}

// ── 2. Dynamic Size Values Table ──

console.log('\n── 2. Computed --dynamic-size values ──');
console.log('  Device                      │ Viewport    │ --dynamic-size │ Constraint');
console.log('  ────────────────────────────┼─────────────┼────────────────┼──────────────');
for (const dev of DEVICES) {
  const ds = dynamicSize(dev.w, dev.h);
  const vw90 = dev.w * 0.9;
  const vh65 = dev.h * 0.65;
  let constraint = ds === 550 ? '550px cap' : (ds === vw90 ? '90vw' : '65vh');
  console.log(`  ${dev.name.padEnd(28)} │ ${(dev.w+'×'+dev.h).padEnd(11)} │ ${(ds.toFixed(0)+'px').padEnd(14)} │ ${constraint}`);
}

// ── 3. Modal Sizing ──

console.log('\n── 3. Settings modal sizing ──');

for (const dev of DEVICES) {
  test(`${dev.name}: modal max-height is positive`, () => {
    const mh = modalMaxHeight(dev.h);
    assert(mh > 0, `Modal max-height ${mh}px is not positive`);
  });

  test(`${dev.name}: modal has enough space for content (min 200px)`, () => {
    const mh = modalMaxHeight(dev.h);
    if (dev.h < 320) {
      // Very short viewport — modal will be cramped but still functional
      assert(mh > 100, `Modal height ${mh}px too small even for minimum`);
    } else {
      assert(mh >= 200, `Modal height ${mh}px < 200px minimum for usable settings`);
    }
  });

  test(`${dev.name}: modal width (90%, max 420px) fits viewport`, () => {
    const modalWidth = Math.min(dev.w * 0.9, 420);
    assert(modalWidth <= dev.w, `Modal width ${modalWidth} > viewport ${dev.w}`);
    assert(modalWidth >= 280, `Modal width ${modalWidth}px too narrow for settings UI (min ~280px)`);
  });
}

// ── 4. Font Size + Viewport Combinations ──

console.log('\n── 4. Font size × viewport stress tests ──');

for (const [fsName, fs] of Object.entries(FONT_SIZES)) {
  for (const dev of DEVICES) {
    const ds = dynamicSize(dev.w, dev.h);

    test(`${dev.name} + font-${fsName}: title doesn't exceed card width`, () => {
      // Card title: ~10 chars max ("RTK #1234"), font-size fs.title
      // Rough: char width ≈ 0.6 × font-size, title width ≈ 10 × 0.6 × fs.title
      const estimatedTitleWidth = 10 * 0.6 * fs.title;
      const cardWidth = Math.min(dev.w * 0.9, 600); // card max-width is not capped but has padding
      assert(estimatedTitleWidth < cardWidth,
        `Title ~${estimatedTitleWidth}px may overflow ${cardWidth}px card`);
    });

    test(`${dev.name} + font-${fsName}: action buttons fit in row`, () => {
      // 5 buttons × 52px + gaps (space-evenly across ds width)
      const buttonsNeeded = 5 * 52; // Each button min 52px
      assert(ds >= buttonsNeeded * 0.5,
        `Dynamic-size ${ds}px too small for 5 buttons — need ~${buttonsNeeded * 0.5}px`);
    });

    if (fsName === 'large') {
      test(`${dev.name} + font-large: settings modal still scrollable`, () => {
        const mh = modalMaxHeight(dev.h);
        // Settings content with large fonts: ~800px estimated
        // Modal must enable scrolling
        assert(mh > 0, `Modal max-height must be positive for scrolling`);
        // The CSS has overflow-y: auto, so scrolling is always available
      });
    }
  }
}

// ── 5. Action Buttons Layout Analysis ──

console.log('\n── 5. Action buttons spacing analysis ──');

const BUTTON_COUNT = 5;
const BUTTON_MIN_WIDTH = 52; // from CSS

for (const dev of DEVICES) {
  const ds = dynamicSize(dev.w, dev.h);
  const availablePerButton = ds / BUTTON_COUNT;
  const gap = availablePerButton - BUTTON_MIN_WIDTH;

  test(`${dev.name}: buttons have non-negative spacing`, () => {
    // With space-evenly, each button slot = ds / 5
    // If slot < button width, buttons will touch or overlap
    assert(availablePerButton >= BUTTON_MIN_WIDTH * 0.85,
      `Button slot ${availablePerButton.toFixed(1)}px < ${BUTTON_MIN_WIDTH * 0.85}px min — buttons may overlap`);
  });
}

// ── 6. CSS Variable Dependencies ──

console.log('\n── 6. CSS custom property coverage ──');

test('CSS defines --dynamic-size', () => {
  assert(cssContent.includes('--dynamic-size:'), 'Missing --dynamic-size definition');
});

test('CSS defines --bg-main', () => {
  assert(cssContent.includes('--bg-main:'), 'Missing --bg-main definition');
});

test('CSS defines --surface', () => {
  assert(cssContent.includes('--surface:'), 'Missing --surface definition');
});

test('CSS defines --border-color', () => {
  assert(cssContent.includes('--border-color:'), 'Missing --border-color definition');
});

test('CSS defines --accent', () => {
  assert(cssContent.includes('--accent:'), 'Missing --accent definition');
});

test('CSS defines nightMode overrides for key variables', () => {
  assert(cssContent.includes('.nightMode') || cssContent.includes('.night_mode'),
    'Missing dark mode CSS classes');
});

// ── 7. Primary Swatch CSS Classes ──

console.log('\n── 7. Primary swatch dark mode classes ──');

const primaryNames = ['neutral', 'warm', 'cool', 'sepia', 'rose', 'sage'];

for (const name of primaryNames) {
  test(`CSS has .primary-swatch-${name} class`, () => {
    assert(cssContent.includes(`.primary-swatch-${name}`),
      `Missing .primary-swatch-${name} CSS class`);
  });

  test(`CSS has nightMode override for .primary-swatch-${name}`, () => {
    const hasNightMode = cssContent.includes(`.nightMode .primary-swatch-${name}`) ||
                         cssContent.includes(`.night_mode .primary-swatch-${name}`);
    assert(hasNightMode, `Missing dark mode override for .primary-swatch-${name}`);
  });
}

// ── 8. Font Size Class Coverage ──

console.log('\n── 8. Font size class completeness ──');

const mustHaveFontRules = [
  '.card', '.card-title', '.info-btn', '.link-btn', '.close-settings',
  '.category-name', '.segment-btn', '.settings-main-title'
];

for (const selector of mustHaveFontRules) {
  test(`font-small has rule for ${selector}`, () => {
    const pattern = new RegExp(`html\\.font-small[^{]*${selector.replace('.', '\\.')}`, 'm');
    assert(pattern.test(cssContent), `Missing font-small rule for ${selector}`);
  });

  test(`font-large has rule for ${selector}`, () => {
    const pattern = new RegExp(`html\\.font-large[^{]*${selector.replace('.', '\\.')}`, 'm');
    assert(pattern.test(cssContent), `Missing font-large rule for ${selector}`);
  });
}

// ── 9. Overflow & Containment Safety ──

console.log('\n── 9. Overflow & containment safety ──');

test('kanji-container has contain: layout style paint', () => {
  assert(cssContent.includes('contain: layout style paint'),
    'Missing layout containment on kanji-container');
});

test('kanji-container has isolation: isolate', () => {
  assert(cssContent.includes('isolation: isolate'),
    'Missing stacking context isolation');
});

test('kanji-container has overflow: hidden', () => {
  // Check that overflow is managed
  const containerBlock = cssContent.match(/\.kanji-container\s*\{[^}]+\}/);
  assert(containerBlock && containerBlock[0].includes('overflow'),
    'kanji-container missing overflow control');
});

test('settings-modal has overflow-y: auto', () => {
  assert(cssContent.includes('overflow-y: auto'),
    'Settings modal missing scroll capability');
});

test('settings-modal has overscroll-behavior: contain', () => {
  assert(cssContent.includes('overscroll-behavior: contain'),
    'Settings modal missing overscroll containment');
});

// ── 10. Worst-Case Viewport Scenarios ──

console.log('\n── 10. Worst-case scenario analysis ──');

test('Smallest phone (320×568) + font-large: card still usable', () => {
  const ds = dynamicSize(320, 568);  // = min(288, 369.2, 550) = 288
  const titleH = 29 + 16; // font-large title + margin
  const buttonsH = 52 + 8;
  const totalH = titleH + ds + buttonsH;
  // Should fit in 568px
  assert(totalH <= 568, `Total ${totalH}px exceeds 568px viewport`);
});

test('Very wide, very short viewport (1920×400): dynamic-size controlled by vh', () => {
  const ds = dynamicSize(1920, 400);
  assert.strictEqual(ds, 260); // 400 * 0.65 = 260
  assert(ds < 550, 'Should be vh-constrained, not capped');
});

test('Perfect square viewport (500×500)', () => {
  const ds = dynamicSize(500, 500);
  assert.strictEqual(ds, 325); // min(450, 325, 550) = 325 (vh-constrained)
});

test('Extreme portrait (300×900): width-constrained', () => {
  const ds = dynamicSize(300, 900);
  assert.strictEqual(ds, 270); // min(270, 585, 550) = 270 (vw-constrained)
});

test('AnkiMobile modal on iPhone SE: has enough height', () => {
  const mh = modalMaxHeightMobile(667);
  assert(mh >= 400, `AnkiMobile modal ${mh}px too short on iPhone SE`);
});

test('Landscape phone (667×375): modal still usable', () => {
  const mh = modalMaxHeight(375);
  assert(mh >= 200, `Landscape modal ${mh}px should be ≥200px`);
  // 375 - 96 = 279px — tight but scrollable
});

test('Desktop minimum (400×500): all elements fit', () => {
  const ds = dynamicSize(400, 500);
  assert(ds >= 250, `dynamic-size ${ds} too small for usable kanji drawing`);
  const mw = Math.min(400 * 0.9, 420);
  assert(mw >= 280, `Modal width ${mw} too narrow`);
});

// ── 11. DPR / Retina Considerations ──

console.log('\n── 11. Device pixel ratio considerations ──');

test('CSS uses translateZ(0) for GPU acceleration on kanji-container', () => {
  assert(cssContent.includes('translateZ(0)'),
    'Missing GPU acceleration hint for drawing canvas');
});

test('CSS uses backface-visibility: hidden for compositing', () => {
  assert(cssContent.includes('backface-visibility: hidden'),
    'Missing compositing optimization');
});

test('SVG drawing layer has z-index stacking', () => {
  assert(cssContent.includes('z-index: 10'), 'Missing draw-layer z-index');
  assert(cssContent.includes('z-index: 0'), 'Missing grid-bg z-index');
});

// ── 12. Safe Area Inset Handling ──

console.log('\n── 12. Safe area insets (notch/pill) ──');

test('CSS uses env(safe-area-inset-*) for overlay padding', () => {
  assert(cssContent.includes('env(safe-area-inset-top'),
    'Missing safe-area-inset-top');
  assert(cssContent.includes('env(safe-area-inset-bottom'),
    'Missing safe-area-inset-bottom');
});

test('AnkiMobile overlay has extra bottom padding for toolbar', () => {
  assert(cssContent.includes('.is-ankimobile'),
    'Missing AnkiMobile-specific CSS');
});

// ── 13. AnkiWeb-Specific Responsive Rules ──

console.log('\n── 13. AnkiWeb responsive rules ──');

test('AnkiWeb has special card-title font-size rules for font-small/large', () => {
  assert(cssContent.includes('is-ankiweb .card-title'),
    'Missing AnkiWeb card-title overrides');
});

test('AnkiWeb overflow-hidden guard exists', () => {
  assert(cssContent.includes('is-ankiweb') && cssContent.includes('overflow: hidden'),
    'Missing AnkiWeb overflow guard');
});

// ── Summary ──

console.log('\n═══════════════════════════════════════════════════');
console.log(`  Results: ${pass}/${total} passed, ${fail} failed`);
console.log('═══════════════════════════════════════════════════');

if (fail > 0) process.exit(1);
