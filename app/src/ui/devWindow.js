// «Журнал и метрики» (Ctrl+9): a big dialog — live numbers, the log with filters, timers and the built-in self-test.
import {h} from '../core/util.js';
import {button, note} from './widgets.js';

export function registerDevWindow(ss) {
  const copy = async (text) => { try { await navigator.clipboard.writeText(text); ss.ui.toast('Скопировано'); } catch { ss.ui.toast('Не удалось скопировать'); } };
  const report = () => ({at: new Date().toISOString(), version: ss.VERSION, api: ss.apiVersion, env: {ua: navigator.userAgent, desktop: !!ss.host.desktop},
    mods: ss.mods.map(m => ({id: m.id, status: m.status, ms: m.ms || 0, error: m.error || undefined})), metrics: ss.metrics.snapshot(), log: ss.log.entries({level: 'info'}).slice(-400).map(ss.log.line)});
  let lastTest = null, level = 'info', text = '', mq = '';

  // live numbers, refreshed every second while shown
  function liveBox() {
    const box = h('div', {class: 'dev-live'});
    const draw = () => {
      const f = ss.metrics.frame(), r = ss.metrics.render(), w = ss.metrics.world(), c = ss.log.counts();
      const cell = (k, v, bad) => h('div', {class: 'dev-num' + (bad ? ' bad' : '')}, h('b', null, String(v)), h('small', null, k));
      box.innerHTML = '';
      box.append(cell('FPS', Math.round(f.fps), f.fps && f.fps < 30), cell('кадр, мс', f.avgMs), cell('p95 кадра, мс', f.p95Ms, f.p95Ms > 33), cell('долгих кадров', f.longFrames, f.longFrames > 0),
        cell('вызовов отрисовки', r.calls), cell('треугольников', r.triangles > 9999 ? Math.round(r.triangles / 1000) + 'k' : r.triangles), cell('шейдеров', r.programs), cell('память JS, МБ', r.heapMB ?? '—'),
        cell('клеток', w.cells ?? '—'), cell('3D-деталей', w.pieces3D), cell('ошибок', c.error, c.error > 0), cell('предупреждений', c.warn));
    };
    draw(); const t = setInterval(draw, 1000);
    return [box, () => clearInterval(t)];
  }

  ss.reg.dialogs.register({id: 'devtools', title: 'Журнал и метрики', icon: 'chart', subtitle: () => `ошибок ${ss.log.counts().error} · предупреждений ${ss.log.counts().warn}`, sections: [
    {id: 'overview', label: 'Обзор', icon: 'target', render(p) {
      const [live, stop] = liveBox();
      const slow = ss.metrics.timers().sort((a, b) => b.p95 - a.p95).slice(0, 6);
      p.append(live,
        h('div', {class: 'set-card'}, h('div', {class: 'set-title'}, 'Самое медленное (p95)'), slow.length ? h('div', {class: 'dev-table'}, ...slow.map(t => h('div', {class: 'dev-tr'}, h('span', null, t.name), h('span', null, String(t.n)), h('span', null, String(t.avg)), h('span', null, String(t.p95)), h('span', null, String(t.max))))) : note('Замеров пока нет.')),
        h('div', {class: 'btnrow'}, button('Отчёт для разработчика (копировать)', () => copy(JSON.stringify(report(), null, 2)), 'primary'),
          ss.host.openLogFolder ? button('Папка логов', () => ss.host.openLogFolder()) : null));
      return stop;
    }},
    {id: 'log', label: () => `Журнал${ss.log.counts().error ? ' · ошибок ' + ss.log.counts().error : ''}`, icon: 'list', render(p) {
      const sel = h('select', {class: 'field'}, [['debug', 'Всё'], ['info', 'Инфо и выше'], ['warn', 'Предупреждения и ошибки'], ['error', 'Только ошибки']].map(([v, l]) => h('option', {value: v, selected: v === level}, l)));
      sel.addEventListener('change', () => { level = sel.value; fill(); });
      const q = h('input', {class: 'field', type: 'search', placeholder: 'Поиск по журналу', value: text});
      q.addEventListener('input', () => { text = q.value; fill(); });
      const list = h('div', {class: 'dev-log big'});
      p.append(h('div', {class: 'row2'}, sel, q), list, h('div', {class: 'btnrow'},
        button('Копировать видимое', () => copy(ss.log.text({level, text}))), button('Очистить журнал', () => { ss.log.clear(); fill(); })));
      function fill() {
        list.innerHTML = '';
        const es = ss.log.entries({level, text, limit: 500});
        if (!es.length) list.appendChild(note('Пусто.'));
        for (const e of es) list.appendChild(h('div', {class: 'dev-row ' + e.level, title: e.data !== undefined ? JSON.stringify(e.data, null, 1).slice(0, 800) : ''},
          h('span', {class: 'dev-t'}, (e.t / 1000).toFixed(1) + 'с'), h('span', {class: 'dev-cat'}, e.cat), h('span', null, e.msg)));
        list.scrollTop = list.scrollHeight;
      }
      fill();
      let tm = 0; const off = ss.log.on(() => { clearTimeout(tm); tm = setTimeout(fill, 150); });
      return () => { off(); clearTimeout(tm); };
    }},
    {id: 'metrics', label: 'Метрики', icon: 'timer', render(p) {
      const [live, stop] = liveBox();
      const q = h('input', {class: 'field', type: 'search', placeholder: 'Фильтр: generate, 3d, boot, mod, orbit…', value: mq});
      const table = h('div', {class: 'dev-table big'});
      q.addEventListener('input', () => { mq = q.value; fill(); });
      p.append(live, q, table, h('div', {class: 'btnrow'}, button('Сбросить замеры', () => { ss.metrics.reset(); fill(); }), button('Копировать JSON', () => copy(JSON.stringify(ss.metrics.snapshot(), null, 2)))));
      function fill() {
        table.innerHTML = '';
        table.appendChild(h('div', {class: 'dev-tr head'}, h('span', null, 'что'), h('span', null, 'раз'), h('span', null, 'сред.'), h('span', null, 'p95'), h('span', null, 'макс')));
        const ts = ss.metrics.timers().filter(t => !mq || t.name.includes(mq)).sort((a, b) => b.total - a.total);
        for (const t of ts) table.appendChild(h('div', {class: 'dev-tr' + (t.p95 > 200 ? ' slow' : '')}, h('span', {title: t.name}, t.name), h('span', null, String(t.n)), h('span', null, t.avg + ''), h('span', null, t.p95 + ''), h('span', null, t.max + '')));
        if (!ts.length) table.appendChild(note('Замеров пока нет.'));
        const snap = ss.metrics.snapshot(), extra = {...snap.counters, ...snap.gauges};
        if (Object.keys(extra).length) table.appendChild(h('div', {class: 'dev-kv'}, Object.entries(extra).map(([k, v]) => h('span', null, `${k}: ${v}`))));
      }
      fill(); const t = setInterval(fill, 2000);
      return () => { stop(); clearInterval(t); };
    }},
    {id: 'test', label: 'Самопроверка', icon: 'check', render(p) {
      const status = h('div', {class: 'note'}, 'Проверка идёт на временной кампании: твоя кампания, уровень и настройки вернутся как были. История отмены (Ctrl+Z) при этом очистится.');
      const res = h('div', {class: 'dev-tests big'});
      const go = async (mode) => {
        if (ss.test.running) return;
        status.textContent = 'Идёт проверка…'; status.className = 'note'; res.innerHTML = '';
        lastTest = await ss.test.run({mode, onProgress: ({i, n, test}) => { status.textContent = `Тест ${i + 1} из ${n}: ${test.name}`; }});
        draw();
      };
      p.append(h('div', {class: 'btnrow'}, button('Быстрая (≈20 с)', () => go('quick'), 'primary'), button('Полная (≈1 мин)', () => go('full'))), status, res,
        h('div', {class: 'btnrow'}, button('Сохранить отчёт…', async () => { if (!lastTest) return ss.ui.toast('Сначала запусти проверку'); await ss.host.saveFile({text: JSON.stringify(lastTest, null, 2), defaultName: 'selftest-report.json', filters: [{name: 'JSON', extensions: ['json']}]}); })),
        note('Из командной строки: npm run selftest (или selftest:full) — с кодом возврата и файлом selftest-report.json.'));
      function draw() {
        if (!lastTest) return;
        const r = lastTest;
        status.textContent = `${r.ok ? '✓ Всё в порядке' : '✗ Есть ошибки'} — ${r.passed}/${r.total}, ошибок ${r.failed}, предупреждений ${r.warnings}, ${(r.ms / 1000).toFixed(1)} с`;
        status.className = 'note ' + (r.ok ? 'ok' : 'warn');
        res.innerHTML = '';
        for (const t of r.tests) res.appendChild(h('div', {class: 'dev-test ' + (t.ok ? (t.warnings.length ? 'warnish' : 'ok') : 'bad')},
          h('span', null, t.ok ? (t.skipped ? '–' : t.warnings.length ? '!' : '✓') : '✗'), h('b', null, t.name), h('small', null, t.ms + ' мс'),
          [...t.errors, ...t.warnings, ...t.notes].length ? h('div', {class: 'dev-test-msg'}, [...t.errors, ...t.warnings, ...t.notes].slice(0, 6).join('\n')) : null));
      }
      draw();
    }},
  ]});

  ss.reg.menus.register({id: 'help:devtools', menu: 'Справка', order: 50, label: 'Журнал и метрики', accel: 'Ctrl+9', action: () => ss.ui.toggleDialog('devtools')});
  ss.reg.menus.register({id: 'help:selftest', menu: 'Справка', order: 51, label: 'Самопроверка…', action: () => ss.ui.openDialog('devtools', 'test')});

  // a red badge in the status bar while the log holds errors; click opens the log
  const bar = document.getElementById('statusbar');
  if (bar) {
    const badge = h('button', {class: 'st-log', hidden: true, title: 'Ошибки в журнале — открыть', onclick: () => ss.ui.openDialog('devtools', 'log')});
    bar.insertBefore(badge, document.getElementById('stFps'));
    const upd = () => { const c = ss.log.counts(); badge.hidden = !c.error; badge.innerHTML = ''; badge.append(ss.themes.icon('warning'), ' ' + c.error); };
    ss.log.on((e) => { if (e.level === 'error') upd(); }); upd();
  }
}
