const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { CONFIG, requestPairingWithCustomCode, globalActiveSockets, sessionEvents } = global.CeaserBot || require('./index.js');

console.log(`
 ██████╗███████╗ █████╗ ███████╗███████╗██████╗ ███╗   ███╗██████╗ 
██╔════╝██╔════╝██╔══██╗██╔════╝██╔════╝██╔══██╗████╗ ████║██╔══██╗
██║     █████╗  ███████║███████╗█████╗  ██████╔╝██╔████╔██║██║  ██║
██║     ██╔══╝  ██╔══██║╚════██║██╔══╝  ██╔══██╗██║╚██╔╝██║██║  ██║
╚██████╗███████╗██║  ██║███████║███████╗██║  ██║██║ ╚═╝ ██║██████╔╝
 ╚═════╝╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═════╝ 
         v3.0 • Pterodactyl FIXED • CEASERMD • WHATSAPP BOT • 111 CMDS
`);

if(!CONFIG.BOT_TOKEN || CONFIG.BOT_TOKEN==='' || CONFIG.BOT_TOKEN==='YOUR_TOKEN'){
  console.error("❌ BOT_TOKEN not set - Telegram disabled, waiting for sessions");
  setInterval(()=>{}, 10000);
} else {
  const bot = new Telegraf(CONFIG.BOT_TOKEN);

  // ===================================================================
  //  OWNER CONTACT + LIGHTWEIGHT JSON STORES
  // ===================================================================
  const OWNER_HANDLE = process.env.OWNER_TG_HANDLE || '@Lord_CeAser_Himself';
  const DATA_DIR = path.join(__dirname, 'tg-data');
  if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const USERS_FILE   = path.join(DATA_DIR, 'tg-users.json');     // every chat id that has /started the bot (for broadcast)
  const PAIRS_FILE    = path.join(DATA_DIR, 'tg-pairs.json');     // tgId -> [{ phone, sessionName, at }]  (3-pair cap)
  const REPORTS_FILE  = path.join(DATA_DIR, 'tg-reports.json');   // issue reports, newest last
  const MAX_PAIRS_PER_ACCOUNT = Number(process.env.MAX_PAIRS_PER_TG || 3);

  function loadJSON(f, d){ try{ return JSON.parse(fs.readFileSync(f, 'utf8')); }catch{ return d; } }
  function saveJSON(f, d){ try{ fs.writeFileSync(f, JSON.stringify(d)); }catch(e){ console.log('[tg-data save]', e.message); } }

  function rememberUser(ctx){
    const users = loadJSON(USERS_FILE, {});
    const id = String(ctx.from.id);
    if(!users[id]) users[id] = { id, username: ctx.from.username || null, name: ctx.from.first_name || '', since: Date.now() };
    else { users[id].username = ctx.from.username || users[id].username; users[id].name = ctx.from.first_name || users[id].name; }
    saveJSON(USERS_FILE, users);
  }
  function allUserIds(){ return Object.keys(loadJSON(USERS_FILE, {})); }

  function pairsFor(tgId){ const o = loadJSON(PAIRS_FILE, {}); return o[String(tgId)] || []; }
  function addPair(tgId, phone, sessionName){
    const o = loadJSON(PAIRS_FILE, {});
    const key = String(tgId);
    o[key] = [...(o[key] || []), { phone, sessionName, at: Date.now() }];
    saveJSON(PAIRS_FILE, o);
  }

  function addReport(ctx, text){
    const list = loadJSON(REPORTS_FILE, []);
    const r = { id: Date.now().toString(36), from: ctx.from.id, username: ctx.from.username || null, name: ctx.from.first_name || '', text, at: Date.now(), status: 'open' };
    list.push(r);
    saveJSON(REPORTS_FILE, list);
    return r;
  }

  const isOwnerTg = (ctx) => String(ctx.from?.id) === String(CONFIG.OWNER_TG_ID);

  // ===================================================================
  //  FORCE-JOIN  (CONFIG.REQUIRED_CHANNELS, e.g. @CeaserMD,@VantaLabs)
  // ===================================================================
  async function notJoinedChannels(ctx){
    const need = (CONFIG.REQUIRED_CHANNELS || []).map(x => String(x).trim()).filter(Boolean);
    const missing = [];
    for(const ch of need){
      try{
        const m = await ctx.telegram.getChatMember(ch, ctx.from.id);
        if(!['member', 'administrator', 'creator'].includes(m.status)) missing.push(ch);
      }catch(e){ /* bot not admin there, or private chat we can't check -> don't block on our own misconfig */ }
    }
    return missing;
  }
  function joinGateKeyboard(missing){
    const rows = missing.map(ch => [Markup.button.url(`📢 Join ${ch}`, `https://t.me/${String(ch).replace(/^@/, '')}`)]);
    rows.push([Markup.button.callback("✅ I've joined - Verify", 'verify_join')]);
    return Markup.inlineKeyboard(rows);
  }
  const JOIN_GATE_TEXT = (missing) => `<blockquote>🔒 <b>ONE QUICK STEP</b>

To unlock ${CONFIG.BOT_NAME}, join ${missing.length > 1 ? 'these channels' : 'this channel'} first, then tap verify 👇

${missing.map(c => `• ${c}`).join('\n')}</blockquote>`;

  async function requireJoin(ctx){
    const missing = await notJoinedChannels(ctx);
    if(missing.length){ await ctx.reply(JOIN_GATE_TEXT(missing), { parse_mode: 'HTML', ...joinGateKeyboard(missing) }); return false; }
    return true;
  }

  bot.action('verify_join', async (ctx)=>{
    const missing = await notJoinedChannels(ctx);
    if(missing.length){ await ctx.answerCbQuery('Still missing one or more ❌', { show_alert: true }); return; }
    await ctx.answerCbQuery('✅ Verified — welcome in!');
    rememberUser(ctx);
    await quotedReply(ctx, Templates.welcomeBot(ctx), { withImage: true, ...mainKeyboard(ctx) });
  });

  // Small helper to right-pad labels so the plain-text "table" lines up
  // inside a <pre> block (Telegram has no real HTML table support).
  const row = (a, b, w = 15) => `${String(a).padEnd(w)} ${b}`;
  const dateHeader = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const bar = (n=28) => '◈'.repeat(n);

  const Templates = {
    welcomeBot: (ctx) => {
      const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
      const botName = CONFIG.BOT_NAME;
      const active = globalActiveSockets ? globalActiveSockets.size : 0;
      const myPairs = pairsFor(ctx.from.id).length;

      return `<blockquote>🔮 <b>${dateHeader()}</b> ${bar(10)}

✨ <b>${botName} // CONTROL DECK</b> ✨

👋 Welcome aboard, ${username}. Your mini command center for ${botName} lives right here in Telegram.

📡 <b>SYSTEM STATUS</b> · Mode: <code>Free</code> · Sessions live: <code>${active}</code>
🔗 <b>Your pairs:</b> <code>${myPairs}/${MAX_PAIRS_PER_ACCOUNT}</code>

<pre>${row('MODULE', 'STATUS')}
${row('DM Commands', '🟢 Included')}
${row('Group Commands', '🟢 Included')}
${row('Access Mode', '🆓 Free')}</pre>
</blockquote>

<blockquote>🎁 <b>QUICK ACCESS</b>
<i>Stay close for updates, releases, and service notices.</i>

🔗 Your referral link:
<code>https://t.me/${ctx.botInfo?.username || 'Ceaserbot'}?start=${ctx.from.id}</code>

🛟 Need help? Talk to the owner: ${OWNER_HANDLE}
</blockquote>

<blockquote><i>${botName} // Crafted by ${OWNER_HANDLE} · v3.0</i></blockquote>`;
    },

    pairingAsk: `<blockquote>📲 <b>WHATSAPP PAIRING // REQUEST</b> ${bar(6)}

Send your WhatsApp number with country code — no <code>+</code>, no spaces.

<b>Example:</b> <code>2347066248340</code>

<pre>${row('Custom code', 'CEASERMD')}
${row('Displays as', 'CEAS-ERMD')}</pre>

<i>If CEASERMD fails to link, the bot auto-falls back to a random code (e.g. ZEF4-AK24), which always works.</i>
</blockquote>`,

    pairingLimit: (n) => `<blockquote>🚫 <b>PAIR LIMIT REACHED</b>

You've already linked <code>${n}/${MAX_PAIRS_PER_ACCOUNT}</code> WhatsApp numbers from this Telegram account.

Need more? Message the owner: ${OWNER_HANDLE}
</blockquote>`,

    pairingInitiated: (phone) => `<blockquote>⏳ <b>WHATSAPP PAIRING // INITIATED</b>

<pre>${row('Phone', phone)}
${row('Code', 'Generating CEASERMD…')}
${row('Wait', '~6 seconds')}</pre>
</blockquote>`,

    pairingSuccess: (sessionName, phone, code, displayCode) => `<blockquote>🎉 <b>${CONFIG.BOT_NAME} // CONTROL DECK</b>
✅ <b>ONLINE — WhatsApp linked successfully</b>

<pre>${row('Session', sessionName)}
${row('Phone', phone)}
${row('Status', 'linked')}</pre>

🔑 <b>Code:</b> <code>${displayCode}</code>

<b>HOW TO PAIR</b>
1️⃣ Open WhatsApp
2️⃣ Settings → Linked Devices
3️⃣ Link a Device → Link with phone number
4️⃣ Enter: <code>${displayCode}</code>

<i>Expires in 60 seconds.</i>
</blockquote>

<blockquote>🧬 <b>CEASERMD CUSTOM</b>

<pre>${row('Code', code)}
${row('Display', displayCode)}
${row('Bot', 'WhatsApp · 111 cmds')}
${row('Baileys', 'lordceaser-baileys')}
${row('Pterodactyl', 'FIXED')}</pre>

<i>If the code says "Couldn't link device":</i>
• The custom code may have expired — run /pair again
• The bot will auto-fallback to a random code
• Random codes always work
• Double-check the number you entered: <code>${phone}</code>
</blockquote>`,

    pairingFailed: (error) => `<blockquote>💥 <b>WHATSAPP PAIRING // FAILED</b>
❌ Error: <code>${error}</code>

<b>Fix</b>
• Wait 10 seconds
• Run /pair ${'<number>'} again
• Clear any stuck session folder for that number
• The bot will auto-fallback to a random code

<i>Pairing logic: custom CEASERMD → fallback random (e.g. ZEF4-AK24) → always works.</i>
</blockquote>`,

    help: `<blockquote>📖 <b>${CONFIG.BOT_NAME} // COMMAND INDEX</b> ${bar(6)}

<pre>${row('Bot', CONFIG.BOT_NAME)}
${row('Owner', CONFIG.OWNER_NAME)}
${row('Baileys', 'lordceaser-baileys 2.0.58')}
${row('Commands', '111 · WhatsApp')}</pre>

<b>🤖 Telegram Commands</b>
• /start — Control Deck
• /pair [number] — Link WhatsApp with CEASERMD
• /mysessions — Your linked numbers
• /report — Flag a bug or issue to the owner
• /gstatus — Group status
• /menu — All 111 WhatsApp commands

<b>📲 WhatsApp Commands (111)</b>
• ${CONFIG.PREFIX}menu — Menu
• ${CONFIG.PREFIX}ping, alive, owner
• ${CONFIG.PREFIX}kick, add, promote, tagall
• ${CONFIG.PREFIX}antilink, antibot, welcome, etc.

🔐 Custom pairing: CEASERMD (8 chars) → CEAS-ERMD
🌐 Channel: ${CONFIG.CHANNEL_LINK}
👑 Owner: ${OWNER_HANDLE}
</blockquote>`,

    account: `<blockquote>👤 <b>ACCOUNT</b>

<pre>${row('Owner', CONFIG.OWNER_NAME)}
${row('Bot', CONFIG.BOT_NAME)}
${row('Prefix', CONFIG.PREFIX)}</pre>
</blockquote>`,

    accessControl: `<blockquote>🔐 <b>ACCESS CONTROL</b>

<pre>${row('Pairing', 'CEASERMD custom code')}
${row('Fallback', 'Random code')}
${row('Code expiry', '60 seconds')}
${row('Pair limit', MAX_PAIRS_PER_ACCOUNT + ' per TG account')}</pre>

<i>Use /pair to start a new pairing request at any time.</i>
</blockquote>`,

    resources: `<blockquote>📚 <b>RESOURCES</b>

• 🌐 Channel: ${CONFIG.CHANNEL_LINK}
• 📖 Command Index: /help
• 🔗 Pairing: /pair
• 🚩 Report an issue: /report
• 👑 Owner: ${OWNER_HANDLE}
</blockquote>`,

    reportAsk: `<blockquote>🚩 <b>REPORT AN ISSUE</b>

Describe the bug or problem in one message — screenshots can't be attached here, just type it out.

<i>Example: "gstatus fails with a timeout on my session"</i>
</blockquote>`,

    reportSent: (id) => `<blockquote>✅ <b>REPORT RECEIVED</b> · <code>#${id}</code>

Thanks — it's been sent to ${OWNER_HANDLE}. You'll be contacted if they need more details.
</blockquote>`,

    reportToOwner: (r) => `<blockquote>🚩 <b>NEW REPORT</b> · <code>#${r.id}</code>

<pre>${row('From', (r.username ? '@' + r.username : r.name) || r.from)}
${row('TG ID', r.from)}
${row('Time', new Date(r.at).toLocaleString())}</pre>

💬 ${r.text}
</blockquote>`,

    mySessions: (list) => list.length
      ? `<blockquote>📱 <b>YOUR PAIRED NUMBERS</b> (${list.length}/${MAX_PAIRS_PER_ACCOUNT})

${list.map((p, i) => `${i + 1}. <code>${p.phone}</code> — ${new Date(p.at).toLocaleDateString()}`).join('\n')}
</blockquote>`
      : `<blockquote>📭 You haven't paired a WhatsApp number yet.\nUse /pair to link one.</blockquote>`,

    stats: () => `<blockquote>📊 <b>${CONFIG.BOT_NAME} // LIVE STATS</b>

<pre>${row('Sessions live', globalActiveSockets.size)}
${row('TG users', allUserIds().length)}
${row('Open reports', loadJSON(REPORTS_FILE, []).filter(r => r.status === 'open').length)}
${row('Pair cap', MAX_PAIRS_PER_ACCOUNT + '/account')}</pre>
</blockquote>`,

    broadcastAsk: `<blockquote>📣 <b>OWNER BROADCAST</b>

Send the message you want delivered to every Telegram user who has used this bot. Plain text or basic HTML (&lt;b&gt;, &lt;i&gt;, &lt;code&gt;) is fine.
</blockquote>`,

    broadcastDone: (ok, total) => `<blockquote>✅ <b>BROADCAST SENT</b>

<pre>${row('Delivered', ok)}
${row('Total users', total)}</pre>
</blockquote>`
  };

  function mainKeyboard(ctx){
    const rows = [
      [Markup.button.url('📢 Join Channel ↗', CONFIG.CHANNEL_LINK), Markup.button.callback('🔄 Refresh Deck', 'refresh_deck')],
      [Markup.button.callback('🔗 Pair WhatsApp', 'pair_start'), Markup.button.callback('📖 Command Index', 'help')],
      [Markup.button.callback('📱 My Sessions', 'my_sessions'), Markup.button.callback('🚩 Report Issue', 'report_start')],
      [Markup.button.callback('▾ ACCOUNT', 'show_account'), Markup.button.callback('▾ ACCESS CONTROL', 'show_access')],
      [Markup.button.callback('▾ RESOURCES', 'show_resources')]
    ];
    if(isOwnerTg(ctx)) rows.push([Markup.button.callback('📣 Broadcast (Owner)', 'broadcast_start'), Markup.button.callback('📊 Stats (Owner)', 'owner_stats')]);
    return Markup.inlineKeyboard(rows);
  }

  // TRUE QUOTED TELEGRAM DESIGN - reply_to_message_id + blockquote
  async function quotedReply(ctx, text, extra={}){
    const baseExtra = {
      parse_mode: 'HTML',
      ...extra,
      reply_to_message_id: ctx.message?.message_id,
      allow_sending_without_reply: true
    };
    if(extra.withImage && CONFIG.TG_IMAGE){
      try {
        return await ctx.replyWithPhoto(CONFIG.TG_IMAGE, {
          caption: text,
          parse_mode: 'HTML',
          ...extra,
          reply_to_message_id: ctx.message?.message_id
        });
      } catch(e){}
    }
    return await ctx.reply(text, baseExtra);
  }

  bot.use(async (ctx, next)=>{
    console.log(`📩 [TG] @${ctx.from?.username || ctx.from?.first_name} → ${ctx.message?.text || 'non-text'}`);
    await next();
  });

  bot.start(async (ctx)=>{
    try {
      if(!(await requireJoin(ctx))) return;
      rememberUser(ctx);
      const text = Templates.welcomeBot(ctx);
      await quotedReply(ctx, text, { withImage: true, ...mainKeyboard(ctx) });
    } catch(e){ console.error("Error /start:", e); }
  });

  bot.command('help', async (ctx)=>{
    if(!(await requireJoin(ctx))) return;
    rememberUser(ctx);
    await quotedReply(ctx, Templates.help);
  });

  // ===================================================================
  //  PAIRING  (now capped at MAX_PAIRS_PER_ACCOUNT per Telegram account)
  // ===================================================================
  const waitingForPhone = new Map();
  const waitingForReport = new Map();
  const waitingForBroadcast = new Map();

  bot.command('pair', async (ctx)=>{
    try {
      if(!(await requireJoin(ctx))) return;
      rememberUser(ctx);
      const have = pairsFor(ctx.from.id).length;
      if(have >= MAX_PAIRS_PER_ACCOUNT) return await quotedReply(ctx, Templates.pairingLimit(have));
      const args = ctx.message.text.split(' ').slice(1);
      let phone = args[0];
      if(!phone){
        await quotedReply(ctx, Templates.pairingAsk);
        waitingForPhone.set(ctx.from.id, true);
        return;
      }
      await handlePairing(ctx, phone);
    } catch(e){
      await quotedReply(ctx, Templates.pairingFailed(e.message));
    }
  });

  bot.command('mysessions', async (ctx)=>{
    rememberUser(ctx);
    await quotedReply(ctx, Templates.mySessions(pairsFor(ctx.from.id)));
  });
  bot.action('my_sessions', async (ctx)=>{
    await ctx.answerCbQuery();
    await quotedReply(ctx, Templates.mySessions(pairsFor(ctx.from.id)));
  });

  // ---- free-text router: phone number / report body / broadcast body ----
  bot.on('text', async (ctx)=>{
    const id = ctx.from.id;
    if(waitingForPhone.get(id)){
      const potentialPhone = ctx.message.text.trim().replace(/\D/g, '');
      if(!/^\d{10,15}$/.test(potentialPhone)) return;
      waitingForPhone.delete(id);
      const have = pairsFor(id).length;
      if(have >= MAX_PAIRS_PER_ACCOUNT) return await quotedReply(ctx, Templates.pairingLimit(have));
      return await handlePairing(ctx, potentialPhone);
    }
    if(waitingForReport.get(id)){
      waitingForReport.delete(id);
      const text = (ctx.message.text || '').trim().slice(0, 1000);
      if(!text) return;
      const r = addReport(ctx, text);
      await quotedReply(ctx, Templates.reportSent(r.id));
      if(CONFIG.OWNER_TG_ID){
        try{ await ctx.telegram.sendMessage(CONFIG.OWNER_TG_ID, Templates.reportToOwner(r), { parse_mode: 'HTML' }); }catch(e){ console.log('[report->owner]', e.message); }
      }
      return;
    }
    if(waitingForBroadcast.get(id) && isOwnerTg(ctx)){
      waitingForBroadcast.delete(id);
      const text = ctx.message.html_text || ctx.message.text || '';
      const ids = allUserIds();
      let ok = 0;
      await quotedReply(ctx, `<blockquote>📣 Sending to ${ids.length} users…</blockquote>`);
      for(const uid of ids){
        try{ await ctx.telegram.sendMessage(uid, `<blockquote>📣 <b>ANNOUNCEMENT</b>\n\n${text}</blockquote>`, { parse_mode: 'HTML' }); ok++; }catch(e){}
        await new Promise(r => setTimeout(r, 120));
      }
      await quotedReply(ctx, Templates.broadcastDone(ok, ids.length));
      return;
    }
  });

  async function handlePairing(ctx, phone){
    phone = phone.replace(/\D/g, '');
    if(!/^\d{10,15}$/.test(phone)){
      return await quotedReply(ctx, "<blockquote>❌ Invalid number — Example: <code>2347066248340</code></blockquote>");
    }
    const statusMsg = await quotedReply(ctx, Templates.pairingInitiated(phone));
    try {
      const { code, displayCode, sessionName } = await requestPairingWithCustomCode(phone);
      addPair(ctx.from.id, phone, sessionName);
      sessionEvents.once(`linked:${sessionName}`, ()=>{
        ctx.telegram.sendMessage(ctx.chat.id, `<blockquote>✅ <b>WhatsApp linked!</b>\n📱 <code>${phone}</code>\nBot is online - send <code>${CONFIG.PREFIX}menu</code> on WhatsApp.</blockquote>`, { parse_mode: 'HTML' }).catch(()=>{});
      });
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        null,
        Templates.pairingSuccess(sessionName, phone, code, displayCode),
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.url('📢 Join Channel', CONFIG.CHANNEL_LINK)],
            [Markup.button.callback('🔄 Pair Again', 'pair_start')]
          ])
        }
      );
    } catch(e){
      let msg = e.message;
      if(msg.includes('Connection Closed')) msg = 'Connection Closed - Wait 10s';
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        null,
        Templates.pairingFailed(msg),
        { parse_mode: 'HTML' }
      ).catch(()=>{});
    }
  }

  bot.action('pair_start', async (ctx)=>{
    await ctx.answerCbQuery();
    if(!(await requireJoin(ctx))) return;
    const have = pairsFor(ctx.from.id).length;
    if(have >= MAX_PAIRS_PER_ACCOUNT) return await quotedReply(ctx, Templates.pairingLimit(have));
    await quotedReply(ctx, Templates.pairingAsk);
    waitingForPhone.set(ctx.from.id, true);
  });

  bot.action('help', async (ctx)=>{
    await ctx.answerCbQuery();
    await quotedReply(ctx, Templates.help);
  });

  bot.action('refresh_deck', async (ctx)=>{
    await ctx.answerCbQuery('Refreshed');
    await quotedReply(ctx, Templates.welcomeBot(ctx), mainKeyboard(ctx));
  });

  bot.action('show_account', async (ctx)=>{ await ctx.answerCbQuery(); await quotedReply(ctx, Templates.account); });
  bot.action('show_access', async (ctx)=>{ await ctx.answerCbQuery(); await quotedReply(ctx, Templates.accessControl); });
  bot.action('show_resources', async (ctx)=>{ await ctx.answerCbQuery(); await quotedReply(ctx, Templates.resources); });

  // ===================================================================
  //  REPORT A PROBLEM
  // ===================================================================
  bot.command('report', async (ctx)=>{
    rememberUser(ctx);
    const inline = ctx.message.text.split(' ').slice(1).join(' ').trim();
    if(inline){
      const r = addReport(ctx, inline.slice(0, 1000));
      await quotedReply(ctx, Templates.reportSent(r.id));
      if(CONFIG.OWNER_TG_ID){
        try{ await ctx.telegram.sendMessage(CONFIG.OWNER_TG_ID, Templates.reportToOwner(r), { parse_mode: 'HTML' }); }catch(e){}
      }
      return;
    }
    await quotedReply(ctx, Templates.reportAsk);
    waitingForReport.set(ctx.from.id, true);
  });
  bot.action('report_start', async (ctx)=>{
    await ctx.answerCbQuery();
    await quotedReply(ctx, Templates.reportAsk);
    waitingForReport.set(ctx.from.id, true);
  });

  // ===================================================================
  //  OWNER-ONLY: BROADCAST + STATS
  // ===================================================================
  bot.command('broadcast', async (ctx)=>{
    if(!isOwnerTg(ctx)) return await quotedReply(ctx, '<blockquote>⛔ Owner only.</blockquote>');
    const inline = ctx.message.text.split(' ').slice(1).join(' ').trim();
    if(inline){
      const ids = allUserIds();
      let ok = 0;
      for(const uid of ids){
        try{ await ctx.telegram.sendMessage(uid, `<blockquote>📣 <b>ANNOUNCEMENT</b>\n\n${inline}</blockquote>`, { parse_mode: 'HTML' }); ok++; }catch(e){}
        await new Promise(r => setTimeout(r, 120));
      }
      return await quotedReply(ctx, Templates.broadcastDone(ok, ids.length));
    }
    await quotedReply(ctx, Templates.broadcastAsk);
    waitingForBroadcast.set(ctx.from.id, true);
  });
  bot.action('broadcast_start', async (ctx)=>{
    if(!isOwnerTg(ctx)) return await ctx.answerCbQuery('Owner only ⛔', { show_alert: true });
    await ctx.answerCbQuery();
    await quotedReply(ctx, Templates.broadcastAsk);
    waitingForBroadcast.set(ctx.from.id, true);
  });

  bot.command('stats', async (ctx)=>{
    if(!isOwnerTg(ctx)) return await quotedReply(ctx, '<blockquote>⛔ Owner only.</blockquote>');
    await quotedReply(ctx, Templates.stats());
  });
  bot.action('owner_stats', async (ctx)=>{
    if(!isOwnerTg(ctx)) return await ctx.answerCbQuery('Owner only ⛔', { show_alert: true });
    await ctx.answerCbQuery();
    await quotedReply(ctx, Templates.stats());
  });

  bot.command('gstatus', async (ctx)=>{
    const active = globalActiveSockets.size;
    if(active===0) return await quotedReply(ctx, "<blockquote>❌ No sessions - /pair first</blockquote>");
    await quotedReply(ctx, `<blockquote>✅ Sessions: ${active} - Use WA: ${CONFIG.PREFIX}gstatus</blockquote>`);
  });

  bot.launch().then(async ()=>{
    console.log("✅ TELEGRAM READY - Ceaser WhatsApp Bot");
    console.log(`✅ CUSTOM PAIRING: CEASERMD (8 chars) -> CEAS-ERMD with fallback to random, capped at ${MAX_PAIRS_PER_ACCOUNT}/account`);
    console.log(`✅ Quoted design: reply_to_message_id + <blockquote> Control Deck layout v3`);
    console.log(`✅ Force-join: ${(CONFIG.REQUIRED_CHANNELS || []).join(', ') || 'none configured'}`);
    try {
      await bot.telegram.setMyCommands([
        { command: 'start', description: '✨ Open the control deck' },
        { command: 'pair', description: '🔗 Link a WhatsApp number' },
        { command: 'mysessions', description: '📱 See your paired numbers' },
        { command: 'help', description: '📖 Command index' },
        { command: 'report', description: '🚩 Report a bug/issue to the owner' },
        { command: 'gstatus', description: '📊 Group status info' }
      ]);
    } catch(e){ console.log('[setMyCommands]', e.message); }
  }).catch(e=> console.error("❌ Telegram failed:", e.message));

  process.once('SIGINT', ()=> bot.stop('SIGINT'));
  process.once('SIGTERM', ()=> bot.stop('SIGTERM'));
}
