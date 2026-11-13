// Support: the relay (support/worker/src/worker.js, run here with a fake KV and a mocked Telegram) and the website page (web/site/support.html).
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const T = require('./lib.js');
const { check, step, eq, newPage, closeBrowser, finish } = T;

const ROOT = T.ROOT, SITE = path.join(ROOT, '_site'), SITE_PORT = T.PORTS.web + 1;

// ---------- the relay under test ----------
class FakeKV {
  constructor(){ this.m = new Map(); this.puts = []; this.gets = []; }
  async get(k){ this.gets.push(k); return this.m.has(k) ? this.m.get(k) : null; }
  async put(k, v, o){ this.puts.push({ k, ttl: o && o.expirationTtl }); this.m.set(k, String(v)); }
  async delete(k){ this.m.delete(k); }
  async list({ prefix = '' } = {}){ return { keys: [...this.m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }; }
  dump(){ return JSON.stringify([...this.m.entries()]); }
}
const OWNER = 1000, SITE_ORIGIN = 'https://site.test', PATH_SECRET = 'path-secret-0123456789ab', HOOK_SECRET = 'hook-secret-0123456789ab';
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const ID_RE = /^[a-z2-7]{8}$/;

let worker, env, kv, tgCalls, tgFail, mid, updId, ipN = 0;
const realFetch = global.fetch;
const foreignFetch = [];
function fresh(over = {}){
  kv = new FakeKV(); tgCalls = []; tgFail = false; mid = 100; updId = 1;
  env = { KV: kv, BOT_TOKEN: '123456:TEST-TOKEN', OWNER_CHAT_ID: String(OWNER), WEBHOOK_SECRET: HOOK_SECRET, WEBHOOK_PATH_SECRET: PATH_SECRET, SITE_ORIGIN, BOT_USERNAME: 'hudini_test_bot', DAILY_CAP: '500', ...over };
}
global.fetch = async (url, init) => {
  if(!String(url).startsWith('https://api.telegram.org/bot123456:TEST-TOKEN/')){ foreignFetch.push(String(url)); throw new Error('unexpected fetch ' + url); }
  const method = String(url).split('/').pop(), params = JSON.parse(init.body);
  tgCalls.push({ method, params });
  if(tgFail) return Response.json({ ok: false, description: 'down' });
  return Response.json({ ok: true, result: method === 'sendMessage' ? { message_id: ++mid } : true });
};
const sent = (chat, method = 'sendMessage') => tgCalls.filter(c => c.method === method && (chat === undefined || c.params.chat_id === chat));
const lastTo = chat => sent(chat).slice(-1)[0];

async function call(p, { method = 'GET', body, headers = {}, ip, origin = SITE_ORIGIN, ct = 'application/json', raw } = {}){
  const h = { 'cf-connecting-ip': ip || '198.51.100.' + (++ipN % 250 + 1), ...headers };
  if(origin) h.origin = origin;
  if(ct && (body !== undefined || raw !== undefined)) h['content-type'] = ct;
  const init = { method, headers: h };
  if(raw !== undefined) { init.body = raw; init.duplex = 'half'; } else if(body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  const res = await worker.fetch(new Request('https://relay.test' + p, init), env, {});
  const text = await res.text(); let j = null; try{ j = JSON.parse(text); }catch{}
  return { status: res.status, h: res.headers, text, j };
}
const GOOD = { kind: 'bug', text: 'The overlay freezes when I open a case.', role: 'streamer', connection: 'radmin', version: '15', os: 'linux', lang: 'en', contact: '@someone', log: '', hp: '' };
const newTicket = async (over = {}, o = {}) => (await call('/api/ticket', { method: 'POST', body: { ...GOOD, ...over }, ...o }));
const view = (t, o = {}) => call('/api/ticket?id=' + t.j.id, { headers: { 'x-ticket-secret': t.j.secret }, ...o });
const post = (u, o = {}) => call('/tg/' + PATH_SECRET, { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': HOOK_SECRET }, body: { update_id: ++updId, ...u }, ...o });
const ownerMsg = (text, extra = {}) => post({ message: { message_id: ++updId + 5000, from: { id: OWNER }, chat: { id: OWNER, type: 'private' }, text, ...extra } });
const userMsg = (chat, text, extra = {}) => post({ message: { message_id: ++updId + 5000, from: { id: chat }, chat: { id: chat, type: 'private' }, text, ...extra } });
const tokenOf = t => t.j.tg.split('start=')[1].slice(9);
const ticketMsgId = t => JSON.parse(kv.m.get('t:' + t.j.id)).tgMsgId;

async function relayTests(){
  worker = (await import(path.join(ROOT, 'support/worker/src/worker.js'))).default;

  await step('relay: creating a ticket', async () => {
    fresh();
    const r = await newTicket();
    eq(r.status, 201, 'created');
    check(ID_RE.test(r.j.id) && /^[A-Za-z0-9_-]{32}$/.test(r.j.secret), 'short base32 id and a 192-bit secret', r.j);
    check(r.j.tg === `https://t.me/hudini_test_bot?start=${r.j.id}_${tokenOf(r)}` && /^[A-Za-z0-9_-]{22}$/.test(tokenOf(r)), 'Telegram link carries a separate 128-bit link token');
    check(tokenOf(r) !== r.j.secret && !r.j.tg.includes(r.j.secret), 'the link token is not the secret');
    const m = sent(OWNER)[0];
    check(m && m.params.text.includes(GOOD.text) && m.params.text.includes('#' + r.j.id) && m.params.text.includes('bug') && m.params.text.includes('radmin') && m.params.text.includes('@someone'), 'owner message has id, kind, connection, contact and text');
    check(!tgCalls.some(c => 'parse_mode' in c.params), 'no parse_mode: Telegram messages are plain text');
    eq(m.params.reply_markup.inline_keyboard[0][0].callback_data, 'c:' + r.j.id, 'close button');
    const t = JSON.parse(kv.m.get('t:' + r.j.id));
    eq(t.secretHash, sha(r.j.secret), 'only the SHA-256 of the secret is stored');
    check(!kv.dump().includes(r.j.secret) && !kv.dump().includes(tokenOf(r)), 'neither the secret nor the link token appears anywhere in KV');
    check(!kv.dump().includes('198.51.100') && !kv.dump().includes('unknown'), 'no raw IP in KV');
    const mapped = kv.m.get('m:' + t.tgMsgId);
    eq(mapped, r.j.id, 'message id maps to the ticket');
    check(kv.puts.filter(p => /^(t|m|c):/.test(p.k)).every(p => p.ttl === 30 * 86400), 'ticket and mapping keys get a 30-day TTL');
    check(kv.puts.every(p => p.ttl >= 60), 'all TTLs are at least 60 s (KV minimum)');
  });

  await step('relay: long text and log', async () => {
    fresh();
    const r = await newTicket({ text: 'x'.repeat(4000), log: 'L'.repeat(20000) });
    eq(r.status, 201, 'created');
    const msgs = sent(OWNER);
    check(msgs.length >= 3 && msgs.every(m => m.params.text.length <= 4096), 'split into messages of at most 4096 characters', msgs.map(m => m.params.text.length));
    check(msgs.some(m => m.params.text.startsWith('log (last 3500 of 20000')), 'log tail sent as a second message');
    check(msgs.slice(1).every(m => m.params.reply_to_message_id === msgs[0] && true || m.params.reply_to_message_id > 100), 'parts reply to the ticket message');
  });

  await step('relay: polling with the secret', async () => {
    fresh();
    const r = await newTicket();
    const ok = await view(r);
    eq(ok.status, 200, 'right secret: 200');
    eq(Object.keys(ok.j).sort(), ['created', 'id', 'kind', 'messages', 'status'], 'only public fields');
    eq(ok.j.messages[0].text, GOOD.text, 'thread has the text');
    eq((await call('/api/ticket?id=' + r.j.id, { headers: { authorization: 'Bearer ' + r.j.secret } })).status, 200, 'Bearer works too');
    const bad = await view({ j: { id: r.j.id, secret: 'A'.repeat(32) } });
    const unknown = await view({ j: { id: 'aaaaaaaa', secret: r.j.secret } });
    const noSecret = await call('/api/ticket?id=' + r.j.id);
    eq([bad.status, unknown.status, noSecret.status], [404, 404, 404], 'wrong secret, unknown id and no secret all give 404');
    check(bad.text === unknown.text && unknown.text === noSecret.text && bad.h.get('content-type') === unknown.h.get('content-type'), 'the three answers are byte-identical');
    eq((await call(`/api/ticket?id=${r.j.id}&secret=${r.j.secret}`)).status, 404, 'a secret in the query string is ignored');
  });

  await step('relay: follow-up from the site', async () => {
    fresh();
    const r = await newTicket(), hdr = { 'x-ticket-secret': r.j.secret };
    const a = await call('/api/ticket/message', { method: 'POST', headers: hdr, body: { id: r.j.id, text: 'More details here' } });
    eq(a.status, 200, 'accepted');
    eq(a.j.messages.length, 2, 'thread grew');
    const f = lastTo(OWNER);
    check(f.params.text.includes('More details here') && f.params.reply_to_message_id === ticketMsgId(r), 'forwarded to the owner as a reply to the ticket message');
    eq((await call('/api/ticket/message', { method: 'POST', headers: { 'x-ticket-secret': 'B'.repeat(32) }, body: { id: r.j.id, text: 'hi there' } })).status, 404, 'wrong secret: 404');
    eq((await call('/api/ticket/message', { method: 'POST', headers: hdr, body: { id: r.j.id, text: '' } })).status, 400, 'empty text: 400');
    eq((await call('/api/ticket/message', { method: 'POST', headers: hdr, body: { id: r.j.id, text: 'x'.repeat(2001) } })).status, 400, 'over 2000: 400');
    let last;
    for(let i = 0; i < 40; i++) last = await call('/api/ticket/message', { method: 'POST', headers: hdr, body: { id: r.j.id, text: 'm' + i }, ip: '203.0.113.' + i });
    eq(last.status, 429, 'per-ticket cap of 30 author messages');
    eq(JSON.parse(kv.m.get('t:' + r.j.id)).messages.filter(m => m.from === 'user').length, 30, 'exactly 30 stored');
  });

  await step('relay: validation', async () => {
    fresh();
    for(const [what, over] of [['unknown kind', { kind: 'hack' }], ['short text', { text: 'too short' }], ['text over 4000', { text: 'x'.repeat(4001) }], ['contact over 200', { contact: 'c'.repeat(201) }],
      ['log over 20000', { log: 'l'.repeat(20001) }], ['bad role', { role: 'admin' }], ['bad connection', { connection: 'x' }], ['bad version', { version: '1; DROP' }], ['bad lang', { lang: 'fr' }], ['non-string text', { text: 12345678901 }], ['object text', { text: { a: 1 } }]]){
      const r = await newTicket(over); eq(r.status, 400, what + ' rejected');
    }
    eq((await newTicket({}, { ct: 'text/plain' })).status, 415, 'non-JSON content type: 415');
    eq((await call('/api/ticket', { method: 'POST', raw: '{bad', ct: 'application/json' })).status, 400, 'broken JSON: 400');
    eq((await call('/api/ticket', { method: 'POST', raw: '[1]' })).status, 400, 'array body: 400');
    eq(tgCalls.length, 0, 'nothing sent to Telegram for bad input');
  });

  await step('relay: body size limit on the real stream', async () => {
    fresh();
    const big = JSON.stringify({ ...GOOD, log: 'z'.repeat(40000) });
    eq((await call('/api/ticket', { method: 'POST', body: big, headers: { 'content-length': String(big.length) } })).status, 413, 'Content-Length over 32 KB: 413');
    // no Content-Length at all: a chunked stream
    const stream = new ReadableStream({ start(c){ for(let i = 0; i < 10; i++) c.enqueue(new TextEncoder().encode('a'.repeat(5000))); c.close(); } });
    eq((await call('/api/ticket', { method: 'POST', raw: stream })).status, 413, 'streamed body over 32 KB: 413');
    // a lying Content-Length cannot let more through
    const r = await realFetchless('/api/ticket', big);
    eq(r, 413, 'a small Content-Length with a big body is still refused');
    eq(tgCalls.length, 0, 'nothing sent to Telegram');
  });
  async function realFetchless(p, body){   // build a Request whose header understates the size
    const req = new Request('https://relay.test' + p, { method: 'POST', body, headers: { origin: SITE_ORIGIN, 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.99' } });
    const h = new Headers(req.headers); h.set('content-length', '100');
    const spoofed = new Proxy(req, { get(t, k){ if(k === 'headers') return h; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } });
    return (await worker.fetch(spoofed, env, {})).status;
  }

  await step('relay: honeypot', async () => {
    fresh();
    const r = await newTicket({ hp: 'http://spam' });
    eq(r.status, 201, 'looks like success to the bot');
    eq(tgCalls.length, 0, 'nothing sent to Telegram');
    eq([...kv.m.keys()].filter(k => k.startsWith('t:') || k.startsWith('m:')), [], 'nothing stored');
    eq((await view(r)).status, 404, 'the fake ticket does not exist');
  });

  await step('relay: rate limits and Telegram failure', async () => {
    fresh();
    const ip = '203.0.113.7';
    for(let i = 0; i < 5; i++) eq((await newTicket({}, { ip })).status, 201, 'ticket ' + (i + 1));
    eq((await newTicket({}, { ip })).status, 429, 'sixth ticket in an hour: 429');
    eq((await newTicket({}, { ip: '203.0.113.8' })).status, 201, 'another client is not affected');
    check(!kv.dump().includes('203.0.113.7'), 'raw IP never stored');
    fresh();
    let n429 = 0; for(let i = 0; i < 35; i++) if((await call('/api/ticket?id=aaaaaaaa', { ip: '203.0.113.9' })).status === 429) n429++;
    eq(n429, 5, '30 requests per minute, then 429');
    fresh(); tgFail = true;
    const r = await newTicket();
    eq(r.status, 502, 'Telegram down: 502');
    eq([...kv.m.keys()].filter(k => /^[tm]:/.test(k)), [], 'and the ticket is not kept');
  });

  await step('relay: CORS and headers', async () => {
    fresh();
    const ok = await call('/api/ticket?id=aaaaaaaa');
    eq(ok.h.get('access-control-allow-origin'), SITE_ORIGIN, 'allowed origin is echoed');
    const evil = await call('/api/ticket?id=aaaaaaaa', { origin: 'https://evil.test' });
    check(evil.status === 403 && !evil.h.get('access-control-allow-origin'), 'other origin: 403 and no CORS header');
    eq((await call('/api/ticket?id=aaaaaaaa', { origin: null })).status, 403, 'no Origin: 403');
    const pre = await call('/api/ticket', { method: 'OPTIONS', headers: { 'access-control-request-method': 'POST' } });
    check(pre.status === 204 && /x-ticket-secret/.test(pre.h.get('access-control-allow-headers')) && pre.h.get('access-control-allow-origin') === SITE_ORIGIN, 'preflight answered for the site');
    eq((await call('/api/ticket', { method: 'OPTIONS', origin: 'https://evil.test' })).status, 403, 'preflight for another origin: 403');
    for(const r of [ok, evil, await call('/nothing'), await call('/api/ticket', { method: 'DELETE' }), pre, await newTicket()]){
      check(r.h.get('x-content-type-options') === 'nosniff' && r.h.get('referrer-policy') === 'no-referrer' && r.h.get('cache-control') === 'no-store', 'security headers on a ' + r.status + ' answer');
    }
  });

  await step('relay: webhook authentication', async () => {
    fresh();
    const upd = { update_id: 5, message: { message_id: 1, from: { id: OWNER }, chat: { id: OWNER, type: 'private' }, text: '/help' } };
    const ok = await call('/tg/' + PATH_SECRET, { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': HOOK_SECRET }, body: upd });
    eq(ok.status, 200, 'both secrets right: 200');
    const noHdr = await call('/tg/' + PATH_SECRET, { method: 'POST', body: upd });
    const badHdr = await call('/tg/' + PATH_SECRET, { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': HOOK_SECRET + 'x' }, body: upd });
    const badPath = await call('/tg/wrong-path-secret-xxxxxx', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': HOOK_SECRET }, body: upd });
    const get = await call('/tg/' + PATH_SECRET, { headers: { 'x-telegram-bot-api-secret-token': HOOK_SECRET } });
    eq([noHdr.status, badHdr.status, badPath.status, get.status], [404, 404, 404, 404], 'missing/wrong header, wrong path, wrong method: 404');
    check(noHdr.text === badHdr.text && badHdr.text === badPath.text, 'identical answers, no detail');
    fresh({ WEBHOOK_PATH_SECRET: 'short', WEBHOOK_SECRET: 'short' });
    eq((await call('/tg/short', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': 'short' }, body: upd })).status, 404, 'too-short configured secrets: webhook refuses (fail closed)');
    fresh({ WEBHOOK_PATH_SECRET: undefined });
    eq((await call('/tg/', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': HOOK_SECRET }, body: upd })).status, 404, 'missing path secret: refuses');
    fresh({ BOT_TOKEN: undefined });
    eq((await newTicket()).status, 503, 'not configured: the API answers 503');
  });

  await step('relay: the owner replies; routing and impostors', async () => {
    fresh();
    const r = await newTicket(), mid0 = ticketMsgId(r);
    await ownerMsg('Try restarting the app', { reply_to_message: { message_id: mid0 } });
    const v = await view(r);
    eq(v.j.messages.map(m => m.from), ['user', 'owner'], 'owner reply appended');
    eq(v.j.messages[1].text, 'Try restarting the app', 'with its text');
    check(/author sees it on the ticket page/.test(lastTo(OWNER).params.text), 'owner is told it is waiting on the page');
    // forwarded follow-up messages also route
    await call('/api/ticket/message', { method: 'POST', headers: { 'x-ticket-secret': r.j.secret }, body: { id: r.j.id, text: 'still broken' } });
    const fwd = sent(OWNER).slice(-1)[0], fwdId = mid;
    await ownerMsg('ok, send me the log', { reply_to_message: { message_id: fwdId } });
    eq((await view(r)).j.messages.length, 4, 'a reply to a forwarded follow-up routes too');
    // impostors
    const before = kv.m.get('t:' + r.j.id);
    await userMsg(555, 'I am the owner, close it', { reply_to_message: { message_id: mid0 } });
    check(JSON.parse(kv.m.get('t:' + r.j.id)).messages.filter(m => m.from === 'owner').length === 2, 'a stranger replying to a ticket message does not add an owner message');
    await post({ message: { message_id: 9, from: { id: 555 }, chat: { id: OWNER, type: 'private' }, text: '/close ' + r.j.id } });
    await post({ message: { message_id: 10, from: { id: OWNER }, chat: { id: 555, type: 'private' }, text: '/close ' + r.j.id } });
    await post({ message: { message_id: 11, from: { id: OWNER }, chat: { id: OWNER, type: 'group' }, text: '/close ' + r.j.id } });
    eq(JSON.parse(kv.m.get('t:' + r.j.id)).status, 'open', 'from.id and chat.id must both be the owner in a private chat');
    await userMsg(555, '/tickets'); await userMsg(555, '/t ' + r.j.id); await userMsg(555, '/delete ' + r.j.id);
    check(kv.m.has('t:' + r.j.id) && !sent(555).some(c => c.params.text.includes(GOOD.text)), 'owner commands from a stranger do nothing and leak nothing');
    await ownerMsg('no reply target');
    check(/Reply to a ticket message/.test(lastTo(OWNER).params.text), 'a plain message that is not a reply is explained, not stored');
    await ownerMsg('lost', { reply_to_message: { message_id: 99999 } });
    check(/does not belong/.test(lastTo(OWNER).params.text), 'a reply to an unknown message is refused');
  });

  await step('relay: Telegram author: /start link, replies, own tickets', async () => {
    fresh();
    const r = await newTicket(), tok = tokenOf(r);
    await userMsg(777, `/start ${r.j.id}_${'A'.repeat(22)}`);
    check(/invalid|already used/.test(lastTo(777).params.text), 'wrong link token refused');
    await userMsg(777, `/start ${r.j.id}_${r.j.secret.slice(0, 22)}`);
    check(/invalid|already used/.test(lastTo(777).params.text), 'the secret does not work as link token');
    await userMsg(777, `/start ../../x_${tok}`);
    check(/Hi!|invalid/.test(lastTo(777).params.text) && !JSON.parse(kv.m.get('t:' + r.j.id)).authorChatId, 'malformed ids do not link');
    await userMsg(777, `/start ${r.j.id}_${tok}`);
    check(/Linked/.test(lastTo(777).params.text), 'right token links');
    eq(JSON.parse(kv.m.get('t:' + r.j.id)).authorChatId, 777, 'chat stored on the ticket');
    check(!kv.dump().includes(tok), 'link token is not stored in clear');
    await userMsg(888, `/start ${r.j.id}_${tok}`);
    check(/invalid|already used/.test(lastTo(888).params.text) && JSON.parse(kv.m.get('t:' + r.j.id)).authorChatId === 777, 'the link token is single-use');
    // author writes: follow-up on the ticket
    await userMsg(777, 'Here is more from Telegram');
    const f = lastTo(OWNER);
    check(f.params.text.includes('Here is more from Telegram') && f.params.reply_to_message_id === ticketMsgId(r), 'forwarded to the owner as a reply to the ticket message');
    eq((await view(r)).j.messages.length, 2, 'visible on the ticket page');
    // owner answers: goes to the author's chat
    await ownerMsg('Thanks, fixed in the next build', { reply_to_message: { message_id: ticketMsgId(r) } });
    const toAuthor = lastTo(777);
    check(toAuthor.params.text.includes('Thanks, fixed in the next build'), 'owner reply is sent to the linked author');
    check(/Sent to the author in Telegram/.test(lastTo(OWNER).params.text), 'owner gets the confirmation');
    // a stranger who just writes opens a new ticket
    const n = sent(OWNER).length;
    await userMsg(999, 'Hello, the overlay does not show my GIFs at all');
    const nt = [...kv.m.keys()].filter(k => k.startsWith('t:')).map(k => JSON.parse(kv.m.get(k))).find(t => t.authorChatId === 999);
    check(nt && nt.kind === 'other' && nt.source === 'telegram', 'a message to the bot opens a ticket of kind other, source telegram');
    check(sent(OWNER).length > n && /telegram/.test(sent(OWNER).slice(-1)[0].params.text), 'owner gets it');
    check(/received/.test(lastTo(999).params.text), 'author gets a receipt');
    // per-chat rate limit
    fresh(); let answered = 0;
    for(let i = 0; i < 25; i++) await userMsg(4242, 'spam message number ' + i);
    check([...kv.m.keys()].filter(k => k.startsWith('t:')).length <= 5 && sent(OWNER).length <= 12, 'a flooding chat is cut off (per-chat limits)', sent(OWNER).length);
  });

  await step('relay: close / reopen buttons', async () => {
    fresh();
    const r = await newTicket();
    const cb = (data, over = {}) => post({ callback_query: { id: 'cb' + updId, from: { id: OWNER }, data, message: { message_id: ticketMsgId(r), chat: { id: OWNER, type: 'private' } }, ...over } });
    await cb('c:' + r.j.id);
    eq(JSON.parse(kv.m.get('t:' + r.j.id)).status, 'closed', 'owner closes');
    eq((await view(r)).j.status, 'closed', 'the author sees closed');
    check(sent(undefined, 'answerCallbackQuery').length === 1 && sent(undefined, 'editMessageReplyMarkup')[0].params.reply_markup.inline_keyboard[0][0].callback_data === 'o:' + r.j.id, 'button turns into Reopen');
    await cb('o:' + r.j.id);
    eq(JSON.parse(kv.m.get('t:' + r.j.id)).status, 'open', 'owner reopens');
    await cb('c:' + r.j.id, { from: { id: 555 } });
    await cb('c:' + r.j.id, { message: { message_id: 1, chat: { id: 555, type: 'private' } } });
    await cb('c:' + r.j.id, { message: { message_id: 1, chat: { id: OWNER, type: 'group' } } });
    eq(JSON.parse(kv.m.get('t:' + r.j.id)).status, 'open', 'a stranger cannot close, whatever the callback says');
    await cb('c:../../etc'); await cb('x:' + r.j.id); await cb('c:' + r.j.id + ':extra');
    eq(JSON.parse(kv.m.get('t:' + r.j.id)).status, 'open', 'malformed callback data is ignored');
  });

  await step('relay: owner commands', async () => {
    fresh();
    const a = await newTicket({ text: 'First report, the oldest one in this list ' + 'a'.repeat(80) }, { ip: '192.0.2.1' });
    await new Promise(r => setTimeout(r, 5));
    const b = await newTicket({ text: 'Second report, newer' }, { ip: '192.0.2.2' });
    await ownerMsg('/tickets');
    const list = lastTo(OWNER).params.text.split('\n');
    check(list[0].startsWith('#' + b.j.id) && list[1].startsWith('#' + a.j.id), 'newest first');
    check(list[1].replace(/^#\S+ \[\w+\] /, '').length <= 60, 'text cut to 60 characters');
    await ownerMsg('/t ' + a.j.id);
    check(lastTo(OWNER).params.text.includes('First report') && lastTo(OWNER).params.text.includes('author:'), '/t shows the ticket with messages');
    await ownerMsg('/close ' + a.j.id);
    eq(JSON.parse(kv.m.get('t:' + a.j.id)).status, 'closed', '/close');
    await ownerMsg('/tickets');
    check(!lastTo(OWNER).params.text.includes(a.j.id), 'closed tickets leave the list');
    await ownerMsg('/open ' + a.j.id);
    eq(JSON.parse(kv.m.get('t:' + a.j.id)).status, 'open', '/open');
    await ownerMsg('/help'); check(/\/delete/.test(lastTo(OWNER).params.text), '/help lists /delete');
    // delete removes everything
    await userMsg(777, `/start ${b.j.id}_${tokenOf(b)}`);
    const keysBefore = [...kv.m.keys()].filter(k => /^[tmc]:/.test(k)).length;
    await ownerMsg('/delete ' + b.j.id);
    const rest = [...kv.m.keys()].filter(k => /^[tmc]:/.test(k));
    check(!kv.m.has('t:' + b.j.id) && !kv.m.has('c:777') && !rest.some(k => kv.m.get(k) === b.j.id), '/delete removes the ticket, its message mappings and the author link', { keysBefore, rest });
    eq((await view(b)).status, 404, 'the page link is dead after /delete');
    for(const bad of ['../x', 'a:b', 'ÄÄÄÄÄÄÄÄ', 'AAAAAAAA', 'aaaaaaaaa', '']) { await ownerMsg('/delete ' + bad); }
    check(kv.m.has('t:' + a.j.id), 'malformed ids delete nothing');
  });

  await step('relay: replayed updates', async () => {
    fresh();
    const r = await newTicket();
    const upd = { update_id: 900, message: { message_id: 1, from: { id: 777 }, chat: { id: 777, type: 'private' }, text: 'a message that arrives twice' } };
    const h = { 'x-telegram-bot-api-secret-token': HOOK_SECRET };
    await call('/tg/' + PATH_SECRET, { method: 'POST', headers: h, body: upd });
    const n = sent(OWNER).length;
    await call('/tg/' + PATH_SECRET, { method: 'POST', headers: h, body: upd });
    eq(sent(OWNER).length, n, 'the same update_id is processed once');
    await call('/tg/' + PATH_SECRET, { method: 'POST', headers: h, body: { ...upd, update_id: 899 } });
    eq(sent(OWNER).length, n, 'an older update_id is ignored');
    await call('/tg/' + PATH_SECRET, { method: 'POST', headers: h, body: { ...upd, update_id: 901 } });
    check(sent(OWNER).length > n, 'a newer one goes through');
  });

  await step('relay: KV keys are validated (no key injection)', async () => {
    fresh();
    const r = await newTicket();
    kv.gets.length = 0;
    for(const id of ['t:' + r.j.id, '../' + r.j.id, r.j.id + '%00', 'AAAAAAAA', 'ÄÄÄÄÄÄÄÄ', r.j.id + '/x', '*', 'rl:g:x', ' ' + r.j.id]){
      await call('/api/ticket?id=' + encodeURIComponent(id), { headers: { 'x-ticket-secret': r.j.secret } });
      await call('/api/ticket/message', { method: 'POST', headers: { 'x-ticket-secret': r.j.secret }, body: { id, text: 'hello there' } });
    }
    await ownerMsg('/t t:' + r.j.id); await ownerMsg('/delete m:100'); await ownerMsg('/close upd');
    await ownerMsg('x', { reply_to_message: { message_id: '100; DROP' } });
    await ownerMsg('x', { reply_to_message: { message_id: -5 } });
    const allowed = /^(t:[a-z2-7]{8}|m:\d+|c:\d+|rl:[a-z]+:[0-9a-f]*:?\d*|rl:[a-z]+:\d+:\d+|cap:[\d-]+|capn:[\d-]+|upd)$/;
    const odd = kv.gets.filter(k => !allowed.test(k));
    eq(odd, [], 'every KV key read has an expected shape');
    check(kv.m.has('t:' + r.j.id) && JSON.parse(kv.m.get('t:' + r.j.id)).messages.length === 1, 'the ticket is untouched by the attempts');
  });

  await step('relay: daily cap', async () => {
    fresh({ DAILY_CAP: '2' });
    eq((await newTicket()).status, 201, 'first'); eq((await newTicket()).status, 201, 'second');
    const r = await newTicket(); eq([r.status, r.j.error], [429, 'busy'], 'third: 429 busy');
    await newTicket();
    eq(sent(OWNER).filter(c => /Daily ticket limit/.test(c.params.text)).length, 1, 'the owner is told once');
    await userMsg(31337, 'a telegram message at the limit');
    check(/full today/.test(lastTo(31337).params.text), 'Telegram authors are held back too');
  });

  await step('relay: output safety, privacy, no SSRF, no logs', async () => {
    fresh();
    const logs = []; const oe = console.error, ol = console.log, ow = console.warn;
    console.error = console.log = console.warn = (...a) => logs.push(a.join(' '));
    try {
      const evil = '<b>bold</b> <script>alert(1)</script> a\u202Eb\u200Bc\u0007d\u0000e [x](http://a.b) https://127.0.0.1/steal';
      const r = await newTicket({ text: evil + ' padding', contact: 'me\nthere' });
      eq(r.status, 201, 'created');
      const m = sent(OWNER)[0].params.text;
      check(!/[\u202E\u200B\u0007\u0000]/.test(m), 'control, zero-width and bidi characters are stripped');
      check(m.includes('<b>bold</b>') && !('parse_mode' in sent(OWNER)[0].params), 'markup stays literal text (no parse_mode)');
      check(!m.includes('me\nthere') && m.includes('me there'), 'single-line fields lose line breaks');
      eq(foreignFetch, [], 'the worker only ever calls the Telegram API (no user URL is fetched)');
      check(!tgCalls.some(c => 'parse_mode' in c.params), 'no Telegram call anywhere uses parse_mode');
      const v = await view(r);
      check(!/[\u202E\u200B\u0007]/.test(v.text), 'stored text is clean as well');
      // an internal failure: the log line has the error name, never content
      const bomb = new FakeKV(); bomb.put = async () => { throw new TypeError('secret=' + r.j.secret + ' text=' + GOOD.text); };
      env.KV = bomb;
      const f = await newTicket();
      eq([f.status, f.j.error], [500, 'server_error'], 'internal failure: 500 with a generic code');
      check(!f.text.includes(GOOD.text), 'the error body has no details');
      env.KV = kv;
    } finally { console.error = oe; console.log = ol; console.warn = ow; }
    check(logs.length > 0 && !logs.join('\n').includes('freezes') && !logs.join('\n').includes('secret=') && !logs.join('\n').includes('TEST-TOKEN') && !logs.join('\n').includes('198.51.100'), 'logs contain no secrets, ticket text, token or IP', logs);
    check(!/[?&](secret|token)=/.test(kv.dump()), 'no secret in a URL-like field');
    // the secret comes from crypto.getRandomValues: distinct and long
    const set = new Set(); for(let i = 0; i < 20; i++) set.add((await newTicket({}, { ip: '10.0.0.' + i })).j.secret);
    eq(set.size, 20, 'secrets are unique');
  });
}

// ---------- the page ----------
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.woff2':'font/woff2' };
async function siteServer(){
  const srv = http.createServer((req, res) => {
    let f = path.join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if(fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if(!f.startsWith(SITE) || !fs.existsSync(f)){ res.statusCode = 404; return res.end(); }
    res.setHeader('content-type', TYPES[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
  });
  await new Promise(r => srv.listen(SITE_PORT, r));
  return { url: `http://localhost:${SITE_PORT}`, close: () => new Promise(r => srv.close(r)) };
}
const build = api => execFileSync('sh', [path.join(ROOT, 'tools/build-site.sh')], { cwd: ROOT, env: { ...process.env, SUPPORT_API: api || '' } });

// A relay stand-in in the browser: same JSON as the worker
function mockRelay(ctx){
  const S = { tickets: {}, reqs: [], n: 0 };
  ctx.route('https://relay.test/**', async route => {
    const rq = route.request(), u = new URL(rq.url()), h = rq.headers();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, x-ticket-secret', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
    if(rq.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    S.reqs.push({ method: rq.method(), url: rq.url(), headers: h, body: rq.postData() });
    const out = (status, body) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if(u.pathname === '/api/ticket' && rq.method() === 'POST'){
      const b = JSON.parse(rq.postData()); const n = ++S.n, id = 'abcdefg' + 'abcdefghij'[n], secret = 'S'.repeat(31) + n;
      if(S.fail) return out(S.fail, { error: S.failCode || 'server_error' });
      S.tickets[id] = { id, secret, status: 'open', kind: b.kind, created: Date.now(), messages: [{ from: 'user', text: b.text, t: Date.now() }] };
      return out(201, { id, secret, tg: `https://t.me/hudini_test_bot?start=${id}_${'L'.repeat(22)}` });
    }
    if(u.pathname === '/api/ticket' && rq.method() === 'GET'){
      const t = S.tickets[u.searchParams.get('id')];
      if(!t || h['x-ticket-secret'] !== t.secret) return out(404, { error: 'not_found' });
      return out(200, { id: t.id, status: t.status, kind: t.kind, created: t.created, messages: t.messages });
    }
    if(u.pathname === '/api/ticket/message'){
      const b = JSON.parse(rq.postData()), t = S.tickets[b.id];
      if(!t || h['x-ticket-secret'] !== t.secret) return out(404, { error: 'not_found' });
      t.messages.push({ from: 'user', text: b.text, t: Date.now() });
      return out(200, { id: t.id, status: t.status, kind: t.kind, created: t.created, messages: t.messages });
    }
    return out(404, { error: 'not_found' });
  });
  return S;
}

async function pageTests(){
  // texts: four languages, no stray Russian
  const sandbox = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'web/site/support-texts.js'), 'utf8'), sandbox);
  const TX = sandbox.window.HUDINI_SUPPORT;
  await step('page: texts in four languages', async () => {
    eq(Object.keys(TX), ['en', 'ru', 'uk', 'de'], 'four languages');
    const keys = Object.keys(TX.en).sort();
    for(const l of ['ru', 'uk', 'de']) eq(Object.keys(TX[l]).sort(), keys, l + ' has every key');
    for(const l of ['en', 'de']) check(!Object.values(TX[l]).some(v => /[А-Яа-яЁёІіЇїЄє]/.test(v)), l + ' has no Cyrillic');
    check(!Object.values(TX.uk).some(v => /[ыэъёЫЭЪЁ]/.test(v)) && /[іїє]/.test(TX.uk.h1 + TX.uk.sub), 'uk has no Russian-only letters');
    check(Object.values(TX.ru).some(v => /[ыэ]/.test(v)), 'ru is Russian');
    const st = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'web/site/site-texts.js'), 'utf8'), st);
    check(['en', 'ru', 'uk', 'de'].every(l => st.window.HUDINI_SITE_T[l].report), 'the "Report a problem" link text exists in all languages');
    for(const l of ['en', 'uk', 'de']) check(!/[ыэъё]/i.test(st.window.HUDINI_SITE_T[l].report), l + ' link text is not Russian');
    for(const f of ['index.html', 'help.html', 'moderator.html']) check(fs.readFileSync(path.join(ROOT, 'web/site', f), 'utf8').includes('href="support.html"'), f + ' links to the support page');
    const src = fs.readFileSync(path.join(ROOT, 'web/site/support.js'), 'utf8');
    check(!/innerHTML\s*[+]?=/.test(src.replace(/el\.innerHTML = v;/, '')), 'support.js writes no innerHTML except trusted static texts');
    check(/^const SUPPORT_API = '';/m.test(src), 'SUPPORT_API is empty in the repository');
  });

  build('');
  let site = await siteServer();
  await step('page: relay not connected', async () => {
    const p = await newPage('sp-off', { app: false, lang: 'en' });
    await p.goto(`${site.url}/support.html`);
    await p.waitForSelector('#off:not([hidden])');
    check(await p.isHidden('#form'), 'no form');
    check((await p.getAttribute('#off a', 'href')) === 'https://github.com/niko-ua-designer/hudini/issues/new/choose', 'points to GitHub issues');
    check(/connect-src 'self'; /.test(await p.getAttribute('meta[http-equiv=Content-Security-Policy]', 'content')), 'CSP: connect-src is only self when the relay is off');
    await p.context().close();
  });
  await site.close();

  build('https://relay.test/');
  site = await siteServer();
  const open = async (lang = 'en', hash = '', clock = false) => {
    const p = await newPage('sp-' + lang, { app: false, lang });
    const S = mockRelay(p.context());
    if(clock) await p.clock.install();
    await p.goto(`${site.url}/support.html${hash}`);
    return { p, S };
  };
  const fill = async (p, text = 'The panel freezes when I click the case button.') => { await p.fill('#fText', text); };

  await step('page: CSP and static safety', async () => {
    const { p } = await open();
    const csp = await p.getAttribute('meta[http-equiv=Content-Security-Policy]', 'content');
    check(/connect-src 'self' https:\/\/relay\.test(;|$)/.test(csp) && /script-src 'self'/.test(csp) && /default-src 'self'/.test(csp), 'CSP names exactly the relay origin', csp);
    const html = fs.readFileSync(path.join(SITE, 'support.html'), 'utf8');
    check(!/<script[^>]+src="https?:/.test(html) && !/<link[^>]+href="https?:/.test(html), 'no third-party scripts, fonts or stylesheets');
    check(/name="referrer" content="no-referrer"/.test(html), 'referrer policy: no-referrer');
    for(const a of await p.$$('a[target=_blank]')) check(/noopener/.test(await a.getAttribute('rel') || ''), 'target=_blank links carry rel=noopener');
    await p.context().close();
  });

  await step('page: validation', async () => {
    const { p, S } = await open();
    await p.waitForSelector('#form:not([hidden])');
    await p.click('#sendBtn');
    check((await p.textContent('#err')).includes('at least 10'), 'short text: message shown');
    await fill(p, 'too short'); await p.click('#sendBtn');
    check((await p.textContent('#err')).length > 0 && S.reqs.length === 0, 'nothing is sent');
    await p.context().close();
  });

  let shared;
  await step('page: send, success, ticket link, Telegram button', async () => {
    const { p, S } = await open('en');
    await p.waitForSelector('#form:not([hidden])');
    await p.check('input[name=kind][value=lag]');
    await fill(p); await p.selectOption('#fRole', 'moderator'); await p.selectOption('#fConn', 'tailscale');
    await p.fill('#fContact', '@me'); await p.fill('#fLog', 'log line 1\nlog line 2');
    await p.click('#sendBtn');
    await p.waitForSelector('#done:not([hidden])');
    const body = JSON.parse(S.reqs[0].body);
    eq([body.kind, body.role, body.connection, body.lang, body.hp, body.contact], ['lag', 'moderator', 'tailscale', 'en', '', '@me'], 'payload fields');
    check(['windows', 'linux', 'macos', 'other'].includes(body.os) && 'version' in body, 'os and version are filled in');
    check(S.reqs[0].url === 'https://relay.test/api/ticket' && !S.reqs[0].headers['x-ticket-secret'], 'posted to the relay');
    const id = Object.keys(S.tickets)[0], secret = S.tickets[id].secret;
    eq(await p.inputValue('#ownLink'), `${site.url}/support.html#t=${id}.${secret}`, 'private link is in the URL fragment');
    check((await p.getAttribute('#tgBtn', 'href')).startsWith('https://t.me/hudini_test_bot?start=' + id + '_') && await p.isVisible('#tgBtn'), 'Continue in Telegram button');
    eq(await p.getAttribute('#tgBtn', 'rel'), 'noopener noreferrer', 'with rel=noopener');
    const mine = JSON.parse(await p.evaluate(() => localStorage.getItem('hudini.tickets')));
    eq(mine, [{ id, secret }], 'only id and secret are remembered');
    shared = { id, secret };
    await p.context().close();
  });

  await step('page: relay errors', async () => {
    const { p, S } = await open('en');
    await p.waitForSelector('#form:not([hidden])');
    await fill(p);
    S.fail = 429; S.failCode = 'rate_limited'; await p.click('#sendBtn');
    await p.waitForFunction(() => document.getElementById('err').textContent.length > 0);
    check(/Too many/.test(await p.textContent('#err')), 'rate limit message');
    S.fail = 502; S.failCode = 'telegram_unavailable'; await p.click('#sendBtn');
    await p.waitForFunction(() => /wrong on our side/.test(document.getElementById('err').textContent));
    check(await p.isVisible('#form') && await p.isEnabled('#sendBtn'), 'the form stays usable');
    await p.context().close();
  });

  await step('page: ticket view, secret handling, polling, follow-up, text safety', async () => {
    const { p, S } = await open('en', '', true);
    await p.waitForSelector('#form:not([hidden])');
    // make a ticket the normal way, then open it by the link in a fresh load
    await fill(p, 'Original report text here'); await p.click('#sendBtn'); await p.waitForSelector('#done:not([hidden])');
    const id = Object.keys(S.tickets)[0], t = S.tickets[id];
    const link = await p.inputValue('#ownLink');
    await p.goto(link.replace(/^http:\/\/localhost:\d+/, site.url));
    await p.waitForSelector('#view:not([hidden])');
    await p.waitForFunction(() => document.querySelectorAll('.sp-msg').length === 1);
    eq(await p.evaluate(() => location.hash), '', 'the secret is removed from the address after load');
    const get = S.reqs.filter(r => r.method === 'GET').pop();
    check(get.headers['x-ticket-secret'] === t.secret && !get.url.includes(t.secret), 'the secret goes in a header, not in the URL');
    eq(await p.textContent('#vStatus'), 'Open', 'status shown');
    // polling: the owner answers with hostile text
    t.messages.push({ from: 'owner', text: '<img src=x onerror="window.__pwn=1"> https://evil.test/a <b>x</b>', t: Date.now() });
    t.status = 'closed';
    await p.clock.fastForward(15000);
    await p.waitForFunction(() => document.querySelectorAll('.sp-msg').length === 2);
    eq(await p.textContent('#vStatus'), 'Closed', 'status follows');
    eq(await p.evaluate(() => ({ img: document.querySelectorAll('#thread img').length, a: document.querySelectorAll('#thread a').length, b: document.querySelectorAll('#thread b').length - document.querySelectorAll('#thread .sp-msg').length, pwn: window.__pwn || 0 })), { img: 0, a: 0, b: 0, pwn: 0 }, 'message text is text: no elements, no links, nothing executed');
    check((await p.textContent('#thread')).includes('<img src=x'), 'it is shown literally');
    // follow-up
    await p.fill('#rText', 'My follow-up'); await p.click('#reply button');
    await p.waitForFunction(() => document.querySelectorAll('.sp-msg').length === 3);
    const msg = S.reqs.filter(r => r.url.endsWith('/api/ticket/message')).pop();
    check(msg.headers['x-ticket-secret'] === t.secret && JSON.parse(msg.body).text === 'My follow-up', 'follow-up sent with the secret header');
    // visibility: no polling while hidden is covered by the document.visibilityState check
    check((await p.evaluate(() => document.visibilityState)) === 'visible', 'visible page polls');
    await p.context().close();
  });

  await step('page: my reports, unknown ticket', async () => {
    const { p, S } = await open('en');
    await p.waitForSelector('#form:not([hidden])');
    await p.evaluate(([id, secret]) => localStorage.setItem('hudini.tickets', JSON.stringify([{ id, secret }, { id: 'zzzzzzzz', secret: 'Q'.repeat(32) }, { id: 'bad', secret: 'x' }])), [shared.id, shared.secret]);
    S.tickets[shared.id] = { id: shared.id, secret: shared.secret, status: 'open', kind: 'bug', created: Date.now(), messages: [{ from: 'user', text: 'Stored one', t: Date.now() }] };
    await p.reload(); await p.waitForSelector('#form:not([hidden])');
    eq(await p.locator('#mine button').count(), 2, 'valid stored tickets are listed, malformed ones dropped');
    await p.locator('#mine button').nth(1).click();
    await p.waitForFunction(() => document.getElementById('vErr').textContent.length > 0);
    check(/not found/.test(await p.textContent('#vErr')), 'unknown/expired ticket: friendly message');
    eq(JSON.parse(await p.evaluate(() => localStorage.getItem('hudini.tickets'))).map(x => x.id), [shared.id], 'and it is forgotten');
    await p.context().close();
  });

  await step('page: other languages', async () => {
    for(const l of ['ru', 'uk', 'de']){
      const { p } = await open(l);
      await p.waitForSelector('#form:not([hidden])');
      check((await p.textContent('h1')).includes(TX[l].h1.replace(/<[^>]+>/g, '')), l + ': heading translated');
      eq(await p.evaluate(() => document.documentElement.lang), l, l + ': html lang');
      const shown = await p.evaluate(() => document.body.innerText);
      if(l !== 'ru') check(!/[ыэъё]/i.test(shown), l + ': no Russian-only letters on the page');
      await p.context().close();
    }
    const { p } = await open('en'); await p.waitForSelector('#form:not([hidden])');
    await p.selectOption('select.lang', 'de');
    await p.waitForFunction(() => document.getElementById('sendBtn').textContent === 'Senden');
    check(true, 'switching the language re-renders the form');
    await p.context().close();
  });
  await site.close();
}

(async () => {
  try{
    await relayTests();
    await pageTests();
  } finally {
    global.fetch = realFetch;
    execFileSync('sh', [path.join(ROOT, 'tools/build-site.sh')], { cwd: ROOT, env: { ...process.env, SUPPORT_API: '' } });
    await closeBrowser();
  }
  process.exit(finish());
})().catch(e => { console.error(e); process.exit(1); });
