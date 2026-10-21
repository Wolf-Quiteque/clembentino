(() => {
  const icons = () => window.lucide && lucide.createIcons();
  const WA_ICON = document.querySelector('#pay-wa .wa-icon')?.outerHTML || '';
  const payLink = name => {
    const text = `Olá! Reservei lugar para o Jantar Pós-Conferência Aprenda & Empreenda com Elas${name ? ` em nome de ${name}` : ''} e gostaria de efectuar o pagamento de 30.000 Kz.`;
    return `<a class="pay-wa" href="https://wa.me/244942218877?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${WA_ICON}<span>Para efectuar o pagamento, entre em contacto com <b>942 218 877</b> no WhatsApp</span><i data-lucide="arrow-up-right"></i></a>`;
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const form = document.querySelector('#rsvp');
  const status = form.querySelector('.status');
  const nameInput = form.querySelector('#nome'), telInput = form.querySelector('#tel');
  icons();

  const view = document.querySelector('#view');
  function showFull() {
    view.innerHTML = `<div class="card-body state" style="padding-top:34px">
      <i data-lucide="calendar-x"></i><h2>Reservas esgotadas</h2>
      <p>Já não há lugares disponíveis para o jantar. Para mais informações, contacte <a href="tel:+244942218877" style="white-space:nowrap">942 218 877</a>.</p>
      <a class="btn btn-ghost btn-block" style="margin-top:18px" href="/">Voltar ao site</a></div>`;
    icons();
  }
  fetch('/api/jantar').then(r => r.json()).then(d => {
    if (d.full) return showFull();
    if (d.left <= 30) { const el = document.querySelector('#seats-left'); el.textContent = d.left === 1 ? 'Resta apenas 1 lugar!' : `Restam apenas ${d.left} lugares!`; el.hidden = false; }
  }).catch(() => {});

  form.addEventListener('input', e => { e.target.closest('.field')?.classList.remove('invalid'); status.textContent = ''; });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const phone = telInput.value.replace(/\D/g, '');
    const phoneOk = /^(244)?9\d{8}$/.test(phone);
    nameInput.closest('.field').classList.toggle('invalid', name.length < 2);
    telInput.closest('.field').classList.toggle('invalid', !phoneOk);
    if (name.length < 2 || !phoneOk) { status.textContent = 'Indique o nome completo e um número válido (9 dígitos).'; return; }

    const btn = form.querySelector('button');
    btn.disabled = true; btn.textContent = 'A reservar…';
    try {
      const res = await fetch('/api/jantar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone, website: form.website.value }) });
      const data = await res.json().catch(() => ({}));
      if (data.full) return showFull();
      if (!res.ok) throw new Error(data.error || 'Ocorreu um erro. Tente novamente.');
      const local = phone.slice(-9);
      view.innerHTML = `
        <div class="card-body state" style="padding-top:34px">
          <i data-lucide="${data.existing ? 'info' : 'party-popper'}"></i>
          <h2>${data.existing ? 'Já tem lugar reservado' : 'Lugar reservado!'}</h2>
          <p>${data.existing
            ? `O número +244 ${esc(local.slice(0, 3))} ${esc(local.slice(3, 6))} ${esc(local.slice(6))} já tem uma reserva para o jantar.`
            : `Obrigado, ${esc(name.split(' ')[0])}! Enviámos um SMS para +244 ${esc(local.slice(0, 3))} ${esc(local.slice(3, 6))} ${esc(local.slice(6))} com os detalhes.`}</p>
          <div class="dinner-facts" style="margin:22px 0 0;text-align:left">
            <div><i data-lucide="calendar-days"></i><span><small>Data</small><strong>Sexta, 23 Out</strong></span></div>
            <div><i data-lucide="clock-3"></i><span><small>Hora</small><strong>19h00</strong></span></div>
            <div class="wide"><i data-lucide="map-pin"></i><span><small>Local</small><strong>Pés n'Areia Beach Restaurant</strong></span></div>
            <div class="wide price"><i data-lucide="ticket"></i><span><small>Valor por pessoa</small><strong>30.000 Kz</strong></span></div>
          </div>
          ${payLink(name)}
          <a class="btn btn-ghost btn-block" style="margin-top:6px" href="/">Voltar ao site</a>
        </div>`;
      icons();
      window.scrollTo({ top: view.offsetTop - 20, behavior: 'smooth' });
    } catch (err) {
      status.textContent = err.message;
      btn.disabled = false; btn.innerHTML = 'Reservar o meu lugar <i data-lucide="utensils"></i>'; icons();
    }
  });
})();
