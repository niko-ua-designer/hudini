// Program sounds (Hudini Host window and the moderator side of the app). Six quiet sounds from shared/sounds/.
// The caller decides whether sounds are switched on; this file only plays them without piling one on another.
// The OBS widget never loads this file: nothing here may be heard on stream.
(function(){
  'use strict';
  const NAMES = ['request', 'error', 'update', 'join', 'leave', 'ok'];   // by importance
  const BASE = new URL('sounds/', document.currentScript.src).href;
  const GAP = 1500;   // ms between the starts of two sounds
  const cache = {};
  let last = -Infinity, lastName = '', next = '', timer = 0;
  // fetched and played from a blob: not every web view streams media from the app's own protocol
  const load = name => cache[name] ||= fetch(BASE + name + '.wav')
    .then(r => { if(!r.ok) throw new Error('sound ' + r.status); return r.blob(); })
    .then(b => { const a = new Audio(URL.createObjectURL(new Blob([b], { type:'audio/wav' }))); a.dataset.sound = name; return a; })
    .catch(e => { delete cache[name]; throw e; });
  function start(name){
    last = performance.now(); lastName = name;
    load(name).then(a => { a.currentTime = 0; return a.play(); }).catch(e => console.warn('sound', name, e?.message || e));
  }
  // Right after another sound only the most important newcomer waits for its turn; a repeat of the same one is dropped
  function play(name){
    if(!NAMES.includes(name)) return;
    const wait = last + GAP - performance.now();
    if(wait <= 0 && !timer) return start(name);
    if(name === lastName || next && NAMES.indexOf(next) <= NAMES.indexOf(name)) return;
    next = name;
    timer ||= setTimeout(() => { const n = next; timer = 0; next = ''; start(n); }, Math.max(0, wait));
  }
  // The moderator side keeps its own switch (HudiniStore, null until asked). The streamer's panel window on the Host's
  // computer stays silent: the Host window already plays the sounds there.
  const KEY = 'hudini.sounds', LOST_MS = 2500;
  const answer = () => { const v = window.HudiniStore?.get(KEY); return typeof v === 'boolean' ? v : null; };
  const muted = () => answer() !== true || !!document.body?.classList.contains('streamer-panel');
  const event = name => { if(!muted()) play(name); };
  function setOn(on){
    window.HudiniStore?.set(KEY, !!on);
    if(on) play('ok');   // switching sounds on plays one as a preview
  }
  // Connection to the streamer: «ok» when it comes up, «error» when it stays lost for a moment (a quick reconnect is silent)
  let up = false, lost = 0;
  function link(connected){
    if(connected){
      clearTimeout(lost); lost = 0;
      if(!up){ up = true; event('ok'); }
    } else if(up && !lost) lost = setTimeout(() => { up = false; lost = 0; event('error'); }, LOST_MS);
  }
  window.HudiniSounds = { play, event, link, answer, setOn, NAMES };
})();
