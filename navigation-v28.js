/* Єдина компактна навігація для всіх сторінок порталу. */
(() => {
  const header = document.querySelector('header');
  if (!header || header.querySelector('.header-quick-actions')) return;

  const actions = document.createElement('div');
  actions.className = 'header-quick-actions';
  actions.setAttribute('aria-label', 'Швидка навігація');
  actions.innerHTML = `
    <button class="header-icon-button" type="button" data-portal-back aria-label="Повернутися назад" title="Назад">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6M9 12h11"/></svg>
    </button>
    <a class="header-icon-button header-home-button" href="index.html" aria-label="Перейти на головну" title="На головну">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5L12 4l9 7.5M5.5 10.5V20h13v-9.5M9.5 20v-6h5v6"/></svg>
    </a>`;
  header.insertBefore(actions, header.firstChild);
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  if (currentFile === 'index.html') actions.querySelector('.header-home-button')?.classList.add('is-current');

  actions.querySelector('[data-portal-back]')?.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = 'index.html';
  });

  const icons = {
    'index.html':'⌂',
    'history.html':'⌛',
    'geography.html':'◎',
    'nmt.html':'✓',
    'methodology.html':'✦'
  };
  header.querySelectorAll('nav a').forEach(link => {
    const file = (link.getAttribute('href') || '').split('/').pop();
    if (file === 'index.html') link.closest('li')?.classList.add('portal-nav-home-item');
    link.classList.add('portal-nav-link');
    if (!link.querySelector('.portal-nav-icon')) {
      const icon = document.createElement('span');
      icon.className = 'portal-nav-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = icons[file] || '•';
      link.prepend(icon);
    }
  });
})();
