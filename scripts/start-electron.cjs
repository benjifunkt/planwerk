const { spawn } = require('child_process');
const net = require('net');

const viteHost = '127.0.0.1';
const vitePort = 3000;
const viteUrl = `http://${viteHost}:${vitePort}`;
const args = process.argv.slice(2);

let electronBinary;

try {
  electronBinary = require('electron');
} catch (error) {
  console.error('Failed to resolve Electron runtime.');
  console.error(error);
  process.exit(1);
}

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(host, port, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortOpen(host, port)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for Vite at ${viteUrl}.`);
}

function spawnNpmScript(scriptName) {
  return spawn('npm', ['run', scriptName], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

function spawnElectron() {
  const childEnv = { ...process.env };
  delete childEnv.ELECTRON_RUN_AS_NODE;

  return spawn(electronBinary, ['.', ...args], {
    stdio: 'inherit',
    env: childEnv,
  });
}

function stopChild(child) {
  if (!child || child.killed) return;

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', child.pid, '/f', '/t'], { stdio: 'ignore' });
    return;
  }

  child.kill('SIGTERM');
}

async function main() {
  let viteProcess = null;

  if (!(await isPortOpen(viteHost, vitePort))) {
    console.log(`Vite is not running at ${viteUrl}; starting it now.`);
    viteProcess = spawnNpmScript('dev');
    await waitForPort(viteHost, vitePort);
  }

  const electronProcess = spawnElectron();

  electronProcess.on('close', (code, signal) => {
    stopChild(viteProcess);

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });

  electronProcess.on('error', (error) => {
    stopChild(viteProcess);
    console.error('Failed to launch Electron runtime.');
    console.error(error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
