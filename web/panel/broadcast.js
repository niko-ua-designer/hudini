// Пульт: «Трансляция» (камера, экран, микрофон), показ чужих потоков в слоях и фон от стримера под холстом (экран или камера OBS).
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
  // Какие чужие потоки нам нужны: те, что стоят слоем (кроме запрещённых стримером), и фон от стримера под холстом. Микрофоны не слушаем.
  function desired(){
    const out = [], seen = new Set();
    for(const e of state.els){
      if(e.type !== 'stream' || e.owner === hub?.id || e.kind === 'mic' || window.hudiniPermOff?.(e)) continue;
      const k = e.owner + '|' + e.kind; if(seen.has(k)) continue; seen.add(k); out.push({ owner:e.owner, kind:e.kind, purpose:'main' });
    }
    if(!isStreamer() && pref('bgView', true) && hub?.askBackdrop(seen.has('streamer|screen')) !== false) out.push({ owner:'', kind:'screen', purpose:'bg' });
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
  // картинка от стримера подложкой под слоями (у каждого модератора своя галочка)
  function paintBg(){
    const v = $('streamBg'); if(!v) return;
    const r = hub && pref('bgView', true) ? hub.bgFor() : null;
    if(hub) hub.bind(v, r, { muted:true });
    v.hidden = !r;
    // пока живая картинка есть, превью Twitch (или скриншот) под ней убрано; пропала — возвращается, плеер загружается заново
    const live = !!r && v.videoWidth > 0, stage = $('stage');
    if(stage.classList.contains('live-bg') === live) return;
    stage.classList.toggle('live-bg', live);
    const f = !live && $('bgLayer').querySelector('iframe'); if(f) f.src = f.src;
  }
  $('streamBg').addEventListener('resize', paintBg);

  // ---------- фон для модераторов: экран или камера (OBS Virtual Camera), только в пульте стримера ----------
  const bgSource = () => lsGet('overlay.bgSource', 'screen') === 'cam' ? 'cam' : 'screen';
  const savedCam = () => { const c = lsGet('overlay.bgCam', null); return c && typeof c === 'object' ? c : null; };
  let cams = null, camBusy = false;   // cams: ответ M.cameras(), пока не спрашивали: null
  async function loadCams(ask){
    try{ cams = await M.cameras({ ask }); }
    catch(e){ cams = { list:[], hidden:false, error:e }; }
    paintCams(); ui();
  }
  function paintCams(){
    const sel = $('bcBgCam'), list = cams?.list || [], pick = M.pickCamera(list, savedCam());
    const opt = (v, text) => { const o = document.createElement('option'); o.value = v; o.setAttribute('data-i18n-skip', ''); o.textContent = text; return o; };
    sel.replaceChildren(...(pick ? [] : [opt('', (!list.length && savedCam()?.label) || tr('Выбери камеру'))]), ...list.map(d => opt(d.id, d.label)));
    sel.value = pick?.id || '';
  }
  async function startBackdrop(){
    if(!isStreamer() || camBusy) return;
    const h = ensureHub(); if(!h){ toast('Нет связи с Hudini Host'); return; }
    camBusy = true; ui();
    try{
      await loadCams(true);
      const d = cams.list.find(x => x.id === $('bcBgCam').value);
      if(!d){ toast(cams.error ? errText(cams.error) : 'Камера не выбрана', 4500); return; }
      const stream = await M.capture('cam', { deviceId:d.id, quality:M.QUALITY.obs });
      // пока камера открывалась, могли смениться комната или источник
      if(h !== hub || bgSource() !== 'cam'){ stream.getTracks().forEach(t => t.stop()); return; }
      lsSet('overlay.bgCam', { id:d.id, label:d.label });
      h.shareBackdrop(stream);
    }catch(e){ toast(errText(e), 4500); }
    finally{ camBusy = false; ui(); }
  }
  function bgUi(){
    const str = isStreamer(), cam = bgSource() === 'cam', live = hub?.backdrop();
    $('bcBack').hidden = !str;
    $('bcBgViewRow').hidden = str;
    $('bcBgShareRow').hidden = !str || cam;
    $('bcBgCamBox').hidden = !cam;
    $('bcBgSrc').value = bgSource();
    $('bcBgShare').checked = pref('bgShare', false);
    $('bcBgView').checked = pref('bgView', true);
    if(!str || !cam) return;
    if(!cams){ cams = { list:[], hidden:true, error:null }; loadCams(false); return; }   // без запроса доступа: только по клику
    const go = $('bcBgCamGo'), label = tr(live ? '■ Остановить фон' : '▶ Показать модераторам');
    if(go.dataset.label !== label){ go.dataset.label = label; go.textContent = label; }   // по dataset: значки заменяют эмодзи в тексте кнопки
    go.classList.toggle('on', !!live);
    go.disabled = !live && (camBusy || !M.supported('cam'));
    const none = !cams.hidden && !cams.list.some(d => M.isObsCam(d.label));
    const text = !M.supported('cam') ? tr('В этой системе это не поддерживается')
      : live ? tr('Фон включён: на стрим эта картинка не идёт') + ' · ' + infoText(hub.backdropInfo(), true)
      : cams.error && !cams.list.length ? tr(errText(cams.error))
      : none ? tr('OBS Virtual Camera не найдена: нажми в OBS «Запустить виртуальную камеру» или выбери другую камеру.')
      : tr('Сначала нажми в OBS «Запустить виртуальную камеру».');
    const st = $('bcBgCamState');
    if(st.textContent !== text) st.textContent = text;
    st.classList.toggle('warn', !live && none);
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
    await h.share(kind, stream, { bg:kind === 'screen' && isStreamer() && bgSource() === 'screen' && pref('bgShare', false) });
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
    const own = hub ? [...hub.sources.values()].filter(s => !s.bgOnly) : [];
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
    bgUi();
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
  // источник один: выбрали камеру — экран перестаёт быть фоном (на стриме он остаётся), и наоборот
  $('bcBgSrc').onchange = () => {
    const cam = $('bcBgSrc').value === 'cam';
    lsSet('overlay.bgSource', cam ? 'cam' : 'screen');
    if(!cam) hub?.stopBackdrop();
    const s = hub?.local('screen'); if(s) hub.setBg(s.sid, !cam && pref('bgShare', false));
    if(cam) loadCams(true);
    ui();
  };
  $('bcBgCam').onchange = () => {
    const d = cams?.list.find(x => x.id === $('bcBgCam').value); if(!d) return;
    lsSet('overlay.bgCam', { id:d.id, label:d.label });
    if(hub?.backdrop()) startBackdrop(); else { paintCams(); ui(); }
  };
  $('bcBgCamGo').onclick = () => { if(hub?.backdrop()){ hub.stopBackdrop(); ui(); } else startBackdrop(); };
  navigator.mediaDevices?.addEventListener?.('devicechange', () => { if(cams && isStreamer() && bgSource() === 'cam') loadCams(false); });
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
      if(m.ev === 'pending'){ h.setPending(m.kind, true); toast('Ждём подтверждения: стример увидит запрос в окне Hudini Host и в панели OBS', 6000); }
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
