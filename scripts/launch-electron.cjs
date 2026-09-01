const { spawn } = require('child_process');

const args = process.argv.slice(2);

let electronBinary;

try {
  electronBinary = require('electron');
} catch (error) {
  console.error('Failed to resolve Electron runtime.');
  console.error(error);
  process.exit(1);
}

const childEnv = { ...process.env };
delete childEnv.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, ['.', ...args], {
  stdio: 'inherit',
  env: childEnv,
});

child.on('close', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error('Failed to launch Electron runtime.');
  console.error(error);
  process.exit(1);
});
