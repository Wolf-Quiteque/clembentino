document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  const header = document.querySelector('.site-header');
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav-links');
  const navLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];

  const closeMenu = () => {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Abrir menu');
    document.body.classList.remove('menu-open');
  };

  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    menuButton.setAttribute('aria-label', open ? 'Abrir menu' : 'Fechar menu');
    nav.classList.toggle('open', !open);
    document.body.classList.toggle('menu-open', !open);
  });
  navLinks.forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('open')) {
      closeMenu();
      menuButton.focus();
    }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 960 && nav.classList.contains('open')) closeMenu();
  });

  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 30);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  const sections = [...document.querySelectorAll('main section[id]')];
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-35% 0px -55%', threshold: 0 });
  sections.forEach(section => sectionObserver.observe(section));

  let counted = false;
  const stats = document.querySelector('.stats');
  const countObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting || counted) return;
    counted = true;
    document.querySelectorAll('[data-count]').forEach(counter => {
      const target = Number(counter.dataset.count);
      const start = performance.now();
      const duration = 1300;
      const step = now => {
        const progress = Math.min((now - start) / duration, 1);
        counter.textContent = Math.round(target * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: .35 });
  countObserver.observe(stats);

  const filters = document.querySelectorAll('.filters button');
  const projects = document.querySelectorAll('.project');
  filters.forEach(button => button.addEventListener('click', () => {
    filters.forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    const filter = button.dataset.filter;
    projects.forEach(project => {
      const matches = filter === 'todos' || project.dataset.category.split(' ').includes(filter);
      project.classList.toggle('hidden', !matches);
    });
  }));

  const form = document.querySelector('#contact-form');
  const formStatus = form.querySelector('.form-status');
  form.addEventListener('submit', event => {
    event.preventDefault();
    let valid = true;
    form.querySelectorAll('[required]').forEach(field => {
      const invalid = !field.value.trim() || (field.type === 'email' && !/^\S+@\S+\.\S+$/.test(field.value));
      field.closest('.field').classList.toggle('invalid', invalid);
      if (invalid) valid = false;
    });
    if (!valid) {
      formStatus.textContent = 'Por favor, confirme os campos assinalados.';
      formStatus.style.color = '#c84235';
      form.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(0)' }], { duration: 280 });
      return;
    }
    const name = form.nome.value.trim();
    const company = form.empresa.value.trim();
    const message = form.mensagem.value.trim();
    const whatsappText = `Olá Clembetino! Sou ${name}${company ? `, da ${company}` : ''}. ${message}`;
    formStatus.textContent = 'Mensagem pronta — a abrir o WhatsApp… ✓';
    formStatus.style.color = '#288056';
    setTimeout(() => window.open(`https://wa.me/244942218877?text=${encodeURIComponent(whatsappText)}`, '_blank', 'noopener'), 450);
  });
  form.querySelectorAll('input, textarea').forEach(field => field.addEventListener('input', () => field.closest('.field').classList.remove('invalid')));

  const cookieBanner = document.querySelector('.cookie-banner');
  if (localStorage.getItem('clembetino-cookie-choice')) cookieBanner.classList.add('hidden');
  document.querySelector('#cookie-accept').addEventListener('click', () => {
    localStorage.setItem('clembetino-cookie-choice', 'essential');
    cookieBanner.classList.add('hidden');
  });
});
