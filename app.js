/* ============================================================
   FASES DA LUA — app.js (v10)
   Idade corrigida + nome da fase igual ao app de referência
   ============================================================ */
'use strict';

/* Erros aparecem na tela — nunca mais tela morta */
function mostrarErro(msg) {
  const b = document.getElementById('erroBarra');
  if (b) { b.hidden = false; b.textContent = '⚠️ ' + msg; }
}
window.addEventListener('error', function (e) { mostrarErro(e.message); });
window.addEventListener('unhandledrejection', function (e) {
  mostrarErro(e.reason && e.reason.message ? e.reason.message : String(e.reason));
});

/* ---------- Constantes ---------- */
const SINODICO = 29.530588853;
const J2000    = Date.UTC(2000, 0, 1, 12);
const NOVA_REF = Date.UTC(2000, 0, 6, 18, 14);
const RAD = Math.PI / 180;
const DIA = 86400000;
const H0  = 0.125 * RAD;

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

let LOCAL = null;
try { LOCAL = JSON.parse(localStorage.getItem('fdl_local') || 'null'); } catch (_) {}
let sulAtual = true;

const $ = function (id) { return document.getElementById(id); };

function mostrarToast(msg, ms) {
  const t = document.createElement('div');
  t.id = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function () { t.remove(); }, ms || 4500);
}

/* ================= ASTRONOMIA ================= */
const norm = function (a) { return ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); };
const diasJ2000 = function (ms) { return (ms - J2000) / DIA; };

function posicaoLua(date) {
  const T = diasJ2000(date.getTime()) / 36525;
  const D  = (297.8502 + 445267.1115 * T) * RAD;
  const Ms = (357.5291 + 35999.0503 * T) * RAD;
  const Mp = (134.9634 + 477198.8676 * T) * RAD;
  const F  = (93.2721 + 483202.0175 * T) * RAD;
  const lon = (218.3165 + 481267.8813 * T) * RAD +
    (6.289 * Math.sin(Mp) + 1.274 * Math.sin(2 * D - Mp) + 0.658 * Math.sin(2 * D) +
     0.214 * Math.sin(2 * Mp) - 0.186 * Math.sin(Ms) - 0.114 * Math.sin(2 * F)) * RAD;
  const beta = 5.128 * Math.sin(F) * RAD;
  const eps = 23.4393 * RAD;
  const ra  = norm(Math.atan2(Math.sin(lon) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps), Math.cos(lon)));
  const dec = Math.asin(Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lon));
  const dist = 385000.56 - 20905.355 * Math.cos(Mp) - 3699.111 * Math.cos(2 * D - Mp)
             - 2955.968 * Math.cos(2 * D) - 569.925 * Math.cos(2 * Mp);
  return { ra: ra, dec: dec, lon: norm(lon), dist: dist };
}

function longitudeSolar(date) {
  const T = diasJ2000(date.getTime()) / 36525;
  const L0 = (280.46646 + 36000.76983 * T) * RAD;
  const M  = (357.52911 + 35999.05029 * T) * RAD;
  const C  = (1.914602 * Math.sin(M) + 0.019993 * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M)) * RAD;
  return norm(L0 + C);
}

/* v10: BUG CORRIGIDO — antes subtraía o epoch duas vezes (era 19 em vez de 21) */
function idadeLua(date) {
  const a = (((date || new Date()).getTime() - NOVA_REF) / DIA) % SINODICO;
  return a < 0 ? a + SINODICO : a;
}

/* p = elongação/2π: 0=nova · 0.25=quarto crescente · 0.5=cheia · 0.75=quarto minguante */
function faseAgora(date) {
  const d = date || new Date();
  const lua = posicaoLua(d);
  const E = norm(lua.lon - longitudeSolar(d));
  return {
    E: E,
    k: (1 - Math.cos(E)) / 2,
    p: E / (2 * Math.PI),
    idx: Math.floor(E / (Math.PI / 4)) % 8,
    idade: idadeLua(d),
    dist: lua.dist
  };
}

function gmstRad(date) {
  return norm((280.46061837 + 360.98564736629 * diasJ2000(date.getTime())) * RAD);
}

function altitudeLua(date, lat, lon) {
  const p = posicaoLua(date);
  const H = gmstRad(date) + lon * RAD - p.ra;
  const fi = lat * RAD;
  return Math.asin(Math.sin(fi) * Math.sin(p.dec) + Math.cos(fi) * Math.cos(p.dec) * Math.cos(H));
}

function interpolar(t1, t2, a1, a2) {
  const f = a1 / (a1 - a2);
  return new Date(t1.getTime() + f * (t2.getTime() - t1.getTime()));
}

