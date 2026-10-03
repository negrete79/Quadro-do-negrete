/* ============================================================
   FASES DA LUA — app.js  (v7)
   Lua realista + tabelas de Meeus + hemisfério sul + Plantio
   + Madeira + Clima + Instalação/Diagnóstico
   ============================================================ */
'use strict';

/* ---------- Constantes ---------- */
const SINODICO = 29.530588853;
const J2000    = Date.UTC(2000, 0, 1, 12);
const NOVA_REF = Date.UTC(2000, 0, 6, 18, 14);
const RAD = Math.PI / 180;
const DIA = 86400000;
const H0  = 0.125 * RAD;   // altitude geocêntrica do nascer/pôr (refração+semi-diâmetro−paralaxe)

const FASES = [
  { nome: 'Lua nova',              emoji: '🌑' },
  { nome: 'Lua crescente côncava', emoji: '🌒' },
  { nome: 'Quarto crescente',      emoji: '🌓' },
  { nome: 'Lua crescente convexa', emoji: '🌔' },
  { nome: 'Lua cheia',             emoji: '🌕' },
  { nome: 'Lua minguante convexa', emoji: '🌖' },
  { nome: 'Quarto minguante',      emoji: '🌗' },
  { nome: 'Lua minguante côncava', emoji: '🌘' }
];

const SIGNOS = [
  ['Ar.', '♈'], ['To.', '♉'], ['Gm.', '♊'], ['Cn.', '♋'],
  ['Le.', '♌'], ['Vi.', '♍'], ['Li.', '♎'], ['Es.', '♏'],
  ['Sg.', '♐'], ['Cp.', '♑'], ['Aq.', '♒'], ['Pe.', '♓']
];

/* ---------- Estado ---------- */
let LOCAL = null;
try { LOCAL = JSON.parse(localStorage.getItem('fdl_local') || 'null'); } catch (_) {}
let sulAtual = true; // Brasil por padrão; GPS ajusta depois

const $ = id => document.getElementById(id);

/* ================= TOAST ================= */
function mostrarToast(msg, ms = 4500) {
  const t = document.createElement('div');
  t.id = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/* ============================================================
   ASTRONOMIA — posição da Lua pelas tabelas de Meeus (cap. 47)
   Precisão: longitude/latitude ±0.01°, distância ±poucos km
   ============================================================ */
const norm = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
const diasJ2000 = ms => (ms - J2000) / DIA;

/* Tabela 47.A — longitude (1e-6 grau) e distância (1e-3 km) [cos/sin] */
const TAB_LON = [
[6288774,0,0,1,0],[1274027,2,0,-1,0],[658314,2,0,0,0],[213618,0,0,2,0],
[-185116,0,1,0,0],[-114332,0,0,0,2],[58793,2,0,-2,0],[57066,2,-1,-1,0],
[53322,2,0,1,0],[45758,2,-1,0,0],[-40923,0,1,-1,0],[-34720,1,0,0,0],
[-30383,0,1,1,0],[15327,2,0,0,-2],[-12528,0,0,1,2],[10980,0,0,1,-2],
[10675,4,0,-1,0],[10034,0,0,3,0],[8548,4,0,-2,0],[-7888,2,1,-1,0],
[-6766,2,1,0,0],[-5163,1,0,-1,0],[4987,1,1,0,0],[4036,2,-1,1,0],
[3994,2,0,2,0],[3861,4,0,0,0],[3665,2,0,-3,0],[-2689,0,1,-2,0],
[-2602,2,0,-1,2],[2390,2,-1,-2,0],[-2348,1,0,1,0],[2236,2,-2,0,0],
[-2120,0,1,2,0],[-2069,0,2,0,0],[2048,2,-2,-1,0],[-1773,2,0,1,-2],
[-1595,2,0,0,2],[1215,4,-1,-1,0],[-1110,0,0,2,2],[-892,3,0,-1,0],
[-810,2,1,1,0],[759,4,-1,-2,0],[-713,0,2,-1,0],[-700,2,2,-1,0],
[691,2,1,-2,0],[596,2,-1,0,-2],[549,4,0,1,0],[537,0,0,4,0],
[520,4,-1,0,0],[-487,1,0,-2,0],[-399,2,1,0,-2],[-381,0,0,2,-2],
[351,1,1,1,0],[-340,3,0,-2,0],[330,4,0,-3,0],[327,2,-1,2,0],
[-323,0,2,1,0],[299,1,1,-1,0],[294,2,0,3,0]];

/* Tabela 47.B — latitude (1e-6 grau) */
const TAB_LAT = [
[5128122,0,0,0,1],[280602,0,0,1,1],[277693,0,0,1,-1],[173237,2,0,0,-1],
[55413,2,0,-1,-1],[46271,2,0,-1,1],[32573,2,0,0,1],[17198,0,0,2,1],
[9266,0,0,2,-1],[8822,2,-1,0,-1],[8216,2,0,-2,-1],[4324,2,0,-2,1],
[4200,2,-1,0,1],[-3359,2,1,0,-1],[2463,2,-1,-1,1],[2211,2,-1,0,0],
[2065,0,1,-1,-1],[-1870,0,1,0,1],[1828,0,1,-1,1],[-1794,0,1,0,-1],
[-1749,0,1,1,-1],[-1565,1,0,0,-1],[-1491,0,2,1,0],[-1475,0,0,-1,1]??0];

/* Tabela Σr — distância (1e-3 km, cossenos) */
const TAB_DIST = [
[-20905355,0,0,1,0],[-3699111,2,0,-1,0],[-2955968,2,0,0,0],[-569925,0,0,2,0],
[48888,0,1,0,0],[-3149,0,0,0,2],[246158,2,0,-2,0],[-152138,2,-1,-1,0],
[-170733,2,0,1,0],[-204586,2,-1,0,0],[-129620,0,1,-1,0],[108743,1,0,0,0],
[104755,0,1,1,0],[10321,2,0,0,-2],[79661,0,0,1,-2],[-34782,4,0,-1,0],
[-23210,0,0,3,0],[-21636,4,0,-2,0],[24208,2,1,-1,0],[30824,2,1,0,0],
[-8379,1,0,-1,0],[-16675,1,1,0,0],[-12831,2,-1,1,0],[-10445,2,0,2,0],
[-11650,4,0,0,0],[14403,2,0,-3,0],[-7003,0,1,-2,0],[10056,2,-1,-2,0],
[6322,1,0,1,0],[-9884,2,-2,0,0],[5750,0,1,2,0]];

function argumentosLua(date) {
  const T = diasJ2000(date.getTime()) / 36525;
  return {
    Lp: (218.3164477 + 481267.88123421 * T) * RAD,
    D:  (297.8501921 + 445267.1114034 * T) * RAD,
    M:  (357.5291092 + 35999.0502909 * T) * RAD,
    Mp: (134.9633964 + 477198.8675055 * T) * RAD,
    F:  (93.2720950  + 483202.0175233 * T) * RAD,
    A1: (119.75 + 131.849   * T) * RAD,
    A2: (53.09  + 479264.290 * T) * RAD,
    A3: (313.45 + 481266.484 * T) * RAD
  };
}

function posicaoLua(date) {
  const { Lp, D, M, Mp, F, A1, A2, A3 } = argumentosLua(date);
  let sl = 0, sb = 0, sr = 0;
  for (const [c, d, m, mp, f] of TAB_LON)  sl += c * Math.sin(d * D + m * M + mp * Mp + f * F);
  for (const [c, d, m, mp, f] of TAB_LAT)  sb += c * Math.sin(d * D + m * M + mp * Mp + f * F);
  for (const [c, d, m, mp, f] of TAB_DIST) sr += c * Math.cos(d * D + m * M + mp * Mp + f * F);
  sl += 3958 * Math.sin(A1) + 1962 * Math.sin(Lp - F) + 318 * Math.sin(A2);
  sb += -2235 * Math.sin(Lp) + 382 * Math.sin(A3) + 175 * Math.sin(A1 - F)
      + 175 * Math.sin(A1 + F) + 127 * Math.sin(Lp - Mp) - 115 * Math.sin(Lp + Mp);

  const lon  = norm(Lp + sl * 1e-6 * RAD);   // longitude eclíptica
  const lat  = sb * 1e-6 * RAD;              // latitude eclíptica
  const dist = 385000.56 + sr / 1000;        // km — bate com apps de referência

  const eps = 23.4392911 * RAD;
  const ra  = norm(Math.atan2(Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps), Math.cos(lon)));
  const dec = Math.asin(Math.sin(lat) * Math.cos(eps) + Math.cos(lat) * Math.sin(eps) * Math.sin(lon));
  return { lon, lat, ra, dec, dist };
}

