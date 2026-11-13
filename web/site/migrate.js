// Moving page (moderator.html): finds the old website panel's data in this browser and saves it as the same password-protected
// backup file the panel makes (⚙ Room → Backup), so the app's "From backup" opens it. Everything happens in the browser.
(() => {
  'use strict';
  const M = window.HUDINI_MIGRATE;
  const $ = id => document.getElementById(id);
  const TE = new TextEncoder(), TD = new TextDecoder();
  const KEYS = { vault: 'overlay.vault2', lib: 'overlay.lib', anims: 'overlay.anims', scenes: 'overlay.scenes', scn: 'overlay.scn' };

  // The same box format as lockJSON/unlockJSON in shared/core.js (PBKDF2 310000 × SHA-256 → AES-GCM)
  const b64u = {
    enc(buf){ let s = ''; const b = new Uint8Array(buf); for(let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec(str){ const s = atob(String(str).replace(/-/g, '+').replace(/_/g, '/')); const b = new Uint8Array(s.length); for(let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; },
  };
  async function passKey(pass, salt){
    const base = await crypto.subtle.importKey('raw', TE.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function lockJSON(pass, obj){
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await passKey(pass, salt), TE.encode(JSON.stringify(obj)));
    return { v: 1, salt: b64u.enc(salt), iv: b64u.enc(iv), ct: b64u.enc(ct) };
  }
  async function unlockJSON(pass, box){
    try{ const d = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64u.dec(box.iv) }, await passKey(pass, b64u.dec(box.salt)), b64u.dec(box.ct)); return JSON.parse(TD.decode(d)); }
    catch{ return null; }
  }

  // rc.4 kept raw "overlay.*" keys; later builds of the site panel prefix them with "store:"
  function read(key){
    for(const k of [key, 'store:' + key]){
      try{ const v = localStorage.getItem(k); if(v != null) return JSON.parse(v); }catch{}
    }
    return null;
  }
  const lists = o => o && typeof o === 'object' && !Array.isArray(o) ? Object.values(o).filter(Array.isArray) : [];
  function load(){
    const vault = read(KEYS.vault);
    return {
      vault,
      lib: read(KEYS.lib), anims: read(KEYS.anims), scenes: read(KEYS.scenes), scn: read(KEYS.scn),
    };
  }
  function pack(src, rooms){
    return {
      rooms: Array.isArray(rooms) ? rooms : [],
      library: Array.isArray(src.lib) ? src.lib : [],
      anims: Array.isArray(src.anims) ? src.anims : [],
      scenes: src.scenes && typeof src.scenes === 'object' && !Array.isArray(src.scenes) ? src.scenes : {},
      scenarios: src.scn && typeof src.scn === 'object' && !Array.isArray(src.scn) ? src.scn : {},
    };
  }
  const counts = d => ({
    rooms: d.rooms.length, lib: d.library.length, anims: d.anims.length,
    scenes: lists(d.scenes).reduce((n, l) => n + l.length, 0), scn: lists(d.scenarios).reduce((n, l) => n + l.length, 0),
  });
  const total = c => c.rooms + c.lib + c.anims + c.scenes + c.scn;

  let lang = 'en', src = null, openData = null, panelPass = null;
  const t = () => M[lang] || M.en;

  function text(){
    document.title = t().title;
    for(const el of document.querySelectorAll('[data-m]')){ const v = t()[el.dataset.m]; if(typeof v === 'string') el.innerHTML = v; }
    draw();
  }

  function summary(c){
    const k = t();
    return `<p class="mig-found">${k.found}</p><ul class="mig-count">` + [['rooms', 'kRooms'], ['lib', 'kLib'], ['anims', 'kAnims'], ['scenes', 'kScenes'], ['scn', 'kScn']]
      .filter(([a]) => c[a]).map(([a, kk]) => `<li>${k[kk]}: <b>${c[a]}</b></li>`).join('') + '</ul>';
  }
  function draw(){
    const box = $('scan'), k = t(); if(!box || !src) return;
    const vault = src.vault;
    const hasLocked = !!(vault && vault.locked);
    const rooms = vault && vault.plain && Array.isArray(vault.plain.rooms) ? vault.plain.rooms : [];
    const base = pack(src, openData ? openData.rooms : rooms);
    const c = counts(base);
    const nothing = !hasLocked && total(c) === 0;
    if(nothing){ box.innerHTML = `<p class="mig-none"><b>${k.none}</b></p><p>${k.noneP}</p>`; return; }
    let html = '';
    if(hasLocked && !openData){
      html = `<p>${k.lockedP}</p><label class="mig-f"><span>${k.passPanel}</span><input id="pPanel" type="password" autocomplete="current-password"></label>`;
    } else {
      html = summary(c);
      if(!hasLocked) html += `<p>${k.newPassP}</p><label class="mig-f"><span>${k.passNew}</span><input id="pNew" type="password" autocomplete="new-password"></label><label class="mig-f"><span>${k.passNew2}</span><input id="pNew2" type="password" autocomplete="new-password"></label>`;
    }
    html += `<p class="mig-err" id="err" role="alert"></p><button class="btn primary" id="saveBtn" type="button">${k.save}</button><p class="mig-ok" id="ok" hidden></p>`;
    const keep = { panel: $('pPanel')?.value, n: $('pNew')?.value, n2: $('pNew2')?.value };
    box.innerHTML = html;
    if($('pPanel') && keep.panel) $('pPanel').value = keep.panel;
    if($('pNew') && keep.n) $('pNew').value = keep.n;
    if($('pNew2') && keep.n2) $('pNew2').value = keep.n2;
    $('saveBtn').onclick = onSave;
    for(const id of ['pPanel', 'pNew', 'pNew2']) $(id)?.addEventListener('keydown', e => { if(e.key === 'Enter') onSave(); });
  }

  async function onSave(){
    const k = t(), err = $('err'), btn = $('saveBtn'); err.textContent = '';
    try{
      let pass, rooms;
      if(src.vault && src.vault.locked){
        if(!openData){
          const typed = $('pPanel')?.value || '';
          btn.disabled = true; btn.textContent = k.saving;
          const d = await unlockJSON(typed, src.vault.locked);
          btn.disabled = false; btn.textContent = k.save;
          if(!d){ err.textContent = k.errWrong; return; }
          openData = d; panelPass = typed; draw();   // now the counts are visible; the next click saves
          return;
        }
        pass = panelPass; rooms = Array.isArray(openData.rooms) ? openData.rooms : [];
      } else {
        pass = $('pNew').value;
        if(pass.length < 6){ err.textContent = k.errShort; return; }
        if(pass !== $('pNew2').value){ err.textContent = k.errMatch; return; }
        rooms = src.vault?.plain?.rooms || [];
      }
      btn.disabled = true; btn.textContent = k.saving;
      const data = pack(src, rooms);
      const boxed = await lockJSON(pass, data);
      const blob = new Blob([JSON.stringify({ overlayBackup: 2, box: boxed })], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'overlay-backup.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      btn.disabled = false; btn.textContent = k.save;
      const ok = $('ok'); ok.textContent = k.done; ok.hidden = false;
    }catch(e){ console.warn(e); err.textContent = k.errRead; btn.disabled = false; btn.textContent = k.save; }
  }

  try{ src = load(); }catch{ src = { vault: null }; }
  const pick = () => document.documentElement.lang;
  function sync(){ const l = pick(); if(M[l]) lang = l; text(); }
  // site.js sets <html lang> and fills the language picker; follow its changes
  for(const s of document.querySelectorAll('select.lang')) s.addEventListener('change', () => setTimeout(sync, 0));
  sync();
})();