function nascerESePorLua(lat, lon) {
  const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
  const passo = 10 * 60000;
  const subidas = [], descidas = [];
  let a1 = altitudeLua(inicio, lat, lon) - H0;
  for (let i = 1; i <= 288; i++) {
    const t = new Date(inicio.getTime() + i * passo);
    const a2 = altitudeLua(t, lat, lon) - H0;
    if (a1 < 0 && a2 >= 0) subidas.push(interpolar(new Date(t - passo), t, a1, a2));
    if (a1 >= 0 && a2 < 0) descidas.push(interpolar(new Date(t - passo), t, a1, a2));
    a1 = a2;
  }
  const agora = new Date();
  const prox = function (arr) {
    for (let i = 0; i < arr.length; i++) if (arr[i] > agora) return arr[i];
    return null;
  };
  return { nascer: prox(subidas), sePor: prox(descidas) };
}

function refLocal() {
  if (LOCAL && LOCAL.lat != null) return LOCAL;
  const offH = -new Date().getTimezoneOffset() / 60;
  return { lat: -15, lon: offH * 15, cidade: '', aproximado: true };
}

/* ============================================================
   DESENHO DA FASE (convensão norte; no sul espelha com scale)
   ============================================================ */
function caminhoFase(p, r) {
  p = ((p % 1) + 1) % 1;
  const c = Math.cos(2 * Math.PI * p);
  const rx = (Math.abs(c) * r).toFixed(2);
  if (p <= 0.5) {
    return 'M 0 ' + (-r) +
      ' A ' + r + ' ' + r + ' 0 0 1 0 ' + r +
      ' A ' + rx + ' ' + r + ' 0 0 ' + (c > 0 ? 0 : 1) + ' 0 ' + (-r) + ' Z';
  }
  return 'M 0 ' + (-r) +
    ' A ' + r + ' ' + r + ' 0 0 0 0 ' + r +
    ' A ' + rx + ' ' + r + ' 0 0 ' + (c < 0 ? 0 : 1) + ' 0 ' + (-r) + ' Z';
}

const MARIA = [
  [-25,-45,30,23,.45],[35,-45,21,18,.40],[45,-15,21,17,.40],[72,-33,12,10,.45],
  [60,10,14,12,.35],[42,24,11,9,.30],[-52,-8,24,34,.38],[-50,35,13,11,.40],
  [-25,30,15,12,.35],[-30,6,11,9,.25],[8,-58,10,8,.20],[15,40,9,8,.20]
];
const CRATERAS = [
  [-45,-25,20,.14],[-28,-48,13,.12],[8,-58,9,.09],[38,-32,15,.13],
  [58,6,11,.12],[22,22,23,.15],[-14,38,17,.13],[-52,26,9,.10],
  [12,62,13,.11],[48,48,8,.10],[-4,-6,8,.12],[-62,-46,6,.08],
  [64,-42,7,.08],[26,-12,6,.10],[-32,6,5,.10],[40,20,7,.11]
];

const mariaMarkup = MARIA.map(function (m) {
  return '<ellipse cx="' + m[0] + '" cy="' + m[1] + '" rx="' + m[2] + '" ry="' + m[3] +
    '" fill="#5d6169" opacity="' + m[4] + '"/>';
}).join('');

const craterasMarkup = CRATERAS.map(function (c) {
  return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + c[2] + '" fill="rgba(25,23,18,' + c[3] + ')"/>' +
    '<circle cx="' + (c[0] - c[2] * .25) + '" cy="' + (c[1] - c[2] * .25) + '" r="' + (c[2] * .5) +
    '" fill="rgba(255,255,248,' + (c[3] * .5) + ')"/>';
}).join('');

function svgLua(p) {
  const r = 100;
  const lit = caminhoFase(p, r);
  const esp = sulAtual ? ' transform="scale(-1 1)"' : '';
  return '<defs>' +
    '<radialGradient id="gLua" cx="40%" cy="38%" r="75%">' +
      '<stop offset="0%" stop-color="#f4f1e6"/>' +
      '<stop offset="55%" stop-color="#d6d3c6"/>' +
      '<stop offset="100%" stop-color="#9d998d"/></radialGradient>' +
    '<radialGradient id="gBrilho" cx="50%" cy="50%" r="50%">' +
      '<stop offset="60%" stop-color="rgba(255,255,240,0)"/>' +
      '<stop offset="92%" stop-color="rgba(255,255,235,.14)"/>' +
      '<stop offset="100%" stop-color="rgba(255,255,235,0)"/></radialGradient>' +
    '<clipPath id="clipLua"><circle r="' + r + '"/></clipPath>' +
    '<clipPath id="clipFase"><path d="' + lit + '"' + esp + '/></clipPath>' +
    '</defs>' +
    '<circle r="' + (r + 9) + '" fill="url(#gBrilho)"/>' +
    '<g clip-path="url(#clipLua)">' +
      '<circle r="' + r + '" fill="#0d0f14"/>' +
      '<path d="' + lit + '" fill="url(#gLua)"' + esp + '/>' +
      '<g clip-path="url(#clipFase)">' + mariaMarkup + craterasMarkup + '</g>' +
    '</g>' +
    '<circle r="' + r + '" fill="none" stroke="rgba(255,255,255,.06)"/>';
}