function longitudeSolar(date) {
  const T = diasJ2000(date.getTime()) / 36525;
  const L0 = (280.46646 + 36000.76983 * T) * RAD;
  const M  = (357.52911 + 35999.05029 * T) * RAD;
  const C  = (1.914602 * Math.sin(M) + 0.019993 * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M)) * RAD;
  return norm(L0 + C);
}

function idadeLua(date = new Date()) {
  const a = diasJ2000(date.getTime() - NOVA_REF) % SINODICO;
  return a < 0 ? a + SINODICO : a;
}

/* Fase real: iluminação pela elongação Sol–Lua + direção (crescente/minguante) */
function faseAgora(date = new Date()) {
  const lua = posicaoLua(date);
  const E = norm(lua.lon - longitudeSolar(date)); // elongação
  return {
    k: (1 - Math.cos(E)) / 2,       // fração iluminada (0..1)
    waxing: E < Math.PI,            // true = crescente
    E,
    idade: idadeLua(date),
    dist: lua.dist
  };
}

function gmstRad(date) {
  return norm((280.46061837 + 360.98564736629 * diasJ2000(date.getTime())) * RAD);
}

function altitudeLua(date, lat, lon) {
  const { ra, dec } = posicaoLua(date);
  const H = gmstRad(date) + lon * RAD - ra;
  const fi = lat * RAD;
  return Math.asin(Math.sin(fi) * Math.sin(dec) + Math.cos(fi) * Math.cos(dec) * Math.cos(H));
}

function interpolar(t1, t2, a1, a2) {
  const f = a1 / (a1 - a2);
  return new Date(t1.getTime() + f * (t2.getTime() - t1.getTime()));
}

/* Nascer/pôr: janela de 3 dias, passo 5 min, primeiro evento a partir de agora */
function nascerESePorLua(lat, lon) {
  const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
  const passo = 5 * 60000;
  const passos = 3 * 24 * 12;
  const subidas = [], descidas = [];
  let a1 = altitudeLua(inicio, lat, lon) - H0;
  for (let i = 1; i <= passos; i++) {
    const t = new Date(inicio.getTime() + i * passo);
    const a2 = altitudeLua(t, lat, lon) - H0;
    if (a1 < 0 && a2 >= 0) subidas.push(interpolar(new Date(t - passo), t, a1, a2));
    if (a1 >= 0 && a2 < 0) descidas.push(interpolar(new Date(t - passo), t, a1, a2));
    a1 = a2;
  }
  const agora = new Date();
  const prox = arr => arr.find(d => d > agora) || null;
  return { nascer: prox(subidas), sePor: prox(descidas) };
}

