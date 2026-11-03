/* KanjiDraw Audio — procedural soundscape (Web Audio API, no audio files)
   · Music from a repertoire of real songs (public-domain Japanese classics
     and original pieces), arranged differently per verse, with ma (silence)
   · The landscape only colours the sound (instruments, room, nature); song,
     key and tempo stay — flipping through cards changes the music only subtly
   · Jo-ha-kyū and learning flow (modelled on Tetris Effect): finished kanji
     build up the arrangement, thinking pauses thin it out; hits answer on the
     beat, fast strokes are merged
   · Stroke sounds per stroke style, subtle UI effects, nature ambience
   The singleton window.__kdAudio survives card changes (Anki Desktop and
   AnkiMobile only replace #qa); on page reloads (AnkiDroid) the song resumes
   at the same position via sessionStorage.

   Modules (order = file name): base → tables → repertoire → runtime →
   graph → samples → instruments → harmony → flow → melody → percussion →
   genres → nature → player → control → fx → strokes → api */

const VERSION = '1.2.0';
const W = window, D = document;
const prior = W.__kdAudio;
if (prior && prior.version === VERSION) return;
if (prior && typeof prior.dispose === 'function') { try { prior.dispose(); } catch (e) { } }
const AC = W.AudioContext || W.webkitAudioContext;
if (!AC) { W.__kdAudio = null; return; }

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const ftom = f => 69 + 12 * Math.log(f / 440) / Math.LN2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const chance = p => Math.random() < p;
const pc = m => ((m % 12) + 12) % 12;
function poisson(l) { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L && k < 40); return k - 1; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
