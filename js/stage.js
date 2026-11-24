// The 3D stage: a concert grand modelled part by part (case and mouldings,
// cast-iron frame with struts, overstrung strings, bridges, dampers, lid with
// folded flap and hinges, turned legs, lyre and pedals, tufted bench, 88 keys),
// standing on a polished floor under a single spotlight.
// Units are metres. The keyboard faces +z; the case runs back along -z.
window.Stage = (() => {
  const T = window.THREE;
  const WW = 0.0235; // white key pitch
  const KEY_TOP = 0.74;
  const PIVOT_Z = -0.3;
  const PRESS = 0.034; // radians a key dips when struck
  const IS_BLACK = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
  const LID_ANGLE = 0.6;

  let renderer, scene, camera, raycaster;
  let dust = null;
  let mode = 'intro';
  let trans = null;
  let time = 0;
  let last = performance.now();
  let pose = null;
  let reduced = false;
  let onKey = null;
  const keys = new Map(); // midi -> { pivot, angle }
  const keyMeshes = [];
  let pressed = new Set();
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let lights = null;
  let paused = false; // nothing is drawn while another page covers the stage
  const FX = window.THREE_FX || null; // post-processing (bloom and the finishing pass), when available
  let composer = null;
  let bloom = null;
  let finish = null;
  let hq = true;
  const beams = [];
  let haze = null;
  let flash = 0;
  let beamFade = 1;
  const BRIGHTNESS = 0.8;
  let close = 0; // 0 in the wide shot, 1 leaning in to play: closer views need gentler glow
  let prevPressed = new Set();
  let energy = 0; // how busy the music is right now, 0–1, smoothed
  let focusX = 0; // keyboard position the play camera centres on
  let focusSmooth = 0;
  const _p = new T.Vector3();

  /* ---------- Textures ---------- */

  function canvasTex(w, h, draw, linear) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    if (!linear) t.encoding = T.sRGBEncoding;
    t.anisotropy = 8;
    return t;
  }

  const repeat = (t, x, y) => {
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(x, y);
    return t;
  };

  // Fine grain for the lacquer's roughness, so highlights break up like a real finish.
  function noiseTexture() {
    return repeat(canvasTex(256, 256, (g, w, h) => {
      const img = g.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        const v = 118 + Math.random() * 28;
        img.data.set([v, v, v, 255], i * 4);
      }
      g.putImageData(img, 0, 0);
    }, true), 5, 5);
  }

  function spruceTexture() {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#c99a5e';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 320; i++) {
        const x = Math.random() * w;
        g.strokeStyle = `rgba(${110 + Math.random() * 30},${70 + Math.random() * 20},30,${0.06 + Math.random() * 0.12})`;
        g.lineWidth = 0.5 + Math.random() * 1.6;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + Math.random() * 8 - 4, h * 0.3, x + Math.random() * 8 - 4, h * 0.7, x + Math.random() * 6 - 3, h);
        g.stroke();
      }
    });
  }

  // Hammertone gold paint, as on a cast-iron piano frame.
  function plateTexture() {
    return repeat(canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#a57a32';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const light = Math.random() < 0.5;
        g.fillStyle = light ? `rgba(240,200,120,${0.05 + Math.random() * 0.1})` : `rgba(60,35,10,${0.05 + Math.random() * 0.12})`;
        g.beginPath();
        g.arc(Math.random() * w, Math.random() * h, 0.6 + Math.random() * 2.2, 0, Math.PI * 2);
        g.fill();
      }
    }), 3, 3);
  }

  // Dark polished stage boards.
  function floorTexture() {
    return repeat(canvasTex(1024, 1024, (g, w, h) => {
      const rows = 8;
      const ph = h / rows;
      for (let r = 0; r < rows; r++) {
        let x = -Math.random() * 400;
        while (x < w) {
          const len = 280 + Math.random() * 420;
          const tone = 20 + Math.random() * 12;
          g.fillStyle = `rgb(${tone + 9},${tone + 4},${tone})`;
          g.fillRect(x, r * ph, len, ph);
          for (let k = 0; k < 36; k++) {
            const y = r * ph + Math.random() * ph;
            g.strokeStyle = `rgba(0,0,0,${0.06 + Math.random() * 0.12})`;
            g.lineWidth = 0.5 + Math.random() * 1.5;
            g.beginPath();
            g.moveTo(x, y);
            g.bezierCurveTo(x + len * 0.3, y + (Math.random() - 0.5) * 6, x + len * 0.7, y + (Math.random() - 0.5) * 6, x + len, y + (Math.random() - 0.5) * 4);
            g.stroke();
          }
          g.fillStyle = 'rgba(0,0,0,0.55)';
          g.fillRect(x, r * ph, 2, ph);
          x += len;
        }
        g.fillStyle = 'rgba(0,0,0,0.7)';
        g.fillRect(0, r * ph, w, 2);
      }
    }), 7, 7);
  }

  function softShadowTexture() {
    return canvasTex(256, 256, (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, 'rgba(0,0,0,0.85)');
      r.addColorStop(0.55, 'rgba(0,0,0,0.45)');
      r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, w, h);
    });
  }

  function nameboardTexture(text) {
    return canvasTex(1024, 96, (g, w, h) => {
      g.font = '600 54px "Cormorant Garamond", Georgia, serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#f2d892');
      grad.addColorStop(1, '#b2873a');
      g.fillStyle = grad;
      g.fillText(text.split('').join(String.fromCharCode(8202)), w / 2, h / 2 + 2);
    });
  }

  // Engraved-looking score for the music desk (both pages on one texture).
  function sheetTexture() {
    return canvasTex(1600, 720, (g, w, h) => {
      g.fillStyle = '#efe7d6';
      g.fillRect(0, 0, w, h);
      const shade = g.createLinearGradient(w / 2 - 40, 0, w / 2 + 40, 0);
      shade.addColorStop(0, 'rgba(0,0,0,0)');
      shade.addColorStop(0.5, 'rgba(60,40,20,0.12)');
      shade.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = shade;
      g.fillRect(w / 2 - 40, 0, 80, h);
      g.fillStyle = '#2a241f';
      g.strokeStyle = '#2a241f';
      g.textAlign = 'center';
      g.font = 'italic 34px Georgia, serif';
      g.fillText('Sonata quasi una fantasia', w * 0.25, 62);
      g.font = '22px Georgia, serif';
      g.fillText('III.  Presto agitato', w * 0.25, 96);
      g.fillText('L. van Beethoven, Op. 27 No. 2', w * 0.75, 70);
      for (let page = 0; page < 2; page++) {
        const x0 = (page * w) / 2 + 50;
        const x1 = ((page + 1) * w) / 2 - 50;
        for (let sys = 0; sys < 4; sys++) {
          const top = (page === 0 ? 140 : 120) + sys * 145;
          g.lineWidth = 1.4;
          for (const off of [0, 62]) {
            for (let l = 0; l < 5; l++) {
              g.beginPath();
              g.moveTo(x0, top + off + l * 9);
              g.lineTo(x1, top + off + l * 9);
              g.stroke();
            }
          }
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x0, top);
          g.lineTo(x0, top + 98);
          g.stroke();
          for (let grp = 0; grp < 12; grp++) {
            const gx = x0 + 40 + grp * ((x1 - x0 - 60) / 12);
            const base = top + 36 - (grp % 4) * 6;
            for (let k = 0; k < 4; k++) {
              const nx = gx + k * 13;
              const ny = base - k * 6;
              g.beginPath();
              g.ellipse(nx, ny, 5, 3.6, -0.35, 0, Math.PI * 2);
              g.fill();
              g.fillRect(nx + 4, ny - 28, 1.6, 28);
            }
            g.fillRect(gx + 4, base - 46, 40, 4);
            g.fillRect(gx + 4, base - 39, 40, 3);
            if (grp % 4 === 3) g.fillRect(gx + 56, top, 1.4, 98);
          }
          for (let k = 0; k < 6; k++) {
            const nx = x0 + 60 + k * ((x1 - x0 - 90) / 6);
            g.beginPath();
            g.ellipse(nx, top + 102 - (k % 2) * 5, 5, 3.6, -0.35, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    });
  }

  function dotTexture() {
    return canvasTex(64, 64, (g) => {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.4, 'rgba(255,255,255,0.35)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 64, 64);
    });
  }

  /* ---------- Materials ---------- */

  const M = {};
  function materials() {
    const grain = noiseTexture();
    M.lacquer = new T.MeshPhysicalMaterial({
      color: 0x050506, roughness: 0.32, roughnessMap: grain,
      clearcoat: 1, clearcoatRoughness: 0.07, clearcoatRoughnessMap: grain, envMapIntensity: 1.3,
    });
    M.ivory = new T.MeshPhysicalMaterial({ color: 0xf2ece0, roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.2, envMapIntensity: 0.55 });
    M.ebony = new T.MeshPhysicalMaterial({ color: 0x0b0b0d, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.14, envMapIntensity: 0.9 });
    M.plate = new T.MeshStandardMaterial({ map: plateTexture(), metalness: 0.3, roughness: 0.62, envMapIntensity: 0.2 });
    M.brass = new T.MeshStandardMaterial({ color: 0xc89a45, metalness: 0.95, roughness: 0.24, envMapIntensity: 1.1 });
    M.steel = new T.MeshStandardMaterial({ color: 0xd2d0cb, metalness: 1, roughness: 0.28, envMapIntensity: 1 });
    M.copper = new T.MeshStandardMaterial({ color: 0xb06d3a, metalness: 0.9, roughness: 0.4, envMapIntensity: 0.8 });
    M.spruce = new T.MeshStandardMaterial({ map: spruceTexture(), color: 0x9c8466, roughness: 0.55, envMapIntensity: 0.25 });
    M.maple = new T.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.5 });
    M.damper = new T.MeshStandardMaterial({ color: 0xb98d5c, roughness: 0.55 });
    M.felt = new T.MeshStandardMaterial({ color: 0x2e0a10, roughness: 1 });
    M.dark = new T.MeshStandardMaterial({ color: 0x0b0a0c, roughness: 0.7 });
    M.leather = new T.MeshPhysicalMaterial({ color: 0x141113, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.45 });
    M.paper = new T.MeshStandardMaterial({ map: sheetTexture(), color: 0xc9c0ad, roughness: 0.92, side: T.DoubleSide });
    M.cover = new T.MeshStandardMaterial({ color: 0xcfc3a8, roughness: 0.85 });
    M.floor = new T.MeshStandardMaterial({ map: floorTexture(), roughness: 0.34, envMapIntensity: 0.35 });
  }

  // A soft "studio" environment so the lacquer has long highlights to reflect.
  function environment() {
    const env = new T.Scene();
    env.add(new T.Mesh(new T.BoxGeometry(12, 7, 12), new T.MeshBasicMaterial({ color: 0x08070a, side: T.BackSide })));
    const panel = (w, h, hex, k, pos, look) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(hex).multiplyScalar(k), side: T.DoubleSide }));
      m.position.set(...pos);
      m.lookAt(...look);
      env.add(m);
    };
    panel(3.2, 1.2, 0xffe6c8, 4, [0.6, 3.2, 0.6], [0, 0, 0]);
    panel(0.5, 3.4, 0xffffff, 1.6, [-5.5, 1.8, 0.5], [0, 1.5, 0]);
    panel(2.4, 0.4, 0xcfd8ff, 1.2, [3.5, 1.6, -5], [0, 1, 0]);
    panel(1.2, 2.4, 0xffd9b0, 1.0, [4.5, 1.4, 3], [0, 1, 0]);
    const pm = new T.PMREMGenerator(renderer);
    const tex = pm.fromScene(env, 0.04).texture;
    pm.dispose();
    return tex;
  }

  /* ---------- Geometry helpers ---------- */

  const V = (x, y, z) => new T.Vector3(x, y, z);
  const V2 = (x, y) => new T.Vector2(x, y);

  // Top-view outline of the case, in (x, depth) where depth = -z.
  function outlineShape() {
    const s = new T.Shape();
    s.moveTo(-0.75, 0.17);
    s.lineTo(0.75, 0.17);
    s.lineTo(0.75, 0.75);
    s.bezierCurveTo(0.75, 1.2, 0.45, 1.35, 0.25, 1.55);
    s.bezierCurveTo(0.05, 1.8, -0.1, 2.12, -0.45, 2.15);
    s.bezierCurveTo(-0.68, 2.17, -0.75, 2.05, -0.75, 1.9);
    s.lineTo(-0.75, 0.17);
    return s;
  }

  function cleanPoints(pts) {
    const out = [];
    for (const p of pts) if (!out.length || out[out.length - 1].distanceTo(p) > 1e-5) out.push(p);
    if (out.length > 1 && out[0].distanceTo(out[out.length - 1]) < 1e-5) out.pop();
    return out;
  }

  // Offset a counter-clockwise polygon inwards by d (negative d grows it).
  function inset(pts, d) {
    const n = pts.length;
    return pts.map((p, i) => {
      const a = pts[(i - 1 + n) % n];
      const b = pts[(i + 1) % n];
      const e1 = p.clone().sub(a).normalize();
      const e2 = b.clone().sub(p).normalize();
      const n1 = V2(-e1.y, e1.x);
      const avg = n1.clone().add(V2(-e2.y, e2.x)).normalize();
      return p.clone().add(avg.multiplyScalar(d / Math.max(0.3, avg.dot(n1))));
    });
  }

  // A U-shaped band between two rings, open at the keyboard end (indices 0 and 1 are the front corners).
  function uBand(outerRing, innerRing) {
    return [...outerRing.slice(1), outerRing[0], innerRing[0], ...innerRing.slice(1).reverse()];
  }

  // Lay a shape-space geometry flat: shape y becomes depth (-z), extrusion becomes height.
  function flat(geo, y) {
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, y, 0);
    return geo;
  }

  function mesh(geo, mat, parent, shadow = true) {
    const m = new T.Mesh(geo, mat);
    m.castShadow = shadow;
    m.receiveShadow = shadow;
    (parent || scene).add(m);
    return m;
  }

  function roundedRect(w, h, r) {
    const s = new T.Shape();
    const x = -w / 2;
    const y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  // A box with softened edges (real furniture has no razor-sharp corners), centred on the origin.
  function softBoxGeo(w, h, d, r = 0.004) {
    r = Math.min(r, w / 4, h / 4, d / 4);
    const iw = w - 2 * r;
    const ih = h - 2 * r;
    const g = new T.ExtrudeGeometry(roundedRect(iw, ih, Math.min(r * 0.6, iw / 2, ih / 2)), {
      depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 3,
    });
    g.translate(0, 0, -(d - 2 * r) / 2);
    return g;
  }

  function softBox(w, h, d, mat, x, y, z, r, parent) {
    const m = mesh(softBoxGeo(w, h, d, r), mat, parent);
    m.position.set(x, y, z);
    return m;
  }

  function lathe(profile, mat, segs = 36) {
    return mesh(new T.LatheGeometry(profile.map(([r, y]) => V2(r, y)), segs), mat);
  }

  // Place a unit-height Y-aligned instance between two points.
  const _m = new T.Matrix4();
  const _q = new T.Quaternion();
  const _up = V(0, 1, 0);
  function instanceBetween(inst, i, a, b) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    _q.setFromUnitVectors(_up, dir.normalize());
    _m.compose(a.clone().add(b).multiplyScalar(0.5), _q, V(1, len, 1));
    inst.setMatrixAt(i, _m);
  }

  function rod(a, b, r, mat, segs = 16) {
    const m = mesh(new T.CylinderGeometry(r, r, 1, segs), mat);
    const dir = b.clone().sub(a);
    m.scale.y = dir.length();
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(_up, dir.normalize());
    return m;
  }

  // Depth of a polygon at a given x (farthest crossing).
  function depthAt(x, pts) {
    let best = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a.x - x) * (b.x - x) > 0 || a.x === b.x) continue;
      const t = (x - a.x) / (b.x - a.x);
      best = Math.max(best, a.y + t * (b.y - a.y));
    }
    return best;
  }

  /* ---------- The piano ---------- */

  function buildCase(outer, inner) {
    // rim, open at the keyboard end, with softened top and bottom edges
    mesh(flat(new T.ExtrudeGeometry(new T.Shape(uBand(outer, inner)), {
      depth: 0.29, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 5, curveSegments: 24,
    }), 0.67), M.lacquer);
    // plinth moulding that steps out around the base of the rim
    mesh(flat(new T.ExtrudeGeometry(new T.Shape(uBand(inset(outer, -0.012), inset(outer, 0.03))), {
      depth: 0.014, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 4, curveSegments: 24,
    }), 0.645), M.lacquer);
    mesh(flat(new T.ShapeGeometry(new T.Shape(outer)), 0.665), M.dark, null, false);
    softBox(1.5, 0.12, 0.04, M.lacquer, 0, 0.72, -0.19, 0.006);
  }

  function buildInterior(inner) {
    const ringA = inset(inner, 0.012); // outer edge of the frame
    const ringB = inset(inner, 0.075); // inner edge of the frame's perimeter band

    // soundboard and its bridges
    mesh(flat(new T.ShapeGeometry(new T.Shape(inner)), 0.8), M.spruce, null, false);
    const bridgeSeg = new T.InstancedMesh(new T.BoxGeometry(0.03, 0.022, 1), M.maple, 90);
    let bi = 0;
    const bridgePoint = (x) => V(x, 0.811, -(depthAt(x, ringB) - 0.06));
    for (let i = 0; i < 70; i++) {
      const a = bridgePoint(-0.22 + (0.8 * i) / 70);
      const b = bridgePoint(-0.22 + (0.8 * (i + 1)) / 70);
      _q.setFromUnitVectors(V(0, 0, 1), b.clone().sub(a).normalize());
      _m.compose(a.clone().add(b).multiplyScalar(0.5), _q, V(1, 1, a.distanceTo(b) + 0.002));
      bridgeSeg.setMatrixAt(bi++, _m);
    }
    const bassA = V(-0.56, 0.811, -1.62);
    const bassB = V(-0.24, 0.811, -1.78);
    for (let i = 0; i < 20; i++) {
      const a = bassA.clone().lerp(bassB, i / 20);
      const b = bassA.clone().lerp(bassB, (i + 1) / 20);
      _q.setFromUnitVectors(V(0, 0, 1), b.clone().sub(a).normalize());
      _m.compose(a.clone().add(b).multiplyScalar(0.5), _q, V(1.2, 1.2, a.distanceTo(b) + 0.002));
      bridgeSeg.setMatrixAt(bi++, _m);
    }
    bridgeSeg.castShadow = true;
    scene.add(bridgeSeg);

    // cast-iron frame: front web, perimeter band, struts and pressure bar
    const webShape = new T.Shape([V2(ringA[0].x, 0.21), V2(ringA[1].x, 0.21), V2(ringA[1].x, 0.46), V2(ringA[0].x, 0.46)]);
    mesh(flat(new T.ExtrudeGeometry(webShape, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 }), 0.852), M.plate);
    const cut = (ring) => [V2(ring[1].x, 0.44), ...ring.slice(2).filter((p) => p.y > 0.44), V2(ring[0].x, 0.44)];
    const a = cut(ringA);
    const b = cut(ringB);
    mesh(flat(new T.ExtrudeGeometry(new T.Shape([...a, ...b.reverse()]), {
      depth: 0.016, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2, curveSegments: 24,
    }), 0.852), M.plate);
    for (const sx of [-0.36, -0.07, 0.22, 0.48]) {
      const ex = sx - 0.06 + sx * 0.08;
      const p0 = V(sx, 0.872, -0.45);
      const p1 = V(ex, 0.872, -(depthAt(ex, ringB) + 0.02));
      const len = p0.distanceTo(p1);
      const strut = softBox(0.028, 0.034, len, M.plate, 0, 0, 0, 0.006);
      strut.position.copy(p0).add(p1).multiplyScalar(0.5);
      strut.rotation.y = Math.atan2(p1.x - p0.x, p1.z - p0.z);
    }
    softBox(ringA[1].x - ringA[0].x, 0.014, 0.022, M.plate, 0, 0.888, -0.455, 0.004);
    // decorative round openings in the frame's front web
    for (const x of [-0.5, -0.2, 0.2, 0.5]) {
      const ring = mesh(new T.TorusGeometry(0.03, 0.006, 10, 32), M.plate);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 0.868, -0.33);
    }

    // strings: wound copper bass overstrung across the steel treble
    const trebleN = 156;
    const bassN = 32;
    const treble = new T.InstancedMesh(new T.CylinderGeometry(0.00055, 0.00055, 1, 5), M.steel, trebleN);
    const bass = new T.InstancedMesh(new T.CylinderGeometry(0.0014, 0.0014, 1, 6), M.copper, bassN);
    const hitch = new T.InstancedMesh(new T.CylinderGeometry(0.0018, 0.0018, 0.012, 6), M.brass, trebleN + bassN);
    const pin = new T.Matrix4();
    for (let i = 0; i < trebleN; i++) {
      const x = -0.26 + 0.85 * (Math.floor(i / 3) / Math.floor((trebleN - 1) / 3)) + ((i % 3) - 1) * 0.0018;
      const end = V(x, 0.876, -(depthAt(x, ringB) - 0.01));
      instanceBetween(treble, i, V(x, 0.876, -0.25), end);
      pin.makeTranslation(end.x, end.y + 0.004, end.z);
      hitch.setMatrixAt(i, pin);
    }
    for (let i = 0; i < bassN; i++) {
      const x = -0.68 + (0.36 * i) / (bassN - 1);
      const ex = x + 0.16;
      const end = V(ex, 0.886, -(depthAt(ex, ringB) - 0.01));
      instanceBetween(bass, i, V(x, 0.886, -0.25), end);
      pin.makeTranslation(end.x, end.y + 0.004, end.z);
      hitch.setMatrixAt(trebleN + i, pin);
    }
    scene.add(treble, bass, hitch);

    // damper heads, lined up just behind the music desk (the top octaves have none)
    const dN = 88;
    const dampers = new T.InstancedMesh(softBoxGeo(0.0105, 0.024, 0.034, 0.0015), M.damper, dN);
    for (let i = 0; i < dN; i++) {
      pin.makeTranslation(-0.66 + i * 0.0124, 0.905, -0.49);
      dampers.setMatrixAt(i, pin);
    }
    dampers.castShadow = true;
    scene.add(dampers);
    softBox(1.14, 0.01, 0.012, M.dark, -0.12, 0.89, -0.47, 0.003);
  }

  function buildLid(outer) {
    const lid = new T.Group();
    lid.position.set(-0.75, 0.968, 0);
    lid.rotation.z = LID_ANGLE;
    scene.add(lid);
    const geo = flat(new T.ExtrudeGeometry(new T.Shape(outer), {
      depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 4, curveSegments: 24,
    }), 0);
    geo.translate(0.75, 0, 0);
    mesh(geo, M.lacquer, lid);
    // the front flap, folded back on top of the lid, and its long brass hinge
    softBox(1.49, 0.018, 0.27, M.lacquer, 0.75, 0.038, -0.31, 0.005, lid);
    const hinge = mesh(new T.CylinderGeometry(0.0055, 0.0055, 1.48, 16), M.brass, lid);
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(0.75, 0.03, -0.448);

    // brass butt hinges along the bass side
    for (const z of [-0.42, -1.05, -1.65]) {
      const k = mesh(new T.CylinderGeometry(0.007, 0.007, 0.07, 16), M.brass);
      k.rotation.x = Math.PI / 2;
      k.position.set(-0.758, 0.972, z);
    }

    // turned prop stick with brass ends, resting in a brass cup on the rim
    const lidPoint = (lx, z) => V(-0.75 + lx * Math.cos(LID_ANGLE), 0.968 + lx * Math.sin(LID_ANGLE), z);
    const base = V(0.62, 0.972, -0.95);
    const top = lidPoint(1.4, -0.95);
    const dir = top.clone().sub(base).normalize();
    rod(base.clone().addScaledVector(dir, 0.03), top.clone().addScaledVector(dir, -0.03), 0.0095, M.lacquer);
    rod(base, base.clone().addScaledVector(dir, 0.03), 0.011, M.brass);
    rod(top.clone().addScaledVector(dir, -0.03), top, 0.011, M.brass);
    const cup = mesh(new T.CylinderGeometry(0.022, 0.024, 0.008, 24), M.brass);
    cup.position.set(base.x, 0.968, base.z);
  }

  function buildKeyboardFurniture(makerName) {
    // keybed and key slip
    softBox(1.36, 0.05, 0.2, M.lacquer, 0, 0.693, -0.07, 0.004);
    softBox(1.375, 0.044, 0.024, M.lacquer, 0, 0.711, 0.036, 0.006);

    // key blocks: tall at the back, sweeping down to a rounded nose at the front
    const cheek = new T.Shape();
    cheek.moveTo(-0.04, 0);
    cheek.lineTo(-0.04, 0.03);
    cheek.quadraticCurveTo(-0.04, 0.056, -0.014, 0.056);
    cheek.bezierCurveTo(0.07, 0.056, 0.13, 0.1, 0.2, 0.104);
    cheek.lineTo(0.31, 0.104);
    cheek.lineTo(0.31, 0);
    cheek.closePath();
    for (const s of [-1, 1]) {
      const g = new T.ExtrudeGeometry(cheek, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 4, curveSegments: 12 });
      g.rotateY(Math.PI / 2);
      const m = mesh(g, M.lacquer);
      m.position.set(s > 0 ? 0.616 : -0.676, 0.668, 0);
    }

    // burgundy felt strip where the keys disappear under the fallboard
    const felt = mesh(new T.BoxGeometry(1.222, 0.003, 0.008), M.felt);
    felt.position.set(0, KEY_TOP + 0.0025, -0.146);
    // close the case between the fallboard ends and the rim
    for (const s of [-1, 1]) softBox(0.11, 0.27, 0.3, M.lacquer, s * 0.67, 0.805, -0.31, 0.004);

    // fallboard with a rounded top, and the maker's name in gold
    const fb = new T.Shape();
    fb.moveTo(0, 0);
    fb.lineTo(0, 0.15);
    fb.quadraticCurveTo(0, 0.186, 0.036, 0.186);
    fb.lineTo(0.05, 0.186);
    fb.lineTo(0.05, 0);
    fb.closePath();
    const fg = new T.ExtrudeGeometry(fb, { depth: 1.24, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 3, curveSegments: 12 });
    fg.rotateY(Math.PI / 2);
    fg.translate(-0.62, 0.752, -0.15);
    mesh(fg, M.lacquer);
    const nb = new T.Mesh(new T.PlaneGeometry(0.42, 0.04), new T.MeshBasicMaterial({ map: nameboardTexture(makerName), transparent: true, toneMapped: false }));
    nb.position.set(0, 0.855, -0.1455);
    scene.add(nb);

    // lacquered shelf over the tuning pins; the music desk stands on it
    softBox(1.43, 0.022, 0.27, M.lacquer, 0, 0.941, -0.305, 0.006);
  }

  function pageGeo(w, h, left) {
    const g = new T.PlaneGeometry(w, h, 24, 1);
    const p = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const u = uv.getX(i);
      const fromSpine = left ? 1 - u : u;
      p.setZ(i, 0.004 * Math.sin(Math.PI * fromSpine) + 0.012 * Math.pow(fromSpine, 3));
      uv.setX(i, left ? u * 0.5 : 0.5 + u * 0.5);
    }
    g.computeVertexNormals();
    return g;
  }

  function buildMusicDesk() {
    const desk = new T.Group();
    desk.position.set(0, 0.952, -0.34);
    desk.rotation.x = -0.28;
    scene.add(desk);
    softBox(0.84, 0.3, 0.014, M.lacquer, 0, 0.15, 0, 0.004, desk);
    // raised moulded frame around the desk panel
    for (const [w, h, x, y] of [[0.84, 0.016, 0, 0.292], [0.016, 0.3, -0.412, 0.15], [0.016, 0.3, 0.412, 0.15]]) {
      softBox(w, h, 0.01, M.lacquer, x, y, 0.011, 0.004, desk);
    }
    // ledge with a lip to hold the music
    softBox(0.84, 0.02, 0.05, M.lacquer, 0, 0.012, 0.024, 0.006, desk);
    softBox(0.84, 0.03, 0.008, M.lacquer, 0, 0.03, 0.047, 0.003, desk);
    // the score: a cover with two gently curling pages
    const cover = mesh(new T.BoxGeometry(0.61, 0.272, 0.002), M.cover, desk, false);
    cover.position.set(0, 0.162, 0.009);
    for (const left of [true, false]) {
      const page = mesh(pageGeo(0.3, 0.268, left), M.paper, desk, false);
      page.position.set(left ? -0.15 : 0.15, 0.162, 0.0105);
    }
  }

  function buildLegs() {
    const LEG = [[0, 0], [0.032, 0], [0.034, 0.02], [0.036, 0.12], [0.04, 0.25], [0.044, 0.38], [0.047, 0.46], [0.053, 0.48], [0.057, 0.495], [0.052, 0.51], [0.05, 0.525], [0.059, 0.54], [0.06, 0.56], [0.06, 0.585], [0, 0.585]];
    const FERRULE = [[0, 0], [0.034, 0], [0.036, 0.008], [0.035, 0.04], [0.032, 0.045], [0, 0.045]];
    for (const [x, d] of [[-0.62, 0.32], [0.62, 0.32], [-0.32, 1.85]]) {
      const z = -d;
      lathe(LEG, M.lacquer, 40).position.set(x, 0.07, z);
      lathe(FERRULE, M.brass, 32).position.set(x, 0.03, z);
      softBox(0.13, 0.04, 0.13, M.lacquer, x, 0.65, z, 0.008);
      // twin-wheel caster
      const housing = softBox(0.03, 0.022, 0.05, M.brass, x, 0.03, z, 0.004);
      housing.rotation.y = 0.4;
      for (const s of [-1, 1]) {
        const w = mesh(new T.CylinderGeometry(0.019, 0.019, 0.012, 24), M.brass);
        w.rotation.z = Math.PI / 2;
        w.rotation.y = 0.4;
        w.position.set(x + s * 0.02 * Math.cos(0.4), 0.019, z - s * 0.02 * Math.sin(0.4));
      }
    }
  }

  function buildLyre() {
    const z = -0.46;
    const POST = [[0, 0], [0.013, 0], [0.013, 0.03], [0.018, 0.042], [0.012, 0.056], [0.011, 0.25], [0.014, 0.27], [0.011, 0.29], [0.01, 0.42], [0.017, 0.44], [0.013, 0.46], [0.015, 0.48], [0, 0.48]];
    for (const s of [-1, 1]) lathe(POST, M.lacquer, 24).position.set(s * 0.085, 0.16, z);
    softBox(0.2, 0.03, 0.06, M.lacquer, 0, 0.645, z, 0.006);
    for (const x of [-0.04, 0, 0.04]) rod(V(x, 0.16, z), V(x, 0.63, z), 0.0028, M.brass, 10);
    softBox(0.34, 0.08, 0.11, M.lacquer, 0, 0.12, z, 0.01);
    // braces from the pedal box back to the case
    for (const s of [-1, 1]) rod(V(s * 0.06, 0.14, z - 0.05), V(s * 0.12, 0.64, -0.98), 0.008, M.lacquer, 12);

    // spoon-shaped brass pedals
    const pedal = new T.Shape();
    pedal.moveTo(-0.011, 0);
    pedal.lineTo(-0.011, 0.055);
    pedal.quadraticCurveTo(-0.022, 0.1, 0, 0.118);
    pedal.quadraticCurveTo(0.022, 0.1, 0.011, 0.055);
    pedal.lineTo(0.011, 0);
    pedal.closePath();
    for (const x of [-0.085, 0, 0.085]) {
      const g = new T.ExtrudeGeometry(pedal, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 3, curveSegments: 16 });
      g.rotateX(Math.PI / 2);
      const m = mesh(g, M.brass);
      m.position.set(x, 0.112, z + 0.05);
      m.rotation.x = 0.07;
    }
  }

  function buildBench() {
    const z = 0.66;
    softBox(0.9, 0.07, 0.34, M.lacquer, 0, 0.465, z, 0.01);
    softBox(0.86, 0.06, 0.31, M.leather, 0, 0.53, z, 0.022);
    // tufting buttons
    const btn = new T.SphereGeometry(0.0055, 12, 8);
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 2; j++) {
        const b = mesh(btn, M.leather, null, false);
        b.position.set(-0.3 + i * 0.15, 0.558, z - 0.06 + j * 0.12);
        b.scale.y = 0.5;
      }
    }
    const LEG = [[0, 0], [0.018, 0], [0.019, 0.02], [0.021, 0.2], [0.025, 0.34], [0.03, 0.36], [0.026, 0.38], [0.03, 0.4], [0.03, 0.43], [0, 0.43]];
    for (const [x, dz] of [[-0.4, -0.13], [0.4, -0.13], [-0.4, 0.13], [0.4, 0.13]]) lathe(LEG, M.lacquer, 24).position.set(x, 0, z + dz);
    // height-adjustment knobs
    const KNOB = [[0, 0], [0.024, 0], [0.03, 0.008], [0.031, 0.026], [0.024, 0.036], [0, 0.038]];
    for (const s of [-1, 1]) {
      const k = lathe(KNOB, M.lacquer, 28);
      k.rotation.z = -s * Math.PI / 2;
      k.position.set(s * 0.452, 0.465, z);
      const collar = mesh(new T.TorusGeometry(0.026, 0.0025, 8, 28), M.brass);
      collar.rotation.y = Math.PI / 2;
      collar.position.set(s * 0.456, 0.465, z);
    }
  }

  function buildPiano(makerName) {
    const outer = cleanPoints(outlineShape().getPoints(48));
    const inner = inset(outer, 0.04);
    buildCase(outer, inner);
    buildInterior(inner);
    buildLid(outer);
    buildKeyboardFurniture(makerName);
    buildMusicDesk();
    buildLegs();
    buildLyre();
    buildBench();
  }

  /* ---------- Keys ---------- */

  // Black keys taper towards the top and slope back at the front.
  function blackKeyGeo() {
    const bw = 0.0067;
    const tw = 0.0049;
    const h = 0.024;
    const r = 0.0013;
    const s = new T.Shape();
    s.moveTo(-bw, 0);
    s.lineTo(bw, 0);
    s.lineTo(tw, h - r);
    s.quadraticCurveTo(tw, h, tw - r, h);
    s.lineTo(-tw + r, h);
    s.quadraticCurveTo(-tw, h, -tw, h - r);
    s.closePath();
    const len = 0.095;
    const g = new T.ExtrudeGeometry(s, { depth: len, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0005, bevelSegments: 2, curveSegments: 4 });
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      if (z > len - 0.006) p.setZ(i, z - (p.getY(i) / h) * 0.009);
    }
    g.computeVertexNormals();
    g.translate(0, -h / 2, -len / 2);
    return g;
  }

  function buildKeys() {
    const x0 = -(52 * WW) / 2;
    const whiteGeo = softBoxGeo(WW - 0.0012, 0.022, 0.15, 0.0014);
    const blackGeo = blackKeyGeo();
    let wi = 0;
    for (let m = 21; m <= 108; m++) {
      const black = IS_BLACK[m % 12];
      const pivot = new T.Group();
      pivot.position.set(black ? x0 + wi * WW : x0 + wi * WW + WW / 2, KEY_TOP - 0.011, PIVOT_Z);
      const mat = (black ? M.ebony : M.ivory).clone();
      const key = new T.Mesh(black ? blackGeo : whiteGeo, mat);
      key.position.set(0, black ? 0.01 : 0, black ? -PIVOT_Z - 0.1025 : -PIVOT_Z - 0.075);
      key.castShadow = true;
      key.receiveShadow = true;
      key.userData.midi = m;
      pivot.add(key);
      scene.add(pivot);
      keys.set(m, { pivot, angle: 0, mat });
      keyMeshes.push(key);
      if (!black) wi++;
    }
  }

  /* ---------- Room & light ---------- */

  function glowTexture() {
    return canvasTex(256, 256, (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.35, 'rgba(255,255,255,0.35)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, w, h);
    });
  }

  // A shaft of light in the haze: an open cone, brightest at its source and
  // where the line of sight grazes it, fading towards the floor.
  function beamMaterial() {
    return new T.ShaderMaterial({
      uniforms: { uColor: { value: new T.Color() }, uIntensity: { value: 0 }, uTime: { value: 0 } },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        varying float vH;
        void main() {
          vH = uv.y;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = -mv.xyz;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vView;
        varying float vH;
        void main() {
          float facing = abs(dot(normalize(vNormal), normalize(vView)));
          float soft = pow(facing, 2.2);
          float fall = pow(vH, 1.7);
          float drift = 0.9 + 0.1 * sin(uTime * 0.7 + vH * 9.0);
          gl_FragColor = vec4(uColor * uIntensity * soft * fall * drift, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      side: T.DoubleSide,
    });
  }

  function makeBeam(angle, length) {
    const g = new T.ConeGeometry(Math.tan(angle) * length, length, 64, 1, true);
    g.translate(0, -length / 2, 0);
    const m = new T.Mesh(g, beamMaterial());
    m.renderOrder = 3;
    m.frustumCulled = false;
    scene.add(m);
    return m;
  }

  function aimBeam(m, from, to) {
    m.position.copy(from);
    m.quaternion.setFromUnitVectors(V(0, -1, 0), to.clone().sub(from).normalize());
  }

  function buildRoom() {
    const floor = mesh(new T.PlaneGeometry(28, 28), M.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.002;
    floor.castShadow = false;

    // soft contact shadows that ground the piano and bench
    const shadowTex = softShadowTexture();
    const blob = (w, d, x, z, o) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: o }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.004, z);
      scene.add(m);
    };
    blob(2.4, 3.1, -0.05, -1.1, 0.8);
    blob(1.3, 0.7, 0, 0.66, 0.65);

    // the key light: a hard theatrical spot from above and in front
    const spot = new T.SpotLight(0xffe2bd, 2.8, 0, 0.4, 0.7, 1);
    spot.position.set(1.4, 4.6, 1.6);
    spot.target.position.set(0, 0.8, -0.7);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.bias = -0.0003;
    spot.shadow.normalBias = 0.02;
    spot.shadow.camera.near = 1;
    spot.shadow.camera.far = 10;
    scene.add(spot, spot.target);

    const keyLight = new T.SpotLight(0xfff1dc, 1.1, 0, 0.35, 0.8, 1);
    keyLight.position.set(0, 2.6, 1.4);
    keyLight.target.position.set(0, 0.74, -0.1);
    scene.add(keyLight, keyLight.target);

    // back lights that carve the lacquered silhouette out of the dark
    const rim = new T.SpotLight(0xaabbe8, 2.2, 0, 0.55, 0.85, 1);
    rim.position.set(-1.7, 3.4, -3.9);
    rim.target.position.set(0.3, 0.9, -0.8);
    scene.add(rim, rim.target);
    const kicker = new T.SpotLight(0x8090c0, 1.2, 0, 0.5, 0.9, 1);
    kicker.position.set(3.1, 1.6, -2.7);
    kicker.target.position.set(0, 0.8, -0.5);
    scene.add(kicker, kicker.target);

    const hemi = new T.HemisphereLight(0x1c1a18, 0x020202, 0.14);
    scene.add(hemi);
    lights = { spot, key: keyLight, rim, kicker, hemi };

    // visible light: the main beam, and slow stage lights moving in the haze behind
    const mainBeam = makeBeam(0.36, 5.4);
    aimBeam(mainBeam, spot.position, spot.position.clone().lerp(spot.target.position, 4.6 / 3.8));
    beams.push({ mesh: mainBeam, main: true });
    for (const [x, phase] of [[-3.4, 0], [0.4, 2.1], [3.6, 4.2]]) {
      beams.push({ mesh: makeBeam(0.11, 8.5), main: false, x, phase });
    }
    haze = new T.Mesh(new T.PlaneGeometry(18, 10), new T.MeshBasicMaterial({ map: glowTexture(), color: 0x000000, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    haze.position.set(0, 2.4, -7.5);
    scene.add(haze);

    // dust drifting through the spotlight
    const n = 420;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (Math.random() - 0.5) * 3;
      p[i * 3 + 1] = 0.6 + Math.random() * 3.2;
      p[i * 3 + 2] = -2.2 + Math.random() * 3.2;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(p, 3));
    dust = new T.Points(g, new T.PointsMaterial({ size: 0.012, map: dotTexture(), color: 0xffe2b0, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending }));
    scene.add(dust);

    buildNoteLight();
  }

  /* ---------- Note light: falling bars, sparkle plumes and contact flares ---------- */

  // Upcoming notes fall as glowing bars onto the keys they will play; where a bar
  // meets its key the key lights up, a flare blooms, and fine sparks curl up from
  // it like smoke. Notes the visitor plays rise from the keys instead.
  //
  // The bars travel along the camera's "up" and face the camera, so they stay
  // perfectly vertical and parallel on screen, the way a piano-roll video looks.
  const NOTE_Z = -0.128; // where the bars meet the keys, just in front of the fallboard
  const NOTE_SPEED = 0.22; // metres per second
  const NOTE_RISE = 0.32; // how far above the keys a falling bar first appears
  const BAR_MARGIN = 0.018; // room around each bar for its glow
  const MAX_BARS = 260;
  const SPARKS = 14000;
  const MIST = 1400;
  let noteList = [];
  let noteNow = 0;
  let bars = null;
  let sparks = null;
  let mist = null;
  let flares = null;
  const flareGlow = new Map(); // midi -> glow 0–1
  const _bp = new T.Vector3();
  const _bs = new T.Vector3();
  const _camUp = new T.Vector3();
  const BLACK_KEY = new T.Color(0x000000);

  const contactY = (midi) => KEY_TOP + (IS_BLACK[midi % 12] ? 0.013 : 0.002);

  function buildNoteLight() {
    const additive = { transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide };

    // bars: a rounded capsule with crisp, anti-aliased edges, a white-hot centre,
    // a thin bright rim and a soft glow that fades to nothing at the quad's edge
    const bg = new T.PlaneGeometry(1, 1);
    bg.setAttribute('aSize', new T.InstancedBufferAttribute(new Float32Array(MAX_BARS * 2), 2));
    bg.setAttribute('aSpan', new T.InstancedBufferAttribute(new Float32Array(MAX_BARS * 2), 2));
    bars = new T.InstancedMesh(bg, new T.ShaderMaterial({
      ...additive,
      extensions: { derivatives: true },
      uniforms: { uColor: { value: new T.Color() }, uMaxD: { value: NOTE_RISE }, uMargin: { value: BAR_MARGIN }, uGain: { value: 2 } },
      vertexShader: `
        attribute vec2 aSize;
        attribute vec2 aSpan;
        varying vec2 vUv;
        varying vec2 vSize;
        varying vec2 vSpan;
        void main() {
          vUv = uv;
          vSize = aSize;
          vSpan = aSpan;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uMaxD, uMargin, uGain;
        varying vec2 vUv;
        varying vec2 vSize;
        varying vec2 vSpan;
        void main() {
          vec2 p = (vUv - 0.5) * vSize;            // metres from the bar's centre
          vec2 h = max(vSize * 0.5 - uMargin, vec2(1e-4));
          float r = min(h.x * 0.6, h.y);           // rounded ends
          vec2 q = abs(p) - h + r;
          float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
          float aa = max(fwidth(d), 1e-5);
          float body = 1.0 - smoothstep(-aa, aa, d);

          float across = clamp(abs(p.x) / h.x, 0.0, 1.0);
          float depth = clamp(-d / h.x, 0.0, 1.0);
          vec3 fill = mix(uColor, vec3(1.0), 0.88 * pow(1.0 - across, 1.4));
          fill *= 0.78 + 0.22 * smoothstep(0.0, 0.6, depth);
          float rim = body * (1.0 - smoothstep(0.0, 2.5 * aa + 0.0012, -d)) * 0.5;

          float g = clamp(d / uMargin, 0.0, 1.0);
          float glow = (1.0 - body) * (pow(1.0 - g, 3.0) * 0.55 + pow(1.0 - g, 12.0) * 0.6);

          float along = mix(vSpan.x - uMargin, vSpan.y + uMargin, vUv.y);
          float fade = 1.0 - smoothstep(uMaxD - 0.08, uMaxD, along);
          float landing = 1.0 + 0.5 * (1.0 - smoothstep(0.0, 0.04, along));
          vec3 col = (fill * body + uColor * (rim + glow)) * fade * landing;
          gl_FragColor = vec4(col * uGain, 1.0);
        }`,
    }), MAX_BARS);
    // the bars are light, not objects: they draw in front of the fallboard rather than behind it
    bars.material.depthTest = false;
    bars.count = 0;
    bars.frustumCulled = false;
    bars.renderOrder = 4;
    scene.add(bars);

    sparks = makePlume(SPARKS, `
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = exp(-d * d * 5.0) * (1.0 - smoothstep(0.75, 1.0, d));`);
    mist = makePlume(MIST, `
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = exp(-d * d * 3.2) * (1.0 - smoothstep(0.8, 1.0, d));`);
    mist.points.renderOrder = 4;

    // flares: a hot point with a soft halo and a wide horizontal glint, facing the camera
    const fg = new T.PlaneGeometry(1, 1);
    fg.setAttribute('aGlow', new T.InstancedBufferAttribute(new Float32Array(88), 1));
    flares = new T.InstancedMesh(fg, new T.ShaderMaterial({
      ...additive,
      uniforms: { uColor: { value: new T.Color() } },
      vertexShader: `
        attribute float aGlow;
        varying vec2 vUv;
        varying float vGlow;
        void main() {
          vUv = uv;
          vGlow = aGlow;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec2 vUv;
        varying float vGlow;
        void main() {
          vec2 p = (vUv - 0.5) * vec2(0.22, 0.1);
          float core = exp(-dot(p, p) / 0.000035);
          float halo = exp(-length(p) / 0.011) * 0.45;
          float glint = exp(-abs(p.y) / 0.0011) * exp(-abs(p.x) / 0.045) * 0.7;
          float ray = exp(-abs(p.x) / 0.0012) * exp(-abs(p.y) / 0.02) * 0.35;
          float edge = 1.0 - smoothstep(0.35, 0.5, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)));
          vec3 col = mix(uColor, vec3(1.0), 0.65) * (core * 1.8 + glint + ray) + uColor * halo;
          gl_FragColor = vec4(col * vGlow * edge * 1.6, 1.0);
        }`,
    }), 88);
    flares.material.depthTest = false;
    flares.count = 0;
    flares.frustumCulled = false;
    flares.renderOrder = 6;
    scene.add(flares);
  }

  // A particle system for the plumes: each particle climbs a helix around the
  // point it rose from, and the whole plume sways together, like smoke.
  function makePlume(n, falloff) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aColor', new T.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSize', new T.BufferAttribute(new Float32Array(n), 1));
    const points = new T.Points(g, new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      uniforms: { uScale: { value: 400 } },
      vertexShader: `
        attribute float aSize;
        attribute vec3 aColor;
        uniform float uScale;
        varying vec3 vColor;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float px = aSize * uScale / -mv.z;
          // below a pixel, shrink the light rather than the dot, so nothing shimmers
          vColor = aColor * min(1.0, px * px);
          gl_PointSize = aSize > 0.0 ? max(1.5, px) : 0.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          ${falloff}
          gl_FragColor = vec4(vColor * a, 1.0);
        }`,
    }));
    points.frustumCulled = false;
    points.renderOrder = 5;
    scene.add(points);
    const f = () => new Float32Array(n);
    return { points, geo: g, n, next: 0, ox: f(), oy: f(), oz: f(), age: f(), life: f(), vy: f(), phi: f(), spin: f(), r0: f(), spread: f(), size: f(), grow: f(), tint: f(), bright: f() };
  }

  function emitInto(P, midi, count, o) {
    const k = keys.get(midi);
    if (!k || !P || reduced) return;
    const x = k.pivot.position.x;
    const y = contactY(midi);
    for (let c = 0; c < count; c++) {
      const i = P.next++ % P.n;
      P.ox[i] = x + (Math.random() - 0.5) * o.jitter;
      P.oy[i] = y + Math.random() * 0.006;
      P.oz[i] = NOTE_Z + (Math.random() - 0.5) * 0.006;
      P.age[i] = 0;
      P.life[i] = o.life[0] + Math.random() * o.life[1];
      P.vy[i] = o.vy[0] + Math.random() * o.vy[1];
      P.phi[i] = Math.random() * Math.PI * 2;
      P.spin[i] = (Math.random() < 0.5 ? -1 : 1) * (o.spin[0] + Math.random() * o.spin[1]);
      P.r0[i] = Math.random() * o.r0;
      P.spread[i] = o.spread[0] + Math.random() * o.spread[1];
      P.size[i] = Math.random() < (o.glint || 0) ? o.size[1] * (1.6 + Math.random()) : o.size[0] + Math.random() * (o.size[1] - o.size[0]);
      P.grow[i] = o.grow || 0;
      P.tint[i] = Math.random();
      P.bright[i] = o.bright;
    }
  }

  const SPARK_BURST = { jitter: 0.01, life: [0.9, 1.5], vy: [0.1, 0.16], spin: [3, 5], r0: 0.004, spread: [0.004, 0.012], size: [0.0012, 0.0026], glint: 0.07, bright: 3.2 };
  const SPARK_STREAM = { jitter: 0.008, life: [1.1, 1.4], vy: [0.07, 0.09], spin: [2.5, 4], r0: 0.003, spread: [0.003, 0.008], size: [0.0011, 0.0022], glint: 0.05, bright: 2.5 };
  const MIST_PUFF = { jitter: 0.006, life: [1.0, 0.6], vy: [0.05, 0.03], spin: [1, 2], r0: 0.002, spread: [0.003, 0.004], size: [0.007, 0.012], grow: 0.016, bright: 0.055 };

  // A key has just been struck: flare it and throw up a puff of sparks and mist.
  function strike(midi) {
    flareGlow.set(midi, 1);
    emitInto(sparks, midi, 120, SPARK_BURST);
    emitInto(mist, midi, 6, MIST_PUFF);
  }

  function updateBars() {
    const sizeAttr = bars.geometry.attributes.aSize;
    const spanAttr = bars.geometry.attributes.aSpan;
    _camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    let n = 0;
    for (const b of noteList) {
      if (n >= MAX_BARS) break;
      const k = keys.get(b.midi);
      if (!k) continue;
      // distances from the key, measured along the bar
      let bottom;
      let top;
      if (b.rise) {
        bottom = b.off == null ? 0 : Math.max(0, noteNow - b.off) * NOTE_SPEED;
        top = Math.max(0, noteNow - b.on) * NOTE_SPEED;
      } else {
        bottom = Math.max(0, b.on - noteNow) * NOTE_SPEED;
        top = (b.off - noteNow) * NOTE_SPEED;
      }
      top = Math.min(top, NOTE_RISE + 0.1);
      if (top - bottom < 0.002 || bottom > NOTE_RISE) continue;
      const w = (IS_BLACK[b.midi % 12] ? 0.0105 : 0.0165) * (1 - close * 0.25);
      _bp.set(k.pivot.position.x, contactY(b.midi), NOTE_Z).addScaledVector(_camUp, (top + bottom) / 2);
      _bs.set(w + 2 * BAR_MARGIN, top - bottom + 2 * BAR_MARGIN, 1);
      _m.compose(_bp, camera.quaternion, _bs);
      bars.setMatrixAt(n, _m);
      sizeAttr.setXY(n, _bs.x, _bs.y);
      spanAttr.setXY(n, bottom, top);
      n++;
    }
    bars.count = n;
    bars.instanceMatrix.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    spanAttr.needsUpdate = true;
    const u = bars.material.uniforms;
    u.uColor.value.copy(live.note);
    u.uGain.value = 2.1 * (1 - close * 0.45);
  }

  // Flares, and the struck keys glowing from within.
  function updateFlares(dt) {
    const glowAttr = flares.geometry.attributes.aGlow;
    let n = 0;
    for (const [m, g] of flareGlow) {
      const held = pressed.has(m);
      const next = g + ((held ? 0.5 : 0) - g) * Math.min(1, dt * (held ? 3 : 7));
      const k = keys.get(m);
      if (!held && next < 0.01) {
        flareGlow.delete(m);
        if (k) k.mat.emissive.copy(BLACK_KEY);
        continue;
      }
      flareGlow.set(m, next);
      if (held && !reduced) {
        emitInto(sparks, m, Math.floor(320 * dt + Math.random()), SPARK_STREAM);
        if (Math.random() < 18 * dt) emitInto(mist, m, 1, MIST_PUFF);
      }
      if (!k) continue;
      k.mat.emissive.copy(live.note).multiplyScalar(next * (IS_BLACK[m % 12] ? 0.9 : 0.55));
      if (n >= 88) continue;
      const s = 0.75 + 0.5 * next;
      _m.compose(_bp.set(k.pivot.position.x, contactY(m) + 0.002, NOTE_Z + 0.004), camera.quaternion, _bs.set(0.22 * s, 0.1 * s, 1));
      flares.setMatrixAt(n, _m);
      glowAttr.setX(n, next);
      n++;
    }
    flares.count = n;
    flares.instanceMatrix.needsUpdate = true;
    glowAttr.needsUpdate = true;
    flares.material.uniforms.uColor.value.copy(live.note);
  }

  function updatePlume(P, dt) {
    const pos = P.geo.attributes.position.array;
    const col = P.geo.attributes.aColor.array;
    const siz = P.geo.attributes.aSize.array;
    const c = live.note;
    for (let i = 0; i < P.n; i++) {
      if (P.age[i] >= P.life[i]) {
        siz[i] = 0;
        continue;
      }
      const a = (P.age[i] += dt);
      const y = P.oy[i] + P.vy[i] * a + 0.02 * a * a;
      const R = P.r0[i] + P.spread[i] * a;
      const phi = P.phi[i] + P.spin[i] * a;
      const ox = P.ox[i];
      // the plume sways as a whole, so the sparks gather into wisps
      const sway = 0.011 * Math.sin(y * 24 + time * 1.3 + ox * 60) + 0.005 * Math.sin(y * 51 - time * 2.2 + ox * 97);
      const v = i * 3;
      pos[v] = ox + R * Math.cos(phi) + sway * Math.min(1, a * 2);
      pos[v + 1] = y;
      pos[v + 2] = P.oz[i] + R * Math.sin(phi) * 0.6;
      const k = Math.min(1, a / P.life[i]); // never past 1: a negative base would make NaN
      const fadeIn = Math.min(1, a * 10);
      const twinkle = P.grow[i] ? 1 : 0.6 + 0.4 * Math.sin(time * 19 + P.phi[i] * 13);
      const b = P.bright[i] * fadeIn * Math.pow(1 - k, 1.3) * twinkle;
      const w = P.tint[i] * 0.75;
      col[v] = (c.r + (1 - c.r) * w) * b;
      col[v + 1] = (c.g + (1 - c.g) * w) * b;
      col[v + 2] = (c.b + (1 - c.b) * w) * b;
      siz[i] = P.size[i] + P.grow[i] * a;
    }
    P.geo.attributes.position.needsUpdate = true;
    P.geo.attributes.aColor.needsUpdate = true;
    P.geo.attributes.aSize.needsUpdate = true;
  }

  function updateNoteLight(dt) {
    if (!bars) return;
    updateBars();
    updateFlares(dt);
    if (!reduced) {
      // particles are sized in metres; the camera's zoom changes, so refresh the scale
      const px = (renderer.domElement.height * 0.5) / Math.tan((camera.fov * Math.PI) / 360);
      for (const P of [sparks, mist]) {
        P.points.material.uniforms.uScale.value = px;
        updatePlume(P, dt);
      }
    }
  }

  /* ---------- Lighting moods ---------- */

  // Each piece sets a mood; the stage crossfades towards it.
  // spot: overhead key light · key: light on the keyboard · rim/kicker: back lights
  // accent: the stage lights and haze behind · bg: the darkness of the hall
  // beam/bloom: how visible the light is · lift/gain/sat: the colour grade
  // note: the falling notes, their flares and sparks
  const MOODS = {
    neutral: { spot: 0xffdcb4, spotI: 2.2, key: 0xfff1dc, keyI: 0.8, rim: 0xaabbe8, rimI: 2.0, accent: 0x7f8fc0, sky: 0x1c1a18, hemiI: 0.12, bg: 0x030203, dust: 0xffe2b0, note: 0xbfd4ff, exposure: 1.0, beam: 0.13, bloom: 0.42, sat: 1.05, lift: [0.012, 0.01, 0.008], gain: [1.02, 1.0, 0.97] },
    golden: { spot: 0xffb35c, spotI: 2.2, key: 0xffd9a0, keyI: 0.85, rim: 0xff9a3c, rimI: 2.4, accent: 0xff9440, sky: 0x2a1a0c, hemiI: 0.12, bg: 0x040201, dust: 0xffc56e, note: 0xffbe5a, exposure: 1.04, beam: 0.15, bloom: 0.5, sat: 1.12, lift: [0.026, 0.012, 0.0], gain: [1.06, 1.0, 0.9] },
    candle: { spot: 0xffaa74, spotI: 2.0, key: 0xffd2b0, keyI: 0.75, rim: 0xe08a6a, rimI: 1.8, accent: 0xc8648a, sky: 0x1e1214, hemiI: 0.11, bg: 0x030202, dust: 0xffc49a, note: 0xffa878, exposure: 1.0, beam: 0.12, bloom: 0.45, sat: 1.05, lift: [0.02, 0.01, 0.006], gain: [1.05, 0.98, 0.92] },
    dawn: { spot: 0xffc8b4, spotI: 2.3, key: 0xfff0e8, keyI: 0.85, rim: 0x9f8cff, rimI: 2.2, accent: 0xb48cff, sky: 0x1e1626, hemiI: 0.12, bg: 0x030305, dust: 0xffdcd2, note: 0xd2b4ff, exposure: 1.02, beam: 0.13, bloom: 0.48, sat: 1.06, lift: [0.016, 0.01, 0.024], gain: [1.03, 0.98, 1.02] },
    moonlit: { spot: 0x7f9fff, spotI: 2.3, key: 0xc8d6ff, keyI: 0.75, rim: 0x4f6fff, rimI: 2.8, accent: 0x3550ff, sky: 0x0c1226, hemiI: 0.12, bg: 0x010205, dust: 0xaec4ff, note: 0x9cc4ff, exposure: 0.98, beam: 0.17, bloom: 0.55, sat: 1.0, lift: [0.0, 0.01, 0.03], gain: [0.92, 0.98, 1.08] },
    crimson: { spot: 0xff3a2a, spotI: 2.7, key: 0xffb09a, keyI: 0.68, rim: 0xff1a10, rimI: 3.0, accent: 0xff1a10, sky: 0x220505, hemiI: 0.12, bg: 0x040101, dust: 0xff8060, note: 0xff5a3a, exposure: 0.98, beam: 0.19, bloom: 0.6, sat: 1.15, lift: [0.03, 0.0, 0.0], gain: [1.1, 0.9, 0.88] },
  };
  const COLOR_KEYS = ['spot', 'key', 'rim', 'accent', 'sky', 'bg', 'dust', 'note'];
  const NUM_KEYS = ['spotI', 'keyI', 'rimI', 'hemiI', 'exposure', 'beam', 'bloom', 'sat'];
  const VEC_KEYS = ['lift', 'gain'];
  const live = {};
  let goal = MOODS.neutral;
  for (const k of COLOR_KEYS) live[k] = new T.Color(goal[k]);
  for (const k of NUM_KEYS) live[k] = goal[k];
  for (const k of VEC_KEYS) live[k] = new T.Vector3(...goal[k]);
  const _c = new T.Color();
  const _v = new T.Vector3();

  function updateLights(dt) {
    if (!lights) return;
    const a = Math.min(1, dt * 0.9); // a slow, theatrical crossfade
    for (const k of COLOR_KEYS) live[k].lerp(_c.set(goal[k]), a);
    for (const k of NUM_KEYS) live[k] += (goal[k] - live[k]) * a;
    for (const k of VEC_KEYS) live[k].lerp(_v.set(...goal[k]), a);

    // the music drives the light: a slow swell with activity, a flash on big chords
    let struck = 0;
    for (const m of pressed) {
      if (prevPressed.has(m)) continue;
      struck++;
      if (struck <= 10) strike(m);
    }
    prevPressed = new Set(pressed);
    if (struck >= 3 && !reduced) flash = Math.min(1, flash + 0.55);
    flash = Math.max(0, flash - dt * 3.2);
    energy += (Math.min(1, pressed.size / 5) - energy) * Math.min(1, dt * 3);
    beamFade += ((mode === 'intro' ? 1 : 0) - beamFade) * Math.min(1, dt * 1.5);
    close += ((mode === 'play' ? 1 : mode === 'seated' ? 0.4 : 0) - close) * Math.min(1, dt * 2);

    lights.spot.color.copy(live.spot);
    lights.spot.intensity = live.spotI * (1 + energy * 0.1 + flash * 0.22);
    lights.key.color.copy(live.key);
    lights.key.intensity = live.keyI * (1 - close * 0.25) * (1 + energy * 0.06 + flash * 0.1);
    lights.rim.color.copy(live.rim);
    lights.rim.intensity = live.rimI * (1 + flash * 0.3);
    lights.kicker.color.copy(live.accent);
    lights.kicker.intensity = live.rimI * 0.5;
    lights.hemi.color.copy(live.sky);
    lights.hemi.intensity = live.hemiI;
    scene.background.copy(live.bg);
    scene.fog.color.copy(live.bg);

    for (const b of beams) {
      const u = b.mesh.material.uniforms;
      u.uTime.value = time;
      if (b.main) {
        u.uColor.value.copy(live.spot);
        const portrait = innerWidth / innerHeight < 0.9; // in portrait the beam crosses the intro text
        u.uIntensity.value = live.beam * beamFade * (portrait ? 0.3 : 1) * (1 + flash * 0.6 + energy * 0.15);
      } else {
        const sway = reduced ? 0 : Math.sin(time * 0.13 + b.phase) * 1.4;
        aimBeam(b.mesh, V(b.x, 7.2, -6.2), V(b.x * 0.55 + sway, 0, -3.6));
        u.uColor.value.copy(live.accent);
        u.uIntensity.value = live.beam * 0.7 * (0.5 + 0.5 * beamFade);
      }
    }
    if (haze) haze.material.color.copy(live.accent).multiplyScalar(0.07 + energy * 0.03);
    if (dust) {
      dust.material.color.copy(live.dust);
      dust.material.opacity = 0.42 + energy * 0.25;
    }
    if (bloom) bloom.strength = (live.bloom * 0.85 + flash * 0.3 + energy * 0.07) * (1 - close * 0.65);
    if (finish) {
      const u = finish.uniforms;
      u.uExposure.value = live.exposure * BRIGHTNESS * (1 - close * 0.2) * (1 + flash * 0.06);
      u.uLift.value.copy(live.lift);
      u.uGain.value.copy(live.gain);
      u.uSat.value = live.sat;
      u.uTime.value = reduced ? 0 : time;
    }
    if (!composer) renderer.toneMappingExposure = live.exposure * BRIGHTNESS;
  }

  /* ---------- Finishing: tone mapping, grade and lens ---------- */

  // Pinpoint highlights on lacquer can exceed what a half-float buffer holds;
  // clamp them (and drop any invalid pixels) so the bloom stays clean.
  const ClampShader = {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      varying vec2 vUv;
      float safe(float x) { return x == x ? clamp(x, 0.0, 24.0) : 0.0; }
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        gl_FragColor = vec4(safe(c.r), safe(c.g), safe(c.b), 1.0);
      }`,
  };

  // ACES filmic tone mapping, a lift/gain colour grade, an S-curve for contrast,
  // then a lens vignette, gentle chromatic fringing towards the edges and film grain.
  const FinishShader = {
    uniforms: {
      tDiffuse: { value: null },
      uExposure: { value: 1 },
      uLift: { value: new T.Vector3() },
      uGain: { value: new T.Vector3(1, 1, 1) },
      uSat: { value: 1 },
      uContrast: { value: 0.32 },
      uVignette: { value: 0.62 },
      uGrain: { value: 0.035 },
      uCA: { value: 0.0018 },
      uTime: { value: 0 },
      uRes: { value: new T.Vector2(1, 1) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uExposure, uSat, uContrast, uVignette, uGrain, uCA, uTime;
      uniform vec3 uLift, uGain;
      uniform vec2 uRes;
      varying vec2 vUv;
      vec3 rrtOdt(vec3 v) {
        vec3 a = v * (v + 0.0245786) - 0.000090537;
        vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
        return a / b;
      }
      vec3 aces(vec3 c) {
        const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
        const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
        c = outM * rrtOdt(inM * (c / 0.6));
        return clamp(c, 0.0, 1.0);
      }
      vec3 toSRGB(vec3 c) {
        return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      }
      void main() {
        vec2 d = vUv - 0.5;
        vec2 off = d * uCA;
        vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
        col = aces(col * uExposure);
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = clamp(mix(vec3(l), col, uSat), 0.0, 1.0);
        col = toSRGB(col);
        col = col * uGain + uLift * (1.0 - col);
        col = mix(col, col * col * (3.0 - 2.0 * col), uContrast);
        float v = 1.0 - smoothstep(0.28, 0.95, length(d * vec2(1.0, 1.12)));
        col *= mix(1.0, v, uVignette);
        float n = fract(sin(dot(vUv * uRes + uTime * 61.7, vec2(12.9898, 78.233))) * 43758.5453);
        col += (n - 0.5) * uGrain;
        gl_FragColor = vec4(col, 1.0);
      }`,
  };

  /* ---------- Camera ---------- */

  function introPose() {
    const aspect = innerWidth / innerHeight;
    const narrow = aspect < 0.9;
    const th = 0.62 + (reduced ? 0 : Math.sin(time * 0.09) * 0.3) + pointer.sx * 0.1;
    const r = narrow ? 4.8 / Math.max(0.5, aspect * 1.15) : 4.8;
    const tgt = V(0, 0.82, -0.85);
    return {
      pos: V(Math.sin(th) * r, 1.9 + pointer.sy * 0.15 + (narrow ? 0.9 : 0), tgt.z + Math.cos(th) * r),
      tgt,
      fov: 30,
      offX: narrow ? 0 : -0.17,
      offY: narrow ? 0.2 : 0,
    };
  }

  function seatPose() {
    const aspect = innerWidth / innerHeight;
    const half = aspect < 1 ? 0.34 : 0.72;
    const narrow = aspect < 1;
    const pos = V(pointer.sx * 0.03 + (reduced ? 0 : Math.sin(time * 0.3) * 0.006), (narrow ? 1.32 : 1.2) + pointer.sy * 0.02, narrow ? 0.62 : 0.46);
    const dist = pos.distanceTo(V(0, KEY_TOP, -0.07));
    const fov = clamp((2 * Math.atan(half / dist / aspect) * 180) / Math.PI, 28, 78);
    return { pos, tgt: V(0, 0.76, -0.16), fov, offX: 0, offY: 0 };
  }

  // Leaning in over the keys the visitor is playing.
  function playPose() {
    const aspect = innerWidth / innerHeight;
    const narrow = aspect < 1;
    const half = narrow ? 0.2 : 0.36;
    const fx = focusSmooth;
    const pos = V(fx * 0.85 + pointer.sx * 0.01, narrow ? 1.16 : 1.08, narrow ? 0.42 : 0.34);
    const dist = pos.distanceTo(V(fx, KEY_TOP, -0.07));
    const fov = clamp((2 * Math.atan(half / dist / aspect) * 180) / Math.PI, 24, 70);
    return { pos, tgt: V(fx, 0.745, -0.1), fov, offX: 0, offY: 0 };
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function lerpPose(a, b, e) {
    return {
      pos: a.pos.clone().lerp(b.pos, e),
      tgt: a.tgt.clone().lerp(b.tgt, e),
      fov: a.fov + (b.fov - a.fov) * e,
      offX: a.offX + (b.offX - a.offX) * e,
      offY: a.offY + (b.offY - a.offY) * e,
    };
  }

  function applyPose(p) {
    const w = innerWidth;
    const h = innerHeight;
    camera.position.copy(p.pos);
    camera.fov = p.fov;
    camera.aspect = w / h;
    if (Math.abs(p.offX) > 1e-4 || Math.abs(p.offY) > 1e-4) camera.setViewOffset(w, h, p.offX * w, p.offY * h, w, h);
    else camera.clearViewOffset();
    camera.lookAt(p.tgt);
    camera.updateProjectionMatrix();
  }

  /* ---------- Loop ---------- */

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 2);
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 2);

    focusSmooth += (focusX - focusSmooth) * Math.min(1, dt * 4);
    const target = mode === 'seated' ? seatPose() : mode === 'play' ? playPose() : introPose();
    if (trans) {
      const k = clamp((time - trans.start) / trans.dur, 0, 1);
      pose = lerpPose(trans.from, target, ease(k));
      if (k >= 1) trans = null;
    } else {
      pose = target;
    }
    applyPose(pose);
    updateLights(dt);

    for (const [m, k] of keys) {
      const goal = pressed.has(m) ? PRESS : 0;
      k.angle += (goal - k.angle) * Math.min(1, dt * (goal ? 55 : 22));
      k.pivot.rotation.x = k.angle;
    }

    if (dust && !reduced) {
      const a = dust.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) + dt * 0.03;
        if (y > 3.8) y = 0.6;
        a.setY(i, y);
        a.setX(i, a.getX(i) + Math.sin(time * 0.3 + i) * dt * 0.004);
      }
      a.needsUpdate = true;
    }

    updateNoteLight(dt);
    if (!paused) {
      if (composer) composer.render(dt);
      else renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Public API ---------- */

  function init(canvas, opts = {}) {
    reduced = !!opts.reduced;
    onKey = opts.onKey || null;
    // full effects on capable screens; lighter on phones and modest machines
    hq = innerWidth >= 820 && (navigator.hardwareConcurrency || 4) >= 4;
    const ratio = Math.min(devicePixelRatio || 1, hq ? 2 : 1.5);
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(ratio);
    renderer.setSize(innerWidth, innerHeight, false);
    if (FX) {
      // the finishing pass does tone mapping and sRGB, so the scene renders in linear HDR
      renderer.outputEncoding = T.LinearEncoding;
      renderer.toneMapping = T.NoToneMapping;
    } else {
      renderer.outputEncoding = T.sRGBEncoding;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
    }
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    scene = new T.Scene();
    scene.background = new T.Color(0x070609);
    scene.fog = new T.Fog(0x070609, 7, 16);
    camera = new T.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 40);
    raycaster = new T.Raycaster();

    materials();
    scene.environment = environment();
    buildRoom();
    buildPiano(opts.maker || '');
    buildKeys();

    if (FX) {
      composer = new FX.EffectComposer(renderer, new T.WebGLRenderTarget(innerWidth, innerHeight, { type: T.HalfFloatType }));
      composer.setPixelRatio(ratio);
      composer.setSize(innerWidth, innerHeight);
      composer.addPass(new FX.RenderPass(scene, camera));
      composer.addPass(new FX.ShaderPass(ClampShader));
      const bloomScale = hq ? 1 : 0.5;
      bloom = new FX.UnrealBloomPass(V2(innerWidth * bloomScale, innerHeight * bloomScale), 0.45, 0.5, 2.2);
      composer.addPass(bloom);
      finish = new FX.ShaderPass(FinishShader);
      finish.uniforms.uRes.value.set(innerWidth * ratio, innerHeight * ratio);
      if (!hq) finish.uniforms.uCA.value = 0;
      composer.addPass(finish);
    }


    addEventListener('resize', () => {
      renderer.setSize(innerWidth, innerHeight, false);
      if (composer) {
        composer.setSize(innerWidth, innerHeight);
        finish.uniforms.uRes.value.set(innerWidth * ratio, innerHeight * ratio);
      }
    });
    addEventListener('pointermove', (e) => {
      pointer.x = (e.clientX / innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / innerHeight) * 2 - 1);
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (!onKey || mode === 'intro') return;
      const ndc = V2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(keyMeshes, false)[0];
      if (hit) onKey(hit.object.userData.midi);
    });

    pose = introPose();
    requestAnimationFrame((t) => { last = t; frame(t); });
  }

  function setMode(m, dur = 3.4) {
    if (m === mode) return;
    mode = m;
    trans = { from: pose, start: time, dur: reduced ? 0.01 : dur };
  }

  return {
    init,
    setMode,
    setPressed: (set) => { pressed = set; },
    pressedCount: () => pressed.size,
    setMood: (name) => { goal = MOODS[name] || MOODS.neutral; },
    setPaused: (p) => { paused = !!p; },
    // notes to draw as light: [{ midi, on, off, rise }] with times in audio-clock seconds
    setNotes: (list, now) => { noteList = list; noteNow = now; },
    // centre the play camera on a key
    setFocus: (midi) => { const k = keys.get(midi); if (k) focusX = k.pivot.position.x; },
    // where a key's playing surface appears on screen, in CSS pixels
    project: (midi) => {
      const k = keys.get(midi);
      if (!k || !camera) return null;
      const black = IS_BLACK[midi % 12];
      _p.set(k.pivot.position.x, KEY_TOP + (black ? 0.013 : 0.001), black ? -0.088 : -0.03).project(camera);
      if (_p.z > 1) return null;
      return { x: ((_p.x + 1) / 2) * innerWidth, y: ((1 - _p.y) / 2) * innerHeight };
    },
  };
})();
