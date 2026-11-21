// «Эффекты» window: every look effect registered through ss.particles (snow, ash, dust, swarms, motes, ghost surface…)
// in one place, switched on/off and tuned per planet (doc.meta.look[key] and doc.meta.fx[key]).
import {h} from '../core/util.js';
import {section, slider, note, button} from './widgets.js';

const PRESETS = ['#ffffff', '#d8ecff', '#8fb4ff', '#7fe3ff', '#7fe3b0', '#b8ff6a', '#ffe08a', '#ffb347', '#ff7a3a', '#ff4a4a', '#c39bff', '#ff7ad9', '#9a9a9a', '#5a4a40'];
const TUNE = [
  {id: 'density', label: 'Плотность', min: 5, max: 300},
  {id: 'speed', label: 'Скорость', min: 0, max: 300},
  {id: 'size', label: 'Размер частиц', min: 20, max: 300},
  {id: 'opacity', label: 'Яркость', min: 10, max: 200},
];

export function registerFxWindow(ss) {
  ss.reg.windows.register({id: 'fx', title: 'Эффекты', dock: 'left', order: 4, width: 300, levels: ['planet'], accel: 'Ctrl+7', render(body) {
    const P = ss.particles;
    const onBox = h('div', {class: 'fx-list'}), addBox = h('div', {class: 'fx-add'});
    const orbitBtn = h('div', {class: 'btnrow'});
    body.append(
      note('Частицы и особые эффекты вокруг открытой планеты. Настройки сохраняются вместе с планетой; генераторы миров включают свои эффекты сами.'),
      section('На этой планете', true, onBox),
      section('Добавить эффект', true, addBox, orbitBtn));

    function card(e) {
      const f = P.fxOf(e.key), tune = e.kind === 'particles' ? TUNE : TUNE.filter(t => (e.tune || []).includes(t.id));
      const head = h('div', {class: 'fx-head'},
        ss.themes.icon(e.icon, 'fx-ico'), h('b', null, e.name),
        e.mod ? h('span', {class: 'fx-mod'}, e.mod) : null,
        h('button', {class: 'fx-off', title: 'Выключить на этой планете', onclick: () => P.toggleLook(e.key, false)}, '✕'));
      const box = h('div', {class: 'fx-card'}, head);
      if (e.note) box.appendChild(h('div', {class: 'note'}, e.note));
      const sliders = tune.map(t => slider({id: 'fx-' + e.key + '-' + t.id, label: t.label, min: t.min, max: t.max, step: 5, value: Math.round(f[t.id] * 100),
        format: v => v + '%', onInput: v => P.setFx(e.key, {[t.id]: v / 100})}));
      box.append(...sliders);
      if (e.kind === 'particles') {
        const cur = (f.color || '').toLowerCase();
        const own = h('button', {class: 'fx-own' + (cur ? '' : ' on'), title: 'Свои цвета эффекта', style: {background: e.colors.length > 1 ? `linear-gradient(90deg, ${e.colors.join(', ')})` : (e.colors[0] || '#fff')},
          onclick: () => { P.setFx(e.key, {color: ''}); update(); }}, 'свои');
        const sw = h('div', {class: 'fx-swatches'}, own, PRESETS.map(c => h('button', {class: c === cur ? 'on' : '', style: {background: c}, title: c, onclick: () => { P.setFx(e.key, {color: c}); update(); }})));
        const pick = h('input', {type: 'color', class: 'color', value: cur || (e.colors[0] || '#ffffff')});
        pick.addEventListener('change', () => { P.setFx(e.key, {color: pick.value}); update(); });
        box.append(h('div', {class: 'fx-color-lbl'}, 'Цвет'), sw, h('label', {class: 'check'}, pick, 'Свой цвет'));
      }
      box.appendChild(h('div', {class: 'btnrow'}, button('Сбросить настройки', () => { P.setFx(e.key, null); update(); })));
      return box;
    }

    function update() {
      if (!ss.doc) return;
      const L = P.lookOf(), all = P.list();
      onBox.innerHTML = ''; addBox.innerHTML = '';
      const on = all.filter(e => L[e.key]), off = all.filter(e => !L[e.key]);
      if (!on.length) onBox.appendChild(note('Эффектов нет. Добавь из списка ниже.'));
      for (const e of on) onBox.appendChild(card(e));
      if (!off.length) addBox.appendChild(note('Все эффекты уже включены.'));
      for (const e of off) addBox.appendChild(h('button', {class: 'fx-add-btn', title: e.note || e.name, onclick: () => P.toggleLook(e.key, true)},
        ss.themes.icon(e.icon, 'fx-ico'), h('span', null, e.name), e.mod ? h('span', {class: 'fx-mod'}, e.mod) : null));
      orbitBtn.innerHTML = '';
      if (ss.reg.windows.get('orbit')) orbitBtn.appendChild(button('Кольца и корабли на орбите…', () => ss.ui.openWindow('orbit')));
    }
    // fx:changed is not listened to: sliders write it while dragging and must not be rebuilt under the mouse
    const offs = ['doc:loaded', 'look:changed', 'level:changed', 'particles:registered'].map(n => ss.hooks.on(n, update));
    update();
    return {update, destroy: () => offs.forEach(o => o())};
  }});
  ss.reg.menus.register({id: 'planet:fx', menu: 'Планета', order: 39, label: 'Эффекты: снег, пепел, рой…',
    enabled: () => ss.space.nav.level === 'planet', action: () => ss.ui.toggleWindow('fx'),
    bar: {icon: 'sparkles', text: 'Эффекты', order: 2, active: () => ss.ui.wm.isOpen('fx')}});
}
