// Runs the built-in self-test in a separate, temporary profile and exits with its result.
// Usage: npm run selftest            (quick, ~20 s)
//        npm run selftest:full       (every parameter at its extremes, big planets)
//        node scripts/selftest.js quick orbit   — only tests whose name contains "orbit"
// Exit code: 0 — all passed, 1 — some failed, 2 — did not finish. Full report: selftest-report.json
// The temporary profile is removed afterwards (keep it with SSPACE_KEEP_PROFILE=1).
const {spawn} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const electron = require('electron');
const [mode = 'quick', filter = ''] = process.argv.slice(2);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sspace-selftest-'));
const env = {...process.env, SSPACE_SELFTEST: mode === 'full' ? 'full' : 'quick', SSPACE_USERDATA: profile};
if (filter) env.SSPACE_SELFTEST_FILTER = filter;
const p = spawn(electron, ['.'], {cwd: path.join(__dirname, '..'), env, stdio: 'inherit'});
p.on('exit', (code) => {
  const done = () => process.exit(code == null ? 2 : code);
  if (process.env.SSPACE_KEEP_PROFILE) { console.log('[selftest] профиль: ' + profile); return done(); }
  // Electron's helper processes may hold files a moment longer: retry for a few seconds
  let tries = 0;
  const rm = () => { try { fs.rmSync(profile, {recursive: true, force: true}); done(); } catch (e) { if (++tries < 20) setTimeout(rm, 250); else done(); } };
  rm();
});
