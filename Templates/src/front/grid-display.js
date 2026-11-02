// --- Grid Rendering ---

function updateGridDisplay() {
    const globalConf = getGlobalConfig();
    const type = hostGet('kanjiGridType', globalConf.type);
    const style = hostGet('kanjiGridStyle', globalConf.style);
    const thick = hostGet('kanjiGridThick', globalConf.thick);
    const opac = hostGet('kanjiGridOpac', globalConf.opac);

    const gridBg = document.getElementById('grid-bg');
    if (!gridBg) return;

    let dashValue = "3, 6", thickValue = "0.8", opacityValue = "0.5";
    if (style === 'solid') dashValue = "none";
    if (style === 'dotted') dashValue = "0.05, 5";
    if (thick === 'thin') thickValue = "0.4";
    if (thick === 'thick') thickValue = "1.5";
    if (opac === 'light') opacityValue = "0.25";
    if (opac === 'dark') opacityValue = "0.8";

    gridBg.style.setProperty('--grid-dasharray', dashValue);
    gridBg.style.setProperty('--grid-thickness', thickValue);
    gridBg.style.setProperty('--grid-opacity', opacityValue);

    // Build grid HTML as a string for jank-free single DOM write
    let gridHTML = '';
    const c = 54.5;

    const addSegment = (pathString) => {
        let className = "grid-line", lineCap = "butt";
        if (style === 'dotted') { className += " dotted-linecap"; lineCap = "round"; }
        gridHTML += `<path d="${pathString}" class="${className}" stroke-linecap="${lineCap}" fill="none" />`;
    };

    if (type === 'cross' || type === 'full') {
        addSegment(`M ${c},${c} L ${c},0`); addSegment(`M ${c},${c} L ${c},109`);
        addSegment(`M ${c},${c} L 0,${c}`); addSegment(`M ${c},${c} L 109,${c}`);
    }
    if (type === 'full') {
        addSegment(`M ${c},${c} L 0,0`); addSegment(`M ${c},${c} L 109,0`);
        addSegment(`M ${c},${c} L 0,109`); addSegment(`M ${c},${c} L 109,109`);
    }

    // Single DOM write to avoid layout thrashing
    gridBg.innerHTML = gridHTML;

    refreshSettingsRadios();
}

function updateGridSetting(category, val) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
    safeSetItem(_activeTab + '_kanjiGrid' + category.charAt(0).toUpperCase() + category.slice(1), val);
    if (category === 'type') _updateGridSubOptionsState(val);
    if (_activeTab === _hostCard) updateGridDisplay();
    else refreshSettingsRadios();
}

function _updateGridSubOptionsState(typeVal) {
    var sub = document.getElementById('grid-sub-options');
    if (!sub) return;
    var disabled = typeVal === 'none';
    sub.style.opacity = disabled ? '0.35' : '';
    sub.style.pointerEvents = disabled ? 'none' : '';
}
