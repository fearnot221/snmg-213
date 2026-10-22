// Site-wide motion on GSAP: boot, split headings, reveals, pinned services, scrubbed text, magnetic buttons.
// Menus, header, nav dot and the footer status panel work without motion.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);
// Finish on wall-clock time even when frames are throttled, so revealed content never lingers half-hidden.
gsap.ticker.lagSmoothing(0);
const root = document.documentElement;
root.dataset.motion = 'ready';
const motion = root.classList.contains('js-motion');
const EASE = 'expo.out';

/* Menus */
const menus = [...document.querySelectorAll<HTMLDetailsElement>('.mobile-menu,.resource-menu')];
const closeMenus = () => menus.forEach(menu => { menu.open = false; });
menus.forEach(menu => {
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenus));
  menu.addEventListener('toggle', () => { if (menu.open) menus.filter(other => other !== menu).forEach(other => other.open = false); });
});
document.addEventListener('pointerdown', event => { if (!menus.some(menu => menu.contains(event.target as Node))) closeMenus(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { const open = menus.find(menu => menu.open); closeMenus(); open?.querySelector('summary')?.focus(); } });

/* Header: solid once scrolled, tucks away while reading downward. */
const header = document.querySelector<HTMLElement>('.site-header')!;
let lastY = scrollY;
addEventListener('scroll', () => {
  const y = scrollY;
  header.classList.toggle('is-scrolled', y > 24);
  if (motion && y > 480 && y > lastY + 2 && !menus.some(menu => menu.open)) header.classList.add('is-hidden');
  if (y < lastY - 2 || y < 480) header.classList.remove('is-hidden');
  lastY = y;
}, { passive: true });
header.classList.toggle('is-scrolled', scrollY > 24);

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

/* Footer status panel: Taipei time and whether it is office hours (Mon–Fri 08:00–17:00). */
const clock = document.querySelector<HTMLElement>('[data-clock]');
const office = document.querySelector<HTMLElement>('[data-office]');
function tick() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  if (clock) clock.textContent = `${parts.hour}:${parts.minute}`;
  if (office) {
    const minutes = Number(parts.hour) * 60 + Number(parts.minute);
    const open = !['Sat', 'Sun'].includes(parts.weekday) && minutes >= 480 && minutes < 1020;
    office.dataset.office = open ? 'open' : 'closed';
    office.textContent = open ? '辦公時間中' : '目前非辦公時間';
  }
}
tick();
setInterval(tick, 20000);

if (motion) {
  const intro = gsap.timeline({ paused: true });

  /* One entrance per page: the opening headline's characters rise inside line masks. */
  const headlineDelay = root.classList.contains('booting') ? 1.7 : .25;
  gsap.utils.toArray<HTMLElement>('.hero h1,.page-intro h1').forEach(heading => {
    let done = false;
    SplitText.create(heading, {
      type: 'lines,chars', mask: 'lines', autoSplit: true,
      onSplit(self) {
        gsap.set(heading, { visibility: 'visible' });
        // A re-split after the reveal (resize, late font) keeps the final state.
        if (done) return;
        return gsap.from(self.chars, { yPercent: 118, rotate: 5, duration: 1.4, ease: EASE, stagger: .03, delay: headlineDelay, onComplete: () => { done = true; } });
      },
    });
  });

  /* Hero entrance after the boot curtain. */
  if (document.querySelector('.hero-side')) intro.fromTo('.hero-side', { autoAlpha: 0, y: 32 }, { autoAlpha: 1, y: 0, duration: 1.3, ease: EASE }, .45);
  if (document.querySelector('.net')) intro.from('.net', { autoAlpha: 0, scale: 1.08, duration: 2.6, ease: 'power2.out' }, 0);
  if (document.querySelector('.ticker')) intro.from('.ticker', { yPercent: 100, autoAlpha: 0, duration: 1.3, ease: EASE }, .6);
  intro.from('.header-inner', { yPercent: -100, autoAlpha: 0, duration: 1.1, ease: EASE }, .2);

  if (root.classList.contains('booting')) {
    const boot = gsap.timeline({ onComplete: () => root.classList.remove('booting') })
      .from('.boot-lines p', { autoAlpha: 0, duration: .01, stagger: .26 })
      .from('.boot-mark i', { autoAlpha: 0, duration: .01, stagger: .1 }, 0)
      .add(() => { intro.play(); }, '+=.35')
      .to('.boot', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '<');
    // A throttled background tab slows GSAP's clock; never hold the page behind the curtain.
    setTimeout(() => boot.progress(1), 3200);
  } else intro.play();

  /* The team paragraph lights up character by character as it is read. */
  gsap.utils.toArray<HTMLElement>('[data-scrub]').forEach(text => {
    const split = SplitText.create(text, { type: 'chars' });
    gsap.fromTo(split.chars, { opacity: .16 }, { opacity: 1, ease: 'none', stagger: .05, scrollTrigger: { trigger: text, start: 'top 80%', end: 'bottom 55%', scrub: .6 } });
  });


  /* Slow parallax on reading-page photos. */
  gsap.utils.toArray<HTMLElement>('.contact-box img,.statement-photo img').forEach(image => {
    gsap.fromTo(image, { yPercent: -5, scale: 1.1 }, { yPercent: 5, scale: 1.1, ease: 'none', scrollTrigger: { trigger: image.parentElement, scrub: true } });
  });

  /* Team strip: a steady marquee that rests under the pointer or keyboard focus. */
  const teamTrack = document.querySelector<HTMLElement>('.team-track');
  if (teamTrack) {
    const loop = gsap.to(teamTrack, { xPercent: -50, duration: 70, ease: 'none', repeat: -1 });
    const strip = teamTrack.parentElement!;
    strip.addEventListener('pointerenter', () => gsap.to(loop, { timeScale: 0, duration: .8, overwrite: true }));
    strip.addEventListener('pointerleave', () => gsap.to(loop, { timeScale: 1, duration: .8, overwrite: true }));
    strip.addEventListener('focusin', () => loop.timeScale(0));
  }

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