/* ================= LOCALIZAÇÃO ================= */
function refLocal() {
  if (LOCAL && LOCAL.lat != null) return LOCAL;
  const offH = -new Date().getTimezoneOffset() / 60;
  return { lat: -15, lon: offH * 15, cidade: '', aproximado: true };
}

/* ============================================================
   LUA REALISTA (SVG) — corpo estático montado 1x + sombra dinâmica
   ============================================================ */
const CIRCULO_P = r => `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`;

/* Caminho da região ILUMINADA (convenção hemisfério norte).
   No sul aplicamos espelho scale(-1,1) só na sombra. */
function caminhoLit(k, waxing, r) {
  k = Math.min(1, Math.max(0, k));
  const xw = r * (1 - 2 * k); // semi-eixo do terminador
  const ax = Math.abs(xw).toFixed(2);
  if (waxing)
    return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${ax} ${r} 0 0 ${xw > 0 ? 0 : 1} 0 ${-r} Z`;
  return `M 0 ${-r} A ${r} ${r} 0 0 0 0 ${r} A ${ax} ${r} 0 0 ${xw > 0 ? 1 : 0} 0 ${-r} Z`;
}

/* "Mares" lunares aproximados (x, y, rx, ry, opacidade) */
const MARIA = [
  [-25,-45,30,23,.50],[35,-45,21,18,.45],[45,-15,21,17,.45],[72,-33,12,10,.50],
  [60,10,14,12,.40],[42,24,11,9,.35],[-52,-8,24,34,.42],[-50,35,13,11,.45],
  [-25,30,15,12,.40],[-30,6,11,9,.30],[8,-58,10,8,.25],[15,40,9,8,.25]
];
const CRATERAS = [
  [-45,-25,20,.16],[-28,-48,13,.13],[8,-58,9,.10],[38,-32,15,.15],
  [58,6,11,.13],[22,22,23,.17],[-14,38,17,.14],[-52,26,9,.11],
  [12,62,13,.12],[48,48,8,.11],[-4,-6,8,.13],[-62,-46,6,.09],
  [64,-42,7,.09],[26,-12,6,.11],[-32,6,5,.11],[40,20,7,.12]
];

function svgEstrutura() {
  const r = 100;
  const maria = MARIA.map(([x, y, rx, ry, o]) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#565b63" opacity="${o}"/>`).join('');
  const crateras = CRATERAS.map(([x, y, cr, o]) =>
    `<circle cx="${x}" cy="${y}" r="${cr}" fill="rgba(30,28,22,${(o * .55).toFixed(2)})"/>` +
    `<circle cx="${x - cr * .3}" cy="${y - cr * .3}" r="${(cr * .5).toFixed(1)}" fill="rgba(255,255,245,${(o * .35).toFixed(2)})"/>`).join('');
  return `<defs>
    <radialGradient id="gLua" cx="42%" cy="40%" r="72%">
      <stop offset="0%" stop-color="#f2efe4"/><stop offset="45%" stop-color="#cfccbf"/>
      <stop offset="80%" stop-color="#a8a496"/><stop offset="100%" stop-color="#8b8779"/>
    </radialGradient>
    <radialGradient id="gLimbo" cx="50%" cy="50%" r="50%">
      <stop offset="72%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(5,8,14,.45)"/>
    </radialGradient>
    <radialGradient id="gBrilho" cx="50%" cy="50%" r="50%">
      <stop offset="62%" stop-color="rgba(255,255,240,0)"/>
      <stop offset="93%" stop-color="rgba(255,255,235,.14)"/>
      <stop offset="100%" stop-color="rgba(255,255,235,0)"/>
    </radialGradient>
    <clipPath id="clipLua"><circle r="${r}"/></clipPath>
    <filter id="fB4" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4.5"/></filter>
    <filter id="fB1" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.4"/></filter>
    <filter id="fRuido" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="4" seed="7"/>
      <feColorMatrix type="matrix" values="0 0 0 0 .55  0 0 0 0 .55  0 0 0 0 .58  .9 .9 .9 0 -1.1"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="fGrao" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="3"/>
      <feColorMatrix type="matrix" values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  .5 .5 .5 0 -.6"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
  </defs>
  <circle r="${r + 9}" fill="url(#gBrilho)"/>
  <circle r="${r}" fill="#0b0d12"/>
  <g clip-path="url(#clipLua)">
    <circle r="${r}" fill="url(#gLua)"/>
    <g filter="url(#fB4)">${maria}
      <circle cx="-8" cy="68" r="3.5" fill="#d9d6c8" opacity=".55"/>
      <circle cx="-38" cy="-12" r="3" fill="#d9d6c8" opacity=".5"/>
    </g>
    <circle r="${r - 1}" fill="#000" filter="url(#fRuido)" opacity=".33"/>
    <circle r="${r - 1}" fill="#000" filter="url(#fGrao)" opacity=".22"/>
    <g opacity=".8">${crateras}</g>
    <circle r="${r}" fill="url(#gLimbo)"/>
    <path id="sombraP" d="" fill="#04060a" fill-opacity=".93" fill-rule="evenodd" filter="url(#fB1)"/>
  </g>
  <circle r="${r}" fill="none" stroke="rgba(255,255,255,.05)"/>`;
}

let luaMontada = false;
function montarLua() {
  if (!luaMontada) { $('luaSvg').innerHTML = svgEstrutura(); luaMontada = true; }
}
function desenharFase(k, waxing, sul) {
  montarLua();
  const p = $('sombraP');
  p.setAttribute('d', CIRCULO_P(100) + ' ' + caminhoLit(k, waxing, 100));
  p.setAttribute('transform', sul ? 'scale(-1 1)' : '');
}
/* f = fração do ciclo (0..1) usado na prévia/arraste */
function desenharLua(f) {
  const fN = ((f % 1) + 1) % 1;
  desenharFase((1 - Math.cos(2 * Math.PI * fN)) / 2, fN < 0.5, sulAtual);
}

