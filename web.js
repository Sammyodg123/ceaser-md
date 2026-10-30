const http = require('http');
const fs = require('fs');
const path = require('path');

const bot = require('./index.js');
const webConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'web.json'), 'utf8'));

const PORT = Number(process.env.PORT || webConfig.port || 10000);
const PAIRING_API_KEY = process.env.PAIRING_API_KEY || '';
const OWNER_NUMBER = '2347066248340';
const OWNER_TELEGRAM = 'lord_ceaser_himself';
const WHATSAPP_URL = `https://wa.me/${OWNER_NUMBER}`;
const TELEGRAM_URL = `https://t.me/${OWNER_TELEGRAM}`;
const startedAt = Date.now();
const attempts = new Map();
const activePairs = new Map();
let totalVisitors = 783; // live fake counter base, will grow

function notifyWebsitePairing(event, data) {
  try {
    const notifier = global.CeaserTelegram && global.CeaserTelegram.notifyWebPairing;
    if (typeof notifier === 'function') notifier(event, data).catch(e => console.log('[website pairing notify]', e.message));
  } catch(e) { console.log('[website pairing notify]', e.message); }
}
function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}
function html(res, body) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function cleanPhone(value) { return String(value || '').replace(/\D/g, ''); }
function allowed(req) {
  if (!PAIRING_API_KEY) return true;
  const supplied = req.headers['x-pairing-key'] || new URL(req.url, `http://${req.headers.host}`).searchParams.get('key');
  return supplied === PAIRING_API_KEY;
}
function rateLimited(ip) {
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  attempts.set(ip, recent);
  return recent.length >= 5;
}
async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}
function formatUptime(ms) {
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || 'less than a minute';
}

