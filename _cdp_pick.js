const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9226;
const profile = path.join(os.tmpdir(), 'cdp-test-' + Date.now());
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const l = await r.json(); const p = l.find(t => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch (e) {}
    await sleep(250);
  }
  throw new Error('no target');
}

(async () => {
  const ws = new WebSocket(await getWsUrl());
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXC: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description ? m.params.exceptionDetails.exception.description : (m.params.exceptionDetails.text || 'unknown')));
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  await new Promise(r => ws.onopen = r);
  const send = (method, params = {}) => new Promise(res => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
  const evalJs = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
  await send('Page.enable'); await send('Runtime.enable');

  await send('Page.navigate', { url: 'http://localhost:8123/bilhetes.html' });
  await sleep(3000);

  const out = {};
  const gridHidden = () => evalJs(`document.querySelector('#wizard-sectors').hidden`);
  const pickedHidden = () => evalJs(`document.querySelector('#wizard-picked').hidden`);
  const next1Disabled = () => evalJs(`document.querySelector('#wz-next-1').disabled`);

  out.initial_gridVisible = await evalJs(`!document.querySelector('#wizard-sectors').hidden`);
  out.initial_pickedHidden = await pickedHidden();
  out.initial_next1Disabled = await next1Disabled();

  // select a sector -> collapse
  await evalJs(`document.querySelector('.wz-sector:not(.soldout)').click()`);
  await sleep(400);
  out.afterSelect_gridHidden = await gridHidden();
  out.afterSelect_pickedVisible = await evalJs(`!document.querySelector('#wizard-picked').hidden`);
  out.afterSelect_pickedName = await evalJs(`document.querySelector('#wz-picked-name').textContent`);
  out.afterSelect_pickedPrice = await evalJs(`document.querySelector('#wz-picked-price').textContent`);
  out.afterSelect_next1Enabled = await evalJs(`!document.querySelector('#wz-next-1').disabled`);

  // deselect by clicking the picked card
  await evalJs(`document.querySelector('#wz-picked-card').click()`);
  await sleep(400);
  out.afterCardDeselect_gridVisible = await evalJs(`!document.querySelector('#wizard-sectors').hidden`);
  out.afterCardDeselect_pickedHidden = await pickedHidden();
  out.afterCardDeselect_next1Disabled = await next1Disabled();

  // re-select, then deselect via the X button
  await evalJs(`document.querySelector('.wz-sector:not(.soldout)').click()`);
  await sleep(400);
  await evalJs(`document.querySelector('.wz-picked-x').click()`);
  await sleep(400);
  out.afterXDeselect_gridVisible = await evalJs(`!document.querySelector('#wizard-sectors').hidden`);
  out.afterXDeselect_next1Disabled = await next1Disabled();

  // select and continue to step 2
  await evalJs(`document.querySelector('.wz-sector:not(.soldout)').click()`);
  await sleep(300);
  await evalJs(`document.querySelector('#wz-next-1').click()`);
  await sleep(400);
  out.step2Visible = await evalJs(`!document.querySelector('#step-2').hidden`);
  out.step2SelectedName = await evalJs(`document.querySelector('#wizard-selected h3').textContent`);

  out.errors = errors;
  console.log(JSON.stringify(out, null, 2));
  ws.close(); chrome.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error('ERR', e); chrome.kill(); process.exit(1); });