/* ================= TELA LUA ================= */
function fmtHora(d) {
  if (!d) return '—';
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m} ${h < 12 ? 'manhã' : h < 18 ? 'tarde' : 'noite'}`;
}

function atualizarCeu() {
  const agora = new Date();
  $('relogio').textContent = agora.toLocaleTimeString('pt-BR', { hour12: false });
  $('dataAtual').textContent = agora.toLocaleDateString('pt-BR',
    { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function grupoFase(idx) { return idx === 0 ? 'nova' : idx < 4 ? 'crescente' : idx === 4 ? 'cheia' : 'minguante'; }

function atualizarLua() {
  const agora = new Date();
  const { k, waxing, E, idade, dist } = faseAgora(agora);
  const idx = Math.floor(norm(E) / (Math.PI / 4) + 0.5) % 8;
  const F = FASES[idx];
  faseReal = idade / SINODICO;

  sulAtual = (refLocal().lat ?? 0) < 0; // hemisfério sul espelha a fase

  $('iluminacao').textContent = Math.round(k * 100) + '%';
  $('distancia').textContent =
    dist.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km';
  $('idade').textContent = `${Math.floor(idade)} dias`;

  const lua = posicaoLua(agora);
  const si = Math.floor(norm(lua.lon) / (Math.PI / 6)) % 12;
  const s = SIGNOS[si], n = SIGNOS[(si + 1) % 12];
  $('sinal').innerHTML = `${s[0]} ${s[1]} → ${n[0]} ${n[1]}`;

  const interagindo = faseVisual !== null || rafAnim !== null || ponteiros.size > 0;
  if (!interagindo) {
    desenharFase(k, waxing, sulAtual);
    $('nomeFase').textContent = F.nome;
  }

  const loc = refLocal();
  const { nascer, sePor } = nascerESePorLua(loc.lat, loc.lon);
  const amanha = d => d && d.getDate() !== agora.getDate() ? ' · amanhã' : '';
  $('nascer').textContent = fmtHora(nascer) + amanha(nascer);
  $('sePor').textContent  = fmtHora(sePor) + amanha(sePor);
  $('avisoLocal').textContent = loc.aproximado
    ? '📍 Localização aproximada — ative o GPS na aba Clima para precisão.' : '';

  const g = grupoFase(idx);
  document.querySelectorAll('[data-fase-card]')
    .forEach(el => el.classList.toggle('agora', el.dataset.faseCard === g));

  const av = idx >= 5 ? 'otimo' : idx === 0 ? 'bom' : 'ruim';
  const m = MADEIRA[av];
  $('madeiraStatus').innerHTML =
    `<div class="status-madeira" style="border-color:${m.cor}">
       <div class="status-top"><span class="status-icone">${m.icone}</span>
       <b style="color:${m.cor}">${m.titulo}</b></div>
       <p>${m.texto}</p></div>`;

  const alvos = [[0, FASES[0]], [SINODICO / 4, FASES[2]], [SINODICO / 2, FASES[4]], [3 * SINODICO / 4, FASES[6]]];
  $('listaProximas').innerHTML = alvos.map(([alvo, f]) => {
    let dias = alvo - idade;
    if (dias < 0.3) dias += SINODICO;
    const d = new Date(agora.getTime() + dias * DIA);
    return `<div class="linha-prox"><span>${f.emoji} ${f.nome}</span>
      <b>${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
       · ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</b></div>`;
  }).join('');
}

/* ================= 🖐️ LUA INTERATIVA ================= */
const luaWrap = $('luaWrap');
let faseReal = 0;
let faseVisual = null;
let rafAnim = null;
let escalaAtual = 1;
const ponteiros = new Map();
let arrasto = null;
let pinca = null;

const aplicarTransform = () => { $('luaSvg').style.transform = `scale(${escalaAtual})`; };
function faseIdxDe(f) { return Math.floor((((f % 1) + 1) % 1) * 8 + 0.5) % 8; }

function atualizarPreview(f) {
  const fN = ((f % 1) + 1) % 1;
  $('nomeFase').textContent = FASES[faseIdxDe(fN)].nome + ' (prévia)';
  $('iluminacao').textContent = Math.round((1 - Math.cos(2 * Math.PI * fN)) / 2 * 100) + '%';
}

function animarFase(de, ate, dur, aoFim) {
  const t0 = performance.now();
  function passo(t) {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    const f = de + (ate - de) * e;
    desenharLua(f); atualizarPreview(f);
    if (k < 1) rafAnim = requestAnimationFrame(passo);
    else { rafAnim = null; aoFim && aoFim(); }
  }
  rafAnim = requestAnimationFrame(passo);
}

function voltarFaseReal() {
  const de = faseVisual;
  const delta = ((faseReal - de + 1.5) % 1) - 0.5;
  animarFase(de, de + delta, 700, () => {
    faseVisual = null;
    $('previewBadge').hidden = true;
    atualizarLua();
  });
}

function voltarZoom() {
  const e0 = escalaAtual, t0 = performance.now();
  (function p(t) {
    const k = Math.min(1, (t - t0) / 350);
    escalaAtual = e0 + (1 - e0) * (1 - Math.pow(1 - k, 3));
    aplicarTransform();
    if (k < 1) requestAnimationFrame(p);
  })(t0);
}

luaWrap.addEventListener('contextmenu', e => e.preventDefault());

luaWrap.addEventListener('pointerdown', e => {
  e.preventDefault();
  luaWrap.setPointerCapture(e.pointerId);
  ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (rafAnim) { cancelAnimationFrame(rafAnim); rafAnim = null; }
  if (ponteiros.size === 1) {
    arrasto = { x0: e.clientX, t0: performance.now(), moveu: false,
                baseFase: faseVisual !== null ? faseVisual : faseReal };
  } else if (ponteiros.size === 2) {
    const [p1, p2] = [...ponteiros.values()];
    pinca = { d0: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1, escala0: escalaAtual };
    arrasto = null;
  }
});

luaWrap.addEventListener('pointermove', e => {
  if (!ponteiros.has(e.pointerId)) return;
  ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (ponteiros.size === 2 && pinca) {
    const [p1, p2] = [...ponteiros.values()];
    const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    escalaAtual = Math.min(1.9, Math.max(0.7, pinca.escala0 * d / pinca.d0));
    aplicarTransform();
    return;
  }

  if (ponteiros.size === 1 && arrasto) {
    const dx = e.clientX - arrasto.x0;
    if (Math.abs(dx) > 10) arrasto.moveu = true;
    if (arrasto.moveu) {
      faseVisual = arrasto.baseFase + dx / 280;
      desenharLua(faseVisual);
      atualizarPreview(faseVisual);
      $('previewBadge').hidden = false;
    }
  }
});

function soltar(e) {
  ponteiros.delete(e.pointerId);
  if (ponteiros.size === 1) { pinca = null; return; }
  if (ponteiros.size === 0) {
    if (pinca) { pinca = null; voltarZoom(); }
    else if (arrasto) {
      if (arrasto.moveu && faseVisual !== null) {
        $('previewBadge').textContent = '↩ Voltando à fase real…';
        voltarFaseReal();
      } else if (!arrasto.moveu && performance.now() - arrasto.t0 < 400 && faseVisual === null) {
        $('previewBadge').textContent = '🌕 Ciclo lunar…';
        $('previewBadge').hidden = false;
        animarFase(faseReal, faseReal + 1, 4000, () => {
          faseVisual = null;
          $('previewBadge').hidden = true;
          $('previewBadge').textContent = '👁 Prévia — solte para voltar';
          atualizarLua();
        });
      }
      arrasto = null;
    }
  }
}
luaWrap.addEventListener('pointerup', soltar);
luaWrap.addEventListener('pointercancel', soltar);

/* ================= PLANTIO ================= */
const PLANTIO = {
  nova: {
    emoji: '🌑', titulo: 'Lua Nova — preparo',
    resumo: 'A seiva está nas raízes: mês de preparo e limpeza.',
    plantar: ['Grãos e cereais: milho, arroz, trigo, centeio', 'Sementes grandes e de germinação lenta', 'Árvores e mudas (enraizamento forte)'],
    tarefas: ['Preparar canteiros e revirar o solo', 'Adubar com composto ou esterco', 'Capinar — o que corta na nova rebrota menos', 'Combater pragas, fungos e formigas', 'Colher grãos para armazenar']
  },
  crescente: {
    emoji: '🌒', titulo: 'Lua Crescente — folhas',
    resumo: 'A seiva sobe para as folhas: força nas copas.',
    plantar: ['Folhosas: alface, couve, rúcula, espinafre, agrião', 'Repolho, couve-flor, brócolis, chicória', 'Temperos: salsa, cebolinha, coentro, manjericão'],
    tarefas: ['Transplantar mudas', 'Fazer enxertias', 'Regar mais — solo retém umidade', 'Colher folhas para consumo fresco']
  },
  cheia: {
    emoji: '🌕', titulo: 'Lua Cheia — frutos e flores',
    resumo: 'A seiva atinge flores e frutos: energia máxima.',
    plantar: ['Frutos: tomate, pimentão, berinjela, pepino', 'Abóbora, abobrinha, melancia, melão, morango', 'Feijão, ervilha, grão-de-bico, soja', 'Flores ornamentais e girassol'],
    tarefas: ['Colher frutas (mais suco e sabor)', 'Extrair sementes de frutos maduros', 'Colher hortaliças do dia a dia']
  },
  minguante: {
    emoji: '🌘', titulo: 'Lua Minguante — raízes',
    resumo: 'A seiva desce para as raízes: força debaixo da terra.',
    plantar: ['Tubérculos: batata, batata-doce, mandioca, inhame', 'Raízes: cenoura, beterraba, rabanete, nabo', 'Bulbos: cebola, alho, gengibre'],
    tarefas: ['Podar árvores e plantas', 'Colher raízes para estoque', 'Aplicar controle de pragas', 'Fazer compostagem e cobertura do solo']
  }
};

function renderPlantio() {
  $('cardsPlantio').innerHTML = Object.entries(PLANTIO).map(([chave, p]) => `
    <article class="card fase-card" data-fase-card="${chave}">
      <header><span class="fc-emoji">${p.emoji}</span>
        <div><h3>${p.titulo}</h3><p class="muted">${p.resumo}</p></div>
        <span class="selo-agora">AGORA</span></header>
      <h4>🌱 O que plantar</h4><ul>${p.plantar.map(i => `<li>${i}</li>`).join('')}</ul>
      <h4>🛠️ Tarefas</h4><ul>${p.tarefas.map(i => `<li>${i}</li>`).join('')}</ul>
    </article>`).join('');
}

/* ================= MADEIRA ================= */
const MADEIRA = {
  otimo: { icone: '✅', titulo: 'Excelente período para cortar madeira', cor: '#37c978',
    texto: 'Na lua minguante a seiva está baixa: a madeira fica mais seca, leve e resistente — apodrece menos, racha menos e afasta cupins e fungos.' },
  bom: { icone: '👍', titulo: 'Bom período para cortar madeira', cor: '#4db6ff',
    texto: 'Na lua nova a seiva também está baixa. A tradição diz que mourões e postes cortados nessa fase apodrecem menos — ótimo para peças que ficam na terra.' },
  ruim: { icone: '⚠️', titulo: 'Evite cortar madeira agora', cor: '#ffb74d',
    texto: 'Na lua crescente/cheia a seiva está alta: a madeira fica pesada e úmida, empena, racha fácil e atrai cupins e fungos. Espere a lua minguante.' }
};

const USOS_MADEIRA = [
  ['🪵', 'Mourões e estacas de cerca', 'Corte na minguante: absorvem menos umidade e não apodrecem cedo.'],
  ['🪓', 'Cabos de ferramentas', 'Machado, enxada, picareta: madeira seca não afrouxa depois.'],
  ['🏗️', 'Vigas, caibros e telhados', 'Na minguante empena e racha menos.'],
  ['🔥', 'Lenha', 'Seca mais rápido, queima melhor e fumega menos.'],
  ['🪑', 'Móveis e artesanato', 'A casca solta fácil e o acabamento fica mais estável.']
];

function renderMadeira() {
  $('usosMadeira').innerHTML = USOS_MADEIRA.map(([ic, t, d]) =>
    `<div class="uso"><span class="uso-ic">${ic}</span><div><b>${t}</b><p class="muted">${d}</p></div></div>`).join('');
}

/* ================= CLIMA ================= */
const WMO = { 0:['Céu limpo','☀️'],1:['Predomínio de sol','🌤️'],2:['Parcialmente nublado','⛅'],3:['Nublado','☁️'],
45:['Nevoeiro','🌫️'],48:['Nevoeiro com geada','🌫️'],51:['Garoa fraca','🌦️'],53:['Garoa','🌦️'],55:['Garoa forte','🌦️'],
56:['Garoa congelante','🌧️'],57:['Garoa congelante forte','🌧️'],61:['Chuva fraca','🌧️'],63:['Chuva','🌧️'],65:['Chuva forte','🌧️'],
66:['Chuva congelante','🌧️'],67:['Chuva congelante forte','🌧️'],71:['Neve fraca','🌨️'],73:['Neve','🌨️'],75:['Neve forte','❄️'],
77:['Grãos de neve','❄️'],80:['Pancadas leves','🌦️'],81:['Pancadas de chuva','🌧️'],82:['Pancadas fortes','⛈️'],
85:['Pancadas de neve','🌨️'],86:['Pancadas de neve fortes','🌨️'],95:['Trovoada','⛈️'],96:['Trovoada com granizo','⛈️'],99:['Trovoada com granizo forte','⛈️'] };
const wmo = c => WMO[c] || ['—', '🌡️'];

async function obterClima(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=5&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('falha clima');
  return r.json();
}

async function nomeCidade(lat, lon) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&accept-language=pt-BR`);
    const j = await r.json();
    const a = j.address || {};
    const local = a.city || a.town || a.village || a.municipality || a.hamlet || a.suburb || a.neighbourhood || a.county || '';
    const iso = a['ISO3166-2-lvl4'] || '';
    const uf = iso.includes('-') ? iso.split('-')[1] : '';
    if (local) return `${local}${uf ? ' - ' + uf : ''}`;
  } catch (_) {}
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`);
    const j = await r.json();
    return j.city || j.locality || j.principalSubdivision || '';
  } catch (_) { return ''; }
}

function mostrarClima(dados, cidade) {
  const c = dados.current, [desc, ic] = wmo(c.weather_code);
  $('climaAtual').hidden = false;
  $('climaAtual').innerHTML = `
    <div class="clima-top">
      <div>
        <div class="clima-cidade">📍 ${cidade || 'Sua região'}</div>
        <div class="clima-temp">${Math.round(c.temperature_2m)}°C</div>
        <div class="clima-desc">${ic} ${desc}</div>
      </div>
      <div class="clima-ic-grande">${c.is_day ? ic : (c.weather_code === 0 ? '🌙' : ic)}</div>
    </div>
    <div class="clima-grid">
      <div><span>Sensação</span><b>${Math.round(c.apparent_temperature)}°</b></div>
      <div><span>Umidade</span><b>${c.relative_humidity_2m}%</b></div>
      <div><span>Vento</span><b>${Math.round(c.wind_speed_10m)} km/h</b></div>
      <div><span>Chuva</span><b>${c.precipitation ?? 0} mm</b></div>
    </div>`;
  $('previsao').hidden = false;
  $('previsao').innerHTML = dados.daily.time.map((t, i) => {
    const [, di] = wmo(dados.daily.weather_code[i]);
    const dia = new Date(t + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short' });
    return `<div class="prev-card"><b>${dia}</b><div class="prev-ic">${di}</div>
      <div class="prev-temp">${Math.round(dados.daily.temperature_2m_max[i])}°
       <span class="muted">${Math.round(dados.daily.temperature_2m_min[i])}°</span></div>
      <div class="muted pequeno">💧 ${dados.daily.precipitation_probability_max[i] ?? 0}%</div></div>`;
  }).join('');
}

async function carregarClima(lat, lon, cidade) {
  $('localStatus').textContent = 'Atualizando clima…';
  try {
    const dados = await obterClima(lat, lon);
    mostrarClima(dados, cidade);
    localStorage.setItem('fdl_clima', JSON.stringify({ t: Date.now(), cidade, dados }));
    $('localStatus').textContent = cidade ? `${cidade} · ${lat.toFixed(4)}, ${lon.toFixed(4)}`
                                          : `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } catch (_) {
    const salvo = localStorage.getItem('fdl_clima');
    if (salvo) { const s = JSON.parse(salvo); mostrarClima(s.dados, s.cidade); }
    $('localStatus').textContent = '⚠️ Sem internet — mostrando último clima salvo.';
  }
}

