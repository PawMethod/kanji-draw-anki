// --- Pitfalls ("Häufige Schreibfehler" Sub-Page) ---
// Field grammar: cat@strokes[title]: desc || ...
// Categories with their UI labels: order "Reihenfolge", dir "Strichrichtung", bend "In einem Zug", form "Form & Proportion"

window._kanjiRenderPitfalls = function (rawData, listTarget, padTarget, filterTarget, countBadge, navDesc) {
    const NS = 'http://www.w3.org/2000/svg';
    const CAT_META = {
        order: { label: 'Reihenfolge', color: '#e8625c' },
        dir: { label: 'Strichrichtung', color: '#2aa7e0' },
        bend: { label: 'In einem Zug', color: '#f0a030' },
        form: { label: 'Form & Proportion', color: '#3fbf86' }
    };

    const parseRange = spec => {
        const set = [];
        if (!spec) return set;
        spec.split('+').forEach(part => {
            const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
            if (!m) return;
            const a = parseInt(m[1], 10), b = m[2] ? parseInt(m[2], 10) : a;
            for (let k = Math.min(a, b); k <= Math.max(a, b); k++) {
                if (set.indexOf(k) === -1) set.push(k);
            }
        });
        return set;
    };

    const formatStrokesLabel = strokes => {
        if (!strokes || !strokes.length) return '';
        if (strokes.length === 1) return 'Strich ' + strokes[0];
        let contiguous = true;
        for (let i = 1; i < strokes.length; i++) {
            if (strokes[i] !== strokes[i - 1] + 1) { contiguous = false; break; }
        }
        if (contiguous && strokes.length > 2) return 'Striche ' + strokes[0] + '-' + strokes[strokes.length - 1];
        if (strokes.length === 2) return 'Strich ' + strokes[0] + ' & ' + strokes[1];
        return 'Strich ' + strokes.join(', ');
    };

    const items = rawData.split(/\s*\|\|\s*/).map(chunk => {
        chunk = chunk.trim();
        if (!chunk) return null;
        const m = chunk.match(/^([a-z]+)@([0-9+\-]+)\[(.*?)\]:\s*(.+)$/i);
        if (!m) return null;
        const cat = (m[1] || 'form').toLowerCase();
        const strokeSpec = m[2];
        const strokes = parseRange(strokeSpec);
        return {
            cat: CAT_META[cat] ? cat : 'form',
            strokeSpec: strokeSpec,
            strokes: strokes,
            title: m[3].trim(),
            desc: m[4].trim()
        };
    }).filter(Boolean);

    if (!items.length) return;

    if (countBadge) countBadge.textContent = String(items.length);
    if (navDesc) {
        const cats = [];
        items.forEach(it => {
            const lbl = CAT_META[it.cat].label;
            if (cats.indexOf(lbl) === -1) cats.push(lbl);
        });
        navDesc.textContent = cats.slice(0, 2).join(' · ') + (cats.length > 2 ? ' · +' + (cats.length - 2) : '');
    }

    // Gather reference stroke paths from #svg-bg
    const refPaths = [];
    const srcSvg = document.getElementById('svg-bg');
    if (srcSvg) {
        srcSvg.querySelectorAll('path:not(.gel-halo)').forEach(p => {
            const d = p.getAttribute('d');
            if (d) refPaths.push({ d: d, el: p });
        });
    }

    let activeIdx = 0;
    let activeFilter = 'all';

    const renderPreview = item => {
        if (!padTarget) return;
        padTarget.innerHTML = '';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 109 109');

        // Subtle Kanji grid lines
        const gridG = document.createElementNS(NS, 'g');
        gridG.setAttribute('stroke', 'var(--text-muted)');
        gridG.setAttribute('stroke-opacity', '0.16');
        gridG.setAttribute('stroke-width', '0.8');
        gridG.setAttribute('stroke-dasharray', '3,3');
        const lH = document.createElementNS(NS, 'line');
        lH.setAttribute('x1', '0'); lH.setAttribute('y1', '54.5'); lH.setAttribute('x2', '109'); lH.setAttribute('y2', '54.5');
        const lV = document.createElementNS(NS, 'line');
        lV.setAttribute('x1', '54.5'); lV.setAttribute('y1', '0'); lV.setAttribute('x2', '54.5'); lV.setAttribute('y2', '109');
        gridG.appendChild(lH); gridG.appendChild(lV);
        svg.appendChild(gridG);

        const activeSet = {};
        if (item && item.strokes) item.strokes.forEach(s => { activeSet[s] = true; });
        const hlColor = item ? CAT_META[item.cat].color : '#e8625c';

        // Base strokes first, then highlighted strokes on top
        const baseG = document.createElementNS(NS, 'g');
        const hlG = document.createElementNS(NS, 'g');
        const markerG = document.createElementNS(NS, 'g');

        refPaths.forEach((rp, idx) => {
            const sNum = idx + 1;
            const isHl = !!activeSet[sNum];
            const p = document.createElementNS(NS, 'path');
            p.setAttribute('d', rp.d);
            p.setAttribute('fill', 'none');
            p.setAttribute('stroke-linecap', 'round');
            p.setAttribute('stroke-linejoin', 'round');
            if (isHl) {
                p.setAttribute('stroke', hlColor);
                p.setAttribute('stroke-width', '5.2');
                hlG.appendChild(p);
                // Start dot + direction arrow + stroke number badge
                try {
                    const len = rp.el.getTotalLength();
                    if (len > 2) {
                        const p0 = rp.el.getPointAtLength(0);
                        const p1 = rp.el.getPointAtLength(Math.min(len, Math.max(8, len * 0.32)));
                        const dot = document.createElementNS(NS, 'circle');
                        dot.setAttribute('cx', p0.x.toFixed(1));
                        dot.setAttribute('cy', p0.y.toFixed(1));
                        dot.setAttribute('r', '3.3');
                        dot.setAttribute('fill', hlColor);
                        markerG.appendChild(dot);

                        const dx = p1.x - p0.x, dy = p1.y - p0.y;
                        const dLen = Math.hypot(dx, dy);
                        if (dLen > 3) {
                            const ux = dx / dLen, uy = dy / dLen;
                            const pm = rp.el.getPointAtLength(Math.min(len * 0.55, 22));
                            const tipX = pm.x + ux * 2.5, tipY = pm.y + uy * 2.5;
                            const bx = pm.x - ux * 3.5, by = pm.y - uy * 3.5;
                            const wx = -uy * 3.0, wy = ux * 3.0;
                            const arr = document.createElementNS(NS, 'polygon');
                            arr.setAttribute('points', `${tipX.toFixed(1)},${tipY.toFixed(1)} ${(bx + wx).toFixed(1)},${(by + wy).toFixed(1)} ${(bx - wx).toFixed(1)},${(by - wy).toFixed(1)}`);
                            arr.setAttribute('fill', hlColor);
                            markerG.appendChild(arr);
                        }

                        // Stroke index label offset from start point
                        const nx = Math.max(9, Math.min(100, p0.x - (dx / (dLen || 1)) * 7.5));
                        const ny = Math.max(10, Math.min(100, p0.y - (dy / (dLen || 1)) * 7.5));
                        const numBg = document.createElementNS(NS, 'circle');
                        numBg.setAttribute('cx', nx.toFixed(1));
                        numBg.setAttribute('cy', ny.toFixed(1));
                        numBg.setAttribute('r', '6.2');
                        numBg.setAttribute('fill', 'var(--card-bg)');
                        numBg.setAttribute('stroke', hlColor);
                        numBg.setAttribute('stroke-width', '1.4');
                        markerG.appendChild(numBg);

                        const txt = document.createElementNS(NS, 'text');
                        txt.setAttribute('x', nx.toFixed(1));
                        txt.setAttribute('y', ny.toFixed(1));
                        txt.setAttribute('dy', '0.06em');
                        txt.setAttribute('text-anchor', 'middle');
                        txt.setAttribute('dominant-baseline', 'central');
                        txt.setAttribute('fill', hlColor);
                        txt.setAttribute('font-size', '7.8');
                        txt.setAttribute('font-weight', '800');
                        txt.textContent = String(sNum);
                        markerG.appendChild(txt);
                    }
                } catch (e) { }
            } else {
                p.setAttribute('stroke', 'var(--text-muted)');
                p.setAttribute('stroke-opacity', '0.26');
                p.setAttribute('stroke-width', '3.6');
                baseG.appendChild(p);
            }
        });

        svg.appendChild(baseG);
        svg.appendChild(hlG);
        svg.appendChild(markerG);
        padTarget.appendChild(svg);
    };

    const renderList = () => {
        if (!listTarget) return;
        listTarget.innerHTML = '';
        const visible = items.map((it, idx) => ({ item: it, idx: idx }))
            .filter(entry => activeFilter === 'all' || entry.item.cat === activeFilter);

        if (!visible.some(v => v.idx === activeIdx) && visible.length) {
            activeIdx = visible[0].idx;
        }

        visible.forEach(entry => {
            const it = entry.item;
            const idx = entry.idx;
            const meta = CAT_META[it.cat] || CAT_META.form;
            const card = document.createElement('div');
            card.className = 'pitfall-card tappable' + (idx === activeIdx ? ' active' : '');
            card.setAttribute('data-cat', it.cat);

            const top = document.createElement('div');
            top.className = 'pitfall-card-top';

            const catBadge = document.createElement('span');
            catBadge.className = 'pitfall-cat-badge cat-' + it.cat;
            catBadge.textContent = meta.label;
            top.appendChild(catBadge);

            const strokeLbl = formatStrokesLabel(it.strokes);
            if (strokeLbl) {
                const stBadge = document.createElement('span');
                stBadge.className = 'pitfall-stroke-badge';
                stBadge.textContent = strokeLbl;
                top.appendChild(stBadge);
            }

            const titleEl = document.createElement('div');
            titleEl.className = 'pitfall-title';
            titleEl.textContent = it.title;

            const descEl = document.createElement('div');
            descEl.className = 'pitfall-desc';
            descEl.textContent = it.desc;

            card.appendChild(top);
            card.appendChild(titleEl);
            card.appendChild(descEl);

            card.addEventListener('click', function (e) {
                e.stopPropagation();
                const same = activeIdx === idx;
                activeIdx = idx;
                listTarget.querySelectorAll('.pitfall-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                _kdSnd('fx', same ? 'tick' : 'pitfall', 0, visible.indexOf(entry));
                if (filterTarget) {
                    filterTarget.querySelectorAll('.pitfall-filter-btn').forEach(b => {
                        b.classList.toggle('active', b.getAttribute('data-cat') === it.cat);
                    });
                }
                renderPreview(items[activeIdx]);
            });

            listTarget.appendChild(card);
        });

        renderPreview(items[activeIdx] || items[0]);
        if (window._kanjiSetupModalTouchGuards) window._kanjiSetupModalTouchGuards();
    };

    // Category pills (without "Alle" button; hidden if only 1 category exists)
    if (filterTarget) {
        filterTarget.innerHTML = '';
        const presentCats = [];
        items.forEach(it => { if (presentCats.indexOf(it.cat) === -1) presentCats.push(it.cat); });
        if (presentCats.length <= 1) {
            filterTarget.style.display = 'none';
        } else {
            filterTarget.style.display = '';
            presentCats.forEach((c, ci) => {
                const cnt = items.filter(it => it.cat === c).length;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.setAttribute('data-cat', c);
                btn.className = 'pitfall-filter-btn tappable' + (ci === 0 ? ' active' : '');
                btn.textContent = CAT_META[c].label + ' (' + cnt + ')';
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const firstIdx = items.findIndex(it => it.cat === c);
                    if (firstIdx !== -1) activeIdx = firstIdx;
                    filterTarget.querySelectorAll('.pitfall-filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    renderList();
                });
                filterTarget.appendChild(btn);
            });
        }
    }

    renderList();
};

(() => {
    const rawPitEl = document.getElementById('raw-pitfalls-data');
    const listTarget = document.getElementById('pitfalls-list-target');
    if (!rawPitEl || !listTarget) return;
    let rawPit = rawPitEl.innerHTML.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim();
    if (!rawPit) return;
    try {
        window._kanjiRenderPitfalls(
            rawPit,
            listTarget,
            document.getElementById('pitfalls-preview-pad'),
            document.getElementById('pitfalls-filter-bar'),
            document.getElementById('pitfalls-count-badge'),
            document.getElementById('pitfalls-nav-desc')
        );
    } catch (e) { }
})();
