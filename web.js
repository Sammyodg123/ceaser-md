const http = require('http');
const fs = require('fs');
const path = require('path');

// Keep the new fixed index.js as the single source of truth for pairing.
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
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#07111e"><title>CEASERMD · WhatsApp Pairing</title>
<style>
:root{color-scheme:dark;--bg:#050a12;--card:#0b1523;--line:#20344b;--text:#f4f8fc;--muted:#91a4b9;--cyan:#54e8ff;--violet:#8877ff;--green:#67e9a7;--pink:#ff73cf}*{box-sizing:border-box}body{margin:0;color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(850px 480px at 10% -5%,#134168 0,transparent 65%),radial-gradient(700px 440px at 100% 8%,#36215e 0,transparent 62%),var(--bg);min-height:100vh}.noise{position:fixed;inset:0;pointer-events:none;opacity:.055;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.7'/%3E%3C/svg%3E")}.shell{max-width:1120px;margin:auto;padding:25px 20px 48px;position:relative}.nav{display:flex;justify-content:space-between;align-items:center;gap:18px}.brand{display:flex;align-items:center;gap:12px;font-weight:900;letter-spacing:1px}.logo{display:grid;place-items:center;width:44px;height:44px;border-radius:15px;color:#06101c;background:linear-gradient(135deg,var(--cyan),var(--violet));box-shadow:0 0 35px #54e8ff55;font-size:22px}.navlinks{display:flex;gap:9px}.navlinks a{color:#c8d6e5;text-decoration:none;border:1px solid var(--line);border-radius:99px;padding:9px 13px;font-size:13px;background:#ffffff05}.hero{display:grid;grid-template-columns:1fr .72fr;gap:40px;align-items:end;padding:82px 0 42px}.kicker{color:var(--cyan);font-weight:850;font-size:12px;letter-spacing:2.8px;text-transform:uppercase}.hero h1{font-size:clamp(43px,7vw,82px);line-height:.96;letter-spacing:-5px;margin:15px 0 23px;max-width:740px}.gradient{background:linear-gradient(105deg,var(--text),var(--cyan) 53%,#b39cff);-webkit-background-clip:text;background-clip:text;color:transparent}.hero p{color:var(--muted);font-size:18px;line-height:1.7;max-width:690px;margin:0}.hero-note{border-left:2px solid var(--cyan);padding:7px 0 7px 20px;color:#bed0e1;line-height:1.7}.hero-note strong{color:var(--text)}.grid{display:grid;grid-template-columns:1.08fr .92fr;gap:18px}.card{border:1px solid var(--line);border-radius:25px;background:linear-gradient(145deg,#122238ee,#08111dee);padding:28px;box-shadow:0 24px 100px #0006;backdrop-filter:blur(14px)}.card h2{font-size:22px;margin:0 0 9px}.muted{color:var(--muted);line-height:1.6;margin:0 0 22px}.label{display:block;color:#bfd1e2;font-size:13px;font-weight:700;margin:0 0 9px}.inputrow{display:flex;gap:10px}.input,button{font:inherit;border-radius:14px;padding:14px 15px;border:1px solid var(--line);outline:0}.input{background:#06101b;color:var(--text);flex:1;min-width:0}.input:focus{border-color:var(--cyan);box-shadow:0 0 0 4px #54e8ff15}button{cursor:pointer;border:0;font-weight:850;background:linear-gradient(135deg,var(--cyan),var(--violet));color:#06101b;transition:transform .2s,filter .2s}button:hover{transform:translateY(-2px);filter:brightness(1.1)}button:disabled{opacity:.55;cursor:wait;transform:none}.hint{font-size:12px;color:#71869b;margin-top:10px}.result{display:none;margin-top:18px;border:1px solid #54e8ff52;background:linear-gradient(135deg,#54e8ff0e,#8877ff12);border-radius:18px;padding:18px}.result.success{display:block}.result.error{display:block;color:#ff9fa8;border-color:#ff708055;background:#ff52640c}.result-title{font-size:13px;color:#b9ccdf}.code{font-size:34px;line-height:1.1;letter-spacing:5px;color:var(--cyan);font-weight:950;margin:8px 0 15px}.actions{display:flex;gap:9px;flex-wrap:wrap}.copy{background:#ffffff10;color:var(--text);border:1px solid #ffffff23;padding:10px 13px;font-size:13px}.copy.done{border-color:var(--green);color:var(--green)}.small{font-size:13px;color:var(--muted);line-height:1.55}.steps{display:grid;gap:15px}.step{display:flex;gap:13px}.stepno{flex:0 0 31px;height:31px;display:grid;place-items:center;border:1px solid #54e8ff55;color:var(--cyan);border-radius:50%;font-weight:850}.step b{display:block;margin:0 0 4px}.step span{display:block;color:var(--muted);font-size:14px;line-height:1.5}.badgebar{display:flex;flex-wrap:wrap;gap:8px;margin-top:23px}.badge{color:#c8d8e8;border:1px solid var(--line);border-radius:99px;padding:8px 11px;font-size:12px;background:#ffffff05}.contactbar{display:flex;gap:10px;flex-wrap:wrap;margin-top:23px}.contact{color:var(--text);text-decoration:none;border:1px solid var(--line);border-radius:12px;padding:11px 13px;background:#ffffff06;font-size:13px}.footer{text-align:center;color:#71869a;font-size:12px;padding-top:28px}.online{display:inline-flex;align-items:center;gap:7px;border:1px solid #67e9a733;color:var(--green);background:#67e9a70c;border-radius:99px;padding:8px 12px;font-size:12px}.online i{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 13px var(--green)}@media(max-width:780px){.hero,.grid{grid-template-columns:1fr}.hero{padding:58px 0 34px;gap:25px}.hero h1{letter-spacing:-3px}.inputrow{flex-direction:column}.nav{align-items:flex-start;flex-direction:column}.navlinks{width:100%}.navlinks a{flex:1;text-align:center}}
</style></head><body><div class="noise"></div><main class="shell"><nav class="nav"><div class="brand"><div class="logo">C</div><span>CEASER<span style="color:var(--cyan)">MD</span></span></div><div class="navlinks"><a href="${WHATSAPP_URL}" target="_blank" rel="noopener">WhatsApp owner</a><a href="${TELEGRAM_URL}" target="_blank" rel="noopener">Telegram owner</a></div></nav>
<section class="hero"><div><div class="kicker">Official WhatsApp pairing gateway</div><h1>Bring your WhatsApp into the <span class="gradient">CeaserMD network.</span></h1><p>A powerful, multi-session WhatsApp assistant built for fast commands, media tools, group protection and Telegram-connected workflows. Pair once, stay connected, and let CeaserMD handle the rest.</p></div><div class="hero-note"><strong>Simple by design.</strong><br>Enter your number, request your code, copy it with one tap, then finish linking inside WhatsApp. Your code is temporary and your session stays on your server.</div></section>
<section class="grid"><div class="card"><h2>Start a secure pairing</h2><p class="muted">Use your full WhatsApp number with the country code. Do not include <b>+</b>, spaces or dashes.</p><label class="label" for="phone">WhatsApp number</label><div class="inputrow"><input id="phone" class="input" inputmode="numeric" autocomplete="tel" placeholder="2347066248340"><button id="pair">Generate code</button></div><div class="hint">Example: Nigeria numbers start with <b>234</b>.</div><div id="result" class="result"></div><div class="badgebar"><span class="badge">Custom pairing enabled</span><span class="badge">Multi-session ready</span><span class="badge">CEASERMD core</span></div></div>
<div class="card"><h2>Finish in three moves</h2><p class="muted">The code is valid for a short time. Keep WhatsApp open while pairing.</p><div class="steps"><div class="step"><div class="stepno">01</div><div><b>Open WhatsApp</b><span>Go to Settings → Linked devices.</span></div></div><div class="step"><div class="stepno">02</div><div><b>Choose phone-number linking</b><span>Select “Link with phone number instead”.</span></div></div><div class="step"><div class="stepno">03</div><div><b>Copy and enter your code</b><span>Tap the copy button below the generated code, then paste or type it into WhatsApp.</span></div></div></div><div class="contactbar"><a class="contact" href="${WHATSAPP_URL}" target="_blank" rel="noopener">Contact on WhatsApp</a><a class="contact" href="${TELEGRAM_URL}" target="_blank" rel="noopener">Contact on Telegram</a></div></div></section>
<div class="footer"><span class="online"><i></i><span id="status">Checking service…</span></span><br><span id="uptime"></span> · ${webConfig.brand} · Custom code engine: <b>CEASERMD</b></div></main>
<script>
const $=id=>document.getElementById(id);
async function health(){try{const r=await fetch('/api/health');const j=await r.json();$('status').textContent=j.status==='ok'?'Service online':'Service degraded';$('uptime').textContent='Online for '+j.uptime}catch(e){$('status').textContent='Service unavailable'}}
health();setInterval(health,15000);
async function copyPairingCode(btn){const code=btn.dataset.code;try{await navigator.clipboard.writeText(code)}catch{const ta=document.createElement('textarea');ta.value=code;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}btn.textContent='Copied ✓';btn.classList.add('done');setTimeout(()=>{btn.textContent='Copy code';btn.classList.remove('done')},2200)}
$('pair').onclick=async()=>{const phone=$('phone').value.replace(/\\D/g,'');const out=$('result');out.className='result success';out.style.display='block';out.innerHTML='<div class="small">Connecting to WhatsApp and preparing your one-time code…</div>';$('pair').disabled=true;try{const r=await fetch('/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Pairing failed');const code=j.displayCode||j.code;out.innerHTML='<div class="result-title">Your pairing code is ready</div><div class="code">'+code+'</div><div class="actions"><button class="copy" data-code="'+code+'">Copy code</button></div><p class="small">Open WhatsApp → Linked devices → Link with phone number instead, then enter this code. It normally expires in about 3 minutes.</p>';out.querySelector('.copy').onclick=e=>copyPairingCode(e.currentTarget)}catch(e){out.className='result error';out.textContent=e.message}finally{$('pair').disabled=false}};
$('phone').addEventListener('keydown',e=>{if(e.key==='Enter')$('pair').click()});
</script></body></html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return html(res, page());
  if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { status: 'ok', service: webConfig.brand, uptime: formatUptime(Date.now() - startedAt), sessions: bot.sessions().length, customCode: bot.CONFIG.CUSTOM_CODE });
  if (req.method === 'GET' && url.pathname === '/api/status') return json(res, 200, { service: webConfig.brand, sessions: bot.sessions(), owner: { whatsapp: WHATSAPP_URL, telegram: TELEGRAM_URL } });
  if (req.method === 'POST' && url.pathname === '/api/pair') {
    if (!allowed(req)) return json(res, 401, { error: 'Pairing key required.' });
    const ip = req.socket.remoteAddress || 'unknown';
    if (rateLimited(ip)) return json(res, 429, { error: 'Too many attempts. Try again in a few minutes.' });
    const data = await readBody(req); const phone = cleanPhone(data.phone);
    if (!/^\d{10,15}$/.test(phone)) return json(res, 400, { error: 'Enter a valid phone number with country code.' });
    attempts.get(ip).push(Date.now());
    if (activePairs.has(phone)) return json(res, 409, { error: 'A pairing request for this number is already active.' });
    activePairs.set(phone, Date.now());
    try {
      const result = await bot.requestPairing(phone);
      const event = { phone, sessionName: result.sessionName, source: 'website' };
      notifyWebsitePairing('requested', event);
      if (typeof bot.onLinked === 'function') bot.onLinked(result.sessionName, () => notifyWebsitePairing('linked', event));
      return json(res, 200, { code: result.code, displayCode: result.displayCode, sessionName: result.sessionName, isCustom: result.isCustom });
    }
    catch (e) { return json(res, 500, { error: e.message || 'Unable to generate a pairing code.' }); }
    finally { activePairs.delete(phone); }
  }
  json(res, 404, { error: 'Not found' });
});
server.listen(PORT, '0.0.0.0', () => console.log(`🌐 CeaserMD web portal listening on ${PORT}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
