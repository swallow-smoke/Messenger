const { spawn } = require('node:child_process');
const { dirname, join } = require('node:path');
const electronPath = require('electron');
const electronViteBin = join(dirname(require.resolve('electron-vite/package.json')), 'bin/electron-vite.js');

const child = spawn(process.execPath, [electronViteBin, 'dev'], {
  env: {
    ...process.env,
    ELECTRON_EXEC_PATH: electronPath,
  },
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
