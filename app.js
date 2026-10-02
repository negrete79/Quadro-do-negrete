/* ============================================================
   FASES DA LUA — app.js  (v4)
   Astronomia + Plantio + Madeira + Clima + Instalação/Diagnóstico
   ============================================================ */
'use strict';

/* ---------- Constantes astronômicas ---------- */
const SINODICO = 29.530588853;
const J2000    = Date.UTC(2000, 0, 1, 12);
const NOVA_REF = Date.UTC(2000, 0, 6, 18, 14);
const RAD = Math.PI / 180;
const DIA = 86400000;
const H0 = 0.125 * RAD;

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

const $ = id => document.getElementById(id);

/* ================= ASTRONOMIA — LUA ================= */
const norm = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
const diasJ2000 = ms => (ms - J2000) / DIA;

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
  const ra  = Math.atan2(Math.sin(lon) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps), Math.cos(lon));
  const dec = Math.asin(Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lon));
  return { ra: norm(ra), dec, lon: norm(lon), D, Mp };
}

function idadeLua(date = new Date()) {
  const a = diasJ2000(date.getTime() - NOVA_REF) % SINODICO;
  return a < 0 ? a + SINODICO : a;
}
const iluminacao = idade => (1 - Math.cos(2 * Math.PI * idade / SINODICO)) / 2;

function distanciaLua(date) {
  const { D, Mp } = posicaoLua(date);
  return 385000.56 - 20905.355 * Math.cos(Mp) - 3699.111 * Math.cos(2 * D - Mp)
       - 2955.968 * Math.cos(2 * D) - 569.925 * Math.cos(2 * Mp);
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

function nascerESePorLua(lat, lon) {
  const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
  const passo = 10 * 60000;
  let nascer = null, sePor = null;
  let a1 = altitudeLua(inicio, lat, lon) - H0;
  for (let i = 1; i <= 288 && !(nascer && sePor); i++) {
    const t = new Date(inicio.getTime() + i * passo);
    const a2 = altitudeLua(t, lat, lon) - H0;
    if (a1 < 0 && a2 >= 0 && !nascer) nascer = interpolar(new Date(t - passo), t, a1, a2);
    if (a1 >= 0 && a2 < 0 && !sePor)  sePor  = interpolar(new Date(t - passo), t, a1, a2);
    a1 = a2;
  }
  return { nascer, sePor };
}

/* ================= LOCALIZAÇÃO ================= */
function refLocal() {
  if (LOCAL && LOCAL.lat != null) return LOCAL;
  const offH = -new Date().getTimezoneOffset() / 60;
  return { lat: -15, lon: offH * 15, cidade: '', aproximado: true };
}

/* ================= RENDER DA LUA (SVG) ================= */
function caminhoFase(p, r) {
  const c = Math.cos(2 * Math.PI * p);
  const rx = Math.abs(c) * r;
  if (p <= 0.5) {
    const sw = c > 0 ? 1 : 0;
    return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${rx} ${r} 0 0 ${sw} 0 ${-r} Z`;
  }
  const sw = c < 0 ? 1 : 0;
  return `M 0 ${-r} A ${r} ${r} 0 0 0 0 ${r} A ${rx} ${r} 0 0 ${sw} 0 ${-r} Z`;
}

const CRATERAS = [
  [-45,-25,20,.16],[-28,-48,13,.13],[8,-58,9,.10],[38,-32,15,.15],
  [58,6,11,.13],[22,22,23,.17],[-14,38,17,.14],[-52,26,9,.11],
  [12,62,13,.12],[48,48,8,.11],[-4,-6,8,.13],[-62,-46,6,.09],
  [64,-42,7,.09],[26,-12,6,.11],[-32,6,5,.11],[40,20,7,.12]
];
const craterasMarkup = CRATERAS.map(([x, y, r, o]) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(20,18,12,${o})"/>` +
  `<circle cx="${x - r * .25}" cy="${y - r * .25}" r="${r * .55}" fill="rgba(255,255,250,${o * .5})"/>`
).join('');

function svgLua(fase) {
  const r = 100;
  return `<defs>
    <radialGradient id="gLua" cx="40%" cy="38%" r="75%">
      <stop offset="0%" stop-color="#fbfaf1"/><stop offset="55%" stop-color="#dbd8cd"/>
      <stop offset="100%" stop-color="#9b978c"/>
    </radialGradient>
    <radialGradient id="gBrilho" cx="50%" cy="50%" r="50%">
      <stop offset="60%" stop-color="rgba(255,255,240,0)"/>
      <stop offset="92%" stop-color="rgba(255,255,235,.15)"/>
      <stop offset="100%" stop-color="rgba(255,255,235,0)"/>
    </radialGradient>
    <clipPath id="clipLua"><circle r="${r}"/></clipPath>
  </defs>
  <circle r="${r + 9}" fill="url(#gBrilho)"/>
  <circle r="${r}" fill="#101014"/>
  <g clip-path="url(#clipLua)">
    <path d="${caminhoFase(fase, r)}" fill="url(#gLua)"/>
    ${craterasMarkup}
  </g>
  <circle r="${r}" fill="none" stroke="rgba(255,255,255,.06)"/>`;
}

function desenharLua(f) { $('luaSvg').innerHTML = svgLua(((f % 1) + 1) % 1); }

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
  const idade = idadeLua(agora);
  const fase = idade / SINODICO;
  const idx = Math.floor(fase * 8 + 0.5) % 8;
  const F = FASES[idx];
  faseReal = fase;

  $('iluminacao').textContent = Math.round(iluminacao(idade) * 100) + '%';
  $('distancia').textContent = Math.round(distanciaLua(agora)).toLocaleString('pt-BR') + ' km';
  $('idade').textContent = `${Math.floor(idade)} dias`;

  const { lon } = posicaoLua(agora);
  const si = Math.floor(norm(lon) / (Math.PI / 6)) % 12;
  const s = SIGNOS[si], n = SIGNOS[(si + 1) % 12];
  $('sinal').innerHTML = `${s[0]} ${s[1]} → ${n[0]} ${n[1]}`;

  const interagindo = faseVisual !== null || rafAnim !== null || ponteiros.size > 0;
  if (!interagindo) {
    desenharLua(fase);
    $('nomeFase').textContent = F.nome;
  }

  const loc = refLocal();
  const { nascer, sePor } = nascerESePorLua(loc.lat, loc.lon);
  $('nascer').textContent = fmtHora(nascer);
  $('sePor').textContent = fmtHora(sePor);
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
  $('iluminacao').textContent = Math.round(iluminacao(fN * SINODICO) * 100) + '%';
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
   ⬇️ INSTALAÇÃO — botão aparece ao entrar, some quando instalado
   ============================================================ */
let deferredPrompt = null;
let resolverPrompt = null;
const btnInstalar = $('btnInstalar');

const rodandoComoApp = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

async function appJaInstaladoNoAparelho() {
  try {
    if (navigator.getInstalledRelatedApps) {
      const apps = await navigator.getInstalledRelatedApps();
      return apps.length > 0;
    }
  } catch (_) {}
  return false;
}

async function atualizarBotaoInstalar() {
  if (rodandoComoApp()) { btnInstalar.hidden = true; return; }
  const jaTem = await appJaInstaladoNoAparelho();
  btnInstalar.hidden = jaTem;   // instalado no aparelho → botão some
}

async function tentarInstalar() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    return true;
  }
  // O evento pode não ter chegado ainda — espera até 6s
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
  const jaTem = await appJaInstaladoNoAparelho();
  if (jaTem) {
    abrirDiag(); // mostra que já está instalado e como abrir
  } else {
    btnInstalar.hidden = false;
    abrirDiag();
  }
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
});