function desenharLua(f) { $('luaSvg').innerHTML = svgLua(f); }

/* ================= TELA LUA ================= */
function fmtHora(d) {
  if (!d) return '—';
  return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
}

function atualizarCeu() {
  const agora = new Date();
  $('relogio').textContent = agora.toLocaleTimeString('pt-BR', { hour12: false });
  $('dataAtual').textContent = agora.toLocaleDateString('pt-BR',
    { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function grupoFase(idx) { return idx === 0 ? 'nova' : idx < 4 ? 'crescente' : idx === 4 ? 'cheia' : 'minguante'; }

function atualizarLua() {
  try {
    const agora = new Date();
    const fa = faseAgora(agora);
    const F = FASES[fa.idx];
    faseReal = fa.p;

    sulAtual = refLocal().lat < 0;

    $('iluminacao').textContent = Math.round(fa.k * 100) + '%';
    $('distancia').textContent =
      fa.dist.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km';
    $('idade').textContent = Math.floor(fa.idade) + ' dias';

    const lua = posicaoLua(agora);
    const si = Math.floor(norm(lua.lon) / (Math.PI / 6)) % 12;
    const s = SIGNOS[si], n = SIGNOS[(si + 1) % 12];
    $('sinal').innerHTML = s[0] + ' ' + s[1] + ' → ' + n[0] + ' ' + n[1];

    const interagindo = faseVisual !== null || rafAnim !== null || ponteiros.size > 0;
    if (!interagindo) {
      desenharLua(fa.p);
      $('nomeFase').textContent = F.nome;
    }

    const loc = refLocal();
    const ev = nascerESePorLua(loc.lat, loc.lon);
    const suf = function (d) { return (d && d.getDate() !== agora.getDate()) ? ' amanhã' : ''; };
    $('nascer').textContent = fmtHora(ev.nascer) + suf(ev.nascer);
    $('sePor').textContent = fmtHora(ev.sePor) + suf(ev.sePor);
    $('avisoLocal').textContent = loc.aproximado
      ? '📍 Localização aproximada — permita o GPS para precisão.' : '';

    const g = grupoFase(fa.idx);
    document.querySelectorAll('[data-fase-card]').forEach(function (el) {
      el.classList.toggle('agora', el.dataset.faseCard === g);
    });

    const av = fa.idx >= 5 ? 'otimo' : fa.idx === 0 ? 'bom' : 'ruim';
    const m = MADEIRA[av];
    $('madeiraStatus').innerHTML =
      '<div class="status-madeira" style="border-color:' + m.cor + '">' +
        '<div class="status-top"><span class="status-icone">' + m.icone + '</span>' +
        '<b style="color:' + m.cor + '">' + m.titulo + '</b></div>' +
        '<p>' + m.texto + '</p></div>';

    const alvos = [[0, FASES[0]], [SINODICO / 4, FASES[2]], [SINODICO / 2, FASES[4]], [3 * SINODICO / 4, FASES[6]]];
    $('listaProximas').innerHTML = alvos.map(function (al) {
      let dias = al[0] - fa.idade;
      if (dias < 0.3) dias += SINODICO;
      const d = new Date(agora.getTime() + dias * DIA);
      return '<div class="linha-prox"><span>' + al[1].emoji + ' ' + al[1].nome + '</span>' +
        '<b>' + d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
        ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '</b></div>';
    }).join('');
  } catch (e) { mostrarErro(e.message); }
}

/* ================= LUA INTERATIVA ================= */
const luaWrap = $('luaWrap');
let faseReal = 0;
let faseVisual = null;
let rafAnim = null;
let escalaAtual = 1;
const ponteiros = new Map();
let arrasto = null;
let pinca = null;

const aplicarTransform = function () { $('luaSvg').style.transform = 'scale(' + escalaAtual + ')'; };
function faseIdxDe(f) { return Math.floor((((f % 1) + 1) % 1) * 8) % 8; }

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
    else { rafAnim = null; if (aoFim) aoFim(); }
  }
  rafAnim = requestAnimationFrame(passo);
}

function voltarFaseReal() {
  const de = faseVisual;
  const delta = ((faseReal - de + 1.5) % 1) - 0.5;
  animarFase(de, de + delta, 700, function () {
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

luaWrap.addEventListener('contextmenu', function (e) { e.preventDefault(); });

luaWrap.addEventListener('pointerdown', function (e) {
  e.preventDefault();
  luaWrap.setPointerCapture(e.pointerId);
  ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (rafAnim) { cancelAnimationFrame(rafAnim); rafAnim = null; }
  if (ponteiros.size === 1) {
    arrasto = { x0: e.clientX, t0: performance.now(), moveu: false,
      baseFase: faseVisual !== null ? faseVisual : faseReal };
  } else if (ponteiros.size === 2) {
    const pts = Array.from(ponteiros.values());
    pinca = { d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1, escala0: escalaAtual };
    arrasto = null;
  }
});

luaWrap.addEventListener('pointermove', function (e) {
  if (!ponteiros.has(e.pointerId)) return;
  ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (ponteiros.size === 2 && pinca) {
    const pts = Array.from(ponteiros.values());
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
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
        animarFase(faseReal, faseReal + 1, 4000, function () {
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
  $('cardsPlantio').innerHTML = Object.keys(PLANTIO).map(function (chave) {
    const p = PLANTIO[chave];
    return '<article class="card fase-card" data-fase-card="' + chave + '">' +
      '<header><span class="fc-emoji">' + p.emoji + '</span>' +
      '<div><h3>' + p.titulo + '</h3><p class="muted">' + p.resumo + '</p></div>' +
      '<span class="selo-agora">AGORA</span></header>' +
      '<h4>🌱 O que plantar</h4><ul>' + p.plantar.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>' +
      '<h4>🛠️ Tarefas</h4><ul>' + p.tarefas.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>' +
      '</article>';
  }).join('');
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
  $('usosMadeira').innerHTML = USOS_MADEIRA.map(function (u) {
    return '<div class="uso"><span class="uso-ic">' + u[0] + '</span><div><b>' + u[1] +
      '</b><p class="muted">' + u[2] + '</p></div></div>';
  }).join('');
}

/* ================= CLIMA ================= */
const WMO = { 0:['Céu limpo','☀️'],1:['Predomínio de sol','🌤️'],2:['Parcialmente nublado','⛅'],3:['Nublado','☁️'],
45:['Nevoeiro','🌫️'],48:['Nevoeiro com geada','🌫️'],51:['Garoa fraca','🌦️'],53:['Garoa','🌦️'],55:['Garoa forte','🌦️'],
56:['Garoa congelante','🌧️'],57:['Garoa congelante forte','🌧️'],61:['Chuva fraca','🌧️'],63:['Chuva','🌧️'],65:['Chuva forte','🌧️'],
66:['Chuva congelante','🌧️'],67:['Chuva congelante forte','🌧️'],71:['Neve fraca','🌨️'],73:['Neve','🌨️'],75:['Neve forte','❄️'],
77:['Grãos de neve','❄️'],80:['Pancadas leves','🌦️'],81:['Pancadas de chuva','🌧️'],82:['Pancadas fortes','⛈️'],
85:['Pancadas de neve','🌨️'],86:['Pancadas de neve fortes','🌨️'],95:['Trovoada','⛈️'],96:['Trovoada com granizo','⛈️'],99:['Trovoada com granizo forte','⛈️'] };
const wmo = function (c) { return WMO[c] || ['—', '🌡️']; };

async function obterClima(lat, lon) {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat.toFixed(4) + '&longitude=' + lon.toFixed(4) +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation,is_day' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=5&timezone=auto';
  const r = await fetch(url);
  if (!r.ok) throw new Error('falha clima');
  return r.json();
}

async function nomeCidade(lat, lon) {
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lon + '&zoom=16&accept-language=pt-BR');
    const j = await r.json();
    const a = j.address || {};
    const local = a.city || a.town || a.village || a.municipality || a.hamlet || a.suburb || a.neighbourhood || a.county || '';
    const iso = a['ISO3166-2-lvl4'] || '';
    const uf = iso.indexOf('-') > -1 ? iso.split('-')[1] : '';
    if (local) return local + (uf ? ' - ' + uf : '');
  } catch (_) {}
  try {
    const r = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lon + '&localityLanguage=pt');
    const j = await r.json();
    return j.city || j.locality || j.principalSubdivision || '';
  } catch (_) { return ''; }
}

function mostrarClima(dados, cidade) {
  const c = dados.current, w = wmo(c.weather_code);
  $('climaAtual').hidden = false;
  $('climaAtual').innerHTML =
    '<div class="clima-top"><div>' +
    '<div class="clima-cidade">📍 ' + (cidade || 'Sua região') + '</div>' +
    '<div class
