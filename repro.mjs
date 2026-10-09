// Starts `rspack serve`, opens the page headless, activates the lazy feature
// and reports whether the page reloaded. Exit code 1 means the bug reproduced.
//   node repro.mjs            -> lib is side-effect free (bug expected)
//   node repro.mjs --control  -> lib marked as having side effects (no reload)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright';

const control = process.argv.includes('--control');
const port = Number(process.env.PORT || 8765);
const url = `http://localhost:${port}/`;
const require = createRequire(import.meta.url);
const cli = path.join(
  path.dirname(require.resolve('@rspack/cli/package.json')),
  'bin/rspack.js',
);
console.log(
  `@rspack/core ${require('@rspack/core/package.json').version}, mode: ${control ? 'control (sideEffects: true)' : 'repro (sideEffects: false)'}`,
);

const server = spawn(process.execPath, [cli, 'serve'], {
  cwd: import.meta.dirname,
  env: { ...process.env, PORT: String(port), CONTROL: control ? '1' : '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const barrelOf = (js) => {
  const start = js.indexOf('"./src/lib/index.js"(');
  return start < 0 ? null : js.slice(start, js.indexOf('\n}', start) + 2);
};

let browser;
let reproduced = false;
try {
  for (let deadline = Date.now() + 60000; !/compiled/.test(serverLog); ) {
    if (server.exitCode != null) throw new Error(`rspack serve exited:\n${serverLog}`);
    if (Date.now() > deadline) throw new Error(`rspack serve timeout:\n${serverLog}`);
    await sleep(100);
  }

  browser = await chromium.launch();
  const page = await browser.newPage();
  const log = [];
  page.on('console', (m) => {
    if (m.text().startsWith('[HMR]')) log.push(`  browser: ${m.text().split('\n')[0]}`);
  });
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) log.push('  >>> page navigation (document load)');
  });
  page.on('response', async (r) => {
    if (!r.url().endsWith('.hot-update.js')) return;
    const body = await r.body().then(String, () => '');
    const ids = [...body.matchAll(/^"([^"]+)"\(/gm)].map((m) => m[1]);
    log.push(`  hot update ${r.url().split('/').pop()}: ${ids.join(', ') || '(runtime only)'}`);
    const barrel = barrelOf(body);
    if (barrel) log.push(`  barrel in hot update:\n${barrel.replace(/^/gm, '    ')}`);
  });

  await page.goto(url);
  await page.waitForFunction(() => sessionStorage.getItem('documentLoads') === '1');
  const before = barrelOf(await page.evaluate(() => fetch('/main.js').then((r) => r.text())));
  console.log(`\nbarrel before activation:\n${(before ?? '(not emitted as a module)').replace(/^/gm, '    ')}`);

  console.log('\nclick "activate lazy feature"');
  await page.click('#activate');
  await page.waitForFunction(
    () => document.body.dataset.feature || sessionStorage.getItem('documentLoads') !== '1',
    null,
    { timeout: 30000 },
  );
  await sleep(2000);
  console.log(log.join('\n'));

  const loads = await page.evaluate(() => sessionStorage.getItem('documentLoads'));
  reproduced = loads !== '1';
  console.log(`\ndocument loads: ${loads}`);
  console.log(
    reproduced
      ? 'REPRODUCED: activating the lazy feature reloaded the whole page.'
      : 'OK: the lazy feature was applied by HMR without a reload.',
  );
} finally {
  await browser?.close();
  const exited = new Promise((r) => server.once('exit', r));
  server.kill('SIGINT');
  await Promise.race([exited, sleep(3000)]);
  if (server.exitCode == null && server.signalCode == null) {
    server.kill('SIGKILL');
    await exited;
  }
}
process.exit(reproduced ? 1 : 0);
