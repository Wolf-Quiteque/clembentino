document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  const SECTORS = [
    { id: 'frente-central', moeventoId: '85c2f16e-bebe-417d-b88c-13a84250c0c9', checkoutName: 'Pink White - Assento Frente Central', name: 'Frente Central', price: 35000, available: 11, total: 38, color: 'pw', img: 'assets/seat-front-center.jpg' },
    { id: 'frente-lateral-esquerda', moeventoId: '72d0d515-7d96-4f11-910e-8f5cac06b392', checkoutName: 'Pink Black - Assento Frente Lateral Esquerdo', name: 'Frente Lateral Esquerda', price: 30000, available: 20, total: 40, color: 'pb', img: 'assets/seat-front-left.jpg' },
    { id: 'frente-lateral-direita', moeventoId: '6276ac46-7d2c-488b-9359-1b7a41c1b059', checkoutName: 'Pink Black - Assento Frente Lateral Direito', name: 'Frente Lateral Direita', price: 30000, available: 20, total: 40, color: 'pb', img: 'assets/seat-front-right.jpg' },
    { id: 'centro-1', moeventoId: 'fe7ea10e-28c6-443a-af9a-74835df4e632', checkoutName: 'Pink White- Assento Centro 1', name: 'Centro 1', price: 20000, available: 55, total: 55, color: 'pw', img: 'assets/seat-center-1.jpg' },
    { id: 'traseira-lateral-direita-1', moeventoId: 'dae9b0ba-1d05-4eff-93a7-fde8334fa51e', checkoutName: 'Pink Black - Assento Traseiro Lateral Direito 1', name: 'Traseira Lateral Direita 1', price: 20000, available: 40, total: 91, color: 'pb', img: 'assets/seat-back-right-1.jpg', note: '5 primeiras filas da frente' },
    { id: 'traseira-lateral-esquerda-1', moeventoId: 'ce2c861e-d89c-4311-82da-6ea3aa14712b', checkoutName: 'Pink Black - Assento Traseiro Lateral esquerdo 1', name: 'Traseira Lateral Esquerda 1', price: 20000, available: 40, total: 91, color: 'pb', img: 'assets/seat-back-left-1.jpg', note: '5 primeiras filas da frente' },
    { id: 'centro-traseiro-2', moeventoId: 'c5104047-3b51-48b8-9e70-25af34130d92', checkoutName: 'Pink White - Assento Centro traseiro', name: 'Centro Traseiro', price: 15000, available: 56, total: 56, color: 'pw', img: 'assets/seat-center-back-2.jpg' },
    { id: 'traseira-lateral-direita-3', moeventoId: '8be6bf65-1e16-4e4a-8d3c-941fcd27d648', checkoutName: 'Pink White - Assento Traseiro Lateral Direito 3', name: 'Traseira Lateral Direita 3', price: 10000, available: 15, total: 15, color: 'pw', img: 'assets/seat-back-right-soldout.jpg', note: 'Parte dos 30 lugares disponíveis nas zonas laterais traseiras' },
    { id: 'traseira-lateral-esquerda-3', moeventoId: '64397bcd-52e7-4c8b-84d1-5136c9a5ca27', checkoutName: 'Pink White - Assento Traseiro Lateral Esquerdo 3', name: 'Traseira Lateral Esquerda 3', price: 10000, available: 15, total: 15, color: 'pw', img: 'assets/seat-back-left-3.jpg' },
    { id: 'centro-traseiro-1', moeventoId: '1cda3b62-5a4a-442d-b28a-8e0dbb40db85', checkoutName: 'Pink Black - Assento Centro Traseiro 1', name: 'Centro Traseiro 1', price: 7500, available: 26, total: 51, color: 'pb', img: 'assets/seat-center-back-1.jpg' },
    { id: 'centro-lateral-direita', name: 'Centro Lateral Direito', price: 0, available: 0, total: 32, color: 'pb', img: 'assets/seat-back-right-soldout.jpg', soldout: true },
    { id: 'centro-lateral-esquerda', name: 'Centro Lateral Esquerdo', price: 0, available: 0, total: 32, color: 'pb', img: 'assets/seat-back-left-1.jpg', soldout: true },
    { id: 'traseira-frente', name: 'Traseira Frente', price: 0, available: 0, total: 12, color: 'pb', img: 'assets/seat-back-front-soldout.jpg', soldout: true },
  ];

  const MOEVENTO_EVENT_API = 'https://api.moevento.com/v1/events/aprenda-e-empreenda-com-elas/subdomain';

  const fmt = n => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const state = { sector: null, qty: 1, step: 1 };

  const sectorsEl = document.querySelector('#wizard-sectors');
  const pickedEl = document.querySelector('#wizard-picked');
  const pickedCard = document.querySelector('#wz-picked-card');
  const pickedImg = document.querySelector('#wz-picked-img');
  const pickedName = document.querySelector('#wz-picked-name');
  const pickedPrice = document.querySelector('#wz-picked-price');
  const next1 = document.querySelector('#wz-next-1');
  const next2 = document.querySelector('#wz-next-2');
  const back2 = document.querySelector('#wz-back-2');
  const back3 = document.querySelector('#wz-back-3');
  const confirmBtn = document.querySelector('#wz-confirm');
  const qtyMinus = document.querySelector('#wz-minus');
  const qtyPlus = document.querySelector('#wz-plus');
  const qtyVal = document.querySelector('#wz-qty');
  const qtyLabel = document.querySelector('#wz-qty-label');
  const availEl = document.querySelector('#wz-avail');
  const subtotalEl = document.querySelector('#wz-subtotal');
  const selectedEl = document.querySelector('#wizard-selected');
  const summaryEl = document.querySelector('#wizard-summary');
  const statusEl = document.querySelector('#wz-status');
  const nomeInput = document.querySelector('#tk-nome');
  const telInput = document.querySelector('#tk-telefone');
  const dialog = document.querySelector('#tk-dialog');
  const checkoutEl = document.querySelector('#moevento-checkout');
  const checkoutImg = document.querySelector('#moevento-selected-img');
  const checkoutName = document.querySelector('#moevento-selected-name');
  const checkoutPrice = document.querySelector('#moevento-selected-price');
  const checkoutTicketName = document.querySelector('#moevento-ticket-name');
  const changeSectorBtn = document.querySelector('#moevento-change-sector');

  const sector = () => SECTORS.find(s => s.id === state.sector);
  const swatch = c => c === 'pb' ? '<i class="s-pink"></i><i class="s-black"></i>' : '<i class="s-pink"></i><i class="s-white"></i>';
  const pop = el => { if (!el) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); };
  const retrigger = el => { el.classList.remove('is-active'); void el.offsetWidth; el.classList.add('is-active'); };

  function renderSectors() {
    sectorsEl.innerHTML = SECTORS.map(s => {
      const soldout = s.available <= 0;
      return `<button type="button" class="wz-sector${soldout ? ' soldout' : ''}" data-id="${s.id}"${soldout ? ' disabled' : ''} aria-pressed="false">
        <span class="wz-sector-media">
          <img src="${s.img}" alt="Mapa de assentos — ${s.name}" loading="lazy">
          <span class="tk-swatch">${swatch(s.color)}</span>
          ${soldout ? '<span class="wz-soldout-tag">Esgotado</span>' : ''}
        </span>
        <span class="wz-sector-body">
          <span class="wz-sector-name">${s.name}</span>
          <span class="wz-sector-meta">
            <span class="wz-sector-price">${soldout ? '—' : fmt(s.price) + ' Kz'}</span>
            <span class="wz-sector-avail">${soldout ? 'Esgotado' : s.available + ' disponíveis'}</span>
          </span>
          ${s.note ? `<span class="wz-sector-note">${s.note}</span>` : ''}
        </span>
        <span class="wz-check"><i data-lucide="check"></i></span>
      </button>`;
    }).join('');
    if (window.lucide) lucide.createIcons();
  }

  function renderPicked() {
    const s = sector();
    pickedImg.src = s.img;
    pickedImg.alt = 'Mapa de assentos — ' + s.name;
    pickedName.textContent = s.name;
    pickedPrice.textContent = fmt(s.price) + ' Kz / lugar';
  }

  function selectSector(id) {
    state.sector = id;
    renderPicked();
    sectorsEl.hidden = true;
    pickedEl.hidden = false;
    retrigger(pickedEl);
    next1.disabled = false;
  }

  function showCheckout() {
    const s = sector();
    checkoutImg.src = s.img;
    checkoutImg.alt = 'Vista do sector — ' + s.name;
    checkoutName.textContent = s.name;
    checkoutPrice.textContent = fmt(s.price) + ' Kz / lugar';
    checkoutTicketName.textContent = s.checkoutName || s.name;
    checkoutEl.hidden = false;
    retrigger(checkoutEl);
    window.setTimeout(() => checkoutEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }

  async function syncSectorsWithMoevento() {
    try {
      const response = await fetch(MOEVENTO_EVENT_API, { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const event = await response.json();
      const liveTickets = new Map((event.subscription_types || []).map(ticket => [ticket.id, ticket]));

      SECTORS.filter(s => s.moeventoId).forEach(s => {
        const liveTicket = liveTickets.get(s.moeventoId);
        if (!liveTicket || liveTicket.sold_out || !liveTicket.enabled || liveTicket.registrations_blocked) {
          s.available = 0;
          s.soldout = true;
          return;
        }
        s.price = Number(liveTicket.price);
        s.checkoutName = liveTicket.name;
        s.soldout = false;
      });

      renderSectors();
    } catch {
      // Keep the verified local seat information if Moevento is temporarily unavailable.
    }
  }

  function deselect() {
    state.sector = null;
    document.querySelectorAll('.wz-sector').forEach(b => { b.classList.remove('selected'); b.setAttribute('aria-pressed', 'false'); });
    pickedEl.hidden = true;
    sectorsEl.hidden = false;
    retrigger(sectorsEl);
    next1.disabled = true;
    checkoutEl.hidden = true;
  }

  function showGrid() {
    pickedEl.hidden = true;
    sectorsEl.hidden = false;
    retrigger(sectorsEl);
  }

  function showStep(n) {
    state.step = n;
    document.querySelectorAll('.wizard-step').forEach(s => {
      const active = Number(s.dataset.step) === n;
      s.hidden = !active;
      if (active) { s.classList.remove('is-active'); void s.offsetWidth; s.classList.add('is-active'); }
      else s.classList.remove('is-active');
    });
    document.querySelectorAll('.wizard-progress li').forEach(li => {
      const st = Number(li.dataset.step);
      li.classList.toggle('active', st === n);
      li.classList.toggle('done', st < n);
    });
    document.querySelector('#wizard-fill').style.width = (((n - 1) / 2) * 100) + '%';
    document.querySelector('#wizard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderSelected() {
    const s = sector();
    selectedEl.innerHTML = `
      <div class="wz-sel-media"><img src="${s.img}" alt="Mapa de assentos — ${s.name}"></div>
      <div class="wz-sel-body">
        <span class="wz-sel-label">Sector seleccionado</span>
        <h3>${s.name}</h3>
        <span class="wz-sel-price">${fmt(s.price)} Kz <em>/ lugar</em></span>
      </div>`;
  }

  function renderQty() {
    const s = sector();
    qtyVal.textContent = state.qty;
    qtyLabel.textContent = state.qty === 1 ? 'lugar' : 'lugares';
    availEl.textContent = `${s.available} disponíveis neste sector`;
    subtotalEl.textContent = fmt(s.price * state.qty) + ' Kz';
    qtyMinus.disabled = state.qty <= 1;
    qtyPlus.disabled = state.qty >= s.available;
  }

  function renderSummary() {
    const s = sector();
    summaryEl.innerHTML = `
      <div class="wz-sum-row"><span>Sector</span><strong>${s.name}</strong></div>
      <div class="wz-sum-row"><span>Lugares</span><strong>${state.qty}</strong></div>
      <div class="wz-sum-row"><span>Preço / lugar</span><strong>${fmt(s.price)} Kz</strong></div>
      <div class="wz-sum-row wz-sum-total"><span>Total</span><strong>${fmt(s.price * state.qty)} Kz</strong></div>
      <div class="wz-sum-row"><span>Nome</span><strong>${nomeInput.value.trim()}</strong></div>
      <div class="wz-sum-row"><span>Telefone</span><strong>${telInput.value.trim()}</strong></div>`;
  }

  // Step 1 — select a sector (collapse on pick)
  sectorsEl.addEventListener('click', e => {
    const btn = e.target.closest('.wz-sector');
    if (!btn || btn.disabled) return;
    document.querySelectorAll('.wz-sector').forEach(b => {
      b.classList.toggle('selected', b === btn);
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
    selectSector(btn.dataset.id);
    showCheckout();
  });

  // Deselect via the X / clicking the picked card again
  pickedCard.addEventListener('click', deselect);
  pickedCard.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); deselect(); }
  });

  changeSectorBtn.addEventListener('click', () => {
    deselect();
    document.querySelector('#wizard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  next1.addEventListener('click', () => {
    if (!state.sector) return;
    state.qty = 1;
    renderSelected();
    renderQty();
    statusEl.textContent = '';
    showStep(2);
  });

  // Step 2 — quantity + data
  qtyMinus.addEventListener('click', () => { if (state.qty > 1) { state.qty--; renderQty(); pop(qtyVal); pop(subtotalEl); } });
  qtyPlus.addEventListener('click', () => { if (state.qty < sector().available) { state.qty++; renderQty(); pop(qtyVal); pop(subtotalEl); } });

  [nomeInput, telInput].forEach(inp => inp.addEventListener('input', () => { inp.closest('.field').classList.remove('invalid'); statusEl.textContent = ''; }));

  back2.addEventListener('click', () => { showGrid(); showStep(1); });

  next2.addEventListener('click', () => {
    let valid = true;
    [nomeInput, telInput].forEach(inp => {
      const ok = inp.value.trim().length > 0;
      inp.closest('.field').classList.toggle('invalid', !ok);
      if (!ok) valid = false;
    });
    if (!valid) { statusEl.textContent = 'Preencha o nome e o telefone para continuar.'; statusEl.style.color = '#c84235'; return; }
    statusEl.textContent = '';
    renderSummary();
    showStep(3);
  });

  back3.addEventListener('click', () => showStep(2));

  // Step 3 — confirm
  confirmBtn.addEventListener('click', () => {
    const s = sector();
    const ref = 'CLEM-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    document.querySelector('#tk-dialog-summary').innerHTML =
      `<div class="ds-row"><span>${s.name} × ${state.qty}</span><strong>${fmt(s.price * state.qty)} Kz</strong></div>` +
      `<div class="ds-row ds-total"><span>Total (${state.qty} ${state.qty === 1 ? 'lugar' : 'lugares'})</span><strong>${fmt(s.price * state.qty)} Kz</strong></div>`;
    document.querySelector('#tk-ref').textContent = ref;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  });

  document.querySelector('#tk-whatsapp').addEventListener('click', () => {
    const s = sector();
    const msg = `Olá Clembetino! Pretendo reservar bilhetes para a conferência Aprenda & Empreenda com Elas (23 Out, 08h00).\n\n• ${s.name} — ${state.qty} × ${fmt(s.price)} Kz\n\nTotal: ${fmt(s.price * state.qty)} Kz\nNome: ${nomeInput.value.trim()}\nTelefone: ${telInput.value.trim()}`;
    window.open(`https://wa.me/244942218877?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  });

  const closeDialog = () => { if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); };
  dialog.querySelector('.tk-dialog-close').addEventListener('click', closeDialog);
  document.querySelector('#tk-done').addEventListener('click', closeDialog);
  dialog.addEventListener('click', e => { if (e.target === dialog) closeDialog(); });

  renderSectors();
  syncSectorsWithMoevento();
});
