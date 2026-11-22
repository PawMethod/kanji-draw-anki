// fork: design switch, second part (D25). In the minimal design the icons of known elements go back to the
// pre-v3 outline icons (the original markup is kept on the element and restored when switching back);
// everything else is restyled by the html.kd-design-minimal block in Styling.css. Runs at the end of the
// front (all markup exists) and, via FrontSide, again on the back.
(function () {
    var GEAR = '<circle cx="12" cy="12" r="3"><' + '/circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"><' + '/path>';
    var ICONS = [
        ['.gear-btn > svg', GEAR],
        ['.settings-main-title > svg', GEAR],
        ['.tag-frequency > svg', '<path d="M18 20V10M12 20V4M6 20V14"><' + '/path>'],
        ['.settings-about-btn > svg', '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"><' + '/path>'],
        ['#button-reveal > svg', '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"><' + '/path><circle cx="12" cy="12" r="3"><' + '/circle>'],
        ['#button-undo > svg', '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"><' + '/path><path d="M22 21H7"><' + '/path><path d="m5 11 9 9"><' + '/path>'],
        ['#button-skip > svg', '<path d="M12 20h9"><' + '/path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"><' + '/path>'],
        ['#button-reset > svg', '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"><' + '/path><path d="M3 3v5h5"><' + '/path>'],
        ['.category-icon.cat-grid > svg', '<path d="M4 6h16M4 12h16M4 18h7"><' + '/path>'],
        ['.category-icon.cat-front > svg', '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"><' + '/path><polyline points="22 4 12 14.01 9 11.01"><' + '/polyline>'],
        ['.category-icon.cat-back > svg', '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"><' + '/rect><path d="M9 18l6-6-6-6" transform="rotate(180 12 12)"><' + '/path>'],
        ['.category-icon.cat-sections > svg', '<rect x="3" y="3" width="7" height="18" rx="1.5"><' + '/rect><rect x="14" y="3" width="7" height="8" rx="1.5"><' + '/rect><rect x="14" y="15" width="7" height="6" rx="1.5"><' + '/rect>'],
        ['#settings-main .category-icon.cat-theme > svg', '<circle cx="12" cy="12" r="10"><' + '/circle><path d="M12 2a10 10 0 0 1 0 20z"><' + '/path>'],
        ['#settings-main .category-icon.cat-sound > svg', '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"><' + '/polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"><' + '/path>'],
        // Danke uses the same category classes as the settings menu, but different actions.
        ['#page-about .cat-theme > svg', '<polygon points="12 3 14.8 8.7 21 9.6 16.5 14 17.6 20.2 12 17.2 6.4 20.2 7.5 14 3 9.6 9.2 8.7"><' + '/polygon>'],
        ['#page-about .cat-sound > svg', '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"><' + '/path><path d="M9.5 8a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5M12 14h.01"><' + '/path>'],
        // fork: the pre-v3 radio artwork remains legible without the pastel fills.
        ['input[name="grid-type"][value="none"] + .visual-option > svg', '<rect x="4" y="4" width="16" height="16" rx="2" stroke-width="1.5" stroke-dasharray="2 2" opacity="0.4" />', "0 0 24 24"],
        ['input[name="grid-type"][value="cross"] + .visual-option > svg', '<rect x="4" y="4" width="16" height="16" rx="2" stroke-width="1.5" stroke-dasharray="2 2" opacity="0.4" /> <path d="M12 4v16M4 12h16" stroke-width="1.5" />', "0 0 24 24"],
        ['input[name="grid-type"][value="full"] + .visual-option > svg', '<rect x="4" y="4" width="16" height="16" rx="2" stroke-width="1.5" stroke-dasharray="2 2" opacity="0.4" /> <path d="M12 4v16M4 12h16M4 4l16 16M4 20L20 4" stroke-width="1.5" />', "0 0 24 24"],
        ['input[name="grid-style"][value="dotted"] + .visual-option > svg', '<path d="M4 12h0.01M8 12h0.01M12 12h0.01M16 12h0.01M20 12h0.01" stroke-width="3" stroke-linecap="round" />', "0 0 24 24"],
        ['input[name="grid-style"][value="dashed"] + .visual-option > svg', '<line x1="2" y1="12" x2="22" y2="12" stroke-width="2" stroke-dasharray="4 4" />', "0 0 24 24"],
        ['input[name="grid-style"][value="solid"] + .visual-option > svg', '<line x1="2" y1="12" x2="22" y2="12" stroke-width="2" />', "0 0 24 24"],
        ['input[name="grid-thick"][value="thin"] + .visual-option > svg', '<line x1="4" y1="12" x2="20" y2="12" stroke-width="1" />', "0 0 24 24"],
        ['input[name="grid-thick"][value="medium"] + .visual-option > svg', '<line x1="4" y1="12" x2="20" y2="12" stroke-width="2.5" />', "0 0 24 24"],
        ['input[name="grid-thick"][value="thick"] + .visual-option > svg', '<line x1="4" y1="12" x2="20" y2="12" stroke-width="4" />', "0 0 24 24"],
        ['input[name="grid-opac"][value="light"] + .visual-option > svg', '<circle cx="12" cy="12" r="6" stroke-width="2" opacity="0.3" />', "0 0 24 24"],
        ['input[name="grid-opac"][value="medium"] + .visual-option > svg', '<circle cx="12" cy="12" r="6" stroke-width="2" opacity="0.6" />', "0 0 24 24"],
        ['input[name="grid-opac"][value="dark"] + .visual-option > svg', '<circle cx="12" cy="12" r="6" stroke-width="2" opacity="1" />', "0 0 24 24"],
        ['input[name="opt-draw-mode"][value="guided"] + .visual-option > svg', '<path d="M5 19Q5 5 20 5" stroke-dasharray="3 2" opacity="0.4" /> <polyline points="15 5 20 5 20 10" /> <path d="M5 19Q7 13 11 10" /> <circle cx="5" cy="19" r="2" fill="currentColor" stroke="none" />', "0 0 24 24"],
        ['input[name="opt-draw-mode"][value="free"] + .visual-option > svg', '<path d="M4 17c3-12 7 8 16-8" /> <circle cx="4" cy="17" r="1.5" fill="currentColor" stroke="none" />', "0 0 24 24"],
        ['input[name="opt-strictness"][value="loose"] + .visual-option > svg', '<path d="M3 12c2-2 4 2 6 0s4 2 6 0 4 2 6 0" />', "0 0 24 24"],
        ['input[name="opt-strictness"][value="normal"] + .visual-option > svg', '<path d="M3 12h18" /> <path d="M3 12c3-1 6 1 9 0s6 1 9 0" opacity="0.3" />', "0 0 24 24"],
        ['input[name="opt-strictness"][value="strict"] + .visual-option > svg', '<circle cx="12" cy="12" r="8" /> <circle cx="12" cy="12" r="4" /> <circle cx="12" cy="12" r="0.5" fill="currentColor" />', "0 0 24 24"],
        ['input[name="opt-color-front"][value="off"] + .visual-option > svg', '<circle cx="12" cy="12" r="10" /> <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />', "0 0 24 24"],
        ['input[name="opt-color-front"][value="on"] + .visual-option > svg', '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /> <polyline points="22 4 12 14.01 9 11.01" />', "0 0 24 24"],
        ['input[name="opt-autodraw"][value="off"] + .visual-option > svg', '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"><' + '/path> <path d="M15 5l4 4"><' + '/path> <line x1="2" y1="2" x2="22" y2="22"><' + '/line>', "0 0 24 24"],
        ['input[name="opt-autodraw"][value="on"] + .visual-option > svg', '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"><' + '/path> <path d="M15 5l4 4"><' + '/path>', "0 0 24 24"],
        ['input[name="opt-celebration"][value="off"] + .visual-option > svg', '<path d="M12 2L14.4 8.26L21.2 9.27L15.45 12.91L16.81 20L12 16.77L7.19 20L8.55 12.91L2.8 9.27L9.6 8.26Z" /> <line x1="4" y1="4" x2="20" y2="20" />', "0 0 24 24"],
        ['input[name="opt-celebration"][value="on"] + .visual-option > svg', '<path d="M12 2L14.4 8.26L21.2 9.27L15.45 12.91L16.81 20L12 16.77L7.19 20L8.55 12.91L2.8 9.27L9.6 8.26Z" />', "0 0 24 24"],
        ['input[name="opt-color-back"][value="off"] + .visual-option > svg', '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.2-.7-.4-1-.2-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-5.5-4.5-9.5-10-9.5z" /> <path d="M9.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" /> <path d="M14.5 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" /> <path d="M18.5 11a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" /> <line x1="3" y1="3" x2="21" y2="21" />', "0 0 24 24"],
        ['input[name="opt-color-back"][value="on"] + .visual-option > svg', '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.2-.7-.4-1-.2-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-5.5-4.5-9.5-10-9.5z" /> <path d="M9.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" fill="currentColor" /> <path d="M14.5 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" fill="currentColor" /> <path d="M18.5 11a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" fill="currentColor" />', "0 0 24 24"],
        ['input[name="opt-numbers"][value="off"] + .visual-option > svg', '<path d="M8 16 L32 16" /> <path d="M20 6 L20 34" /> <path d="M20 16 Q 15 22 6 34" /> <path d="M20 16 Q 25 22 34 34" />', "-6 -2 54 46"],
        ['input[name="opt-numbers"][value="on"] + .visual-option > svg', '<path d="M8 16 L32 16" /> <path d="M20 6 L20 34" /> <path d="M20 16 Q 15 22 6 34" /> <path d="M20 16 Q 25 22 34 34" /> <text x="2" y="14" font-size="10" stroke="none" fill="currentColor" font-weight="900" font-family="sans-serif" text-anchor="middle">1<' + '/text> <text x="28" y="5" font-size="10" stroke="none" fill="currentColor" font-weight="900" font-family="sans-serif" text-anchor="middle">2<' + '/text> <text x="-1" y="39" font-size="10" stroke="none" fill="currentColor" font-weight="900" font-family="sans-serif" text-anchor="middle">3<' + '/text> <text x="41" y="39" font-size="10" stroke="none" fill="currentColor" font-weight="900" font-family="sans-serif" text-anchor="middle">4<' + '/text>', "-6 -2 54 46"],
        ['input[name="opt-side-by-side"][value="off"] + .visual-option > svg', '<rect x="3" y="3" width="18" height="18" rx="2" /> <line x1="4" y1="4" x2="20" y2="20" />', "0 0 24 24"],
        ['input[name="opt-side-by-side"][value="on"] + .visual-option > svg', '<rect x="2" y="3" width="9" height="18" rx="2" /> <rect x="13" y="3" width="9" height="18" rx="2" />', "0 0 24 24"],
        ['input[name="opt-free-view"][value="handwriting"] + .visual-option > svg', '<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" />', "0 0 24 24"],
        ['input[name="opt-free-view"][value="svg"] + .visual-option > svg', '<polyline points="3 17 8 8 13 14 18 6 21 10" /> <circle cx="3" cy="17" r="1.5" fill="currentColor" /> <circle cx="21" cy="10" r="1.5" fill="currentColor" />', "0 0 24 24"],
        ['input[name="opt-display-style"][value="standard"] + .visual-option > svg', '<path d="M8 16 L32 16" /> <path d="M20 6 L20 34" /> <path d="M20 16 Q 15 22 6 34" /> <path d="M20 16 Q 25 22 34 34" />', "0 0 40 40"],
        ['input[name="opt-display-style"][value="colorOrder"] + .visual-option > svg', '<path d="M8 16 L32 16" opacity="1" /> <path d="M20 6 L20 34" opacity="0.7" /> <path d="M20 16 Q 15 22 6 34" opacity="0.45" /> <path d="M20 16 Q 25 22 34 34" opacity="0.25" />', "0 0 40 40"],
        ['input[name="opt-handwriting"][value="off"] + .visual-option > svg', '<path d="M16.6273 25.9196C16.2554 24.9936 15.5764 24.227 14.7065 23.7512C13.8366 23.2753 12.8299 23.1197 11.8589 23.3111C10.8879 23.5025 10.0131 24.029 9.38411 24.8003C8.75517 25.5716 8.41131 26.5399 8.41143 27.5391C8.41143 27.9815 8.32148 28.4192 8.14716 28.825C7.97283 29.2308 7.71785 29.5961 7.39801 29.8983C7.07817 30.2005 6.7003 30.4331 6.2878 30.5818C5.87531 30.7304 5.43698 30.7919 5 30.7624C5.70282 31.9956 6.78905 32.96 8.09007 33.5058C9.39109 34.0516 10.8341 34.1483 12.1951 33.7809C13.5561 33.4135 14.759 32.6025 15.6169 31.4739C16.4749 30.3453 16.94 28.9621 16.94 27.5391C16.94 26.9663 16.8291 26.4192 16.6273 25.9196ZM16.6273 25.9196C18.3174 25.338 19.9338 24.5573 21.4431 23.5937M14.2748 23.5578C14.8508 21.847 15.6247 20.2109 16.5804 18.6834M21.4417 23.5937C24.1372 21.8735 26.4443 19.5998 28.2133 16.9203L33.7228 8.5729C33.9338 8.25497 34.0291 7.87289 33.9923 7.49191C33.9554 7.11094 33.7888 6.75469 33.5208 6.48402C33.2528 6.21335 32.9001 6.04504 32.523 6.00783C32.1458 5.97062 31.7675 6.06682 31.4528 6.28001L23.1886 11.8464C20.5355 13.6327 18.284 15.9626 16.5804 18.6849"/> <path d="M7 7L33.6667 33.6667"/>', "0 0 40 40"],
        ['input[name="opt-handwriting"][value="on"] + .visual-option > svg', '<path d="M16.6273 25.9196C16.2554 24.9936 15.5764 24.227 14.7065 23.7512C13.8366 23.2753 12.8299 23.1197 11.8589 23.3111C10.8879 23.5025 10.0131 24.029 9.38411 24.8003C8.75517 25.5716 8.41131 26.5399 8.41143 27.5391C8.41143 27.9815 8.32148 28.4192 8.14716 28.825C7.97283 29.2308 7.71785 29.5961 7.39801 29.8983C7.07817 30.2005 6.7003 30.4331 6.2878 30.5818C5.87531 30.7304 5.43698 30.7919 5 30.7624C5.70282 31.9956 6.78905 32.96 8.09007 33.5058C9.39109 34.0516 10.8341 34.1483 12.1951 33.7809C13.5561 33.4135 14.759 32.6025 15.6169 31.4739C16.4749 30.3453 16.94 28.9621 16.94 27.5391C16.94 26.9663 16.8291 26.4192 16.6273 25.9196ZM16.6273 25.9196C18.3174 25.338 19.9338 24.5573 21.4431 23.5937M14.2748 23.5578C14.8508 21.847 15.6247 20.2109 16.5804 18.6834M21.4417 23.5937C24.1372 21.8735 26.4443 19.5998 28.2133 16.9203L33.7228 8.5729C33.9338 8.25497 34.0291 7.87289 33.9923 7.49191C33.9554 7.11094 33.7888 6.75469 33.5208 6.48402C33.2528 6.21335 32.9001 6.04504 32.523 6.00783C32.1458 5.97062 31.7675 6.06682 31.4528 6.28001L23.1886 11.8464C20.5355 13.6327 18.284 15.9626 16.5804 18.6849"/>', "0 0 40 40"],
        ['input[name="opt-numbers-c2f"][value="off"] + .visual-option > svg', '<path d="M8 16 L32 16" /> <path d="M20 6 L20 34" /> <path d="M20 16 Q 15 22 6 34" /> <path d="M20 16 Q 25 22 34 34" />', "-6 -2 54 46"],
        ['input[name="opt-numbers-c2f"][value="on"] + .visual-option > svg', '<path d="M8 16 L32 16" /> <path d="M20 6 L20 34" /> <path d="M20 16 Q 15 22 6 34" /> <path d="M20 16 Q 25 22 34 34" /> <text x="2" y="14" font-size="10" stroke="none" fill="currentColor" font-weight="900" font-family="sans-serif" text-anchor="middle">1<' + '/text> <text x="28" y="5" font-size="10" stroke="none" fill="currentColor" font-weight="900" font-family="sans-serif" text-anchor="middle">2<' + '/text> <text x="-1" y="39" font-size="10" stroke="none" fill="currentColor" font-weight="900" font-family="sans-serif" text-anchor="middle">3<' + '/text> <text x="41" y="39" font-size="10" stroke="none" fill="currentColor" font-weight="900" font-family="sans-serif" text-anchor="middle">4<' + '/text>', "-6 -2 54 46"],
        ['input[name="opt-display-style-c2f"][value="standard"] + .visual-option > svg', '<path d="M8 16 L32 16" /> <path d="M20 6 L20 34" /> <path d="M20 16 Q 15 22 6 34" /> <path d="M20 16 Q 25 22 34 34" />', "0 0 40 40"],
        ['input[name="opt-display-style-c2f"][value="colorOrder"] + .visual-option > svg', '<path d="M8 16 L32 16" opacity="1" /> <path d="M20 6 L20 34" opacity="0.7" /> <path d="M20 16 Q 15 22 6 34" opacity="0.45" /> <path d="M20 16 Q 25 22 34 34" opacity="0.25" />', "0 0 40 40"],
        ['input[name="theme-mode"][value="system"] + .visual-option > svg', '<rect x="6" y="8" width="28" height="20" rx="3"><' + '/rect> <path d="M14 32h12"><' + '/path> <path d="M20 28v4"><' + '/path>', "0 0 40 40"],
        ['input[name="theme-mode"][value="light"] + .visual-option > svg', '<circle cx="20" cy="20" r="6"><' + '/circle> <path d="M20 8v-2M20 34v-2M8 20H6M34 20h-2M11.8 11.8l-1.4-1.4M29.6 29.6l-1.4-1.4M28.2 11.8l1.4-1.4M10.4 29.6l1.4-1.4"> <' + '/path>', "0 0 40 40"],
        ['input[name="theme-mode"][value="dark"] + .visual-option > svg', '<path d="M28 24.5A10 10 0 1 1 15.5 12a8 8 0 0 0 12.5 12.5Z"><' + '/path>', "0 0 40 40"],
        ['input[name="theme-font-size"][value="small"] + .visual-option > svg', '<text x="20" y="26" text-anchor="middle" fill="currentColor" stroke="none" font-size="14" font-weight="700">Aa<' + '/text>', "0 0 40 40"],
        ['input[name="theme-font-size"][value="normal"] + .visual-option > svg', '<text x="20" y="27" text-anchor="middle" fill="currentColor" stroke="none" font-size="18" font-weight="700">Aa<' + '/text>', "0 0 40 40"],
        ['input[name="theme-font-size"][value="large"] + .visual-option > svg', '<text x="20" y="28" text-anchor="middle" fill="currentColor" stroke="none" font-size="22" font-weight="700">Aa<' + '/text>', "0 0 40 40"],
        ['input[name="theme-stroke-style"][value="standard"] + .visual-option > svg', '<path d="M8 32 Q14 10 20 18 Q26 26 32 8"><' + '/path>', "0 0 40 40"],
        ['input[name="theme-stroke-style"][value="gel"] + .visual-option > svg', '<path d="M8 32 Q14 10 20 18 Q26 26 32 8" stroke-width="8" opacity="0.12"><' + '/path> <path d="M8 32 Q14 10 20 18 Q26 26 32 8" stroke-width="4"><' + '/path>', "0 0 40 40"],
        ['input[name="theme-stroke-style"][value="ink"] + .visual-option > svg', '<path d="M8 32 Q13 12 18 18 Q23 24 28 10 L32 8" stroke-dasharray="2 1"><' + '/path>', "0 0 40 40"],
        ['input[name="theme-stroke-style"][value="neon"] + .visual-option > svg', '<path d="M8 32 Q14 10 20 18 Q26 26 32 8"><' + '/path>', "0 0 40 40"]
    ];

    window._kdApplyDesign = function (design) {
        var R = document.documentElement;
        if (design) window._kdDesign = design;
        var min = window._kdDesign === 'minimal';
        R.classList.toggle('kd-design-minimal', min);
        ICONS.forEach(function (p) {
            document.querySelectorAll(p[0]).forEach(function (svg) {
                if (min) {
                    if (svg._kdOrig == null) {
                        svg._kdOrig = svg.innerHTML;
                        svg._kdOrigViewBox = svg.getAttribute('viewBox');
                    }
                    svg.innerHTML = p[1];
                    if (p[2]) svg.setAttribute('viewBox', p[2]);
                } else if (svg._kdOrig != null) {
                    svg.innerHTML = svg._kdOrig;
                    if (svg._kdOrigViewBox == null) svg.removeAttribute('viewBox');
                    else svg.setAttribute('viewBox', svg._kdOrigViewBox);
                    svg._kdOrig = null;
                    svg._kdOrigViewBox = null;
                }
            });
        });
        if (window._kdSectionIcons) window._kdSectionIcons();
    };

    // Keep html.kd-accent-plain in sync when the accent changes (wraps upstream's updateThemeSetting, which
    // every accent radio calls; re-wrapped on each render because the front script redefines it)
    var syncAccent = function () {
        var a = 'green';
        try { a = safeGetItem('kanjiThemeAccent', getGlobalConfig().themeAccent || 'green'); } catch (e) { }
        document.documentElement.classList.toggle('kd-accent-plain', a === 'plain');
    };
    if (typeof updateThemeSetting === 'function' && !updateThemeSetting._kdWrapped) {
        var orig = updateThemeSetting;
        window.updateThemeSetting = function (category) {
            if (category === 'accent') try { safeSetItem('kanjiThemeAccent', arguments[1]); syncAccent(); } catch (e) { }
            return orig.apply(this, arguments);
        };
        window.updateThemeSetting._kdWrapped = true;
    }
    syncAccent();

    window.kdSetDesign = function (val) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
        try { safeSetItem('kanjiThemeDesign', val); } catch (e) { }
        window._kdApplyDesign(val);
    };

    window._kdApplyDesign();
})();
