// Built-in menu items. order: hundreds digit groups items (a separator is drawn between groups).
// enabled(ss) also gates keyboard accelerators, so planet-only items don't fire on space levels.
import {h} from '../core/util.js';

export function registerMenus(ss) {
  const M = (def) => ss.reg.menus.register(def);
  const P = (k) => () => ss.prefs[k];
  const lvl = () => (ss.space ? ss.space.nav.level : 'planet');
  const onPlanet = () => lvl() === 'planet';
  const inSpace = () => lvl() !== 'planet';

  M({id: 'file:new', menu: 'Файл', order: 10, label: 'Новая кампания…', accel: 'Ctrl+N', action: () => ss.newCampaignDialog()});
  M({id: 'file:open', menu: 'Файл', order: 20, label: 'Открыть…', accel: 'Ctrl+O', action: () => ss.openFile()});
  M({id: 'file:import', menu: 'Файл', order: 30, label: 'Импорт планеты в систему…', enabled: () => lvl() === 'system', action: () => ss.importPlanetFile()});
  M({id: 'file:save', menu: 'Файл', order: 110, label: 'Сохранить', accel: 'Ctrl+S', action: () => ss.saveFile(false)});
  M({id: 'file:saveas', menu: 'Файл', order: 120, label: 'Сохранить как…', accel: 'Ctrl+Shift+S', action: () => ss.saveFile(true)});
  M({id: 'file:png', menu: 'Файл', order: 210, label: 'Экспорт картинки PNG…', accel: 'Ctrl+E', action: () => ss.exportPng()});
  M({id: 'file:pack', menu: 'Файл', order: 220, label: 'Экспорт палитры планеты как набора…', enabled: onPlanet, action: () => ss.exportPalettePack()});

  M({id: 'edit:undo', menu: 'Правка', order: 10, label: 'Отменить', accel: 'Ctrl+Z', action: () => { if (!ss.undo()) ss.ui.toast('Нечего отменять'); }});
  M({id: 'edit:redo', menu: 'Правка', order: 20, label: 'Повторить', accel: 'Ctrl+Y', action: () => ss.redo()});
  M({id: 'edit:redo2', menu: 'Правка', order: 21, label: 'Повторить', accel: 'Ctrl+Shift+Z', hidden: true, action: () => ss.redo()});
  M({id: 'edit:fill', menu: 'Правка', order: 110, label: 'Залить всю планету выбранным типом', enabled: onPlanet, action: () => ss.fillAll()});
  M({id: 'edit:clearmarks', menu: 'Правка', order: 120, label: 'Стереть все маркеры', enabled: onPlanet, action: () => ss.clearMarkers()});
  M({id: 'edit:delete', menu: 'Правка', order: 210, label: 'Удалить выбранный объект', enabled: () => inSpace() && !!ss.space.sel, action: () => ss.space.remove()});

  M({id: 'view:up', menu: 'Вид', order: 5, label: 'Уровень выше', accel: 'Ctrl+ArrowUp', enabled: () => lvl() !== 'universe', action: () => ss.space.up()});
  M({id: 'view:universe', menu: 'Вид', order: 6, label: 'Ко всей вселенной', enabled: () => lvl() !== 'universe', action: () => ss.space.go('universe')});
  const tog = (id, order, label, key, accel, enabled = onPlanet) => M({id: 'view:' + id, menu: 'Вид', order, label, accel, enabled, checked: P(key), action: () => ss.setPref(key, !ss.prefs[key])});
  tog('grid', 110, 'Сетка гексов', 'grid', 'G');
  tog('textures', 120, 'Рельефная поверхность', 'textures');
  tog('buildings', 130, 'Здания', 'buildings');
  tog('atmo', 140, 'Атмосфера', 'atmosphere');
  tog('anim', 150, 'Анимация эффектов', 'anim', undefined, () => true);
  tog('fps', 155, 'Счётчик FPS', 'fps', 'F3', () => true);
  tog('otherPlanets', 180, 'Другие планеты на небе', 'otherPlanets');
  tog('orbits', 190, 'Орбиты планет', 'orbits');
  tog('markers', 160, 'Маркеры', 'markers');
  tog('pois', 170, 'Точки интереса', 'pois');
  for (const [v, l, o] of [['show', 'видны', 210], ['half', 'полупрозрачные', 220], ['hide', 'скрыты', 230]]) {
    M({id: 'view:same:' + v, menu: 'Вид', order: o, label: 'Линии внутри типа: ' + l, enabled: onPlanet, checked: () => ss.prefs.sameLines === v, action: () => ss.setPref('sameLines', v)});
  }
  M({id: 'view:reset', menu: 'Вид', order: 310, label: 'Сбросить вид', accel: 'Home', action: () => (onPlanet() ? ss.scene.resetView() : ss.space.view.frameAll())});
  M({id: 'view:zin', menu: 'Вид', order: 320, label: 'Приблизить', accel: '=', enabled: onPlanet, action: () => ss.scene.zoomBy(0.8)});
  M({id: 'view:zout', menu: 'Вид', order: 330, label: 'Отдалить', accel: '-', enabled: onPlanet, action: () => ss.scene.zoomBy(1.25)});

  M({id: 'planet:settings', menu: 'Планета', order: 10, label: 'Настройки планеты', enabled: onPlanet, action: () => ss.ui.openWindow('planet')});
  M({id: 'planet:gen', menu: 'Планета', order: 20, label: 'Ещё вариант этой планеты', accel: 'Ctrl+G', enabled: onPlanet, action: () => { const g = ss.doc.meta && ss.doc.meta.gen; ss.generate(g && ss.reg.generators.get(g.id) ? g.id : ss.reg.generators.ids()[0], {seed: Math.floor(Math.random() * 1e9), params: (g && g.params) || {}, layers: (g && g.layers) || {}, keep: !!(g && g.keep)}); }});
  M({id: 'planet:new', menu: 'Планета', order: 30, label: 'Новая карта для этой планеты…', enabled: onPlanet, action: () => ss.newPlanetDialog()});
  M({id: 'planet:sync', menu: 'Планета', order: 110, label: 'Обновить типы из наборов', enabled: onPlanet, action: () => ss.syncPaletteFromPacks()});
  M({id: 'planet:pause', menu: 'Планета', order: 210, label: 'Пауза суток', accel: 'Space', hidden: true, enabled: onPlanet, checked: () => ss.doc && ss.doc.sky.paused, action: () => ss.sky.togglePause()});

  M({id: 'mods:manager', menu: 'Моды', order: 10, label: 'Моды и наборы…', action: () => ss.ui.toggleDialog('mods'), bar: {icon: 'puzzle', side: 'right', order: 10, active: () => ss.ui.dialogs.isOpen('mods')}});
  M({id: 'mods:folder', menu: 'Моды', order: 20, label: 'Открыть папку модов', action: () => ss.host.openModsFolder()});
  M({id: 'mods:packs', menu: 'Моды', order: 30, label: 'Открыть папку наборов', action: () => ss.host.openPacksFolder()});
  M({id: 'mods:reload', menu: 'Моды', order: 110, label: 'Перезапустить редактор', accel: 'Ctrl+R', action: () => ss.reloadApp()});
  M({id: 'mods:devtools', menu: 'Моды', order: 120, label: 'Инструменты разработчика', accel: 'F12', action: () => ss.host.toggleDevTools()});

  M({id: 'help:help', menu: 'Справка', order: 10, label: 'Справка: управление и API модов', accel: 'F1', action: () => ss.ui.toggleDialog('help'), bar: {icon: 'help', side: 'right', order: 30, active: () => ss.ui.dialogs.isOpen('help')}});
  M({id: 'help:about', menu: 'Справка', order: 20, label: 'О SSpace', action: () => ss.ui.openDialog('settings', 'about')});
}
