/* KanjiDraw Audio — prozedurale Klangwelt (Web Audio API, keine Dateien)
   · Musik aus einem Repertoire echter Lieder (gemeinfreie japanische Klassiker
     und eigene Stücke), je Strophe anders arrangiert, mit Ma (Stille)
   · Die Landschaft färbt nur (Instrumente, Raum, Natur); Lied, Tonart und
     Tempo bleiben — schnelles Durchblättern ändert die Musik nur dezent
   · Jo-Ha-Kyū und Lernfluss (nach dem Vorbild von Tetris Effect): fertige
     Kanji steigern das Arrangement, Denkpausen lichten es aus; Treffer
     antworten im Takt, schnelle Striche werden zusammengefasst
   · Strichgeräusche je Strichstil, dezente UI-Effekte, Naturkulisse
   Singleton window.__kdAudio überlebt Kartenwechsel (Anki Desktop und
   AnkiMobile ersetzen nur #qa); bei Seiten-Reloads (AnkiDroid) setzt das Lied
   über sessionStorage an derselben Stelle fort.

   Module (Reihenfolge = Dateiname): base → tables → repertoire → runtime →
   graph → samples → instruments → harmony → flow → melody → percussion →
   genres → nature → player → control → fx → strokes → api */

const VERSION = '1.1.0';
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