function definirLocal(lat, lon, cidade, precisao) {
  LOCAL = { lat, lon, cidade: cidade || '' };
  localStorage.setItem('fdl_local', JSON.stringify(LOCAL));
  atualizarLua();
  if (precisao != null) {
    $('localStatus').textContent =
      `📡 GPS do aparelho: ±${Math.round(precisao)} m ${cidade ? '· ' + cidade : ''}`;
  }
  carregarClima(lat, lon, LOCAL.cidade);
}

function pedirGPS(silencioso) {
  if (!navigator.geolocation) {
    if (!silencioso) $('localStatus').textContent = 'Seu navegador não suporta GPS.';
    return;
  }
  if (!silencioso) $('localStatus').textContent = '📡 Obtendo localização do dispositivo…';
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lon, accuracy } = pos.coords;
    const cidade = await nomeCidade(lat, lon);
    definirLocal(lat, lon, cidade, accuracy);
  }, err => {
    const msgs = {
      1: '🚫 Permissão negada — toque no cadeado 🔒 na barra de endereço → Localização → Permitir.',
      2: '📡 Sem sinal — verifique se o GPS (Localização) do aparelho está ATIVADO nas configurações.',
      3: '⏱️ Tempo esgotado — tente de novo em local aberto (céu visível).'
    };
    $('localStatus').textContent = msgs[err.code] || 'Erro ao obter localização.';
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
}

