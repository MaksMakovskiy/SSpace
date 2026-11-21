// «Поиск» (Ctrl+F): planets, moons, systems, sectors and galaxies of the whole campaign by name, with filters for
// marked things and places you have already been. Enter shows the thing on the map, Ctrl+Enter opens a planet.
import {h} from '../core/util.js';
import {sectorName, sectorGeom} from '../space/campaign.js';

const KIND_NAME = {planet: 'планета', moon: 'луна', system: 'система', sector: 'сектор', galaxy: 'галактика'};
const KIND_ICON = {planet: 'planet', moon: 'moon', system: 'sparkles', sector: 'grid', galaxy: 'galaxy'};

export function registerSearch(ss) {
  const st = {q: '', kind: 'all', marked: false, visited: false, color: ''};

  function index() {
    const c = ss.space && ss.space.campaign, out = []; if (!c) return out;
    for (const g of c.galaxies) {
      out.push({kind: 'galaxy', id: g.id, name: g.name, path: '', mark: '', g});
      const keys = ['core']; for (let r = 0; r < g.rings; r++) for (let s = 0; s < g.slices; s++) keys.push(`${r}:${s}`);
      for (const k of keys) { const info = g.sectors[k] || {}; out.push({kind: 'sector', key: k, id: k, name: sectorName(g, k), path: g.name, mark: info.mark || '', note: info.note || '', g}); }
      for (const s of g.systems) {
        out.push({kind: 'system', id: s.id, name: s.name, path: g.name, mark: s.mark || '', visited: s.planets.some(p => p.doc), note: s.note, g, s});
        for (const p of s.planets) {
          const par = p.parent && s.planets.find(x => x.id === p.parent);
          out.push({kind: par ? 'moon' : 'planet', id: p.id, name: p.name, path: g.name + ' › ' + s.name + (par ? ' › ' + par.name : ''), mark: p.mark || '', visited: !!p.doc, note: p.note, gen: p.gen, g, s, p});
        }
      }
    }
    return out;
  }
  function filter(all) {
    const q = st.q.trim().toLowerCase();
    let list = all.filter(it => (st.kind === 'all' ? it.kind !== 'sector' || q || it.mark : st.kind === 'planet' ? it.kind === 'planet' : it.kind === st.kind)
      && (!st.marked || it.mark) && (!st.color || it.mark === st.color) && (!st.visited || it.visited));
    if (q) {
      const score = (it) => { const n = it.name.toLowerCase(); if (n === q) return 0; if (n.startsWith(q)) return 1; if (n.includes(q)) return 2; if ((it.path + ' ' + (it.note || '') + ' ' + (it.gen || '')).toLowerCase().includes(q)) return 3; return 9; };
      list = list.map(it => [score(it), it]).filter(x => x[0] < 9).sort((a, b) => a[0] - b[0] || (b[1].mark ? 1 : 0) - (a[1].mark ? 1 : 0) || a[1].name.localeCompare(b[1].name)).map(x => x[1]);
    } else list.sort((a, b) => (b.mark ? 1 : 0) - (a.mark ? 1 : 0));
    return list;
  }

  // ---- going to a result ----
  function show(it) {
    const sp = ss.space, v = sp.view;
    if (it.kind === 'sector') {
      sp.go('galaxy', {gid: it.g.id}, {select: {kind: 'sector', key: it.key}});
      const {r0, r1, a0, a1} = sectorGeom(it.g, it.key), r = it.key === 'core' ? 0 : (r0 + r1) / 2, a = (a0 + a1) / 2;
      v.focus(Math.cos(a) * r, Math.sin(a) * r, 120);
    } else {
      sp.show(it.kind === 'moon' ? 'planet' : it.kind, it.id);
      const pos = v.posOf(it.kind === 'moon' ? 'planet' : it.kind, it.id);
      if (pos) v.focus(pos.x, pos.z, it.kind === 'galaxy' ? 600 : it.kind === 'system' ? 90 : 70);
    }
    ss.ui.closeDialog();
  }
  function open(it) {
    if (!it.p) return show(it);
    ss.ui.closeDialog();
    ss.space.go('planet', {gid: it.g.id, sid: it.s.id, pid: it.p.id});
  }

  ss.reg.dialogs.register({id: 'search', title: 'Поиск', icon: 'search', subtitle: 'планеты, луны, системы, сектора · Enter — показать, Ctrl+Enter — открыть планету',
    render(pane) {
      const all = index();
      const input = h('input', {class: 'field sr-input', type: 'search', placeholder: 'Имя планеты, луны, системы или сектора…', value: st.q});
      const list = h('div', {class: 'sr-list', role: 'listbox'}), count = h('span', {class: 'sr-count'});
      let shown = [], cur = 0;
      const kinds = [['all', 'Всё'], ['planet', 'Планеты'], ['moon', 'Луны'], ['system', 'Системы'], ['sector', 'Сектора'], ['galaxy', 'Галактики']];
      const seg = h('div', {class: 'seg sr-kinds'});
      const drawKinds = () => { seg.innerHTML = ''; for (const [k, l] of kinds) seg.appendChild(h('button', {class: st.kind === k ? 'on' : '', onclick: () => { st.kind = k; drawKinds(); render(); input.focus(); }}, l)); };
      const chip = (label, key, icon) => { const b = h('button', {class: 'sr-chip' + (st[key] ? ' on' : ''), onclick: () => { st[key] = !st[key]; b.classList.toggle('on', st[key]); render(); input.focus(); }}, icon ? ss.themes.icon(icon, 'sr-ci') : null, label); return b; };
      const colors = h('div', {class: 'sr-colors'});
      const drawColors = () => { colors.innerHTML = ''; for (const c of ss.space.MARK_COLORS || []) colors.appendChild(h('button', {class: 'sr-col' + (st.color === c ? ' on' : ''), title: 'Только с отметкой этого цвета', style: {background: c}, onclick: () => { st.color = st.color === c ? '' : c; drawColors(); render(); input.focus(); }})); };
      const select = (i) => {
        const rows = list.children; if (!shown.length) return;
        cur = Math.max(0, Math.min(shown.length - 1, i));
        for (const r of rows) r.classList.remove('cur');
        const r = rows[cur]; if (r) { r.classList.add('cur'); r.scrollIntoView({block: 'nearest'}); }
      };
      const MAX = 300;
      function render() {
        st.q = input.value;
        shown = filter(all); cur = 0;
        list.innerHTML = '';
        const frag = document.createDocumentFragment();
        shown.slice(0, MAX).forEach((it, i) => {
          const row = h('div', {class: 'sr-row' + (i === 0 ? ' cur' : ''), role: 'option', onclick: () => show(it), ondblclick: () => open(it), onmousemove: () => { if (cur !== i) select(i); }},
            h('span', {class: 'sr-flag', style: it.mark ? {color: it.mark} : null}, it.mark ? ss.themes.icon('flag') : null),
            ss.themes.icon(KIND_ICON[it.kind] || 'planet', 'sr-ico'),
            h('div', {class: 'sr-text'}, h('b', null, it.name), h('small', null, KIND_NAME[it.kind] + (it.path ? ' · ' + it.path : '') + (it.visited ? ' · был здесь' : ''))),
            it.p ? h('button', {class: 'sr-open', title: 'Открыть карту планеты (Ctrl+Enter)', onclick: (e) => { e.stopPropagation(); open(it); }}, 'Открыть') : null,
            h('button', {class: 'sr-mark', title: it.mark ? 'Снять отметку' : 'Отметить', onclick: (e) => {
              e.stopPropagation();
              const sel = it.kind === 'sector' ? {kind: 'sector', key: it.key} : {kind: it.kind === 'moon' ? 'planet' : it.kind, id: it.id};
              if (it.kind === 'galaxy') return ss.ui.toast('Галактики не отмечаются — отметь в ней систему, планету или сектор');
              // sector objects need the galaxy open to resolve; set the mark directly
              if (it.kind === 'sector') { ss.space.mutate(() => { const sec = it.g.sectors[it.key] || (it.g.sectors[it.key] = {name: '', color: '', note: '', mark: ''}); sec.mark = it.mark ? '' : (st.color || ss.space.MARK_COLORS[0]); }, 'Отметка'); }
              else ss.space.setMark(sel, it.mark ? '' : (st.color || ss.space.MARK_COLORS[0]));
              const fresh = index(); all.length = 0; all.push(...fresh); render();
            }}, ss.themes.icon('flag')));
          frag.appendChild(row);
        });
        list.appendChild(frag);
        if (!shown.length) list.appendChild(h('div', {class: 'note sr-empty'}, st.q ? 'Ничего не нашлось' : st.marked || st.color ? 'Отметок пока нет — правый клик по планете, системе или сектору → «Отметить…»' : 'Начни печатать имя'));
        count.textContent = shown.length > MAX ? `показано ${MAX} из ${shown.length}` : `найдено: ${shown.length}`;
      }
      input.addEventListener('input', render);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); select(cur + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); select(cur - 1); }
        else if (e.key === 'Enter' && shown[cur]) { e.preventDefault(); (e.ctrlKey ? open : show)(shown[cur]); }
      });
      drawKinds(); drawColors();
      pane.append(
        h('div', {class: 'sr-top'}, ss.themes.icon('search', 'sr-big'), input),
        h('div', {class: 'sr-filters'}, seg, chip('Отмеченные', 'marked', 'flag'), chip('Где был', 'visited', 'planet'), colors, count),
        list);
      render();
      setTimeout(() => { input.focus(); input.select(); }, 30);
    }});

  ss.reg.menus.register({id: 'edit:find', menu: 'Правка', order: 300, label: 'Поиск планет, лун, систем…', accel: 'Ctrl+F',
    action: () => ss.ui.toggleDialog('search'), bar: {icon: 'search', side: 'right', order: 1, active: () => ss.ui.dialogs.isOpen('search')}});
  ss.search = {index, filter, state: st};
}
