const canvas    = document.getElementById('radar-canvas');
const ctx       = canvas.getContext('2d');
const nodeLayer = document.getElementById('node-layer');
const scanBtn   = document.getElementById('scan-btn');
const resetBtn  = document.getElementById('reset-btn');
const ipInput   = document.getElementById('ip-input');

let W, H, cx, cy, radius;
let angle     = 0;
let animFrame = null;
let scanning  = false;
let startTime = null;
let timerInterval = null;

function resize() {
  const size = canvas.parentElement.offsetWidth;
  canvas.width  = size;
  canvas.height = size;
  W = H = size;
  cx = cy = size / 2;
  radius = size * 0.42;
}
resize();
window.addEventListener('resize', () => { resize(); placeNodes(); });

const HOSTNAMES = [
  'gateway.local', 'router.lan', 'nas-server', 'desktop-01',
  'laptop-josue', 'printer.lan', 'cam-01', 'switch-core',
  'pi.local', 'workstation', 'ap-wifi', 'backup-srv',
];

const SERVICES = [
  ['22/ssh', '80/http'],
  ['80/http', '443/https', '8080/proxy'],
  ['22/ssh', '3306/mysql'],
  ['445/smb', '139/netbios'],
  ['22/ssh'],
  ['80/http', '443/https'],
  ['554/rtsp', '80/http'],
  ['22/ssh', '23/telnet'],
  ['22/ssh', '1883/mqtt'],
  ['3389/rdp', '445/smb'],
  ['80/http'],
  ['22/ssh', '873/rsync'],
];

function generateHosts(base) {
  const count = 8 + Math.floor(Math.random() * 6);
  const hosts = [];
  const used  = new Set();

  hosts.push({
    ip:       base + '.1',
    name:     'gateway.local',
    up:       true,
    ports:    ['22/ssh', '80/http', '443/https'],
    latency:  1 + Math.random() * 3,
  });
  used.add(1);

  for (let i = 1; i < count; i++) {
    let n;
    do { n = 2 + Math.floor(Math.random() * 253); } while (used.has(n));
    used.add(n);
    const up = Math.random() > 0.25;
    const si = Math.floor(Math.random() * SERVICES.length);
    hosts.push({
      ip:      base + '.' + n,
      name:    up ? HOSTNAMES[Math.floor(Math.random() * HOSTNAMES.length)] : '',
      up,
      ports:   up ? SERVICES[si] : [],
      latency: up ? Math.round(1 + Math.random() * 120) : null,
    });
  }
  return hosts;
}

let hosts    = [];
let nodeEls  = [];
let lines    = [];

const PRELOADED_BASE = '192.168.1';

function initNodes(hostList) {
  nodeLayer.innerHTML = '';
  nodeEls  = [];
  lines    = [];
  hosts    = hostList;

  const count = hosts.length;
  hosts.forEach((host, i) => {
    const a   = (i / count) * Math.PI * 2 - Math.PI / 2;
    const r   = radius * (0.55 + Math.random() * 0.35);
    const x   = cx + Math.cos(a) * r;
    const y   = cy + Math.sin(a) * r;

    host._x = x;
    host._y = y;
    host._angle = a;

    const el = document.createElement('div');
    el.className = 'node' + (host.up ? '' : ' down');
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.innerHTML  = `
      <div class="node-dot"></div>
      <div class="node-label">${host.ip}</div>
      <div class="node-tooltip">
        <div style="color:var(--cyan)">${host.ip}</div>
        ${host.name ? `<div style="color:var(--gray)">${host.name}</div>` : ''}
        <div style="color:var(--${host.up ? 'green' : 'red'})">${host.up ? '● activo' : '○ inactivo'}</div>
        ${host.ports.length ? `<div style="color:var(--yellow)">${host.ports.join('  ')}</div>` : ''}
        ${host.latency ? `<div style="color:var(--gray)">latencia: ${host.latency}ms</div>` : ''}
      </div>
    `;
    nodeLayer.appendChild(el);
    nodeEls.push(el);
    lines.push({ x, y, revealed: false });
  });
}

function placeNodes() {
  nodeEls.forEach((el, i) => {
    if (!hosts[i]) return;
    el.style.left = hosts[i]._x + 'px';
    el.style.top  = hosts[i]._y + 'px';
  });
}

function drawRadar(sweepAngle, revealedLines) {
  ctx.clearRect(0, 0, W, H);

  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * i / 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth   = 1;
    ctx.stroke();
  }

  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius); ctx.stroke();

  revealedLines.forEach(({ x, y }) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#00ff8822';
    ctx.lineWidth   = 1;
    ctx.stroke();
  });

  // barrido
  const gradient = ctx.createConicalGradient
    ? null
    : null;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(sweepAngle);

  const sweep = ctx.createLinearGradient(0, -radius, radius * 0.5, 0);
  sweep.addColorStop(0,   'rgba(0,255,136,0)');
  sweep.addColorStop(0.7, 'rgba(0,255,136,0.08)');
  sweep.addColorStop(1,   'rgba(0,255,136,0.25)');

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radius, -Math.PI / 6, 0);
  ctx.fillStyle = sweep;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(radius, 0);
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#00ff88';
  ctx.fill();
}


