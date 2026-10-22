// Site-wide behaviour: menus, the nav packet, Taipei clock / office-hours lamp, and today's duty highlights.

/* Menus */
const menus = [...document.querySelectorAll<HTMLDetailsElement>('.mobile-menu,.resource-menu')];
const closeMenus = () => menus.forEach(menu => { menu.open = false; });
menus.forEach(menu => {
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenus));
  menu.addEventListener('toggle', () => { if (menu.open) menus.filter(other => other !== menu).forEach(other => other.open = false); });
});
document.addEventListener('pointerdown', event => { if (!menus.some(menu => menu.contains(event.target as Node))) closeMenus(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { const open = menus.find(menu => menu.open); closeMenus(); open?.querySelector('summary')?.focus(); } });

/* Nav packet: glides to the hovered or focused link, returns to the current page. */
const nav = document.querySelector<HTMLElement>('.desktop-nav');
const dot = nav?.querySelector<HTMLElement>('.nav-dot');
if (nav && dot) {
  const current = nav.querySelector<HTMLElement>(':scope > a[aria-current=page]');
  const moveTo = (target: HTMLElement | null) => {
    if (!target) { dot.style.opacity = '0'; return; }
    const rect = target.getBoundingClientRect();
    dot.style.setProperty('--x', `${rect.left - nav.getBoundingClientRect().left + rect.width / 2 - 2.5}px`);
    dot.style.opacity = '1';
  };
  nav.querySelectorAll<HTMLElement>(':scope > a, .resource-menu > summary').forEach(target => {
    target.addEventListener('pointerenter', () => moveTo(target));
    target.addEventListener('focus', () => moveTo(target));
  });
  nav.addEventListener('pointerleave', () => moveTo(current));
  nav.addEventListener('focusout', event => { if (!nav.contains(event.relatedTarget as Node)) moveTo(current); });
  const settle = () => moveTo(current);
  settle();
  document.fonts?.ready.then(settle);
  addEventListener('resize', settle);
  requestAnimationFrame(() => dot.classList.add('is-ready'));
}

/* Taipei time and whether it is office hours (Mon–Fri 08:00–17:00). */
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
function tick() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  document.querySelectorAll<HTMLElement>('[data-clock]').forEach(clock => { clock.textContent = `${parts.hour}:${parts.minute}`; });
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const open = weekdays.includes(parts.weekday) && minutes >= 480 && minutes < 1020;
  document.querySelectorAll<HTMLElement>('[data-office]').forEach(office => {
    office.dataset.office = open ? 'open' : 'closed';
    office.textContent = open ? '辦公時間中' : '非辦公時間';
  });
  // Weekday 1–5 in Taipei, 0 on weekends; pages mark matching [data-day] blocks / columns.
  const day = weekdays.indexOf(parts.weekday) + 1;
  document.querySelectorAll<HTMLElement>('[data-today]').forEach(block => { block.hidden = Number(block.dataset.today) !== day; });
  document.querySelectorAll<HTMLElement>('[data-day-col]').forEach(cell => cell.classList.toggle('is-today', Number(cell.dataset.dayCol) === day));
}
tick();
setInterval(tick, 20000);
