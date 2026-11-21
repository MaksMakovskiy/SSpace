// Windows for the space levels: navigator tree, selected-object properties, route types.
import {h} from '../core/util.js';
import {section, slider, select, button, note} from '../ui/widgets.js';
import {SPACE_LEVELS} from './space.js';
import {STAR_COLORS, sectorAt, sectorName} from './campaign.js';

const ALL = ['universe', 'galaxy', 'system', 'planet'];
function listen(ss, names, fn) { const offs = names.map(n => ss.hooks.on(n, fn)); return () => offs.forEach(o => o()); }

export function registerSpacePanels(ss) {
  const R = ss.reg.windows, sp = ss.space;

  // ---------------- Навигатор ----------------
  R.register({id: 'navigator', title: 'Навигатор', dock: 'left', order: 0, defaultOpen: true, width: 280, levels: SPACE_LEVELS, accel: 'Ctrl+0', render(body) {
    const camName = h('input', {class: 'field', id: 'campName', maxlength: 80});
    camName.addEventListener('change', () => sp.mutate(() => { sp.campaign.name = camName.value || 'Кампания'; }, 'Название кампании'));
    const tree = h('div', {class: 'tree'});
    const addBtn = button('+ Добавить', () => sp.addRandom(), 'primary');
    const upBtn = button('▲ Уровень выше', () => sp.up());
    body.append(section('Кампания', true, h('div', {class: 'field-row'}, h('label', {class: 'lbl', for: 'campName'}, 'Название'), camName), h('div', {class: 'btnrow'}, upBtn, addBtn)),
      section('Объекты', true, tree, note('Клик — выбрать, двойной клик — войти, ПКМ — меню. Перетащи планету на планету — станет луной, на систему — переедет туда; систему на галактику — переедет. На верх строки — поменять порядок.')));

    // expanded branches: what the user opened, plus the path to where we are
    const opened = new Set(), closed = new Set();
    const isOpen = (id) => !closed.has(id) && (opened.has(id) || id === sp.nav.gid || id === sp.nav.sid);
    const toggle = (id) => { if (isOpen(id)) { closed.add(id); opened.delete(id); } else { opened.add(id); closed.delete(id); } update(); };

    // ---------- drag & drop ----------
    let drag = null; // {kind, id}
    function dropMode(kind, obj, e, el) {
      if (!drag) return null;
      const r = el.getBoundingClientRect(), top = e.clientY - r.top < r.height * 0.35;
      const a = sp.where(drag.kind, drag.id), b = sp.where(kind, obj.id); if (!a || !b) return null;
      if (drag.kind === kind) {
        if (drag.id === obj.id) return null;
        const same = kind === 'galaxy' || (kind === 'system' ? a.g === b.g : a.s === b.s);
        if (kind === 'planet' && !top && !obj.parent && a.p.parent !== obj.id && !a.s.planets.some(x => x.parent === drag.id)) return 'into';
        return same ? 'before' : null;
      }
      if (drag.kind === 'planet' && kind === 'system') return a.s === b.s && !a.p.parent ? null : 'into';
      if (drag.kind === 'system' && kind === 'galaxy') return a.g === b.g ? null : 'into';
      return null;
    }
    function dropText(mode, kind, obj) {
      const src = sp.findAny(drag.kind, drag.id); if (!src) return '';
      if (mode === 'before') return `Поставить «${src.name}» перед «${obj.name}»`;
      if (kind === 'planet') return `«${src.name}» станет луной «${obj.name}»`;
      if (kind === 'system') return `Перенести «${src.name}» в систему «${obj.name}»`;
      return `Перенести «${src.name}» в галактику «${obj.name}»`;
    }
    function clearDrop() { for (const el of tree.querySelectorAll('.drop-into,.drop-before')) el.classList.remove('drop-into', 'drop-before'); }

    function row(kind, obj, depth, active, children, hasKids) {
      const isSel = sp.sel && sp.sel.kind === kind && sp.sel.id === obj.id;
      const here = (kind === 'galaxy' && sp.nav.gid === obj.id && sp.nav.level !== 'universe') || (kind === 'system' && sp.nav.sid === obj.id && ['system', 'planet'].includes(sp.nav.level)) || (kind === 'planet' && sp.nav.pid === obj.id && sp.nav.level === 'planet');
      const icon = kind === 'planet' && obj.parent ? 'moon' : {galaxy: 'galaxy', system: 'spark', planet: 'planet'}[kind];
      const caret = h('span', {class: 'tree-caret' + (hasKids ? '' : ' none'), title: hasKids ? 'Раскрыть / свернуть' : ''}, hasKids ? (isOpen(obj.id) ? '▾' : '▸') : '');
      if (hasKids) caret.addEventListener('click', (e) => { e.stopPropagation(); toggle(obj.id); });
      const b = h('div', {class: 'tree-row' + (isSel ? ' sel' : '') + (here ? ' here' : ''), style: {paddingLeft: (2 + depth * 14) + 'px'}, title: 'Двойной клик — войти, ПКМ — меню, можно перетаскивать',
        tabindex: 0, role: 'button', draggable: true,
        onclick: () => openTo(kind, obj), ondblclick: () => enterTo(kind, obj),
        onkeydown: (e) => { if (e.key === 'Enter') enterTo(kind, obj); }},
        caret,
        (() => { const ic = ss.themes.icon(icon, 'tree-ico'); const c = kind === 'system' ? obj.starColor : kind === 'galaxy' ? obj.armColor : ''; if (c) ic.style.color = c; return ic; })(), h('span', {class: 'tree-name'}, obj.name),
        children != null ? h('span', {class: 'muted'}, String(children)) : null);
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); sp.openContext(e.clientX, e.clientY, {kind, id: obj.id}, null); });
      b.addEventListener('dragstart', (e) => { drag = {kind, id: obj.id}; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', obj.name); b.classList.add('dragging'); });
      b.addEventListener('dragend', () => { drag = null; clearDrop(); b.classList.remove('dragging'); ss.ui.setInfo(''); });
      b.addEventListener('dragover', (e) => {
        const mode = dropMode(kind, obj, e, b);
        clearDrop();
        if (!mode) { e.dataTransfer.dropEffect = 'none'; return; }
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        b.classList.add(mode === 'into' ? 'drop-into' : 'drop-before');
        ss.ui.setInfo(dropText(mode, kind, obj));
      });
      b.addEventListener('dragleave', () => b.classList.remove('drop-into', 'drop-before'));
      b.addEventListener('drop', (e) => {
        e.preventDefault();
        const mode = dropMode(kind, obj, e, b), src = drag; clearDrop(); drag = null;
        if (!mode || !src) return;
        if (mode === 'before') sp.reorder(src.kind, src.id, obj.id);
        else if (kind === 'planet') sp.setParent(src.id, obj.id);
        else if (kind === 'system') sp.movePlanet(src.id, obj.id) || (src.kind === 'planet' && sp.setParent(src.id, null));
        else if (kind === 'galaxy') sp.moveSystem(src.id, obj.id);
        opened.add(obj.id);
      });
      return b;
    }
    // select an object, moving to the level where it is visible
    function openTo(kind, obj) {
      const ctx = locate(kind, obj.id); if (!ctx) return;
      const level = kind === 'galaxy' ? 'universe' : kind === 'system' ? 'galaxy' : 'system';
      if (sp.nav.level !== level || sp.nav.gid !== ctx.gid || (level === 'system' && sp.nav.sid !== ctx.sid)) sp.go(level, {gid: ctx.gid, sid: ctx.sid}, {select: {kind, id: obj.id}});
      else sp.select({kind, id: obj.id});
    }
    function enterTo(kind, obj) { const ctx = locate(kind, obj.id); if (!ctx) return; sp.go(kind === 'galaxy' ? 'galaxy' : kind === 'system' ? 'system' : 'planet', {gid: ctx.gid, sid: ctx.sid, pid: ctx.pid}); }
    function locate(kind, id) {
      for (const g of sp.campaign.galaxies) {
        if (kind === 'galaxy' && g.id === id) return {gid: g.id};
        for (const s of g.systems) {
          if (kind === 'system' && s.id === id) return {gid: g.id, sid: s.id};
          for (const p of s.planets) if (kind === 'planet' && p.id === id) return {gid: g.id, sid: s.id, pid: p.id};
        }
      }
      return null;
    }
    function update() {
      const c = sp.campaign; if (!c) return;
      if (document.activeElement !== camName) camName.value = c.name;
      const lvl = sp.nav.level;
      addBtn.textContent = {universe: '+ Галактика', galaxy: '+ Система', system: '+ Планета', planet: '+ Добавить'}[lvl];
      addBtn.disabled = lvl === 'planet'; upBtn.disabled = lvl === 'universe';
      tree.innerHTML = '';
      for (const g of c.galaxies) {
        tree.appendChild(row('galaxy', g, 0, false, g.systems.length, g.systems.length > 0));
        if (!isOpen(g.id) && !(c.galaxies.length === 1 && !closed.has(g.id))) continue;
        for (const s of g.systems) {
          tree.appendChild(row('system', s, 1, false, s.planets.length, s.planets.length > 0));
          if (!isOpen(s.id)) continue;
          for (const p of s.planets) {
            if (p.parent && s.planets.some(x => x.id === p.parent)) continue; // moons go under their planet
            const moons = s.planets.filter(m => m.parent === p.id);
            tree.appendChild(row('planet', p, 2, false, null, moons.length > 0));
            if (moons.length && !closed.has(p.id)) for (const m of moons) tree.appendChild(row('planet', m, 3, false, null, false));
          }
        }
      }
    }
    const off = listen(ss, ['space:changed', 'space:selected', 'level:changed', 'campaign:loaded'], update);
    update();
    return {update, destroy: off};
  }});

  // ---------------- Объект ----------------
  R.register({id: 'object', title: 'Объект', dock: 'right', order: 1, defaultOpen: true, width: 300, levels: SPACE_LEVELS, accel: 'Ctrl+1', render(body) {
    function field(label, el) { return h('div', {class: 'field-row'}, h('label', {class: 'lbl'}, label), el); }
    function text(sel, key, val, ph = '') {
      const i = h('input', {class: 'field', value: val || '', placeholder: ph, maxlength: 80});
      i.addEventListener('change', () => sp.update(sel, {[key]: i.value}, 'Переименовать'));
      return i;
    }
    function area(sel, val) {
      const t = h('textarea', {class: 'field', rows: 4, placeholder: 'Заметка для мастера'}); t.value = val || '';
      t.addEventListener('change', () => sp.update(sel, {note: t.value}, 'Заметка'));
      return t;
    }
    function color(sel, key, val) {
      const c = h('input', {type: 'color', class: 'color', value: val || '#888888'});
      c.addEventListener('change', () => sp.update(sel, {[key]: c.value}, 'Цвет'));
      return c;
    }
    function num(sel, key, label, min, max, step, val, fmt = v => v) {
      return slider({id: 'o_' + key, label, min, max, step, value: val, format: fmt, onChange: v => sp.update(sel, {[key]: v}, label)});
    }
    function render() {
      body.innerHTML = '';
      const sel = sp.sel, o = sp.objectOf(sel), lvl = sp.nav.level;
      if (!sel || !o) {
        const tip = {universe: 'Вселенная: здесь галактики. Инструмент «Добавить» (A) ставит новую галактику, «Маршрут» (L) соединяет галактики.',
          galaxy: 'Галактика: кликни сектор, чтобы дать ему имя и цвет, или систему, чтобы её настроить. Двойной клик по системе — войти.',
          system: 'Система: звезда и планеты на орбитах. Тяни планету, чтобы поменять орбиту. Двойной клик по планете — открыть редактор карты.'}[lvl] || '';
        body.append(h('div', {class: 'sec-body'}, note(tip)));
        if (lvl === 'galaxy') {
          const {g} = sp.current();
          body.append(section('Галактика', true, h('div', {class: 'stack'},
            num({kind: 'galaxy', id: g.id}, 'rings', 'Колец секторов', 1, 12, 1, g.rings),
            num({kind: 'galaxy', id: g.id}, 'slices', 'Клиньев в кольце', 1, 36, 1, g.slices),
            button('Свойства галактики…', () => sp.go('universe', {}, {select: {kind: 'galaxy', id: g.id}})))));
        }
        return;
      }
      const head = h('div', {class: 'props-head'});
      const enter = (kind) => button(kind === 'planet' ? 'Открыть карту планеты' : 'Войти внутрь', () => sp.enter(kind, o.id), 'primary');
      const del = button('Удалить', () => sp.remove(sel), 'danger');
      if (sel.kind === 'galaxy') {
        head.append((() => { const ic = ss.themes.icon('galaxy', 'tree-ico big'); ic.style.color = o.armColor; return ic; })(), h('b', null, o.name));
        body.append(head,
          section('Основное', true, field('Название', text(sel, 'name', o.name)), h('div', {class: 'btnrow'}, enter('galaxy'), del)),
          section('Форма', true,
            num(sel, 'arms', 'Рукава', 1, 8, 1, o.arms), num(sel, 'twist', 'Закрутка', 0, 5, 0.1, o.twist, v => Number(v).toFixed(1)),
            h('div', {class: 'row2'}, h('span', {class: 'lbl'}, 'Ядро'), color(sel, 'coreColor', o.coreColor), h('span', {class: 'lbl'}, 'Рукава'), color(sel, 'armColor', o.armColor)),
            button('Другой узор звёзд', () => sp.update(sel, {seed: Math.floor(Math.random() * 1e9)}, 'Узор'))),
          section('Сектора', true, num(sel, 'rings', 'Колец', 1, 12, 1, o.rings), num(sel, 'slices', 'Клиньев в кольце', 1, 36, 1, o.slices)),
          section('Заметка', false, area(sel, o.note)));
      } else if (sel.kind === 'system') {
        const {g} = sp.current();
        head.append((() => { const ic = ss.themes.icon('spark', 'tree-ico big'); ic.style.color = o.starColor; return ic; })(), h('b', null, o.name));
        const sw = h('div', {class: 'swatches'}, sp.STAR_PALETTE.map(({color: c, name}) => h('button', {style: {background: c}, class: c.toLowerCase() === String(o.starColor).toLowerCase() ? 'on' : '', title: name + ' · ' + c, onclick: () => sp.update(sel, {starColor: c}, 'Цвет звезды')})));
        body.append(head,
          section('Основное', true, field('Название', text(sel, 'name', o.name)), note(`Сектор: ${g ? sectorName(g, sectorAt(g, o.x, o.z)) : '—'} · планет: ${o.planets.length}`), h('div', {class: 'btnrow'}, enter('system'), del)),
          section('Звезда', true, sw, h('label', {class: 'check'}, color(sel, 'starColor', o.starColor), 'Свой цвет'), num(sel, 'starSize', 'Размер звезды', 0.3, 3, 0.1, o.starSize, v => Number(v).toFixed(1))),
          section('Заметка', false, area(sel, o.note)));
      } else if (sel.kind === 'planet') {
        const {s} = sp.current(), isMoon = !!o.parent, myMoons = s.planets.filter(x => x.parent === o.id);
        head.append(h('span', {class: 'tree-ico big'}, isMoon ? '◐' : '●'), h('b', null, o.name));
        // what it orbits: the star, or another planet (then it is a moon)
        const hosts = [{value: '', label: 'Звезда «' + s.name + '»'}, ...s.planets.filter(x => x.id !== o.id && !x.parent).map(x => ({value: x.id, label: 'Планета «' + x.name + '» (луна)'}))];
        const around = select({id: 'plParent', label: 'Вращается вокруг', options: hosts, value: o.parent || '', onChange: v => { if (sp.setParent(o.id, v || null) === false) render(); }});
        const moonsNote = myMoons.length ? note('Луны: ' + myMoons.map(m => m.name).join(', ')) : null;
        body.append(head,
          section('Основное', true, field('Название', text(sel, 'name', o.name)), note(o.doc ? `Карта: ${10 * o.doc.n * o.doc.n + 2} клеток` : 'Карта создастся при первом открытии.'), h('div', {class: 'btnrow'}, enter('planet'), del)),
          section('Орбита', true, around,
            num(sel, 'orbit', isMoon ? 'Радиус орбиты вокруг планеты' : 'Радиус орбиты', isMoon ? 3 : 8, isMoon ? 60 : 300, isMoon ? 0.5 : 1, isMoon ? o.orbit : Math.round(o.orbit)),
            num(sel, 'size', 'Размер на схеме', 0.2, 3, 0.05, o.size, v => Number(v).toFixed(2)),
            moonsNote,
            isMoon ? null : button('+ Спутник (луна)', () => sp.addMoon(o.id))),
          section('Заметка', false, area(sel, o.note)));
      } else if (sel.kind === 'sector') {
        const {g} = sp.current();
        head.append(h('span', {class: 'hex big', style: {background: o.color || '#3a4560'}}), h('b', null, 'Сектор ' + sectorName(g, sel.key)));
        const nm = h('input', {class: 'field', value: o.name || '', placeholder: sectorName({...g, sectors: {}}, sel.key), maxlength: 60});
        nm.addEventListener('change', () => sp.update(sel, {name: nm.value}, 'Имя сектора'));
        const n = g.systems.filter(s => sectorAt(g, s.x, s.z) === sel.key).length;
        body.append(head,
          section('Сектор', true, field('Название', nm), h('label', {class: 'check'}, color(sel, 'color', o.color || '#ff5a3c'), 'Цвет заливки'),
            note(`Систем в секторе: ${n}`), h('div', {class: 'btnrow'}, button('Убрать цвет', () => sp.update(sel, {color: ''}, 'Цвет сектора')), button('Сбросить', () => sp.remove(sel)))),
          section('Заметка', false, area(sel, o.note)));
      } else if (sel.kind === 'link') {
        const t = ss.reg.routeTypes.get(o.type);
        head.append(h('span', {class: 'route-swatch', style: {background: o.color || (t ? t.color : '#888')}}), h('b', null, (t ? t.name : o.type)));
        const types = ss.reg.routeTypes.list().map(x => ({value: x.id, label: x.name}));
        body.append(head,
          section('Маршрут', true, note(`${sp.nameOf(kindHere(), o.a)} — ${sp.nameOf(kindHere(), o.b)}`),
            select({id: 'lnType', label: 'Тип', options: types, value: o.type, onChange: v => sp.update(sel, {type: v}, 'Тип маршрута')}),
            field('Подпись', text(sel, 'name', o.name, 'без подписи')),
            h('label', {class: 'check'}, color(sel, 'color', o.color || (t ? t.color : '#888888')), 'Свой цвет'),
            h('div', {class: 'btnrow'}, button('Цвет типа', () => sp.update(sel, {color: ''}, 'Цвет маршрута')), del)),
          section('Заметка', false, area(sel, o.note)));
      }
    }
    function kindHere() { return {universe: 'galaxy', galaxy: 'system', system: 'planet'}[sp.nav.level]; }
    const off = listen(ss, ['space:selected', 'space:changed', 'level:changed', 'registry:routeTypes'], render);
    render();
    return {update: render, destroy: off};
  }});

  // ---------------- Маршруты ----------------
  R.register({id: 'routes', title: 'Маршруты', dock: 'right', col: 1, order: 2, defaultOpen: true, width: 280, levels: SPACE_LEVELS, accel: 'Ctrl+2', render(body) {
    const types = h('div', {class: 'routes'}), list = h('div', {class: 'poi-list'});
    body.append(section('Типы маршрутов', true, types, note('Кружок — тип для новых маршрутов (инструмент «Маршрут», L). Галочка — показывать на карте.')),
      section('Маршруты на этом уровне', true, list));
    function update() {
      types.innerHTML = '';
      const hidden = ss.prefs.routeHidden || {};
      for (const t of ss.reg.routeTypes.list()) {
        const radio = h('input', {type: 'radio', name: 'rtype', checked: sp.routeType === t.id, title: 'Рисовать этим типом'});
        radio.addEventListener('change', () => { sp.routeType = t.id; ss.setTool('sp-link'); });
        const vis = h('input', {type: 'checkbox', checked: !hidden[t.id], title: 'Показывать'});
        vis.addEventListener('change', () => { const hd = {...(ss.prefs.routeHidden || {})}; if (vis.checked) delete hd[t.id]; else hd[t.id] = true; ss.setPref('routeHidden', hd); sp.view.rebuild(); });
        types.appendChild(h('label', {class: 'route-row'}, radio, h('span', {class: 'route-swatch' + (t.dash ? ' dash' : ''), style: {background: t.color}}), h('span', {class: 'route-name'}, t.name), vis));
      }
      list.innerHTML = '';
      const ls = sp.linksHere(), kind = {universe: 'galaxy', galaxy: 'system', system: 'planet'}[sp.nav.level];
      if (!ls.length) list.appendChild(note('Маршрутов пока нет.'));
      for (const l of ls) {
        const t = ss.reg.routeTypes.get(l.type);
        list.appendChild(h('button', {class: 'poi-row' + (sp.sel && sp.sel.kind === 'link' && sp.sel.id === l.id ? ' sel' : ''), onclick: () => sp.select({kind: 'link', id: l.id})},
          h('span', {class: 'route-swatch', style: {background: l.color || (t ? t.color : '#888')}}),
          h('span', null, l.name || `${sp.nameOf(kind, l.a)} — ${sp.nameOf(kind, l.b)}`)));
      }
    }
    const off = listen(ss, ['space:changed', 'space:selected', 'level:changed', 'registry:routeTypes', 'prefs:changed'], update);
    update();
    return {update, destroy: off};
  }});
}
