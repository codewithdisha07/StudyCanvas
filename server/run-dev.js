import { spawn } from 'child_process';

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';
const nodeCmd = 'node';

console.log('🚀 Starting StudyCanvas AI (Frontend + Express AI Proxy)...');

// Start Express Server
const serverProcess = spawn(nodeCmd, ['server/index.js'], {
  stdio: 'inherit',
  shell: true,
});

// Start Vite dev server
const viteProcess = spawn(npxCmd, ['vite'], {
  stdio: 'inherit',
  shell: true,
});

const cleanup = () => {
  serverProcess.kill();
  viteProcess.kill();
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
