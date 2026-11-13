// Hudini support relay: a Cloudflare Worker that turns website/Telegram messages into tickets for the owner's Telegram bot.
// Plain fetch-handler. All storage goes through the KV binding (env.TICKETS in production, env.KV in tests), all network
// access goes to ONE constant host (api.telegram.org). The worker never fetches a URL that comes from a request.
//
// KV layout (every key is built by the k* helpers below, which validate their argument first):
//   t:<id>        ticket (JSON)                         m:<tgMessageId> -> ticket id (reply routing)
//   c:<chatId>    latest ticket id of a Telegram author  rl:*  rate-limit counters   cap:<day>  daily ticket counter
//   upd           last processed Telegram update_id
// Environment: BOT_TOKEN, OWNER_CHAT_ID, WEBHOOK_SECRET, WEBHOOK_PATH_SECRET (secrets); SITE_ORIGIN, BOT_USERNAME, DAILY_CAP (vars).

const TTL = 30 * 24 * 3600;            // every ticket-related key expires 30 days after the last activity
const MAX_BODY = 32 * 1024;
const TG_LIMIT = 3900;                  // Telegram allows 4096; keep a margin
const MAX_USER_MSGS = 30;               // messages of the author per ticket (the first one counts)
const MAX_ALL_MSGS = 100;               // hard cap of all stored messages per ticket

const KINDS = ['bug', 'idea', 'lag', 'other'];
const ROLES = ['', 'streamer', 'moderator', 'none'];
const CONNS = ['', 'radmin', 'porthole', 'tailscale', 'zerotier', 'portforward', 'lan', 'other'];
const LANGS = ['', 'en', 'ru', 'uk', 'de'];
const OSES = ['', 'windows', 'linux', 'macos', 'other'];

// Strict shapes. Anything that goes into a KV key must match one of these first.
const ID_RE = /^[a-z2-7]{8}$/;                 // ticket id, 40 bits, base32
const SECRET_RE = /^[A-Za-z0-9_-]{32}$/;       // ticket secret: 24 random bytes (192 bit), base64url
const LINK_RE = /^[A-Za-z0-9_-]{22}$/;         // Telegram deep-link token: 16 random bytes (128 bit), base64url
const VERSION_RE = /^[A-Za-z0-9.+_ -]{0,40}$/;
const BOT_RE = /^[A-Za-z0-9_]{5,32}$/;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

// ---------- small helpers ----------
const enc = new TextEncoder();
const kv = env => env.KV || env.TICKETS;
const kt = id => { if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error('bad id'); return 't:' + id; };
const posInt = n => { if (!Number.isSafeInteger(n) || n <= 0) throw new Error('bad number'); return n; };
const km = n => 'm:' + posInt(n);
const kc = n => 'c:' + posInt(n);

function rand(n) { const b = new Uint8Array(n); crypto.getRandomValues(b); return b; }
const b64u = b => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function sha256(s) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
  return [...d].map(x => x.toString(16).padStart(2, '0')).join('');
}
// Constant-time string compare: always walks the longer length, no early exit.
function ctEq(a, b) {
  a = String(a); b = String(b);
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
async function newId(env) {
  for (let i = 0; i < 6; i++) {
    const id = [...rand(8)].map(x => ALPHABET[x % 32]).join('');   // 256 % 32 == 0: no modulo bias
    if (await kv(env).get(kt(id)) === null) return id;
  }
  throw new Error('no id');
}

// Text cleaning: line endings, control characters, zero-width and bidi-override characters out; unpaired surrogates fixed.
const STRIP = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤⁦-⁩﻿￹-￻]/g;
function clean(s, oneLine) {
  s = String(s);
  if (s.isWellFormed && !s.isWellFormed()) s = s.toWellFormed();
  s = s.replace(/\r\n?/g, '\n').replace(STRIP, '');
  if (oneLine) s = s.replace(/\s+/g, ' ');
  return s.trim();
}
// A field must be a string within [min,max] after cleaning, else null.
function field(v, min, max, oneLine) {
  if (typeof v !== 'string') return null;
  const s = clean(v, oneLine);
  return s.length >= min && s.length <= max ? s : null;
}

const today = () => new Date().toISOString().slice(0, 10);

