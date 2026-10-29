(() => {
  const FORMATIONS_BY_MODE = {
    7: {
      defensiva:   { label: 'Defensiva',   lines: [3, 2, 1] },
      equilibrada: { label: 'Equilibrada', lines: [3, 1, 2] },
      control:     { label: 'Control',     lines: [2, 3, 1] },
      agresiva:    { label: 'Agresiva',    lines: [2, 1, 1, 2] },
    },
    11: {
      defensiva:   { label: 'Defensiva',   lines: [5, 3, 2] },
      equilibrada: { label: 'Equilibrada', lines: [4, 4, 2] },
      control:     { label: 'Control',     lines: [4, 2, 3, 1] },
      agresiva:    { label: 'Agresiva',    lines: [4, 3, 3] },
    },
  };
  const formations = () => FORMATIONS_BY_MODE[state.mode];
  const maxPlayers = () => state.mode;
  const PRESETS = [
    { hex: '#dc2626', name: 'Rojo' },
    { hex: '#ffffff', name: 'Blanco' },
    { hex: '#111827', name: 'Negro' },
    { hex: '#2563eb', name: 'Azul' },
  ];
  const presetOf = (hex) => PRESETS.find(p => p.hex === String(hex).toLowerCase());
  const STORE_KEY = 'futbol7pilsen:v1'; // misma clave para conservar lo ya guardado

  const defaults = () => ({
    a: { name: 'Rojo',   color: '#dc2626', formation: 'equilibrada', names: '' },
    b: { name: 'Blanco', color: '#ffffff', formation: 'equilibrada', names: '' },
  });

  let state = defaults();
  state.mode = 7;
  state.bench = '';
  state.info = { venue: '', time: '', price: '', account: '', showAccount: true };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && saved.a && saved.b) state = { ...state, ...saved, info: { ...state.info, ...(saved.info || {}) } };
  } catch (e) {}

  // el nombre del equipo siempre sigue al color de la camiseta
  [['a', 0], ['b', 1]].forEach(([t, fallback]) => {
    const p = presetOf(state[t].color) || PRESETS[fallback];
    state[t].color = p.hex; state[t].name = p.name;
  });

  const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const BG = '#0b1f17';

  const canvas = document.getElementById('pitch');
  const ctx = canvas.getContext('2d');
  const W = 1080;
  const TARGET_H = 1500; // proporción ~3:4 para que WhatsApp no recorte la miniatura

  // Cancha (alto variable: se ajusta a lo que sobra del encabezado, banca y pie)
  const PX = 40, PW = W - 80;
  let PH = 1000, HALF = 500;

  const parseNames = (text) => text.split('\n').map(s => s.trim()).filter(Boolean);

  function lum(hex) {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(v => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => c(v).toString(16).padStart(2, '0')).join('');
  }

  // Textura de pasto: hebras cortas y puntos sobre un mosaico que se repite
  let grass = null;
  function grassPattern() {
    if (grass) return grass;
    const S = 360, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 4200; i++) {
      const x = rnd() * S, y = rnd() * S, len = 6 + rnd() * 12, ang = (rnd() - 0.5) * 0.8;
      g.strokeStyle = rnd() < 0.5 ? `rgba(190,255,190,${0.04 + rnd() * 0.06})` : `rgba(0,25,5,${0.05 + rnd() * 0.07})`;
      g.lineWidth = 1.2 + rnd() * 1.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(ang) * len, y - Math.cos(ang) * len); g.stroke();
    }
    for (let i = 0; i < 700; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)';
      g.beginPath(); g.arc(rnd() * S, rnd() * S, 1 + rnd() * 2.2, 0, Math.PI * 2); g.fill();
    }
    grass = ctx.createPattern(c, 'repeat');
    return grass;
  }

  function drawPitch() {
    const stripes = 12, sh = PH / stripes;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(PX, 0, PW, PH, 28); ctx.clip();
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? '#1c6a38' : '#237d43';
      ctx.fillRect(PX, i * sh, PW, sh);
    }
    ctx.fillStyle = grassPattern(); ctx.fillRect(PX, 0, PW, PH);
    const vg = ctx.createRadialGradient(W / 2, PH / 2, PH * 0.25, W / 2, PH / 2, PH * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,20,5,.28)');
    ctx.fillStyle = vg; ctx.fillRect(PX, 0, PW, PH);
    ctx.restore();
    const line = 'rgba(255,255,255,.6)';
    ctx.strokeStyle = line; ctx.fillStyle = line; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    const inset = 20, ix = PX + inset, iy = inset, iw = PW - inset * 2, ih = PH - inset * 2, mid = PH / 2;
    ctx.beginPath(); ctx.roundRect(ix, iy, iw, ih, 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ix, mid); ctx.lineTo(ix + iw, mid); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, mid, 95, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, mid, 7, 0, Math.PI * 2); ctx.fill();
    for (const top of [true, false]) {
      const dir = top ? 1 : -1, y0 = top ? iy : iy + ih;
      const bw = 500, bh = 150, gw = 220, gh = 54;
      ctx.strokeRect(W / 2 - bw / 2, top ? y0 : y0 - bh, bw, bh);
      ctx.strokeRect(W / 2 - gw / 2, top ? y0 : y0 - gh, gw, gh);
      ctx.beginPath(); ctx.arc(W / 2, y0 + dir * 105, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.arc(W / 2, y0 + dir * 105, 80, top ? 0.66 : Math.PI + 0.66, top ? Math.PI - 0.66 : 2 * Math.PI - 0.66);
      ctx.stroke();
    }
  }

  function shirtPath(cx, cy, r) {
    const pts = [[-0.38,-0.9],[-1,-0.55],[-0.78,-0.05],[-0.5,-0.2],[-0.5,0.9],[0.5,0.9],[0.5,-0.2],[0.78,-0.05],[1,-0.55],[0.38,-0.9]];
    ctx.beginPath();
    pts.forEach(([x, y], i) => i ? ctx.lineTo(cx + x * r, cy + y * r) : ctx.moveTo(cx + x * r, cy + y * r));
    ctx.quadraticCurveTo(cx, cy - 0.55 * r, cx - 0.38 * r, cy - 0.9 * r);
    ctx.closePath();
  }

  const SHIRT_R = 36;
  function drawShirt(cx, cy, color) {
    const r = SHIRT_R;
    const light = lum(color) > 0.6;
    const outline = light ? 'rgba(15,26,20,.45)' : 'rgba(0,0,0,.45)';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
    const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, shade(color, light ? 0 : 0.07)); g.addColorStop(1, shade(color, light ? -0.1 : -0.07));
    shirtPath(cx, cy, r); ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.save();
    shirtPath(cx, cy, r); ctx.clip();
    ctx.fillStyle = shade(color, light ? -0.1 : -0.09);
    ctx.fillRect(cx - r * 1.1, cy - r, r * 0.6, r * 1.1);
    ctx.fillRect(cx + r * 0.5, cy - r, r * 0.6, r * 1.1);
    ctx.restore();
    shirtPath(cx, cy, r); ctx.lineWidth = 2.5; ctx.strokeStyle = outline; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 0.38 * r, cy - 0.9 * r);
    ctx.quadraticCurveTo(cx, cy - 0.55 * r, cx + 0.38 * r, cy - 0.9 * r);
    ctx.lineWidth = 4; ctx.strokeStyle = light ? 'rgba(15,26,20,.45)' : shade(color, 0.28); ctx.stroke();
  }

  // Nombre grande, apoyado sobre la base de la camiseta
  function drawName(cx, cy, name) {
    const big = state.mode === 7;
    ctx.font = `700 ${big ? 32 : 29}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const maxText = big ? 210 : 148;
    let text = name;
    while (ctx.measureText(text).width > maxText && text.length > 3) text = text.slice(0, -1);
    if (text !== name) text = text.trimEnd() + '…';
    const tw = ctx.measureText(text).width, bw = tw + 28, bh = big ? 44 : 42;
    ctx.fillStyle = 'rgba(4,16,10,.86)';
    ctx.beginPath(); ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(text, cx, cy + 1);
  }

  // Posiciones: x en fracción del ancho, d en fracción de la mitad de la cancha (desde su arco)
  function positions(formationKey) {
    const lines = formations()[formationKey].lines;
    // arquero y líneas equiespaciados: misma distancia arquero-defensas que entre líneas
    const dg = 0.12, d1 = 0.88, n = lines.length;
    const out = [{ x: 0.5, d: dg }];
    lines.forEach((count, i) => {
      const d = dg + (d1 - dg) * (i + 1) / n;
      for (let k = 0; k < count; k++) {
        const m = count >= 5 ? 0.1 : count === 4 ? 0.13 : 0.17;
        const x = count === 1 ? 0.5 : m + (1 - 2 * m) * k / (count - 1);
        out.push({ x, d });
      }
    });
    return out;
  }

  function drawTeam(team, top) {
    const names = parseNames(team.names).slice(0, maxPlayers());
    const pos = positions(team.formation);
    names.forEach((name, i) => {
      const p = pos[i];
      const cx = PX + PW * p.x;
      const cy = top ? p.d * HALF : PH - p.d * HALF;
      drawShirt(cx, cy, team.color);
      drawName(cx, cy + SHIRT_R + 2, name);
    });
    // etiqueta del equipo
    const label = (team.name || '').trim();
    if (label) {
      ctx.font = '700 26px ' + FONT;
      const text = label.toUpperCase();
      const tw = ctx.measureText(text).width;
      const bw = tw + 66, bh = 46, bx = PX + 40, by = top ? 40 : PH - 40 - bh;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh / 2); ctx.fill();
      ctx.fillStyle = team.color; ctx.strokeStyle = 'rgba(15,26,20,.35)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(bx + 26, by + bh / 2, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0f1a14'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(text, bx + 46, by + bh / 2 + 1);
    }
  }

  function formatPrice(v) {
    const n = parseInt(String(v).replace(/\D/g, ''), 10);
    return isNaN(n) ? '' : '$' + n.toLocaleString('es-CL') + ' por jugador';
  }

  function fitText(text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    while (ctx.measureText(text + '…').width > maxW && text.length > 1) text = text.slice(0, -1);
    return text.trimEnd() + '…';
  }

  // Banca: pozo común. Suplentes escritos + los que sobran de cada equipo
  function benchNames() {
    const over = (t) => parseNames(t.names).slice(maxPlayers());
    return [...over(state.a), ...over(state.b), ...parseNames(state.bench || '')];
  }

  const CARD_X = 40, CARD_W = W - 80;

  // Una sola fila si cabe (achicando la letra); si no, continúa en otra línea para no perder nombres
  function benchLayout(names) {
    if (!names.length) return null;
    const label = 34, lw = 118, maxW = CARD_W - label - lw - 34;
    const text = names.join('  ·  ');
    let size = 28;
    ctx.font = `600 ${size}px ${FONT}`;
    while (size > 20 && ctx.measureText(text).width > maxW) { size -= 1; ctx.font = `600 ${size}px ${FONT}`; }
    if (ctx.measureText(text).width <= maxW) return { lines: [text], size, lw, bh: 62 };
    size = 24; ctx.font = `600 ${size}px ${FONT}`;
    const lines = []; let cur = '';
    names.forEach(n => {
      const next = cur ? cur + '  ·  ' + n : n;
      if (cur && ctx.measureText(next).width > maxW) { lines.push(cur); cur = n; } else cur = next;
    });
    lines.push(cur);
    return { lines, size, lw, bh: 34 + lines.length * 34 };
  }

  // Datos de transferencia en texto corrido, hasta 3 líneas, para ahorrar alto
  function footerLayout() {
    const i = state.info;
    if (!i.showAccount) return null;
    const parts = (i.account || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 8);
    if (!parts.length) return null;
    ctx.font = '600 27px ' + FONT;
    const maxW = CARD_W - 70, rows = []; let cur = '';
    parts.forEach(p => {
      const next = cur ? cur + '  ·  ' + p : p;
      if (cur && ctx.measureText(next).width > maxW) { rows.push(cur); cur = p; } else cur = next;
    });
    rows.push(cur);
    return { rows: rows.slice(0, 3), h: 62 + Math.min(rows.length, 3) * 38 };
  }

  function render() {
    const hasVenue = !!(state.info.venue || '').trim();
    const hasChips = !!((state.info.time || '').trim() || formatPrice(state.info.price));
    let ey = 44;                          // centro del texto de marca
    const venueY = hasVenue ? (ey += 58) : 0;
    const chipsY = hasChips ? (ey += 62) : 0;
    const HH = ey + (hasChips ? 26 : hasVenue ? 30 : 14) + 22;

    const bench = benchNames();
    const bl = benchLayout(bench);
    const fl = footerLayout();
    const extra = (bl ? bl.bh + 16 : 0) + (fl ? fl.h + 16 : 0) + 26;
    PH = Math.max(780, Math.min(1260, TARGET_H - HH - extra - 18));
    HALF = PH / 2;
    const CH = HH + PH + 18 + extra;

    canvas.width = W; canvas.height = CH; // reinicia el contexto
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, CH);

    // encabezado
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.font = '600 21px ' + FONT;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
    ctx.fillStyle = '#4ade80';
    ctx.fillText(`PILSEN FC  ·  FÚTBOL ${state.mode}`, W / 2 + 3, 44);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    if (hasVenue) {
      ctx.font = '800 50px ' + FONT; ctx.fillStyle = '#ffffff';
      ctx.fillText(fitText((state.info.venue || '').trim(), W - 100), W / 2, venueY);
    }
    if (hasChips) {
      const chips = [(state.info.time || '').trim(), formatPrice(state.info.price)].filter(Boolean);
      ctx.font = '600 29px ' + FONT;
      const widths = chips.map(c => ctx.measureText(c).width + 50), gap = 14;
      let x = (W - (widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1))) / 2;
      chips.forEach((c, k) => {
        ctx.fillStyle = 'rgba(255,255,255,.1)';
        ctx.beginPath(); ctx.roundRect(x, chipsY - 26, widths[k], 52, 26); ctx.fill();
        ctx.fillStyle = '#e7f5ec'; ctx.textAlign = 'center';
        ctx.fillText(c, x + widths[k] / 2, chipsY + 1);
        x += widths[k] + gap;
      });
    }

    // cancha
    ctx.save(); ctx.translate(0, HH);
    drawPitch();
    drawTeam(state.a, true);
    drawTeam(state.b, false);
    ctx.restore();

    let y = HH + PH + 18;

    // banca: fila de texto bajo la cancha
    if (bl) {
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      ctx.beginPath(); ctx.roundRect(CARD_X, y, CARD_W, bl.bh, Math.min(30, bl.bh / 2)); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = '600 20px ' + FONT;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
      ctx.fillStyle = '#4ade80';
      const firstY = bl.lines.length === 1 ? y + bl.bh / 2 : y + 17 + 17;
      ctx.fillText('BANCA', CARD_X + 34, firstY + 1);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.font = `600 ${bl.size}px ${FONT}`; ctx.fillStyle = '#e7f5ec';
      bl.lines.forEach((line, k) => ctx.fillText(line, CARD_X + 34 + bl.lw, firstY + 1 + k * 34));
      y += bl.bh + 16;
    }

    // pie
    if (fl) {
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      ctx.beginPath(); ctx.roundRect(CARD_X, y, CARD_W, fl.h, 28); ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '600 19px ' + FONT;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
      ctx.fillStyle = '#4ade80';
      ctx.fillText('DATOS PARA TRANSFERIR', W / 2 + 2, y + 30);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.font = '600 27px ' + FONT; ctx.fillStyle = '#ffffff';
      fl.rows.forEach((row, k) => ctx.fillText(fitText(row, CARD_W - 50), W / 2, y + 66 + k * 38));
    }
  }

  // ---------- UI ----------
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }
  // refuerzo: guardar también al salir o pasar a segundo plano (navegadores móviles)
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });

  function update() {
    for (const t of ['a', 'b']) {
      const n = parseNames(state[t].names).length;
      const el = document.getElementById('count-' + t);
      const max = maxPlayers();
      el.textContent = n > max ? `${max} en cancha · ${n - max} a la banca` : `${n} de ${max} jugadores`;
    }
    save(); render();
  }

  function miniSvg(lines) {
    const n = lines.length;
    let dots = '<circle cx="17" cy="40" r="2.6"/>';
    lines.forEach((c, i) => {
      const y = 31 - i * (22 / Math.max(n - 1, 1)) * (n > 1 ? 1 : 0) - (n === 1 ? 10 : 0);
      for (let k = 0; k < c; k++) dots += `<circle cx="${c === 1 ? 17 : 6 + 22 * k / (c - 1)}" cy="${y.toFixed(1)}" r="2.6"/>`;
    });
    return `<svg viewBox="0 0 34 44" aria-hidden="true"><rect x="0" y="0" width="34" height="44" rx="5"/>${dots}</svg>`;
  }

  function buildTeamUI(t) {
    const colors = document.querySelector(`.colors[data-team="${t}"]`);
    colors.innerHTML = '';
    PRESETS.forEach(p => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'swatch';
      b.innerHTML = `<i style="background:${p.hex}"></i>${p.name}`;
      b.classList.toggle('active', state[t].color === p.hex);
      b.onclick = () => { state[t].color = p.hex; state[t].name = p.name; buildTeamUI(t); update(); };
      colors.appendChild(b);
    });
    document.getElementById('tname-' + t).textContent = state[t].name;

    const fm = document.querySelector(`.formations[data-team="${t}"]`);
    fm.innerHTML = '';
    Object.entries(formations()).forEach(([key, f]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `${miniSvg(f.lines)}${f.label}<small>${f.lines.join('-')}</small>`;
      b.classList.toggle('active', state[t].formation === key);
      b.onclick = () => { state[t].formation = key; buildTeamUI(t); update(); };
      fm.appendChild(b);
    });
  }

  for (const t of ['a', 'b']) {
    buildTeamUI(t);
    const ta = document.getElementById('names-' + t);
    ta.value = state[t].names;
    ta.addEventListener('input', () => { state[t].names = ta.value; update(); });
  }

  const modeBtns = document.querySelectorAll('#mode button');
  function syncMode() {
    modeBtns.forEach(b => b.classList.toggle('active', Number(b.dataset.mode) === state.mode));
    buildTeamUI('a'); buildTeamUI('b');
  }
  modeBtns.forEach(b => b.onclick = () => { state.mode = Number(b.dataset.mode); syncMode(); update(); });
  syncMode();

  const infoIds = { venue: 'info-venue', time: 'info-time', price: 'info-price', account: 'info-account' };
  Object.entries(infoIds).forEach(([k, id]) => {
    const el = document.getElementById(id);
    el.value = state.info[k] || '';
    el.addEventListener('input', () => { state.info[k] = el.value; update(); });
  });
  const bn = document.getElementById('info-bench');
  bn.value = state.bench || '';
  bn.addEventListener('input', () => { state.bench = bn.value; update(); });

  const showAcc = document.getElementById('info-show-account');
  showAcc.checked = !!state.info.showAccount;
  showAcc.addEventListener('change', () => { state.info.showAccount = showAcc.checked; update(); });

  document.getElementById('clear').onclick = () => {
    if (!confirm('¿Borrar todos los nombres?')) return;
    state.a.names = ''; state.b.names = ''; state.bench = '';
    document.getElementById('info-bench').value = '';
    document.getElementById('names-a').value = ''; document.getElementById('names-b').value = '';
    update();
  };

  document.getElementById('shuffle').onclick = () => {
    const all = [...parseNames(state.a.names), ...parseNames(state.b.names)];
    if (all.length < 2) return alert('Agrega nombres primero (en cualquiera de los dos equipos).');
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    const half = Math.ceil(all.length / 2);
    state.a.names = all.slice(0, half).join('\n');
    state.b.names = all.slice(half).join('\n');
    document.getElementById('names-a').value = state.a.names;
    document.getElementById('names-b').value = state.b.names;
    update();
  };

  const toBlob = () => new Promise(res => canvas.toBlob(res, 'image/png'));
  const fileName = () => 'pilsen-fc-formacion.png';

  document.getElementById('download').onclick = async () => {
    const blob = await toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const shareBtn = document.getElementById('share');
  if (navigator.canShare && navigator.canShare({ files: [new File([], 'x.png', { type: 'image/png' })] })) {
    shareBtn.hidden = false;
    shareBtn.onclick = async () => {
      const blob = await toBlob();
      try { await navigator.share({ files: [new File([blob], fileName(), { type: 'image/png' })] }); } catch (e) {}
    };
  }

  update();
  if (document.fonts && document.fonts.load) {
    Promise.all(['500', '600', '700', '800'].map(w => document.fonts.load(`${w} 30px Inter`))).then(update).catch(() => {});
  }
})();
