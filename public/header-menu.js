(() => {
  const menu = document.getElementById('headerMenu');
  const toggle = document.getElementById('menuToggle');
  const panel = document.getElementById('headerMenuPanel');

  if (!menu || !toggle || !panel) return;

  function setOpen(open) {
    menu.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    panel.setAttribute('aria-hidden', String(!open));
  }

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(!menu.classList.contains('open'));
  });

  panel.addEventListener('click', (event) => {
    if (event.target.closest('a, button')) setOpen(false);
  });

  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target)) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !menu.classList.contains('open')) return;
    setOpen(false);
    toggle.focus();
  });
})();