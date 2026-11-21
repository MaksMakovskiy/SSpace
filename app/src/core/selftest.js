// Built-in self-test. Runs on a temporary campaign: your campaign, the open level, preferences and the file path
// are put back afterwards, and autosave is paused meanwhile. Errors that reach the log during a test fail it.
//   ss.test.run({mode: 'quick' | 'full', filter: 'orbit'}) → report
//   ss.test.register({id, name, group, quick: true, run: async (t, ss) => { t.ok(cond, 'текст'); t.eq(a, b, '…'); t.warn('…'); t.budget(ms, limit, '…'); }})
// From the command line: npm run selftest (quick) / npm run selftest:full — prints a summary, writes selftest-report.json.
import {serializeCampaign, parseCampaign, demoCampaign} from '../space/campaign.js';
import {serializeDoc, parseDoc} from './document.js';

export function createSelfTest(ss) {
  const tests = [];
  let running = false;
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const register = (def) => {
    if (!def || !def.id || typeof def.run !== 'function') throw new Error('test: нужны id и run');
    const i = tests.findIndex(t => t.id === def.id); const d = {group: 'Моды', quick: true, ...def};
    if (i >= 0) tests[i] = d; else tests.push(d);
  };
  const cellsValid = () => { const n = ss.doc.palette.length; for (let i = 0; i < ss.doc.cells.length; i++) if (ss.doc.cells[i] >= n) return false; return true; };
  const toPlanet = async () => {
    const sp = ss.space, g = sp.campaign.galaxies[0], s = g.systems.find(x => x.planets.length) || g.systems[0];
    if (sp.nav.level !== 'planet' || !ss.doc) { sp.go('planet', {gid: g.id, sid: s.id, pid: s.planets[0].id}); await wait(700); }
  };
  const extremes = (p) => p.type === 'check' ? [false, true] : p.type === 'select' ? (p.options || []).map(o => o.value) : [p.min, p.max];

  // ---------------- built-in tests ----------------
  register({id: 'mods', name: 'Все включённые моды запустились', group: 'Ядро', run(t) {
    for (const m of ss.mods) if (m.enabled && m.status !== 'on') t.fail(`мод ${m.id}: ${m.error || m.status}`);
    for (const m of ss.mods) if (m.ms > 300) t.warn(`мод ${m.id} запускался ${m.ms} мс`);
  }});
  register({id: 'registries', name: 'Ссылки между реестрами целы', group: 'Ядро', run(t) {
    for (const tr of ss.reg.terrains.list()) {
      if (tr.fx && !ss.reg.effects.has(tr.fx)) t.warn(`тип ${tr.id}: нет эффекта ${tr.fx}`);
      if (tr.tex && !ss.reg.textures.has(tr.tex)) t.warn(`тип ${tr.id}: нет текстуры ${tr.tex}`);
      if (tr.bld && !ss.reg.buildings.has(tr.bld)) t.warn(`тип ${tr.id}: нет застройки ${tr.bld}`);
    }
    t.ok(ss.reg.generators.size > 0, 'нет генераторов');
  }});
  register({id: 'generators', name: 'Генераторы', group: 'Планета', async run(t, ss, mode) {
    await toPlanet();
    const sizes = mode === 'full' ? [3, 10, 30] : [10];
    for (const n of sizes) {
      ss.resizePlanet(n); await wait(50);
      for (const g of ss.reg.generators.list()) {
        const ms = t.time(() => ss.generate(g.id, {seed: n * 7 + 1, silent: true}));
        t.ok(cellsValid(), `${g.id} n=${n}: клетка ссылается за пределы палитры`);
        t.budget(ms, n >= 30 ? 400 : 200, `${g.id} n=${n}`);
        if (mode === 'full') for (const p of g.params || []) for (const v of extremes(p)) ss.generate(g.id, {seed: 3, silent: true, params: {[p.id]: v}});
      }
    }
  }});
  register({id: 'layers', name: 'Дополнения к генерации', group: 'Планета', async run(t, ss, mode) {
    await toPlanet();
    for (const L of ss.reg.genLayers.list()) {
      ss.generate('continents', {seed: 5, silent: true, layers: {[L.id]: {on: true}}});
      t.ok(cellsValid(), `${L.id}: клетки вне палитры`);
      if (mode === 'full') for (const p of L.params || []) for (const v of extremes(p)) ss.generate('continents', {seed: 6, silent: true, layers: {[L.id]: {on: true, params: {[p.id]: v}}}});
    }
  }});
  register({id: 'undo', name: 'Отмена и повтор через генерации', group: 'Планета', async run(t) {
    await toPlanet();
    const ids = ss.reg.generators.ids().slice(0, 4), snaps = [];
    for (const id of ids) { ss.generate(id, {seed: 9, silent: true}); snaps.push(ss.doc.cells.map(c => ss.doc.palette[c].src || ss.doc.palette[c].name).join()); }
    for (let i = ids.length - 1; i > 0; i--) { ss.undo(); t.ok(cellsValid(), 'после отмены клетки вне палитры'); t.eq(ss.doc.cells.map(c => ss.doc.palette[c].src || ss.doc.palette[c].name).join(), snaps[i - 1], `отмена №${ids.length - i} вернула не тот мир`); }
    for (let i = 1; i < ids.length; i++) ss.redo();
    t.eq(ss.doc.cells.map(c => ss.doc.palette[c].src || ss.doc.palette[c].name).join(), snaps[ids.length - 1], 'повтор не вернул последний мир');
  }});
  register({id: 'planet-file', name: 'Сохранение и загрузка планеты', group: 'Планета', async run(t) {
    await toPlanet();
    ss.generate(ss.reg.generators.has('angels') ? 'angels' : 'continents', {seed: 3, silent: true, layers: ss.reg.genLayers.has('settlements') ? {settlements: {on: true}} : {}});
    ss.particles.toggleLook('snow', true); ss.particles.setFx('snow', {density: 2});
    if (ss.orbit) ss.orbit.add([...ss.orbit.types.keys()][0]);
    const back = parseDoc(serializeDoc(ss.doc));
    t.eq(back.cells.join(), Array.from(ss.doc.cells).join(), 'клетки');
    t.eq(back.palette.length, ss.doc.palette.length, 'палитра');
    for (const k of ['look', 'fx', 'orbit', 'gen']) t.eq(JSON.stringify(back.meta[k]), JSON.stringify(ss.doc.meta[k]), 'meta.' + k);
    t.eq(back.pois.length, ss.doc.pois.length, 'метки');
  }});
  register({id: 'campaign-file', name: 'Сохранение и загрузка кампании', group: 'Космос', run(t) {
    ss.space.commitPlanet();
    const c = ss.space.campaign, back = parseCampaign(serializeCampaign(c));
    const count = (x) => x.galaxies.reduce((a, g) => a + g.systems.reduce((b, s) => b + s.planets.length, 0), 0);
    t.eq(count(back), count(c), 'число планет');
    t.eq(back.galaxies.length, c.galaxies.length, 'число галактик');
  }});
  register({id: 'palette', name: 'Палитра', group: 'Планета', async run(t) {
    await toPlanet(); ss.generate('continents', {seed: 2, silent: true});
    const n0 = ss.doc.palette.length; ss.addCustomType(); ss.addTerrainToPalette('base:lava', {select: false});
    t.ok(ss.doc.palette.length >= n0 + 1, 'тип не добавился');
    const last = ss.doc.palette.length - 1; ss.updatePaletteEntry(last, {name: 'Тест', color: '#123456', h: 1});
    ss.history.begin('terrain'); for (let c = 0; c < 20; c++) ss.history.set(c, last); ss.history.commit('test');
    await ss.removePaletteEntry(last); t.ok(cellsValid(), 'после удаления типа клетки вне палитры');
    ss.compactPalette({ignoreHistory: true}); t.ok(cellsValid(), 'после чистки палитры клетки вне палитры');
    ss.ui.closeWindow('props');
  }});
  register({id: 'painting', name: 'Кисть, заливка, маркеры, метки', group: 'Планета', async run(t) {
    await toPlanet();
    const before = Array.from(ss.doc.cells);
    ss.history.begin('terrain'); for (let c = 0; c < 30; c++) ss.history.set(c, 1); ss.history.commit('t');
    ss.undo(); t.eq(Array.from(ss.doc.cells).join(), before.join(), 'отмена мазка');
    ss.selectType(1); ss.fillAll(); t.eq(new Set(ss.doc.cells).size, 1, 'заливка'); ss.undo();
    ss.history.begin('mark'); for (let c = 0; c < 10; c++) ss.history.set(c, 1); ss.history.commit('m'); ss.clearMarkers();
    t.ok(!ss.doc.markers.some(Boolean), 'маркеры не стёрлись');
    const i = ss.pois.add(5, ss.reg.poiKinds.ids()[0]); ss.pois.update(i, {name: 'Тест'}); ss.pois.remove(i);
  }});
  register({id: 'resize', name: 'Смена размера планеты', group: 'Планета', async run(t) {
    await toPlanet();
    for (const k of ss.reg.poiKinds.ids().slice(0, 3)) ss.pois.add(7, k);
    for (const n of [4, 40, 10]) { ss.resizePlanet(n); await wait(50); t.eq(ss.doc.cells.length, ss.view.G.V, `n=${n}: клеток`); t.ok(!ss.doc.pois.some(p => p.c >= ss.doc.cells.length), `n=${n}: метка вне планеты`); }
  }});
  register({id: 'effects', name: 'Эффекты', group: 'Планета', async run(t) {
    await toPlanet();
    for (const e of ss.particles.list()) { ss.particles.toggleLook(e.key, true); ss.particles.setFx(e.key, {density: 3, speed: 3, size: 3, opacity: 2, color: '#ff00ff'}); ss.particles.setFx(e.key, null); }
    await wait(200);
    for (const e of ss.particles.list()) ss.particles.toggleLook(e.key, false);
    let vis = 0; ss.scene.tiltGroup.traverse(o => { if (o.isPoints && o.visible && o.parent === ss.scene.tiltGroup) vis++; });
    t.eq(vis, 0, 'облака видны после выключения всех эффектов');
  }});
  register({id: 'orbit', name: 'Объекты на орбите', group: 'Планета', async run(t, ss, mode) {
    if (!ss.orbit) return t.skip('мод «Орбита» выключен');
    await toPlanet(); ss.orbit.clear();
    for (const [id, ty] of ss.orbit.types) {
      ss.orbit.add(id);
      if (mode === 'full') for (const pick of ['min', 'max']) { const v = {}; for (const p of ty.params) if (p.kind !== 'color' && p[pick] !== undefined) v[p.id] = p[pick]; ss.orbit.add(id, v); }
    }
    await wait(300);
    let built = 0; ss.scene.tiltGroup.traverse(o => { if (o.userData.itemId) built++; });
    t.eq(built, ss.orbit.items().length, 'построено объектов');
    await wait(500); // the animation ticks run a few frames
    ss.orbit.clear();
  }});
  register({id: 'windows', name: 'Все окна открываются', group: 'Интерфейс', async run(t) {
    await toPlanet();
    // the log window (the test may be running from it) is left alone; the others go back to how they were
    const list = ss.reg.windows.list().filter(w => w.id !== 'devtools'), wasOpen = new Set(list.filter(w => ss.ui.wm && ss.ui.wm.isOpen(w.id)).map(w => w.id));
    for (const w of list) { try { ss.ui.openWindow(w.id); } catch (e) { t.fail(`окно ${w.id}: ${e.message}`); } }
    await wait(250);
    for (const w of list) if (!wasOpen.has(w.id)) ss.ui.closeWindow(w.id);
  }});
  register({id: 'dialogs', name: 'Большие окна и кнопки вверху', group: 'Интерфейс', async run(t) {
    await toPlanet();
    for (const d of ss.reg.dialogs.list()) {
      ss.ui.openDialog(d.id); await wait(60);
      t.ok(ss.ui.dialogs.isOpen(d.id), `окно ${d.id} не открылось`);
      for (const s of d.sections || []) {
        ss.ui.openDialog(d.id, s.id); await wait(40);
        const err = document.querySelector('.bigd-pane .err'); if (err && /^Ошибка/.test(err.textContent)) t.fail(`${d.id}/${s.id}: ${err.textContent}`);
      }
      ss.ui.closeDialog(); t.ok(!ss.ui.dialogs.isOpen(), `окно ${d.id} не закрылось`);
    }
    // the quick buttons: each one opens and closes what it stands for
    for (const b of document.querySelectorAll('#menubar .bar-btn')) {
      if (b.hidden || b.disabled) continue;
      b.click(); await wait(150); b.click(); await wait(80);
    }
    t.ok(!ss.ui.dialogs.isOpen() && !(ss.generatorOpen && ss.generatorOpen()), 'после повторного нажатия кнопок что-то осталось открытым');
  }});
  register({id: 'quickgen', name: 'Быстрая генерация звёзд и планет', group: 'Интерфейс', async run(t) {
    if (!ss.quickGen) return t.skip('нет быстрой генерации');
    const sp = ss.space, g = sp.campaign.galaxies[0]; if (!g) return t.skip('нет галактики');
    sp.go('galaxy', {gid: g.id}); await wait(300);
    const o = ss.quickGen.state.gal, keep = {...o, types: [...o.types]};
    try {
      Object.assign(o, {mode: 'add', count: 25, dist: 'arms', r0: 20, r1: 90, minDist: 6, sector: '', pMin: 1, pMax: 2, routes: true, seed: 12345});
      const plan = ss.quickGen.planStars(g, o), n0 = g.systems.length;
      t.ok(plan.length > 0, 'план пуст');
      for (const [x, z] of plan) { const r = Math.hypot(x, z); t.ok(r >= 19.9 && r <= 90.1, 'звезда вне кольца'); for (const s of g.systems) t.ok(Math.hypot(s.x - x, s.z - z) >= 6 - 1e-6, 'новая звезда ближе допустимого к старой'); }
      ss.ui.openDialog('quickgen', 'stars'); await wait(150);
      document.querySelector('.qg-go').click(); await wait(250);
      const g2 = sp.campaign.galaxies[0];
      t.eq(g2.systems.length, n0 + plan.length, 'систем после генерации');
      t.ok(g2.systems.slice(n0).every(s => s.planets.filter(p => !p.parent).length >= 1), 'у новых систем нет планет');
      t.eq(sp.view.ringCount, g2.systems.filter(s => s.planets.some(p => p.doc)).length, 'обводок у систем, где открывали планеты');
      sp.undo(); await wait(100); t.eq(sp.campaign.galaxies[0].systems.length, n0, 'Ctrl+Z после генерации звёзд');
      // planets of chosen types in one system
      const s = sp.campaign.galaxies[0].systems[0]; sp.go('system', {gid: g.id, sid: s.id}); await wait(250);
      const so = ss.quickGen.state.sys, ksys = {...so, counts: {...so.counts}}, gid = ss.reg.generators.ids()[0];
      Object.assign(so, {mode: 'add', counts: {[gid]: 3}, random: 0, moonChance: 0});
      const p0 = s.planets.length;
      ss.ui.openDialog('quickgen', 'planets'); await wait(150);
      document.querySelector('.qg-go').click(); await wait(250);
      const s2 = sp.findAny('system', s.id);
      t.eq(s2.planets.length, p0 + 3, 'планет после генерации');
      t.ok(s2.planets.slice(p0).every(p => p.gen === gid), 'тип новых планет');
      sp.undo(); await wait(100);
      Object.assign(so, ksys);
    } finally { Object.assign(o, keep); ss.ui.closeDialog(); }
  }});
  register({id: 'marks-search', name: 'Отметки и поиск', group: 'Интерфейс', async run(t) {
    if (!ss.search) return t.skip('нет поиска');
    const sp = ss.space, g = sp.campaign.galaxies[0]; if (!g || !g.systems.length) return t.skip('нет систем');
    const s = g.systems[0], p = s.planets[0];
    sp.go('universe'); await wait(150);
    sp.setMark({kind: 'system', id: s.id}, '#ffb020');
    if (p) sp.setMark({kind: 'planet', id: p.id}, '#4cc9f0');
    t.eq(sp.findAny('system', s.id).mark, '#ffb020', 'отметка системы');
    if (p) t.eq(sp.findAny('planet', p.id).mark, '#4cc9f0', 'отметка планеты (поставлена с уровня вселенной)');
    const {parseCampaign, serializeCampaign} = await import('../space/campaign.js');
    const c2 = parseCampaign(serializeCampaign(sp.campaign));
    t.eq(c2.galaxies[0].systems[0].mark, '#ffb020', 'отметка после сохранения');
    ss.search.state.q = s.name; ss.search.state.kind = 'all'; ss.search.state.marked = true;
    const hits = ss.search.filter(ss.search.index());
    t.ok(hits.length && hits[0].id === s.id, 'поиск по имени среди отмеченных');
    ss.search.state.q = ''; ss.search.state.marked = false;
    ss.ui.openDialog('search'); await wait(80); t.ok(!!document.querySelector('.sr-input'), 'окно поиска');
    ss.ui.closeDialog();
    sp.setMark({kind: 'system', id: s.id}, ''); if (p) sp.setMark({kind: 'planet', id: p.id}, '');
  }});
  register({id: 'orbit-place', name: 'Орбита: свободные места и раскладка', group: 'Планета', async run(t) {
    await toPlanet(); if (!ss.orbit || !ss.orbit.arrange) return t.skip('нет орбиты');
    ss.orbit.clear();
    for (let i = 0; i < 3; i++) ss.orbit.add('ring');
    for (let i = 0; i < 3; i++) ss.orbit.add('station');
    t.eq(ss.orbit.conflicts().size, 0, 'новые объекты встали друг на друга');
    const r = ss.orbit.items().filter(x => x.type === 'ring');
    ss.orbit.update(r[1].id, {radius: r[0].radius});
    t.ok(ss.orbit.conflicts().size > 0, 'наложение не замечено');
    ss.orbit.arrange();
    t.eq(ss.orbit.conflicts().size, 0, 'после «Разложить» остались пересечения');
    ss.orbit.clear();
  }});
  register({id: 'themes', name: 'Темы оформления', group: 'Интерфейс', async run(t) {
    if (!ss.themes) return t.skip('нет тем');
    const was = ss.themes.current && ss.themes.current.id;
    try {
      for (const th of ss.reg.themes.list()) {
        ss.themes.apply(th.id); await wait(60);
        t.eq(document.documentElement.dataset.theme, th.id, 'тема не применилась');
        const ico = document.querySelector('#menubar .bar-btn .ico');
        if (ico) t.ok(ico.innerHTML.trim().length > 0, `тема ${th.id}: пустой значок`);
      }
    } finally { ss.themes.apply(was || 'base'); }
  }});
  register({id: 'gallery', name: 'Галерея генераторов', group: 'Интерфейс', async run(t) {
    await toPlanet(); if (!ss.openGenerator) return t.skip('нет галереи');
    ss.openGenerator(); await wait(1800);
    const cards = document.querySelectorAll('.genx-card').length, drawn = [...document.querySelectorAll('.genx-card-img')].filter(c => c.width > 0).length;
    ss.closeGenerator();
    t.eq(cards, ss.reg.generators.size, 'карточек'); t.eq(drawn, cards, 'нарисованных превью');
  }});
  register({id: 'space', name: 'Космос: уровни, объекты, маршруты', group: 'Космос', async run(t) {
    const sp = ss.space, okc = ss.ui.confirm; ss.ui.confirm = async () => true;
    try {
      sp.go('universe'); await wait(300); t.eq(sp.nav.level, 'universe', 'уровень');
      sp.addAt(300, 200); const g = sp.campaign.galaxies[sp.campaign.galaxies.length - 1];
      sp.go('galaxy', {gid: g.id}); await wait(300); sp.addAt(15, 5); sp.addRandom();
      t.ok(g.systems.length >= 2, 'системы не создались');
      const [s1, s2] = g.systems; sp.link(s1.id, s2.id); t.ok(g.links.length >= 1, 'маршрут не создался');
      sp.go('system', {gid: g.id, sid: s1.id}); await wait(300); sp.addRandom(); sp.addRandom();
      const p = s1.planets[0]; sp.addMoon(p.id); t.ok(s1.planets.some(x => x.parent === p.id), 'луна не создалась');
      sp.go('planet', {gid: g.id, sid: s1.id, pid: p.id}); await wait(500); t.ok(ss.doc && ss.doc.cells.length === ss.view.G.V, 'новая планета не открылась');
      sp.go('system', {gid: g.id, sid: s1.id}); await wait(300);
      sp.movePlanet(s1.planets[1].id, s2.id); t.ok(s2.planets.length >= 1, 'планета не перенеслась');
      await sp.remove({kind: 'planet', id: p.id}); t.ok(!s1.planets.some(x => x.parent === p.id), 'осталась луна без планеты');
      sp.go('universe'); await wait(300); await sp.remove({kind: 'galaxy', id: g.id});
      t.ok(!sp.campaign.galaxies.includes(g), 'галактика не удалилась');
      sp.undo(); t.ok(sp.campaign.galaxies.some(x => x.id === g.id), 'отмена удаления не сработала');
    } finally { ss.ui.confirm = okc; }
  }});
  register({id: 'perf', name: 'Скорость на большой планете', group: 'Скорость', quick: false, async run(t) {
    await toPlanet(); ss.resizePlanet(100); await wait(100);
    for (const g of ss.reg.generators.list()) t.budget(t.time(() => ss.generate(g.id, {seed: 3, silent: true})), 1500, `${g.id} на 100 000 клеток`);
    await wait(400); const ms = t.time(() => ss.buildings.rebuild()); t.budget(ms, 250, '3D на 100 000 клеток');
    ss.resizePlanet(10); await wait(50);
  }});
  register({id: 'frames', name: 'Кадры в секунду', group: 'Скорость', async run(t) {
    await toPlanet(); await wait(300); const mark = ss.metrics.frameMark(); await wait(1200);
    const f = ss.metrics.frame(mark);
    // a hidden or minimised window draws about once a second: that says nothing about speed
    if (!f.samples || f.avgMs > 500) return t.skip('окно скрыто или свёрнуто: кадры не замерить');
    t.note(`${f.fps} FPS, кадр ${f.avgMs} мс, p95 ${f.p95Ms} мс`);
    if (f.fps < 30) t.warn(`мало кадров: ${f.fps} FPS`);
  }});

  // ---------------- runner ----------------
  async function run({mode = 'quick', filter = '', onProgress} = {}) {
    if (running) throw new Error('самопроверка уже идёт');
    running = true;
    const t0 = performance.now(), sp = ss.space, log = ss.log;
    ss.space.commitPlanet();
    // put everything back afterwards
    const keep = {camp: (() => { sp.campaign.meta = sp.campaign.meta || {}; sp.campaign.meta.nav = {...sp.nav}; return serializeCampaign(sp.campaign); })(),
      nav: {...sp.nav}, file: ss.editor.filePath, dirty: ss.editor.dirty, prefs: {...ss.prefs}, confirm: ss.ui.confirm, toast: ss.ui.toast};
    ss.autosavePaused = true;
    ss.ui.confirm = async () => true; ss.ui.toast = () => {};
    log.info('selftest', `Самопроверка (${mode}) началась`);
    const list = tests.filter(x => (mode === 'full' || x.quick !== false) && (!filter || (x.id + ' ' + x.name + ' ' + x.group).toLowerCase().includes(filter.toLowerCase())));
    const results = [];
    try {
      ss.loadCampaign(demoCampaign(20261121)); await wait(500);
      for (let i = 0; i < list.length; i++) {
        const def = list[i], r = {id: def.id, name: def.name, group: def.group, ok: true, skipped: false, ms: 0, errors: [], warnings: [], notes: []};
        onProgress && onProgress({i, n: list.length, test: def});
        const t = {
          ok: (c, msg) => { if (!c) r.errors.push(msg || 'условие не выполнено'); return !!c; },
          eq: (a, b, msg) => { if (a !== b) r.errors.push(`${msg || 'не равно'}: ${String(a).slice(0, 60)} ≠ ${String(b).slice(0, 60)}`); return a === b; },
          fail: (msg) => { r.errors.push(msg); },
          warn: (msg) => { r.warnings.push(msg); },
          note: (msg) => { r.notes.push(msg); },
          skip: (msg) => { r.skipped = true; r.notes.push(msg || 'пропущен'); },
          time: (fn) => { const s = performance.now(); fn(); return performance.now() - s; },
          budget: (ms, limit, label) => { if (ms > limit) r.warnings.push(`${label}: ${Math.round(ms)} мс (норма ${limit})`); },
          wait,
        };
        // errors written to the log while the test runs belong to it
        const off = log.on(e => { if (e.level === 'error' && e.cat !== 'selftest') r.errors.push(`[${e.cat}] ${e.msg}`.slice(0, 200)); });
        const s = performance.now();
        try {
          await Promise.race([def.run(t, ss, mode), wait(mode === 'full' ? 120000 : 45000).then(() => { throw new Error('тест не закончился за отведённое время'); })]);
        } catch (e) { r.errors.push('исключение: ' + (e && e.message || e)); log.error('selftest', `${def.id}: ${e && e.message}`, e); }
        off();
        r.ms = Math.round(performance.now() - s); r.ok = !r.errors.length;
        results.push(r);
        log[r.ok ? (r.warnings.length ? 'warn' : 'info') : 'error']('selftest', `${r.ok ? (r.skipped ? '–' : '✓') : '✗'} ${def.name} — ${r.ms} мс${r.errors.length ? ': ' + r.errors.slice(0, 2).join('; ') : ''}`);
        await wait(30);
      }
    } finally {
      // restore the user's world
      if (ss.closeGenerator) ss.closeGenerator();
      ss.loadCampaign(parseCampaign(keep.camp), {filePath: keep.file});
      for (const [k, v] of Object.entries(keep.prefs)) if (ss.prefs[k] !== v) ss.setPref(k, v);
      ss.ui.confirm = keep.confirm; ss.ui.toast = keep.toast;
      ss.editor.dirty = keep.dirty; ss.ui.updateTitle();
      ss.autosavePaused = false;
      running = false;
    }
    const failed = results.filter(r => !r.ok), warnings = results.reduce((a, r) => a + r.warnings.length, 0);
    const report = {
      ok: !failed.length, mode, at: new Date().toISOString(), version: ss.VERSION, api: ss.apiVersion, ms: Math.round(performance.now() - t0),
      total: results.length, passed: results.filter(r => r.ok && !r.skipped).length, failed: failed.length, skipped: results.filter(r => r.skipped).length, warnings,
      env: {ua: navigator.userAgent, desktop: !!ss.host.desktop, screen: `${innerWidth}x${innerHeight}@${devicePixelRatio}`},
      mods: ss.mods.map(m => ({id: m.id, status: m.status, ms: m.ms || 0, error: m.error || undefined})),
      tests: results, metrics: ss.metrics.snapshot(), log: ss.log.entries({level: 'warn'}).slice(-80).map(ss.log.line),
    };
    log[report.ok ? 'info' : 'error']('selftest', `Самопроверка: ${report.ok ? 'всё в порядке' : 'есть ошибки'} — ${report.passed}/${report.total}, ошибок ${report.failed}, предупреждений ${warnings}, ${(report.ms / 1000).toFixed(1)} с`);
    ss.hooks.emit('selftest:done', report);
    return report;
  }
  return {register, run, get list() { return tests.slice(); }, get running() { return running; }};
}