/* ============================================================
   🔧 DIAGNÓSTICO — verifica por que não instala / se já instalou
   ============================================================ */
const diagOverlay = $('diagOverlay');
let diagAbertoPorBotao = false;

function abrirDiag() { diagOverlay.hidden = false; executarDiagnostico(); }
function fecharDiag() { diagOverlay.hidden = true; }
 $('btnDiag').addEventListener('click', () => { diagAbertoPorBotao = true; abrirDiag(); });
 $('diagFechar').addEventListener('click', fecharDiag);
diagOverlay.addEventListener('click', e => { if (e.target === diagOverlay && diagAbertoPorBotao) fecharDiag(); });

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

  /* 1. HTTPS */
  const seguro = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  add(seguro, 'Conexão segura (HTTPS)',
    'Servido via HTTPS — requisito atendido.', null,
    `Está em "${location.protocol}//" — o navegador SÓ instala via HTTPS ou localhost.`);

  /* 2. Service Worker */
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

  /* 3. Manifest */
  let man = null, manErro = '';
  try {
    const r = await fetch('manifest.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    man = await r.json();
  } catch (e) { manErro = e.message; }
  add(!!man, 'manifest.json carregado',
    man ? `"${man.name || 'sem nome'}" — válido.` : null, null,
    `Falhou: ${manErro}. Confira se o arquivo se chama exatamente manifest.json e é um JSON válido.`);

  let camposOk = false;
  if (man) {
    camposOk = !!(man.name && man.start_url != null && man.display &&
                  Array.isArray(man.icons) && man.icons.length >= 1);
    add(camposOk, 'Campos obrigatórios do manifest',
      'name, start_url, display e icons presentes.', null,
      'Faltam campos obrigatórios (name, start_url, display, icons). Substitua o manifest.json pelo da versão nova.');
  }

  /* 4. Ícones */
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
    itens.push(linhaDiag('erro', 'Ícones carregam corretamente',
      'Sem icons no manifest — impossível instalar.'));
  }

  /* 5. Suporte do navegador */
  const suporta = 'onbeforeinstallprompt' in window || 'serviceWorker' in navigator;
  add(suporta, 'Navegador suporta instalação PWA',
    'Chrome/Edge detectado com suporte.', null,
    'Este navegador não suporta instalação. Use o Google Chrome no Android.');

  /* 6. Já está rodando como app? */
  const standalone = rodandoComoApp();
  itens.push(linhaDiag(standalone ? 'ok' : 'alerta', 'Modo de execução',
    standalone ? '✨ Você está DENTRO do app instalado (standalone). Tudo certo!'
               : 'Você está abrindo pelo navegador (aba do Chrome), NÃO pelo app instalado.'));

  /* 7. Instalado no aparelho? */
  let instalado = false, relErro = '';
  try {
    if (navigator.getInstalledRelatedApps) instalado = (await navigator.getInstalledRelatedApps()).length > 0;
  } catch (e) { relErro = e.message; }
  itens.push(linhaDiag(instalado ? 'ok' : 'alerta', 'App instalado no aparelho',
    instalado ? '📦 O Chrome confirma: este app JÁ ESTÁ INSTALADO neste celular!'
              : (relErro ? `Não foi possível verificar (${relErro}).`
                         : 'Nenhum registro de instalação encontrado pelo Chrome.')));

  /* ---------- Veredito ---------- */
  const veredito = $('diagVeredito');
  let texto;
  if (standalone) {
    texto = '🎉 TUDO CERTO!\nVocê está usando o app instalado. O botão "Instalar" fica escondido porque não é mais necessário.';
  } else if (instalado) {
    texto = '📦 O APP JÁ ESTÁ INSTALADO NESTE APARELHO!\n\n' +
      '1. Feche o Chrome.\n' +
      '2. Vá à tela inicial / gaveta de apps do celular.\n' +
      '3. Procure o ícone 🌒 "Fases da Lua" e abra por ele.\n\n' +
      'O botão "Instalar" ficou escondido justamente porque o app já existe. ' +
      'Se quiser reinstalar do zero: segure o ícone → Desinstalar, depois volte aqui e toque em Instalar.';
  } else if (seguro && swOk && controlando && man && camposOk && iconesOk) {
    texto = '✅ TODOS OS REQUISITOS ATENDIDOS!\n\n' +
      'Toque em "⬇ Tentar instalar agora" acima.\n' +
      'Se nada acontecer, instale pelo menu do Chrome: ⋮ (canto superior direito) → "Instalar app" / "Adicionar à tela inicial".\n' +
      'Dica: o Chrome pode demorar alguns segundos após abrir a página para liberar o prompt — aguarde 5s e tente de novo.';
  } else {
    const faltando = [];
    if (!seguro) faltando.push('• Hospedar em HTTPS (GitHub Pages já é HTTPS — confira o endereço)');
    if (!swOk || !controlando) faltando.push('• sw.js na mesma pasta e recarregar a página');
    if (!man || !camposOk) faltando.push('• manifest.json válido e completo');
    if (!iconesOk) faltando.push('• ícones PNG na pasta');
    texto = '❌ REQUISITOS PENDENTES:\n\n' + faltando.join('\n') +
      '\n\nCorrigindo os itens acima, o Chrome libera a instalação.';
  }
  veredito.textContent = texto;
}

 $('diagInstalar').addEventListener('click', async () => {
  const btn = $('diagInstalar');
  btn.textContent = '⏳ Preparando…';
  const ok = await tentarInstalar();
  btn.textContent = ok ? '✅ Prompt enviado!' : '⬇ Tentar instalar agora';
  if (!ok) {
    $('diagVeredito').textContent =
      'O Chrome não liberou o prompt agora.\n\n' +
      'Provavelmente o app JÁ ESTÁ INSTALADO (veja o item "App instalado no aparelho" acima) — ' +
      'abra pelo ícone 🌒 na tela inicial do celular.\n\n' +
      'Ou instale manualmente: menu ⋮ do Chrome → "Instalar app".\n' +
      'Dica: aguarde ~5 segundos após abrir a página e tente de novo.';
  }
  setTimeout(() => { btn.textContent = '⬇ Tentar instalar agora'; }, 2500);
});

