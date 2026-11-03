// --- Hide "Lesungen" if no readings exist ---
(() => {
    const rc = document.querySelector('.readings-container--backside');
    if (rc && !rc.querySelector('.reading-row')) {
        rc.style.display = 'none';
        const prev = rc.previousElementSibling;
        if (prev && prev.classList.contains('info-section-title')) prev.style.display = 'none';
    }
})();
