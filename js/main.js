// Entry page with a 3D grand piano; "Take a seat" moves the camera to the
// keyboard, the chosen piece plays, and the profile plays as a slideshow over
// the keys. Visitors can switch pieces from the repertoire at any time.
(() => {
  'use strict';

  const C = window.CONTENT;
  const GP = window.GrandPiano;
  const REP = window.REPERTOIRE || [];
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SLIDE_MS = 7000;
  let seated = false;
  let audioReady = false;
  let musicWanted = false;
  let chosen = REP.find((p) => p.id === 'moonlight3') || REP[0];
  try {
    const saved = REP.find((p) => p.id === localStorage.getItem('piano-piece'));
    if (saved) chosen = saved;
  } catch (e) { /* storage unavailable */ }

  /* ---------- The performance ---------- */

  // The source files are mechanical (one tempo, mostly one loudness), so the
  // playing is shaped here: the melody sings over the accompaniment, phrases
  // swell and settle, chords can be accented or rolled, and each piece slows
  // a little into its final bars.
  const Music = (() => {
    let piece = null;
    let notes = [];
    let endAt = 0;
    let t0 = 0;
    let idx = 0;
    let timer = 0;
    let playing = false;
    let resumeAt = 0;
    let visual = [];
    let vi = 0; // first note that may still be on screen as light
    let token = 0;
    let onEnd = () => {};

    function loadData(p) {
      if (window.MUSIC && window.MUSIC[p.id]) return Promise.resolve(window.MUSIC[p.id]);
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = `js/music/${p.id}.js`;
        s.onload = () => (window.MUSIC && window.MUSIC[p.id] ? resolve(window.MUSIC[p.id]) : reject(new Error('no data')));
        s.onerror = () => reject(new Error('could not load ' + p.id));
        document.head.appendChild(s);
      });
    }

    function prepare(raw, p) {
      const speed = p.speed || 1;
      const hasDynamics = new Set(raw.map((r) => r[3])).size > 3;
      const onsetCount = new Map();
      for (const r of raw) {
        const k = Math.round(r[0] * 50);
        onsetCount.set(k, (onsetCount.get(k) || 0) + 1);
      }
      const last = raw[raw.length - 1][0] / speed;
      const warp = (t) => (t > last - 6 ? t + 1.1 * Math.pow((t - (last - 6)) / 6, 2) : t);
      const phase = Math.random() * Math.PI * 2;

      // the highest note within a short window carries the melody
      let lo = 0;
      let hi = 0;
      const top = raw.map((r) => {
        while (raw[lo][0] < r[0] - 0.12) lo++;
        while (hi < raw.length - 1 && raw[hi + 1][0] <= r[0] + 0.12) hi++;
        let max = 0;
        for (let k = lo; k <= hi; k++) max = Math.max(max, raw[k][2]);
        return r[2] === max;
      });

      const chordRank = new Map();
      const out = raw.map((r, i) => {
        const [t, sound, midi, v, key] = r;
        const size = onsetCount.get(Math.round(t * 50));
        let at = t / speed;
        const base = hasDynamics ? 0.12 + (v / 127) * 0.6 : p.level;
        let vel = base + (top[i] && midi > 58 ? 0.11 : midi < 50 ? 0.02 : -0.05) + 0.06 * Math.sin((2 * Math.PI * at) / 9 + phase);
        if (p.accents && size >= 3) vel = 0.78 + (midi - 60) * 0.003;
        if (p.roll && size >= 4) {
          const k = Math.round(t * 50);
          const rank = chordRank.get(k) || 0;
          chordRank.set(k, rank + 1);
          at += rank * 0.009;
        }
        const dur = Math.max(sound / speed, 0.08);
        const start = warp(at);
        return { at: start, dur: warp(at + dur) - start, keyDur: Math.max(Math.min(key / speed, dur), 0.06), midi, vel: clamp(vel, 0.08, 0.95) };
      });
      return out.sort((a, b) => a.at - b.at);
    }

    function schedule() {
      const now = GP.now();
      const horizon = now + 1.2;
      while (idx < notes.length) {
        const n = notes[idx];
        const at = t0 + n.at;
        if (at > horizon) break;
        if (at >= now - 0.03) {
          const lift = (Math.random() - 0.5) * 0.008;
          GP.play(n.midi, at + lift, n.dur, clamp(n.vel + (Math.random() - 0.5) * 0.04, 0.06, 1));
          visual.push({ midi: n.midi, on: at + lift, off: at + lift + n.keyDur });
        }
        idx++;
      }
      if (idx >= notes.length && now > t0 + endAt + 2.5) {
        playing = false;
        clearInterval(timer);
        onEnd(piece);
      }
    }

    function start(from) {
      clearInterval(timer);
      t0 = GP.now() + 0.25 - from;
      idx = notes.findIndex((n) => n.at >= from);
      vi = 0;
      if (idx < 0) idx = notes.length;
      playing = true;
      schedule();
      timer = setInterval(schedule, 120);
    }

    function stop(fade) {
      clearInterval(timer);
      playing = false;
      GP.stopAll(fade);
      visual = [];
    }

    // Load a piece and (optionally) play it from the top.
    async function select(p, autoplay = true) {
      const mine = ++token;
      if (playing) stop(0.8);
      piece = p;
      notes = [];
      resumeAt = 0;
      const raw = await loadData(p);
      if (mine !== token) return false;
      notes = prepare(raw, p);
      endAt = notes.reduce((m, n) => Math.max(m, n.at + n.dur), 0);
      if (autoplay) start(0);
      return true;
    }

    function pause() {
      if (!playing) return;
      resumeAt = Math.max(0, GP.now() - t0);
      stop(0.6);
    }

    // Pause, and also call off a piece that is still loading, so it can't start
    // on its own afterwards. The place is kept for picking up again.
    function halt() {
      token++;
      pause();
    }

    function resume() {
      if (!playing && notes.length) start(resumeAt);
    }

    const position = () => (playing ? clamp(GP.now() - t0, 0, endAt) : resumeAt);

    function seek(t) {
      t = clamp(t, 0, Math.max(0, endAt - 0.5));
      if (!playing) { resumeAt = t; return; }
      GP.stopAll(0.12);
      visual = [];
      start(t);
    }

    // Notes about to sound, or sounding, for the falling light above the keys.
    function upcoming(ahead) {
      if (!playing) return [];
      const rel = GP.now() - t0;
      while (vi < notes.length && notes[vi].at + 6 < rel) vi++;
      const out = [];
      for (let k = vi; k < notes.length && notes[k].at <= rel + ahead; k++) {
        const n = notes[k];
        if (n.at + n.keyDur >= rel) out.push({ midi: n.midi, on: t0 + n.at, off: t0 + n.at + Math.min(n.keyDur, 6) });
      }
      return out;
    }

    function pressed() {
      const now = GP.now();
      const set = new Set();
      visual = visual.filter((v) => v.off > now);
      for (const v of visual) if (v.on <= now) set.add(v.midi);
      return set;
    }

    return {
      select, pause, halt, resume, pressed, upcoming, seek, position,
      duration: () => (notes.length ? endAt : 0),
      isPlaying: () => playing,
      current: () => piece,
      loaded: (p) => piece === p && notes.length > 0,
      onEnd: (fn) => { onEnd = fn; },
    };
  })();

  let userPaused = false; // paused from the record player: don't resume on our own
  let pianoHeld = false; // a record's song has the floor: the piano waits until it closes

  // Music plays on the bench, or in a record's player bar; the entry page stays quiet.
  const musicPlace = () => seated || !!(window.Records && Records.isOpen());

  // Pick the chosen piece up where it rested, loading it first if needed.
  // Never over a record's song, or while the visitor is playing the piano themselves.
  function resumeMusic() {
    if (!audioReady || pianoHeld || live.on) return;
    if (Music.loaded(chosen)) Music.resume();
    else Music.select(chosen).catch((err) => console.warn(err));
  }

  function playChosen() {
    musicWanted = true;
    userPaused = false;
    resumeMusic();
  }

  // The visitor left the music behind (back to the entry page): the piece rests, keeping its
  // place for when they return to the bench, and nothing may start it again in the meantime.
  function silence() {
    musicWanted = false;
    Music.halt();
    liveBars = [];
    taps.clear();
  }

  function choose(p) {
    exitPlay(false);
    chosen = p;
    window.Stage && Stage.setMood(p.light);
    try { localStorage.setItem('piano-piece', p.id); } catch (e) { /* storage unavailable */ }
    renderNowPlaying();
    renderRepertoire();
    GP.resume();
    if (musicPlace()) {
      musicWanted = true;
      userPaused = false;
    }
    if (audioReady && musicWanted && !pianoHeld) Music.select(p).catch((err) => console.warn(err));
    else if (Music.isPlaying()) Music.halt(); // never leave the previous piece sounding
  }

  function toggleMusic() {
    GP.resume();
    if (Music.isPlaying()) {
      Music.pause();
      userPaused = true;
    } else {
      playChosen();
    }
  }

  // Like a music player: back to the start of the piece, or to the previous one if already there.
  function prevPiece() {
    if (Music.isPlaying() && Music.position() > 3) return Music.seek(0);
    const i = REP.indexOf(chosen);
    choose(REP[(i - 1 + REP.length) % REP.length]);
  }

  function nextPiece() {
    const i = REP.indexOf(chosen);
    choose(REP[(i + 1) % REP.length]);
  }

  // "Change piece": a random piece, never the one already playing.
  function randomPiece() {
    const others = REP.filter((p) => p !== chosen);
    if (others.length) choose(others[Math.floor(Math.random() * others.length)]);
  }

  Music.onEnd(() => nextPiece());

  /* ---------- Play it yourself ---------- */

  // "Musical typing": the home row plays the white keys, the row above it the black keys.
  const KEYMAP = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17 };
  const KEYCAP = { Semicolon: ';', Quote: "'" };
  const BLACK_STEPS = [1, 3, 6, 8, 10, 13, 15];
  const touchOnly = matchMedia('(hover: none)').matches;
  const live = { on: false, octave: 4, held: new Map(), sustain: false, ringing: new Set(), resumeMusic: false, resumeSlides: false };
  const taps = new Map(); // midi -> when a clicked/tapped key comes back up
  let liveBars = []; // the visitor's notes, drawn rising from the keys
  const labelEls = new Map();
  const baseNote = () => 12 * (live.octave + 1);
  const WHERE = { 1: 'Deep in the bass', 2: 'Down in the bass', 3: 'Just below middle C', 4: 'Around middle C', 5: 'Just above middle C', 6: 'High in the treble' };
  let notesPlayed = 0;
  let nudged = false;
  try { nudged = sessionStorage.getItem('piano-nudged') === '1'; } catch (e) { /* storage unavailable */ }

  function setPlayTitle(text) {
    const el = $('#phTitle');
    if (el.textContent === text) return;
    el.textContent = text;
    if (!reduced) el.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'ease-out' });
  }

  // A gentle, one-time invitation after the visitor has been sitting a while.
  let nudgeTimer = 0;
  function nudge(show) {
    const el = $('#playNudge');
    if (!show) { el.hidden = true; return; }
    if (nudged || live.on || !seated) return;
    // not while a record or the résumé covers the keys: ask again a little later
    if (window.Records?.isOpen() || !$('#score').hidden) {
      clearTimeout(nudgeTimer);
      nudgeTimer = setTimeout(() => nudge(true), 10000);
      return;
    }
    nudged = true;
    try { sessionStorage.setItem('piano-nudged', '1'); } catch (e) { /* storage unavailable */ }
    el.textContent = touchOnly ? 'The keys are real. Tap one?' : 'The keys are real. Sit in for a moment?';
    el.hidden = false;
    setTimeout(() => nudge(false), 9000);
  }

  function buildLabels() {
    const wrap = $('#keyLabels');
    for (const code of Object.keys(KEYMAP)) {
      const el = document.createElement('span');
      el.className = 'key-label' + (BLACK_STEPS.includes(KEYMAP[code]) ? ' black' : '');
      el.textContent = KEYCAP[code] || code.slice(3);
      wrap.appendChild(el);
      labelEls.set(code, el);
    }
  }

  function placeLabels() {
    const base = baseNote();
    for (const [code, el] of labelEls) {
      const p = Stage.project(base + KEYMAP[code]);
      el.style.opacity = p ? '' : '0';
      if (p) el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  function setOctave(o) {
    live.octave = clamp(o, 1, 6);
    $('#phOctave').textContent = WHERE[live.octave];
    if (window.Stage) Stage.setFocus(baseNote() + 7);
  }

  function enterPlay() {
    if (!seated || live.on) return;
    live.on = true;
    GP.resume();
    nudge(false);
    nudged = true;
    notesPlayed = 0;
    setPlayTitle('The piano is yours.');
    closeRepertoire();
    if (document.activeElement) document.activeElement.blur();
    // the piece rests while the visitor plays, even one still loading, and picks up afterwards
    live.resumeMusic = Music.isPlaying() || (musicWanted && !userPaused && !pianoHeld);
    Music.halt();
    live.resumeSlides = !slidePaused;
    setSlidePaused(true);
    setOctave(live.octave);
    document.body.classList.add('is-playing');
    $('#playHud').hidden = false;
    $('#playSelf').setAttribute('aria-pressed', 'true');
    window.Stage && Stage.setMode('play', 1.4);
  }

  function exitPlay(andMusic = true) {
    if (!live.on) return;
    releaseAll();
    live.on = false;
    document.body.classList.remove('is-playing');
    $('#playHud').hidden = true;
    $('#playSelf').setAttribute('aria-pressed', 'false');
    window.Stage && Stage.setMode('seated', 1.4);
    if (live.resumeSlides) setSlidePaused(false);
    if (andMusic && live.resumeMusic && seated) resumeMusic();
  }

  function keyDown(code) {
    if (live.held.has(code)) return;
    const midi = baseNote() + KEYMAP[code];
    const bar = { midi, on: GP.now(), off: null, rise: true };
    liveBars.push(bar);
    live.held.set(code, { midi, bar, voice: GP.noteOn(midi, 0.58 + Math.random() * 0.08) });
    labelEls.get(code).classList.add('on');
    encourage();
  }

  function keyUp(code) {
    const h = live.held.get(code);
    if (!h) return;
    live.held.delete(code);
    h.bar.off = GP.now();
    labelEls.get(code).classList.remove('on');
    if (live.sustain) live.ringing.add(h.voice); // the pedal keeps the string ringing
    else GP.noteOff(h.voice);
  }

  function setSustain(on) {
    live.sustain = on;
    if (on) return;
    for (const v of live.ringing) GP.noteOff(v);
    live.ringing.clear();
  }

  function releaseAll() {
    for (const code of [...live.held.keys()]) keyUp(code);
    setSustain(false);
  }

  // A few kind words once the visitor starts playing.
  function encourage() {
    notesPlayed++;
    if (notesPlayed === 1) setPlayTitle('That’s it. Keep going.');
    else if (notesPlayed === 24) setPlayTitle('Lovely. Take your time.');
  }

  // A key clicked or tapped on the 3D piano.
  function tapKey(midi) {
    if (live.on) encourage();
    GP.resume();
    GP.play(midi, GP.now() + 0.01, 1.4, 0.6);
    taps.set(midi, performance.now() + 220);
    liveBars.push({ midi, on: GP.now(), off: GP.now() + 0.22, rise: true });
  }

  /* ---------- Repertoire panel ---------- */

  const repEl = $('#repertoire');
  const label = (p) => `${p.title}${p.part ? ', ' + p.part : ''}`;
  const surname = (p) => p.composer.split(' ').slice(-1)[0];

  function renderNowPlaying() {
    $('#npText').textContent = `${surname(chosen)} · ${chosen.title}${chosen.part && /^[IV]+\./.test(chosen.part) ? ' · ' + chosen.part.split(' ')[0] : ''}`;
    $('#introPiece').textContent = `${surname(chosen)}, ${label(chosen)}`;
  }

  function renderRepertoire() {
    const group = (p) => p.mood || p.category;
    const groups = [...new Set(REP.map(group))];
    $('#repList').innerHTML = groups.map((g) => `
      <p class="rep-cat">${esc(g)}</p>
      <ul>${REP.filter((p) => group(p) === g).map((p) => `
        <li><button class="rep-item${p === chosen ? ' active' : ''}" data-id="${esc(p.id)}"${p === chosen ? ' aria-current="true"' : ''}>
          <span class="rep-mark" aria-hidden="true"><span class="eq"><i></i><i></i><i></i></span></span>
          <span class="rep-text"><span class="rep-title">${esc(p.title)}</span><span class="rep-sub">${esc(p.composer)} · ${esc(p.part)}</span></span>
          <span class="rep-len">${esc(p.length || '')}</span>
        </button></li>`).join('')}</ul>`).join('');
  }

  function openRepertoire(from) {
    renderRepertoire();
    repEl.classList.toggle('from-bottom', from === 'bottom');
    repEl.classList.toggle('from-player', from === 'player');
    repEl.hidden = false;
    $('#pieceBtn').setAttribute('aria-expanded', 'true');
    (repEl.querySelector('.rep-item.active') || repEl.querySelector('.rep-item'))?.focus();
  }

  function closeRepertoire() {
    if (repEl.hidden) return;
    repEl.hidden = true;
    $('#pieceBtn').setAttribute('aria-expanded', 'false');
  }

  /* ---------- Slides ---------- */

  const projectById = (id) => (C.projects || []).find((p) => p.id === id);
  const slides = C.slides.map((s) => {
    const p = s.project && projectById(s.project);
    if (!p) return s;
    return {
      kicker: `Project · ${p.label}${p.placeholder ? ' · placeholder' : ''}`,
      title: p.title,
      text: p.tagline,
      meta: p.stackLine || (p.stack || []).map((t) => t.name).join(' · '),
      project: p.id,
    };
  });
  const slidesEl = $('#slides');
  const segEls = [];
  let current = -1;
  let slideStart = 0;
  let slidePaused = false;
  let pausedElapsed = 0;

  const pad = (n) => String(n).padStart(2, '0');

  function linkHTML(l) {
    const todo = !l.url || l.url === '#';
    return `<a href="${esc(l.url || '#')}"${todo ? ' class="todo" title="Link coming soon"' : ' target="_blank" rel="noopener"'}>${esc(l.label)}</a>`;
  }

  function slideHTML(s) {
    const links = s.links
      ? `<div class="s-links"><a href="mailto:${esc(C.email)}">Email</a>${C.links.map(linkHTML).join('')}<a href="#" data-act="score">Résumé</a></div>`
      : s.project
        ? `<button class="s-open" data-act="record" data-id="${esc(s.project)}"><span class="s-disc" aria-hidden="true"></span>Open the record</button>`
        : s.at
          ? `<button class="s-open s-resume" data-act="resume" data-at="${esc(s.at)}"><span class="s-page" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3.5h7l4 4V20.5H7z"/><path d="M14 3.5v4h4M9.5 12h6M9.5 15h6M9.5 18h3.5"/></svg></span>See it in the résumé</button>`
          : '';
    return `
      <p class="s-kicker">${esc(s.kicker)}</p>
      <h2 class="s-title">${esc(s.title)}</h2>
      ${s.text ? `<p class="s-text">${esc(s.text)}</p>` : ''}
      ${s.meta ? `<p class="s-meta">${esc(s.meta)}</p>` : ''}
      ${links}`;
  }

  function show(i) {
    const n = slides.length;
    i = (i + n) % n;
    if (i === current) return;
    current = i;
    slidesEl.querySelectorAll('.slide').forEach((old) => {
      old.classList.add('out');
      setTimeout(() => old.remove(), 500);
    });
    const el = document.createElement('div');
    el.className = 'slide';
    el.innerHTML = slideHTML(slides[i]);
    // the whole ticket is a way in: a project opens its record, anything else its place in the résumé
    if (slides[i].project) el.dataset.id = slides[i].project;
    else if (slides[i].at) el.dataset.at = slides[i].at;
    if (el.dataset.id || el.dataset.at) el.classList.add('is-link');
    slidesEl.appendChild(el);
    segEls.forEach((s, k) => {
      s.classList.toggle('done', k < i);
      s.firstChild.style.width = k < i ? '' : '0';
    });
    $('#counter').textContent = `${pad(i + 1)} / ${pad(n)}`;
    const ticket = $('#ticketNo');
    ticket.textContent = pad(i + 1);
    ticket.classList.remove('stamp');
    void ticket.offsetWidth; // restart the stamp
    ticket.classList.add('stamp');
    slideStart = performance.now();
    pausedElapsed = 0;
  }

  function setSlidePaused(p) {
    if (p === slidePaused) return;
    slidePaused = p;
    if (p) pausedElapsed = performance.now() - slideStart;
    else slideStart = performance.now() - pausedElapsed;
    const b = $('#pause');
    b.classList.toggle('paused', p);
    b.setAttribute('aria-label', p ? 'Play slideshow' : 'Pause slideshow');
  }

  function buildSegments() {
    const wrap = $('#segments');
    slides.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'seg';
      b.setAttribute('aria-label', `Slide ${i + 1}: ${s.title}`);
      b.innerHTML = '<i></i>';
      b.addEventListener('click', () => show(i));
      wrap.appendChild(b);
      segEls.push(b);
    });
  }

  /* ---------- Modes ---------- */

  const seatTimers = { music: 0, slides: 0 };

  function takeSeat() {
    if (seated) return;
    seated = true;
    GP.resume();
    document.body.classList.replace('is-intro', 'is-seated');
    window.Stage && Stage.setMode('seated');
    musicWanted = true;
    userPaused = false;
    // the delayed steps check they are still wanted: the visitor may have left the bench already
    clearTimeout(seatTimers.music);
    clearTimeout(seatTimers.slides);
    clearTimeout(nudgeTimer);
    seatTimers.music = setTimeout(() => {
      if (seated && musicWanted && !userPaused && !Music.isPlaying()) resumeMusic();
    }, reduced ? 0 : 1600);
    nudgeTimer = setTimeout(() => nudge(true), 25000);
    const rec = $('#recital');
    rec.hidden = false;
    seatTimers.slides = setTimeout(() => {
      if (!seated) return;
      rec.classList.add('show');
      if (current < 0) show(0);
      else slideStart = performance.now() - pausedElapsed;
    }, reduced ? 0 : 2600);
  }

  // Back to the entry page: the music stops and the notes stop falling.
  function leaveSeat() {
    if (!seated) return;
    exitPlay(false);
    closeRepertoire();
    nudge(false);
    clearTimeout(seatTimers.music);
    clearTimeout(seatTimers.slides);
    clearTimeout(nudgeTimer);
    seated = false;
    silence();
    document.body.classList.replace('is-seated', 'is-intro');
    window.Stage && Stage.setMode('intro', 3);
    $('#recital').classList.remove('show');
    setTimeout(() => { if (!seated) $('#recital').hidden = true; }, 1200);
    $('#seat .seat-label').textContent = 'Return to the bench';
  }

  /* ---------- Frame loop (slides progress + keys) ---------- */

  function frame(now) {
    if (seated && current >= 0) {
      const elapsed = slidePaused ? pausedElapsed : now - slideStart;
      const seg = segEls[current];
      if (seg) seg.firstChild.style.width = clamp(elapsed / SLIDE_MS, 0, 1) * 100 + '%';
      if (!slidePaused && elapsed >= SLIDE_MS) show(current + 1);
    }
    if (window.Stage) {
      const down = Music.isPlaying() ? Music.pressed() : new Set();
      for (const h of live.held.values()) down.add(h.midi);
      for (const [m, until] of taps) {
        if (until > now) down.add(m);
        else taps.delete(m);
      }
      Stage.setPressed(down);
      const clock = GP.smoothNow();
      liveBars = liveBars.filter((b) => b.off === null || clock - b.off < 2.5);
      Stage.setNotes((Music.isPlaying() ? Music.upcoming(1.5) : []).concat(liveBars), clock);
      if (live.on && !touchOnly) placeLabels();
    }
    document.body.classList.toggle('music-on', Music.isPlaying());
    requestAnimationFrame(frame);
  }

  /* ---------- Plain résumé ---------- */

  function renderScore() {
    // `key` names the section for the tickets that lead here (see `at` in content.js)
    const sec = (title, body, key) => `<section class="sc-sec" data-sec="${key}"><h2>${title}</h2>${body}</section>`;
    return `
      <header class="sc-head">
        <h1>${esc(C.name)}</h1>
        <p class="sc-contact" data-sec="contact"><a href="mailto:${esc(C.email)}">${esc(C.email)}</a>${C.links.map((l) => ' · ' + linkHTML(l)).join('')}${C.resume ? ` · <a href="${esc(C.resume)}" target="_blank" rel="noopener">PDF</a>` : ''}</p>
      </header>
      ${C.about ? sec('Summary', `<p>${esc(C.about)}</p>`, 'summary') : ''}
      ${sec('Education', C.education.map((e) => `
        <div class="sc-entry">
          <div class="sc-row"><strong>${esc(e.school)}</strong><span>${esc(e.period)}</span></div>
          <div class="sc-row sc-sub"><span>${esc(e.degree)}</span><span>${esc(e.score)}</span></div>
        </div>`).join(''), 'education')}
      ${C.coursework?.length ? sec('Relevant Coursework', `<p>${C.coursework.map(esc).join(', ')}</p>`, 'coursework') : ''}
      ${sec('Technical Skills', `<dl class="sc-skills">${C.skills.map((g) => `<dt data-key="${esc(g.group)}">${esc(g.group)}</dt><dd data-key="${esc(g.group)}">${g.items.map(esc).join(', ')}</dd>`).join('')}</dl>`, 'skills')}
      ${sec('Experience', C.experience.map((x) => `
        <div class="sc-entry">
          <div class="sc-row"><strong>${esc(x.role)}</strong><span>${esc(x.period)}</span></div>
          <div class="sc-sub">${esc(x.org)}</div>
          <ul>${x.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        </div>`).join(''), 'experience')}
      ${sec('Projects', C.projects.map((p) => {
        const r = p.resume || {};
        const links = (p.links || []).filter((l) => l.url && l.url !== '#').map((l) => ` · ${linkHTML(l)}`).join('');
        return `
        <div class="sc-entry">
          <div class="sc-row"><strong>${esc(r.title || p.title)}${p.placeholder ? '<span class="sc-flag">placeholder</span>' : ''}</strong><span>${esc(p.period || p.year)}</span></div>
          <div class="sc-sub">${esc(r.stack || p.stackLine || (p.stack || []).map((t) => t.name).join(', '))}${links}</div>
          <ul>${(r.bullets || [p.tagline, ...(p.highlights || [])]).map((pt) => `<li>${esc(pt)}</li>`).join('')}</ul>
        </div>`;
      }).join(''), 'projects')}
      ${sec('Achievements', `<ul>${C.achievements.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`, 'achievements')}
      <div class="sc-credits">
        <p>Music on this site is played on the Salamander Grand Piano samples by Alexander Holm (CC BY 3.0), from scores typeset by the Mutopia Project:</p>
        <ul>${REP.map((p) => `<li>${esc(p.composer)}, <em>${esc(label(p))}</em>: <a href="${esc(p.source)}" target="_blank" rel="noopener">source</a>, ${esc(p.licence)}</li>`).join('')}</ul>
      </div>`;
  }

  let scoreOpener = null;
  let scoreResume = false; // the slideshow was running when the résumé opened

  // Open the résumé view. From a ticket, `at` says where to go (see `at` in content.js).
  function openScore(at) {
    if ($('#score').hidden) {
      scoreOpener = document.activeElement;
      // the slideshow waits on the same ticket while the résumé is open
      scoreResume = seated && !slidePaused;
      if (seated) setSlidePaused(true);
    }
    exitPlay(false);
    closeRepertoire();
    $('#scorePaper').innerHTML ||= renderScore();
    $('#score').hidden = false;
    $('#score').scrollTop = 0;
    $('#scoreClose').focus({ preventScroll: true });
    window.Stage && Stage.setPaused(true); // the résumé covers the stage: no need to draw it
    if (typeof at === 'string' && at) requestAnimationFrame(() => goToScore(at));
  }

  // Scroll the résumé to a section and briefly highlight the rows a ticket was about.
  function goToScore(at) {
    const [where, rows = ''] = at.split('/');
    const box = $('#score');
    const sec = $(`#scorePaper [data-sec="${CSS.escape(where)}"]`);
    if (!sec) return;
    const hits = [];
    for (const want of rows.split('|').filter(Boolean)) {
      const keyed = [...sec.querySelectorAll('[data-key]')].filter((el) => el.dataset.key === want);
      if (keyed.length) { hits.push(...keyed); continue; }
      const row = [...sec.querySelectorAll('.sc-entry, li')].find((el) => el.textContent.includes(want));
      if (row) hits.push(row);
    }
    if (!rows) hits.push(sec);
    const top = sec.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - $('.score-bar').offsetHeight - 18;
    box.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
    hits.forEach((el) => { el.classList.remove('sc-hit'); void el.offsetWidth; el.classList.add('sc-hit'); });
    setTimeout(() => hits.forEach((el) => el.classList.remove('sc-hit')), 4000);
  }

  function closeScore() {
    $('#score').hidden = true;
    window.Stage && Stage.setPaused(!!window.Records?.isOpen());
    if (scoreResume) setSlidePaused(false);
    scoreResume = false;
    // back to whatever opened it, if it is still on screen (a slide may have moved on)
    const back = scoreOpener && scoreOpener !== document.body && document.contains(scoreOpener) && scoreOpener.getClientRects().length ? scoreOpener : $('#scoreBtn');
    back.focus({ preventScroll: true });
    scoreOpener = null;
  }

  /* ---------- Controls ---------- */

  function setMuted(m) {
    GP.setMuted(m);
    const b = $('#mute');
    b.classList.toggle('off', m);
    b.setAttribute('aria-pressed', String(m));
    document.body.classList.toggle('muted-music', m);
    try { localStorage.setItem('piano-muted', m ? '1' : '0'); } catch (e) { /* storage unavailable */ }
  }

  function bind() {
    $('#seat').addEventListener('click', takeSeat);
    $('#brand').addEventListener('click', (e) => { e.preventDefault(); leaveSeat(); });
    $('#mute').addEventListener('click', () => setMuted(!GP.isMuted()));
    $('#scoreBtn').addEventListener('click', openScore);
    $('#skip').addEventListener('click', (e) => { e.preventDefault(); openScore(); });
    $('#scoreClose').addEventListener('click', closeScore);
    $('#scorePrint').addEventListener('click', () => window.print());
    $('#prev').addEventListener('click', () => show(current - 1));
    $('#next').addEventListener('click', () => show(current + 1));
    $('#pause').addEventListener('click', () => setSlidePaused(!slidePaused));
    slidesEl.addEventListener('click', (e) => {
      const slide = e.target.closest('.slide');
      if (e.target.closest('[data-act="score"]')) { e.preventDefault(); openScore(slide?.dataset.at); return; }
      const res = e.target.closest('[data-act="resume"]');
      if (res) { openScore(res.dataset.at); return; }
      const rec = e.target.closest('[data-act="record"]');
      if (rec) { if (window.Records) Records.open(rec.dataset.id); return; }
      // anywhere else on a ticket does the same as its button (its own links still work as links)
      if (!slide || slide.classList.contains('out') || e.target.closest('a, button')) return;
      if (String(window.getSelection?.() || '').length) return; // selecting text, not clicking
      if (slide.dataset.id) { if (window.Records) Records.open(slide.dataset.id); }
      else if (slide.dataset.at) openScore(slide.dataset.at);
    });

    $('#playSelf').addEventListener('click', () => (live.on ? exitPlay() : enterPlay()));
    $('#playDone').addEventListener('click', () => exitPlay());
    $('#pieceBtn').addEventListener('click', (e) => { e.stopPropagation(); repEl.hidden ? openRepertoire('top') : closeRepertoire(); });
    $('#nowPlaying').addEventListener('click', (e) => { e.stopPropagation(); repEl.hidden ? openRepertoire('bottom') : closeRepertoire(); });
    for (const id of ['#shuffleBtn', '#npShuffle', '#repShuffle']) $(id).addEventListener('click', randomPiece);
    $('#repNext').addEventListener('click', () => nextPiece());
    $('#repClose').addEventListener('click', closeRepertoire);
    repEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = e.target.closest('.rep-item');
      if (item) choose(REP.find((p) => p.id === item.dataset.id));
    });
    document.addEventListener('click', closeRepertoire);

    addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!$('#score').hidden) {
        if (e.key === 'Escape') closeScore();
        return;
      }
      if (!repEl.hidden && e.key === 'Escape') { closeRepertoire(); return; }
      if (window.Records && Records.handleKey(e)) return;
      if (live.on) {
        if (e.key === 'Escape') exitPlay();
        else if (e.code === 'Space') { if (!e.repeat) setSustain(true); }
        else if (e.code === 'KeyZ') { if (!e.repeat) setOctave(live.octave - 1); }
        else if (e.code === 'KeyX') { if (!e.repeat) setOctave(live.octave + 1); }
        else if (e.code in KEYMAP) { if (!e.repeat) keyDown(e.code); }
        else if (e.code === 'KeyM') setMuted(!GP.isMuted());
        else return;
        e.preventDefault();
        return;
      }
      if (!repEl.hidden && e.key === 'Escape') { closeRepertoire(); $('#pieceBtn').focus(); return; }
      if ((e.key === ' ' || e.key === 'Enter') && e.target.closest('button, a')) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === 'm') setMuted(!GP.isMuted());
      else if (k === 'r') openScore();
      // the piece controls belong to the bench, like their buttons (hidden on the entry page)
      else if (k === 'p' && seated) repEl.hidden ? openRepertoire('top') : closeRepertoire();
      else if (k === 'n' && seated) nextPiece();
      else if (k === 's' && seated) randomPiece();
      else if (k === 'k' && seated) enterPlay();
      else if (!seated) {
        if (k === 'Enter' || k === ' ' || k === 'ArrowRight') takeSeat();
        else return;
      } else if (k === 'ArrowRight') show(current + 1);
      else if (k === 'ArrowLeft') show(current - 1);
      else if (k === ' ') setSlidePaused(!slidePaused);
      else if (k === 'Escape') leaveSeat();
      else return;
      e.preventDefault();
    });

    addEventListener('keyup', (e) => {
      if (!live.on) return;
      if (e.code === 'Space') { setSustain(false); e.preventDefault(); }
      else if (e.code in KEYMAP) keyUp(e.code);
    });
    addEventListener('blur', () => { if (live.on) releaseAll(); });

    // swipe between slides on touch screens
    let touchX = null;
    $('.slide-card').addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    $('.slide-card').addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
      touchX = null;
    });

    // background tabs throttle timers; rest the music rather than let it stutter
    document.addEventListener('visibilitychange', () => {
      if (!musicWanted) return;
      if (document.hidden) Music.halt();
      else if (!userPaused && !live.on && musicPlace()) resumeMusic();
    });

    // placeholder links ('#', "coming soon") go nowhere: following one would change the
    // address, which the record room reads as "close the record"
    document.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('a.todo')) e.preventDefault();
    });
  }

  /* ---------- Project records ---------- */

  let recordResume = null;

  function initRecords() {
    if (!window.Records) return;
    Records.init({
      projects: C.projects || [],
      artist: C.name,
      monogram: C.monogram,
      music: {
        isPlaying: () => Music.isPlaying(),
        position: () => Music.position(),
        duration: () => (Music.loaded(chosen) ? Music.duration() : 0),
        piece: () => chosen,
        seek: (t) => Music.seek(t),
        toggle: toggleMusic,
        next: nextPiece,
        prev: prevPiece,
        shuffle: randomPiece,
        openQueue: () => (repEl.hidden ? openRepertoire('player') : closeRepertoire()),
        setVolume: (v) => GP.setVolume(v),
        getVolume: () => GP.getVolume(),
        isMuted: () => GP.isMuted(),
        setMuted,
        levels: () => GP.levels(),
        // a record's song takes over from the piano, and hands back when it's done
        // held even if the piano isn't sounding yet (still loading, or tab hidden), so nothing
        // else (tab refocus, sound finishing loading) can start it over the record's song
        holdPiano() {
          pianoHeld = true;
          Music.halt(); // also stops a piece that is still loading from starting over the song
        },
        releasePiano() {
          if (!pianoHeld) return;
          pianoHeld = false;
          // the piano picks up again only where music belongs (not on the entry page)
          if (musicWanted && !userPaused && !document.hidden && musicPlace()) resumeMusic();
        },
      },
      // while a record is open the stage rests: the slideshow pauses and the 3D scene stops drawing
      onOpen() {
        exitPlay(false);
        closeRepertoire();
        nudge(false);
        recordResume = !slidePaused;
        setSlidePaused(true);
        window.Stage && Stage.setPaused(true);
      },
      onClose() {
        closeRepertoire();
        window.Stage && Stage.setPaused(!$('#score').hidden);
        if (recordResume) setSlidePaused(false);
        // a record opened from a link lands on the entry page when it closes: keep that quiet
        if (!seated) silence();
      },
    });
  }

  /* ---------- Boot ---------- */

  function init() {
    const [first, ...rest] = C.name.split(' ');
    $('#introName').innerHTML = `<span>${esc(first)}</span> <span>${esc(rest.join(' '))}</span>`;
    $('#introKicker').textContent = C.intro.kicker;
    $('#introLead').textContent = C.intro.lead;
    $('#brandName').textContent = C.name;
    $('#repCount').textContent = `${REP.length} pieces`;

    try {
      Stage.init($('#stage'), {
        reduced,
        maker: C.maker,
        onKey: tapKey,
      });
    } catch (err) {
      console.warn('3D stage unavailable:', err);
    }

    let muted = false;
    try { muted = localStorage.getItem('piano-muted') === '1'; } catch (e) { /* storage unavailable */ }
    setMuted(muted);

    renderNowPlaying();
    window.Stage && Stage.setMood(chosen.light);
    buildSegments();
    buildLabels();
    bind();
    initRecords();
    requestAnimationFrame(frame);

    const status = $('#status');
    GP.load((p) => { status.textContent = p < 1 ? `Tuning the piano · ${Math.round(p * 100)}%` : ''; })
      .then((ok) => {
        audioReady = ok;
        status.textContent = ok ? '' : 'Sound unavailable';
        if (ok && musicWanted && !userPaused && musicPlace() && !Music.isPlaying()) resumeMusic();
      });
  }

  init();
})();
