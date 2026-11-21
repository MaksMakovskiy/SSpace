// «Просторный интерфейс»: big side panels for «Эффекты» and «Орбита» (the planet stays visible on the left), an orbit
// map you can drag things on, multi-column windows. Built only from the editor's own classes and theme variables,
// so every theme — the plain ones and the themed ones (Ангелы, Сбой, Машины, Рой) — styles it as its own.
export async function activate(ss, mod) {
  const {h} = ss.util, W = ss.ui.w;
  const css = await fetch(new URL('wide.css', mod.baseUrl)).then(r => (r.ok ? r.text() : '')).catch(() => '');
  const style = document.createElement('style'); style.dataset.mod = 'wide-ui'; style.textContent = css; document.head.appendChild(style);
  const onPlanet = () => ss.space && ss.space.nav.level === 'planet';
  const cssVar = (n, d) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d;
  const fmt = (p) => (v) => (p.step && p.step < 1 ? Number(v).toFixed(Math.min(3, String(p.step).split('.')[1].length)) : v);

  // ================= ОРБИТА =================
  if (ss.orbit) {
    const O = ss.orbit;
    const GROUPS = [['Положение', ['radius', 'outer', 'inner', 'rmin', 'rmax', 'angle', 'lat', 'tilt', 'node', 'gap', 'lanes']], ['Движение', ['spin', 'speed', 'rot', 'climb', 'pulse']]];
    const groupOf = (id) => { for (const [g, ids] of GROUPS) if (ids.includes(id)) return g; return 'Вид'; };
    let selected = null, catQuery = '', catGroup = '';

    // ---- the orbit map: seen from above, planet in the middle; drag to move things ----
    function orbitMap(onPick) {
      const cv = h('canvas', {class: 'wu-map'}), tip = h('div', {class: 'wu-maptip', hidden: true});
      const wrap = h('div', {class: 'wu-mapwrap'}, cv, tip, h('div', {class: 'wu-maphint'}, 'Вид сверху, без наклона орбит. Тащи объект: кольца — ближе или дальше, станции и луны — ещё и по кругу.'));
      const RMAX = 4.7;
      let drag = null, temp = null, raf = 0, hover = null;
      const geom = () => { const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; return {w: r.width, hgt: r.height, dpr, cx: r.width / 2, cy: r.height / 2, k: Math.min(r.width, r.height) / 2 / RMAX}; };
      const itemsNow = () => O.items().map(it => (temp && temp.id === it.id ? {...it, ...temp.patch} : it));
      function draw() {
        raf = 0;
        const g = geom(); if (!g.w) return;
        if (cv.width !== Math.round(g.w * g.dpr) || cv.height !== Math.round(g.hgt * g.dpr)) { cv.width = Math.round(g.w * g.dpr); cv.height = Math.round(g.hgt * g.dpr); }
        const c = cv.getContext('2d'); c.setTransform(g.dpr, 0, 0, g.dpr, 0, 0); c.clearRect(0, 0, g.w, g.hgt);
        const fg = cssVar('--fg', '#e6e9f2'), muted = cssVar('--muted', '#8a93a8'), accent = cssVar('--accent', '#ff5a3c'), warn = cssVar('--warn', '#ffb020');
        // scale circles
        c.font = '10px ' + (getComputedStyle(document.body).fontFamily || 'sans-serif'); c.textAlign = 'left'; c.textBaseline = 'middle';
        for (let r = 1.5; r <= RMAX; r += 0.5) { c.strokeStyle = muted; c.globalAlpha = r % 1 ? 0.12 : 0.25; c.setLineDash([2, 4]); c.beginPath(); c.arc(g.cx, g.cy, r * g.k, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); if (!(r % 1)) { c.globalAlpha = 0.55; c.fillStyle = muted; c.fillText(r.toFixed(0) + ' R', g.cx + r * g.k + 3, g.cy - 6); } }
        c.globalAlpha = 1;
        // the planet
        const pg = c.createRadialGradient(g.cx - g.k * 0.3, g.cy - g.k * 0.3, g.k * 0.1, g.cx, g.cy, g.k);
        pg.addColorStop(0, '#5b7fb8'); pg.addColorStop(1, '#13203a'); c.fillStyle = pg; c.beginPath(); c.arc(g.cx, g.cy, g.k, 0, Math.PI * 2); c.fill();
        const bad = O.conflicts(), its = itemsNow();
        for (const it of its) {
          const b = O.bandOf(it); if (!b || it.hidden) continue;
          const sel = it.id === selected, clash = bad.has(it.id), col = it.color || fg, edge = clash ? warn : sel ? accent : col;
          if (b.kind === 'body') {
            const a = (it.angle || 0) * Math.PI / 180, r = (b.a + b.b) / 2, x = g.cx + Math.cos(a) * r * g.k, y = g.cy + Math.sin(a) * r * g.k;
            c.strokeStyle = muted; c.globalAlpha = 0.25; c.beginPath(); c.arc(g.cx, g.cy, r * g.k, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
            const rad = Math.max(5, (b.b - b.a) / 2 * g.k);
            c.fillStyle = col; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
            c.lineWidth = sel || clash ? 2.5 : 1.2; c.strokeStyle = edge; c.stroke(); c.lineWidth = 1;
          } else {
            const ra = Math.max(b.a, 1) * g.k, rb = Math.max(b.b, b.a + 0.01) * g.k;
            c.fillStyle = col; c.globalAlpha = b.kind === 'cloud' ? 0.14 : 0.32;
            c.beginPath(); c.arc(g.cx, g.cy, rb, 0, Math.PI * 2); c.arc(g.cx, g.cy, ra, 0, Math.PI * 2, true); c.fill('evenodd');
            c.globalAlpha = 1; c.strokeStyle = edge; c.lineWidth = sel || clash ? 2.2 : 1; if (b.kind === 'cloud') c.setLineDash([3, 3]);
            c.beginPath(); c.arc(g.cx, g.cy, ra, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(g.cx, g.cy, rb, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); c.lineWidth = 1;
          }
        }
        if (hover && !drag) { c.fillStyle = fg; c.globalAlpha = 0.8; c.textAlign = 'center'; c.fillText(hover.label, hover.x, hover.y - 14); c.globalAlpha = 1; }
      }
      const redraw = () => { if (!raf) raf = requestAnimationFrame(draw); };
      // what is under the pointer: bodies first, then the narrowest band
      function hit(e) {
        const g = geom(), r0 = cv.getBoundingClientRect(), x = e.clientX - r0.left - g.cx, y = e.clientY - r0.top - g.cy, rr = Math.hypot(x, y) / g.k;
        let best = null;
        for (const it of itemsNow()) {
          const b = O.bandOf(it); if (!b || it.hidden) continue;
          if (b.kind === 'body') { const a = (it.angle || 0) * Math.PI / 180, r = (b.a + b.b) / 2, d = Math.hypot(x - Math.cos(a) * r * g.k, y - Math.sin(a) * r * g.k); if (d < Math.max(9, (b.b - b.a) / 2 * g.k + 4)) return {it, b, rr}; }
          else if (rr >= b.a - 0.04 && rr <= b.b + 0.04 && (!best || b.b - b.a < best.b.b - best.b.a)) best = {it, b, rr};
        }
        return best ? {...best, rr} : null;
      }
      const nameOf = (it) => it.name || (O.types.get(it.type) || {}).name || it.type;
      cv.addEventListener('pointermove', (e) => {
        if (drag) {
          const g = geom(), r0 = cv.getBoundingClientRect(), x = e.clientX - r0.left - g.cx, y = e.clientY - r0.top - g.cy, rr = Math.hypot(x, y) / g.k;
          const it = drag.it, d = Math.max(1.03 - drag.b.a, rr - drag.rr0), patch = {};
          for (const k of ['radius', 'outer', 'rmin', 'rmax', 'inner']) if (typeof it[k] === 'number') patch[k] = +(it[k] + d).toFixed(3);
          if (drag.b.kind === 'body') patch.angle = Math.round(((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360);
          temp = {id: it.id, patch}; tip.hidden = false; tip.textContent = `${nameOf(it)} · ${(drag.b.a + d).toFixed(2)}–${(drag.b.b + d).toFixed(2)} R` + (patch.angle !== undefined ? ` · ${patch.angle}°` : '');
          tip.style.left = (e.clientX - r0.left + 14) + 'px'; tip.style.top = (e.clientY - r0.top + 10) + 'px';
          redraw(); return;
        }
        const t = hit(e), r0 = cv.getBoundingClientRect();
        hover = t ? {label: nameOf(t.it), x: e.clientX - r0.left, y: e.clientY - r0.top} : null;
        cv.style.cursor = t ? 'grab' : ''; redraw();
      });
      cv.addEventListener('pointerdown', (e) => {
        const t = hit(e); if (!t) return;
        e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {} cv.style.cursor = 'grabbing';
        drag = {it: t.it, b: t.b, rr0: t.rr}; selected = t.it.id; onPick(t.it.id); redraw();
      });
      const end = () => {
        if (!drag) return;
        const t = temp; drag = null; temp = null; tip.hidden = true; cv.style.cursor = '';
        if (t && Object.keys(t.patch).length) O.update(t.id, t.patch); else redraw();
      };
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
      cv.addEventListener('pointerleave', () => { hover = null; redraw(); });
      const ro = new ResizeObserver(redraw); ro.observe(cv);
      return {el: wrap, redraw, destroy: () => { ro.disconnect(); cancelAnimationFrame(raf); }};
    }

    // ---- settings of the selected object, grouped in columns ----
    function editor(box, it) {
      box.innerHTML = '';
      const t = it && O.types.get(it.type);
      if (!it || !t) { box.appendChild(W.note('Выбери объект на схеме или в списке — здесь появятся его настройки.')); return; }
      const head = h('div', {class: 'wu-edhead'}, ss.themes.icon(t.icon || 'dots', 'wu-edico'), h('div', null, h('b', null, it.name || t.name), t.desc ? h('small', null, t.desc) : null));
      const cols = h('div', {class: 'wu-cols'}), groups = new Map();
      for (const p of t.params) {
        const g = p.kind === 'color' ? 'Цвета' : groupOf(p.id);
        if (!groups.has(g)) groups.set(g, h('div', {class: 'set-card wu-group'}, h('div', {class: 'set-title'}, g)));
        const card = groups.get(g);
        if (p.kind === 'color') {
          const c = h('input', {type: 'color', class: 'color', value: it[p.id]}); c.addEventListener('change', () => O.update(it.id, {[p.id]: c.value}));
          card.appendChild(h('label', {class: 'check'}, c, p.name));
        } else card.appendChild(W.slider({id: 'wu_' + p.id, label: p.name, min: p.min, max: p.max, step: p.step || 1, value: it[p.id], format: fmt(p), onChange: v => O.update(it.id, {[p.id]: v})}));
      }
      for (const g of ['Положение', 'Вид', 'Движение', 'Цвета']) if (groups.has(g)) cols.appendChild(groups.get(g));
      const copyOf = () => { const c = {...it}; delete c.id; delete c.auto; delete c.hidden; delete c.fromGen; delete c._seed; return c; };
      box.append(head, cols, h('div', {class: 'btnrow'},
        h('button', {onclick: () => O.add(it.type, {...copyOf(), autoPlace: true})}, 'Копия рядом'),
        h('button', {onclick: () => O.update(it.id, {hidden: !it.hidden})}, it.hidden ? 'Показать' : 'Скрыть'),
        h('button', {class: 'danger', onclick: () => { O.remove(it.id); selected = null; }}, 'Убрать с орбиты')));
    }

    ss.reg.dialogs.register({id: 'orbit-studio', title: 'Орбита', icon: 'orbit', side: true, width: 980,
      subtitle: () => `объектов: ${ss.doc ? O.items().length : 0}`,
      sections: [
        {id: 'map', label: 'Схема и настройки', icon: 'orbit', render(p, api) {
          if (!ss.doc || !onPlanet()) { p.appendChild(W.note('Открой планету.')); return; }
          if (O.selected) selected = O.selected;
          const list = h('div', {class: 'wu-olist'}), ed = h('div', {class: 'wu-editor'}), warnBox = h('div');
          const map = orbitMap((id) => { O.select(id); });
          const top = h('div', {class: 'wu-orbit'}, h('div', {class: 'wu-left'}, map.el, warnBox, list), ed);
          p.append(top);
          let lastSel = null;
          const update = () => {
            const its = O.items(), bad = O.conflicts();
            selected = O.selected; map.redraw();
            warnBox.innerHTML = '';
            if (bad.size) warnBox.appendChild(h('div', {class: 'orbit-warn'}, h('span', null, `Пересекаются: ${bad.size} — подсвечены жёлтым`), h('button', {onclick: () => { const n = O.arrange(); ss.ui.toast(n ? `Передвинуто: ${n}` : 'Нечего двигать'); }}, 'Разложить без пересечений')));
            list.innerHTML = '';
            if (!its.length) list.appendChild(W.note('На орбите пусто. Добавь что-нибудь из каталога.'));
            for (const it of its) {
              const t = O.types.get(it.type), b = O.bandOf(it);
              list.appendChild(h('div', {class: 'wu-orow' + (it.id === selected ? ' sel' : '') + (bad.has(it.id) ? ' clash' : '') + (it.hidden ? ' off' : ''), onclick: () => O.select(it.id)},
                h('span', {class: 'wu-sw', style: {background: it.color || 'var(--fg)'}}),
                ss.themes.icon(t ? t.icon : 'help', 'wu-oico'),
                h('span', {class: 'wu-oname'}, (it.name || (t ? t.name : it.type)) + (it.auto ? ' · от генератора' : '')),
                h('small', null, b ? `${b.a.toFixed(2)}–${b.b.toFixed(2)} R` : ''),
                h('button', {class: 'wu-mini', title: it.hidden ? 'Показать' : 'Скрыть', onclick: (e) => { e.stopPropagation(); O.update(it.id, {hidden: !it.hidden}); }}, it.hidden ? '○' : '●'),
                h('button', {class: 'wu-mini', title: 'Убрать', onclick: (e) => { e.stopPropagation(); O.remove(it.id); }}, '×')));
            }
            // the editor is rebuilt when the selection or the object changes, never under a dragged slider
            const it = its.find(x => x.id === selected), key = it ? JSON.stringify(it) : '';
            if (key !== lastSel) { lastSel = key; editor(ed, it); }
          };
          const offs = ['orbit:changed', 'orbit:types', 'doc:loaded', 'look:changed'].map(e => ss.hooks.on(e, update));
          update();
          return () => { offs.forEach(o => o()); map.destroy(); };
        }},
        {id: 'add', label: 'Каталог', icon: 'plus', render(p, api) {
          if (!ss.doc || !onPlanet()) { p.appendChild(W.note('Открой планету.')); return; }
          const search = h('input', {class: 'field', type: 'search', placeholder: 'Найти: станция, кольцо, астероиды, лёд…', value: catQuery});
          const chips = h('div', {class: 'wu-chips'}), grid = h('div', {class: 'wu-grid'});
          const render = () => {
            catQuery = search.value.trim().toLowerCase();
            const types = [...O.types.values()], groups = [...new Set(types.map(t => t.group || 'Другое'))];
            chips.innerHTML = '';
            for (const g of ['', ...groups]) chips.appendChild(h('button', {class: 'wu-chip' + (catGroup === g ? ' on' : ''), onclick: () => { catGroup = g; render(); }}, g || 'Все'));
            grid.innerHTML = '';
            const count = new Map(); for (const it of O.items()) count.set(it.type, (count.get(it.type) || 0) + 1);
            for (const t of types) {
              const g = t.group || 'Другое';
              if (catGroup && g !== catGroup) continue;
              if (catQuery && !(t.name + ' ' + g + ' ' + (t.desc || '')).toLowerCase().includes(catQuery)) continue;
              const n = count.get(t.id) || 0;
              grid.appendChild(h('button', {class: 'wu-card', title: 'Добавить на орбиту — встанет в свободное место', onclick: () => { O.add(t.id); ss.ui.toast(`«${t.name}» добавлен на свободную орбиту`); api.setSection('map'); }},
                h('div', {class: 'wu-cardtop'}, ss.themes.icon(t.icon || 'dots', 'wu-cardico'), n ? h('span', {class: 'pill'}, '×' + n) : null),
                h('b', null, t.name), h('small', null, t.desc || g)));
            }
            if (!grid.children.length) grid.appendChild(W.note('Ничего не нашлось.'));
          };
          search.addEventListener('input', render);
          p.append(h('div', {class: 'wu-cathead'}, search), chips, grid); render();
          setTimeout(() => search.focus(), 30);
        }},
      ]});
  }

  // ================= ЭФФЕКТЫ =================
  if (ss.particles) {
    const P = ss.particles;
    const PRESETS = ['#ffffff', '#d8ecff', '#8fb4ff', '#7fe3ff', '#7fe3b0', '#b8ff6a', '#ffe08a', '#ffb347', '#ff7a3a', '#ff4a4a', '#c39bff', '#ff7ad9', '#9a9a9a', '#5a4a40'];
    const TUNE = [{id: 'density', label: 'Плотность', min: 5, max: 300}, {id: 'speed', label: 'Скорость', min: 0, max: 300}, {id: 'size', label: 'Размер частиц', min: 20, max: 300}, {id: 'opacity', label: 'Яркость', min: 10, max: 200}];
    let q = '', grp = '';
    const card = (e, redraw) => {
      const f = P.fxOf(e.key), tune = e.kind === 'particles' ? TUNE : TUNE.filter(t => (e.tune || []).includes(t.id));
      const box = h('div', {class: 'set-card wu-fx'},
        h('div', {class: 'wu-fxhead'}, ss.themes.icon(e.icon, 'wu-fxico'), h('b', null, e.name), e.mod ? h('span', {class: 'fx-mod'}, e.mod) : null,
          h('button', {class: 'wu-mini', title: 'Выключить на этой планете', onclick: () => P.toggleLook(e.key, false)}, '×')));
      if (e.note) box.appendChild(h('small', {class: 'wu-fxnote'}, e.note));
      if (tune.length) box.appendChild(h('div', {class: 'wu-fxsliders'}, tune.map(t => W.slider({id: 'wfx-' + e.key + '-' + t.id, label: t.label, min: t.min, max: t.max, step: 5, value: Math.round(f[t.id] * 100), format: v => v + '%', onInput: v => P.setFx(e.key, {[t.id]: v / 100})}))));
      if (e.kind === 'particles') {
        const cur = (f.color || '').toLowerCase();
        const own = h('button', {class: 'fx-own' + (cur ? '' : ' on'), style: {background: e.colors.length > 1 ? `linear-gradient(90deg, ${e.colors.join(', ')})` : (e.colors[0] || '#fff')}, onclick: () => { P.setFx(e.key, {color: ''}); redraw(); }}, 'свои');
        const pick = h('input', {type: 'color', class: 'color', value: cur || e.colors[0] || '#ffffff', title: 'Свой цвет'}); pick.addEventListener('change', () => { P.setFx(e.key, {color: pick.value}); redraw(); });
        box.appendChild(h('div', {class: 'fx-swatches wu-sw-row'}, own, PRESETS.map(c => h('button', {class: c === cur ? 'on' : '', style: {background: c}, title: c, onclick: () => { P.setFx(e.key, {color: c}); redraw(); }})), pick));
      }
      box.appendChild(h('div', {class: 'btnrow'}, h('button', {onclick: () => { P.setFx(e.key, null); redraw(); }}, 'Сбросить')));
      return box;
    };
    ss.reg.dialogs.register({id: 'fx-studio', title: 'Эффекты', icon: 'sparkles', side: true, width: 1000,
      subtitle: () => `включено: ${ss.doc ? P.list().filter(e => P.lookOf()[e.key]).length : 0} из ${P.list().length}`,
      sections: [
        {id: 'on', label: 'На этой планете', icon: 'planet', render(p, api) {
          if (!ss.doc || !onPlanet()) { p.appendChild(W.note('Открой планету.')); return; }
          const grid = h('div', {class: 'wu-fxgrid'});
          const redraw = () => {
            grid.innerHTML = '';
            const on = P.list().filter(e => P.lookOf()[e.key]);
            if (!on.length) grid.appendChild(h('div', {class: 'wu-empty'}, W.note('На этой планете эффектов нет.'), h('button', {class: 'primary', onclick: () => api.setSection('add')}, 'Открыть каталог эффектов')));
            for (const e of on) grid.appendChild(card(e, redraw));
          };
          p.append(W.note('Частицы и особые эффекты вокруг открытой планеты. Настройки сохраняются вместе с планетой.'), grid);
          const offs = ['doc:loaded', 'look:changed', 'particles:registered'].map(n => ss.hooks.on(n, redraw));
          redraw();
          return () => offs.forEach(o => o());
        }},
        {id: 'add', label: 'Каталог', icon: 'plus', render(p, api) {
          if (!ss.doc || !onPlanet()) { p.appendChild(W.note('Открой планету.')); return; }
          const search = h('input', {class: 'field', type: 'search', placeholder: 'Найти: снег, пепел, рой, искры…', value: q});
          const chips = h('div', {class: 'wu-chips'}), grid = h('div', {class: 'wu-grid'});
          const render = () => {
            q = search.value.trim().toLowerCase();
            const all = P.list(), L = P.lookOf(), mods = [...new Set(all.map(e => e.mod || 'Встроенные'))];
            chips.innerHTML = '';
            for (const g of ['', ...mods]) chips.appendChild(h('button', {class: 'wu-chip' + (grp === g ? ' on' : ''), onclick: () => { grp = g; render(); }}, g || 'Все'));
            grid.innerHTML = '';
            for (const e of all) {
              const g = e.mod || 'Встроенные';
              if (grp && g !== grp) continue;
              if (q && !(e.name + ' ' + g + ' ' + (e.note || '')).toLowerCase().includes(q)) continue;
              const on = !!L[e.key];
              grid.appendChild(h('button', {class: 'wu-card' + (on ? ' on' : ''), title: on ? 'Выключить' : 'Включить на этой планете', onclick: () => { P.toggleLook(e.key, !on); render(); }},
                h('div', {class: 'wu-cardtop'}, ss.themes.icon(e.icon, 'wu-cardico'), h('span', {class: 'pill' + (on ? ' ok' : '')}, on ? 'включён' : 'включить')),
                h('b', null, e.name), h('small', null, e.note || g),
                e.colors && e.colors.length ? h('div', {class: 'wu-cols-sw'}, e.colors.slice(0, 6).map(c => h('i', {style: {background: c}}))) : null));
            }
            if (!grid.children.length) grid.appendChild(W.note('Ничего не нашлось.'));
          };
          search.addEventListener('input', render);
          p.append(h('div', {class: 'wu-cathead'}, search), chips, grid); render();
          setTimeout(() => search.focus(), 30);
        }},
      ]});
  }

  // ---- the top-bar buttons and menu items open the big panels; the small windows stay in «Окна» ----
  const rebind = (menuId, dialogId, section) => {
    const m = ss.reg.menus.get(menuId); if (!m || !ss.reg.dialogs.get(dialogId)) return;
    ss.reg.menus.update(menuId, {action: () => ss.ui.toggleDialog(dialogId, section), bar: {...m.bar, active: () => ss.ui.dialogs.isOpen(dialogId)}});
  };
  rebind('planet:fx', 'fx-studio');
  rebind('orbit:window', 'orbit-studio');
  // the big panels belong to the planet: they close when you leave it
  ss.hooks.on('level:changed', () => { const d = ss.ui.dialogs.current; if ((d === 'fx-studio' || d === 'orbit-studio') && !onPlanet()) ss.ui.closeDialog(); });
  // the small windows are still in the «Окна» menu (Ctrl+6 / Ctrl+7)
  document.documentElement.classList.add('wide-ui');
  return () => { style.remove(); document.documentElement.classList.remove('wide-ui'); };
}
