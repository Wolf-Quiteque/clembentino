(() => {
  const view = document.querySelector('#view');
  const params = new URLSearchParams(location.search);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icons = () => window.lucide && lucide.createIcons();
  const initials = n => n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const swatch = c => `<span class="swatch"><i class="p"></i><i class="${c === 'pb' ? 'k' : 'w'}"></i><span>${c === 'pb' ? 'Pink Black' : 'Pink White'}</span></span>`;

  async function api(url, opts) {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Ocorreu um erro. Tente novamente.'), { status: res.status });
    return data;
  }

  function stateView(icon, title, text) {
    view.innerHTML = `<div class="state"><i data-lucide="${icon}"></i><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;
    icons();
  }

  const seatBlock = seat => `
    <div class="seat">
      <img src="/${esc(seat.img)}" alt="Vista do sector ${esc(seat.name)}">
      <div><p class="label">O seu sector</p><span class="seat-name">${esc(seat.name)}</span>${swatch(seat.color)}</div>
    </div>`;

  function poolBlock(pool, total) {
    const items = pool.map(p => `
      <li><span class="avatar">${esc(initials(p.name))}</span>
        <div><strong>${esc(p.name)}</strong><small>${esc(p.phone)}</small></div>
        ${p.isPrimary ? '<span class="badge">Anfitriã(o)</span>' : ''}</li>`).join('');
    return `
      <div class="pool">
        <div class="pool-head"><p class="label">Neste convite</p><small>${pool.length} de ${total} ${total === 1 ? 'lugar' : 'lugares'}</small></div>
        <ul>${items || '<li class="empty">Ainda ninguém reservou — seja a primeira pessoa!</li>'}</ul>
      </div>`;
  }

  // ---------- Registration ----------
  async function showInvite(query) {
    let inv;
    try { inv = await api('/api/invite?' + query); }
    catch (e) { return stateView('link-2-off', 'Convite indisponível', e.message); }

    const total = inv.maxShares + 1;
    if (inv.closed) {
      view.innerHTML = `<div class="card-body">
        <div class="state" style="padding:10px 0 20px"><i data-lucide="ticket-x"></i><h2>Convite fechado</h2><p>${esc(inv.closed)}</p></div>
        ${poolBlock(inv.pool, total)}
        <p class="fine">Já reservou? Abra o link que recebeu por SMS para ver o seu bilhete.</p></div>`;
      return icons();
    }

    const intro = inv.kind === 'share' && inv.invitedBy
      ? `<strong>${esc(inv.invitedBy)}</strong> convidou-o(a) para a conferência. Reserve o seu lugar gratuito.`
      : 'Foi convidado(a) para a conferência. Reserve o seu lugar gratuito em segundos.';

    view.innerHTML = `<div class="card-body">
      <p class="label">${inv.label ? esc(inv.label) : 'Tem um convite'}</p>
      <h2>Reserve o seu lugar</h2>
      <p class="lead">${intro}</p>
      ${seatBlock(inv.seat)}
      ${inv.kind === 'share' || inv.pool.length ? poolBlock(inv.pool, total) : ''}
      <form id="rsvp" novalidate>
        <div class="field"><label for="nome">Nome completo</label>
          <input id="nome" name="name" autocomplete="name" placeholder="Ex.: Maria Fernandes" required></div>
        <div class="field"><label for="tel">Telefone</label>
          <div class="phone"><span>+244</span><input id="tel" name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="923 456 789" required></div></div>
        <button class="btn btn-pink btn-block" type="submit">Confirmar o meu lugar <i data-lucide="ticket-check"></i></button>
        <p class="status" role="status"></p>
        <p class="fine">Vai receber um SMS com os detalhes e o seu bilhete com QR code.</p>
      </form></div>`;
    icons();

    const form = view.querySelector('#rsvp');
    const status = form.querySelector('.status');
    form.addEventListener('input', e => { e.target.closest('.field')?.classList.remove('invalid'); status.textContent = ''; });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const nameInput = form.querySelector('#nome'), telInput = form.querySelector('#tel');
      const name = nameInput.value.trim();
      const phone = telInput.value.replace(/\D/g, '');
      const phoneOk = /^(244)?9\d{8}$/.test(phone);
      nameInput.closest('.field').classList.toggle('invalid', name.length < 2);
      telInput.closest('.field').classList.toggle('invalid', !phoneOk);
      if (name.length < 2 || !phoneOk) { status.textContent = 'Indique o nome completo e um número válido (9 dígitos).'; return; }

      const btn = form.querySelector('button');
      btn.disabled = true; btn.innerHTML = 'A reservar…';
      try {
        const body = { name, phone, ...Object.fromEntries(new URLSearchParams(query)) };
        const r = await api('/api/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        history.replaceState(null, '', `/convite?t=${encodeURIComponent(r.ticketCode)}${r.existing ? '' : '&novo=1'}`);
        showTicket(r.ticketCode, !r.existing, r.existing);
      } catch (err) {
        status.textContent = err.message;
        btn.disabled = false; btn.innerHTML = 'Confirmar o meu lugar <i data-lucide="ticket-check"></i>'; icons();
      }
    });
  }

  // ---------- Ticket ----------
  async function showTicket(code, isNew, existing) {
    let d;
    try { d = await api('/api/ticket?t=' + encodeURIComponent(code)); }
    catch (e) { return stateView('ticket-x', 'Bilhete não encontrado', e.message); }
    const t = d.ticket;
    const pdf = `/api/ticket?t=${encodeURIComponent(t.code)}&format=pdf`;
    const total = d.share ? d.share.max + 1 : d.pool.length;

    const notice = isNew
      ? `<div class="confirmed"><i data-lucide="circle-check"></i><div><strong>Lugar reservado!</strong> Enviámos um SMS com os detalhes. Guarde o seu bilhete abaixo.</div></div>`
      : existing ? `<div class="confirmed"><i data-lucide="info"></i><div>Este número já tinha um lugar reservado neste convite. Aqui está o seu bilhete.</div></div>` : '';

    const shareText = d.share && `Tenho um convite para a conferência Aprenda & Empreenda com Elas (23 de Outubro, 08h00, Palácio da Justiça). Reserve o seu lugar gratuito aqui: ${d.share.url}`;
    const share = !d.share ? '' : `
      <div class="share-box section">
        <h3>Convide quem quiser</h3>
        <p>${d.share.left > 0 ? `Pode partilhar este convite com mais <strong>${d.share.left} ${d.share.left === 1 ? 'pessoa' : 'pessoas'}</strong>.` : 'Todos os lugares do seu convite já foram preenchidos.'}</p>
        ${d.share.left > 0 ? `
        <div class="copy-row"><input readonly value="${esc(d.share.url)}" aria-label="Link de partilha"><button class="btn btn-pink btn-sm" data-copy="${esc(d.share.url)}"><i data-lucide="copy"></i> Copiar</button></div>
        <div class="share-btns">
          <a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText)}"><i data-lucide="message-circle"></i> WhatsApp</a>
          <button class="btn btn-ghost btn-sm" id="native-share"><i data-lucide="share-2"></i> Partilhar</button>
        </div>` : ''}
      </div>`;

    view.innerHTML = `<div class="card-body ticket">
      ${notice}
      ${t.active ? '' : '<div class="confirmed" style="background:#fdeeee;color:#8a2a20"><i data-lucide="alert-triangle"></i><div>Este convite foi desactivado pela organização.</div></div>'}
      <p class="label">Convidado(a)</p>
      <p class="t-guest">${esc(t.name)}</p>
      <div class="t-info">
        <div><small>Data</small><strong>23 Out 2026</strong></div>
        <div><small>Hora</small><strong>08h00</strong></div>
        <div><small>Local</small><strong>Cidade Alta</strong></div>
      </div>
      ${seatBlock(t.seat)}
      <div class="perf" aria-hidden="true"></div>
      <div class="stub">
        <div class="qr"><img src="/api/ticket?t=${encodeURIComponent(t.code)}&format=qr" alt="QR code do bilhete ${esc(t.code)}"></div>
        <div><p class="label">Código do bilhete</p><span class="code">${esc(t.code)}</span>
          <p>Apresente este QR code à entrada.</p>
          ${t.invitedBy ? `<p class="by">Convite partilhado por ${esc(t.invitedBy)}</p>` : ''}</div>
      </div>
      <div class="actions">
        <a class="btn btn-pink btn-block" href="${pdf}" download><i data-lucide="download"></i> Descarregar bilhete (PDF)</a>
      </div>
      ${share}
      <div class="section">${poolBlock(d.pool, Math.max(total, d.pool.length))}</div>
    </div>`;
    icons();

    view.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); } catch { b.previousElementSibling.select(); document.execCommand('copy'); }
      b.innerHTML = '<i data-lucide="check"></i> Copiado'; icons();
    }));
    const ns = view.querySelector('#native-share');
    if (ns) {
      if (!navigator.share) ns.hidden = true;
      ns.addEventListener('click', () => navigator.share({ title: 'Aprenda & Empreenda com Elas', text: shareText }).catch(() => {}));
    }
  }

  if (params.get('t')) showTicket(params.get('t'), params.get('novo') === '1');
  else if (params.get('c')) showInvite('c=' + encodeURIComponent(params.get('c')));
  else if (params.get('s')) showInvite('s=' + encodeURIComponent(params.get('s')));
  else stateView('link-2-off', 'Link incompleto', 'Abra o link de convite exactamente como o recebeu.');
})();