function animateRadar() {
  angle += 0.025;

  lines.forEach((line, i) => {
    if (line.revealed) return;
    let nodeAngle = hosts[i]._angle;
    let sweep     = angle % (Math.PI * 2);
    let na        = ((nodeAngle + Math.PI * 2) % (Math.PI * 2));
    if (Math.abs(sweep - na) < 0.08 || Math.abs(sweep - na - Math.PI * 2) < 0.08) {
      line.revealed = true;
      nodeEls[i].classList.add('visible');
    }
  });

  const revealed = lines.filter(l => l.revealed);
  drawRadar(angle, revealed);
  animFrame = requestAnimationFrame(animateRadar);
}


function startScan() {
  cancelAnimationFrame(animFrame);
  clearInterval(timerInterval);

  const input = ipInput.value.trim();

  if (!input) {
    showInputError('Ingresa una IP o rango. Ej: 192.168.1.0/24');
    return;
  }

  const match = input.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})/);
  if (!match) {
    showInputError('Formato inválido. Usa IPv4. Ej: 192.168.1.0/24');
    return;
  }

  const [, a, b, c] = match;
  if (+a > 255 || +b > 255 || +c > 255) {
    showInputError('IP fuera de rango. Los octetos deben ser 0-255.');
    return;
  }

  const base = `${a}.${b}.${c}`;

  reset(false);
  scanning = true;
  scanBtn.disabled = true;

  const newHosts = generateHosts(base);
  initNodes(newHosts);

  nodeEls.forEach(el => el.classList.remove('visible'));
  lines.forEach(l => l.revealed = false);

  startTime = Date.now();
  timerInterval = setInterval(() => {
    document.getElementById('stat-time').textContent =
      ((Date.now() - startTime) / 1000).toFixed(1) + 's';
  }, 100);

  animFrame = requestAnimationFrame(animateRadar);

  const totalDuration = (Math.PI * 2 / 0.025) * (1000 / 60);
  setTimeout(() => {
    finishScan(newHosts);
  }, totalDuration + 500);
}

function finishScan(hostList) {
  scanning = false;
  scanBtn.disabled = false;
  clearInterval(timerInterval);


  nodeEls.forEach(el => el.classList.add('visible'));
  lines.forEach(l => l.revealed = true);

  const up    = hostList.filter(h => h.up);
  const ports = hostList.reduce((acc, h) => acc + h.ports.length, 0);

  document.getElementById('stat-total').textContent = hostList.length;
  document.getElementById('stat-up').textContent    = up.length;
  document.getElementById('stat-ports').textContent = ports;

  const panel = document.getElementById('results-panel');
  const list  = document.getElementById('host-list');
  list.innerHTML = '';
  panel.classList.remove('hidden');

  hostList.forEach(host => {
    const row = document.createElement('div');
    row.className = 'host-row';
    row.innerHTML = `
      <div class="host-status ${host.up ? 'up' : 'down'}"></div>
      <div class="host-ip">${host.ip}</div>
      <div class="host-name">${host.name || '—'}</div>
      <div class="host-ports">${host.ports.join('  ') || 'sin puertos'}</div>
    `;
    list.appendChild(row);
  });
}

function reset(reInit = true) {
  cancelAnimationFrame(animFrame);
  clearInterval(timerInterval);
  scanning = false;
  scanBtn.disabled = false;
  angle = 0;
  nodeLayer.innerHTML = '';
  nodeEls = [];
  lines   = [];
  hosts   = [];
  document.getElementById('results-panel').classList.add('hidden');
  document.getElementById('stat-total').textContent = '0';
  document.getElementById('stat-up').textContent    = '0';
  document.getElementById('stat-ports').textContent = '0';
  document.getElementById('stat-time').textContent  = '0s';

  if (reInit) {
    ctx.clearRect(0, 0, W, H);
    drawRadar(0, []);
  }
}


scanBtn.addEventListener('click', startScan);
resetBtn.addEventListener('click', () => reset(true));
ipInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') startScan();
});


resize();
const preloaded = generateHosts(PRELOADED_BASE);
initNodes(preloaded);
nodeEls.forEach(el => el.classList.add('visible'));
lines.forEach(l => l.revealed = true);
drawRadar(0, lines);

// radar idle
function idleRadar() {
  angle += 0.015;
  drawRadar(angle, lines);
  animFrame = requestAnimationFrame(idleRadar);
}

function showInputError(msg) {
  ipInput.style.borderColor = 'var(--red)';
  ipInput.placeholder = msg;
  ipInput.value = '';
  setTimeout(() => {
    ipInput.style.borderColor = '';
    ipInput.placeholder = '192.168.1.0/24';
  }, 3000);
}

idleRadar();