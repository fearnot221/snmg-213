// Hero: the NCU campus backbone, after the computer center's public topology diagram, drawn in ink.
// Upstream ISPs → IPS → core routers CC1/CC2 → building networks; 工程二館 (the 電機、通訊 network) extends down to our room, E1-213.
// Line weight encodes link speed; packets run between client devices, the ISPs and E1-213.
type Kind = 'isp' | 'ips' | 'core' | 'segment' | 'site' | 'device';
type Point = { x: number; y: number; bx: number; by: number; phase: number; kind: Kind; label?: string; pulse: number };
type Link = { a: Point; b: Point; speed: number };
type Packet = { path: Point[]; legs: number[]; leg: number; t: number; bright: boolean };

const canvas = document.querySelector<HTMLCanvasElement>('.net');
if (canvas) {
  const ctx = canvas.getContext('2d')!;
  const still = !document.documentElement.classList.contains('js-motion');
  const nodes: [string, Kind][] = [
    ['HINET', 'isp'], ['台聯大', 'isp'], ['TWAREN', 'isp'], ['TANet', 'isp'], ['IPS', 'ips'], ['CC1', 'core'], ['CC2', 'core'],
    ['伺服器', 'segment'], ['教學網', 'segment'], ['工程二館（電機、通訊）', 'segment'], ['管理學院', 'segment'], ['資工、網學', 'segment'], ['學生宿網', 'segment'], ['教職員宿網', 'segment'],
    ['E1-213', 'site'],
  ];
  // Positions as fractions of the canvas, kept clear of the headline (lower left) and intro text (lower right).
  const wide: Record<string, [number, number]> = {
    HINET: [.3, .135], 台聯大: [.45, .12], TWAREN: [.6, .12], TANet: [.75, .135], IPS: [.45, .21], CC1: [.36, .29], CC2: [.68, .29],
    伺服器: [.13, .35], 教學網: [.24, .385], '工程二館（電機、通訊）': [.55, .385], 管理學院: [.72, .385], '資工、網學': [.81, .385], 學生宿網: [.9, .36], 教職員宿網: [.92, .25],
    'E1-213': [.6, .47],
  };
  // On phones the topology gets its own band under the header (see .hero in global.css); y is a fraction of that band.
  const tall: Record<string, [number, number]> = {
    HINET: [.14, .1], 台聯大: [.38, .05], TWAREN: [.62, .05], TANet: [.86, .1], IPS: [.5, .25], CC1: [.26, .42], CC2: [.74, .42],
    教學網: [.12, .6], '工程二館（電機、通訊）': [.4, .6], 管理學院: [.74, .7], 學生宿網: [.83, .54],
    'E1-213': [.48, .86],
  };
  // Link speeds in Gbps, as published: 10G uplinks (台聯大 1.2G), 100G between the cores and to 工程二館 (電機、通訊), 1G elsewhere.
  const links: [string, string, number][] = [
    ['HINET', 'IPS', 10], ['台聯大', 'IPS', 1.2], ['TWAREN', 'IPS', 10], ['TANet', 'IPS', 10], ['TANet', 'CC2', 10], ['IPS', 'CC1', 10],
    ['CC1', 'CC2', 100], ['CC1', '工程二館（電機、通訊）', 100], ['CC2', '工程二館（電機、通訊）', 100],
    ...['伺服器', '教學網', '管理學院', '資工、網學', '學生宿網'].flatMap(name => [['CC1', name, 1], ['CC2', name, 1]] as [string, string, number][]),
    ['CC2', '教職員宿網', 1], ['工程二館（電機、通訊）', 'E1-213', 1],
  ];
  const isps = ['HINET', '台聯大', 'TWAREN', 'TANet'];

  let width = 0, height = 0, points: Point[] = [], named = new Map<string, Point>(), edges: Link[] = [], packets: Packet[] = [];
  let seed = 213;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const make = (x: number, y: number, kind: Kind, label?: string): Point => { const p = { x, y, bx: x, by: y, phase: random() * 6.28, kind, label, pulse: 0 }; points.push(p); return p; };
  const neighbours = (p: Point) => edges.filter(edge => edge.a === p || edge.b === p);

  function build() {
    const rect = canvas!.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    width = rect.width; height = rect.height;
    canvas!.width = width * dpr; canvas!.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed = 213; points = []; named = new Map(); edges = []; packets = [];
    // Up to 1100px the hero is single-column and reserves a band under the header (see .hero in global.css).
    const narrow = width <= 600, banded = width <= 1100;
    const layout = narrow ? tall : wide;
    const top = banded ? (width <= 900 ? 64 : 76) + 28 : 0, band = banded ? innerHeight * (narrow ? .4 : .42) : height;
    // The wide layout spans .1–.52 of a full-height hero; stretch that span over the band.
    const fy = (y: number) => narrow || !banded ? y : (y - .1) / .42;
    for (const [label, kind] of nodes) if (layout[label]) named.set(label, make(layout[label][0] * width, top + fy(layout[label][1]) * band, kind, label));
    for (const [a, b, speed] of links) if (named.has(a) && named.has(b)) edges.push({ a: named.get(a)!, b: named.get(b)!, speed });
    // Client devices hang below each building network, like the workstations in the original diagram.
    const perSegment = narrow ? 3 : 6;
    for (const segment of points.filter(p => p.kind === 'segment' && p.label !== '工程二館（電機、通訊）')) {
      for (let i = 0; i < perSegment; i++) {
        const spread = narrow ? 16 : 26;
        const device = make(segment.bx + (i - (perSegment - 1) / 2) * spread + (random() - .5) * 10, segment.by + (narrow ? 18 : 36) + random() * (narrow ? 12 : 26), 'device');
        edges.push({ a: segment, b: device, speed: 0 });
      }
    }
  }

  function route(from: Point, to: Point) {
    const previous = new Map<Point, Point | null>([[from, null]]);
    const queue = [from];
    while (queue.length) {
      const current = queue.shift()!;
      if (current === to) break;
      for (const edge of neighbours(current)) {
        const next = edge.a === current ? edge.b : edge.a;
        if (next.kind === 'device' && next !== to) continue;
        if (!previous.has(next)) { previous.set(next, current); queue.push(next); }
      }
    }
    const path: Point[] = [];
    for (let at: Point | null | undefined = to; at; at = previous.get(at)) path.unshift(at);
    return path[0] === from ? path : [];
  }

  function spawn() {
    const devices = points.filter(p => p.kind === 'device');
    const start = devices[Math.floor(Math.random() * devices.length)];
    // About a third of the traffic is headed for E1-213's own services; the rest leaves campus.
    const toSite = Math.random() < .32;
    const target = toSite ? named.get('E1-213')! : named.get(isps[Math.floor(Math.random() * isps.length)])!;
    const path = route(start, target);
    if (path.length < 2) return;
    if (!toSite && Math.random() < .45) path.reverse();
    const legs = path.slice(1).map((p, i) => edges.find(edge => (edge.a === p && edge.b === path[i]) || (edge.b === p && edge.a === path[i]))?.speed ?? 1);
    packets.push({ path, legs, leg: 0, t: 0, bright: toSite });
  }

  // Faster links carry visibly faster packets.
  const pace = (speed: number) => speed >= 100 ? 2.6 : speed >= 10 ? 1.7 : speed > 1 ? 1.2 : 1;

  let last = performance.now(), sinceSpawn = 0, running = false, visible = true;
  function frame(now: number) {
    const dt = Math.min(48, now - last); last = now;
    sinceSpawn += dt;
    if (sinceSpawn > (width <= 600 ? 240 : 120)) { sinceSpawn = 0; spawn(); }
    for (const p of points) {
      const drift = p.kind === 'device' ? 4 : 1.5;
      const x = p.bx + Math.sin(now * .00035 + p.phase) * drift, y = p.by + Math.cos(now * .0003 + p.phase) * drift;
      p.x += (x - p.x) * .12; p.y += (y - p.y) * .12;
      p.pulse = Math.max(0, p.pulse - dt / 900);
    }
    draw(dt);
    if (running) requestAnimationFrame(frame);
  }

  function stroke(edge: Link) {
    ctx.setLineDash(edge.speed > 1 && edge.speed < 10 ? [4, 4] : []);
    ctx.lineWidth = edge.speed >= 100 ? 2.4 : edge.speed >= 10 ? 1.3 : edge.speed > 1 ? 1.1 : edge.speed === 1 ? .8 : .6;
    ctx.strokeStyle = `rgba(255,255,255,${edge.speed >= 100 ? .85 : edge.speed >= 10 ? .5 : edge.speed > 1 ? .45 : edge.speed === 1 ? .2 : .1})`;
    ctx.beginPath(); ctx.moveTo(edge.a.x, edge.a.y); ctx.lineTo(edge.b.x, edge.b.y); ctx.stroke();
  }

  function draw(dt: number) {
    ctx.clearRect(0, 0, width, height);
    edges.forEach(stroke);
    ctx.setLineDash([]);
    packets = packets.filter(packet => {
      let a = packet.path[packet.leg], b = packet.path[packet.leg + 1];
      packet.t += 130 * pace(packet.legs[packet.leg]) * dt / 1000 / Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      while (packet.t >= 1) {
        packet.t -= 1; packet.leg++;
        if (b.kind !== 'device') b.pulse = 1;
        if (packet.leg >= packet.path.length - 1) return false;
        a = packet.path[packet.leg]; b = packet.path[packet.leg + 1];
      }
      const x = a.x + (b.x - a.x) * packet.t, y = a.y + (b.y - a.y) * packet.t;
      const tail = Math.max(0, packet.t - .2);
      const colour = packet.bright ? '#ffffff' : 'rgba(255,255,255,.55)';
      const gradient = ctx.createLinearGradient(a.x + (b.x - a.x) * tail, a.y + (b.y - a.y) * tail, x, y);
      gradient.addColorStop(0, 'rgba(255,255,255,0)'); gradient.addColorStop(1, colour);
      ctx.strokeStyle = gradient; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(a.x + (b.x - a.x) * tail, a.y + (b.y - a.y) * tail); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(x, y, packet.bright ? 2 : 1.5, 0, 6.28); ctx.fill();
      return true;
    });
    ctx.font = '500 11px "IBM Plex Mono", "Noto Sans TC", monospace';
    ctx.textBaseline = 'middle';
    for (const p of points) {
      if (p.pulse > 0 && p.kind !== 'isp') { ctx.strokeStyle = `rgba(255,255,255,${p.pulse * .7})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, 5 + (1 - p.pulse) * 20, 0, 6.28); ctx.stroke(); }
      ctx.lineWidth = 1.2; ctx.strokeStyle = '#f6f6f3'; ctx.fillStyle = '#0b0b0b';
      if (p.kind === 'device') { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); continue; }
      if (p.kind === 'isp') {
        // Upstream networks: a boxed label, the clouds of the original diagram.
        const w = ctx.measureText(p.label!).width + 16;
        ctx.fillRect(p.x - w / 2, p.y - 11, w, 22); ctx.strokeStyle = `rgba(255,255,255,${.45 + p.pulse * .55})`; ctx.strokeRect(p.x - w / 2, p.y - 11, w, 22);
        ctx.fillStyle = 'rgba(246,246,243,.8)'; ctx.textAlign = 'center'; ctx.fillText(p.label!, p.x, p.y + 1); ctx.textAlign = 'left';
        continue;
      }
      if (p.kind === 'ips') { ctx.fillRect(p.x - 12, p.y - 4, 24, 8); ctx.strokeRect(p.x - 12, p.y - 4, 24, 8); ctx.fillStyle = 'rgba(246,246,243,.6)'; ctx.fillText('IPS', p.x + 18, p.y); continue; }
      if (p.kind === 'core') {
        ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, 6.28); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 6.28); ctx.fillStyle = '#f6f6f3'; ctx.fill();
        ctx.fillStyle = 'rgba(246,246,243,.85)'; ctx.fillText(p.label!, p.x + 14, p.y); continue;
      }
      if (p.kind === 'site') {
        // Our room: solid, with a slow beacon.
        const beacon = still ? .5 : (performance.now() % 2400) / 2400;
        ctx.strokeStyle = `rgba(255,255,255,${1 - beacon})`; ctx.beginPath(); ctx.arc(p.x, p.y, 6 + beacon * 16, 0, 6.28); ctx.stroke();
        ctx.fillStyle = '#f6f6f3'; ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
        ctx.font = '600 12px "IBM Plex Mono", "Noto Sans TC", monospace'; ctx.fillText('E1-213  SNMG', p.x + 14, p.y);
        ctx.font = '500 11px "IBM Plex Mono", "Noto Sans TC", monospace'; continue;
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.28); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(246,246,243,.6)'; ctx.fillText(p.label!, p.x + 10, p.y);
    }
  }

  const start = () => { if (!running && visible && !still) { running = true; last = performance.now(); requestAnimationFrame(frame); } };
  const stop = () => { running = false; };
  build();
  if (still) { for (let i = 0; i < 24; i++) spawn(); packets.forEach(packet => { packet.t = Math.random(); }); draw(0); }
  new ResizeObserver(() => { build(); if (still) draw(0); }).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visible ? start() : stop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
}