function page() {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#07111e">
<title>CEASERMD · Pairing Portal</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=JetBrains+Mono:wght@600&display=swap" rel="stylesheet">
<style>
:root{--bg:#050a12;--card:#0e1a2b;--card2:#0b1523;--line:#1f344e;--text:#eef6ff;--muted:#8da2b8;--cyan:#54e8ff;--violet:#8a7cff;--green:#5af2a1;--pink:#ff73cf}
[data-theme="light"]{--bg:#f4f8ff;--card:#ffffff;--card2:#eef3ff;--line:#d5deea;--text:#0a1930;--muted:#5b7290;--cyan:#0aa0ff;--violet:#6a5cff;--green:#0abb6a}
*{box-sizing:border-box}body{margin:0;color:var(--text);font-family:Inter,system-ui;background:var(--bg);overflow-x:hidden;min-height:100vh;transition:background .3s,color .3s}
#bg{position:fixed;inset:0;z-index:-3;background:radial-gradient(900px 500px at 15% -10%,#1a4a6b 0,transparent 60%),radial-gradient(800px 600px at 90% 0%,#3d2570 0,transparent 60%),var(--bg)}
[data-theme="light"] #bg{background:radial-gradient(900px 500px at 15% -10%,#c8e8ff 0,transparent 60%),radial-gradient(800px 600px at 90% 0%,#ddd0ff 0,transparent 60%),var(--bg)}
#canvas{position:fixed;inset:0;z-index:-2;opacity:.55}
.orbs{position:fixed;inset:0;z-index:-1;pointer-events:none;filter:blur(60px)}
.orb{position:absolute;border-radius:50%;animation:float 12s ease-in-out infinite}
.orb1{width:420px;height:420px;background:radial-gradient(circle,#54e8ff44,#54e8ff00 70%);left:-80px;top:10%}
.orb2{width:520px;height:520px;background:radial-gradient(circle,#8877ff44,#8877ff00 70%);right:-100px;top:30%;animation-delay:-4s}
.orb3{width:380px;height:380px;background:radial-gradient(circle,#ff73cf33,#ff73cf00 70%);left:40%;bottom:-80px;animation-delay:-2s}
@keyframes float{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-30px)}}
.shell{max-width:1180px;margin:auto;padding:22px 20px 50px;position:relative}
.nav{display:flex;justify-content:space-between;align-items:center}
.brand{display:flex;align-items:center;gap:12px;font-weight:900;letter-spacing:1.2px;font-family:'Space Grotesk',sans-serif}
.logo{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,var(--cyan),var(--violet));color:#fff;font-size:22px;box-shadow:0 0 30px #54e8ff66;animation:pulseGlow 2s infinite}
@keyframes pulseGlow{0%,100%{box-shadow:0 0 20px #54e8ff66}50%{box-shadow:0 0 40px #54e8ffaa}}
.navlinks{display:flex;gap:8px;align-items:center}
.pill{border:1px solid var(--line);background:#ffffff0a;color:var(--text);text-decoration:none;border-radius:99px;padding:9px 14px;font-size:12.5px;backdrop-filter:blur(10px);transition:.2s;cursor:pointer}
.pill:hover{border-color:var(--cyan);transform:translateY(-1px)}
.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:36px;padding:70px 0 40px;align-items:center}
.kicker{color:var(--cyan);font-weight:800;font-size:11px;letter-spacing:3px;text-transform:uppercase;display:flex;align-items:center;gap:8px}
.kicker::before{content:'';width:28px;height:2px;background:var(--cyan);display:inline-block}
.hero h1{font-family:'Space Grotesk',sans-serif;font-size:clamp(38px,6vw,74px);line-height:.95;letter-spacing:-4px;margin:16px 0 18px}
.grad{background:linear-gradient(100deg,var(--text) 10%,var(--cyan) 50%,var(--violet) 90%);-webkit-background-clip:text;background-clip:text;color:transparent;animation:gradMove 6s ease infinite;background-size:200% 200%}
@keyframes gradMove{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
.type{color:var(--muted);font-size:17px;line-height:1.7;max-width:620px;min-height:60px}
.hero-card{border:1px solid var(--line);border-radius:22px;padding:18px 20px;background:linear-gradient(180deg,#ffffff0a,#ffffff03);backdrop-filter:blur(12px);position:relative;overflow:hidden}
.hero-card::after{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,#ffffff12,transparent);animation:scan 3s linear infinite}
@keyframes scan{0%{left:-100%}100%{left:100%}}
.live{color:var(--green);font-size:11px;letter-spacing:2px;font-weight:800;display:flex;align-items:center;gap:6px}
.live i{width:7px;height:7px;background:var(--green);border-radius:50%;box-shadow:0 0 10px var(--green);animation:blink 1.2s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
.grid{display:grid;grid-template-columns:1.15fr .85fr;gap:18px}
.card{border:1px solid var(--line);border-radius:24px;background:linear-gradient(160deg,var(--card),var(--card2));padding:26px;box-shadow:0 20px 80px #0008;backdrop-filter:blur(16px);transition:transform .3s}
.card:hover{transform:translateY(-3px);border-color:#2a4a6b}
.label{display:block;color:var(--muted);font-size:12px;font-weight:700;margin:0 0 10px;letter-spacing:.8px;text-transform:uppercase}
.inputrow{display:flex;gap:10px}
.input,button{font:inherit;border-radius:14px;padding:14px 15px;border:1px solid var(--line);outline:0}
.input{background:var(--card2);color:var(--text);flex:1;font-family:'JetBrains Mono',monospace;letter-spacing:1px}
.input:focus{border-color:var(--cyan);box-shadow:0 0 0 4px #54e8ff18}
.btn{cursor:pointer;border:0;font-weight:850;background:linear-gradient(135deg,var(--cyan),var(--violet));color:#fff;min-width:150px;transition:.2s}
.btn:hover{transform:translateY(-2px) scale(1.02);filter:brightness(1.15)}
.btn:disabled{opacity:.6;cursor:wait}
.result{display:none;margin-top:18px;border:1px solid #54e8ff55;background:linear-gradient(135deg,#54e8ff10,#8877ff14);border-radius:18px;padding:18px;animation:pop .4s ease}
@keyframes pop{0%{transform:scale(.96);opacity:0}100%{transform:scale(1);opacity:1}}
.result.show{display:block}
.result.error{border-color:#ff6b8a66;background:#ff56780d;color:#ffb0c0}
.code{font-family:'JetBrains Mono',monospace;font-size:36px;letter-spacing:8px;color:var(--cyan);font-weight:900;margin:10px 0;text-shadow:0 0 20px #54e8ff88;animation:codeIn .6s ease}
@keyframes codeIn{0%{letter-spacing:20px;opacity:0}100%{letter-spacing:8px;opacity:1}}
.copy{margin-top:8px;background:#ffffff12;color:var(--text);border:1px solid #ffffff22;padding:10px 14px;font-size:13px;cursor:pointer;border-radius:10px;transition:.2s}
.copy.done{border-color:var(--green);color:var(--green);background:#5af2a111}
.steps{display:grid;gap:14px}
.step{display:flex;gap:12px;align-items:flex-start}
.num{width:32px;height:32px;border-radius:50%;border:1px solid #54e8ff66;color:var(--cyan);display:grid;place-items:center;font-weight:800;font-size:12px;flex:0 0 32px;background:#54e8ff0f}
.footer{text-align:center;color:var(--muted);font-size:12px;padding-top:30px}
.bar{height:3px;width:100%;background:linear-gradient(90deg,var(--cyan),var(--violet),var(--pink));background-size:200% 100%;animation:gradMove 3s linear infinite;border-radius:99px;margin:14px 0}
.counter{font-family:'JetBrains Mono';font-size:11px;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap;margin-top:10px}
.counter b{color:var(--cyan)}
@media(max-width:820px){.hero,.grid{grid-template-columns:1fr}.hero{padding:40px 0 24px}}
</style></head>
<body>
<div id="bg"></div><canvas id="canvas"></canvas>
<div class="orbs"><div class="orb orb1"></div><div class="orb orb2"></div><div class="orb orb3"></div></div>
<main class="shell">
<nav class="nav"><div class="brand"><div class="logo">C</div>CEASER<span style="color:var(--cyan)">MD</span></div>
<div class="navlinks">
<button id="themeBtn" class="pill">🌙 Dark</button>
<span class="pill" style="pointer-events:none">👁️ <b id="visitCount">0</b> online</span>
<a class="pill" href="${WHATSAPP_URL}" target="_blank">💬 WhatsApp</a><a class="pill" href="${TELEGRAM_URL}" target="_blank">✈️ Telegram</a></div></nav>

<section class="hero">
<div>
<div class="kicker">Official pairing gateway • v3.0 live</div>
<h1>Bring WhatsApp into <span class="grad">CeaserMD Network</span></h1>
<div class="type" id="type"></div>
<div class="bar"></div>
<div class="hero-card"><div class="live"><i></i> LIVE ENGINE: CUSTOM CODE ENABLED</div><div style="margin-top:8px;color:var(--muted);font-size:13px;line-height:1.6">Pair once • Session stays on your server • Auto-reconnect • Multi-device ready</div>
<div class="counter"><span>⏱️ Uptime: <b id="uptime"></b></span><span>🔥 Total pairs: <b id="totalPairs">0</b></span><span>📦 Sessions: <b id="sessCount">0</b></span></div>
</div>
</div>
<div class="card" style="align-self:center">
<div class="live" style="margin-bottom:12px"><i></i> <span id="status">Checking service…</span></div>
<h2 style="font-family:'Space Grotesk';margin:0 0 6px;font-size:24px">Start secure pairing</h2>
<p style="color:var(--muted);margin:0 0 18px;line-height:1.6;font-size:14px">Enter number with country code. No +, no spaces.</p>
<label class="label">WhatsApp Number</label>
<div class="inputrow"><input id="phone" class="input" placeholder="2347066248340"><button id="pair" class="btn">⚡ Generate Code</button></div>
<div style="color:var(--muted);font-size:11px;margin-top:8px">Example: 234xxxxxxxxxx • 🔊 Sound on</div>
<div id="result" class="result"></div>
</div>
</section>

<section class="grid">
<div class="card"><h2 style="font-family:'Space Grotesk';margin:0 0 8px">Finish in 3 moves</h2>
<div class="steps" style="margin-top:18px">
<div class="step"><div class="num">01</div><div><b>Open WhatsApp</b><br><span style="color:var(--muted);font-size:13px">Settings → Linked Devices</span></div></div>
<div class="step"><div class="num">02</div><div><b>Tap Link with phone number</b><br><span style="color:var(--muted);font-size:13px">Choose “Link with phone number instead”</span></div></div>
<div class="step"><div class="num">03</div><div><b>Paste your code</b><br><span style="color:var(--muted);font-size:13px">Code expires in ~3 mins. Keep tab open.</span></div></div>
</div>
</div>
<div class="card">
<h2 style="font-family:'Space Grotesk';margin:0 0 8px">Why CeaserMD?</h2>
<div style="display:grid;gap:10px;margin-top:12px;color:var(--muted);font-size:13px">
<div>⚡ <b style="color:var(--text)">Fast Pairing</b> - Custom engine, no delay</div>
<div>🛡️ <b style="color:var(--text)">Stable</b> - Auto-reconnect & session guard</div>
<div>👥 <b style="color:var(--text)">Multi-session</b> - Up to unlimited for admins</div>
<div>🎨 <b style="color:var(--text)">Telegram-synced</b> - Web pairing notifies bot</div>
</div>
</div>
</section>

<div class="footer">CEASERMD • Owner: Lord Ceaser • Made with 💙 for speed</div>
</main>

<script>
const $=id=>document.getElementById(id);
// theme toggle
let theme=localStorage.getItem('ceaser-theme')||'dark';
document.documentElement.setAttribute('data-theme',theme);
function updateThemeBtn(){ $('themeBtn').textContent=theme==='dark'?'☀️ Light':'🌙 Dark';}
updateThemeBtn();
$('themeBtn').onclick=()=>{theme=theme==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',theme);localStorage.setItem('ceaser-theme',theme);updateThemeBtn();};

// visitor counter live
let visitors=Math.floor(Math.random()*18)+23;
$('visitCount').textContent=visitors;
setInterval(()=>{ if(Math.random()>0.5) visitors++; else if(visitors>12) visitors--; $('visitCount').textContent=visitors; }, 3500);

// typing
const lines=["A powerful multi-session assistant built for speed, media tools, group protection and Telegram workflows.","Pair once, stay connected, let CeaserMD handle the rest."];
let li=0,ci=0;function type(){const el=$('type');if(li>=lines.length)return;if(ci<=lines[li].length){el.textContent=lines[li].slice(0,ci++)+'▍';setTimeout(type,22)}else{setTimeout(()=>{li++;ci=0;type()},900)}}type();

// canvas particles
const canvas=$('canvas'),ctx=canvas.getContext('2d');function resize(){canvas.width=innerWidth;canvas.height=innerHeight}resize();addEventListener('resize',resize);
let pts=[...Array(55)].map(()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,vx:(Math.random()-.5)*.6,vy:(Math.random()-.5)*.6,r:Math.random()*1.8+0.6}));
function loop(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle=document.documentElement.getAttribute('data-theme')==='light'?'#0aa0ff':'#54e8ff';for(let p of pts){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>canvas.width)p.vx*=-1;if(p.y<0||p.y>canvas.height)p.vy*=-1;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}for(let i=0;i<pts.length;i++){for(let j=i+1;j<pts.length;j++){let dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.hypot(dx,dy);if(d<150){ctx.strokeStyle='rgba(84,232,255,'+(0.12*(1-d/150))+')';ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.stroke();}}}requestAnimationFrame(loop)}loop();

// sound using WebAudio
let audioCtx=null;
function ensureAudio(){ if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended') audioCtx.resume(); }
function playSuccess(){ try{ ensureAudio(); const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type='sine'; o.frequency.setValueAtTime(400,audioCtx.currentTime); o.frequency.linearRampToValueAtTime(900,audioCtx.currentTime+0.22); g.gain.setValueAtTime(0.0,audioCtx.currentTime); g.gain.linearRampToValueAtTime(0.25,audioCtx.currentTime+0.02); g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.4); o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+0.45);}catch(e){} }

async function health(){try{const r=await fetch('/api/health');const j=await r.json();$('status').textContent=j.status==='ok'?'SERVICE ONLINE':'DEGRADED';$('uptime').textContent=j.uptime;if($('sessCount'))$('sessCount').textContent=j.sessions;if($('totalPairs'))$('totalPairs').textContent=(783+j.sessions*3)}catch{$('status').textContent='OFFLINE'}}health();setInterval(health,12000);

async function copyCode(btn){const code=btn.dataset.code;try{await navigator.clipboard.writeText(code)}catch{let ta=document.createElement('textarea');ta.value=code;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}btn.textContent='Copied ✓';btn.classList.add('done');let rect=btn.getBoundingClientRect();for(let i=0;i<12;i++){let d=document.createElement('div');d.style.position='fixed';d.style.left=rect.left+rect.width/2+'px';d.style.top=rect.top+'px';d.style.width='6px';d.style.height='6px';d.style.background=['#54e8ff','#8a7cff','#ff73cf'][i%3];d.style.borderRadius='50%';d.style.pointerEvents='none';document.body.appendChild(d);d.animate([{transform:'translate(0,0)',opacity:1},{transform:'translate('+(Math.random()*200-100)+'px,'+(Math.random()*-120-20)+'px)',opacity:0}],{duration:800+Math.random()*400}).onfinish=()=>d.remove()}setTimeout(()=>{btn.textContent='Copy code';btn.classList.remove('done')},2000)}

$('pair').onclick=async()=>{ensureAudio();const phone=$('phone').value.replace(/\\D/g,'');const out=$('result');out.className='result show';out.innerHTML='<div style="color:#8ecbff;font-size:13px">⏳ Connecting to WhatsApp...</div>';$('pair').disabled=true;try{const r=await fetch('/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Pairing failed');const code=j.displayCode||j.code;playSuccess();out.innerHTML='<div style="font-size:11px;letter-spacing:2px;color:#9ab8d0">YOUR PAIRING CODE</div><div class="code">'+code+'</div><button class="copy" data-code="'+code+'">📋 Copy code</button><div style="margin-top:10px;color:var(--muted);font-size:12px;line-height:1.5">WhatsApp → Linked Devices → Link with phone number instead → paste code.<br>Expires in ~3 mins.</div>';out.querySelector('.copy').onclick=e=>copyCode(e.currentTarget)}catch(e){out.className='result show error';out.textContent='❌ '+e.message}finally{$('pair').disabled=false}};
$('phone').addEventListener('keydown',e=>{if(e.key==='Enter')$('pair').click()});
document.addEventListener('click',()=>ensureAudio(),{once:true});
</script>
</body></html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return html(res, page());
  if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { status: 'ok', service: webConfig.brand, uptime: formatUptime(Date.now() - startedAt), sessions: bot.sessions().length, customCode: bot.CONFIG.CUSTOM_CODE, visitors: ++totalVisitors });
  if (req.method === 'GET' && url.pathname === '/api/status') return json(res, 200, { service: webConfig.brand, sessions: bot.sessions(), owner: { whatsapp: WHATSAPP_URL, telegram: TELEGRAM_URL } });
  if (req.method === 'POST' && url.pathname === '/api/pair') {
    if (!allowed(req)) return json(res, 401, { error: 'Pairing key required.' });
    const ip = req.socket.remoteAddress || 'unknown';
    if (rateLimited(ip)) return json(res, 429, { error: 'Too many attempts. Try again in a few minutes.' });
    const data = await readBody(req); const phone = cleanPhone(data.phone);
    if (!/^\d{10,15}$/.test(phone)) return json(res, 400, { error: 'Enter a valid phone number with country code.' });
    const list = attempts.get(ip) || []; list.push(Date.now()); attempts.set(ip, list);
    if (activePairs.has(phone)) return json(res, 409, { error: 'A pairing request for this number is already active.' });
    activePairs.set(phone, Date.now());
    try {
      const result = await bot.requestPairing(phone);
      const event = { phone, sessionName: result.sessionName, source: 'website' };
      notifyWebsitePairing('requested', event);
      if (typeof bot.onLinked === 'function') bot.onLinked(result.sessionName, () => notifyWebsitePairing('linked', event));
      return json(res, 200, { code: result.code, displayCode: result.displayCode, sessionName: result.sessionName, isCustom: result.isCustom });
    } catch (e) { return json(res, 500, { error: e.message || 'Unable to generate a pairing code.' }); }
    finally { activePairs.delete(phone); }
  }
  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => console.log(`🌐 CeaserMD portal v3 LIVE on ${PORT}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
