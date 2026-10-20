import { SEATS, SEAT_COLORS, seatById } from '/lib/seats.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = () => window.lucide && lucide.createIcons();
const KEY = 'clembetino-admin-key';
let adminKey = (() => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } })();
let invites = [];
let selectedSeat = null;

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method, headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error(data.error || 'Sessão expirada.'); }
  if (!res.ok) throw new Error(data.error || 'Ocorreu um erro.');
  return data;
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text }); document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast('Link copiado');
}

// ---------- Login ----------
function logout() {
  adminKey = ''; try { sessionStorage.removeItem(KEY); } catch {}
  $('#app-view').hidden = true; $('#login-view').hidden = false;
}

$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const status = $('#login-form .status');
  adminKey = $('#pw').value;
  status.textContent = '';
  try {
    await load();
    try { sessionStorage.setItem(KEY, adminKey); } catch {}
    enterApp();
  } catch (err) { status.textContent = err.message; }
});
$('#logout').addEventListener('click', logout);

function enterApp() {
  $('#login-view').hidden = true; $('#app-view').hidden = false; icons();
}

// ---------- Create ----------
function renderSeats() {
  $('#seat-grid').innerHTML = SEATS.map(s => `
    <button type="button" class="seat-opt" data-id="${s.id}" aria-pressed="false">
      <img src="/${s.img}" alt="Vista do sector ${esc(s.name)}" loading="lazy">
      <span class="check"><i data-lucide="check"></i></span>
      <span class="body"><b>${esc(s.name)}</b>
        <span class="swatch"><i class="p"></i><i class="${s.color === 'pb' ? 'k' : 'w'}"></i><span>${SEAT_COLORS[s.color]}</span></span></span>
    </button>`).join('');
  $('#seat-grid').addEventListener('click', e => {
    const b = e.target.closest('.seat-opt'); if (!b) return;
    selectedSeat = b.dataset.id;
    document.querySelectorAll('.seat-opt').forEach(x => { x.classList.toggle('selected', x === b); x.setAttribute('aria-pressed', x === b); });
    $('#create-status').textContent = '';
  });
}

const sharesInput = $('#shares');
const clampShares = () => Math.min(100, Math.max(0, parseInt(sharesInput.value, 10) || 0));
function renderHint() {
  const n = clampShares();
  $('#share-hint').innerHTML = n === 0
    ? 'Convite individual: <strong>apenas o convidado principal</strong> pode reservar (1 lugar).'
    : `O convidado principal pode partilhar com até <strong>${n} ${n === 1 ? 'pessoa' : 'pessoas'}</strong> — total de <strong>${n + 1} lugares</strong>. Todos vêem quem está no convite e recebem o seu próprio bilhete.`;
}
$('#sh-minus').addEventListener('click', () => { sharesInput.value = Math.max(0, clampShares() - 1); renderHint(); });
$('#sh-plus').addEventListener('click', () => { sharesInput.value = Math.min(100, clampShares() + 1); renderHint(); });
sharesInput.addEventListener('input', renderHint);

