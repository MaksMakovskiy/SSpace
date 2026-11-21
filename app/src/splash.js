// Loading screen. A classic script (not a module) so it runs before the 3D engine has even downloaded.
// The editor reports its stages through window.sspaceSplash.step(fraction 0..1, text) and .done().
(function () {
  const el = document.getElementById('splash');
  if (!el) return;
  const bar = el.querySelector('.splash-fill'), txt = el.querySelector('.splash-text'), pct = el.querySelector('.splash-pct'), log = el.querySelector('.splash-log');
  let shown = 0, target = 0.03, finished = false;
  const t0 = performance.now();
  // while the engine itself loads nothing reports progress: creep forward slowly so the bar never looks frozen
  const creepTo = 0.3;
  function frame() {
    if (finished) return;
    if (target < creepTo) target = Math.min(creepTo, target + 0.0012);
    shown += (target - shown) * 0.12;
    bar.style.width = (shown * 100).toFixed(1) + '%';
    pct.textContent = Math.round(shown * 100) + '%';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const api = {
    step(frac, text, detail) {
      target = Math.max(target, Math.min(1, frac));
      if (text) txt.textContent = text;
      if (detail !== undefined) log.textContent = detail;
    },
    done() {
      if (finished) return;
      target = 1; shown = 1; bar.style.width = '100%'; pct.textContent = '100%';
      finished = true;
      const ms = Math.round(performance.now() - t0);
      txt.textContent = 'Готово'; log.textContent = 'запуск за ' + (ms / 1000).toFixed(1).replace('.', ',') + ' с';
      setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, 180);
    },
    fail(message) {
      finished = true;
      el.classList.add('failed');
      txt.textContent = 'Не удалось запустить SSpace';
      log.textContent = message + ' — подробности в консоли (F12). Ctrl+R — попробовать ещё раз.';
    },
  };
  window.sspaceSplash = api;
  txt.textContent = 'Загрузка 3D-движка…';
})();
