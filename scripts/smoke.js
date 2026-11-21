// Starts the app for a few seconds and prints renderer console output, then exits.
// Usage: npm run smoke
const {spawn} = require('child_process');
const electron = require('electron');
const p = spawn(electron, ['.'], {cwd: require('path').join(__dirname, '..'), env: {...process.env, SSPACE_SMOKE: '1'}, stdio: 'inherit'});
p.on('exit', (code) => process.exit(code || 0));