$('#create').addEventListener('click', async () => {
  const status = $('#create-status');
  if (!selectedSeat) { status.textContent = 'Escolha primeiro o tipo de assento.'; $('#seat-grid').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  const btn = $('#create'); btn.disabled = true; status.textContent = '';
  try {
    const r = await api('POST', '/api/admin/invites', { seatId: selectedSeat, maxShares: clampShares(), label: $('#label').value });
    const seat = seatById(selectedSeat);
    $('#result-url').value = r.url;
    $('#result-wa').href = 'https://wa.me/?text=' + encodeURIComponent(`Tem um convite para a conferência Aprenda & Empreenda com Elas — 23 de Outubro, 08h00, Palácio da Justiça (sector ${seat.name}). Reserve o seu lugar aqui: ${r.url}`);
    $('#result').hidden = false; icons();
    $('#label').value = '';
    await load();
  } catch (err) { status.textContent = err.message; }
  finally { btn.disabled = false; }
});
$('#result-copy').addEventListener('click', () => copy($('#result-url').value));

// ---------- List ----------
async function load() {
  const [data, team] = await Promise.all([api('GET', '/api/admin/invites'), api('GET', '/api/admin/scanners')]);
  invites = data.invites;
  render();
  renderTeam(team.users);
}

// ---------- Scanner team ----------
function renderTeam(users) {
  $('#team-list').innerHTML = !users.length
    ? '<div class="empty-list">Ainda não há ninguém na equipa do leitor.</div>'
    : `<table class="guests team"><thead><tr><th>Nome</th><th>Utilizador</th><th>Leituras</th><th></th></tr></thead><tbody>${users.map(u => `
      <tr class="${u.active ? '' : 'off'}">
        <td><strong>${esc(u.name)}</strong>${u.active ? '' : ' <span class="pill offp">Bloqueado</span>'}</td>
        <td>${esc(u.username)}</td>
        <td>${u.scans} ${u.scans === 1 ? 'entrada' : 'entradas'}</td>
        <td class="row-actions">
          <button class="btn btn-ghost btn-sm" data-pass="${u.id}" data-name="${esc(u.name)}"><i data-lucide="key-round"></i> Palavra-passe</button>
          <button class="btn btn-ghost btn-sm" data-uactive="${u.id}" data-active="${u.active}">${u.active ? 'Bloquear' : 'Desbloquear'}</button>
          <button class="btn btn-danger btn-sm icon-btn" data-udelete="${u.id}" aria-label="Apagar"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`).join('')}</tbody></table>`;
  icons();
}

$('#team-form').addEventListener('submit', async e => {
  e.preventDefault();
  const status = $('#team-status'); status.textContent = '';
  try {
    await api('POST', '/api/admin/scanners', { name: $('#tm-name').value, username: $('#tm-user').value, password: $('#tm-pass').value });
    toast(`Acesso criado para ${$('#tm-name').value.trim()}`);
    $('#team-form').reset();
    await load();
  } catch (err) { status.textContent = err.message; }
});

$('#team-list').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  try {
    if (b.dataset.pass) {
      const pw = prompt(`Nova palavra-passe para ${b.dataset.name} (mínimo 6 caracteres):`);
      if (!pw) return;
      await api('PATCH', '/api/admin/scanners', { id: Number(b.dataset.pass), password: pw });
      toast('Palavra-passe alterada');
    } else if (b.dataset.uactive) {
      await api('PATCH', '/api/admin/scanners', { id: Number(b.dataset.uactive), active: b.dataset.active !== 'true' });
      toast(b.dataset.active === 'true' ? 'Acesso bloqueado' : 'Acesso desbloqueado');
    } else if (b.dataset.udelete) {
      if (!confirm('Apagar este acesso ao leitor?')) return;
      await api('DELETE', '/api/admin/scanners?id=' + b.dataset.udelete);
      toast('Acesso apagado');
    } else return;
    await load();
  } catch (err) { toast(err.message); }
});

