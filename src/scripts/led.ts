// LED dot-matrix text. Any string (CJK included) is rasterised to a grid of dots, like a rack status display.
// <span class="led" data-led="text" data-led-rows="18" data-led-speed="16" data-led-font="latin">fallback text</span>
type Led = {
  el: HTMLElement; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  text: string; rows: number; speed: number; latin: boolean;
  bits: Uint8Array; cols: number; gap: number; pitch: number; width: number; height: number;
  offset: number; lit: number; visible: boolean; on: string; off: string;
};
const motion = document.documentElement.classList.contains('js-motion');
const leds: Led[] = [];

function fontFor(led: Led, size: number) {
  return led.latin ? `700 ${size}px "Host Grotesk", sans-serif` : `700 ${size}px "Noto Sans TC", sans-serif`;
}

function rasterise(led: Led) {
  const scratch = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  scratch.font = fontFor(led, 100);
  const probe = scratch.measureText(led.text);
  // Scale so the actual ink of the string fills exactly `rows` dots.
  const size = 100 * led.rows / (probe.actualBoundingBoxAscent + probe.actualBoundingBoxDescent);
  scratch.font = fontFor(led, size);
  const metrics = scratch.measureText(led.text);
  const cols = Math.max(1, Math.ceil(metrics.width));
  scratch.canvas.width = cols; scratch.canvas.height = led.rows;
  scratch.font = fontFor(led, size);
  scratch.fillStyle = '#fff';
  scratch.fillText(led.text, 0, metrics.actualBoundingBoxAscent);
  const data = scratch.getImageData(0, 0, cols, led.rows).data;
  led.bits = new Uint8Array(cols * led.rows);
  for (let i = 0; i < led.bits.length; i++) led.bits[i] = data[i * 4 + 3] > 110 ? 1 : 0;
  led.cols = cols;
}

function layout(led: Led) {
  const style = getComputedStyle(led.el);
  led.on = style.color;
  led.off = style.getPropertyValue('--led-off').trim() || 'rgba(255,255,255,.07)';
  // Static labels shrink to fit their box; marquees fill the height.
  led.pitch = led.speed ? led.el.clientHeight / led.rows : Math.min(led.el.clientHeight / led.rows, led.el.clientWidth / led.cols);
  led.height = led.rows * led.pitch;
  led.width = led.speed ? led.el.clientWidth : led.cols * led.pitch;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  led.canvas.width = Math.round(led.width * dpr); led.canvas.height = Math.round(led.height * dpr);
  led.canvas.style.width = `${led.width}px`;
  led.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw(led: Led) {
  const { ctx, pitch, rows, cols, bits } = led;
  const visible = Math.ceil(led.width / pitch);
  const period = cols + led.gap;
  const radius = pitch * .34;
  const lit = new Path2D(), dark = new Path2D();
  for (let c = 0; c < visible; c++) {
    const source = led.speed ? (Math.floor(led.offset) + c) % period : c;
    const x = c * pitch + pitch / 2;
    for (let y = 0; y < rows; y++) {
      const on = source < cols && c < led.lit && bits[y * cols + source];
      const path = on ? lit : dark;
      path.moveTo(x + radius, y * pitch + pitch / 2);
      path.arc(x, y * pitch + pitch / 2, radius, 0, Math.PI * 2);
    }
  }
  ctx.clearRect(0, 0, led.width, led.height);
  ctx.shadowBlur = 0; ctx.fillStyle = led.off; ctx.fill(dark);
  ctx.shadowBlur = pitch * 1.6; ctx.shadowColor = led.on; ctx.fillStyle = led.on; ctx.fill(lit);
}

let last = performance.now(), running = false;
function frame(now: number) {
  const dt = Math.min(64, now - last); last = now;
  let busy = false;
  for (const led of leds) {
    if (!led.visible) continue;
    const before = Math.floor(led.offset), litBefore = led.lit;
    if (led.speed) { led.offset += led.speed * dt / 1000; busy = true; }
    if (led.lit < led.cols) { led.lit = Math.min(led.cols, led.lit + led.cols * dt / 700); busy = true; }
    // Real LED signs step whole columns, so only redraw when a column changes.
    if (Math.floor(led.offset) !== before || Math.floor(led.lit) !== Math.floor(litBefore)) draw(led);
  }
  running = busy;
  if (busy) requestAnimationFrame(frame);
}
const wake = () => { if (!running && motion) { running = true; last = performance.now(); requestAnimationFrame(frame); } };

const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const led = leds.find(item => item.el === entry.target);
    if (led) { led.visible = entry.isIntersecting; if (led.visible) wake(); }
  }
});

async function init(el: HTMLElement) {
  const led = {
    el, text: el.dataset.led || el.textContent || '', rows: Number(el.dataset.ledRows || 16),
    speed: motion ? Number(el.dataset.ledSpeed || 0) : 0, latin: el.dataset.ledFont === 'latin',
    offset: 0, visible: false, gap: 0,
  } as Led;
  await document.fonts.load(fontFor(led, 16), led.text).catch(() => {});
  led.canvas = document.createElement('canvas');
  led.canvas.setAttribute('aria-hidden', 'true');
  led.ctx = led.canvas.getContext('2d')!;
  // Keep the words for assistive tech; the dots are decoration.
  const label = document.createElement('span');
  label.className = 'visually-hidden';
  label.textContent = led.text;
  el.replaceChildren(label, led.canvas);
  el.classList.add('is-lit');
  rasterise(led);
  led.lit = motion && !led.speed ? 0 : Infinity;
  layout(led);
  draw(led);
  leds.push(led);
  observer.observe(el);
  new ResizeObserver(() => { layout(led); draw(led); }).observe(el);
}

document.querySelectorAll<HTMLElement>('[data-led]').forEach(init);
