// Runtime state shared by all modules (swapped wholesale by the offline renderer)

let cfg = { level: 'off', music: 'off', musicLevel: 'mid', stroke: 'on', fx: 'on', immersion: 'low' };
let cur = { theme: 'neutral', dark: false };
let ctx = null, G = null, NB = null, PW = null;      // AudioContext, master graph, noise buffers, periodic waves
let players = [];                                     // one Player per genre; at most two overlap in a crossfade
let timer = null, idleIv = null, disposed = false, loadWait = false;
let OFF = false, TO = null;                           // offline rendering: fixed clock TO instead of ctx.currentTime
let lastAct = 0, SV = null, sTok = 0, lastStyle = 'standard', lastX = 54.5, cBase = 0, lastTick = -1e9;
let NV = 0;                                           // voices scheduled in the current bar (budget, see room())
let SFORCE = null, NOEV = false;                      // tests: force the first song, silence nature events
const SS = 'kdAudioState';

function now() { return TO !== null ? TO : (ctx ? ctx.currentTime : 0); }
function clockMs() { return TO !== null ? TO * 1000 : (W.performance && performance.now ? performance.now() : Date.now()); }
function touch() { lastAct = Date.now(); }
function imm() { return cfg.level === 'off' ? 0 : (IMM[cfg.immersion] || 0); }
function musicOn() { return cfg.level !== 'off' && GENRES.hasOwnProperty(cfg.music); }
function fxOn() { return cfg.level !== 'off' && cfg.fx === 'on'; }
function live() { for (let i = players.length - 1; i >= 0; i--) if (!players[i].ending) return players[i]; return null; }
function room(n) { return NV + n <= 44; }
// resume() rejects on a closed or interrupted context: ignore, the lifecycle code rebuilds it
function wake() { if (!ctx) return; try { const p = ctx.resume(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