// ---------- responses ----------
function headers(env, req, extra) {
  const h = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'cross-origin-resource-policy': 'same-site',
    ...extra,
  };
  // CORS only for the website. This is NOT authentication; it only tells browsers which page may read the answer.
  const origin = req && req.headers.get('origin');
  if (origin && env.SITE_ORIGIN && ctEq(origin, env.SITE_ORIGIN)) {
    h['access-control-allow-origin'] = env.SITE_ORIGIN;
    h['vary'] = 'Origin';
  }
  return h;
}
const json = (env, req, status, body, extra) => new Response(JSON.stringify(body), { status, headers: headers(env, req, extra) });
const err = (env, req, status, code) => json(env, req, status, { error: code });

// Reads the body from the stream and stops at MAX_BODY, whatever Content-Length says.
async function readBody(req) {
  const cl = req.headers.get('content-length');
  if (cl !== null && !(/^\d+$/.test(cl) && Number(cl) <= MAX_BODY)) return { tooBig: true };
  if (!req.body) return { text: '' };
  const reader = req.body.getReader(), parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BODY) { try { await reader.cancel(); } catch {} return { tooBig: true }; }
    parts.push(value);
  }
  const all = new Uint8Array(size); let o = 0;
  for (const p of parts) { all.set(p, o); o += p.length; }
  return { text: new TextDecoder('utf-8').decode(all) };
}
async function readJson(req) {
  const ct = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (ct !== 'application/json') return { bad: 415 };
  const b = await readBody(req);
  if (b.tooBig) return { bad: 413 };
  try {
    const v = JSON.parse(b.text);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { bad: 400 };
    return { v };
  } catch { return { bad: 400 }; }
}

// ---------- KV ----------
async function getJ(env, key) { const s = await kv(env).get(key); if (s === null || s === undefined) return null; try { return JSON.parse(s); } catch { return null; } }
const putJ = (env, key, v) => kv(env).put(key, JSON.stringify(v), { expirationTtl: TTL });

// Fixed-window counter. Best effort: KV is eventually consistent, so a burst can slip a little over the limit.
async function hit(env, key, limit, ttl) {
  const n = Number(await kv(env).get(key)) || 0;
  if (n >= limit) return false;
  await kv(env).put(key, String(n + 1), { expirationTtl: ttl });
  return true;
}
// Anonymous client id: hash of the IP with a secret + day salt. The raw IP is never stored or logged.
async function clientId(env, req) {
  const ip = req.headers.get('cf-connecting-ip') || 'unknown';
  return (await sha256(`${env.WEBHOOK_SECRET}|${today()}|${ip}`)).slice(0, 32);
}

// ---------- Telegram (plain text only: no parse_mode anywhere, so nothing a user writes is interpreted) ----------
async function tg(env, method, params) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params),
    });
    const j = await r.json();
    return j && j.ok ? (j.result === undefined ? true : j.result) : null;
  } catch { return null; }
}
async function send(env, chat, text, extra) {
  const r = await tg(env, 'sendMessage', { chat_id: chat, text: String(text).slice(0, 4096), disable_web_page_preview: true, ...extra });
  return r && Number.isSafeInteger(r.message_id) ? r.message_id : null;
}
const toOwner = (env, text, extra) => send(env, Number(env.OWNER_CHAT_ID), text, extra);
const keyboard = (id, status) => ({ inline_keyboard: [[status === 'closed'
  ? { text: '↩️ Открыть', callback_data: 'o:' + id }
  : { text: '✅ Закрыть', callback_data: 'c:' + id }]] });

// ---------- tickets ----------
const publicView = t => ({ id: t.id, status: t.status, kind: t.kind, created: t.created, messages: t.messages.map(m => ({ from: m.from, text: m.text, t: m.t })) });

async function remember(env, t, mid) {   // map a message in the owner chat to the ticket (reply routing)
  if (!mid) return;
  t.mids.push(mid);
  await kv(env).put(km(mid), t.id, { expirationTtl: TTL });
}

function header(t) {
  const meta = [t.version && 'v' + t.version, t.os, t.role && 'role: ' + t.role, t.connection && 'via: ' + t.connection].filter(Boolean).join(' | ');
  return `#${t.id} · ${t.kind} · ${t.lang || '?'} · ${t.source}\n` + (meta ? meta + '\n' : '') + (t.contact ? 'contact: ' + t.contact + '\n' : '') + '\n';
}

