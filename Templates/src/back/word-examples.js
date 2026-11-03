// --- Word Examples (furigana toggle) ---

(() => {
    const rawWordsEl = document.getElementById('raw-hint-words');
    const targetWordsEl = document.getElementById('formatted-hint-words');
    if (rawWordsEl && targetWordsEl) {
        let words = rawWordsEl.innerHTML.split(/\s*,\s*(?![^\(\)]*\))/);
        // innerHTML is already entity-escaped; keep only furigana/basic formatting tags, attribute-free.
        const _wsafe = s => s.replace(/<(\/?)([a-z]+)\b[^>]*>/gi, (m, sl, tag) => /^(ruby|rb|rt|rp|b|i|u|br)$/i.test(tag) ? '<' + sl + tag.toLowerCase() + '>' : '');
        targetWordsEl.innerHTML = words.map(word => {
            word = word.trim();
            if (!word) return '';
            let match = word.match(/^(.*?)\s*\((.*?)\)$/);
            return match
                ? `<div class="word-example-item tappable"><div class="word-example-info"><div class="word-jp">${_wsafe(match[1])}</div><div class="word-de">${_wsafe(match[2])}</div></div></div>`
                : `<div class="word-example-item tappable"><div class="word-example-info"><div class="word-jp">${_wsafe(word)}</div></div></div>`;
        }).join('');
        targetWordsEl.addEventListener('click', function (e) {
            var item = e.target.closest('.word-example-item');
            if (!item) return;
            if (item.classList.contains('show-furigana')) {
                item.classList.remove('show-furigana');
                item.classList.add('furigana-dismissed');
                _kdSnd('fx', 'furiganaOff');
            } else {
                item.classList.remove('furigana-dismissed');
                item.classList.add('show-furigana');
                _kdSnd('fx', 'furigana');
            }
        });
    }
})();
