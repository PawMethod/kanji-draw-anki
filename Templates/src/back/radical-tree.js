// --- Radical Tree Renderer ---

(() => {
    const rawDataEl = document.getElementById('raw-tree-data');
    const target = document.getElementById('tree-render-target');
    if (!rawDataEl || !target) return;

    let rawData = rawDataEl.innerHTML.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
    rawData = rawData.replace(/<\/?(?!(?:path|svg|g)\b)[a-z0-9]+[^>]*>/gi, '').trim();
    if (!rawData) return;

    if (window._kanjiTreeOutsideHandler) {
        document.removeEventListener('touchstart', window._kanjiTreeOutsideHandler, true);
        document.removeEventListener('pointerdown', window._kanjiTreeOutsideHandler, true);
        document.removeEventListener('click', window._kanjiTreeOutsideHandler, true);
    }
    window._kanjiTreeOutsideHandler = e => {
        const t = (e.target && e.target.nodeType === 1) ? e.target : (e.target && e.target.parentElement);
        if (!t || !t.closest) return;
        if (!t.closest('.tree-container')) {
            if (window._kanjiSetTreeNavActive) window._kanjiSetTreeNavActive(false);
            if (window._kanjiClearTreeSelection) window._kanjiClearTreeSelection();
        }
    };
    document.addEventListener('touchstart', window._kanjiTreeOutsideHandler, true);
    document.addEventListener('pointerdown', window._kanjiTreeOutsideHandler, true);
    document.addEventListener('click', window._kanjiTreeOutsideHandler, true);
    try {
        window._kanjiRenderPrimitiveTree(rawData, target);
    } catch (e) { target.innerHTML = `<span class="no-tree-data" style="color: var(--stroke-err);">Primitive konnten nicht geladen werden.</span>`; }
})();
