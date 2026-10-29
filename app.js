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
  const W = canvas.width, H = 1600; // H = alto de la cancha

  // Cancha
  const PX = 50, PY = 50, PW = W - 100, PH = H - 100, HALF = PH / 2;

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

  function drawPitch() {
    const stripes = 10, sh = PH / stripes;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(PX, PY, PW, PH, 28); ctx.clip();
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? '#1d6b39' : '#217a41';
      ctx.fillRect(PX, PY + i * sh, PW, sh);
    }
    ctx.restore();
    const line = 'rgba(255,255,255,.55)';
    ctx.strokeStyle = line; ctx.fillStyle = line; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    const inset = 22, ix = PX + inset, iy = PY + inset, iw = PW - inset * 2, ih = PH - inset * 2, mid = PY + HALF;
    ctx.beginPath(); ctx.roundRect(ix, iy, iw, ih, 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ix, mid); ctx.lineTo(ix + iw, mid); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, mid, 105, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, mid, 7, 0, Math.PI * 2); ctx.fill();
    for (const top of [true, false]) {
      const dir = top ? 1 : -1, y0 = top ? iy : iy + ih;
      const bw = 500, bh = 180, gw = 220, gh = 64;
      ctx.strokeRect(W / 2 - bw / 2, top ? y0 : y0 - bh, bw, bh);
      ctx.strokeRect(W / 2 - gw / 2, top ? y0 : y0 - gh, gw, gh);
      ctx.beginPath(); ctx.arc(W / 2, y0 + dir * 125, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.arc(W / 2, y0 + dir * 125, 88, top ? 0.66 : Math.PI + 0.66, top ? Math.PI - 0.66 : 2 * Math.PI - 0.66);
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

  function drawShirt(cx, cy, color) {
    const r = 42;
    const light = lum(color) > 0.6;
    const outline = light ? 'rgba(15,26,20,.45)' : 'rgba(0,0,0,.45)';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
    const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, shade(color, light ? 0 : 0.07)); g.addColorStop(1, shade(color, light ? -0.1 : -0.07));
    shirtPath(cx, cy, r); ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    // mangas con un tono apenas distinto
    ctx.save();
    shirtPath(cx, cy, r); ctx.clip();
    ctx.fillStyle = shade(color, light ? -0.1 : -0.09);
    ctx.fillRect(cx - r * 1.1, cy - r, r * 0.6, r * 1.1);
    ctx.fillRect(cx + r * 0.5, cy - r, r * 0.6, r * 1.1);
    ctx.restore();
    shirtPath(cx, cy, r); ctx.lineWidth = 2.5; ctx.strokeStyle = outline; ctx.stroke();
    // cuello
    ctx.beginPath();
    ctx.moveTo(cx - 0.38 * r, cy - 0.9 * r);
    ctx.quadraticCurveTo(cx, cy - 0.55 * r, cx + 0.38 * r, cy - 0.9 * r);
    ctx.lineWidth = 4; ctx.strokeStyle = light ? 'rgba(15,26,20,.45)' : shade(color, 0.28); ctx.stroke();
  }

  function drawName(cx, cy, name) {
    ctx.font = '600 27px ' + FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let text = name;
    while (ctx.measureText(text).width > (state.mode === 11 ? 150 : 190) && text.length > 3) text = text.slice(0, -1);
    if (text !== name) text = text.trimEnd() + '…';
    const tw = ctx.measureText(text).width, bw = tw + 30, bh = 40;
    ctx.fillStyle = 'rgba(6,20,13,.72)';
    ctx.beginPath(); ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(text, cx, cy + 1);
  }

  // Posiciones (x, depth) de cada jugador: arquero primero, luego de defensa a ataque
  function positions(formationKey) {
    const lines = formations()[formationKey].lines;
    const out = [{ x: 0.5, d: 115 }];
    const n = lines.length, d0 = 245, d1 = 640;
    lines.forEach((count, i) => {
      const d = n === 1 ? d0 : d0 + (d1 - d0) * i / (n - 1);
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
      const cy = top ? PY + p.d : PY + PH - p.d;
      drawShirt(cx, cy, team.color);
      drawName(cx, cy + 66, name);
    });
    // etiqueta del equipo
    const label = (team.name || '').trim();
    if (label) {
      ctx.font = '700 28px ' + FONT;
      const text = label.toUpperCase();
      const tw = ctx.measureText(text).width;
      const bw = tw + 70, bh = 50, bx = PX + 44, by = top ? PY + 44 : PY + PH - 44 - bh;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh / 2); ctx.fill();
      ctx.fillStyle = team.color; ctx.strokeStyle = 'rgba(15,26,20,.35)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(bx + 27, by + bh / 2, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0f1a14'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(text, bx + 49, by + bh / 2 + 1);
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
  const SIDE = 330; // ancho extra de la imagen cuando hay banca
  function benchNames() {
    const over = (t) => parseNames(t.names).slice(maxPlayers());
    return [...over(state.a), ...over(state.b), ...parseNames(state.bench || '')];
  }

  function headerLines() {
    const i = state.info;
    const l1 = (i.venue || '').trim();
    const l2 = [(i.time || '').trim(), formatPrice(i.price)].filter(Boolean).join('  ·  ');
    return [l1, l2].filter(Boolean);
  }

  function footerLines() {
    const i = state.info;
    if (!i.showAccount) return [];
    return (i.account || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 6);
  }

  function render() {
    const head = headerLines(), foot = footerLines();
    const hasVenue = !!(state.info.venue || '').trim();
    const hasChips = !!((state.info.time || '').trim() || formatPrice(state.info.price));
    const HH = 62 + (hasVenue ? 70 : 0) + (hasChips ? 74 : 0) + (hasChips ? 56 : hasVenue ? 44 : 36);
    const bench = benchNames();
    const TW = W + (bench.length ? SIDE : 0);
    const BH = 0;
    const FH = foot.length ? 60 + 90 + foot.length * 44 : 40;
    canvas.width = TW; canvas.height = HH + H + BH + FH; // reinicia el contexto
    ctx.fillStyle = BG; ctx.fillRect(0, 0, TW, canvas.height);

    // encabezado
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.font = '600 22px ' + FONT;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
    ctx.fillStyle = '#4ade80';
    ctx.fillText(`PILSEN FC  ·  FÚTBOL ${state.mode}`, TW / 2 + 3, 62);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    let y = 62;
    if (hasVenue) {
      y += 70;
      ctx.font = '800 56px ' + FONT; ctx.fillStyle = '#ffffff';
      ctx.fillText(fitText((state.info.venue || '').trim(), TW - 120), TW / 2, y);
    }
    if (hasChips) {
      y += 74;
      const chips = [(state.info.time || '').trim(), formatPrice(state.info.price)].filter(Boolean);
      ctx.font = '600 32px ' + FONT;
      const widths = chips.map(c => ctx.measureText(c).width + 56), gap = 16;
      let x = (TW - (widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1))) / 2;
      chips.forEach((c, k) => {
        ctx.fillStyle = 'rgba(255,255,255,.1)';
        ctx.beginPath(); ctx.roundRect(x, y - 30, widths[k], 60, 30); ctx.fill();
        ctx.fillStyle = '#e7f5ec'; ctx.textAlign = 'center';
        ctx.fillText(c, x + widths[k] / 2, y + 1);
        x += widths[k] + gap;
      });
    }

    // cancha
    ctx.save(); ctx.translate(0, HH);
    drawPitch();
    drawTeam(state.a, true);
    drawTeam(state.b, false);
    ctx.restore();

    // banca (columna a un costado de la cancha)
    if (bench.length) {
      const px = W - 14, pw = TW - px - 40, pad = 26, rowH = 52, headH = 74;
      const cap = Math.floor((PH - headH - pad) / rowH);
      const list = bench.slice(0, cap);
      const ph = headH + list.length * rowH + pad;
      const py = HH + PY;
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 28); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = '600 20px ' + FONT;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
      ctx.fillStyle = '#4ade80';
      ctx.fillText('BANCA', px + pad, py + 44);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.font = '600 27px ' + FONT;
      list.forEach((n, k) => {
        const cy = py + headH + k * rowH + rowH / 2;
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.beginPath(); ctx.arc(px + pad + 5, cy, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e7f5ec';
        ctx.fillText(fitText(n, pw - pad * 2 - 28), px + pad + 26, cy + 1);
      });
    }

    // pie
    const y0 = HH + H + BH;
    if (foot.length) {
      const cw = TW - 160, ch = 50 + foot.length * 44 + 30, cx0 = 80, cy0 = y0 + 6;
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      ctx.beginPath(); ctx.roundRect(cx0, cy0, cw, ch, 28); ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '600 20px ' + FONT;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
      ctx.fillStyle = '#4ade80';
      ctx.fillText('DATOS PARA TRANSFERIR', TW / 2 + 2, cy0 + 40);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.font = '600 31px ' + FONT; ctx.fillStyle = '#ffffff';
      foot.forEach((line, k) => ctx.fillText(fitText(line, cw - 60), TW / 2, cy0 + 90 + k * 44));
    }
  }

  // ---------- UI ----------
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }

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
