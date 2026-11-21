// The editor's big dialogs: «Настройки», «Моды и наборы», «Справка». («Журнал и метрики» is in devWindow.js.)
import {h, plural} from '../core/util.js';
import {slider, check, segmented, button, note} from './widgets.js';
import {setModEnabled} from '../core/mods.js';

export function registerAppDialogs(ss, HELP_HTML) {
  const D = ss.reg.dialogs, P = () => ss.prefs;
  const pref = (k, label, hint) => {
    const c = check({id: 'set_' + k, label, checked: P()[k] !== false, onChange: v => ss.setPref(k, v)});
    return hint ? h('div', {class: 'set-row'}, c, h('small', null, hint)) : c;
  };
  const card = (title, ...body) => h('div', {class: 'set-card'}, title ? h('div', {class: 'set-title'}, title) : null, ...body);

  // ---------------- Настройки ----------------
  D.register({id: 'settings', title: 'Настройки', icon: 'gear', sections: [
    {id: 'view', label: 'Вид планеты', icon: 'planet', render(p) {
      const same = segmented({options: [{value: 'show', label: 'Видны'}, {value: 'half', label: 'Полупрозрачные'}, {value: 'hide', label: 'Скрыты'}], value: P().sameLines, onChange: v => ss.setPref('sameLines', v)});
      p.append(
        card('Поверхность', pref('grid', 'Сетка гексов'), h('div', {class: 'lbl'}, 'Линии между гексами одного типа'), same,
          pref('textures', 'Рельефная поверхность', 'бугорки леса, гор, плит и т.п.'), pref('buildings', 'Здания и растения', '3D-застройка, джунгли, турели'), pref('anim', 'Анимация', 'вода, огни, частицы, вращение объектов')),
        card('Вокруг планеты', pref('atmosphere', 'Атмосфера', 'прячет свечение атмосферы на всех планетах'), pref('orbitals', 'Объекты на орбите', 'кольца, станции, корабли'),
          pref('otherPlanets', 'Другие планеты системы на небе'), pref('orbits', 'Орбиты планет на небе')),
        card('Метки', pref('markers', 'Маркеры (слой поверх ландшафта)'), slider({id: 'set_mkop', label: 'Прозрачность маркеров', min: 10, max: 100, value: Math.round((P().markerOpacity || 0.55) * 100), format: v => v + '%', onInput: v => ss.setPref('markerOpacity', v / 100)}),
          pref('pois', 'Точки интереса')));
    }},
    {id: 'theme', label: 'Тема', icon: 'brush', render(p, api) {
      const grid = h('div', {class: 'theme-grid'});
      const sample = ['dice', 'sparkles', 'orbit', 'planet', 'gear', 'flame', 'snowflake', 'rocket'];
      for (const th of ss.reg.themes.list()) {
        const on = ss.themes.current && ss.themes.current.id === th.id;
        grid.appendChild(h('button', {class: 'theme-card' + (on ? ' on' : ''), onclick: () => { ss.themes.apply(th.id); api.refresh(); }},
          h('div', {class: 'theme-sw'}, (th.swatches || ['#05070c', '#161b27', '#ff5a3c', '#e6e9f2']).map(c => h('span', {style: {background: c}}))),
          h('div', {class: 'theme-name'}, h('b', null, th.name), on ? h('span', {class: 'pill ok'}, 'сейчас') : null),
          th.desc ? h('div', {class: 'theme-desc'}, th.desc) : null,
          h('div', {class: 'theme-icons'}, sample.map(n => ss.themes.preview(th, n)))));
      }
      p.append(note('Тема меняет цвета, шрифты, значки и анимации интерфейса. Темы добавляют моды — встроенная только «Космос».'),
        card(null, pref('themeAnim', 'Анимации темы', 'движение, свечение, частицы поверх окна; выключи, если мешают или снижают FPS'),
          ss.reg.themes.has('angels-void') ? pref('themeGlitch', 'Сбои и глитчи', 'трещины, перевороты, консоли и помехи в теме «Ангелы: Сбой»; кнопка с треугольником вверху') : null), grid);
    }},
    {id: 'ui', label: 'Окна и интерфейс', icon: 'window', render(p) {
      // language: the names stay as they are written, so each is readable whatever language is on now
      const langSeg = h('div', {class: 'seg'}, (ss.i18n.LANGS || []).map(l => h('button', {class: l.id === ss.i18n.lang ? 'on' : '', 'data-i18n-skip': '', onclick: () => ss.setLang(l.id)}, l.name)));
      p.append(
        card('Язык / Language', langSeg, note('Моды со своим переводом переключаются вместе с редактором, остальные остаются на своём языке.')),
        card('Плавающие окна', pref('magnet', 'Магнит: окна прилипают к краям и друг к другу', 'Alt при перетаскивании — временно выключить'),
          h('div', {class: 'btnrow'}, button('Сбросить расположение окон', () => { ss.ui.wm.resetLayout(); ss.ui.toast('Окна расставлены заново'); }))),
        card('Строка состояния', pref('fps', 'Счётчик FPS')),
        card('Горячие клавиши', h('div', {class: 'set-keys'}, ...[
          ['Ctrl+8', 'Генератор миров'], ['Ctrl+G', 'Ещё вариант планеты'], ['Ctrl+7', 'Эффекты'], ['Ctrl+6', 'Орбита'], ['Ctrl+1…5', 'окна планеты'],
          ['Ctrl+,', 'Настройки'], ['Ctrl+9', 'Журнал и метрики'], ['F1', 'Справка'], ['Ctrl+Z / Y', 'отмена / повтор'], ['Ctrl+S', 'сохранить']].map(([k, t]) => h('div', null, h('kbd', null, k), t)))));
    }},
    {id: 'data', label: 'Данные и папки', icon: 'disk', render(p) {
      const as = ss.metrics && ss.metrics.stats('autosave'), mb = ss.metrics && ss.metrics.snapshot().gauges['autosave.MB'];
      p.append(
        card('Автосохранение', note(ss.host.desktop ? 'Кампания сохраняется сама в файл в папке данных программы через секунду после изменения.' : 'Браузерная версия хранит автосохранение в памяти браузера (несколько МБ).'),
          note(as ? `Последнее: ${mb ?? '?'} МБ за ${Math.round(as.last)} мс, всего сохранений ${as.n}.` : 'В этом сеансе ещё не было.')),
        card('Папки', h('div', {class: 'btnrow'}, button('Папка модов', () => ss.host.openModsFolder()), button('Папка наборов', () => ss.host.openPacksFolder()),
          ss.host.openLogFolder ? button('Папка логов', () => ss.host.openLogFolder()) : null)),
        card('Файлы', h('div', {class: 'btnrow'}, button('Сохранить кампанию', () => ss.saveFile(false), 'primary'), button('Сохранить как…', () => ss.saveFile(true)), button('Экспорт PNG', () => ss.exportPng()))));
    }},
    {id: 'about', label: 'О программе', icon: 'info', render(p) {
      const on = ss.mods.filter(m => m.status === 'on').length;
      p.append(card('SSpace ' + ss.VERSION, note('3D-редактор вселенных и гекс-планет для настольных кампаний.'), note('© 2026 Maksym Makovskyi (Snvok) · лицензия MIT: пользуйтесь свободно, указывая автора.'),
        h('div', {class: 'set-keys'}, ...[['Версия API модов', String(ss.apiVersion)], ['three.js', 'r' + ss.THREE.REVISION], ['Модов', `${on} из ${ss.mods.length}`], ['Наборов', String(ss.reg.packs.size)],
          ['Типов местности', String(ss.reg.terrains.size)], ['Генераторов', String(ss.reg.generators.size)], ['Версия', ss.host.desktop ? 'десктоп' : 'браузер']].map(([k, v]) => h('div', null, h('kbd', null, v), k))),
        h('div', {class: 'btnrow'}, button('Журнал и метрики', () => ss.ui.openDialog('devtools')), button('Самопроверка', () => ss.ui.openDialog('devtools', 'test')))));
    }},
  ]});

  // ---------------- Моды и наборы ----------------
  let restartNeeded = false, modQuery = '';
  D.register({id: 'mods', title: 'Моды и наборы', icon: 'puzzle', subtitle: (ss) => `модов включено ${ss.mods.filter(m => m.status === 'on').length} из ${ss.mods.length} · наборов ${ss.reg.packs.size}`, sections: [
    {id: 'mods', label: 'Моды', icon: 'puzzle', render(p, api) {
      const banner = h('div', {class: 'note warn', hidden: !restartNeeded}, 'Изменения модов вступят в силу после перезапуска. ', button('Перезапустить сейчас', () => ss.reloadApp(), 'primary'));
      const q = h('input', {class: 'field', type: 'search', placeholder: 'Поиск модов…', value: modQuery});
      const grid = h('div', {class: 'mod-grid'});
      q.addEventListener('input', () => { modQuery = q.value; fill(); });
      p.append(banner, q, grid, h('div', {class: 'btnrow'}, button('Открыть папку модов', () => ss.host.openModsFolder().then(r => r === false && ss.ui.toast('Папка модов доступна в десктоп-версии'))), button('Перезапустить редактор', () => ss.reloadApp())));
      function fill() {
        grid.innerHTML = '';
        const ql = modQuery.trim().toLowerCase();
        const list = ss.mods.filter(m => !ql || (m.name + ' ' + m.id + ' ' + m.description).toLowerCase().includes(ql));
        if (!list.length) grid.appendChild(note(ss.mods.length ? 'Ничего не нашлось.' : 'Модов нет. Положи папку мода в mods/ и перезапусти SSpace.'));
        for (const m of list) {
          const st = {on: ['работает', 'ok'], off: ['выключен', 'off'], error: ['ошибка', 'bad']}[m.status] || ['?', 'off'];
          const sw = h('label', {class: 'switch', title: 'Включить при следующем запуске'}, h('input', {type: 'checkbox', checked: m.enabled}), h('span'));
          sw.querySelector('input').addEventListener('change', async (e) => { await setModEnabled(ss, m.id, e.target.checked); restartNeeded = true; banner.hidden = false; });
          grid.appendChild(h('div', {class: 'mod-card ' + st[1]},
            h('div', {class: 'mod-card-top'}, h('b', null, m.name), sw),
            h('div', {class: 'mod-card-meta'}, h('span', {class: 'pill ' + st[1]}, st[0]), m.version ? h('span', null, 'v' + m.version) : null, m.author ? h('span', null, m.author) : null, m.ms ? h('span', null, m.ms + ' мс') : null),
            m.description ? h('div', {class: 'mod-card-desc'}, m.description) : null,
            (m.requires && m.requires.length) ? h('div', {class: 'mod-card-req'}, 'Нужны: ' + m.requires.map(d => (ss.mods.find(x => x.id === d) || {name: d}).name).join(', ')) : null,
            (m.optional && m.optional.length) ? h('div', {class: 'mod-card-req muted'}, 'Работает вместе с: ' + m.optional.map(d => (ss.mods.find(x => x.id === d) || {name: d}).name).join(', ')) : null,
            m.error ? h('pre', {class: 'err'}, m.error) : null));
        }
      }
      fill();
    }},
    {id: 'packs', label: 'Наборы', icon: 'box', render(p) {
      const grid = h('div', {class: 'mod-grid'});
      for (const pk of ss.reg.packs.list()) grid.appendChild(h('div', {class: 'mod-card'},
        h('div', {class: 'mod-card-top'}, h('b', null, pk.name)),
        h('div', {class: 'mod-card-meta'}, h('span', {class: 'pill off'}, pk.source), h('span', null, 'v' + pk.version), h('span', null, 'id ' + pk.id)),
        h('div', {class: 'mod-card-desc'}, `${pk.terrainIds.length} ${plural(pk.terrainIds.length, 'тип', 'типа', 'типов')} ландшафта, ${pk.poiIds.length} ${plural(pk.poiIds.length, 'вид', 'вида', 'видов')} меток`)));
      for (const r of ss.packLoadResults || []) if (!r.ok) grid.appendChild(h('pre', {class: 'err'}, `${r.rel}: ${r.error}`));
      p.append(note('Наборы — JSON-файлы с типами ландшафта и метками (без кода). Свои кладутся в папку packs/.'), grid,
        h('div', {class: 'btnrow'}, button('Открыть папку наборов', () => ss.host.openPacksFolder()), button('Экспорт палитры планеты как набора…', () => ss.exportPalettePack())));
    }},
  ]});

  // ---------------- Справка ----------------
  // the help text is split into sections by its <details> blocks; lists of ids come from the registries
  const ids = (reg) => ss.reg[reg].ids().map(id => '<code>' + id + '</code>').join(' ');
  const helpSections = () => {
    const html = (ss.helpHtml || HELP_HTML).replace('{{FX}}', ids('effects')).replace('{{TEX}}', ids('textures')).replace('{{BLD}}', ids('buildings'));
    const out = []; const re = /<details[^>]*><summary><span class="sec-title">([^<]+)<\/span><\/summary><div class="sec-body help">([\s\S]*?)<\/div><\/details>/g;
    let m; while ((m = re.exec(html))) out.push({title: m[1], html: m[2]});
    return out;
  };
  const ICONS = ['galaxy', 'brush', 'dice', 'box', 'puzzle'];
  D.register({id: 'help', title: 'Справка', icon: 'help', sections: helpSections().map((s, i) => ({id: 'h' + i, label: s.title, icon: ICONS[i] || 'dots',
    render(p) { p.appendChild(h('div', {class: 'help help-page', html: helpSections()[i].html})); }}))});

  // menu entries and bar buttons
  const M = ss.reg.menus;
  M.register({id: 'app:settings', menu: 'Вид', order: 400, label: 'Настройки…', accel: 'Ctrl+,', action: () => ss.ui.toggleDialog('settings'),
    bar: {icon: 'gear', side: 'right', order: 20, active: () => ss.ui.dialogs.isOpen('settings')}});
}
