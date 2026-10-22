// The NCU campus backbone, after the computer center's public topology diagram, drawn in ink.
// Upstream ISPs → IPS → core routers CC1/CC2 → building networks; our node, E1-213, is 工程二館 itself (the 電機、通訊 network).
// Line weight encodes link speed; packets run between client devices, the ISPs and E1-213.
// On the home page, clicking E1-213 thirteen times opens /play/ (an easter egg), where the diagram doubles as a territory game.
type Kind = 'isp' | 'ips' | 'core' | 'segment' | 'site' | 'device';
type Owner = 'you' | 'rival';
type Point = { x: number; y: number; bx: number; by: number; phase: number; kind: Kind; label?: string; pulse: number };
type Link = { a: Point; b: Point; speed: number };
type Packet = { path: Point[]; legs: number[]; leg: number; t: number; bright: boolean; owner?: Owner };
type Cell = { owner?: Owner; hp: number };
type Float = { x: number; y: number; text: string; life: number; strong: boolean; colour: string };

const canvas = document.querySelector<HTMLCanvasElement>('.net');
if (canvas) {
  const ctx = canvas.getContext('2d')!;
  const still = !document.documentElement.classList.contains('js-motion');
  const stage = !!canvas.closest('.net-stage');
  const nodes: [string, Kind][] = [
    ['HINET', 'isp'], ['台聯大', 'isp'], ['TWAREN', 'isp'], ['TANet', 'isp'], ['IPS', 'ips'], ['CC1', 'core'], ['CC2', 'core'],
    ['伺服器', 'segment'], ['教學網', 'segment'], ['E1-213', 'site'], ['管理學院', 'segment'], ['資工、網學', 'segment'], ['學生宿網', 'segment'], ['教職員宿網', 'segment'],
  ];
  // Positions as fractions of the box; y spans .12–.385 and is fitted to the box in build().
  const wide: Record<string, [number, number]> = {
    HINET: [.3, .135], 台聯大: [.45, .12], TWAREN: [.6, .12], TANet: [.75, .135], IPS: [.45, .21], CC1: [.36, .29], CC2: [.68, .29],
    伺服器: [.13, .35], 教學網: [.26, .385], 'E1-213': [.52, .385], 管理學院: [.72, .385], '資工、網學': [.83, .385], 學生宿網: [.92, .34], 教職員宿網: [.92, .22],
  };
  // Phones get a reduced, taller layout; y is already a fraction of the box.
  const tall: Record<string, [number, number]> = {
    HINET: [.14, .1], 台聯大: [.38, .05], TWAREN: [.62, .05], TANet: [.86, .1], IPS: [.5, .25], CC1: [.26, .42], CC2: [.74, .42],
    教學網: [.12, .66], 'E1-213': [.42, .7], 管理學院: [.78, .8], 學生宿網: [.8, .6],
  };
  // Link speeds in Gbps, as published: 10G uplinks (台聯大 1.2G), 100G between the cores and to 工程二館 (E1-213), 1G elsewhere.
  const links: [string, string, number][] = [
    ['HINET', 'IPS', 10], ['台聯大', 'IPS', 1.2], ['TWAREN', 'IPS', 10], ['TANet', 'IPS', 10], ['TANet', 'CC2', 10], ['IPS', 'CC1', 10],
    ['CC1', 'CC2', 100], ['CC1', 'E1-213', 100], ['CC2', 'E1-213', 100],
    ...['伺服器', '教學網', '管理學院', '資工、網學', '學生宿網'].flatMap(name => [['CC1', name, 1], ['CC2', name, 1]] as [string, string, number][]),
    ['CC2', '教職員宿網', 1],
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
    const narrow = width <= 600;
    const layout = narrow ? tall : wide;
    // The diagram fills its own box, leaving room below for the devices and, on the phone game stage, the stacked panel.
    const fy = (y: number) => (narrow ? (stage ? .13 + y * .6 : .04 + y * .92) : (stage ? .14 : .1) + (y - .12) / .265 * (stage ? .58 : .66)) * height;
    for (const [label, kind] of nodes) if (layout[label]) named.set(label, make(layout[label][0] * width, fy(layout[label][1]), kind, label));
    for (const [a, b, speed] of links) if (named.has(a) && named.has(b)) edges.push({ a: named.get(a)!, b: named.get(b)!, speed });
    // Client devices hang below each building network, like the workstations in the original diagram.
    const perSegment = narrow ? 3 : 6;
    for (const segment of points.filter(p => p.kind === 'segment')) {
      for (let i = 0; i < perSegment; i++) {
        const spread = narrow ? 16 : 24;
        const device = make(segment.bx + (i - (perSegment - 1) / 2) * spread + (random() - .5) * 10, segment.by + (narrow ? 16 : 24) + random() * (narrow ? 10 : 16), 'device');
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

  /* Territory game.
     Every node has a value (core 3, upstream/IPS 2, building 1) and a shield: neutral nodes need that many packets to take,
     a freshly taken node has 1 shield, and clicking your own node spends bandwidth to add one (max 3). Bandwidth refills
     faster the more value you hold, and the score is the value held when the clock runs out. Cells are kept by label so
     a resize, which rebuilds the points, keeps the board. */
  const ROUND = 60, MAX_ENERGY = 5, MAX_HP = 3;
  // The game is the one place colour is used: blue for you, red for the intruder.
  const COLOUR: Record<Owner, string> = { you: '#4ea1ff', rival: '#ff5a5f' };
  const TINT: Record<Owner, string> = { you: 'rgba(78,161,255,', rival: 'rgba(255,90,95,' };
  const HOMES = ['E1-213', 'HINET'];
  const VALUE: Record<Kind, number> = { core: 3, isp: 2, ips: 2, segment: 1, site: 0, device: 0 };
  const shield = (p: Point) => p.kind === 'segment' ? 1 : 2;
  const cells = new Map<string, Cell>();
  let floats: Float[] = [];
  const game = { on: false, time: 0, energy: 3, rivalClock: 0, selected: '' };
  const hud = {
    play: document.querySelector<HTMLButtonElement>('.net-play'),
    stats: document.querySelector<HTMLElement>('.net-stats'),
    log: document.querySelector<HTMLElement>('.net-log'),
    result: document.querySelector<HTMLElement>('.net-result'),
  };
  const infra = () => points.filter(p => p.kind !== 'device');
  const field = () => infra().filter(p => !HOMES.includes(p.label!));
  const cell = (p: Point) => cells.get(p.label!) ?? { hp: 0 };
  const score = (owner: Owner) => field().reduce((sum, p) => sum + (cell(p).owner === owner ? VALUE[p.kind] : 0), 0);
  const linked = (a: Point, b: Point) => edges.find(edge => edge.speed > 0 && ((edge.a === a && edge.b === b) || (edge.a === b && edge.b === a)));
  const incoming = (owner: Owner, p: Point) => packets.filter(packet => packet.owner === owner && packet.path[packet.path.length - 1] === p).length;
  // A node can be attacked from any linked node its owner already holds; don't send more packets than the shield needs.
  const source = (owner: Owner, target: Point) => infra().find(p => cell(p).owner === owner && linked(p, target));
  const attackable = (owner: Owner) => field().filter(p => cell(p).owner !== owner && incoming(owner, p) < cell(p).hp && source(owner, p));
  const reinforceable = (owner: Owner) => field().filter(p => cell(p).owner === owner && cell(p).hp < MAX_HP);
  const choices = () => [...attackable('you'), ...reinforceable('you')].sort((a, b) => a.x - b.x);
  const threatened = (p: Point) => cell(p).owner === 'you' && incoming('rival', p) > 0;

  const say = (text: string) => { if (hud.log) hud.log.textContent = text; };
  const float = (p: Point, text: string, owner: Owner, strong = false) => floats.push({ x: p.x, y: p.y - 18, text, life: 1, strong, colour: COLOUR[owner] });

  function act(owner: Owner, target: Point) {
    const mine = cell(target).owner === owner;
    if (owner === 'you') { if (game.energy < 1) { say('頻寬不足，等它回充。佔領越多分數，回充越快。'); return; } game.energy -= 1; }
    if (mine) {
      // Reinforce on the spot: one more packet needed to take it.
      cells.set(target.label!, { owner, hp: Math.min(MAX_HP, cell(target).hp + 1) });
      target.pulse = 1;
      if (owner === 'you') float(target, '+1 防護', 'you');
      return;
    }
    const from = source(owner, target)!;
    packets.push({ path: [from, target], legs: [linked(from, target)!.speed], leg: 0, t: 0, bright: true, owner });
  }

  function land(owner: Owner, target: Point) {
    const current = cell(target), label = target.label!;
    target.pulse = 1;
    if (current.owner === owner) { cells.set(label, { owner, hp: Math.min(MAX_HP, current.hp + 1) }); return; }
    const hp = current.hp - 1;
    if (hp > 0) { cells.set(label, { ...current, hp }); float(target, `防護 ${hp}`, owner); return; }
    cells.set(label, { owner, hp: 1 });
    const points = VALUE[target.kind];
    if (owner === 'you') { float(target, `+${points}`, 'you', true); say(`佔領 ${label}，+${points} 分。`); }
    else { float(target, current.owner === 'you' ? `失守 −${points}` : `入侵者 +${points}`, 'rival', current.owner === 'you'); say(current.owner === 'you' ? `${label} 被入侵者奪走！` : `入侵者佔領 ${label}。`); }
  }

  function startGame() {
    cells.clear();
    for (const p of field()) cells.set(p.label!, { hp: shield(p) });
    cells.set(HOMES[0], { owner: 'you', hp: Infinity }); cells.set(HOMES[1], { owner: 'rival', hp: Infinity });
    packets = packets.filter(packet => !packet.owner); floats = [];
    Object.assign(game, { on: true, time: 0, energy: 3, rivalClock: 0, selected: '' });
    canvas!.removeAttribute('aria-hidden'); canvas!.tabIndex = 0; canvas!.focus({ preventScroll: true });
    if (hud.play) hud.play.textContent = '重新開始';
    if (hud.result) hud.result.textContent = '';
    say('先沿著 100G 線搶 CC1、CC2：各值 3 分，需要 2 個封包。');
  }

  function endGame() {
    game.on = false; canvas!.style.cursor = '';
    const you = score('you'), rival = score('rival');
    if (hud.result) hud.result.textContent = `${you > rival ? '你守住了校園骨幹' : you < rival ? '入侵者佔了上風' : '平手'}：你 ${you} 分，入侵者 ${rival} 分。`;
    if (hud.play) hud.play.textContent = '再玩一次';
    say('');
  }

  // The intruder defends a threatened, valuable node when it can, otherwise attacks what is worth most per packet.
  function rivalTurn() {
    const danger = reinforceable('rival').filter(p => incoming('you', p) >= cell(p).hp);
    if (danger.length && Math.random() < .6) { act('rival', danger.sort((a, b) => VALUE[b.kind] - VALUE[a.kind])[0]); return; }
    const options = attackable('rival');
    if (!options.length) return;
    const worth = (p: Point) => VALUE[p.kind] / Math.max(1, cell(p).hp) + Math.random() * 1.2;
    act('rival', options.sort((a, b) => worth(b) - worth(a))[0]);
  }

  function stepGame(dt: number) {
    if (!game.on) return;
    const seconds = dt / 1000;
    game.time += seconds;
    game.energy = Math.min(MAX_ENERGY, game.energy + seconds * (.6 + .08 * score('you')));
    game.rivalClock += seconds;
    if (game.rivalClock > 2.3 - Math.min(.7, .05 * score('rival'))) { game.rivalClock = 0; rivalTurn(); }
    const threat = field().find(threatened);
    if (threat && hud.log && !hud.log.textContent?.startsWith('警告')) say(`警告：入侵者正在攻擊 ${threat.label}，點它補強防護。`);
    if (!threat && hud.log?.textContent?.startsWith('警告')) say('');
    if (hud.stats) hud.stats.textContent = `你 ${score('you')} 分 · 入侵者 ${score('rival')} 分 · 頻寬 ${'■'.repeat(Math.floor(game.energy))}${'□'.repeat(MAX_ENERGY - Math.floor(game.energy))} · ${Math.max(0, Math.ceil(ROUND - game.time))}s`;
    const all = field().length;
    if (game.time >= ROUND || field().filter(p => cell(p).owner === 'you').length === all || field().filter(p => cell(p).owner === 'rival').length === all) endGame();
  }

  const nodeAt = (x: number, y: number) => choices().find(p => Math.hypot(p.x - x, p.y - y) < 24);
  const local = (event: PointerEvent) => { const rect = canvas!.getBoundingClientRect(); return [event.clientX - rect.left, event.clientY - rect.top] as const; };
  canvas.addEventListener('pointermove', event => { if (game.on) canvas!.style.cursor = nodeAt(...local(event)) ? 'pointer' : ''; });
  canvas.addEventListener('pointerdown', event => { if (!game.on) return; const target = nodeAt(...local(event)); if (target) act('you', target); });
  // Keyboard: arrows cycle through every node you can attack or reinforce, Enter or Space acts on it.
  canvas.addEventListener('keydown', event => {
    if (!game.on) return;
    const options = choices();
    if (!options.length) return;
    const index = options.findIndex(p => p.label === game.selected);
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') game.selected = options[(index + 1) % options.length].label!;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') game.selected = options[(index - 1 + options.length) % options.length].label!;
    else if ((event.key === 'Enter' || event.key === ' ') && index >= 0) act('you', options[index]);
    else return;
    event.preventDefault();
  });
  canvas.addEventListener('blur', () => { game.selected = ''; });
  /* Easter egg (home page only): thirteen quick clicks on E1-213 open the game. */
  if (canvas.dataset.egg) {
    let taps = 0, lastTap = 0;
    const onSite = (event: PointerEvent) => { const [x, y] = local(event), site = named.get('E1-213'); return !!site && Math.hypot(site.x - x, site.y - y) < 22; };
    canvas.addEventListener('pointermove', event => { canvas!.style.cursor = onSite(event) ? 'pointer' : ''; });
    canvas.addEventListener('pointerdown', event => {
      if (!onSite(event)) return;
      const now = performance.now();
      taps = now - lastTap < 1500 ? taps + 1 : 1; lastTap = now;
      const site = named.get('E1-213')!;
      site.pulse = 1;
      if (taps >= 5) float(site, `${taps} / 13`);
      if (taps >= 13) location.href = canvas!.dataset.egg!;
      else if (still) draw(0);
    });
  }
  if (hud.play) { if (still) hud.play.closest<HTMLElement>('.net-hud')!.hidden = true; else hud.play.addEventListener('click', startGame); }

  let last = performance.now(), sinceSpawn = 0, running = false, visible = true;
  function frame(now: number) {
    const dt = Math.min(48, now - last); last = now;
    sinceSpawn += dt;
    // Background traffic thins out during a game so capture packets stand out.
    if (sinceSpawn > (width <= 600 ? 240 : 120) * (game.on ? 3 : 1)) { sinceSpawn = 0; spawn(); }
    for (const p of points) {
      const drift = p.kind === 'device' ? 4 : game.on ? .4 : 1.5;
      const x = p.bx + Math.sin(now * .00035 + p.phase) * drift, y = p.by + Math.cos(now * .0003 + p.phase) * drift;
      p.x += (x - p.x) * .12; p.y += (y - p.y) * .12;
      p.pulse = Math.max(0, p.pulse - dt / 900);
    }
    stepGame(dt);
    draw(dt);
    if (running) requestAnimationFrame(frame);
  }

  function stroke(edge: Link) {
    ctx.setLineDash(edge.speed > 1 && edge.speed < 10 ? [4, 4] : []);
    ctx.lineWidth = edge.speed >= 100 ? 2.4 : edge.speed >= 10 ? 1.3 : edge.speed > 1 ? 1.1 : edge.speed === 1 ? .8 : .6;
    const alpha = edge.speed >= 100 ? .85 : edge.speed >= 10 ? .5 : edge.speed > 1 ? .45 : edge.speed === 1 ? .2 : .1;
    ctx.strokeStyle = `rgba(255,255,255,${game.on ? alpha * .55 : alpha})`;
    ctx.beginPath(); ctx.moveTo(edge.a.x, edge.a.y); ctx.lineTo(edge.b.x, edge.b.y); ctx.stroke();
  }

  // Territory: your links solid blue, the intruder's dashed red; each contested node shows its value and shield pips.
  function drawTerritory() {
    if (!cells.size) return;
    for (const edge of edges) {
      const owner = edge.speed > 0 && cells.get(edge.a.label!)?.owner;
      if (!owner || cells.get(edge.b.label!)?.owner !== owner) continue;
      ctx.setLineDash(owner === 'you' ? [] : [6, 4]);
      ctx.lineWidth = 4; ctx.strokeStyle = `${TINT[owner]}.6)`;
      ctx.beginPath(); ctx.moveTo(edge.a.x, edge.a.y); ctx.lineTo(edge.b.x, edge.b.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    const blink = .35 + .35 * Math.sin(performance.now() / 220);
    const options = game.on ? choices() : [];
    ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    for (const p of infra()) {
      const { owner, hp } = cell(p);
      if (owner === 'you') { ctx.lineWidth = 2; ctx.strokeStyle = COLOUR.you; ctx.strokeRect(p.x - 13, p.y - 13, 26, 26); }
      if (owner === 'rival') { ctx.setLineDash([3, 3]); ctx.lineWidth = 2; ctx.strokeStyle = COLOUR.rival; ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, 6.28); ctx.stroke(); ctx.setLineDash([]); }
      if (HOMES.includes(p.label!)) { ctx.fillStyle = COLOUR[owner!]; ctx.fillText(owner === 'you' ? '你的基地' : '入侵者基地', p.x, p.y + 26); continue; }
      // Value tag above, shield pips below.
      ctx.fillStyle = owner ? COLOUR[owner] : 'rgba(246,246,243,.75)';
      ctx.fillText(`${VALUE[p.kind]}分`, p.x, p.y - 24);
      for (let i = 0; i < Math.min(hp, MAX_HP); i++) {
        const x = p.x - (Math.min(hp, MAX_HP) - 1) * 4 + i * 8, y = p.y + 22;
        ctx.fillStyle = owner ? COLOUR[owner] : 'rgba(246,246,243,.5)'; ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
      }
      if (threatened(p)) { ctx.lineWidth = 2.5; ctx.strokeStyle = `${TINT.rival}${.4 + blink})`; ctx.beginPath(); ctx.arc(p.x, p.y, 21 + blink * 4, 0, 6.28); ctx.stroke(); ctx.fillStyle = COLOUR.rival; ctx.fillText('!', p.x + 20, p.y - 16); }
      else if (options.includes(p)) { ctx.setLineDash([2, 4]); ctx.lineWidth = 1; ctx.strokeStyle = `rgba(255,255,255,${blink})`; ctx.beginPath(); ctx.arc(p.x, p.y, 19, 0, 6.28); ctx.stroke(); ctx.setLineDash([]); }
      if (p.label === game.selected) { ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 25, 0, 6.28); ctx.stroke(); }
    }
    ctx.textAlign = 'left';
  }

  function drawFloats(dt: number) {
    floats = floats.filter(f => (f.life -= dt / 1400) > 0);
    ctx.textAlign = 'center';
    for (const f of floats) {
      ctx.font = `${f.strong ? 700 : 500} ${f.strong ? 15 : 12}px "IBM Plex Mono", "Noto Sans TC", monospace`;
      ctx.globalAlpha = Math.min(1, f.life * 1.5); ctx.fillStyle = f.colour;
      ctx.fillText(f.text, f.x, f.y - (1 - f.life) * 22);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function draw(dt: number) {
    ctx.clearRect(0, 0, width, height);
    edges.forEach(stroke);
    ctx.setLineDash([]);
    drawTerritory();
    packets = packets.filter(packet => {
      let a = packet.path[packet.leg], b = packet.path[packet.leg + 1];
      packet.t += 130 * pace(packet.legs[packet.leg]) * dt / 1000 / Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      while (packet.t >= 1) {
        packet.t -= 1; packet.leg++;
        if (b.kind !== 'device') b.pulse = 1;
        if (packet.leg >= packet.path.length - 1) { if (packet.owner && game.on) land(packet.owner, b); return false; }
        a = packet.path[packet.leg]; b = packet.path[packet.leg + 1];
      }
      const x = a.x + (b.x - a.x) * packet.t, y = a.y + (b.y - a.y) * packet.t;
      if (packet.owner) {
        // Capture packets: a blue or red square, each trailing a dotted line to its target.
        ctx.setLineDash([2, 3]); ctx.lineWidth = 1.2; ctx.strokeStyle = `${TINT[packet.owner]}.7)`;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = COLOUR[packet.owner]; ctx.shadowColor = COLOUR[packet.owner]; ctx.shadowBlur = 10;
        ctx.fillRect(x - 4.5, y - 4.5, 9, 9); ctx.shadowBlur = 0;
        return true;
      }
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
      if (p.kind === 'device') { ctx.fillStyle = `rgba(255,255,255,${game.on ? .2 : .45})`; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); continue; }
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
        ctx.font = '600 12px "IBM Plex Mono", "Noto Sans TC", monospace'; ctx.fillText('E1-213 工程二館', p.x + 14, p.y);
        ctx.font = '500 10px "IBM Plex Mono", "Noto Sans TC", monospace'; ctx.fillStyle = 'rgba(246,246,243,.6)'; ctx.fillText('電機・通訊', p.x + 14, p.y + 14);
        ctx.font = '500 11px "IBM Plex Mono", "Noto Sans TC", monospace'; continue;
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.28); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(246,246,243,.6)'; ctx.fillText(p.label!, p.x + 10, p.y);
    }
    drawFloats(dt);
  }

  const start = () => { if (!running && visible && !still) { running = true; last = performance.now(); requestAnimationFrame(frame); } };
  const stop = () => { running = false; };
  build();
  if (still) { for (let i = 0; i < 24; i++) spawn(); packets.forEach(packet => { packet.t = Math.random(); }); draw(0); }
  new ResizeObserver(() => { build(); if (still) draw(0); }).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visible ? start() : stop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
}
