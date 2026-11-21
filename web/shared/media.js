// Camera, screen and microphone: capture, transport and display. Shared by the panel and the OBS widget (load after core.js).
//
// Two paths, chosen automatically:
//  1. WebRTC straight between the two machines (iceServers: [], host candidates only, DTLS-SRTP). Low latency.
//     The offer/answer and the ICE candidates travel over the room's MQTT topic `rtc`, sealed with the room key,
//     so the DTLS fingerprint in the SDP cannot be swapped without the key.
//  2. Fallback when ICE does not come up in ICE_MS: MediaRecorder cuts WebM pieces, every piece is sealed with the room key
//     and goes through the Host's WebSocket /media?sid=. The receiver unseals it and plays it through MediaSource.
//
// `rtc` topic payload: [u16 BE header length][JSON header <= 300 bytes][sealed body], all together <= 64 KB.
//   header: { v:1, sid, kind:'cam'|'screen'|'mic', t:'offer'|'answer'|'ice'|'bye'|'want'|'have', to?:'widget'|'streamer'|'m:<mqtt client id>', from }  (the Host reads this and stamps `from` itself:
//     the real address of the sender; a receiver trusts only this field and drops a body whose `a` disagrees. `tkt` is the Host's alone.)
//   body (sealed JSON, the Host cannot read it): { t, kind, sid, from:<hub id>, a:<own Host address>, to:<hub id>|'*', sdp?, cand?, mime?, bg?, p2?, owner? }
// The body repeats kind, sid and t: a receiver rejects the message when they differ from the header.
// Discovery: a receiver sends `want` {owner, kind} (any sid); the owner answers with an `offer`, the Host registers the receiver as a peer of that sid.
// Media frame on /media: [1 byte: 0 = first piece of a recording (stream header), 1 = next piece][sealed: 8 bytes sender time (float64) + WebM bytes].
// First text message on /media: { u:'mod', p:<password> } | { u:'streamer', p:<panel session> } | { u:'widget' }, plus t:<ticket>.
// The ticket is made by the Host for one MQTT connection and one sid, and sent to that connection alone on the `rtc` topic (t:'tkt', from the Host)
// when it owns the stream or is addressed by an offer/have. Without it /media does not let anyone in.
// Sound belongs to a microphone only: the audio tracks of a camera and a screen are never played, a microphone has no picture.
(function(root){
  'use strict';
  const KINDS = ['cam', 'screen', 'mic'];
  const SID_RE = /^[A-Za-z0-9_-]{8,32}$/, ID_RE = /^[A-Za-z0-9_-]{1,40}$/, ADDR_RE = /^(widget|streamer|m:[\w.:-]{1,64})$/;
  const RTC_T = ['offer', 'answer', 'ice', 'bye', 'want', 'have', 'tkt'];   // tkt: only the Host makes it (the /media ticket), see onPacket
const TK_RE = /^[A-Za-z0-9_-]{16,64}$/;
  const MIMES = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'audio/webm;codecs=opus'];
  // What a recording of a kind may carry: a camera and a screen show a picture only, a microphone has sound only. Anything else is not played.
  const KIND_MIMES = { cam:['video/webm;codecs=vp8'], screen:['video/webm;codecs=vp8'], mic:['audio/webm;codecs=opus'] };
  const ICE_MS = 5000, HAVE_MS = 4000, WANT_MS = 3000, P2_KEEP_MS = 12000, MAX_PEERS = 8, MAX_SDP = 60000, MAX_CHUNK = 900 * 1024, SEG_MS = 3000, QUEUE_BYTES = 600 * 1024;
  // Quality presets: camera 720p30, screen 1080p30, the panel background 720p15 on a smaller bitrate
  const QUALITY = {
    cam:{ w:1280, h:720, fps:30, bps:2500000 },
    screen:{ w:1920, h:1080, fps:30, bps:4000000 },
    bg:{ w:1280, h:720, fps:15, bps:800000 },
    mic:{ bps:64000 },
  };
  const REC_BPS = { cam:2000000, screen:3500000, mic:64000 };   // the recorder for path 2: together with sound under 4 Mbit/s

  const rnd = (n, abc) => { const a = crypto.getRandomValues(new Uint8Array(n)); let s = ''; for(const b of a) s += abc[b % abc.length]; return s; };
  const newSid = () => rnd(12, 'abcdefghijklmnopqrstuvwxyz0123456789');
  const isStr = v => typeof v === 'string';

  // ---------- wire format ----------
  function wrapRtc(head, sealed){
    if(!head || head.v !== 1 || !KINDS.includes(head.kind) || !SID_RE.test(head.sid) || !RTC_T.includes(head.t)) throw new Error('bad rtc header');
    const h = TE.encode(JSON.stringify(head)); if(h.length > 300) throw new Error('bad rtc header');
    const out = new Uint8Array(2 + h.length + sealed.length);
    out[0] = h.length >> 8; out[1] = h.length & 255; out.set(h, 2); out.set(sealed, 2 + h.length);
    return out;
  }
  function unwrapRtc(buf){
    const b = new Uint8Array(buf); if(b.length < 2 + 10 + 30 || b.length > 65536) return null;
    const n = (b[0] << 8) | b[1]; if(n < 10 || n > 300 || b.length < 2 + n + 30) return null;
    let h; try{ h = JSON.parse(TD.decode(b.subarray(2, 2 + n))); }catch{ return null; }
    if(!h || typeof h !== 'object' || h.v !== 1 || !isStr(h.sid) || !SID_RE.test(h.sid) || !KINDS.includes(h.kind) || !RTC_T.includes(h.t)) return null;
    if(h.to !== undefined && (!isStr(h.to) || !(ADDR_RE.test(h.to) || h.to === '*'))) return null;
    if(h.from !== undefined && (!isStr(h.from) || !(ADDR_RE.test(h.from) || h.from === 'host'))) return null;
    return { head:{ sid:h.sid, kind:h.kind, t:h.t, to:h.to, from:h.from }, body:b.subarray(2 + n) };
  }

  // ---------- addresses and SDP ----------
  // Only addresses that cannot be reached from the internet go out: private, loopback, link-local, VPN (CGNAT) and mDNS names.
  function ipOk(ip){
    if(/^[0-9a-f-]{36}\.local$/i.test(ip)) return true;   // Chromium hides real addresses behind a random mDNS name
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
    if(m){
      const a = +m[1], b = +m[2];
      return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
    }
    const v6 = ip.toLowerCase();
    return v6 === '::1' || /^f[cd][0-9a-f]{2}:/.test(v6) || /^fe[89ab][0-9a-f]:/.test(v6);
  }
  // → { ip, proto, type } or null
  function parseCand(s){
    if(!isStr(s) || s.length > 400) return null;
    const m = /^candidate:\S+ [12] (udp|tcp) \d+ (\S+) (\d{1,5}) typ (host|srflx|relay|prflx)(?: |$)/i.exec(s);
    return m ? { proto:m[1].toLowerCase(), ip:m[2], type:m[4].toLowerCase() } : null;
  }
  let allowIp = ipOk;   // the Host can narrow this to the networks it knows
  const candOk = s => { const c = parseCand(s); return !!c && c.type === 'host' && allowIp(c.ip); };
  const stripCands = sdp => sdp.split(/\r?\n/).filter(l => !/^a=(candidate|end-of-candidates)/.test(l)).join('\r\n') + (sdp.endsWith('\n') ? '' : '\r\n');
  function cleanSdp(sdp){
    if(!isStr(sdp) || sdp.length > MAX_SDP || !sdp.startsWith('v=0')) return null;
    if((sdp.match(/^m=/gm) || []).length > 4) return null;
    return stripCands(sdp);
  }
  // Sanitizes a decrypted `rtc` body. Everything that is not a plain, short, known value is dropped.
  function cleanRtc(m){
    if(!m || typeof m !== 'object' || Array.isArray(m)) return null;
    if(!RTC_T.includes(m.t) || !KINDS.includes(m.kind) || !isStr(m.sid) || !SID_RE.test(m.sid) || !isStr(m.from) || !ID_RE.test(m.from)) return null;
    if(m.t === 'tkt' && m.from !== 'host') return null;
    const to = m.to === undefined || m.to === '*' ? '*' : isStr(m.to) && ID_RE.test(m.to) ? m.to : null; if(!to) return null;
    const o = { t:m.t, kind:m.kind, sid:m.sid, from:m.from, to, a:isStr(m.a) && ADDR_RE.test(m.a) ? m.a : '' };
    if(m.t === 'offer' || m.t === 'answer'){ const s = cleanSdp(m.sdp); if(!s) return null; o.sdp = s; }
    if(m.t === 'ice'){
      const c = m.cand; if(!c || typeof c !== 'object' || !isStr(c.candidate) || !candOk(c.candidate)) return null;
      o.cand = { candidate:c.candidate, sdpMid:isStr(c.sdpMid) ? c.sdpMid.slice(0, 16) : null, sdpMLineIndex:Number.isInteger(c.sdpMLineIndex) && c.sdpMLineIndex >= 0 && c.sdpMLineIndex < 4 ? c.sdpMLineIndex : 0 };
    }
    if(m.t === 'offer' || m.t === 'have'){ o.bg = m.bg === true; o.mime = MIMES.includes(m.mime) && KIND_MIMES[m.kind].includes(m.mime) ? m.mime : ''; }
    if(m.t === 'tkt'){ if(!isStr(m.tk) || !TK_RE.test(m.tk)) return null; o.tk = m.tk; }
    if(m.t === 'want'){ o.bg = m.bg === true; o.p2 = m.p2 === true; o.owner = isStr(m.owner) && ID_RE.test(m.owner) ? m.owner : ''; }
    if((m.t === 'offer' || m.t === 'want') && !o.a) return null;   // nowhere to answer
    return o;
  }

  // ---------- capture ----------
  const supported = kind => !!(root.RTCPeerConnection && navigator.mediaDevices && (kind === 'screen' ? navigator.mediaDevices.getDisplayMedia : navigator.mediaDevices.getUserMedia));
  async function devices(kind){
    if(!navigator.mediaDevices?.enumerateDevices) return [];
    const want = kind === 'mic' ? 'audioinput' : 'videoinput';
    return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === want).map((d, i) => ({ id:d.deviceId, label:d.label || (kind === 'mic' ? 'Mic ' : 'Cam ') + (i + 1) }));
  }
  async function capture(kind, opts = {}){
    if(!supported(kind)) throw Object.assign(new Error('unsupported'), { name:'NotSupportedError' });
    const dev = opts.deviceId ? { deviceId:{ exact:opts.deviceId } } : {};
    if(kind === 'screen'){
      const q = QUALITY.screen;
      return navigator.mediaDevices.getDisplayMedia({ video:{ width:{ ideal:q.w }, height:{ ideal:q.h }, frameRate:{ ideal:q.fps } }, audio:false });
    }
    if(kind === 'mic') return navigator.mediaDevices.getUserMedia({ audio:{ ...dev, echoCancellation:true, noiseSuppression:true, autoGainControl:true }, video:false });
    const q = QUALITY.cam;
    return navigator.mediaDevices.getUserMedia({ video:{ ...dev, width:{ ideal:q.w }, height:{ ideal:q.h }, frameRate:{ ideal:q.fps } }, audio:false });
  }
  // The type of the recording follows the tracks: a camera or screen has no sound, a microphone has no picture
  function pickMime(kind, stream){
    if(!root.MediaRecorder) return '';
    const v = stream ? stream.getVideoTracks().length > 0 : kind !== 'mic', au = stream ? stream.getAudioTracks().length > 0 : kind === 'mic';
    const list = v ? (au ? ['video/webm;codecs=vp8,opus'] : ['video/webm;codecs=vp8']) : ['audio/webm;codecs=opus'];
    return list.find(m => MediaRecorder.isTypeSupported(m)) || '';
  }

  // ---------- the hub: one per page ----------
  // o: { id, addr() → own Host address ('widget' | 'streamer' | 'm:<mqtt id>'), keys(), sign, publish(bytes), mediaUrl(sid) → ws url | '',
  //      mediaAuth() → first /media message | null, desired() → [{ owner, kind, purpose:'main'|'bg' }], onChange(), now(), forceP2() }
  function createHub(o){
    const me = o.id, now = o.now || Date.now;
    const sources = new Map();   // sid → local capture offered to others
    const recvs = new Map();     // key → remote stream we receive
    const hub = { sources, recvs, id:me };
    const change = () => { try{ o.onChange?.(); }catch(e){ console.warn(e); } };
    let quiet = false;           // after shutdown() nothing more goes out (the room has changed)
    const timers = [], every = (f, ms) => { const t = setInterval(f, ms); timers.push(t); return t; };
    const tickets = new Map();   // sid → the Host's one-time ticket for /media (it comes on the rtc topic, for this connection alone)
    const ticketFor = sid => tickets.get(sid) || '';
    // the first /media message: the page's login plus the ticket; without a ticket the socket is not opened
    const loginOf = sid => { const a = o.mediaAuth?.(sid), t = ticketFor(sid); return a && t ? JSON.stringify({ ...a, t }) : ''; };

    // m: { t, kind, sid, ...body }, hostTo: the header's `to` (a Host address) or undefined
    async function send(m, hostTo){
      const keys = o.keys(); if(!keys || quiet) return;
      try{
        const head = { v:1, sid:m.sid, kind:m.kind, t:m.t }; if(hostTo) head.to = hostTo;
        const body = await seal(keys, TE.encode(JSON.stringify({ from:me, a:o.addr(), to:'*', ...m })), !!o.sign);
        o.publish(wrapRtc(head, body));
      }catch(e){ console.warn('[media]', e.message); }
    }

    // ---------- sender ----------
    async function share(kind, stream, opts = {}){
      if(!KINDS.includes(kind)) throw new Error('bad kind');
      hub.stopKind(kind);
      const src = { sid:newSid(), kind, stream, bg:!!opts.bg, peers:new Map(), wanters:new Map(), mime:pickMime(kind, stream), rec:null, ws:null, p2Until:0, p2peers:new Map(), hb:null, pending:false, q:[] };
      sources.set(src.sid, src);
      for(const t of stream.getTracks()) t.addEventListener('ended', () => hub.stop(src.sid));
      src.hb = every(() => announce(src), HAVE_MS);
      announce(src); change();
      return src;
    }
    hub.share = share;
    // `have` goes to the widget: it registers the stream with the Host (a moderator's request reaches the streamer's dock at once)
    // and tells the widget to ask for the picture
    const announce = src => send({ t:'have', kind:src.kind, sid:src.sid, bg:src.bg, mime:src.mime }, 'widget');
    hub.setBg = (sid, on) => { const s = sources.get(sid); if(s && s.bg !== !!on){ s.bg = !!on; if(!s.bg) for(const k of [...s.peers.keys()]) if(s.peers.get(k).bg) closePeer(s, k); announce(s); change(); } };
    hub.stop = sid => {
      const s = sources.get(sid); if(!s) return;
      sources.delete(sid); clearInterval(s.hb);
      for(const k of [...s.peers.keys()]) closePeer(s, k);
      stopRecorder(s); try{ s.ws?.close(); }catch{}
      for(const t of s.stream.getTracks()){ try{ t.stop(); }catch{} }
      send({ t:'bye', kind:s.kind, sid:s.sid });
      change();
    };
    hub.stopKind = kind => { for(const s of [...sources.values()]) if(s.kind === kind) hub.stop(s.sid); };
    hub.stopAll = () => { for(const s of [...sources.values()]) hub.stop(s.sid); };
    hub.local = kind => [...sources.values()].find(s => s.kind === kind) || null;
    // The Host asked the streamer, answered: send the offers again (the first ones were held back)
    hub.reoffer = kind => { for(const s of sources.values()) if(s.kind === kind){ s.pending = false; announce(s); for(const [from, w] of s.wanters) offerTo(s, { from, a:w.a, bg:w.bg }); } change(); };
    hub.setPending = (kind, on) => { for(const s of sources.values()) if(s.kind === kind) s.pending = !!on; change(); };

    function closePeer(src, key){
      const p = src.peers.get(key); if(!p) return; src.peers.delete(key);
      clearTimeout(p.dead); clearInterval(p.stats);
      try{ p.pc?.close(); }catch{}
    }
    async function offerTo(src, m){
      closePeer(src, m.from);
      if(src.peers.size >= MAX_PEERS) return;
      const pc = new RTCPeerConnection({ iceServers:[], bundlePolicy:'max-bundle' });
      const peer = { pc, addr:m.a, bg:!!m.bg, state:'new', rtt:null, dead:null, stats:null, at:now() };
      src.peers.set(m.from, peer);
      for(const t of src.stream.getTracks()) pc.addTrack(t, src.stream);
      pc.onicecandidate = e => { if(e.candidate && candOk(e.candidate.candidate)) send({ t:'ice', to:m.from, sid:src.sid, kind:src.kind, cand:e.candidate.toJSON() }, m.a); };
      pc.onconnectionstatechange = () => {
        peer.state = pc.connectionState;
        if(peer.state === 'connected'){
          clearTimeout(peer.dead);
          peer.stats = setInterval(async() => { try{ const r = await pc.getStats(); r.forEach(x => { if(x.type === 'candidate-pair' && x.nominated && x.currentRoundTripTime != null) peer.rtt = Math.round(x.currentRoundTripTime * 1000 / 2); }); change(); }catch{} }, 2000);
        } else if(peer.state === 'failed' || peer.state === 'closed') closePeer(src, m.from);
        change();
      };
      peer.dead = setTimeout(() => { if(peer.state !== 'connected') closePeer(src, m.from); }, 15000);
      try{
        await pc.setLocalDescription(await pc.createOffer());
        // the bandwidth by kind; the background copy of the screen gets less
        const q = peer.bg ? QUALITY.bg : QUALITY[src.kind];
        for(const s of pc.getSenders()){
          if(!s.track) continue;
          const p = s.getParameters(); if(!p.encodings?.length) p.encodings = [{}];
          p.encodings[0].maxBitrate = s.track.kind === 'audio' ? QUALITY.mic.bps : q.bps;
          if(s.track.kind === 'video'){
            if(q.fps) p.encodings[0].maxFramerate = q.fps;
            const h = s.track.getSettings?.().height; if(peer.bg && h > q.h) p.encodings[0].scaleResolutionDownBy = h / q.h;
          }
          await s.setParameters(p).catch(() => {});
        }
        await send({ t:'offer', to:m.from, sid:src.sid, kind:src.kind, sdp:pc.localDescription.sdp, bg:peer.bg, mime:src.mime }, m.a);
      }catch(e){ console.warn('[media] offer', e.message); closePeer(src, m.from); }
    }
    // A receiver asks (discovery: any sid, names the owner) or asks for the Host road (our real sid, p2)
    function onWant(m){
      let src;
      if(m.p2) src = sources.get(m.sid);
      else src = [...sources.values()].find(s => s.kind === m.kind && (m.owner === me || (m.bg && s.bg && !m.owner)));
      if(!src || src.kind !== m.kind || (m.bg && !src.bg)) return;
      if(m.p2){
        const t = now(), seen = src.p2peers.get(m.from);
        src.p2peers.set(m.from, t); src.p2Until = t + P2_KEEP_MS;
        for(const [k, at] of src.p2peers) if(t - at > P2_KEEP_MS) src.p2peers.delete(k);
        if(!src.rec || !seen || t - seen > P2_KEEP_MS) ensureRecorder(src);   // a new receiver needs a fresh stream header
        return;
      }
      src.wanters.set(m.from, { a:m.a, bg:!!m.bg, at:now() });
      for(const [k, w] of src.wanters) if(now() - w.at > 15000) src.wanters.delete(k);
      const p = src.peers.get(m.from);
      if(p && (p.state === 'connected' || now() - p.at < 8000)) return;   // already on its way
      offerTo(src, { from:m.from, a:m.a, bg:m.bg });
    }
    // ---- path 2, sender: MediaRecorder → sealed pieces → WS /media ----
    function ensureWs(src){
      if(src.ws && src.ws.readyState <= 1) return;
      const url = o.mediaUrl?.(src.sid); if(!url) return;
      const login = loginOf(src.sid);
      if(!login){ if(!quiet && sources.has(src.sid) && !src.tkWait){ src.tkWait = setTimeout(() => { src.tkWait = null; if(src.rec) ensureWs(src); }, 300); } return; }   // the ticket comes with the Host's answer to our `have`
      try{
        const ws = new WebSocket(url); ws.binaryType = 'arraybuffer'; src.ws = ws;
        let opened = 0;
        ws.onopen = () => { opened = now(); ws.send(login); const q = src.q.splice(0); src.qBytes = 0; for(const fr of q) ws.send(fr); };   // what was cut while the socket was opening (the header first)
        ws.onerror = () => {};
        // turned away at the door (a stale ticket): forget the ticket, the Host sends a fresh one with its answer to our next `have`; do not hoard pieces meanwhile
        ws.onclose = () => { if(src.ws === ws){ src.ws = null; if(now() - (opened || now()) < 1500){ tickets.delete(src.sid); src.q.length = 0; src.qBytes = 0; src.qSkip = true; } } };
      }catch{}
    }
    function stopRecorder(src){ src.q.length = 0; src.qBytes = 0; src.qSkip = false; clearTimeout(src.segT); if(src.rec){ const r = src.rec; r._last = false; src.rec = null; try{ if(r.state !== 'inactive') r.stop(); }catch{} } }
    // While the socket is not open, only the newest header and what follows it is kept (a piece without its header cannot be played anyway)
    function enqueue(src, type, fr){
      if(type === 0){ src.q = [fr]; src.qBytes = fr.length; src.qSkip = false; return; }
      if(src.qSkip) return;
      if(src.qBytes + fr.length > QUEUE_BYTES){ src.q.length = 0; src.qBytes = 0; src.qSkip = true; return; }   // too much: wait for the next header instead of sending a torn tail
      src.q.push(fr); src.qBytes += fr.length;
    }
    // The recording is cut into segments: every SEG_MS a new recorder starts on the same stream, so a stream header and a key frame open each segment.
    // The Host drops pieces for a lagging receiver and resumes at the next header; the receiver restarts its picture there.
    function startRecorder(src){
      let first = true, rec;
      try{ rec = new MediaRecorder(src.stream, { mimeType:src.mime, videoBitsPerSecond:REC_BPS[src.kind], audioBitsPerSecond:src.kind === 'mic' ? REC_BPS.mic : 96000 }); }catch{ return; }
      src.rec = rec;
      rec.ondataavailable = e => {
        if(!e.data?.size || e.data.size > MAX_CHUNK || src.rec !== rec) return;
        const type = first ? 0 : 1; first = false;
        // pieces go out strictly in order (sealing is asynchronous)
        src.chain = (src.chain || Promise.resolve()).then(async () => {
          const raw = new Uint8Array(await e.data.arrayBuffer()), plain = new Uint8Array(8 + raw.length);
          new DataView(plain.buffer).setFloat64(0, now()); plain.set(raw, 8);
          const sealed = await seal(o.keys(), plain, !!o.sign);
          if(src.rec !== rec && !rec._last) return;
          ensureWs(src);
          const fr = new Uint8Array(1 + sealed.length); fr[0] = type; fr.set(sealed, 1);
          if(src.ws?.readyState === 1) src.ws.send(fr);
          else if(!src.ws || src.ws.readyState === 0) enqueue(src, type, fr);   // the socket is still opening (or waits for the ticket)
        }).catch(() => {});
      };
      rec.start(250);
      src.segT = setTimeout(() => {
        if(src.rec !== rec || quiet) return;
        rec._last = true;   // its last piece (given on stop) still goes out
        rec.onstop = () => { if(src.rec === rec){ src.rec = null; startRecorder(src); } };
        try{ rec.stop(); }catch{ src.rec = null; startRecorder(src); }
      }, o.segMs || SEG_MS);
    }
    function ensureRecorder(src){
      ensureWs(src);
      stopRecorder(src);
      if(!root.MediaRecorder || !src.mime) return;
      startRecorder(src);
    }
    every(() => { for(const s of sources.values()) if(s.rec && now() > s.p2Until){ stopRecorder(s); try{ s.ws?.close(); }catch{} s.ws = null; } }, 3000);

    // ---------- receiver ----------
    const keyOf = (d, owner) => d.purpose === 'bg' ? 'bg||' + d.kind : 'main|' + (owner ?? d.owner) + '|' + d.kind;
    const bgSids = new Map();    // sid → true when the owner offers this screen as a backdrop (from its `have`)
    const rsids = new Map();     // desire key → the sid we put into our `want`s
    function closeRecv(e){
      recvs.delete(e.key);
      clearTimeout(e.tkWait); clearTimeout(e.timer); clearInterval(e.stats); clearInterval(e.keep);
      try{ e.pc?.close(); }catch{}
      closeP2(e);
      change();
    }
    // Ask the owners of everything we want and do not have yet; let go of what is not wanted any more
    function sendWants(){
      if(quiet) return;
      const want = o.desired() || [], keys = new Set();
      for(const d of want){
        const key = keyOf(d); keys.add(key);
        const cur = d.purpose === 'bg' ? [...recvs.values()].find(x => x.purpose === 'bg' && x.kind === d.kind) : recvs.get(key);
        if(cur && (cur.path === 'direct' || (cur.path === 'host' && now() - cur.lastFrame < 8000) || now() - cur.started < ICE_MS + 4000)) continue;
        let rs = rsids.get(key); if(!rs){ rs = newSid(); rsids.set(key, rs); }
        send({ t:'want', kind:d.kind, sid:rs, owner:d.owner || '', bg:d.purpose === 'bg' });
      }
      for(const k of [...rsids.keys()]) if(!keys.has(k)) rsids.delete(k);
      for(const e of [...recvs.values()]){
        const d = want.find(x => x.purpose === e.purpose && x.kind === e.kind && (e.purpose === 'bg' || x.owner === e.owner));
        if(!d) closeRecv(e);
      }
    }
    hub.refresh = sendWants;
    every(sendWants, WANT_MS);
    // a receiver whose sender fell silent is let go; the next `want` brings a fresh offer
    // (a receiver that gave up for good, path 'none', goes too: the next `want` brings a fresh offer)
    every(() => { const t = now(); for(const e of [...recvs.values()]) if((e.path === 'host' && t - (e.lastFrame || e.started) > 10000) || (e.path === 'none' && t - e.started > ICE_MS + 4000)) closeRecv(e); }, 2000);

    async function onOffer(m, signed){
      if(!signed) return;
      const want = o.desired() || [];
      // the backdrop screen is the streamer's alone (the Host-made address in the header decides, m.a)
      const d = want.find(x => x.kind === m.kind && (x.purpose === 'bg' ? m.bg && m.a === 'streamer' : (x.owner === m.from && !m.bg)));
      if(!d) return;
      // a moderator's hub id must belong to the Host address that sent it: the address is 'm:' + clientId + a short suffix (the Host stamps it, the hub id comes from the body)
      if(d.purpose !== 'bg' && m.from !== 'streamer' && !(m.a.startsWith('m:' + m.from) && m.a.length <= m.from.length + 2 + 4)) return;
      const key = keyOf(d, m.from), old = d.purpose === 'bg' ? [...recvs.values()].find(x => x.purpose === 'bg' && x.kind === d.kind) : recvs.get(key);
      if(old){
        // the same sid again while the link is alive: nothing to do; a dead or stuck one (path 'none', 'lost', ICE never came up) starts over
        const alive = old.path === 'direct' || (old.path === 'host' && now() - old.lastFrame < 8000) || now() - old.started < ICE_MS + 4000;
        if(alive && (old.sid === m.sid || old.addr !== m.a)) return;   // a live entry belongs to whoever opened it
        closeRecv(old);
      }
      const e = { key, sid:m.sid, owner:m.from, addr:m.a, kind:m.kind, purpose:d.purpose, mime:m.mime, pc:null, stream:null, url:'', path:'wait', ms:null, started:now(), lastFrame:0,
        timer:null, stats:null, keep:null, ws:null, mse:null, el:null, queue:Promise.resolve(), pend:[], icePend:[] };
      recvs.set(key, e); change();
      if(o.forceP2?.()){ goP2(e); return; }
      e.timer = setTimeout(() => goP2(e), ICE_MS);
      const pc = new RTCPeerConnection({ iceServers:[], bundlePolicy:'max-bundle' }); e.pc = pc;
      // only the tracks the kind allows: a camera and a screen carry no sound, a microphone no picture (the sender's own checks are not trusted)
      pc.ontrack = ev => {
        if(e.pc !== pc || ev.track.kind !== (e.kind === 'mic' ? 'audio' : 'video')) return;
        if(!e.stream) e.stream = new MediaStream();
        e.stream.addTrack(ev.track); change();
      };
      pc.onicecandidate = ev => { if(ev.candidate && candOk(ev.candidate.candidate)) send({ t:'ice', to:e.owner, sid:e.sid, kind:e.kind, cand:ev.candidate.toJSON() }, e.addr); };
      pc.onconnectionstatechange = () => {
        if(e.pc !== pc) return;
        const s = pc.connectionState;
        if(s === 'connected'){
          clearTimeout(e.timer); e.path = 'direct'; closeP2(e);
          clearInterval(e.stats);
          e.stats = setInterval(async() => { try{ const r = await pc.getStats(); r.forEach(x => { if(x.type === 'candidate-pair' && x.nominated && x.currentRoundTripTime != null) e.ms = Math.round(x.currentRoundTripTime * 1000 / 2); }); change(); }catch{} }, 2000);
        } else if(s === 'failed' || s === 'closed' || s === 'disconnected'){
          clearInterval(e.stats);
          if(e.path === 'direct'){ e.path = 'wait'; e.stream = null; clearTimeout(e.timer); e.timer = setTimeout(() => goP2(e), s === 'disconnected' ? 2000 : 0); }
        }
        change();
      };
      try{
        await pc.setRemoteDescription({ type:'offer', sdp:m.sdp });
        await pc.setLocalDescription(await pc.createAnswer());
        await send({ t:'answer', to:e.owner, sid:e.sid, kind:e.kind, sdp:pc.localDescription.sdp }, e.addr);
        for(const c of e.icePend.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      }catch(err){ console.warn('[media] answer', err.message); }
    }
    function goP2(e){
      if(!recvs.has(e.key) || e.path === 'host' || e.path === 'direct') return;
      if(!o.mediaUrl?.(e.sid)){ e.path = 'none'; change(); return; }
      e.path = 'host'; e.lastFrame = now(); openP2(e);
      clearInterval(e.keep); e.keep = setInterval(() => wantP2(e), 5000);
      change();
    }
    const wantP2 = e => send({ t:'want', kind:e.kind, sid:e.sid, owner:e.owner, bg:e.purpose === 'bg', p2:true }, e.addr);
    function closeP2(e){
      clearInterval(e.keep);
      try{ e.ws?.close(); }catch{} e.ws = null;
      if(e.url){ try{ URL.revokeObjectURL(e.url); }catch{} e.url = ''; }
      e.mse = null; e.pend = []; if(e.path === 'host') e.path = 'wait';
    }
    // ---- path 2, receiver ----
    function openP2(e){
      const url = o.mediaUrl(e.sid); if(!url) return;
      const login = loginOf(e.sid);
      if(!login){ clearTimeout(e.tkWait); e.tkWait = setTimeout(() => { if(recvs.get(e.key) === e && e.path === 'host' && !e.ws && !quiet) openP2(e); }, 300); return; }   // the ticket comes with the offer
      let ws; try{ ws = new WebSocket(url); }catch{ return; }
      ws.binaryType = 'arraybuffer'; e.ws = ws;
      ws.onopen = () => { ws.send(login); wantP2(e); };   // ask for the stream only when the socket is ready, so the header is not missed
      ws.onmessage = ev => { if(!(ev.data instanceof ArrayBuffer) || ev.data.byteLength > MAX_CHUNK + 200) return; e.queue = e.queue.then(() => p2Frame(e, new Uint8Array(ev.data))).catch(() => {}); };
      ws.onclose = () => { if(e.ws === ws){ e.ws = null; if(e.path === 'host'){ e.path = 'lost'; change(); setTimeout(() => { if(recvs.get(e.key) === e && e.path === 'lost'){ e.path = 'wait'; goP2(e); } }, 2000); } } };
    }
    async function p2Frame(e, fr){
      if(fr.length < 29 || fr[0] > 2 || e.ws == null) return;
      const plain = await unseal(o.keys(), fr.subarray(1), true);   // only moderators sign
      if(!plain || plain.length < 16 || e.path !== 'host') return;
      e.lastFrame = now();
      const ts = new DataView(plain.buffer, plain.byteOffset, 8).getFloat64(0), data = plain.slice(8);
      // a new header in the middle of the stream (the sender cuts the recording into segments, the Host resumes a lagging receiver at one):
      // a healthy buffer takes it as a new initialisation segment ('sequence' mode continues the timeline); a broken or missing one is rebuilt
      if(fr[0] === 0 && (!e.mse?.sb || e.mse.bad || e.mse.ms.readyState !== 'open')) resetMse(e);
      if(!e.mse) return;
      if(Number.isFinite(ts)) e.ms = Math.max(0, Math.round(now() - ts));
      e.pend.push(data); if(e.pend.length > 40) e.pend.splice(0, e.pend.length - 10);
      pump(e);
    }
    function resetMse(e){
      if(e.url){ try{ URL.revokeObjectURL(e.url); }catch{} e.url = ''; }
      const mime = e.mime && KIND_MIMES[e.kind].includes(e.mime) && root.MediaSource?.isTypeSupported(e.mime) ? e.mime : KIND_MIMES[e.kind][0];
      if(!root.MediaSource || !MediaSource.isTypeSupported(mime)){ e.path = 'none'; change(); return; }
      const ms = new MediaSource(), st = { ms, sb:null };
      e.mse = st; e.pend = []; e.url = URL.createObjectURL(ms);
      ms.addEventListener('sourceopen', () => {
        if(e.mse !== st) return;
        try{ st.sb = ms.addSourceBuffer(mime); st.sb.mode = 'sequence'; st.sb.addEventListener('updateend', () => pump(e)); st.sb.addEventListener('error', () => { st.bad = true; }); pump(e); }catch{ e.path = 'none'; change(); }
      });
      change();
    }
    function pump(e){
      const st = e.mse, sb = st?.sb; if(!sb || sb.updating || st.ms.readyState !== 'open') return;
      try{
        // do not hoard: drop what was played more than 6 s ago
        const v = e.el;
        if(v && sb.buffered.length && v.currentTime - sb.buffered.start(0) > 10){ sb.remove(0, v.currentTime - 4); return; }
        if(e.pend.length) sb.appendBuffer(e.pend.shift());
      }catch(err){ if(err.name === 'QuotaExceededError') e.pend.splice(0, e.pend.length - 2); else st.bad = true; }
    }
    // keep the picture near the live edge
    every(() => {
      for(const e of recvs.values()){
        const v = e.el; if(e.path !== 'host' || !v || !e.mse?.sb) continue;
        try{ const b = v.buffered; if(b.length){ const end = b.end(b.length - 1); if(end - v.currentTime > 1.2) v.currentTime = end - 0.3; if(v.paused && v.readyState >= 2) v.play().catch(() => {}); } }catch{}
      }
    }, 500);

    // ---------- incoming signaling ----------
    // buf: payload of the `rtc` topic. A stranger's, unsealable or malformed message is dropped silently.
    hub.onPacket = async buf => {
      const w = unwrapRtc(buf); if(!w) return;
      const plain = await unseal(o.keys(), w.body, false); if(!plain) return;
      const signed = w.body[1] === 1;   // a verified signature: only the moderators' and the streamer's panels can make one
      let raw; try{ raw = JSON.parse(TD.decode(plain)); }catch{ return; }
      // the open header must repeat what is inside
      const m = cleanRtc(raw); if(!m || m.kind !== w.head.kind || m.sid !== w.head.sid || m.t !== w.head.t || m.from === me) return;
      // the Host stamps the real sender into the header; the body must agree with it (nobody can speak for the streamer or for the Host)
      const hf = w.head.from; if(!hf) return;
      if(m.from === 'host' || hf === 'host'){ if(m.from !== hf) return; }
      else if(m.a !== hf || (m.from === 'streamer') !== (hf === 'streamer')) return;
      if(m.to !== '*' && m.to !== me) return;
      if(m.t === 'tkt'){   // the Host's ticket for /media, made for this connection alone
        if(hf !== 'host') return;
        tickets.set(m.sid, m.tk); if(tickets.size > 100) tickets.delete(tickets.keys().next().value);
        return;
      }
      if(m.t === 'bye' && m.from === 'host' && w.head.from === 'host'){   // the Host cut the stream off (permission taken back, the streamer pressed stop)
        if(sources.has(m.sid)) hub.stop(m.sid);
        for(const x of [...recvs.values()]) if(x.sid === m.sid) closeRecv(x);
        return;
      }
      const src = sources.get(m.sid);
      if(src){   // we are the sender of this sid: answers, candidates and wishes come from receivers
        if(m.t === 'want') return onWant(m);
        const p = src.peers.get(m.from);
        if(!p || p.addr !== m.a) return;
        if(m.t === 'answer' && p.pc.signalingState === 'have-local-offer') p.pc.setRemoteDescription({ type:'answer', sdp:m.sdp }).catch(() => {});
        else if(m.t === 'ice') p.pc.addIceCandidate(m.cand).catch(() => {});
        else if(m.t === 'bye') closePeer(src, m.from);
        return;
      }
      if(m.t === 'want'){ onWant(m); return; }   // a discovery `want` carries a sid of the receiver's own making
      if(m.t === 'have'){ if(signed && m.a === 'streamer'){ bgSids.set(m.sid, m.bg); if(bgSids.size > 100) bgSids.delete(bgSids.keys().next().value); sendWants(); change(); } return; }
      if(m.t === 'offer') return onOffer(m, signed);
      const e = [...recvs.values()].find(x => x.sid === m.sid && x.kind === m.kind);
      if(!e || e.owner !== m.from || e.addr !== m.a || !signed) return;
      if(m.t === 'bye'){ closeRecv(e); return; }
      if(m.t === 'ice'){ if(e.pc?.remoteDescription) e.pc.addIceCandidate(m.cand).catch(() => {}); else if(e.icePend.length < 30) e.icePend.push(m.cand); }
    };

    // ---------- what the page paints ----------
    // → { stream } | { url } | null for a layer of this owner and kind. Own capture is shown without the network.
    hub.streamFor = (owner, kind) => {
      if(owner === me){ const s = hub.local(kind); return s ? { stream:s.stream, local:true } : null; }
      const e = recvs.get('main|' + owner + '|' + kind); if(!e) return null;
      if(e.path === 'host' && e.url) return { url:e.url, entry:e };
      return e.stream ? { stream:e.stream, entry:e } : null;
    };
    // how the connection looks: 'direct' | 'host' | 'both' | 'wait' | 'pending' | 'none'
    hub.info = (owner, kind) => {
      if(owner === me){
        const s = hub.local(kind); if(!s) return null;
        if(s.pending) return { path:'pending', ms:null, peers:0 };
        const peers = [...s.peers.values()]; const ok = peers.filter(p => p.state === 'connected');
        const p2 = s.rec && now() < s.p2Until;
        return { path:ok.length ? (p2 ? 'both' : 'direct') : p2 ? 'host' : 'wait', ms:ok.length ? Math.max(...ok.map(p => p.rtt ?? 0)) : null, peers:peers.length + (p2 ? 1 : 0) };
      }
      const e = recvs.get('main|' + owner + '|' + kind); return e ? { path:e.path, ms:e.ms } : null;
    };
    // The background copy of somebody's screen (panel only) → { stream } | { url } | null
    hub.bgFor = () => {
      // the backdrop copy, or the streamer's screen we already receive for a layer (one connection per sender serves both)
      let e = [...recvs.values()].find(x => x.purpose === 'bg' && x.kind === 'screen');
      if(!e){ const m = recvs.get('main|streamer|screen'); if(m && bgSids.get(m.sid)) e = m; }   // only when its owner offers it as a backdrop
      if(!e) return null;
      if(e.path === 'host' && e.url) return { url:e.url, entry:e, owner:e.owner };
      return e.stream ? { stream:e.stream, entry:e, owner:e.owner } : null;
    };
    // Put a stream (or nothing) into a <video>. Sound only when asked: the local copy never plays its own microphone back.
    hub.bind = (v, r, opts = {}) => {
      const key = r ? (r.stream || r.url) : null;
      if(v._src !== key){
        v._src = key;
        if(r?.stream){ v.removeAttribute('src'); v.srcObject = r.stream; }
        else if(r?.url){ v.srcObject = null; v.src = r.url; }
        else { v.srcObject = null; v.removeAttribute('src'); v.load?.(); }
        if(r) v.play?.().catch(() => { v.muted = true; v.play().catch(() => {}); });
      }
      if(r?.entry) r.entry.el = v;
      v.muted = !!(opts.muted || r?.local || opts.kind !== 'mic');   // sound only from a microphone: a camera and a screen are never played aloud
      if(opts.volume != null) v.volume = Math.min(1, Math.max(0, opts.volume));
      return !!r;
    };
    hub.paint = (node, el, opts = {}) => {
      const v = node.querySelector('video.content'); if(!v) return false;
      const ok = hub.bind(v, hub.streamFor(el.owner, el.kind), { ...opts, kind:el.kind });
      if(!v._rs){ v._rs = true; v.addEventListener('resize', () => { if(v.videoWidth && v.videoHeight){ v._ar = v.videoWidth + ' / ' + v.videoHeight; if(!(node._el?.hh > 0)) v.style.aspectRatio = v._ar; } }); }
      node.classList.toggle('nosig', !ok);
      return ok;
    };
    hub.close = () => { hub.stopAll(); for(const e of [...recvs.values()]) closeRecv(e); };
    hub.shutdown = () => { quiet = true; hub.close(); for(const t of timers.splice(0)) clearInterval(t); for(const s of sources.values()) clearTimeout(s.tkWait); };
    return hub;
  }

  root.HudiniMedia = { KINDS, QUALITY, supported, devices, capture, createHub, wrapRtc, unwrapRtc, cleanRtc, cleanSdp, parseCand, ipOk, candOk, stripCands, pickMime,
    setAllowIp(f){ allowIp = typeof f === 'function' ? f : ipOk; }, newSid };
})(typeof window !== 'undefined' ? window : globalThis);