async function gpsAutomatico() {
  try {
    const st = await navigator.permissions.query({ name: 'geolocation' });
    if (st.state === 'denied') {
      $('avisoLocal').textContent = '📍 Localização bloqueada — permita no navegador para horários e clima precisos.';
      return;
    }
  } catch (_) {}
  pedirGPS(true);
}

async function buscarCidade() {
  const nome = $('inpCidade').value.trim();
  if (!nome) return;
  $('localStatus').textContent = '🔎 Buscando…';
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nome)}&count=1&language=pt&format=json`);
    const j = await r.json();
    if (!j.results || !j.results.length) { $('localStatus').textContent = 'Cidade não encontrada.'; return; }
    const { latitude, longitude, name, admin1, country } = j.results[0];
    definirLocal(latitude, longitude, `${name}${admin1 ? ' - ' + admin1 : ''}${country ? ', ' + country : ''}`);
  } catch (_) { $('localStatus').textContent = 'Erro na busca (sem internet?).'; }
}
 $('btnBuscar').addEventListener('click', buscarCidade);
 $('inpCidade').addEventListener('keydown', e => { if (e.key === 'Enter') buscarCidade(); });
 $('btnGps').addEventListener('click', () => pedirGPS(false));

/* ============================================================
   ⬇️ INSTALAÇÃO — some na hora em que o app é instalado
   ============================================================ */
const ID_DO_APP = 'fases-da-lua-v5';

let deferredPrompt = null;
let resolverPrompt = null;
const btnInstalar = $('btnInstalar');

const rodandoComoApp = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

async function appsInstalados() {
  try {
    if (navigator.getInstalledRelatedApps) return await navigator.getInstalledRelatedApps();
  } catch (_) {}
  return [];
}
const ehEsteApp = a => (a.id || '').includes(ID_DO_APP) || (a.url || '').includes(ID_DO_APP);

async function atualizarBotaoInstalar() {
  if (rodandoComoApp()) { btnInstalar.hidden = true; return; }
  const apps = await appsInstalados();
  btnInstalar.hidden = apps.some(ehEsteApp);
}

async function tentarInstalar() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    return true;
  }
  const veio = await Promise.race([
    new Promise(r => { resolverPrompt = () => r(true); setTimeout(() => r(false), 6000); })
  ]);
  if (veio && deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    return true;
  }
  return false;
}

btnInstalar.addEventListener('click', async () => {
  btnInstalar.hidden = true;
  const ok = await tentarInstalar();
  if (ok) return;
  btnInstalar.hidden = false;
  abrirDiag();
});

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  if (!rodandoComoApp()) btnInstalar.hidden = false;
  if (resolverPrompt) { resolverPrompt(); resolverPrompt = null; }
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  btnInstalar.hidden = true;
  $('diagInstalar').hidden = true;
  fecharDiag();
  mostrarToast('✅ App instalado! Abra pelo ícone 🌒 na tela inicial.');
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) atualizarBotaoInstalar();
});

/* ============================================================
   🔧 DIAGNÓSTICO
   ============================================================ */
const diagOverlay = $('diagOverlay');

function abrirDiag() {
  diagOverlay.hidden = false;
  $('diagLista').innerHTML = '';
  $('diagVeredito').textContent = '🔎 Executando verificações…';
  $('diagInstalar').hidden = rodandoComoApp();
  executarDiagnostico()
    .catch(e => {
      $('diagVeredito').textContent =
        '⚠️ O diagnóstico não conseguiu terminar (' + (e && e.message ? e.message : e) + ').\n\n' +
        'Mas os botões funcionam. Toque em "⬇ Tentar instalar agora" ou em Fechar.';
    });
}
function fecharDiag() { diagOverlay.hidden = true; }

 $('btnDiag').addEventListener('click', abrirDiag);
 $('diagFechar').addEventListener('click', fecharDiag);
diagOverlay.addEventListener('click', e => { if (e.target === diagOverlay) fecharDiag(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharDiag(); });

function linhaDiag(estado, titulo, detalhe) {
  const ic = estado === 'ok' ? '✅' : estado === 'alerta' ? '⚠️' : '❌';
  return `<div class="diag-item ${estado}">
    <span class="ic">${ic}</span>
    <div><b>${titulo}</b><p>${detalhe}</p></div></div>`;
}

async function executarDiagnostico() {
  const itens = [];
  const add = (cond, titulo, ok, alerta, erro) =>
    itens.push(linhaDiag(cond ? 'ok' : (alerta ? 'alerta' : 'erro'), titulo, cond ? ok : (erro || alerta)));

  const seguro = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  add(seguro, 'Conexão segura (HTTPS)',
    'Servido via HTTPS — requisito atendido.', null,
    `Está em "${location.protocol}//" — o navegador SÓ instala via HTTPS ou localhost.`);

  let reg = null;
  try { reg = await navigator.serviceWorker.getRegistration(); } catch (_) {}
  const swOk = !!reg;
  add(swOk, 'Service Worker registrado',
    swOk ? 'sw.js registrado com sucesso.' : null, null,
    'sw.js não encontrado. Confira se o arquivo sw.js está na MESMA pasta do index.html no GitHub.');

  const controlando = !!(navigator.serviceWorker.controller || (reg && reg.active));
  add(controlando, 'Service Worker ativo',
    controlando ? 'Ativo e controlando o app.' : null,
    'Registrado mas ainda assumindo o controle — feche e reabra o app.',
    'Sem Service Worker ativo — requisito obrigatório para instalar.');

  let man = null, manErro = '';
  try {
    const r = await fetch('manifest.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    man = await r.json();
  } catch (e) { manErro = e.message; }
  add(!!man, 'manifest.json carregado',
    man ? `"${man.name || 'sem nome'}" — válido.` : null, null,
    `Falhou: ${manErro}. Confira se o arquivo se chama exatamente manifest.json e é um JSON válido.`);

  if (man) {
    const idUnico = man.id && man.id.includes(ID_DO_APP);
    add(idUnico, 'Identidade única do app (anti-conflito)',
      `id: "${man.id}" · start_url: "${man.start_url}" — não colide com apps antigos deste site.`, null,
      `O manifest não tem o id novo "${ID_DO_APP}". Substitua o manifest.json pela versão nova.`);

    const camposOk = !!(man.name && man.start_url != null && man.display && man.id &&
                        Array.isArray(man.icons) && man.icons.length >= 1);
    add(camposOk, 'Campos obrigatórios do manifest',
      'name, id, start_url, display e icons presentes.', null,
      'Faltam campos obrigatórios. Substitua o manifest.json pela versão nova.');
  }

  let iconesOk = false;
  if (man && Array.isArray(man.icons)) {
    const resultados = [];
    for (const ic of man.icons) {
      try {
        const url = new URL(ic.src, location.href).href;
        const img = new Image();
        img.src = url;
        await img.decode();
        resultados.push(true);
      } catch (_) { resultados.push(false); }
    }
    iconesOk = resultados.some(Boolean);
    add(iconesOk, 'Ícones carregam corretamente',
      `${resultados.filter(Boolean).length}/${resultados.length} ícones OK (inclusive PNG 192/512).`, null,
      'Nenhum ícone carregou. Gere os PNGs com gerar-icones.html e suba icon-192.png e icon-512.png na pasta.');
  } else {
    itens.push(linhaDiag('erro', 'Ícones carregam corretamente', 'Sem icons no manifest — impossível instalar.'));
  }

  const suporta = 'onbeforeinstallprompt' in window || 'serviceWorker' in navigator;
  add(suporta, 'Navegador suporta instalação PWA',
    'Chrome/Edge detectado com suporte.', null,
    'Este navegador não suporta instalação. Use o Google Chrome no Android.');

  const standalone = rodandoComoApp();
  itens.push(linhaDiag(standalone ? 'ok' : 'alerta', 'Modo de execução',
    standalone ? '✨ Você está DENTRO do app instalado (standalone). Tudo certo!'
               : 'Você está abrindo pelo navegador (aba do Chrome), NÃO pelo app instalado.'));

  const apps = await appsInstalados();
  const esteInstalado = apps.some(ehEsteApp);
  const idDetectado = apps.length ? (apps[0].id || apps[0].url || '(sem id)') : '';

  if (!apps.length) {
    itens.push(linhaDiag('ok', 'Instalação livre',
      'O Chrome NÃO considera este app instalado — pode instalar normalmente.'));
  } else if (esteInstalado) {
    itens.push(linhaDiag('ok', 'Este app já está instalado',
      `📦 Detectado id "${idDetectado}" — é este app mesmo. Abra pelo ícone 🌒 na tela inicial.`));
  } else {
    itens.push(linhaDiag('alerta', '⚠️ CONFLITO: outro app antigo ocupa este site',
      `O Chrome detecta instalado um app com id "${idDetectado}" — este NÃO é o app novo. ` +
      `Com a identidade nova (v5) o Chrome aceita instalar este app separadamente.`));
  }

  $('diagLista').innerHTML = itens.join('');

  const veredito = $('diagVeredito');
  let texto;
  if (standalone) {
    texto = '🎉 TUDO CERTO!\nVocê está usando o app instalado. O botão "Instalar" fica escondido porque não é mais necessário.';
  } else if (esteInstalado) {
    texto = '📦 ESTE APP JÁ ESTÁ INSTALADO NESTE APARELHO!\n\n' +
      '1. Feche o Chrome.\n2. Vá à tela inicial / gaveta de apps.\n' +
      '3. Procure o ícone 🌒 "Fases da Lua" e abra por ele.';
  } else if (apps.length) {
    texto = '🧩 APP FANTASMA DETECTADO\n\n' +
      'Um app ANTIGO deste site está registrado no Chrome (por isso ele diz "já instalado").\n\n' +
      'Com os arquivos v5 (manifest com id único) este app novo instala separado:\n' +
      '• Toque em "⬇ Tentar instalar agora" acima.\n\n' +
      'OPCIONAL (limpar o fantasma):\n' +
      '• Digite chrome://webapks no Chrome para ver a lista.\n' +
      '• Ajustes do celular > Apps > app antigo > Desinstalar.';
  } else if (seguro && swOk && controlando && man && iconesOk) {
