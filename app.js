(() => {
  const FORMATIONS = {
    defensiva:   { label: 'Defensiva',   lines: [3, 2, 1] },
    equilibrada: { label: 'Equilibrada', lines: [3, 1, 2] },
    control:     { label: 'Control',     lines: [2, 3, 1] },
    agresiva:    { label: 'Agresiva',    lines: [2, 1, 1, 2] },
  };
  const PRESETS = ['#dc2626', '#ffffff', '#2563eb', '#facc15', '#111827', '#16a34a', '#f97316', '#9333ea'];
  const MAX_PLAYERS = 7;
  const STORE_KEY = 'futbol7pilsen:v1';

  const defaults = () => ({
    a: { name: 'Rojo',   color: '#dc2626', formation: 'equilibrada', names: '' },
    b: { name: 'Blanco', color: '#ffffff', formation: 'equilibrada', names: '' },
  });

  let state = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && saved.a && saved.b) state = saved;
  } catch (e) {}

  const canvas = document.getElementById('pitch');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

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
    // pasto con franjas
    const stripes = 10, sh = PH / stripes;
    ctx.fillStyle = '#0b3d1d'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? '#2f9e44' : '#37b24d';
      ctx.fillRect(PX, PY + i * sh, PW, sh);
    }
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    ctx.strokeRect(PX, PY, PW, PH);
    // medio campo
    ctx.beginPath(); ctx.moveTo(PX, PY + HALF); ctx.lineTo(PX + PW, PY + HALF); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, PY + HALF, 110, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.arc(W / 2, PY + HALF, 8, 0, Math.PI * 2); ctx.fill();
    // áreas y arcos (arriba y abajo)
    for (const top of [true, false]) {
      const dir = top ? 1 : -1, y0 = top ? PY : PY + PH;
      const bw = 520, bh = 190, gw = 240, gh = 70;
      ctx.strokeRect(W / 2 - bw / 2, top ? y0 : y0 - bh, bw, bh);
      ctx.strokeRect(W / 2 - gw / 2, top ? y0 : y0 - gh, gw, gh);
      ctx.beginPath(); ctx.arc(W / 2, y0 + dir * 135, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.arc(W / 2, y0 + dir * 135, 90, top ? 0.65 : Math.PI + 0.65 - 0.0, top ? Math.PI - 0.65 : 2 * Math.PI - 0.65 + 0.0);
      ctx.stroke();
      // arco
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(W / 2 - 80, top ? y0 - 22 : y0, 160, 22);
      ctx.fillStyle = 'rgba(255,255,255,.9)';
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
    const outline = light ? '#475569' : 'rgba(0,0,0,.55)';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
    shirtPath(cx, cy, r); ctx.fillStyle = color; ctx.fill();
    ctx.restore();
    // mangas más oscuras para dar volumen
    ctx.save();
    shirtPath(cx, cy, r); ctx.clip();
    ctx.fillStyle = shade(color, light ? -0.08 : 0.08);
    ctx.fillRect(cx - r * 1.1, cy - r, r * 0.6, r * 1.1);
    ctx.fillRect(cx + r * 0.5, cy - r, r * 0.6, r * 1.1);
    ctx.restore();
    shirtPath(cx, cy, r); ctx.lineWidth = 3.5; ctx.strokeStyle = outline; ctx.stroke();
    // cuello
    ctx.beginPath();
    ctx.moveTo(cx - 0.38 * r, cy - 0.9 * r);
    ctx.quadraticCurveTo(cx, cy - 0.55 * r, cx + 0.38 * r, cy - 0.9 * r);
    ctx.lineWidth = 5; ctx.strokeStyle = light ? '#475569' : shade(color, 0.3); ctx.stroke();
  }

  function drawName(cx, cy, name) {
    ctx.font = '700 30px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let text = name;
    while (ctx.measureText(text).width > 200 && text.length > 3) text = text.slice(0, -1);
    if (text !== name) text = text.trimEnd() + '…';
    ctx.lineWidth = 7; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(text, cx, cy);
    ctx.fillStyle = '#fff'; ctx.fillText(text, cx, cy);
  }

  // Posiciones (x, depth) de cada jugador: arquero primero, luego de defensa a ataque
  function positions(formationKey) {
    const lines = FORMATIONS[formationKey].lines;
    const out = [{ x: 0.5, d: 115 }];
    const n = lines.length, d0 = 245, d1 = 640;
    lines.forEach((count, i) => {
      const d = n === 1 ? d0 : d0 + (d1 - d0) * i / (n - 1);
      for (let k = 0; k < count; k++) {
        const x = count === 1 ? 0.5 : 0.17 + 0.66 * k / (count - 1);
        out.push({ x, d });
      }
    });
    return out;
  }

  function drawTeam(team, top) {
    const names = parseNames(team.names).slice(0, MAX_PLAYERS);
    const pos = positions(team.formation);
    names.forEach((name, i) => {
      const p = pos[i];
      const cx = PX + PW * p.x;
      const cy = top ? PY + p.d : PY + PH - p.d;
      drawShirt(cx, cy, team.color);
      drawName(cx, cy + 60, name);
    });
    // etiqueta del equipo
    const label = (team.name || '').trim();
    if (label) {
      ctx.font = '800 34px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      const tw = ctx.measureText(label.toUpperCase()).width;
      const bw = tw + 60, bh = 54, bx = PX + 20, by = top ? PY + 20 : PY + PH - 20 - bh;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 27); ctx.fill();
      ctx.fillStyle = team.color; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bx + 27, by + bh / 2, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label.toUpperCase(), bx + 48, by + bh / 2 + 1);
    }
  }

  function render() {
    drawPitch();
    drawTeam(state.a, true);
    drawTeam(state.b, false);
    ctx.font = '600 22px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillText('futbol7pilsen', W - PX - 14, H - PY - 12 - 0);
  }

  // ---------- UI ----------
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }

  function update() {
    for (const t of ['a', 'b']) {
      const n = parseNames(state[t].names).length;
      const el = document.getElementById('count-' + t);
      el.textContent = n > MAX_PLAYERS ? `${n} nombres: solo caben ${MAX_PLAYERS} (se ignoran los últimos)` : `${n} de ${MAX_PLAYERS} jugadores`;
      el.classList.toggle('warn', n > MAX_PLAYERS);
    }
    save(); render();
  }

  function buildTeamUI(t) {
    const colors = document.querySelector(`.colors[data-team="${t}"]`);
    colors.innerHTML = '';
    PRESETS.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'swatch'; b.style.background = c; b.setAttribute('aria-label', 'Color ' + c);
      b.classList.toggle('active', state[t].color.toLowerCase() === c);
      b.onclick = () => { state[t].color = c; buildTeamUI(t); update(); };
      colors.appendChild(b);
    });
    const pick = document.createElement('input');
    pick.type = 'color'; pick.value = state[t].color; pick.title = 'Otro color';
    pick.oninput = () => { state[t].color = pick.value; colors.querySelectorAll('.swatch').forEach(s => s.classList.remove('active')); update(); };
    colors.appendChild(pick);

    const fm = document.querySelector(`.formations[data-team="${t}"]`);
    fm.innerHTML = '';
    Object.entries(FORMATIONS).forEach(([key, f]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `${f.label}<small>${f.lines.join('-')}</small>`;
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
    const nm = document.querySelector(`.team-name[data-team="${t}"]`);
    nm.value = state[t].name;
    nm.addEventListener('input', () => { state[t].name = nm.value; update(); });
  }

  document.getElementById('clear').onclick = () => {
    if (!confirm('¿Borrar todos los nombres?')) return;
    state.a.names = ''; state.b.names = '';
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
  const fileName = () => 'futbol7pilsen-formacion.png';

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
})();
