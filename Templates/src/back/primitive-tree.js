// --- Primitive Tree (Kanji-Study style) ---
// Field grammar: value[keyword]@strokes{children}, e.g. 吾[Ich]@8-14{五[fünf]@8-11, 口[Mund]@12-14}
// Plain "value[keyword], ..." lists (no @/{}) still render, just without stroke colouring.

window._kanjiRenderPrimitiveTree = function (rawData, target) {
    const NS = 'http://www.w3.org/2000/svg';
    const PALETTE = ['#2aa7e0', '#d46be8', '#f0a030', '#3fbf86', '#e8625c', '#8a7cf0'];
    const R = 26, R_ROOT = 33, LINE_MAX = 12;
    const wrapLabel = (rawKw) => {
        const clean = (rawKw || '').replace(/\u00ad/g, '').trim();
        if (!clean) return [];
        if (clean.length <= LINE_MAX) return [clean];
        let best = -1, bestDist = Infinity;
        for (let i = 1; i < clean.length - 1; i++) {
            if (clean[i] === ' ' || clean[i] === '-') {
                const d = Math.abs(i - clean.length / 2);
                if (d < bestDist) { bestDist = d; best = i; }
            }
        }
        if (best > 0) {
            const l1 = (clean[best] === '-' ? clean.slice(0, best + 1) : clean.slice(0, best)).trim();
            const l2 = clean.slice(best + 1).trim();
            return [l1, l2];
        }
        const shyParts = (rawKw || '').split('\u00ad').map(p => p.trim()).filter(Boolean);
        if (shyParts.length > 1) {
            let bIdx = 1, bDiff = Infinity;
            for (let i = 1; i < shyParts.length; i++) {
                const a = shyParts.slice(0, i).join('');
                const b = shyParts.slice(i).join('');
                const diff = Math.abs(a.length - b.length);
                if (diff < bDiff) { bDiff = diff; bIdx = i; }
            }
            return [shyParts.slice(0, bIdx).join('') + '-', shyParts.slice(bIdx).join('')];
        }
        if (clean.length > 14) {
            const mid = Math.ceil(clean.length / 2);
            return [clean.slice(0, mid) + '-', clean.slice(mid)];
        }
        return [clean];
    };

    const splitTop = (str) => {
        const out = []; let cur = '', tag = false, br = 0, cb = 0;
        for (const ch of str) {
            if (ch === '<') tag = true; else if (ch === '>') tag = false;
            else if (!tag) { if (ch === '[') br++; else if (ch === ']') br--; else if (ch === '{') cb++; else if (ch === '}') cb--; }
            if (ch === ',' && !tag && br === 0 && cb === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; }
            else cur += ch;
        }
        if (cur.trim()) out.push(cur.trim());
        return out;
    };
    const parseStrokes = (s) => {
        const out = [];
        s.split('+').forEach(r => {
            const m = r.match(/^(\d+)(?:-(\d+))?$/);
            if (!m) return;
            for (let i = +m[1]; i <= +(m[2] || m[1]); i++) out.push(i - 1);
        });
        return out;
    };
    const parseItem = (item) => {
        let s = item.trim(), children = [];
        if (s.endsWith('}')) {
            let depth = 0, i = s.length - 1;
            for (; i >= 0; i--) { if (s[i] === '}') depth++; else if (s[i] === '{' && --depth === 0) break; }
            if (i > 0) { children = splitTop(s.slice(i + 1, -1)).map(parseItem); s = s.slice(0, i).trim(); }
        }
        let strokes = null;
        const sm = s.match(/@([\d+\-]+)\s*$/);
        if (sm) { strokes = parseStrokes(sm[1]); s = s.slice(0, sm.index).trim(); }
        let rawKw = '', keyword = '', isPrimitive = false;
        const bm = s.match(/\[([^\[\]]*)\]\s*$/);
        if (bm) {
            rawKw = bm[1].trim();
            if (rawKw.endsWith('*')) { isPrimitive = true; rawKw = rawKw.slice(0, -1); }
            keyword = rawKw.replace(/\u00ad/g, '');
            s = s.slice(0, bm.index).trim();
        }
        return { value: s, rawKeyword: rawKw, keyword, isPrimitive, strokes, children };
    };

    const svgBg = document.getElementById('svg-bg');
    const ds = svgBg ? Array.prototype.filter.call(svgBg.children, p => p.tagName.toLowerCase() === 'path' && !p.classList.contains('gel-halo')).map(p => p.getAttribute('d')) : [];
    const rootChar = (target.closest('.tree-container') || document).querySelector('.tree-root-kanji');
    const root = { value: rootChar ? rootChar.textContent.trim() : '', rawKeyword: '', keyword: '', strokes: ds.map((_, i) => i), children: splitTop(rawData).map(parseItem), isRoot: true };

    // Measure stroke / markup / label bounding boxes in an off-screen SVG
    const scratch = document.createElementNS(NS, 'svg');
    scratch.setAttribute('style', 'position:absolute;left:-9999px;top:0;width:200px;height:200px;visibility:hidden');
    document.body.appendChild(scratch);
    const strokeBox = ds.map(d => {
        const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); scratch.appendChild(p);
        let b = null; try { b = p.getBBox(); } catch (e) { }
        return b && { x: b.x, y: b.y, w: b.width, h: b.height };
    });
    const markupBox = (markup) => {
        const g = document.createElementNS(NS, 'g'); g.innerHTML = markup; scratch.appendChild(g);
        let b = null; try { b = g.getBBox(); } catch (e) { }
        return b && b.width > 0 ? { x: b.x, y: b.y, w: b.width, h: b.height } : null;
    };
    const unionBox = (idx) => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        idx.forEach(i => { const b = strokeBox[i]; if (!b) return; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); });
        return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    };
    const squareViewBox = (b, pad) => {
        const size = Math.max(b.w, b.h, 12) * (1 + pad * 2);
        return [(b.x + b.w / 2 - size / 2), (b.y + b.h / 2 - size / 2), size, size].map(n => n.toFixed(2)).join(' ');
    };

    // Pre-measure node label pills and depths
    let maxDepth = 0;
    const initNodes = (n, depth) => {
        n.depth = depth;
        maxDepth = Math.max(maxDepth, depth);
        n.lines = (!n.isRoot && n.keyword) ? wrapLabel(n.rawKeyword || n.keyword) : [];
        if (n.lines.length) {
            const maxChars = Math.max.apply(null, n.lines.map(l => l.length));
            let measuredW = maxChars * 6.8;
            try {
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('style', 'font-size:11px;font-weight:800;font-family:sans-serif');
                n.lines.forEach((ln, li) => {
                    const ts = document.createElementNS(NS, 'tspan');
                    ts.setAttribute('x', '0');
                    if (li > 0) ts.setAttribute('dy', '12');
                    ts.textContent = ln;
                    t.appendChild(ts);
                });
                scratch.appendChild(t);
                const tb = t.getBBox();
                if (tb && tb.width > 8) measuredW = Math.max(tb.width, maxChars * 6.4);
            } catch (e) { }
            n.pillW = Math.max(44, Math.ceil(measuredW + 18));
            n.pillH = 19 + (n.lines.length - 1) * 12;
        } else {
            n.pillW = 0;
            n.pillH = 0;
        }
        const r = n.isRoot ? R_ROOT : R;
        n.halfW = Math.max(r + 6, n.pillW / 2 + 4);
        n.children.forEach(c => initNodes(c, depth + 1));
    };
    initNodes(root, 0);

    // Contour-aware hierarchical subtree layout (packs subtrees cleanly across depths without wasting columns)
    const shiftSubtree = (n, dx) => {
        n.x += dx;
        Object.keys(n.minX).forEach(d => { n.minX[d] += dx; n.maxX[d] += dx; });
        n.children.forEach(c => shiftSubtree(c, dx));
    };
    const placeSubtree = (n) => {
        if (!n.children.length) {
            n.x = 0;
            n.minX = { [n.depth]: -n.halfW };
            n.maxX = { [n.depth]: n.halfW };
            return;
        }
        n.children.forEach(placeSubtree);
        const accMin = Object.assign({}, n.children[0].minX);
        const accMax = Object.assign({}, n.children[0].maxX);
        for (let i = 1; i < n.children.length; i++) {
            const c = n.children[i];
            let reqDx = 0;
            Object.keys(c.minX).forEach(d => {
                if (accMax[d] !== undefined) {
                    const gap = (+d === c.depth) ? 14 : 10;
                    reqDx = Math.max(reqDx, accMax[d] + gap - c.minX[d]);
                }
            });
            const prevX = n.children[i - 1].x;
            reqDx = Math.max(reqDx, prevX + 64 - c.x);
            shiftSubtree(c, reqDx);
            Object.keys(c.minX).forEach(d => {
                accMin[d] = accMin[d] === undefined ? c.minX[d] : Math.min(accMin[d], c.minX[d]);
                accMax[d] = accMax[d] === undefined ? c.maxX[d] : Math.max(accMax[d], c.maxX[d]);
            });
        }
        n.x = (n.children[0].x + n.children[n.children.length - 1].x) / 2;
        accMin[n.depth] = accMin[n.depth] === undefined ? (n.x - n.halfW) : Math.min(accMin[n.depth], n.x - n.halfW);
        accMax[n.depth] = accMax[n.depth] === undefined ? (n.x + n.halfW) : Math.max(accMax[n.depth], n.x + n.halfW);
        n.minX = accMin;
        n.maxX = accMax;
    };
    placeSubtree(root);

    // Spread narrow trees horizontally and adapt vertical step so the tree fills the box cleanly without button overlap
    const boxH = maxDepth >= 3 ? 320 : (maxDepth === 2 ? 280 : 225);

    let minEdge = Infinity, maxEdge = -Infinity, minCenter = Infinity, maxCenter = -Infinity;
    const scanX = (n) => {
        minEdge = Math.min(minEdge, n.x - n.halfW);
        maxEdge = Math.max(maxEdge, n.x + n.halfW);
        if (!n.isRoot) {
            minCenter = Math.min(minCenter, n.x);
            maxCenter = Math.max(maxCenter, n.x);
        }
        n.children.forEach(scanX);
    };
    scanX(root);
    const rawSpan = maxEdge - minEdge;
    const centerSpan = maxCenter > minCenter ? (maxCenter - minCenter) : 0;

    const idealSpan = maxDepth === 1 ? 230 : (maxDepth === 2 ? 275 : 300);
    if (rawSpan < idealSpan && centerSpan > 10) {
        const midC = (minCenter + maxCenter) / 2;
        const outerPad = Math.max(52, rawSpan - centerSpan);
        const stretch = Math.min(2.0, Math.max(1, (idealSpan - outerPad) / centerSpan));
        if (stretch > 1.02) {
            const applyStretch = (n) => {
                n.x = midC + (n.x - midC) * stretch;
                n.children.forEach(applyStretch);
            };
            applyStretch(root);
            minEdge = Infinity; maxEdge = -Infinity;
            scanX(root);
        }
    }

    const padX = 12;
    const contentW = Math.ceil(maxEdge - minEdge);
    const width = Math.max(260, contentW + padX * 2);
    const shiftToPositive = (width - contentW) / 2 - minEdge;
    const finalizeX = (n) => { n.x += shiftToPositive; n.children.forEach(finalizeX); };
    finalizeX(root);

    const innerRatio = 310 / Math.max(140, boxH - 52);
    const neededH = width / innerRatio;
    const baseHStep = maxDepth === 1 ? 94 : (maxDepth === 2 ? 96 : 98);
    const H_STEP = maxDepth > 0
        ? Math.min(165, Math.max(baseHStep, Math.round((neededH - R_ROOT - R - 28) / maxDepth)))
        : baseHStep;

    const padTop = 6;
    let maxBottomY = 0;
    const assignY = (n) => {
        const r = n.isRoot ? R_ROOT : R;
        n.y = padTop + R_ROOT + n.depth * H_STEP;
        n.topY = n.y - r;
        n.bottomY = n.lines.length ? (n.y + r - 4 + n.pillH) : (n.y + r);
        maxBottomY = Math.max(maxBottomY, n.bottomY);
        n.children.forEach(assignY);
    };
    assignY(root);
    const height = Math.ceil(maxBottomY + 6);

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'primitive-tree');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const edges = document.createElementNS(NS, 'g'); edges.setAttribute('class', 'pt-edges');
    const nodes = document.createElementNS(NS, 'g');
    svg.appendChild(edges); svg.appendChild(nodes);

    const allNodes = [];
    const draw = (n, parentNode, branchColor) => {
        n.parent = parentNode || null;
        n.branchColor = branchColor || 'var(--accent)';
        const r = n.isRoot ? R_ROOT : R;
        if (n.children.length) {
            const startY = n.bottomY;
            const endY = n.children[0].topY;
            const midY = startY + (endY - startY) * 0.5;
            n.children.forEach((c, ci) => {
                const childColor = PALETTE[ci % PALETTE.length];
                const p = document.createElementNS(NS, 'path');
                const dx = c.x - n.x;
                let dStr;
                if (Math.abs(dx) < 1.5) {
                    dStr = `M ${n.x.toFixed(1)} ${startY.toFixed(1)} V ${endY.toFixed(1)}`;
                } else {
                    const dir = dx > 0 ? 1 : -1;
                    const cr = Math.max(0, Math.min(9, Math.abs(dx) / 2, Math.max(2, (endY - startY) / 2 - 1)));
                    dStr = `M ${n.x.toFixed(1)} ${startY.toFixed(1)} V ${(midY - cr).toFixed(1)} Q ${n.x.toFixed(1)} ${midY.toFixed(1)} ${(n.x + dir * cr).toFixed(1)} ${midY.toFixed(1)} H ${(c.x - dir * cr).toFixed(1)} Q ${c.x.toFixed(1)} ${midY.toFixed(1)} ${c.x.toFixed(1)} ${(midY + cr).toFixed(1)} V ${endY.toFixed(1)}`;
                }
                p.setAttribute('d', dStr);
                c.edgeFromParent = p;
                edges.appendChild(p);
                draw(c, n, childColor);
            });
        }

        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'pt-node' + (n.isRoot ? ' pt-root' : '') + (n.children.length ? '' : ' pt-leaf'));
        const circle = document.createElementNS(NS, 'circle');
        circle.setAttribute('cx', n.x); circle.setAttribute('cy', n.y); circle.setAttribute('r', r);
        g.appendChild(circle);

        const glyph = document.createElementNS(NS, 'svg');
        const gs = r * 1.32;
        glyph.setAttribute('x', (n.x - gs / 2).toFixed(2)); glyph.setAttribute('y', (n.y - gs / 2).toFixed(2));
        glyph.setAttribute('width', gs.toFixed(2)); glyph.setAttribute('height', gs.toFixed(2));
        glyph.setAttribute('class', 'pt-glyph');
        n.glyphEl = glyph;
        n.glyphPaths = [];
        const box = n.strokes && n.strokes.length ? unionBox(n.strokes) : null;
        if (box) {
            const colorOf = {};
            n.children.forEach((c, ci) => (c.strokes || []).forEach(s => { if (colorOf[s] == null) colorOf[s] = PALETTE[ci % PALETTE.length]; }));
            glyph.setAttribute('viewBox', squareViewBox(box, 0.12));
            n.strokes.forEach(s => {
                if (!ds[s]) return;
                const p = document.createElementNS(NS, 'path');
                p.setAttribute('d', ds[s]);
                if (colorOf[s]) p.style.stroke = colorOf[s];
                glyph.appendChild(p);
                n.glyphPaths.push({ idx: s, pathEl: p, defaultColor: colorOf[s] || '' });
            });
        } else if (/<path/i.test(n.value)) {
            glyph.setAttribute('class', 'pt-glyph pt-glyph-fill');
            // Rebuild from an inert DOMParser document, keeping only g/path and geometry attributes.
            const flip = document.createElementNS(NS, 'g');
            flip.setAttribute('transform', 'scale(1,-1)');
            const copySafe = (src, dst) => {
                Array.prototype.forEach.call(src.children, el => {
                    const tag = el.localName;
                    if (tag === 'svg') { copySafe(el, dst); return; }
                    if (tag !== 'g' && tag !== 'path') return;
                    const out = document.createElementNS(NS, tag);
                    ['d', 'transform', 'fill-rule', 'clip-rule'].forEach(a => { if (el.hasAttribute(a)) out.setAttribute(a, el.getAttribute(a)); });
                    if (tag === 'g') copySafe(el, out);
                    dst.appendChild(out);
                });
            };
            copySafe(new DOMParser().parseFromString('<svg>' + n.value + '</svg>', 'text/html').body, flip);
            glyph.appendChild(flip);
            const mb = markupBox(glyph.innerHTML);
            if (mb) glyph.setAttribute('viewBox', squareViewBox(mb, 0.16));
        } else {
            glyph.setAttribute('viewBox', '0 0 100 100');
            const t = document.createElementNS(NS, 'text');
            t.setAttribute('x', '50'); t.setAttribute('y', '54'); t.setAttribute('class', 'pt-char');
            t.textContent = n.value;
            glyph.appendChild(t);
        }
        g.appendChild(glyph);

        if (n.lines && n.lines.length) {
            const pillY = n.y + r - 4;
            const pillRect = document.createElementNS(NS, 'rect');
            pillRect.setAttribute('class', 'pt-label-pill');
            pillRect.setAttribute('x', (n.x - n.pillW / 2).toFixed(1));
            pillRect.setAttribute('y', pillY.toFixed(1));
            pillRect.setAttribute('width', n.pillW.toFixed(1));
            pillRect.setAttribute('height', n.pillH.toFixed(1));
            pillRect.setAttribute('rx', '8');
            pillRect.setAttribute('ry', '8');
            g.appendChild(pillRect);

            const label = document.createElementNS(NS, 'text');
            label.setAttribute('x', n.x.toFixed(1));
            label.setAttribute('y', (pillY + 13).toFixed(1));
            label.setAttribute('class', 'pt-label' + (n.isPrimitive ? ' pt-label-primitive' : ''));
            n.lines.forEach((ln, li) => {
                const ts = document.createElementNS(NS, 'tspan');
                ts.setAttribute('x', n.x.toFixed(1));
                if (li > 0) ts.setAttribute('dy', '12');
                ts.textContent = ln;
                label.appendChild(ts);
            });
            const title = document.createElementNS(NS, 'title'); title.textContent = n.keyword;
            g.appendChild(title);
            g.appendChild(label);
        }
        n.el = g;
        nodes.appendChild(g);
        allNodes.push({ x: n.x, y: n.y, r: r, el: g, node: n });
    };
    draw(root, null, 'var(--accent)');
    scratch.remove();

    target.innerHTML = '';
    const container = target.closest('.tree-container');
    if (container) {
        container.classList.add('tree-graph-mode');
        container.classList.remove('tree-zoomed', 'tree-focused', 'tree-panning', 'tree-fullscreen');
    }

    // --- Interactive +/- Zoom, Fullscreen & Focus-Gated Pan (Double-Tap to Navigate, Tap Outside to Scroll) ---
    let zoom = 1;
    const minZoom = 1;
    const maxZoom = 3.0;
    let vx = 0, vy = 0, vw = width, vh = height;
    let panDragged = false;
    let hasPanned = false;
    let navActive = false;
    let isFullscreen = false;

    const ICON_EXPAND = '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
    const ICON_COLLAPSE = '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

    const toolbar = document.createElement('div');
    toolbar.className = 'tree-toolbar';

    const btnOut = document.createElement('button');
    btnOut.type = 'button';
    btnOut.className = 'tree-zoom-btn tappable disabled';
    btnOut.title = 'Verkleinern';
    btnOut.setAttribute('aria-label', 'Verkleinern');
    btnOut.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><line x1="5" y1="12" x2="19" y2="12" stroke-linecap="round"/></svg>';

    const btnIn = document.createElement('button');
    btnIn.type = 'button';
    btnIn.className = 'tree-zoom-btn tappable';
    btnIn.title = 'Vergrößern';
    btnIn.setAttribute('aria-label', 'Vergrößern');
    btnIn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke-linecap="round"/></svg>';

    const btnFs = document.createElement('button');
    btnFs.type = 'button';
    btnFs.className = 'tree-zoom-btn tree-fullscreen-btn tappable';
    btnFs.title = 'Vollbild umschalten';
    btnFs.setAttribute('aria-label', 'Vollbild umschalten');
    btnFs.innerHTML = ICON_EXPAND;

    const updateZoomBtns = () => {
        btnOut.classList.toggle('disabled', zoom <= 1.02);
        btnIn.classList.toggle('disabled', zoom >= maxZoom - 0.02);
    };

    toolbar.appendChild(btnOut);
    toolbar.appendChild(btnIn);

    const viewport = document.createElement('div');
    viewport.className = 'tree-viewport tappable';
    viewport.style.height = boxH + 'px';
    svg.style.height = boxH + 'px';
    const shield = document.createElement('div');
    shield.className = 'tree-touch-shield tappable';
    viewport.appendChild(svg);
    viewport.appendChild(shield);
    viewport.appendChild(toolbar);
    viewport.appendChild(btnFs);

    target.appendChild(viewport);

    const setNavActive = (active) => {
        const nextActive = !!active;
        viewport.style.touchAction = 'none';
        shield.style.touchAction = 'none';
        svg.style.touchAction = 'none';
        if (nextActive === navActive) {
            updateZoomBtns();
            return;
        }
        navActive = nextActive;
        if (container) {
            container.classList.toggle('tree-focused', navActive);
            if (!navActive) container.classList.remove('tree-panning');
        }
        updateZoomBtns();
    };
    window._kanjiSetTreeNavActive = setNavActive;

    let savedModalScroll = 0;
    const setFullscreen = (fs) => {
        const nextFs = !!fs;
        if (nextFs === isFullscreen) return;
        isFullscreen = nextFs;
        const modalEl = container ? container.closest('.info-modal') : document.querySelector('.info-modal');
        const overlayEl = modalEl ? modalEl.closest('.info-overlay') : document.getElementById('info-overlay');
        if (isFullscreen) {
            if (overlayEl) overlayEl.classList.add('tree-fs-overlay');
            if (modalEl) {
                savedModalScroll = modalEl.scrollTop;
                modalEl.scrollTop = 0;
                modalEl.classList.add('tree-fs-active');
            }
            if (container) container.classList.add('tree-fullscreen');
            viewport.style.height = '100%';
            svg.style.height = '100%';
            btnFs.innerHTML = ICON_COLLAPSE;
            if (zoom <= 1.02) hasPanned = false;
            setNavActive(true);
        } else {
            if (container) container.classList.remove('tree-fullscreen');
            if (modalEl) {
                modalEl.classList.remove('tree-fs-active');
                modalEl.scrollTop = savedModalScroll;
            }
            if (overlayEl) overlayEl.classList.remove('tree-fs-overlay');
            viewport.style.height = boxH + 'px';
            svg.style.height = boxH + 'px';
            btnFs.innerHTML = ICON_EXPAND;
            if (zoom <= 1.02) {
                hasPanned = false;
                setNavActive(false);
            }
        }
        applyViewBox();
        requestAnimationFrame(() => applyViewBox());
    };
    window._kanjiSetTreeFullscreen = setFullscreen;

    const getBaseBox = () => {
        const cW = viewport.clientWidth || svg.clientWidth || 0;
        const cH = viewport.clientHeight || svg.clientHeight || 0;
        const bW = cW > 40 ? cW : 320;
        const bH = cH > 40 ? cH : boxH;
        const leftSafePx = 10, rightSafePx = 10;
        const botSafePx = isFullscreen ? 46 : 38;
        const topSafePx = isFullscreen ? 46 : (((root.x + root.halfW) / width > 0.72) ? 36 : 12);
        const innerW = Math.max(120, bW - leftSafePx - rightSafePx);
        const innerH = Math.max(100, bH - topSafePx - botSafePx);
        const unitsPerPx = Math.max(width / innerW, height / innerH);
        const bVw = bW * unitsPerPx;
        const bVh = bH * unitsPerPx;
        const baseVx = (width - bVw) / 2;
        const baseVy = height / 2 - (topSafePx + innerH / 2) * unitsPerPx;
        return { bVw: bVw, bVh: bVh, baseVx: baseVx, baseVy: baseVy };
    };

    const clientToSvg = (clientX, clientY) => {
        const rect = svg.getBoundingClientRect();
        if (!rect.width || !rect.height) return { x: root.x, y: root.y };
        const scale = Math.min(rect.width / vw, rect.height / vh) || 1;
        const offX = (rect.width - vw * scale) / 2;
        const offY = (rect.height - vh * scale) / 2;
        return {
            x: vx + (clientX - rect.left - offX) / scale,
            y: vy + (clientY - rect.top - offY) / scale
        };
    };

    const clampPan = () => {
        const padFactor = 0.35;
        const marginX = Math.max(48, vw * padFactor);
        const minX = Math.min(0, width - vw) - marginX;
        const maxX = Math.max(0, width - vw) + marginX;
        if (vx < minX) vx = minX; else if (vx > maxX) vx = maxX;

        const marginY = Math.max(48, vh * padFactor);
        const minY = Math.min(0, height - vh) - marginY;
        const maxY = Math.max(0, height - vh) + marginY;
        if (vy < minY) vy = minY; else if (vy > maxY) vy = maxY;
    };

    const applyViewBox = () => {
        const base = getBaseBox();
        vw = base.bVw / zoom;
        vh = base.bVh / zoom;
        if (zoom <= 1.02 && !hasPanned) {
            zoom = 1;
            vx = base.baseVx;
            vy = base.baseVy;
            if (container) container.classList.remove('tree-zoomed');
        } else {
            if (container) container.classList.toggle('tree-zoomed', zoom > 1.02 || hasPanned);
            clampPan();
        }
        svg.setAttribute('viewBox', `${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`);
        updateZoomBtns();
    };
    window._kanjiRefreshTreeViewport = applyViewBox;

    const setZoomAround = (newZoom, focusSvgX, focusSvgY, resetPan) => {
        const targetZoom = Math.max(minZoom, Math.min(maxZoom, Math.round(newZoom * 100) / 100));
        const base = getBaseBox();
        if (targetZoom <= 1.02 && resetPan) {
            zoom = 1;
            hasPanned = false;
            applyViewBox();
            return;
        }
        const prevVw = base.bVw / zoom;
        const prevVh = base.bVh / zoom;
        const cx = (focusSvgX != null) ? focusSvgX : (vx + prevVw / 2);
        const cy = (focusSvgY != null) ? focusSvgY : (vy + prevVh / 2);
        const rx = prevVw > 0 ? (cx - vx) / prevVw : 0.5;
        const ry = prevVh > 0 ? (cy - vy) / prevVh : 0.5;
        zoom = targetZoom;
        const nextVw = base.bVw / zoom;
        const nextVh = base.bVh / zoom;
        vx = cx - rx * nextVw;
        vy = cy - ry * nextVh;
        applyViewBox();
    };

    setNavActive(false);
    applyViewBox();

    const bindTreeBtn = (btn, fn) => {
        let tStartX = 0, tStartY = 0, lastTouchFire = 0;
        btn.addEventListener('touchstart', function (e) {
            if (e.cancelable !== false) e.preventDefault();
            if (e.touches && e.touches.length === 1) {
                tStartX = e.touches[0].clientX;
                tStartY = e.touches[0].clientY;
            }
        }, { passive: false });
        btn.addEventListener('touchmove', function (e) {
            if (e.cancelable !== false) e.preventDefault();
        }, { passive: false });
        btn.addEventListener('touchend', function (e) {
            if (e.cancelable !== false) e.preventDefault();
            if (e.changedTouches && e.changedTouches.length === 1) {
                const dx = e.changedTouches[0].clientX - tStartX;
                const dy = e.changedTouches[0].clientY - tStartY;
                if (Math.hypot(dx, dy) < 24) {
                    if (Date.now() - lastTouchFire < 80) return;
                    lastTouchFire = Date.now();
                    fn();
                }
            }
        }, { passive: false });
        btn.addEventListener('pointerup', function (e) {
            if (e.pointerType !== 'pen') return;
            e.preventDefault();
            e.stopPropagation();
            if (Date.now() - lastTouchFire < 260) return;
            lastTouchFire = Date.now();
            fn();
        });
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (Date.now() - lastTouchFire < 400) return;
            fn();
        });
    };

    bindTreeBtn(btnIn, () => {
        setNavActive(true);
        const next = Math.round((zoom + 0.25) * 4) / 4;
        setZoomAround(next);
    });
    bindTreeBtn(btnOut, () => {
        const next = Math.round((zoom - 0.25) * 4) / 4;
        if (next <= 1.02) {
            setZoomAround(1, null, null, true);
            if (!isFullscreen) setNavActive(false);
        } else {
            setNavActive(true);
            setZoomAround(next, null, null, false);
        }
    });
    bindTreeBtn(btnFs, () => {
        setFullscreen(!isFullscreen);
    });

    let selectedNode = null;
    const applyNodeSelection = (selNode) => {
        if (!selNode && !selectedNode) return;
        allNodes.forEach(item => {
            const nd = item.node;
            nd.el.classList.remove('pt-active', 'pt-parent-focus', 'pt-ancestor-focus', 'pt-descendant-focus', 'pt-dimmed', 'pt-dismissed');
            nd.el.style.removeProperty('--pt-hl-color');
            if (nd.edgeFromParent) {
                nd.edgeFromParent.classList.remove('pt-edge-active', 'pt-edge-ancestor', 'pt-edge-descendant', 'pt-edge-dimmed');
                nd.edgeFromParent.style.removeProperty('stroke');
            }
            if (nd.glyphPaths && nd.glyphEl) {
                nd.glyphPaths.forEach(gp => {
                    gp.pathEl.classList.remove('pt-stroke-focus', 'pt-stroke-dim');
                    if (gp.defaultColor) gp.pathEl.style.stroke = gp.defaultColor;
                    else gp.pathEl.style.removeProperty('stroke');
                    nd.glyphEl.appendChild(gp.pathEl);
                });
            }
        });

        if (!selNode) {
            selectedNode = null;
            return;
        }
        selectedNode = selNode;

        if (selNode.isRoot) {
            selNode.el.classList.add('pt-active');
            selNode.el.style.setProperty('--pt-hl-color', 'var(--accent)');
            allNodes.forEach(item => {
                const nd = item.node;
                if (nd === selNode) return;
                if (nd.parent === selNode) {
                    nd.el.classList.add('pt-descendant-focus');
                    nd.el.style.setProperty('--pt-hl-color', nd.branchColor);
                    if (nd.edgeFromParent) {
                        nd.edgeFromParent.classList.add('pt-edge-active');
                        nd.edgeFromParent.style.stroke = nd.branchColor;
                        edges.appendChild(nd.edgeFromParent);
                    }
                } else {
                    nd.el.classList.add('pt-dimmed');
                    if (nd.edgeFromParent) nd.edgeFromParent.classList.add('pt-edge-dimmed');
                }
            });
            return;
        }

        const hlColor = selNode.branchColor || 'var(--accent)';
        const strokeSet = new Set(selNode.strokes || []);
        const ancestorSet = new Set();
        const ancestorList = [];
        for (let p = selNode.parent; p; p = p.parent) {
            ancestorSet.add(p);
            ancestorList.push(p);
        }
        const descendantSet = new Set();
        const walkDesc = (n) => {
            n.children.forEach(c => { descendantSet.add(c); walkDesc(c); });
        };
        walkDesc(selNode);

        // 1. Highlight tapped node & its own strokes
        selNode.el.classList.add('pt-active');
        selNode.el.style.setProperty('--pt-hl-color', hlColor);
        if (selNode.glyphPaths && selNode.glyphPaths.length) {
            selNode.glyphPaths.forEach(gp => {
                gp.pathEl.classList.add('pt-stroke-focus');
                if (!selNode.children.length) gp.pathEl.style.stroke = hlColor;
            });
        }

        // 2. Highlight upward connecting line(s) (bring to front of edges group so shared trunks glow cleanly)
        for (let i = ancestorList.length - 1; i >= 0; i--) {
            const anc = ancestorList[i];
            if (anc.edgeFromParent) {
                anc.edgeFromParent.classList.add('pt-edge-ancestor');
                anc.edgeFromParent.style.stroke = hlColor;
                edges.appendChild(anc.edgeFromParent);
            }
        }
        if (selNode.edgeFromParent) {
            selNode.edgeFromParent.classList.add('pt-edge-active');
            selNode.edgeFromParent.style.stroke = hlColor;
            edges.appendChild(selNode.edgeFromParent);
        }

        // 3. In parent & ancestor kanjis: spotlight the primitive's strokes & softly dim the rest
        ancestorList.forEach(anc => {
            const isDirectParent = (anc === selNode.parent);
            anc.el.classList.add(isDirectParent ? 'pt-parent-focus' : 'pt-ancestor-focus');
            anc.el.style.setProperty('--pt-hl-color', hlColor);
            if (anc.glyphPaths && anc.glyphEl && strokeSet.size > 0) {
                anc.glyphPaths.forEach(gp => {
                    if (!strokeSet.has(gp.idx)) {
                        gp.pathEl.classList.add('pt-stroke-dim');
                    }
                });
                anc.glyphPaths.forEach(gp => {
                    if (strokeSet.has(gp.idx)) {
                        gp.pathEl.classList.add('pt-stroke-focus');
                        gp.pathEl.style.stroke = hlColor;
                        anc.glyphEl.appendChild(gp.pathEl);
                    }
                });
            }
        });

        // 4. Dim unrelated nodes & edges; keep direct subtree readable
        allNodes.forEach(item => {
            const nd = item.node;
            if (nd === selNode || ancestorSet.has(nd)) return;
            if (descendantSet.has(nd)) {
                nd.el.classList.add('pt-descendant-focus');
                if (nd.edgeFromParent) {
                    nd.edgeFromParent.classList.add('pt-edge-descendant');
                    edges.appendChild(nd.edgeFromParent);
                }
            } else {
                nd.el.classList.add('pt-dimmed');
                if (nd.edgeFromParent) nd.edgeFromParent.classList.add('pt-edge-dimmed');
            }
        });
    };
    window._kanjiClearTreeSelection = () => applyNodeSelection(null);

    let prevTapEndTime = 0, prevTapEndX = 0, prevTapEndY = 0;
    let prevGestureStartTime = 0, prevGestureStartX = 0, prevGestureStartY = 0;
    let curGestureStartTime = 0, curGestureStartX = 0, curGestureStartY = 0;
    let lastNavToggleTime = 0, lastPenTime = 0;

    const toggleTreeNavByDoubleTap = () => {
        const now = Date.now();
        if (now - lastNavToggleTime < 340) return;
        lastNavToggleTime = now;
        prevTapEndTime = 0;
        prevGestureStartTime = 0;
        curGestureStartTime = 0;
        setNavActive(!navActive);
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
        applyNodeSelection(null);
        if (navActive) applyViewBox();
    };

    const isSecondTap = (x, y, now) => {
        if (now - lastNavToggleTime < 340) return false;
        const byEnd = prevTapEndTime > 0 && (now - prevTapEndTime) < 500 && Math.hypot(x - prevTapEndX, y - prevTapEndY) < 68;
        const byStart = prevGestureStartTime > 0 && (now - prevGestureStartTime) >= 40 && (now - prevGestureStartTime) < 550 && Math.hypot(x - prevGestureStartX, y - prevGestureStartY) < 68;
        return byEnd || byStart;
    };

    const selectNodeAt = (clientX, clientY) => {
        const pt = clientToSvg(clientX, clientY);
        let hitItem = null, bestD = Infinity;
        allNodes.forEach(nd => {
            const d = Math.hypot(pt.x - nd.x, pt.y - nd.y);
            const onCircle = d <= nd.r + 10;
            const onPill = nd.node.pillW > 0 && Math.abs(pt.x - nd.x) <= (nd.node.pillW / 2 + 6) && pt.y >= nd.y && pt.y <= (nd.node.bottomY + 6);
            if ((onCircle || onPill) && d < bestD) { bestD = d; hitItem = nd; }
        });
        if (hitItem) {
            if (selectedNode === hitItem.node) {
                applyNodeSelection(null);
                hitItem.el.classList.add('pt-dismissed');
                _kdSnd('fx', 'nodeOff');
            } else {
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8);
                applyNodeSelection(hitItem.node);
                let depth = 0;
                for (let p = hitItem.node.parent; p; p = p.parent) depth++;
                _kdSnd('fx', 'node', 0, depth);
            }
        } else {
            if (selectedNode) _kdSnd('fx', 'nodeOff');
            applyNodeSelection(null);
        }
    };

    // Call preventDefault without stopPropagation so AnkiMobile's document-level
    // .tappable check receives the bubbled touch and suppresses native OS commands
    const preventTreeDefault = e => {
        if (e.cancelable !== false) e.preventDefault();
    };

    let isDown = false, startX = 0, startY = 0, startVx = 0, startVy = 0, lastTouchEnd = 0, lastPointerUp = 0;
    let maxTapMove = 0, doubleTapToggled = false, startModalScroll = 0;
    let lastMoveY = 0, lastMoveT = 0, scrollVelY = 0, treeScrollRaf = null;
    let pinchDist0 = 0, pinchZoom0 = 1, pinchSvgX = root.x, pinchSvgY = root.y;
    const treeModalEl = container ? container.closest('.info-modal') : document.querySelector('.info-modal');
    const stopTreeScrollMomentum = () => {
        if (treeScrollRaf) { cancelAnimationFrame(treeScrollRaf); treeScrollRaf = null; }
    };

    shield.addEventListener('touchstart', function (e) {
        preventTreeDefault(e);
        stopTreeScrollMomentum();
        if (e.touches.length === 2) {
            setNavActive(true);
            isDown = false;
            panDragged = true;
            doubleTapToggled = false;
            prevTapEndTime = 0;
            prevGestureStartTime = 0;
            curGestureStartTime = 0;
            pinchDist0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            pinchZoom0 = zoom;
            const mid = clientToSvg((e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2);
            pinchSvgX = mid.x;
            pinchSvgY = mid.y;
            return;
        }
        if (e.touches.length === 1) {
            const now = Date.now();
            if (now - lastPenTime < 120) return;
            const tx = e.touches[0].clientX;
            const ty = e.touches[0].clientY;
            isDown = true;
            panDragged = false;
            maxTapMove = 0;
            startX = tx;
            startY = ty;
            lastMoveY = ty;
            lastMoveT = performance.now();
            scrollVelY = 0;
            startVx = vx;
            startVy = vy;
            startModalScroll = treeModalEl ? treeModalEl.scrollTop : 0;
            if (isSecondTap(tx, ty, now)) {
                doubleTapToggled = true;
                toggleTreeNavByDoubleTap();
                startVx = vx;
                startVy = vy;
                return;
            }
            doubleTapToggled = false;
            curGestureStartTime = now;
            curGestureStartX = tx;
            curGestureStartY = ty;
            if (navActive) applyViewBox();
        }
    }, { passive: false });

    shield.addEventListener('touchmove', function (e) {
        preventTreeDefault(e);
        if (e.touches.length === 2 && pinchDist0 > 10) {
            const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            panDragged = true;
            curGestureStartTime = 0;
            setZoomAround(pinchZoom0 * (d / pinchDist0), pinchSvgX, pinchSvgY, false);
            return;
        }
        if (Date.now() - lastPenTime < 120) return;
        if (!isDown || e.touches.length !== 1) return;
        const cx = e.touches[0].clientX;
        const cy = e.touches[0].clientY;
        const dx = cx - startX;
        const dy = cy - startY;
        const moveDist = Math.hypot(dx, dy);
        if (moveDist > maxTapMove) maxTapMove = moveDist;
        if (moveDist > 22) curGestureStartTime = 0;
        if (!navActive) {
            if (moveDist > 12) panDragged = true;
            if (panDragged && treeModalEl && treeModalEl.scrollHeight > treeModalEl.clientHeight) {
                const pNow = performance.now();
                const dt = pNow - lastMoveT;
                if (dt > 0) scrollVelY = (lastMoveY - cy) / dt;
                lastMoveY = cy;
                lastMoveT = pNow;
                treeModalEl.scrollTop = startModalScroll - dy;
            }
            return;
        }
        if (!panDragged && moveDist > 6) {
            panDragged = true;
            hasPanned = true;
            if (container) container.classList.add('tree-panning');
        }
        if (panDragged) {
            const rect = svg.getBoundingClientRect();
            const scaleX = rect.width > 10 ? (vw / rect.width) : 1;
            const scaleY = rect.height > 10 ? (vh / rect.height) : 1;
            vx = startVx - dx * scaleX;
            vy = startVy - dy * scaleY;
            applyViewBox();
        }
    }, { passive: false });

    shield.addEventListener('touchend', function (e) {
        preventTreeDefault(e);
        const now = Date.now();
        if (now - lastPenTime < 120) return;
        lastTouchEnd = now;
        if (doubleTapToggled) {
            doubleTapToggled = false;
        } else if (isDown && !panDragged && e.changedTouches && e.changedTouches.length === 1) {
            const ex = e.changedTouches[0].clientX;
            const ey = e.changedTouches[0].clientY;
            if (curGestureStartTime > 0) {
                prevGestureStartTime = curGestureStartTime;
                prevGestureStartX = curGestureStartX;
                prevGestureStartY = curGestureStartY;
            }
            prevTapEndTime = now;
            prevTapEndX = ex;
            prevTapEndY = ey;
            selectNodeAt(ex, ey);
        } else if (panDragged && !navActive && treeModalEl && Math.abs(scrollVelY) > 0.15) {
            let v = Math.max(-2.8, Math.min(2.8, scrollVelY)) * 16;
            const step = () => {
                if (!treeModalEl || Math.abs(v) < 0.5) { treeScrollRaf = null; return; }
                const prev = treeModalEl.scrollTop;
                treeModalEl.scrollTop = prev + v;
                if (treeModalEl.scrollTop === prev) { treeScrollRaf = null; return; }
                v *= 0.92;
                treeScrollRaf = requestAnimationFrame(step);
            };
            treeScrollRaf = requestAnimationFrame(step);
        }
        isDown = false;
        pinchDist0 = 0;
        if (container) container.classList.remove('tree-panning');
        setTimeout(() => { panDragged = false; }, 40);
    }, { passive: false });

    shield.addEventListener('touchcancel', function () {
        if (isDown && !panDragged && maxTapMove < 22 && curGestureStartTime > 0) {
            prevGestureStartTime = curGestureStartTime;
            prevGestureStartX = curGestureStartX;
            prevGestureStartY = curGestureStartY;
        }
        doubleTapToggled = false;
        isDown = false;
        pinchDist0 = 0;
        if (container) container.classList.remove('tree-panning');
        panDragged = false;
    }, { passive: false });

    shield.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch') return;
        if (e.button !== undefined && e.button !== 0) return;
        stopTreeScrollMomentum();
        const now = Date.now();
        if (e.pointerType === 'pen') lastPenTime = now;
        const px = e.clientX;
        const py = e.clientY;
        isDown = true;
        panDragged = false;
        maxTapMove = 0;
        startX = px;
        startY = py;
        startVx = vx;
        startVy = vy;
        startModalScroll = treeModalEl ? treeModalEl.scrollTop : 0;
        if (isSecondTap(px, py, now)) {
            doubleTapToggled = true;
            e.preventDefault();
            toggleTreeNavByDoubleTap();
            startVx = vx;
            startVy = vy;
            if (navActive && e.pointerId !== undefined && shield.setPointerCapture) {
                try { shield.setPointerCapture(e.pointerId); } catch (err) { }
            }
            return;
        }
        doubleTapToggled = false;
        curGestureStartTime = now;
        curGestureStartX = px;
        curGestureStartY = py;
        if (navActive) {
            e.preventDefault();
            if (e.pointerId !== undefined && shield.setPointerCapture) {
                try { shield.setPointerCapture(e.pointerId); } catch (err) { }
            }
            applyViewBox();
        } else if (e.pointerType === 'pen') {
            e.preventDefault();
        }
    });

    shield.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch' || !isDown) return;
        if (e.pointerType === 'pen') lastPenTime = Date.now();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const moveDist = Math.hypot(dx, dy);
        if (moveDist > maxTapMove) maxTapMove = moveDist;
        if (moveDist > 22) curGestureStartTime = 0;
        if (!navActive) {
            if (moveDist > 14) panDragged = true;
            if (panDragged && e.pointerType === 'pen' && treeModalEl && treeModalEl.scrollHeight > treeModalEl.clientHeight) {
                treeModalEl.scrollTop = startModalScroll - dy;
            }
            return;
        }
        if (!panDragged && moveDist > 6) {
            panDragged = true;
            hasPanned = true;
            if (container) container.classList.add('tree-panning');
        }
        if (panDragged) {
            const rect = svg.getBoundingClientRect();
            const scaleX = rect.width > 10 ? (vw / rect.width) : 1;
            const scaleY = rect.height > 10 ? (vh / rect.height) : 1;
            vx = startVx - dx * scaleX;
            vy = startVy - dy * scaleY;
            applyViewBox();
        }
    });

    shield.addEventListener('pointerup', function (e) {
        if (e.pointerType === 'touch' || !isDown) return;
        const now = Date.now();
        lastPointerUp = now;
        if (e.pointerType === 'pen') {
            lastPenTime = now;
            e.preventDefault();
            window._kanjiLastModalPenTap = now;
        }
        if (navActive && e.pointerId !== undefined && shield.releasePointerCapture) {
            try { shield.releasePointerCapture(e.pointerId); } catch (err) { }
        }
        if (doubleTapToggled) {
            doubleTapToggled = false;
        } else if (!panDragged && (e.pointerType === 'pen' || now - lastTouchEnd > 350)) {
            if (curGestureStartTime > 0) {
                prevGestureStartTime = curGestureStartTime;
                prevGestureStartX = curGestureStartX;
                prevGestureStartY = curGestureStartY;
            }
            prevTapEndTime = now;
            prevTapEndX = e.clientX;
            prevTapEndY = e.clientY;
            selectNodeAt(e.clientX, e.clientY);
        }
        isDown = false;
        if (container) container.classList.remove('tree-panning');
        setTimeout(() => { panDragged = false; }, 40);
    });

    shield.addEventListener('pointercancel', function (e) {
        if (e.pointerType === 'touch') return;
        if (isDown && !panDragged && maxTapMove < 22 && curGestureStartTime > 0) {
            prevGestureStartTime = curGestureStartTime;
            prevGestureStartX = curGestureStartX;
            prevGestureStartY = curGestureStartY;
        }
        doubleTapToggled = false;
        isDown = false;
        if (container) container.classList.remove('tree-panning');
        panDragged = false;
    });

    shield.addEventListener('click', function (e) {
        e.stopPropagation();
        const now = Date.now();
        if (now - lastTouchEnd < 450 || now - lastPointerUp < 450 || now - lastNavToggleTime < 450) return;
        if (!panDragged) selectNodeAt(e.clientX, e.clientY);
    });
    if (window._kanjiSetupModalTouchGuards) window._kanjiSetupModalTouchGuards();
};