// Creates the ticket: the owner's Telegram message goes out FIRST; if it fails nothing is stored.
async function createTicket(env, f) {
  const now = Date.now(), id = await newId(env);
  const secret = b64u(rand(24)), link = b64u(rand(16));
  const t = {
    v: 1, id, kind: f.kind, role: f.role || '', connection: f.connection || '', version: f.version || '', os: f.os || '', lang: f.lang || '',
    contact: f.contact || '', source: f.source, status: 'open', created: now, updated: now,
    secretHash: await sha256(secret), linkHash: f.authorChatId ? null : await sha256(link),
    authorChatId: f.authorChatId || null, tgMsgId: 0, mids: [],
    messages: [{ from: 'user', text: f.text, t: now }],
  };
  const body = header(t) + f.text;
  const first = await toOwner(env, body.slice(0, TG_LIMIT), { reply_markup: keyboard(id, 'open') });
  if (!first) return null;
  t.tgMsgId = first; t.mids = [];
  await remember(env, t, first);
  const more = [];
  if (body.length > TG_LIMIT) more.push(body.slice(TG_LIMIT, 2 * TG_LIMIT));
  if (f.log) more.push(`log (last ${Math.min(f.log.length, 3500)} of ${f.log.length} chars):\n` + f.log.slice(-3500));
  for (const m of more) await remember(env, t, await toOwner(env, m, { reply_to_message_id: first }));
  await putJ(env, kt(id), t);
  return { id, secret, link };
}

// Author follow-up (site or Telegram): append, reopen, forward to the owner as a reply to the ticket message.
async function addUserMessage(env, t, text, via) {
  if (t.messages.filter(m => m.from === 'user').length >= MAX_USER_MSGS || t.messages.length >= MAX_ALL_MSGS) return false;
  t.messages.push({ from: 'user', text, t: Date.now() });
  t.updated = Date.now();
  const reopened = t.status !== 'open';
  t.status = 'open';
  await remember(env, t, await toOwner(env, `#${t.id} (${via})${reopened ? ' reopened' : ''}:\n${text}`, { reply_to_message_id: t.tgMsgId, reply_markup: reopened ? keyboard(t.id, 'open') : undefined }));
  await putJ(env, kt(t.id), t);
  return true;
}

// Daily circuit breaker for new tickets. The owner is told once per day.
async function underCap(env) {
  const cap = Math.max(1, Number(env.DAILY_CAP) || 500), key = 'cap:' + today();
  const n = Number(await kv(env).get(key)) || 0;
  if (n >= cap) {
    const nk = 'capn:' + today();
    if (await kv(env).get(nk) === null) {
      await kv(env).put(nk, '1', { expirationTtl: 2 * 86400 });
      await toOwner(env, `Daily ticket limit (${cap}) reached. New tickets are refused until tomorrow (UTC).`);
    }
    return false;
  }
  await kv(env).put(key, String(n + 1), { expirationTtl: 2 * 86400 });
  return true;
}

// Loads a ticket for the author. Unknown id, bad secret format and wrong secret all give the same null, and the hash is always
// computed and compared, so the work done does not tell the cases apart.
async function authTicket(env, req, id) {
  let secret = req.headers.get('x-ticket-secret');
  const a = req.headers.get('authorization');
  if (!secret && a && /^Bearer /i.test(a)) secret = a.slice(7).trim();
  const okShape = typeof secret === 'string' && SECRET_RE.test(secret);
  const idOk = typeof id === 'string' && ID_RE.test(id);
  const t = idOk ? await getJ(env, kt(id)) : null;
  const given = await sha256(okShape ? secret : 'x');
  const want = t ? t.secretHash : '0'.repeat(64);
  const match = ctEq(given, want);
  return t && okShape && match ? t : null;
}