/* ================= NAVEGAÇÃO / ESTRELAS / PWA ================= */
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('ativo', x === b));
  document.querySelectorAll('.tab-page').forEach(s => s.classList.toggle('ativo', s.id === b.dataset.tab));
  window.scrollTo({ top: 0 });
}));

function criarEstrelas() {
  for (let i = 0; i < 90; i++) {
    const s = document.createElement('i');
    s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;` +
      `width:${1 + Math.random() * 1.6}px;height:${1 + Math.random() * 1.6}px;` +
      `animation-duration:${2 + Math.random() * 4}s;animation-delay:${Math.random() * 4}s`;
    $('ceu').appendChild(s);
  }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ================= INICIALIZAÇÃO ================= */
criarEstrelas();
renderPlantio();
renderMadeira();
atualizarCeu();
atualizarLua();
setInterval(atualizarCeu, 1000);
setInterval(atualizarLua, 60000);
atualizarBotaoInstalar();

if (LOCAL && LOCAL.lat != null) {
  $('localStatus').textContent = LOCAL.cidade || `${LOCAL.lat.toFixed(4)}, ${LOCAL.lon.toFixed(4)}`;
  const salvo = localStorage.getItem('fdl_clima');
  if (salvo) { const s = JSON.parse(salvo); mostrarClima(s.dados, s.cidade); }
}
gpsAutomatico();
