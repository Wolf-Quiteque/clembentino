(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icons = () => window.lucide && lucide.createIcons();
  const KEY = 'clembetino-scanner';
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} },
    clear() { try { localStorage.removeItem(KEY); } catch {} },
  };
  let session = store.get();
  let stream = null, detector = null, busy = false, paused = false, lastCode = '', lastAt = 0, autoTimer = null;
  const video = $('#video'), canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });

  async function api(body) {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(session?.token ? { Authorization: 'Bearer ' + session.token } : {}) },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && body.action !== 'login') { logout(); throw new Error(data.error); }
    if (!res.ok) throw new Error(data.error || 'Sem ligação. Tente novamente.');
    return data;
  }

  const setStats = s => { if (s) { $('#sc-inside').textContent = s.inside; $('#sc-total').textContent = s.total; } };
  const msg = t => { $('#sc-msg').textContent = t; };

  // ---------- Login ----------
  function showLogin() { stopCamera(); $('#scan-view').hidden = true; $('#login-view').hidden = false; icons(); }
  function logout() { session = null; store.clear(); showLogin(); }

  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const status = $('#login-form .status'), btn = $('#login-form button');
    status.textContent = ''; btn.disabled = true;
    try {
      const r = await api({ action: 'login', username: $('#user').value, password: $('#pass').value });
      session = { token: r.token, name: r.name }; store.set(session);
      $('#pass').value = '';
      startScanner(r.stats);
    } catch (err) { status.textContent = err.message; }
    finally { btn.disabled = false; }
  });
  $('#sc-logout').addEventListener('click', () => { if (confirm('Sair do leitor?')) logout(); });

  // ---------- Camera ----------
  async function loadJsQR() {
    if (window.jsQR) return;
    await new Promise((resolve, reject) => {
      const s = Object.assign(document.createElement('script'), { src: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js', onload: resolve, onerror: reject });
      document.head.append(s);
    });
  }

  async function startCamera() {
    if (stream) return;
    if (!navigator.mediaDevices?.getUserMedia) { msg('Este navegador não permite usar a câmara. Escreva o código abaixo.'); return; }
    try {
      if ('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('qr_code')) detector = new BarcodeDetector({ formats: ['qr_code'] });
      else await loadJsQR();
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      video.srcObject = stream; await video.play();
      msg('Aponte a câmara para o QR code do bilhete');
      requestAnimationFrame(loop);
    } catch (err) {
      msg(err?.name === 'NotAllowedError' ? 'Permita o acesso à câmara nas definições do navegador e recarregue a página.' : 'Não foi possível abrir a câmara. Escreva o código abaixo.');
    }
  }
  function stopCamera() { stream?.getTracks().forEach(t => t.stop()); stream = null; }

  let lastScan = 0;
  async function loop(t) {
    if (!stream) return;
    requestAnimationFrame(loop);
    if (paused || busy || t - lastScan < 160 || video.readyState < 2) return;
    lastScan = t; busy = true;
    try {
      let value = null;
      if (detector) {
        const codes = await detector.detect(video);
        value = codes[0]?.rawValue || null;
      } else if (window.jsQR) {
        const w = 640, h = Math.round((video.videoHeight / video.videoWidth) * w) || 480;
        canvas.width = w; canvas.height = h; ctx.drawImage(video, 0, 0, w, h);
        value = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data || null;
      }
      if (value) await check(value);
    } catch {}
    busy = false;
  }

  // ---------- Check ----------
  const recentOk = new Map(); // tickets this device just confirmed → time
  const codeOf = raw => (String(raw).toUpperCase().match(/AE-[A-Z0-9]{4}-[A-Z0-9]{4}/) || [])[0];

  async function check(raw, manual = false) {
    const now = Date.now();
    if (raw === lastCode && now - lastAt < 4000) return; // ignore the same QR still in front of the camera
    const code = codeOf(raw);
    if (!manual && code && now - (recentOk.get(code) || 0) < 60000) {
      // Same guest still holding up the ticket we just confirmed: don't flag it as "already used".
      lastCode = raw; lastAt = now;
      msg(`${code} já confirmado — pode passar ✓`);
      return;
    }
    lastCode = raw; lastAt = now; paused = true;
    msg('A verificar…');
    try {
      const r = await api({ code: raw }); setStats(r.stats);
      if (r.result === 'ok' && r.guest) recentOk.set(r.guest.code, Date.now());
      showResult(r);
    }
    catch (err) { showResult({ result: 'invalid', message: err.message }); }
  }

  $('#manual').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#manual-code').value.trim(); if (!v) return;
    lastCode = ''; check(v, true); $('#manual-code').value = ''; $('#manual-code').blur();
  });

  // ---------- Result ----------
  const time = d => new Date(d).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  function feedback(ok) {
    try { navigator.vibrate?.(ok ? 120 : [80, 60, 80, 60, 220]); } catch {}
    try {
      const ac = feedback.ac ||= new (window.AudioContext || window.webkitAudioContext)();
      const tones = ok ? [[880, 0], [1320, .12]] : [[220, 0], [180, .18]];
      tones.forEach(([f, at]) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = f; o.type = ok ? 'sine' : 'square'; o.connect(g); g.connect(ac.destination);
        g.gain.setValueAtTime(.18, ac.currentTime + at); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + at + .16);
        o.start(ac.currentTime + at); o.stop(ac.currentTime + at + .17);
      });
    } catch {}
  }

  function showResult(r) {
    const conf = {
      ok: ['check', 'Entrada confirmada', 'O convidado está na lista. Bem-vindo(a)!'],
      used: ['alert-triangle', 'Já entrou', r.message],
      blocked: ['x', 'Acesso negado', r.message],
      invalid: ['x', 'Bilhete inválido', r.message],
    }[r.result] || ['x', 'Erro', r.message];
    const el = $('#result');
    el.className = 'sc-result ' + r.result;
    $('#res-icon').innerHTML = `<i data-lucide="${conf[0]}"></i>`;
    $('#res-title').textContent = conf[1];
    $('#res-msg').textContent = conf[2] || '';
    const g = r.guest;
    $('#res-guest').innerHTML = !g ? '' : `
      <p class="label">Convidado(a)</p>
      <p class="g-name">${esc(g.name)}</p>
      <p class="g-sub">${esc(g.code)} · ${esc(g.phone)}${g.invitedBy ? ` · Convite de ${esc(g.invitedBy)}` : ''}</p>
      <div class="seat">${g.seat.img ? `<img src="/${esc(g.seat.img)}" alt="">` : ''}
        <div><p class="label">Sector</p><span class="seat-name">${esc(g.seat.name)}</span>
        <span class="swatch"><i class="p"></i><i class="${g.seat.color === 'pb' ? 'k' : 'w'}"></i><span>${g.seat.color === 'pb' ? 'Pink Black' : 'Pink White'}</span></span></div></div>
      ${r.result === 'used' && g.checkedInAt ? `<p class="g-note">Entrada registada às ${time(g.checkedInAt)}${g.checkedInBy ? ` por ${esc(g.checkedInBy)}` : ''}.</p>` : ''}`;
    el.hidden = false; icons();
    feedback(r.result === 'ok');

    clearInterval(autoTimer);
    if (r.result === 'ok') {
      let left = 5;
      $('#res-auto').textContent = `A continuar em ${left}s…`;
      autoTimer = setInterval(() => { left--; if (left <= 0) closeResult(); else $('#res-auto').textContent = `A continuar em ${left}s…`; }, 1000);
    } else $('#res-auto').textContent = '';
  }

  function closeResult() {
    clearInterval(autoTimer);
    $('#result').hidden = true;
    lastAt = Date.now(); // short grace period so the same ticket isn't re-read instantly
    paused = false;
    msg('Aponte a câmara para o QR code do bilhete');
  }
  $('#res-next').addEventListener('click', closeResult);

  // ---------- Start ----------
  function startScanner(stats) {
    $('#login-view').hidden = true; $('#scan-view').hidden = false;
    $('#sc-name').textContent = session.name; setStats(stats); icons();
    startCamera();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCamera();
    else if (session && !$('#scan-view').hidden) startCamera();
  });

  if (session?.token) api({ action: 'stats' }).then(r => { session.name = r.name; startScanner(r.stats); }).catch(() => showLogin());
  else showLogin();
})();