// ---------- website API ----------
async function api(req, env, path) {
  if (!env.SITE_ORIGIN || !env.BOT_TOKEN || !env.OWNER_CHAT_ID || !env.WEBHOOK_SECRET) return err(env, req, 503, 'not_configured');
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') {
    if (!origin || !ctEq(origin, env.SITE_ORIGIN)) return err(env, req, 403, 'forbidden');
    return new Response(null, { status: 204, headers: { ...headers(env, req), 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-ticket-secret, authorization', 'access-control-max-age': '600' } });
  }
  if (!origin || !ctEq(origin, env.SITE_ORIGIN)) return err(env, req, 403, 'forbidden');
  const cid = await clientId(env, req);
  if (!await hit(env, `rl:g:${cid}:${Math.floor(Date.now() / 60000)}`, 30, 120)) return err(env, req, 429, 'rate_limited');

  if (path === '/api/ticket' && req.method === 'GET') {
    const t = await authTicket(env, req, new URL(req.url).searchParams.get('id'));
    return t ? json(env, req, 200, publicView(t)) : err(env, req, 404, 'not_found');
  }
  if (path === '/api/ticket' && req.method === 'POST') {
    const r = await readJson(req); if (r.bad) return err(env, req, r.bad, r.bad === 413 ? 'too_large' : r.bad === 415 ? 'json_only' : 'bad_request');
    const b = r.v;
    if (b.hp !== undefined && b.hp !== '') {   // honeypot: look successful, store and send nothing
      return json(env, req, 201, { id: [...rand(8)].map(x => ALPHABET[x % 32]).join(''), secret: b64u(rand(24)), tg: '' });
    }
    const kind = KINDS.includes(b.kind) ? b.kind : null;
    const text = field(b.text, 10, 4000, false);
    const opt = (v, list) => v === undefined || v === null ? '' : (list.includes(v) ? v : null);
    const role = opt(b.role, ROLES), connection = opt(b.connection, CONNS), lang = opt(b.lang, LANGS), os = opt(b.os, OSES);
    const version = b.version === undefined || b.version === null ? '' : (typeof b.version === 'string' && VERSION_RE.test(b.version) ? b.version : null);
    const contact = b.contact === undefined || b.contact === null || b.contact === '' ? '' : field(b.contact, 1, 200, true);
    const log = b.log === undefined || b.log === null || b.log === '' ? '' : field(b.log, 1, 20000, false);
    if ([kind, text, role, connection, lang, os, version, contact, log].includes(null)) return err(env, req, 400, 'invalid');
    if (!await hit(env, `rl:t:${cid}:${Math.floor(Date.now() / 3600000)}`, 5, 7200)) return err(env, req, 429, 'rate_limited');
    if (!await underCap(env)) return err(env, req, 429, 'busy');
    const made = await createTicket(env, { kind, text, role, connection, version, os, lang, contact, log, source: 'web' });
    if (!made) return err(env, req, 502, 'telegram_unavailable');
    const tgLink = BOT_RE.test(env.BOT_USERNAME || '') ? `https://t.me/${env.BOT_USERNAME}?start=${made.id}_${made.link}` : '';
    return json(env, req, 201, { id: made.id, secret: made.secret, tg: tgLink });
  }
  if (path === '/api/ticket/message' && req.method === 'POST') {
    const r = await readJson(req); if (r.bad) return err(env, req, r.bad, r.bad === 413 ? 'too_large' : r.bad === 415 ? 'json_only' : 'bad_request');
    const t = await authTicket(env, req, r.v.id);
    if (!t) return err(env, req, 404, 'not_found');
    const text = field(r.v.text, 1, 2000, false);
    if (!text) return err(env, req, 400, 'invalid');
    if (!await addUserMessage(env, t, text, 'site')) return err(env, req, 429, 'too_many_messages');
    return json(env, req, 200, publicView(t));
  }
  if (path === '/api/ticket' || path === '/api/ticket/message') return err(env, req, 405, 'method_not_allowed');
  return err(env, req, 404, 'not_found');
}

// ---------- Telegram webhook ----------
const isOwner = (env, from, chat) => chat && from && chat.type === 'private' && String(from.id) === String(env.OWNER_CHAT_ID) && String(chat.id) === String(env.OWNER_CHAT_ID);

async function webhook(req, env, ctx, secretInPath) {
  // Both the secret path and the secret header must match; every failure looks the same.
  const hdr = req.headers.get('x-telegram-bot-api-secret-token') || '';
  const okCfg = typeof env.WEBHOOK_PATH_SECRET === 'string' && env.WEBHOOK_PATH_SECRET.length >= 16 && typeof env.WEBHOOK_SECRET === 'string' && env.WEBHOOK_SECRET.length >= 16;
  const a = ctEq(secretInPath, env.WEBHOOK_PATH_SECRET || ''), b = ctEq(hdr, env.WEBHOOK_SECRET || '');
  if (req.method !== 'POST' || !okCfg || !(a && b)) return err(env, req, 404, 'not_found');
  const r = await readJson(req);
  if (r.bad) return err(env, req, r.bad === 413 ? 413 : 400, 'bad_request');
  const u = r.v;
  try {
    // Replay protection: update ids only grow.
    if (!Number.isSafeInteger(u.update_id)) return json(env, req, 200, {});
    const last = Number(await kv(env).get('upd')) || 0;
    if (u.update_id <= last) return json(env, req, 200, {});
    await kv(env).put('upd', String(u.update_id), { expirationTtl: TTL });
    if (u.callback_query) await onCallback(env, u.callback_query);
    else if (u.message) await onMessage(env, u.message);
  } catch (e) { console.error('update failed', e && e.name); }   // name only: never the content
  return json(env, req, 200, {});
}

async function onCallback(env, q) {
  const owner = Number(env.OWNER_CHAT_ID);
  const m = q && q.message;
  // Identity comes from Telegram's verified update (from.id and the chat of the message), never from the button data.
  if (!q || !m || !isOwner(env, q.from, m.chat)) { if (q && typeof q.id === 'string') await tg(env, 'answerCallbackQuery', { callback_query_id: q.id }); return; }
  const mt = typeof q.data === 'string' ? /^([co]):([a-z2-7]{8})$/.exec(q.data) : null;
  const t = mt ? await getJ(env, kt(mt[2])) : null;
  if (!t) { await tg(env, 'answerCallbackQuery', { callback_query_id: q.id, text: 'Ticket not found (expired?)' }); return; }
  t.status = mt[1] === 'c' ? 'closed' : 'open';
  t.updated = Date.now();
  await putJ(env, kt(t.id), t);
  await tg(env, 'answerCallbackQuery', { callback_query_id: q.id, text: t.status === 'closed' ? 'Closed' : 'Reopened' });
  if (Number.isSafeInteger(m.message_id)) await tg(env, 'editMessageReplyMarkup', { chat_id: owner, message_id: m.message_id, reply_markup: keyboard(t.id, t.status) });
}

async function onMessage(env, m) {
  if (!m.chat || !m.from || m.from.is_bot || typeof m.text !== 'string') {
    if (m.chat && m.chat.type === 'private' && !(m.from && m.from.is_bot) && Number.isSafeInteger(m.chat.id) && m.chat.id > 0 && !isOwner(env, m.from, m.chat)) await send(env, m.chat.id, 'Please send text only.');
    return;
  }
  if (isOwner(env, m.from, m.chat)) return ownerMessage(env, m);
  if (m.chat.type !== 'private' || m.chat.id !== m.from.id || !Number.isSafeInteger(m.chat.id) || m.chat.id <= 0) return;   // groups/channels are ignored
  return authorMessage(env, m);
}

const parseCmd = text => { const x = /^\/([A-Za-z]+)(?:@\w+)?(?:\s+([\s\S]*))?$/.exec(text); return x ? { cmd: x[1].toLowerCase(), arg: (x[2] || '').trim() } : null; };

const HELP = 'Reply to a ticket message to answer the author.\n/tickets  open tickets, newest first\n/t <id>  show a ticket\n/close <id>   /open <id>\n/delete <id>  delete a ticket for good\n/help';

async function ownerMessage(env, m) {
  const reply = text => send(env, Number(env.OWNER_CHAT_ID), text);
  const c = parseCmd(m.text);
  if (c) {
    const id = c.arg.split(/\s+/)[0];
    if (c.cmd === 'start' || c.cmd === 'help') return void await reply(HELP);
    if (c.cmd === 'tickets') return void await reply(await listOpen(env));
    if (['t', 'close', 'open', 'delete'].includes(c.cmd)) {
      if (!ID_RE.test(id)) return void await reply('Usage: /' + c.cmd + ' <id>');
      const t = await getJ(env, kt(id));
      if (!t) return void await reply('No such ticket (expired or deleted).');
      if (c.cmd === 't') return void await reply(describe(t));
      if (c.cmd === 'delete') { await deleteTicket(env, t); return void await reply(`#${id} deleted.`); }
      t.status = c.cmd === 'close' ? 'closed' : 'open'; t.updated = Date.now();
      await putJ(env, kt(id), t);
      return void await reply(`#${id} ${t.status}.`);
    }
    return void await reply(HELP);
  }
  // A plain reply to a ticket message: route to the ticket.
  const to = m.reply_to_message;
  if (!to || !Number.isSafeInteger(to.message_id) || to.message_id <= 0) return void await reply('Reply to a ticket message to answer it. /help');
  const id = await kv(env).get(km(to.message_id));
  const t = id && ID_RE.test(id) ? await getJ(env, kt(id)) : null;
  if (!t) return void await reply('This message does not belong to a live ticket.');
  const text = clean(m.text).slice(0, 3500);
  if (!text || t.messages.length >= MAX_ALL_MSGS) return;
  t.messages.push({ from: 'owner', text, t: Date.now() }); t.updated = Date.now();
  await putJ(env, kt(id), t);
  if (t.authorChatId && await send(env, t.authorChatId, `Reply to your report #${t.id}:\n\n${text}`)) await reply('Sent to the author in Telegram.');
  else await reply('Saved. The author sees it on the ticket page.');
}

function describe(t) {
  const lines = [header(t).trimEnd() + `\nstatus: ${t.status} · ${new Date(t.created).toISOString()}\n`];
  for (const x of t.messages) lines.push(`${x.from === 'owner' ? 'you' : 'author'}: ${x.text}`);
  const s = lines.join('\n');
  return s.length > TG_LIMIT ? '…' + s.slice(-TG_LIMIT) : s;
}
async function listOpen(env) {
  const rows = []; let cursor;
  for (let page = 0; page < 5; page++) {
    const l = await kv(env).list({ prefix: 't:', cursor });
    for (const k of l.keys) {
      const id = k.name.slice(2);
      if (!ID_RE.test(id)) continue;
      const t = await getJ(env, kt(id));
      if (t && t.status === 'open') rows.push(t);
    }
    if (l.list_complete) break;
    cursor = l.cursor;
  }
  rows.sort((a, b) => b.created - a.created);
  if (!rows.length) return 'No open tickets.';
  return rows.slice(0, 30).map(t => `#${t.id} [${t.kind}] ${t.messages[0].text.replace(/\s+/g, ' ').slice(0, 60)}`).join('\n') + (rows.length > 30 ? `\n… and ${rows.length - 30} more` : '');
}
async function deleteTicket(env, t) {
  const store = kv(env);
  for (const mid of t.mids || []) await store.delete(km(mid));
  if (t.authorChatId && await store.get(kc(t.authorChatId)) === t.id) await store.delete(kc(t.authorChatId));
  await store.delete(kt(t.id));
}

async function authorMessage(env, m) {
  const chat = m.chat.id, min = Math.floor(Date.now() / 60000);
  const say = text => send(env, chat, text);
  if (!await hit(env, `rl:c:${chat}:${min}`, 10, 120)) return;   // silent: do not feed a flood with answers
  const c = parseCmd(m.text);
  // /start <id>_<token>: link this chat to a ticket with the single-use link token
  if (c && c.cmd === 'start') {
    const x = /^([a-z2-7]{8})_([A-Za-z0-9_-]{22})$/.exec(c.arg);
    const t = x ? await getJ(env, kt(x[1])) : null;
    const ok = t && t.linkHash && ctEq(await sha256(x[2]), t.linkHash);
    if (!ok) return void await say(x ? 'This link is invalid, expired or was already used.' : 'Hi! Write your message here and it goes to the Hudini developer.');
    t.authorChatId = chat; t.linkHash = null; t.updated = Date.now();   // single use
    await putJ(env, kt(t.id), t);
    await kv(env).put(kc(chat), t.id, { expirationTtl: TTL });
    await toOwner(env, `#${t.id}: the author connected Telegram.`, { reply_to_message_id: t.tgMsgId });
    return void await say(`Linked: you will get replies to report #${t.id} here. Just write to continue.`);
  }
  if (c) return void await say('Write your message as plain text.');
  const text = field(m.text, 1, 2000, false);
  if (!text) return;
  const id = await kv(env).get(kc(chat));
  const t = id && ID_RE.test(id) ? await getJ(env, kt(id)) : null;
  if (t && t.authorChatId === chat) {
    if (!await addUserMessage(env, t, text, 'telegram')) await say('Too many messages in this ticket.');
    return;
  }
  // No ticket yet: a message to the bot opens one.
  if (!await hit(env, `rl:ct:${chat}:${Math.floor(Date.now() / 3600000)}`, 5, 7200)) return void await say('Too many new reports for now, try again later.');
  if (!await underCap(env)) return void await say('The support inbox is full today. Please try again tomorrow.');
  const made = await createTicket(env, { kind: 'other', text, source: 'telegram', authorChatId: chat });
  if (!made) return void await say('Could not deliver your message, please try again.');
  await kv(env).put(kc(chat), made.id, { expirationTtl: TTL });
  await say(`Thanks, report #${made.id} is received. Replies will arrive here.`);
}

// ---------- entry ----------
export default {
  async fetch(req, env, ctx) {
    try {
      const path = new URL(req.url).pathname;
      if (path.startsWith('/tg/')) return await webhook(req, env, ctx, path.slice(4));
      if (path.startsWith('/api/')) return await api(req, env, path);
      return err(env, req, 404, 'not_found');
    } catch (e) {
      console.error('request failed', e && e.name);
      return err(env, req, 500, 'server_error');
    }
  },
};
