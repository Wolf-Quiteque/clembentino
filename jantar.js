(() => {
  const icons = () => window.lucide && lucide.createIcons();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const form = document.querySelector('#rsvp');
  const status = form.querySelector('.status');
  const nameInput = form.querySelector('#nome'), telInput = form.querySelector('#tel');
  icons();

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
      if (!res.ok) throw new Error(data.error || 'Ocorreu um erro. Tente novamente.');
      const local = phone.slice(-9);
      document.querySelector('#view').innerHTML = `
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
          <a class="btn btn-ghost btn-block" style="margin-top:18px" href="/">Voltar ao site</a>
        </div>`;
      icons();
      window.scrollTo({ top: document.querySelector('#view').offsetTop - 20, behavior: 'smooth' });
    } catch (err) {
      status.textContent = err.message;
      btn.disabled = false; btn.innerHTML = 'Reservar o meu lugar <i data-lucide="utensils"></i>'; icons();
    }
  });
})();