function render() {
  const guests = invites.flatMap(i => i.guests);
  $('#st-invites').textContent = invites.length;
  $('#st-guests').textContent = guests.length;
  $('#st-sms').textContent = guests.filter(g => g.smsStatus === 'failed').length;
  $('#st-in').textContent = guests.filter(g => g.checkedInAt).length;

  const q = $('#search').value.trim().toLowerCase();
  const list = invites.filter(i => !q || [i.label, seatById(i.seatId)?.name, ...i.guests.flatMap(g => [g.name, g.phone, g.ticketCode])]
    .some(v => String(v || '').toLowerCase().includes(q)));

  if (!list.length) {
    $('#list').innerHTML = `<div class="empty-list">${invites.length ? 'Nenhum resultado.' : 'Ainda não criou nenhum convite.'}</div>`;
    return;
  }

  $('#list').innerHTML = list.map(i => {
    const seat = seatById(i.seatId) || { name: i.seatId, img: '' };
    const primary = i.guests.find(g => g.isPrimary);
    const used = i.guests.filter(g => !g.isPrimary).length;
    const full = primary && used >= i.maxShares;
    const date = new Date(i.createdAt).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const rows = i.guests.map(g => `
      <tr>
        <td><strong>${esc(g.name)}</strong>${g.isPrimary ? ' <span class="badge">Principal</span>' : ''}</td>
        <td>${esc(g.phone)}</td>
        <td><a href="${esc(g.ticketUrl)}" target="_blank" rel="noopener">${esc(g.ticketCode)}</a>
          ${g.checkedInAt ? `<br><span class="sms-ok" title="${esc(g.checkedInBy || '')}">Entrou às ${new Date(g.checkedInAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>` : ''}</td>
        <td>${g.smsStatus === 'sent' ? '<span class="sms-ok">SMS enviado</span>' : `<span class="sms-bad" title="${esc(g.smsError || '')}">SMS falhou</span>`}
          <button class="btn btn-ghost btn-sm" data-resend="${g.id}" style="margin-left:6px">Reenviar</button></td>
      </tr>`).join('');
    return `
      <article class="invite${i.active ? '' : ' off'}">
        <div class="inv-head">
          ${seat.img ? `<img src="/${seat.img}" alt="">` : ''}
          <div class="meta">
            <b>${esc(i.label || seat.name)}</b>
            <small>${i.label ? esc(seat.name) + ' · ' : ''}Criado ${esc(date)} · ${i.maxShares} ${i.maxShares === 1 ? 'partilha' : 'partilhas'}</small><br>
            <span class="pill ${i.active ? 'on' : 'offp'}">${i.active ? 'Activo' : 'Desactivado'}</span>
            <span class="pill ${full ? 'full' : 'offp'}">${primary ? `${1 + used}/${i.maxShares + 1} lugares` : 'Por usar'}</span>
          </div>
        </div>
        <div class="inv-links">
          <div><label>Link do convidado principal</label>
            <div class="copy-row"><input readonly value="${esc(i.url)}"><button class="btn btn-ghost btn-sm icon-btn" data-copy="${esc(i.url)}" aria-label="Copiar"><i data-lucide="copy"></i></button></div></div>
          ${i.maxShares > 0 ? `<div><label>Link de partilha (activo depois do principal reservar)</label>
            <div class="copy-row"><input readonly value="${esc(i.shareUrl)}"><button class="btn btn-ghost btn-sm icon-btn" data-copy="${esc(i.shareUrl)}" aria-label="Copiar"><i data-lucide="copy"></i></button></div></div>` : ''}
        </div>
        ${rows ? `<table class="guests"><thead><tr><th>Nome</th><th>Telefone</th><th>Bilhete</th><th>SMS</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
        <div class="inv-actions">
          <button class="btn btn-ghost btn-sm" data-toggle="${i.id}" data-active="${i.active}">${i.active ? '<i data-lucide="pause"></i> Desactivar' : '<i data-lucide="play"></i> Activar'}</button>
          <button class="btn btn-danger btn-sm" data-delete="${i.id}"><i data-lucide="trash-2"></i> Apagar</button>
        </div>
      </article>`;
  }).join('');
  icons();
}

$('#search').addEventListener('input', render);
$('#list').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  try {
    if (b.dataset.copy) return copy(b.dataset.copy);
    if (b.dataset.toggle) {
      await api('PATCH', '/api/admin/invites', { id: Number(b.dataset.toggle), active: b.dataset.active !== 'true' });
      toast(b.dataset.active === 'true' ? 'Convite desactivado' : 'Convite activado');
    } else if (b.dataset.delete) {
      if (!confirm('Apagar este convite e todos os bilhetes associados? Esta acção não pode ser desfeita.')) return;
      await api('DELETE', '/api/admin/invites?id=' + b.dataset.delete);
      toast('Convite apagado');
    } else if (b.dataset.resend) {
      b.disabled = true; b.textContent = 'A enviar…';
      await api('POST', '/api/admin/invites', { action: 'resend', guestId: Number(b.dataset.resend) });
      toast('SMS reenviado');
    } else return;
    await load();
  } catch (err) { toast(err.message); await load().catch(() => {}); }
});

renderSeats();
renderHint();
if (adminKey) load().then(enterApp).catch(() => logout());
icons();
