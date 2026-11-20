// Пульт: «Трансляция» (камера, экран, микрофон), показ чужих потоков в слоях и экран стримера фоном под холстом.
// Загружается после moderator.js (boot.js): его общие переменные (room, KEYS, client, state, nodes, topics, addEl…) берутся только при вызове.
// Захват, WebRTC и запасной путь через Host: shared/media.js.
(function(){
  'use strict';
  const M = window.HudiniMedia;
  if(!M) return;
  const tr = s => window.HudiniI18n ? window.HudiniI18n.t(s) : s;
  const KIND_ICO = { cam:'📷', screen:'🖥', mic:'🎙' }, KIND_NAME = { cam:'Камера', screen:'Экран', mic:'Микрофон' };
  const BTN = { cam:'bcCam', screen:'bcScreen', mic:'bcMic' };
  const isStreamer = () => document.body.classList.contains('streamer-panel');
  // стример показывает своё без спроса, модератору нужно разрешение (streamer.js)
  const canShare = kind => isStreamer() || window.hudiniMediaOk?.(kind) === true;
  const pref = (k, d) => { const v = lsGet('overlay.' + k, d); return typeof v === 'boolean' ? v : d; };
  let hub = null, hubRoom = null, devPick = {}, listSig = '';

  function ensureHub(){
    if(!room || !KEYS) return null;
    if(hub && hubRoom === room) return hub;
    hub?.shutdown(); listSig = ''; $('bcList')?.replaceChildren();
    hubRoom = room;
    // the streamer's panel is "streamer" for everybody; a moderator is known by his own id
    const str = isStreamer();
    hub = M.createHub({
      id:str ? 'streamer' : clientId, keys:() => KEYS, sign:true, now:nowMs,
      addr:() => str ? 'streamer' : 'm:' + (client?.options?.clientId || clientId + 'h'),
      publish:b => { if(client?.connected) client.publish(topics(room).base + '/rtc', b, { qos:0 }); },
      // тот же адрес, что у MQTT, только путь /media: сокет открывается к Hudini Host стримера
      mediaUrl:sid => homeInfo && /^wss?:\/\/.+\/mqtt$/.test(homeInfo.url) ? homeInfo.url.replace(/\/mqtt$/, '/media?sid=' + encodeURIComponent(sid)) : '',
      mediaAuth:() => !homeInfo ? null : str ? { u:'streamer', p:String(homeInfo.pass || '') } : { u:'mod', p:String(homeInfo.pass || ''), c:client?.options?.clientId || '' },
      forceP2:() => window.__hudiniForceP2 === true || qs.has('p2'),
      desired, onChange:() => { repaint(); ui(); },
    });
    return hub;
  }
  // Какие чужие потоки нам нужны: те, что стоят слоем (кроме запрещённых стримером), и экран стримера под холстом. Микрофоны не слушаем.
  function desired(){
    const out = [], seen = new Set();
    for(const e of state.els){
      if(e.type !== 'stream' || e.owner === hub?.id || e.kind === 'mic' || window.hudiniPermOff?.(e)) continue;
      const k = e.owner + '|' + e.kind; if(seen.has(k)) continue; seen.add(k); out.push({ owner:e.owner, kind:e.kind, purpose:'main' });
    }
    if(!isStreamer() && pref('bgView', true) && !out.some(d => d.kind === 'screen')) out.push({ owner:'', kind:'screen', purpose:'bg' });
    return out;
  }
  const infoText = (info, own) => {
    if(!info) return '';
    if(info.path === 'direct') return tr('прямое') + (info.ms != null ? ' · ' + info.ms + ' ' + tr('мс') : '');
    if(info.path === 'host' || info.path === 'both') return tr('через Host') + ' · ~1 ' + tr('с');
    if(info.path === 'pending') return tr('ждёт подтверждения стримера');
    if(info.path === 'wait') return own ? tr('ждёт приёмника') : tr('подключаюсь…');
    return tr('нет связи');
  };
  // как слой рисуется в пульте: картинка, заглушка «нет сигнала» и строка с путём и задержкой
  window.streamPaint = (node, el) => {
    const h = ensureHub(); if(!h) return;
    h.paint(node, el, { muted:true });
    node.dataset.nosig = tr('нет сигнала');
    let tag = node.querySelector(':scope > .sinfo');
    if(!tag){ tag = document.createElement('div'); tag.className = 'sinfo'; tag.setAttribute('data-i18n-skip', ''); node.appendChild(tag); }
    const t = infoText(h.info(el.owner, el.kind), el.owner === h.id);
    if(tag.textContent !== t) tag.textContent = t;
  };
  function repaint(){
    if(typeof nodes === 'undefined') return;
    for(const n of nodes.values()) if(n._el?.type === 'stream') paintNode(n, n._el, n._z);
    paintBg();
  }
  // экран стримера подложкой под слоями (у каждого модератора своя галочка)
  function paintBg(){
    const v = $('streamBg'); if(!v) return;
    const r = hub && pref('bgView', true) ? hub.bgFor() : null;
    if(hub) hub.bind(v, r, { muted:true });
    v.hidden = !r;
  }

  // ---------- захват ----------
  function errText(e){
    const n = e?.name || '';
    if(n === 'NotSupportedError' || e?.message === 'unsupported') return 'В этой системе это не поддерживается';
    if(n === 'NotAllowedError' || n === 'SecurityError') return 'Доступ не разрешён: проверь разрешения системы и браузера';
    if(n === 'NotFoundError' || n === 'OverconstrainedError') return 'Устройство не найдено';
    if(n === 'NotReadableError') return 'Устройство занято другой программой';
    return 'Не удалось начать трансляцию';
  }
  async function start(kind, deviceId){
    if(!canShare(kind)){ toast('Стример не разрешил'); return; }
    const h = ensureHub(); if(!h){ toast('Нет связи с Hudini Host'); return; }
    let stream;
    try{ stream = await M.capture(kind, { deviceId }); }
    catch(e){ if(e?.name !== 'AbortError') toast(errText(e), 4500); return; }
    await h.share(kind, stream, { bg:kind === 'screen' && isStreamer() && pref('bgShare', false) });
    if(!state.els.some(e => e.type === 'stream' && e.owner === h.id && e.kind === kind)){
      addEl({ type:'stream', owner:h.id, kind, ...place(), w:kind === 'cam' ? 25 : kind === 'screen' ? 60 : 20, sound:kind === 'mic', vol:1 });
    }
    ui(); refreshDevices(kind);
  }
  function stop(kind){ hub?.stopKind(kind); ui(); repaint(); }
  async function refreshDevices(kind){
    if(kind === 'screen') return;
    try{ const d = await M.devices(kind); const sel = document.querySelector(`#bcList [data-kind="${kind}"] select`); if(!sel) return;
      sel.replaceChildren(...d.map(x => { const o = document.createElement('option'); o.value = x.id; o.textContent = x.label; o.selected = x.id === devPick[kind]; return o; }));
    }catch{}
  }

  // ---------- интерфейс ----------
  function ui(){
    if(!$('bcCam')) return;
    const own = hub ? [...hub.sources.values()] : [];
    for(const kind of M.KINDS){
      const b = $(BTN[kind]); if(!b) continue;
      const ok = canShare(kind), sup = M.supported(kind), on = own.some(s => s.kind === kind);
      b.classList.toggle('on', on);
      b.disabled = !on && (!ok || !sup);
      b.title = !sup ? tr('В этой системе это не поддерживается') : !ok ? tr('Стример не разрешил') : on ? tr('Остановить') : '';
    }
    const sig = own.map(s => s.kind).sort().join();
    const box = $('bcList');
    if(sig !== listSig){
      listSig = sig; box.replaceChildren();
      for(const s of own.sort((a, b) => M.KINDS.indexOf(a.kind) - M.KINDS.indexOf(b.kind))){
        const r = document.createElement('div'); r.className = 'bcrow'; r.dataset.kind = s.kind;
        const n = document.createElement('span'); n.className = 'bcn'; n.textContent = KIND_ICO[s.kind] + ' ' + tr(KIND_NAME[s.kind]);
        r.appendChild(n);
        if(s.kind !== 'screen'){
          const sel = document.createElement('select'); sel.className = 'bcdev'; sel.setAttribute('data-i18n-skip', '');
          sel.onchange = () => { devPick[s.kind] = sel.value; start(s.kind, sel.value); };
          r.appendChild(sel);
        }
        const p = document.createElement('span'); p.className = 'bcp hint'; p.setAttribute('data-i18n-skip', ''); r.appendChild(p);
        const x = document.createElement('button'); x.className = 'bcstop'; x.textContent = '■'; x.title = tr('Остановить');
        x.onclick = () => stop(s.kind); r.appendChild(x);
        box.appendChild(r);
        refreshDevices(s.kind);
      }
    }
    for(const r of box.children){
      const t = infoText(hub.info(hub.id, r.dataset.kind), true), p = r.querySelector('.bcp');
      if(p.textContent !== t) p.textContent = t;
    }
    $('bcBgShareRow').hidden = !isStreamer();
    $('bcBgShare').checked = pref('bgShare', false);
    $('bcBgView').checked = pref('bgView', true);
    const hint = !isStreamer() && !canShare('cam') && !canShare('screen') && !canShare('mic') ? tr('Стример не разрешил модераторам камеру, экран и микрофон: включается ползунками в Hudini Host.') : '';
    if($('bcHint').textContent !== hint) $('bcHint').textContent = hint;
  }
  for(const kind of M.KINDS){
    const b = $(BTN[kind]);
    if(b) b.onclick = () => { if(hub?.local(kind)) stop(kind); else start(kind, devPick[kind]); };
  }
  $('bcBgShare').onchange = () => {
    lsSet('overlay.bgShare', $('bcBgShare').checked);
    const s = hub?.local('screen'); if(s) hub.setBg(s.sid, $('bcBgShare').checked);
  };
  $('bcBgView').onchange = () => { lsSet('overlay.bgView', $('bcBgView').checked); hub?.refresh(); paintBg(); };
  setInterval(() => {
    if(hub && hubRoom !== room){ hub.shutdown(); hub = null; hubRoom = null; listSig = ''; $('bcList').replaceChildren(); }
    ui(); if(hub){ for(const n of nodes.values()) if(n._el?.type === 'stream') window.streamPaint(n, n._el); paintBg(); }
  }, 1000);

  window.hudiniBroadcast = {
    // payload of the `rtc` topic (moderator.js onMessage)
    onPacket(buf){ ensureHub()?.onPacket(buf); },
    // topic `media` from the Host (sealed): the answer to our request to show something, or the end of a stream
    async onMedia(buf){
      const m = await unsealJSON(KEYS, buf, false); const h = ensureHub();
      if(!m || !h || typeof m !== 'object' || m.cid !== client?.options?.clientId || !M.KINDS.includes(m.kind)) return;
      if(m.ev === 'pending'){ h.setPending(m.kind, true); toast('Ждём подтверждения стримера', 3000); }
      else if(m.ev === 'ok'){ h.reoffer(m.kind); toast('Стример разрешил', 2500); }
      else if(m.ev === 'no' || m.ev === 'bye'){
        h.stopKind(m.kind);
        toast(m.why === 'perm' ? 'Стример не разрешил' : m.why === 'denied' ? 'Стример отклонил' : m.why === 'busy' ? 'Слишком много запросов: попробуй позже' : 'Трансляция остановлена', 4500);
      }
      ui();
    },
    // after every redraw: start the streams that layers need, let go of the rest
    refresh(){ if(hub || state.els.some(e => e.type === 'stream')) ensureHub()?.refresh(); },
    // the streamer changed the permissions: stop what is no longer allowed
    perms(){
      if(hub) for(const kind of M.KINDS) if(hub.local(kind) && !canShare(kind)){ hub.stopKind(kind); toast('Стример отозвал разрешение: трансляция остановлена', 4500); }
      hub?.refresh(); ui(); repaint();
    },
    get hub(){ return hub; },
  };
  ui();
})();
