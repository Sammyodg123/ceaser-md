const http = require('http');
const fs = require('fs');
const path = require('path');

// Loading index.js keeps the existing CEASERMD pairing logic as the single source of truth.
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

function json(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  res.end(data);
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
async function body(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}
function page() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#07111f"><title>${webConfig.title}</title><style>
:root{color-scheme:dark;--bg:#07111f;--panel:#0d1c2e;--line:#1e3852;--text:#edf7ff;--muted:#91a9bd;--cyan:#52e0ff;--blue:#6487ff;--green:#6df2b0}*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;background:radial-gradient(circle at 15% 0%,#123457 0,transparent 38%),radial-gradient(circle at 100% 15%,#1d2757 0,transparent 32%),var(--bg);color:var(--text);min-height:100vh}.wrap{max-width:1080px;margin:auto;padding:28px 20px 44px}.top{display:flex;justify-content:space-between;align-items:center;gap:16px}.brand{display:flex;align-items:center;gap:12px;font-weight:800;letter-spacing:.5px}.mark{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,var(--cyan),var(--blue));color:#06101d;font-weight:950;box-shadow:0 0 30px #52e0ff44}.pill{border:1px solid #6df2b033;background:#6df2b00d;color:var(--green);padding:8px 12px;border-radius:99px;font-size:13px}.hero{padding:74px 0 42px;max-width:760px}.eyebrow{color:var(--cyan);font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:2px}.hero h1{font-size:clamp(42px,7vw,78px);line-height:.98;margin:14px 0 20px;letter-spacing:-4px}.hero p{color:var(--muted);font-size:18px;line-height:1.65;max-width:680px}.grid{display:grid;grid-template-columns:1.15fr .85fr;gap:18px}.card{background:linear-gradient(145deg,#10263cdd,#091626dd);border:1px solid var(--line);border-radius:24px;padding:26px;box-shadow:0 20px 80px #0003;backdrop-filter:blur(14px)}.card h2{margin:0 0 9px;font-size:21px}.sub{color:var(--muted);line-height:1.5;margin:0 0 22px}.label{display:block;color:#b8d0e3;font-size:13px;margin:0 0 8px}.inputrow{display:flex;gap:10px}.inputrow input{flex:1;min-width:0}.input,button{font:inherit;border-radius:13px;padding:14px 15px;border:1px solid var(--line);background:#071522;color:var(--text);outline:none}.input:focus{border-color:var(--cyan);box-shadow:0 0 0 4px #52e0ff18}button{cursor:pointer;border:0;font-weight:800;background:linear-gradient(135deg,var(--cyan),var(--blue));color:#06101d;transition:.2s}button:hover{transform:translateY(-1px);filter:brightness(1.08)}button:disabled{opacity:.55;cursor:wait;transform:none}.result{display:none;margin-top:18px;padding:17px;border:1px solid #52e0ff55;background:#52e0ff0b;border-radius:16px}.code{font-size:30px;font-weight:900;letter-spacing:4px;color:var(--cyan);margin:8px 0}.error{color:#ff9b9b}.steps{display:grid;gap:14px}.step{display:flex;gap:13px;align-items:flex-start}.num{flex:0 0 30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#52e0ff18;color:var(--cyan);font-weight:800}.step b{display:block;margin-bottom:3px}.step span{color:var(--muted);font-size:14px;line-height:1.45}.contacts{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}.contact{display:inline-flex;text-decoration:none;color:var(--text);border:1px solid var(--line);padding:11px 14px;border-radius:12px;background:#ffffff06}.footer{color:#718ba0;font-size:13px;text-align:center;padding-top:30px}.dot{display:inline-block;width:7px;height:7px;background:var(--green);border-radius:50%;margin-right:6px;box-shadow:0 0 12px var(--green)}@media(max-width:760px){.grid{grid-template-columns:1fr}.hero{padding-top:54px}.hero h1{letter-spacing:-2.5px}.inputrow{flex-direction:column}.top{align-items:flex-start;flex-direction:column}}
</style></head><body><main class="wrap"><header class="top"><div class="brand"><div class="mark">C</div><div>CEASER<span style="color:var(--cyan)">MD</span></div></div><div class="pill"><i class="dot"></i><span id="status">Checking service…</span></div></header><section class="hero"><div class="eyebrow">WhatsApp pairing portal</div><h1>Link your WhatsApp to CeaserMD.</h1><p>A clean, fast pairing gateway for the CeaserMD multi-session bot. Enter your WhatsApp number with country code and receive the one-time code.</p></section><section class="grid"><div class="card"><h2>Generate pairing code</h2><p class="sub">Use digits only, including your country code. Example: <b>2347066248340</b></p><label class="label" for="phone">WhatsApp phone number</label><div class="inputrow"><input id="phone" class="input" inputmode="numeric" autocomplete="tel" placeholder="234XXXXXXXXXX"><button id="pair">Get code</button></div><div id="result" class="result"></div></div><div class="card"><h2>How to link</h2><div class="steps"><div class="step"><div class="num">1</div><div><b>Open WhatsApp</b><span>Go to Settings → Linked devices.</span></div></div><div class="step"><div class="num">2</div><div><b>Choose phone-number linking</b><span>Tap “Link with phone number instead”.</span></div></div><div class="step"><div class="num">3</div><div><b>Enter the code</b><span>Type the code shown here before it expires.</span></div></div></div><div class="contacts"><a class="contact" href="${WHATSAPP_URL}" target="_blank" rel="noopener">WhatsApp owner</a><a class="contact" href="${TELEGRAM_URL}" target="_blank" rel="noopener">Telegram owner</a></div></div></section><div class="footer">${webConfig.brand} · Custom pairing: <b>CEASERMD</b> · <span id="uptime"></span></div></main><script>
const $=id=>document.getElementById(id);async function health(){try{const r=await fetch('/api/health');const j=await r.json();$('status').textContent=j.status==='ok'?'Online':'Degraded';$('uptime').textContent='Online for '+j.uptime}catch(e){$('status').textContent='Offline'}}health();setInterval(health,15000);$('pair').onclick=async()=>{const phone=$('phone').value.replace(/\\D/g,'');const out=$('result');out.style.display='block';out.className='result';out.innerHTML='Requesting a secure code…';$('pair').disabled=true;try{const r=await fetch('/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Pairing failed');out.innerHTML='<div>Pairing code</div><div class="code">'+j.displayCode+'</div><div>Enter it in WhatsApp. It expires in about 3 minutes.</div>'}catch(e){out.className='result error';out.textContent=e.message}finally{$('pair').disabled=false}};
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
    const data = await body(req); const phone = cleanPhone(data.phone);
    if (!/^\d{10,15}$/.test(phone)) return json(res, 400, { error: 'Enter a valid phone number with country code.' });
    attempts.get(ip).push(Date.now());
    if (activePairs.has(phone)) return json(res, 409, { error: 'A pairing request for this number is already active.' });
    activePairs.set(phone, Date.now());
    try { const result = await bot.requestPairing(phone); return json(res, 200, { code: result.code, displayCode: result.displayCode, sessionName: result.sessionName, isCustom: result.isCustom }); }
    catch (e) { return json(res, 500, { error: e.message || 'Unable to generate a pairing code.' }); }
    finally { activePairs.delete(phone); }
  }
  json(res, 404, { error: 'Not found' });
});
function formatUptime(ms) { const s=Math.floor(ms/1000), d=Math.floor(s/86400), h=Math.floor(s%86400/3600), m=Math.floor(s%3600/60); return [d&&`${d}d`,h&&`${h}h`,m&&`${m}m`].filter(Boolean).join(' ') || 'less than a minute'; }
server.listen(PORT, '0.0.0.0', () => console.log(`🌐 CeaserMD web portal listening on ${PORT}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
