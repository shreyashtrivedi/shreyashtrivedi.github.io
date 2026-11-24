// The record room: each project's case study presented as a vintage LP.
// The cover art fills the background, the record spins on a turntable beside
// its sleeve, the case study reads as a tracklist, and a player bar along the
// bottom controls the music that is playing on the piano.
window.Records = (() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pad = (n) => String(n).padStart(2, '0');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Each genre: the accent colour, the display face, and the ink used on its record label.
  const GENRES = {
    jazz: { accent: '#e8642c', font: '"Bebas Neue", Impact, sans-serif', labelInk: '#11223d' },
    psych: { accent: '#ec5a8c', font: 'Shrikhand, Georgia, serif', labelInk: '#fff3d2' },
    blues: { accent: '#d9a441', font: '"Abril Fatface", Georgia, serif', labelInk: '#2a140d' },
    indie: { accent: '#f7c21b', font: 'Fredoka, "Nunito", system-ui, sans-serif', labelInk: '#1a1408' },
    hand: { accent: '#e8dcc0', font: 'Caveat, "Segoe Print", cursive', labelInk: '#141414' },
    clean: { accent: '#c8873a', font: 'Jost, "Futura", system-ui, sans-serif', labelInk: '#1d1a17' },
  };
  const ORDER = ['jazz', 'psych', 'blues'];
  const TIERS = { platinum: 'Platinum', gold: 'Gold record', silver: 'Silver' };

  let api = null;
  let projects = [];
  let artist = '';
  let monogram = '';
  let root = null;
  let current = null;
  let isOpen = false;
  let opener = null;
  let raf = 0;
  let observer = null;
  let bgLayer = 0;
  const art = new Map(); // project id -> { cover, label }
  let fontsReady = null;

  const genreOf = (p, i) => (GENRES[p.genre] ? p.genre : ORDER[i % ORDER.length]);
  const indexOf = (p) => projects.indexOf(p);

  /* ---------- Album art ---------- */

  function canvas(w, h = w) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // A small seeded random generator, so each cover looks the same on every visit.
  function seeded(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  function spaced(g, px) {
    if ('letterSpacing' in g) g.letterSpacing = px + 'px';
  }

  // Set the font at the largest size (up to max) at which `text` fits in maxW.
  function fit(g, text, family, maxW, max) {
    g.font = `400 ${max}px ${family}`;
    const w = g.measureText(text).width;
    const size = w > maxW ? Math.floor((max * maxW) / w) : max;
    g.font = `400 ${size}px ${family}`;
    return size;
  }

  function halftone(g, cx, cy, R, step, radiusAt, color, angle = 0.26) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    g.save();
    g.fillStyle = color;
    g.translate(cx, cy);
    g.rotate(angle);
    for (let y = -R; y <= R; y += step) {
      for (let x = -R; x <= R; x += step) {
        const r = radiusAt(x * cos - y * sin, x * sin + y * cos);
        if (r < 0.35) continue;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  }

  // Age the sleeve: the ring the record wore through it, scuffed edges, a vignette and grain.
  function age(g, S, rnd, grain = 0.09) {
    g.save();
    g.globalCompositeOperation = 'screen';
    g.strokeStyle = '#fff0d7';
    g.globalAlpha = 0.06;
    g.lineWidth = S * 0.035;
    g.beginPath();
    g.arc(S * 0.515, S * 0.495, S * 0.44, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 0.035;
    g.lineWidth = S * 0.01;
    g.beginPath();
    g.arc(S * 0.515, S * 0.495, S * 0.15, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 0.16;
    g.lineWidth = 1.5;
    for (let i = 0; i < 180; i++) {
      const t = rnd() * S;
      const d = rnd() * S * 0.018;
      const l = 4 + rnd() * 26;
      const j = (rnd() - 0.5) * 3;
      g.beginPath();
      if (i % 4 === 0) { g.moveTo(t, d); g.lineTo(t + l, d + j); }
      else if (i % 4 === 1) { g.moveTo(t, S - d); g.lineTo(t + l, S - d + j); }
      else if (i % 4 === 2) { g.moveTo(d, t); g.lineTo(d + j, t + l); }
      else { g.moveTo(S - d, t); g.lineTo(S - d + j, t + l); }
      g.stroke();
    }
    g.restore();

    const v = g.createRadialGradient(S / 2, S / 2, S * 0.38, S / 2, S / 2, S * 0.76);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.38)');
    g.fillStyle = v;
    g.fillRect(0, 0, S, S);

    const tile = canvas(256);
    const tg = tile.getContext('2d');
    const img = tg.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      const val = rnd() * 255;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = val;
      img.data[i * 4 + 3] = 255 * grain;
    }
    tg.putImageData(img, 0, 0);
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.fillStyle = g.createPattern(tile, 'repeat');
    g.fillRect(0, 0, S, S);
    g.restore();
  }

  // Modernist jazz: a halftone spotlight on navy, and the title set huge in condensed caps.
  function jazzCover(p, i, S, rnd) {
    const c = canvas(S);
    const g = c.getContext('2d');
    const navy = '#11223d';
    const orange = '#e8642c';
    const cream = '#f0e6d0';
    g.fillStyle = navy;
    g.fillRect(0, 0, S, S);

    const cx = S * 0.66;
    const cy = S * 0.4;
    const R = S * 0.36;
    const step = S * 0.017;
    halftone(g, cx, cy, R * 1.05, step, (x, y) => {
      const d = Math.hypot(x, y) / R;
      if (d > 1) return 0;
      const light = 1 - d * d * 0.8 + 0.12 * Math.sin(x * 0.02) * Math.cos(y * 0.03);
      return step * 0.56 * clamp(light, 0, 1);
    }, orange);
    halftone(g, cx - R * 0.3, cy - R * 0.32, R * 0.5, step, (x, y) => {
      const d = Math.hypot(x, y) / (R * 0.46);
      return d > 1 ? 0 : step * 0.4 * (1 - d);
    }, cream);

    g.fillStyle = cream;
    g.fillRect(S * 0.06, S * 0.078, S * 0.88, S * 0.004);
    g.font = `400 ${S * 0.046}px "Bebas Neue"`;
    spaced(g, S * 0.012);
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillText(artist.toUpperCase(), S * 0.06, S * 0.062);
    g.textAlign = 'right';
    g.fillText(`ST · ${4001 + i}`, S * 0.94, S * 0.062);

    const words = p.title.toUpperCase().split(/\s+/);
    const lineMax = Math.min(S * 0.3, (S * 0.4) / words.length / 0.86);
    spaced(g, 0);
    g.textAlign = 'left';
    let y = S * 0.885;
    for (let k = words.length - 1; k >= 0; k--) {
      const size = fit(g, words[k], '"Bebas Neue"', S * 0.88, lineMax);
      g.fillStyle = k === words.length - 1 && words.length > 1 ? orange : cream;
      g.fillText(words[k], S * 0.055, y);
      y -= size * 0.86;
    }

    g.fillStyle = orange;
    g.fillRect(S * 0.06, S * 0.905, S * 0.88, S * 0.005);
    g.fillStyle = cream;
    g.font = `400 ${S * 0.032}px "Bebas Neue"`;
    spaced(g, S * 0.01);
    g.textAlign = 'left';
    g.fillText('LONG PLAYING', S * 0.06, S * 0.948);
    g.textAlign = 'right';
    g.fillText(String(p.label || '').toUpperCase(), S * 0.94, S * 0.948);
    age(g, S, rnd);
    return c;
  }

  // Sixties pop: concentric op-art waves swirling out from a sun, with a fat outlined title.
  function psychCover(p, i, S, rnd) {
    const c = canvas(S);
    const g = c.getContext('2d');
    const cols = ['#f7d14c', '#f39433', '#e8457c', '#7c3d9e', '#1f8a8a', '#f1e3c4'];
    const cx = S * 0.5;
    const cy = S * 0.6;
    const band = S * 0.042;
    const phase = rnd() * 6;
    g.fillStyle = cols[0];
    g.fillRect(0, 0, S, S);
    let k = 0;
    for (let r = S * 1.1; r > S * 0.02; r -= band, k++) {
      g.beginPath();
      for (let a = 0; a <= 360; a += 2) {
        const t = (a * Math.PI) / 180;
        const rr = r * (1 + 0.075 * Math.sin(7 * t + r * 0.012 + phase) + 0.03 * Math.sin(3 * t - r * 0.02));
        const x = cx + rr * Math.cos(t);
        const y = cy + rr * Math.sin(t) * 0.92;
        if (a === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.fillStyle = cols[k % cols.length];
      g.fill();
    }
    const ink = '#3a1438';
    g.fillStyle = '#fff3d2';
    g.strokeStyle = ink;
    g.lineWidth = S * 0.008;
    g.beginPath();
    g.arc(cx, cy, S * 0.085, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    const outlined = (text, x, y, size) => {
      g.lineJoin = 'round';
      g.fillStyle = ink;
      g.fillText(text, x + size * 0.07, y + size * 0.07);
      g.strokeStyle = ink;
      g.lineWidth = size * 0.11;
      g.strokeText(text, x, y);
      g.fillStyle = '#fff3d2';
      g.fillText(text, x, y);
    };
    g.save();
    g.translate(S * 0.5, S * 0.2);
    g.rotate(-0.07);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    outlined(p.title, 0, 0, fit(g, p.title, 'Shrikhand', S * 0.82, S * 0.17));
    g.restore();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `400 ${S * 0.058}px Shrikhand`;
    outlined(artist, S * 0.5, S * 0.915, S * 0.058);

    g.save();
    g.translate(S * 0.87, S * 0.4);
    g.rotate(0.25);
    g.fillStyle = ink;
    g.beginPath();
    g.arc(0, 0, S * 0.065, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f7d14c';
    g.font = `400 ${S * 0.026}px Shrikhand`;
    g.fillText('in', 0, -S * 0.016);
    g.fillText('stereo', 0, S * 0.016);
    g.restore();
    age(g, S, rnd);
    return c;
  }

  // Late-night blues: a halftone moon over smoke and a row of piano keys, in sepia.
  function bluesCover(p, i, S, rnd) {
    const c = canvas(S);
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, S);
    bg.addColorStop(0, '#3b1a12');
    bg.addColorStop(0.55, '#1c0d0a');
    bg.addColorStop(1, '#0b0605');
    g.fillStyle = bg;
    g.fillRect(0, 0, S, S);

    const mx = S * 0.7;
    const my = S * 0.29;
    const R = S * 0.19;
    const glow = g.createRadialGradient(mx, my, R * 0.5, mx, my, R * 2.8);
    glow.addColorStop(0, 'rgba(240,200,140,0.26)');
    glow.addColorStop(1, 'rgba(240,200,140,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, S, S);
    const step = S * 0.012;
    halftone(g, mx, my, R * 1.02, step, (x, y) => {
      const d2 = (x * x + y * y) / (R * R);
      if (d2 > 1) return 0;
      const nz = Math.sqrt(1 - d2);
      const lit = clamp(0.2 + 0.8 * ((-x / R) * 0.42 + (-y / R) * 0.42 + nz * 0.72), 0, 1);
      const crater = 0.74 + 0.26 * Math.sin(x * 0.05 + 1.3) * Math.sin(y * 0.045 + 0.4);
      return step * 0.6 * lit * crater;
    }, '#ecd9b2', 0.4);

    g.save();
    g.filter = 'blur(14px)';
    g.globalCompositeOperation = 'screen';
    for (let k = 0; k < 7; k++) {
      g.strokeStyle = `rgba(230,200,160,${0.05 + rnd() * 0.06})`;
      g.lineWidth = S * (0.02 + rnd() * 0.05);
      const y0 = S * (0.36 + rnd() * 0.3);
      g.beginPath();
      g.moveTo(-50, y0);
      g.bezierCurveTo(S * 0.3, y0 - S * 0.15 * rnd(), S * 0.6, y0 + S * 0.15 * rnd(), S + 50, y0 - S * 0.08);
      g.stroke();
    }
    g.restore();

    const top = S * 0.8;
    const h = S * 0.14;
    const n = 21;
    const w = S / n;
    for (let k = 0; k < n; k++) {
      const kg = g.createLinearGradient(0, top, 0, top + h);
      kg.addColorStop(0, '#cdb68e');
      kg.addColorStop(1, '#ead8b5');
      g.fillStyle = kg;
      g.fillRect(k * w + 1, top, w - 2, h);
    }
    g.fillStyle = '#120a08';
    for (let k = 0; k < n - 1; k++) {
      if ([0, 1, 3, 4, 5].includes(k % 7)) g.fillRect((k + 1) * w - w * 0.3, top, w * 0.6, h * 0.6);
    }
    const shade = g.createLinearGradient(0, top - S * 0.04, 0, top + h * 0.5);
    shade.addColorStop(0, 'rgba(11,6,5,1)');
    shade.addColorStop(1, 'rgba(11,6,5,0)');
    g.fillStyle = shade;
    g.fillRect(0, top - S * 0.04, S, h * 0.54 + S * 0.04);

    g.fillStyle = '#f1dfbd';
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = `400 ${S * 0.03}px "Abril Fatface"`;
    spaced(g, S * 0.012);
    g.fillText(`VOL. ${i + 1}`, S * 0.07, S * 0.1);
    g.fillText(artist.toUpperCase(), S * 0.07, S * 0.555);
    g.fillRect(S * 0.07, S * 0.575, S * 0.18, S * 0.004);
    spaced(g, 0);
    fit(g, p.title, '"Abril Fatface"', S * 0.86, S * 0.15);
    g.fillText(p.title, S * 0.065, S * 0.72);

    g.save();
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = 'rgba(150,95,50,0.38)';
    g.fillRect(0, 0, S, S);
    g.restore();
    g.save();
    g.strokeStyle = 'rgba(255,235,200,0.07)';
    g.lineWidth = 1;
    for (let k = 0; k < 14; k++) {
      const x = rnd() * S;
      g.beginPath();
      g.moveTo(x, rnd() * S * 0.3);
      g.lineTo(x + (rnd() - 0.5) * 40, S * (0.6 + rnd() * 0.4));
      g.stroke();
    }
    g.restore();
    age(g, S, rnd, 0.12);
    return c;
  }

  function loadFonts() {
    fontsReady ||= Promise.all(['400 100px "Bebas Neue"', '400 100px Shrikhand', '400 100px "Abril Fatface"', '500 40px Archivo']
      .map((f) => document.fonts.load(f))).catch(() => {});
    return fontsReady;
  }

  // The most vivid colour in an image, lifted so it reads on a dark page.
  function vividColour(img) {
    const c = canvas(48);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, 48, 48);
    const d = g.getImageData(0, 0, 48, 48).data;
    let best = null;
    let score = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255;
      const gr = d[i + 1] / 255;
      const b = d[i + 2] / 255;
      const max = Math.max(r, gr, b);
      const min = Math.min(r, gr, b);
      const sat = max ? (max - min) / max : 0;
      const sc = sat * (1 - Math.abs(max - 0.75));
      if (sc > score) { score = sc; best = [r, gr, b]; }
    }
    if (!best || score < 0.15) return null;
    const k = 0.85 / Math.max(...best); // bring it up to a bright, readable level
    return `rgb(${best.map((v) => Math.round(Math.min(1, v * k) * 255)).join(',')})`;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  /* ---------- Which song each record plays ---------- */

  // Each project has a list of songs (js/albums.js); every visit to the section draws one at
  // random per project, avoiding the song that project played last time when it can.
  const lastPick = new Map(); // project id -> album played last
  function pickAlbums() {
    const all = window.ALBUMS || {};
    for (const p of projects) {
      const list = (all[p.id] || []).filter((a) => a && (a.spotify || a.art));
      if (!list.length) continue; // keep any `album` set directly in content.js
      const prev = lastPick.get(p.id);
      const pool = list.length > 1 ? list.filter((a) => a !== prev) : list;
      const a = pool[Math.floor(Math.random() * pool.length)];
      lastPick.set(p.id, a);
      p.album = a;
    }
  }
  const listenLink = (a) => a.listen || (a.spotify ? `https://open.spotify.com/track/${a.spotify}` : '');
  // the small-print credit for the image on the page: the album, or `artCredit` when the image isn't its cover
  function coverCredit(a) {
    if (a.artCredit) return `Cover image: ${esc(a.artCredit)}`;
    const meta = [a.label, a.year].filter(Boolean).map(esc).join(', ');
    return `Cover: <em>${esc(a.title)}</em> by ${esc(a.artist)}${meta ? ` (${meta})` : ''}${a.painting ? `; painting: ${esc(a.painting)}` : ''}`;
  }

  // covers are cached per image, since a project's cover changes with its song
  const artKey = (p) => `${p.id}|${(p.album && p.album.art) || p.cover || ''}`;

  async function artFor(p) {
    const key = artKey(p);
    if (art.has(key)) return art.get(key);
    await loadFonts();
    const i = indexOf(p);
    const genre = genreOf(p, i);
    let cover = (p.album && p.album.art) || p.cover;
    let accent = (p.album && p.album.accent) || null;
    if (cover) {
      try {
        const img = await loadImage(cover);
        accent ||= vividColour(img);
      } catch (e) {
        cover = null; // missing file: fall back to the generated sleeve
      }
    }
    if (!cover) {
      const make = { jazz: jazzCover, psych: psychCover, blues: bluesCover }[genre];
      cover = make(p, i, 1000, seeded(p.id + p.title)).toDataURL('image/jpeg', 0.9);
    }
    accent ||= GENRES[genre].accent;
    const a = { cover, accent };
    art.set(key, a);
    return a;
  }

  /* ---------- The page ---------- */

  const ICON = {
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    pause: '<path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/>',
    prev: '<path d="M6 5h2.2v14H6zM19 5.5v13L9.5 12z"/>',
    next: '<path d="M15.8 5H18v14h-2.2zM5 5.5v13L14.5 12z"/>',
    shuffle: '<path d="M3.5 7h3.2c2 0 3.2 1 4.3 2.7l2.4 3.6c1.1 1.7 2.3 2.7 4.3 2.7h2.8M3.5 16h3.2c1.4 0 2.4-.5 3.2-1.4M13.5 8.4c.8-.9 1.8-1.4 3.2-1.4h2.8M17.8 4.6 20.2 7l-2.4 2.4M17.8 13.6l2.4 2.4-2.4 2.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    queue: '<path d="M3.5 6h11M3.5 11h11M3.5 16h7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M18 17.5V8.2l3 .9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="16.2" cy="17.6" r="1.9"/>',
    vol: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    mute: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    fwd: '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  const svg = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

  // An analog VU meter: the needle swings from -20 to +3 on a backlit face.
  const VU = { cx: 80, cy: 118, R: 84 };
  const vuAngle = (f) => -48 + 96 * f;
  const vuFrac = (db) => (Math.pow(10, db / 20) - 0.1) / (Math.pow(10, 3 / 20) - 0.1);

  function vuSVG(ch) {
    const { cx, cy, R } = VU;
    const pt = (f, r) => {
      const a = (vuAngle(f) * Math.PI) / 180;
      return [cx + Math.sin(a) * r, cy - Math.cos(a) * r].map((v) => v.toFixed(1));
    };
    const arc = (f1, f2, r) => `M${pt(f1, r).join(' ')} A${r} ${r} 0 0 1 ${pt(f2, r).join(' ')}`;
    let marks = '';
    for (const [db, lab] of [[-20, '20'], [-10, '10'], [-7, '7'], [-5, '5'], [-3, '3'], [-2, ''], [-1, ''], [0, '0'], [1, ''], [2, ''], [3, '+3']]) {
      const f = vuFrac(db);
      const red = db >= 0 ? ' vu-red' : '';
      const [x1, y1] = pt(f, R);
      const [x2, y2] = pt(f, R - (lab ? 9 : 5));
      marks += `<line class="vu-tick${red}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      if (lab) {
        const [lx, ly] = pt(f, R + 8);
        marks += `<text class="vu-num${red}" x="${lx}" y="${ly}">${lab}</text>`;
      }
    }
    return `
      <svg class="vu" viewBox="0 0 160 104" aria-hidden="true">
        <defs><radialGradient id="vuFace${ch}" cx="50%" cy="90%" r="90%"><stop offset="0" stop-color="#fff2d0"/><stop offset="1" stop-color="#d8bf8c"/></radialGradient></defs>
        <rect class="vu-face" x="2" y="2" width="156" height="100" rx="5" fill="url(#vuFace${ch})"/>
        <path class="vu-arc" d="${arc(vuFrac(-20), vuFrac(0), R)}"/>
        <path class="vu-arc vu-red-arc" d="${arc(vuFrac(0), 1, R)}"/>
        ${marks}
        <text class="vu-label" x="80" y="74">VU</text>
        <line class="vu-needle" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - R + 2}" transform="rotate(-48 ${cx} ${cy})"/>
        <rect class="vu-cover" x="2" y="86" width="156" height="16" rx="0"/>
        <text class="vu-ch" x="12" y="97">${ch}</text>
      </svg>`;
  }

  function build() {
    root = document.createElement('div');
    root.className = 'rr';
    root.id = 'records';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Project');
    root.innerHTML = `
      <div class="rr-backdrop" aria-hidden="true"><div class="rr-bg"></div><div class="rr-bg"></div></div>
      <div class="rr-shade" aria-hidden="true"></div>
      <header class="rr-top">
        <button class="rr-back" data-act="close">${svg('back')}<span>Back to the piano</span></button>
        <div class="rr-recnav">
          <span class="rr-count"></span>
          <button class="rr-round" data-act="prevrec" aria-label="Previous record">${svg('back')}</button>
          <button class="rr-round" data-act="nextrec" aria-label="Next record">${svg('fwd')}</button>
        </div>
      </header>
      <div class="rr-dim" aria-hidden="true"></div>
      <main class="rr-scroll" tabindex="-1"></main>
      <div class="rr-hifi" aria-hidden="true">
        <div class="rr-meters">${vuSVG('L')}${vuSVG('R')}</div>
        <p class="rr-hifi-name"><span>Stereo</span>${esc(monogram)} · Hi-Fi<span class="rr-lamp"></span></p>
      </div>
      <footer class="rr-player">
        <div class="pb-now">
          <div class="pb-art"><span></span></div>
          <div class="pb-meta"><p class="pb-title"></p><p class="pb-sub"></p></div>

        </div>
        <div class="pb-center">
          <div class="pb-controls">
            <button class="pb-btn pb-minor" data-act="shuffle" aria-label="Random piece" title="Random piece (S)">${svg('shuffle')}</button>
            <button class="pb-btn" data-act="prev" aria-label="Previous piece" title="Previous">${svg('prev')}</button>
            <button class="pb-play" data-act="toggle" aria-label="Play">${svg('play', 'i-play')}${svg('pause', 'i-pause')}</button>
            <button class="pb-btn" data-act="next" aria-label="Next piece" title="Next (N)">${svg('next')}</button>
            <button class="pb-btn pb-minor" data-act="queue" aria-label="All pieces" title="All pieces (P)">${svg('queue')}</button>
          </div>
          <div class="pb-progress">
            <span class="pb-time pb-elapsed">0:00</span>
            <div class="pb-bar pb-seek" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="100"><div class="pb-fill"><i></i></div></div>
            <span class="pb-time pb-total">0:00</span>
          </div>
        </div>
        <div class="pb-right">
          <button class="pb-btn" data-act="mute" aria-label="Mute">${svg('vol', 'i-vol')}${svg('mute', 'i-mute')}</button>
          <div class="pb-bar pb-vol" role="slider" tabindex="0" aria-label="Volume" aria-valuemin="0" aria-valuemax="100"><div class="pb-fill"><i></i></div></div>
        </div>
        <div class="pb-spotify"><div id="spotifyEmbed"></div></div>
        <a class="pb-open" target="_blank" rel="noopener"><span>Full song</span> on Spotify ↗</a>
      </footer>`;
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    // the cover dims and softens as the liner notes scroll up over it
    const scroller = $('.rr-scroll', root);
    scroller.addEventListener('scroll', () => {
      const hero = $('.rr-hero', scroller);
      const h = hero ? hero.offsetHeight * 0.75 : innerHeight;
      root.style.setProperty('--scrolled', clamp(scroller.scrollTop / h, 0, 1).toFixed(3));
    }, { passive: true });
    slider($('.pb-seek', root), {
      get: () => { const d = player().duration(); return d ? player().position() / d : 0; },
      preview: (f) => { seekPreview = f; },
      commit: (f) => { seekPreview = null; player().seek(f * player().duration()); },
    });
    slider($('.pb-vol', root), {
      get: () => (api.music.isMuted() ? 0 : api.music.getVolume()),
      preview: (f) => setVolume(f),
      commit: (f) => setVolume(f),
    });
  }

  let seekPreview = null;

  function setVolume(f) {
    api.music.setVolume(f);
    if (f > 0 && api.music.isMuted()) api.music.setMuted(false);
    try { localStorage.setItem('piano-volume', String(f)); } catch (e) { /* storage unavailable */ }
  }

  // A thin draggable bar, like the ones in a music player.
  function slider(el, { get, preview, commit }) {
    const fracAt = (e) => {
      const r = el.getBoundingClientRect();
      return clamp((e.clientX - r.left) / r.width, 0, 1);
    };
    let dragging = false;
    el.addEventListener('pointerdown', (e) => {
      dragging = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      preview(fracAt(e));
    });
    el.addEventListener('pointermove', (e) => { if (dragging) preview(fracAt(e)); });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      commit(fracAt(e));
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => { dragging = false; el.classList.remove('dragging'); });
    el.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 0.05 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -0.05 : 0;
      if (!step) return;
      e.preventDefault();
      e.stopPropagation();
      commit(clamp(get() + step, 0, 1));
    });
  }

  /* ---------- A project as an album ---------- */

  const fmt = (s) => (isFinite(s) && s >= 0 ? `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}` : '–:––');
  const fmtLong = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${pad(Math.round(s % 60))} sec` : `${Math.round(s)} sec`);

  function linkHTML(l, cls) {
    const todo = !l.url || l.url === '#';
    return `<a class="${cls}${todo ? ' todo' : ''}" href="${esc(l.url || '#')}"${todo ? ' title="Link coming soon"' : ' target="_blank" rel="noopener"'}>${cls === 'rr-cta' ? svg('play') : ''}${esc(l.label)}</a>`;
  }

  /* ---------- Signal flow: the architecture as a patch diagram ---------- */

  // Rows of parts, top to bottom, patched together with cables drawn once the page is laid out.
  const KINDS = { user: 'Person', agent: 'Agent', code: 'Service', decision: 'Decision', ai: 'AI model', store: 'Storage', ext: 'Outside service', ui: 'Interface' };
  const TONES = { go: 1, wait: 1, stop: 1 };

  function nodeHTML(n, id, from) {
    const kind = KINDS[n.k] ? n.k : 'code';
    const head = n.tag
      ? `<span class="rf-tag tone-${TONES[n.tone] ? n.tone : 'go'}">${esc(n.tag)}</span>`
      : `<span class="rf-chip"><i></i>${esc(n.label || KINDS[kind])}</span>`;
    return `<li class="rf-node k-${kind}${n.key ? ' is-key' : ''}${n.end ? ' is-end' : ''}" data-id="${esc(id)}"${from.length ? ` data-from="${esc(from.join(' '))}"` : ''}>
            ${head}<strong>${esc(n.t)}</strong>${n.s ? `<small>${esc(n.s)}</small>` : ''}
          </li>`;
  }

  // One diagram: each part is wired to the row above, one to many, many to one, or side by side.
  function diagramHTML(rows, prefix) {
    const idOf = (n, r, i) => `${prefix}${n.id || `${r}-${i}`}`;
    return `
        <div class="rf-diagram">
          <svg class="rf-wires" aria-hidden="true"></svg>
          <ol class="rf-rows">${rows.map((row, r) => {
            const prev = r ? rows[r - 1].nodes.map((n, i) => ({ n, id: idOf(n, r - 1, i) })).filter((q) => !q.n.end) : [];
            const nodes = row.nodes || [];
            // a note sits on the cable when one part feeds one part straight down, beside it otherwise
            const notePlace = r && rows[r - 1].nodes.length === 1 && nodes.length === 1 ? 'center' : 'side';
            return `
            <li class="rf-row"${row.note ? ` data-note="${notePlace}"` : ''}>${row.note ? `<p class="rf-note">${esc(row.note)}</p>` : ''}
              <ol class="rf-nodes rf-n${nodes.length}">${nodes.map((n, i) => {
                let from = [];
                if (n.from) from = n.from.map((f) => `${prefix}${f}`);
                else if (prev.length === 1 || nodes.length === 1 || prev.length !== nodes.length) from = prev.map((q) => q.id);
                else from = [prev[i].id];
                return nodeHTML(n, idOf(n, r, i), from);
              }).join('')}</ol>
            </li>`;
          }).join('')}
          </ol>
        </div>`;
  }

  function flowHTML(f) {
    const lanes = f.lanes?.length ? f.lanes : [{ rows: f.rows || [] }];
    const body = f.lanes?.length
      ? `<div class="rf-lanes">${lanes.map((l, k) => `
          <section class="rf-lane">
            <header class="rf-lane-head"><b>${'ABCD'[k] || k + 1}</b><span>${esc(l.title)}${l.sub ? `<small>${esc(l.sub)}</small>` : ''}</span></header>
            ${diagramHTML(l.rows || [], `l${k}-`)}
          </section>`).join('')}</div>`
      : diagramHTML(lanes[0].rows, 'm-');
    const aside = f.aside?.length
      ? `<div class="rf-aside"><p class="rf-aside-title"><span>Alongside</span></p><ul>${f.aside.map((n) => {
          const kind = KINDS[n.k] ? n.k : 'code';
          return `<li class="rf-node rf-mini k-${kind}"><span class="rf-chip"><i></i>${esc(n.label || KINDS[kind])}</span><strong>${esc(n.t)}</strong>${n.s ? `<small>${esc(n.s)}</small>` : ''}</li>`;
        }).join('')}</ul></div>`
      : '';
    return `<div class="rf">${body}${aside}</div>`;
  }

  // Older pages list the flow as plain steps; draw those as a single chain.
  const flowOf = (p) => p.flow || (p.diagram?.length ? { rows: p.diagram.map((t) => ({ nodes: [{ t }] })) } : null);
  const flowSize = (f) => (f.lanes ? f.lanes.flatMap((l) => l.rows || []) : f.rows || []).reduce((s, r) => s + (r.nodes || []).length, 0) + (f.aside || []).length;

  // The cables: from the bottom of each part to the top of the next, several jacks side by side
  // where a part sends to (or takes from) more than one, ordered so the cables don't cross.
  function drawWires(d) {
    const svg = d.querySelector('.rf-wires');
    const box = d.getBoundingClientRect();
    if (!svg || !box.width) return;
    const at = new Map();
    d.querySelectorAll('.rf-node[data-id]').forEach((el) => at.set(el.dataset.id, el.getBoundingClientRect()));
    const edges = [];
    d.querySelectorAll('.rf-node[data-from]').forEach((el) => {
      const b = at.get(el.dataset.id);
      el.dataset.from.split(' ').forEach((id) => { const a = at.get(id); if (a && b) edges.push({ id, to: el.dataset.id, a, b }); });
    });
    const cx = (r) => r.left + r.width / 2 - box.left;
    const spread = (list, key, sortBy) => {
      const groups = new Map();
      list.forEach((e) => { if (!groups.has(e[key])) groups.set(e[key], []); groups.get(e[key]).push(e); });
      groups.forEach((g) => {
        g.sort((x, y) => sortBy(x) - sortBy(y));
        const step = Math.min(16, (g[0][key === 'id' ? 'a' : 'b'].width - 24) / Math.max(1, g.length - 1));
        g.forEach((e, i) => { e[key === 'id' ? 'dx1' : 'dx2'] = (i - (g.length - 1) / 2) * step; });
      });
    };
    spread(edges, 'id', (e) => cx(e.b));
    spread(edges, 'to', (e) => cx(e.a));
    let cable = '';
    let jacks = '';
    for (const e of edges) {
      const x1 = cx(e.a) + (e.dx1 || 0);
      const y1 = e.a.bottom - box.top;
      const x2 = cx(e.b) + (e.dx2 || 0);
      const y2 = e.b.top - box.top;
      const my = (y1 + y2) / 2;
      cable += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} C${x1.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
      jacks += `<circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="2.6"/><circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="3.4"/>`;
    }
    svg.setAttribute('viewBox', `0 0 ${box.width.toFixed(1)} ${box.height.toFixed(1)}`);
    svg.innerHTML = `<g class="rf-glow">${cable}</g><g class="rf-cable">${cable}</g><g class="rf-jacks">${jacks}</g>`;
  }

  // Redraw whenever anything in a diagram changes size (layout, fonts arriving, a resize).
  let flowWatch = null;
  function wireFlows(scroller) {
    if (flowWatch) flowWatch.disconnect();
    const diagrams = [...scroller.querySelectorAll('.rf-diagram')];
    if (!diagrams.length) return;
    let queued = 0;
    const redraw = () => {
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(() => diagrams.forEach(drawWires));
    };
    flowWatch = new ResizeObserver(redraw);
    diagrams.forEach((d) => {
      flowWatch.observe(d);
      d.querySelectorAll('.rf-node').forEach((n) => flowWatch.observe(n));
    });
    redraw();
  }

  // The case study as a tracklist. A track's length is roughly its reading time.
  function tracksFor(p) {
    const words = (s) => String(s || '').split(/\s+/).filter(Boolean).length;
    const secs = (n, min = 15) => Math.max(min, Math.round((n / 200) * 60));
    const t = [];
    if (p.problem) {
      t.push({ id: 'problem', title: 'The Problem', sub: 'Why it mattered', secs: secs(words(p.problem)), html: `<p class="rr-lead">${esc(p.problem)}</p>` });
    }
    if (p.build || p.highlights?.length) {
      const hl = p.highlights || [];
      t.push({
        id: 'build', title: 'The Build', sub: 'What I made, and how', secs: secs(words(p.build) + words(hl.join(' '))),
        html: `${p.build ? `<p>${esc(p.build)}</p>` : ''}${hl.length ? `<ul class="rr-hl">${hl.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}`,
      });
    }
    const flow = flowOf(p);
    if (flow) {
      t.push({ id: 'flow', title: 'Signal Flow', sub: 'How the pieces connect', secs: secs(flowSize(flow) * 7, 20), html: flowHTML(flow) });
    }
    if (p.shots?.length) {
      t.push({
        id: 'photos', title: 'Liner Photos', sub: 'Screenshots of the real thing', secs: secs(p.shots.length * 8, 15),
        html: `<div class="rr-shots${p.shots.length % 2 ? ' is-odd' : ''}">${p.shots.map((s) => `
          <figure class="rs">
            <a href="${esc(s.src)}" target="_blank" rel="noopener" aria-label="Open the screenshot: ${esc(s.caption)}">
              <img src="${esc(s.src)}" alt="${esc(s.caption)}"${s.w && s.h ? ` width="${s.w}" height="${s.h}"` : ''} loading="lazy" decoding="async">
            </a>
            <figcaption>${esc(s.caption)}</figcaption>
          </figure>`).join('')}</div>`,
      });
    }
    if (p.metrics?.length) {
      t.push({
        id: 'charts', title: 'Chart Positions', sub: 'The results', secs: secs(p.metrics.length * 10, 15),
        html: `<div class="rr-charts">${p.metrics.map((m, k) => {
          const tier = TIERS[m.tier] ? m.tier : ['platinum', 'gold', 'silver'][k % 3];
          return `<div class="rc rc-${tier}"><span class="rc-disc" aria-hidden="true"></span><span class="rc-val">${esc(m.value)}</span><span class="rc-label">${esc(m.label)}</span><span class="rc-tier">${TIERS[tier]}</span></div>`;
        }).join('')}</div>`,
      });
    }
    if (p.stack?.length) {
      t.push({
        id: 'personnel', title: 'Personnel', sub: 'The stack', secs: secs(p.stack.length * 6, 15),
        html: `<dl class="rr-credits">${p.stack.map((s) => `<div><dt>${esc(s.name)}</dt><dd>${esc(s.role)}</dd></div>`).join('')}</dl>`,
      });
    }
    if (p.links?.length || p.next) {
      t.push({
        id: 'encore', title: 'Encore', sub: 'Code, demo and what’s next', secs: secs(words(p.next), 15),
        html: `${p.next ? `<p>${esc(p.next)}</p>` : ''}${p.links?.length ? `<div class="rr-encore">${p.links.map((l) => linkHTML(l, 'rr-pill')).join('')}</div>` : ''}`,
      });
    }
    return t;
  }

  // The legendary record whose cover this page wears, with a link to listen.
  function albumHTML(p) {
    const a = p.album;
    if (!a) return '';
    const what = a.song
      ? `<em>${esc(a.song)}</em> · ${esc(a.artist)} · from <em>${esc(a.title)}</em> (${esc(a.year)})`
      : `<em>${esc(a.title)}</em> · ${esc(a.artist)} · ${esc(a.year)}`;
    return `
          <p class="rr-sleeve-credit">
            <span class="rsc-disc" aria-hidden="true"></span>
            <span class="rsc-label">Cover</span>
            <span>${what}</span>
            ${listenLink(a) ? `<a href="${esc(listenLink(a))}" target="_blank" rel="noopener">Listen ↗</a>` : ''}
          </p>`;
  }

  function pageHTML(p) {
    const tracks = tracksFor(p);
    const total = tracks.reduce((s, t) => s + t.secs, 0);
    const [main, ...rest] = p.links || [];
    const others = projects.filter((q) => q !== p);
    return `
      <section class="rr-hero">
        <header class="rr-head">
          <p class="rr-eyebrow">${p.placeholder ? '<span class="rr-ph">Placeholder</span>' : ''}Long play · ${esc(p.label)}</p>
          <h1 class="rr-title">${esc(p.title)}</h1>
          <div class="rr-card">
            <p class="rr-artist"><span class="rr-avatar">${esc(monogram)}</span><strong>${esc(artist)}</strong><i>·</i>${esc(p.year)}<i>·</i>${tracks.length} tracks, ${fmtLong(total)}</p>
            <p class="rr-tagline">${esc(p.tagline)}</p>
            ${albumHTML(p)}
            <div class="rr-actions">${main ? linkHTML(main, 'rr-cta') : ''}${rest.map((l) => linkHTML(l, 'rr-ghost')).join('')}</div>
          </div>
        </header>
        <button class="rr-cue" data-act="liner"><span>Liner notes</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </section>
      <div class="rr-sheet">
      <ol class="rr-tracks">
        <li class="rr-tracks-head" aria-hidden="true"><span>#</span><span>Title</span><span title="Reading time">◷</span></li>
        ${tracks.map((t, k) => `
        <li><button class="rr-track" data-track="${t.id}">
          <span class="rt-num"><b>${k + 1}</b><span class="eq"><i></i><i></i><i></i></span></span>
          <span class="rt-title">${t.title}<small>${t.sub}</small></span>
          <span class="rt-len">${fmt(t.secs)}</span>
        </button></li>`).join('')}
      </ol>
      ${tracks.map((t, k) => `
      <section class="rr-sec" data-track="${t.id}">
        <p class="rr-sec-num">Track ${pad(k + 1)}</p>
        <h2>${t.title}</h2>
        ${t.html}
      </section>`).join('')}
      <footer class="rr-liner">
        ${others.length ? `<p class="rr-more-title">More from ${esc(artist)}</p>
        <div class="rr-more">${others.map((q) => `
          <button class="rr-album" data-open="${esc(q.id)}">
            <img data-cover="${esc(q.id)}" alt="">
            <strong>${esc(q.title)}</strong><span>${esc(q.year)} · ${esc(q.label)}</span>
          </button>`).join('')}</div>` : ''}
        <p class="rr-copy">℗ ${esc(p.year)} ${esc(artist)}. Recorded in Jais, Amethi. Mastered for the web.${p.album ? ` ${coverCredit(p.album)}. Shown as a tribute; artwork © its rights holders.` : ''}</p>
      </footer>
      </div>`;
  }

  async function show(p) {
    current = p;
    const i = indexOf(p);
    const genre = genreOf(p, i);
    root.dataset.genre = genre;
    root.style.setProperty('--accent', (art.get(artKey(p)) || {}).accent || GENRES[genre].accent);
    root.style.setProperty('--title-font', GENRES[genre].font);
    $('.rr-count', root).textContent = `Record ${pad(i + 1)} of ${pad(projects.length)}`;
    root.setAttribute('aria-label', `${p.title}, a project by ${artist}`);

    song.play(p);
    const right = $('.rr-scroll', root);
    right.innerHTML = pageHTML(p);
    right.scrollTop = 0;
    root.style.setProperty('--scrolled', '0');
    watchTracks(right);
    wireFlows(right);

    const a = await artFor(p);
    if (current !== p) return;
    root.style.setProperty('--accent', a.accent);
    root.style.setProperty('--ring', (p.album && p.album.ring) || a.accent);
    const layers = root.querySelectorAll('.rr-bg');
    bgLayer = 1 - bgLayer;
    layers[bgLayer].style.backgroundImage = `url("${a.cover}")`;
    layers[bgLayer].style.backgroundPosition = (p.album && p.album.focus) || 'center';
    // the slow drift zooms in around the focus point, so the part kept in view stays in view
    layers[bgLayer].style.transformOrigin = (p.album && p.album.focus) || 'center';
    layers[bgLayer].classList.add('on');
    layers[1 - bgLayer].classList.remove('on');

    for (const q of projects) {
      if (q === p) continue;
      artFor(q).then((qa) => {
        const img = right.querySelector(`img[data-cover="${CSS.escape(q.id)}"]`);
        if (img) img.src = qa.cover;
      });
    }
  }

  // Highlight the track being read, like the song playing in a list.
  function watchTracks(scroller) {
    if (observer) observer.disconnect();
    const seen = new Map();
    observer = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.dataset.track, e.intersectionRatio);
      let best = null;
      let ratio = 0;
      for (const [id, r] of seen) if (r > ratio) { ratio = r; best = id; }
      scroller.querySelectorAll('.rr-track').forEach((b) => b.classList.toggle('active', b.dataset.track === best && ratio > 0));
    }, { root: scroller, threshold: [0, 0.25, 0.5, 0.75, 1] });
    scroller.querySelectorAll('.rr-sec').forEach((s) => observer.observe(s));
  }

  /* ---------- Opening and closing ---------- */

  function open(id, { fromHistory = false } = {}) {
    const p = projects.find((q) => q.id === id) || projects[0];
    if (!p) return;
    if (!isOpen) {
      isOpen = true;
      pickAlbums(); // a fresh song for every record on each visit
      opener = document.activeElement;
      api.onOpen();
      document.body.classList.add('records-open');
      root.hidden = false;
      requestAnimationFrame(() => root.classList.add('is-open'));
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(tick);
      if (!fromHistory) history.pushState({ record: true }, '', `#record/${p.id}`);
      setTimeout(() => $('.rr-back', root).focus({ preventScroll: true }), 50);
    } else if (!fromHistory) {
      history.replaceState(history.state, '', `#record/${p.id}`);
    }
    show(p);
  }

  function close({ fromHistory = false } = {}) {
    if (!isOpen) return;
    // close here rather than via history.back(): the Spotify player adds history entries of its own
    if (!fromHistory) history.replaceState(null, '', location.pathname + location.search);
    isOpen = false;
    root.classList.remove('is-open');
    document.body.classList.remove('records-open');
    cancelAnimationFrame(raf);
    if (observer) observer.disconnect();
    if (flowWatch) flowWatch.disconnect();
    setTimeout(() => { if (!isOpen) root.hidden = true; }, 500);
    song.stop();
    api.onClose();
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  }

  function step(d) {
    const i = indexOf(current);
    open(projects[(i + d + projects.length) % projects.length].id);
  }

  function onClick(e) {
    const t = e.target.closest('[data-act], [data-track], [data-open]');
    if (!t) return;
    if (t.dataset.open) return open(t.dataset.open);
    if (t.dataset.track && t.classList.contains('rr-track')) {
      const sec = root.querySelector(`.rr-sec[data-track="${t.dataset.track}"]`);
      if (sec) sec.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    const m = api.music;
    switch (t.dataset.act) {
      case 'close': return close();
      case 'liner': return $('.rr-sheet', root).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      case 'prevrec': return step(-1);
      case 'nextrec': return step(1);
      case 'toggle': return player().toggle();
      case 'prev': return song.on ? song.prev() : m.prev();
      case 'next': return song.on ? step(1) : m.next();
      case 'shuffle': return m.shuffle();
      case 'mute': return m.setMuted(!m.isMuted());
      case 'queue':
        e.stopPropagation();
        return m.openQueue();
      default:
    }
  }

  // Keys while the record room is open. Returns true when the key is ours.
  function handleKey(e) {
    if (!isOpen) return false;
    if (e.key === 'Tab') return false;
    const onControl = e.target.closest && e.target.closest('button, a, [role="slider"]');
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const m = api.music;
    if (k === 'Escape') close();
    else if (k === 'ArrowLeft' && !onControl) step(-1);
    else if (k === 'ArrowRight' && !onControl) step(1);
    else if (k === ' ' && !onControl) player().toggle();
    // M mutes the piano; while Spotify plays the record's song it would only silence the
    // piano unseen (and leave it muted afterwards), so it is left alone then
    else if (k === 'm' && !song.on) m.setMuted(!m.isMuted());
    else if (k === 's' && !song.on) m.shuffle();
    else if (k === 'n') song.on ? step(1) : m.next();
    else if (k === 'p' && !song.on) m.openQueue();
    else return true; // swallow the rest so the stage's shortcuts stay quiet
    e.preventDefault();
    return true;
  }

  /* ---------- Live: the player bar, the meters, the glow ---------- */

  const needles = [];
  const needleAngle = [-48, -48];
  let last = 0;
  let shownPiece = null;

  function tick(now) {
    if (!isOpen) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const m = api.music;
    const src = player();
    const playing = src.isPlaying();
    root.classList.toggle('playing', playing);
    root.classList.toggle('song-mode', song.on);
    const play = $('.pb-play', root);
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play');

    const track = song.on ? song.info : m.piece();
    if (track && track !== shownPiece) {
      shownPiece = track;
      const artEl = $('.pb-art', root);
      if (song.on) {
        $('.pb-title', root).textContent = track.title;
        $('.pb-sub', root).textContent = `${track.artist} · ${track.album}`;
        artEl.style.backgroundImage = track.art ? `url("${track.art}")` : '';
        $('span', artEl).textContent = '';
        $('.pb-open', root).href = track.link || '#';
      } else {
        $('.pb-title', root).textContent = track.title;
        $('.pb-sub', root).textContent = `${track.composer} · ${track.part}`;
        artEl.style.backgroundImage = '';
        artEl.dataset.mood = track.light || 'neutral';
        $('span', artEl).textContent = track.composer.split(' ').slice(-1)[0][0];
      }
    }

    const dur = src.duration();
    const f = seekPreview ?? (dur ? src.position() / dur : 0);
    $('.pb-seek .pb-fill', root).style.width = `${clamp(f, 0, 1) * 100}%`;
    $('.pb-seek', root).setAttribute('aria-valuenow', Math.round(f * 100));
    $('.pb-elapsed', root).textContent = fmt(f * dur);
    $('.pb-total', root).textContent = dur ? fmt(dur) : (!song.on && track && track.length) || '–:––';

    const muted = m.isMuted();
    const vol = muted ? 0 : m.getVolume();
    root.classList.toggle('muted', muted || vol === 0);
    $('.pb-vol .pb-fill', root).style.width = `${vol * 100}%`;
    $('.pb-vol', root).setAttribute('aria-valuenow', Math.round(vol * 100));

    // VU ballistics: about 300 ms to swing, a touch slower to fall back
    const lv = song.on ? song.levels() : m.levels();
    let glow = 0;
    for (let c = 0; c < 2; c++) {
      const db = lv[c] > 1e-5 ? 20 * Math.log10(lv[c]) + 16 : -40;
      const target = vuAngle(clamp(vuFrac(clamp(db, -26, 4)), -0.02, 1.03));
      const rate = target > needleAngle[c] ? 9 : 5;
      needleAngle[c] += (target - needleAngle[c]) * Math.min(1, dt * rate);
      if (needles[c]) needles[c].setAttribute('transform', `rotate(${needleAngle[c].toFixed(2)} ${VU.cx} ${VU.cy})`);
      glow = Math.max(glow, (needleAngle[c] + 48) / 96);
    }
    root.style.setProperty('--lvl', glow.toFixed(3));
    raf = requestAnimationFrame(tick);
  }

  /* ---------- The record's song ---------- */

  // Each record plays its song while open, in Spotify's own embedded player (in the
  // player bar). Visitors logged in to Spotify hear the full song; everyone else hears
  // Spotify's preview. The piano rests meanwhile and picks up again when the record closes.
  const song = (() => {
    const s = { on: false, info: null };
    let api_ = null;
    let ctl = null;
    let ready = null;
    let state = { playing: false, pos: 0, dur: 0, at: 0 };
    let token = 0;
    let waiting = null;

    // Browsers let a page start sound only once the visitor has interacted with it. Opening a
    // record by click counts; landing on one by a refresh or a shared link doesn't, and the
    // browser turns the song down. So until it is really playing, the visitor's first click,
    // tap or key anywhere on the page starts it.
    function startOnFirstTouch(mine) {
      stopWaiting();
      waiting = (e) => {
        if (mine !== token || !s.on) return stopWaiting();
        if (e.type === 'keydown' && (e.key === 'Escape' || e.metaKey || e.ctrlKey || e.altKey)) return;
        if (!state.playing && ctl) ctl.play();
      };
      // on window, so the page's own handlers run first: a click that closes the record or
      // turns to another one has already stopped or replaced this song by now
      addEventListener('click', waiting);
      addEventListener('keydown', waiting);
    }

    function stopWaiting() {
      if (!waiting) return;
      removeEventListener('click', waiting);
      removeEventListener('keydown', waiting);
      waiting = null;
    }

    function loadAPI() {
      api_ ||= new Promise((resolve, reject) => {
        window.onSpotifyIframeApiReady = resolve;
        const el = document.createElement('script');
        el.src = 'https://open.spotify.com/embed/iframe-api/v1';
        el.async = true;
        el.onerror = reject;
        document.head.appendChild(el);
      });
      return api_;
    }

    function controller(uri) {
      ready ||= loadAPI().then((IFrameAPI) => new Promise((resolve) => {
        IFrameAPI.createController($('#spotifyEmbed', root), { uri, width: '100%', height: 80 }, (c) => {
          c.addListener('playback_update', (e) => {
            const d = e.data || {};
            state = { playing: !d.isPaused && !d.isBuffering, pos: (d.position || 0) / 1000, dur: (d.duration || 0) / 1000, at: performance.now() };
            // the song is under way (the clock moves only when sound is really playing)
            if (state.playing && state.pos > 0) stopWaiting();
          });
          ctl = c;
          resolve(c);
        });
      }));
      return ready;
    }

    s.play = async (p) => {
      const mine = ++token;
      const a = p.album;
      if (!a || !a.spotify) {
        s.stop();
        return;
      }
      const uri = `spotify:track:${a.spotify}`;
      s.on = true;
      s.info = { title: a.song || a.title, artist: a.artist, album: a.title, art: a.art, link: `https://open.spotify.com/track/${a.spotify}` };
      state = { playing: false, pos: 0, dur: 0, at: performance.now() };
      api.music.holdPiano();
      try {
        const fresh = !ctl;
        const c = await controller(uri);
        if (mine !== token) return;
        if (!fresh) c.loadUri(uri);
        setTimeout(() => {
          if (mine !== token) return;
          c.play();
          startOnFirstTouch(mine); // in case the browser held the sound back
        }, fresh ? 600 : 250);
      } catch (err) {
        if (mine === token) { s.on = false; api.music.releasePiano(); }
      }
    };

    s.stop = () => {
      ++token;
      stopWaiting();
      if (ctl) ctl.pause();
      state.playing = false;
      s.on = false;
      api.music.releasePiano();
    };

    s.toggle = () => { if (ctl) ctl.togglePlay(); };
    s.prev = () => { if (ctl) ctl.seek(0); };
    s.isPlaying = () => state.playing;
    s.position = () => Math.min(state.dur, state.pos + (state.playing ? (performance.now() - state.at) / 1000 : 0));
    s.duration = () => state.dur;
    s.seek = (t) => { if (ctl) ctl.seek(t); };
    // the embed's sound can't be measured from here, so the meters move with a lifelike sway
    s.levels = () => {
      if (!state.playing) return [0, 0];
      const t = performance.now() / 1000;
      const base = 0.2 + 0.05 * Math.sin(t * 0.7);
      const beat = 0.06 * Math.max(0, Math.sin(t * 7.3)) + 0.04 * Math.sin(t * 13.1) * Math.sin(t * 2.3);
      return [base + beat + 0.02 * Math.sin(t * 17), base + beat + 0.02 * Math.sin(t * 19 + 1)];
    };
    return s;
  })();

  // whichever is playing on this page: the record's song, or the piano
  const player = () => (song.on ? song : { ...api.music, toggle: api.music.toggle });

  /* ---------- Setup ---------- */

  function init(options) {
    api = options;
    projects = options.projects || [];
    artist = options.artist || '';
    monogram = options.monogram || '';
    if (!projects.length) return;
    build();
    root.querySelectorAll('.vu-needle').forEach((n) => needles.push(n));

    let saved = NaN;
    try { saved = parseFloat(localStorage.getItem('piano-volume')); } catch (e) { /* storage unavailable */ }
    if (isFinite(saved)) api.music.setVolume(clamp(saved, 0, 1));

    addEventListener('popstate', () => {
      const m = /^#record\/(.+)$/.exec(location.hash);
      if (m) open(decodeURIComponent(m[1]), { fromHistory: true });
      else close({ fromHistory: true });
    });
    const m = /^#record\/(.+)$/.exec(location.hash);
    if (m) {
      history.replaceState(null, '', location.href);
      open(decodeURIComponent(m[1]), { fromHistory: true });
    }
  }

  return {
    init,
    open: (id) => open(id),
    close: () => close(),
    isOpen: () => isOpen,
    handleKey,
  };
})();
