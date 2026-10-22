// 3D Tavi for the hero: peeks out from behind TJ's photo, runs to "AI SEO" in the H1, hops on and stays.
// Uses the look-dev engine (src/tavi/engine) on a transparent canvas laid over the hero.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Tavi3D, applyBody } from './engine/tavi3d.js';
import { studioEnvironment, glassEnvironment } from './engine/looks.js';
import { expression, idle, mix } from './engine/tavi-face.js';

type Rect = { l: number; t: number; r: number; b: number; w: number; h: number };

// Build Tavi with lights and the studio environment on a renderer.
function buildScene(renderer: THREE.WebGLRenderer) {
  RectAreaLightUniformsLib.init();
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  const tavi = new Tavi3D({ era: 2026 });
  tavi.mats.glass.envMap = glassEnvironment(renderer);
  tavi.mats.glass.needsUpdate = true;
  tavi.setExposure(1.15);
  // lights live inside the character's space, so they scale with it
  const rig = new THREE.Group();
  const key = new THREE.DirectionalLight('#fff1e2', 1.1); key.position.set(-2.2, 3.2, 2.6); rig.add(key);
  rig.add(new THREE.HemisphereLight('#fff6ec', '#3a2c22', 0.25));
  const front = new THREE.RectAreaLight('#fff4ea', 2.5, 5, 3.5); front.position.set(-0.6, 0.7, 5.5); front.lookAt(0, 0.7, 0); rig.add(front);
  const right = new THREE.RectAreaLight('#ffe6cc', 4.5, 1.2, 5); right.position.set(4.2, 1.0, 1.2); right.lookAt(0, 0.7, 0); rig.add(right);
  tavi.root.add(rig);
  scene.add(tavi.root);
  return { scene, tavi };
}

function makeRenderer(canvas?: HTMLCanvasElement, preserve = false) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: preserve });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

// Height of the model (feet to antenna bulb) in its own units
function modelHeight(tavi: any) {
  tavi.update(0, 0.016, expression('neutral'));
  const box = new THREE.Box3().setFromObject(tavi.root);
  return { h: box.max.y - box.min.y, minY: box.min.y };
}

// A transparent still of Tavi, happy face, for fallbacks. Returns a PNG data URL.
export function renderStill(size = 512) {
  const renderer = makeRenderer(undefined, true);
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  const { scene, tavi } = buildScene(renderer);
  applyBody(tavi, 'proud', 0.6);
  const m = modelHeight(tavi);
  const cam = new THREE.OrthographicCamera(-m.h * 0.55, m.h * 0.55, m.h * 1.05, -m.h * 0.05, -50, 50);
  cam.position.set(0, 0, 10);
  tavi.root.rotation.y = 0.25;
  tavi.update(1.2, 0.016, expression('joyful', 0.9));
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/png');
}

// Tavi in the hero: a small canvas positioned inside the hero section (it scrolls away with it).
// Script: peek out from behind TJ's photo, fly to "AI SEO", bounce three times, then wander the hero's
// free space on a calm, endless path with the odd playful move. He never leaves the hero.
export function mountHeroTavi(opts: { hero: HTMLElement; photo: HTMLElement; words: HTMLElement[] }) {
  const { hero, photo, words } = opts;
  const S = 240, FOOT = 26;                       // canvas size (css px); feet sit FOOT px above its bottom
  const canvas = document.createElement('canvas');
  canvas.className = 'tavi-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.width = canvas.style.height = `${S}px`;
  hero.append(canvas);
  const renderer = makeRenderer(canvas);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(S, S, false);
  const { scene, tavi } = buildScene(renderer);
  const base = modelHeight(tavi);
  const cam = new THREE.OrthographicCamera(-S / 2, S / 2, S - FOOT, -FOOT, -2000, 2000);
  cam.position.set(0, 0, 1000);

  // positions are hero-relative: feet point, x right, y down from the hero's top-left
  const s = { x: 0, y: 0, lift: 0, ox: 0, turn: 0, lean: 0, squash: 1, h: 110 };
  const heroH = () => Math.max(100, Math.min(130, window.innerWidth * 0.08));
  let clipX: number | null = null;               // hide the part right of this x (peeking behind the photo)
  const place = () => {
    const x = s.x + s.ox;
    canvas.style.transform = `translate3d(${(x - S / 2).toFixed(1)}px, ${(s.y - (S - FOOT)).toFixed(1)}px, 0)`;
    canvas.style.clipPath = clipX === null ? '' : `inset(0 ${Math.max(0, S / 2 - (clipX - x)).toFixed(1)}px 0 0)`;
    tavi.root.scale.setScalar(s.h / base.h);
    tavi.root.position.set(0, s.lift - base.minY * tavi.root.scale.y, 0);
    tavi.root.rotation.y = s.turn;
    tavi.pose.tiltZ = s.lean;
    tavi.pose.squash = s.squash;
  };
  const rel = (el: Element) => { const r = el.getBoundingClientRect(), h = hero.getBoundingClientRect(); return { l: r.left - h.left, r: r.right - h.left, t: r.top - h.top, b: r.bottom - h.top, w: r.width, h: r.height }; };

  // face blending
  let face = expression('neutral'), faceFrom = face, faceTo = face, faceT = 1, faceName = 'neutral';
  const setFace = (name: string, k = 1) => { if (name === faceName) return; faceName = name; faceFrom = face; faceTo = expression(name, k); faceT = 0; };

  // tweens
  type Tw = { t0: number; d: number; f: (k: number) => void; res: () => void };
  let tweens: Tw[] = [];
  const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const tween = (d: number, f: (k: number) => void) => new Promise<void>((res) => { tweens.push({ t0: performance.now(), d, f, res }); kick(); });
  const wait = (d: number) => tween(d, () => {});
  const hop = async (h: number, d: number) => {
    await tween(d * 0.45, (k) => { s.lift = h * Math.sin(k * Math.PI / 2); s.squash = 1 + 0.06 * Math.sin(k * Math.PI); });
    await tween(d * 0.4, (k) => { s.lift = h * Math.cos(k * Math.PI / 2); });
    await tween(d * 0.15, (k) => { s.squash = 0.86 + 0.14 * k; });
  };
  const dip = () => words.forEach((w) => w.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(2px)' }, { transform: 'translateY(0)' }], { duration: 260, easing: 'ease-out' }));
  const aiSeo = () => {
    const rs = words.map(rel);
    const l = Math.min(...rs.map((r) => r.l)), r = Math.max(...rs.map((r) => r.r)), t = Math.min(...rs.map((q) => q.t));
    return { x: (l + r) / 2, y: t + rs[0].h * 0.16 - 2 };
  };

  // render loop: full rate while moving, ~15 fps while hovering; stops when the hero is off screen
  let raf = 0, last = performance.now(), lastRender = 0, moving = true, paws = 0, inView = true;
  let fly: null | ((now: number, dt: number) => void) = null;
  const kick = () => { if (!raf && inView) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  function frame(now: number) {
    raf = 0;
    if (!inView) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    tweens = tweens.filter((tw) => { const k = Math.max(0, Math.min(1, (now - tw.t0) / tw.d)); tw.f(k); if (k >= 1) { tw.res(); return false; } return true; });
    if (fly) fly(now, dt);
    if (faceT < 1) { faceT = Math.min(1, faceT + dt / 0.35); face = mix(faceFrom, faceTo, faceT); }
    if (paws > 0) { const w = Math.sin(now / 1000 * 12) * 0.5 * paws; tavi.pawPose.forEach((p: any, i: number) => { p.rx = i ? w : -w; }); }
    const busy = moving || tweens.length > 0 || faceT < 1;
    if (busy || now - lastRender > 66) {
      place();
      const t = now / 1000;
      tavi.update(t, dt, idle(face, t, 3));
      renderer.render(scene, cam);
      lastRender = now;
    }
    raf = requestAnimationFrame(frame);
  }
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) kick(); }, { threshold: 0 }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  // free spots in the hero (feet points). Neighbours are linked so his path stays in the open:
  // above the H1, the gap beside the photo, the photo's top corners and lower left, below the trust row.
  const spots = () => {
    const h1 = rel(hero.querySelector('h1')!), ph = rel(photo), tr = rel(hero.querySelector('.hl-trust')!), hb = hero.getBoundingClientRect().height;
    const h = s.h, below = tr.b + h + 14 <= hb - 8;
    const p: Record<string, { x: number; y: number }> = {
      aboveL: { x: h1.l + h1.w * 0.22, y: h1.t - 4 },
      aboveR: { x: h1.l + h1.w * 0.72, y: h1.t - 4 },
      gapTop: { x: ph.l - 14, y: ph.t + h + 10 },
      gapMid: { x: ph.l - 14, y: ph.t + ph.h * 0.6 },
      photoTL: { x: ph.l + ph.w * 0.2, y: ph.t + h + 14 },
      photoTR: { x: ph.r - ph.w * 0.18, y: ph.t + h + 14 },
      photoBL: { x: ph.l + ph.w * 0.16, y: ph.b - 10 },
    };
    if (below) { p.belowR = { x: tr.l + tr.w * 0.78, y: tr.b + h + 14 }; p.belowL = { x: tr.l + tr.w * 0.25, y: tr.b + h + 14 }; }
    return p;
  };
  const links: Record<string, string[]> = {
    aboveL: ['aboveR'], aboveR: ['aboveL', 'gapTop'], gapTop: ['aboveR', 'photoTL', 'gapMid'],
    photoTL: ['gapTop', 'photoTR', 'photoBL'], photoTR: ['photoTL'], photoBL: ['photoTL', 'gapMid'],
    gapMid: ['gapTop', 'photoBL', 'belowR'], belowR: ['gapMid', 'belowL'], belowL: ['belowR'],
  };

  // calm wandering: a soft spring chases the current spot, so the path curves
  const startWander = () => {
    const vel = { x: 0, y: 0 };
    let at = 'aboveR', target = aiSeo(), arrived = false, busy = false, moves = 0;
    const next = async () => {
      if (busy) return;
      busy = true;
      await wait(900 + Math.random() * 900);
      const sp = spots();
      moves++;
      // a playful move every few hops: back onto "AI SEO", a loop, or a peek behind the photo
      if (moves % 4 === 0) {
        const pick = ['perch', 'loop', 'peek'][Math.floor(Math.random() * 3)];
        if (pick === 'perch' && (at === 'aboveL' || at === 'aboveR')) {
          target = aiSeo(); arrived = false; busy = false; at = 'aboveR'; return;
        }
        if (pick === 'loop') {
          setFace('joyful', 0.8);
          await tween(1400, (k) => { const a = k * Math.PI * 2; s.ox = Math.sin(a) * 34; s.lift = (1 - Math.cos(a)) * 30; s.turn = Math.sin(a) * 0.9; });
          s.ox = 0; setFace('content', 1); busy = false; next(); return;
        }
        if (pick === 'peek' && (at === 'gapTop' || at === 'gapMid')) {
          const ph = rel(photo), w = s.h * 0.75;
          clipX = ph.l; setFace('surprised', 0.5);
          const x0 = s.x;
          await tween(600, (k) => { s.x = x0 + (ph.l + w - x0) * ease(k); });     // slips behind the photo
          await wait(500);
          setFace('joyful', 0.8);
          await tween(500, (k) => { s.x = ph.l + w - (w * 1.7) * ease(k); });     // pops back out
          clipX = null; target = { x: s.x, y: s.y }; busy = false; next(); return;
        }
      }
      const opts = (links[at] || []).filter((n) => sp[n]);
      at = opts[Math.floor(Math.random() * opts.length)] || 'aboveR';
      target = sp[at]; arrived = false; busy = false;
    };
    fly = (now, dt) => {
      const dx = target.x - s.x, dy = target.y - s.y;
      vel.x += (dx * 5 - vel.x * 4.2) * dt; vel.y += (dy * 7 - vel.y * 5) * dt;
      const sp = Math.hypot(vel.x, vel.y);
      if (sp > 420) { vel.x *= 420 / sp; vel.y *= 420 / sp; }
      s.x += vel.x * dt; s.y += vel.y * dt;
      const flying = Math.hypot(dx, dy) > 5 || sp > 20;
      moving = flying || tweens.length > 0;
      if (flying) {
        paws = Math.min(1, sp / 220);
        s.turn += ((vel.x < 0 ? -0.75 : 0.75) * Math.min(1, Math.abs(vel.x) / 120) - s.turn) * 0.06;
        s.lean += (Math.max(-0.2, Math.min(0.2, -vel.x * 0.0007)) - s.lean) * 0.1;
        if (!busy) s.lift = Math.min(14, sp / 30) + Math.sin(now / 260) * 3;
        setFace('hopeful', 0.6);
        applyBody(tavi, 'hopeful', 0.5);
      } else {
        paws = 0; s.lean *= 0.92; s.turn *= 0.95;
        if (!busy) s.lift = Math.sin(now / 650) * 4;
        if (!arrived) {
          arrived = true;
          const onWords = Math.hypot(s.x - aiSeo().x, s.y - aiSeo().y) < 12;
          applyBody(tavi, 'proud', 0.4); setFace('content', 1);
          if (onWords) { busy = true; s.lift = 0; hop(16, 420).then(() => { dip(); return hop(10, 360); }).then(() => { dip(); return wait(1400); }).then(() => { busy = false; next(); }); }
          else next();
        }
      }
    };
    next();
  };

  const play = async () => {
    s.h = heroH();
    const ph = rel(photo);
    const p = aiSeo();
    const w = s.h * 0.75;
    const peekY = Math.min(ph.b - 20, Math.max(p.y, ph.t + s.h + 24));
    // 1. peek from behind the photo's left edge
    clipX = ph.l;
    s.x = ph.l + w; s.y = peekY; s.turn = -0.5; applyBody(tavi, 'hopeful', 0.6); setFace('hopeful', 0.8);
    kick();
    await tween(450, (k) => { s.x = ph.l + w - w * 1.05 * ease(k); });
    setFace('surprised', 0.5);
    await tween(560, (k) => { s.turn = -0.5 + Math.sin(k * Math.PI * 2) * 0.45; s.lean = Math.sin(k * Math.PI * 2) * 0.08; });
    setFace('joyful', 0.7);
    await tween(260, (k) => { s.x = ph.l - w * 0.05 - w * 0.95 * ease(k); s.lift = Math.sin(k * Math.PI) * 16; });
    clipX = null;
    // 2. fly left to "AI SEO"
    applyBody(tavi, 'determined', 0.7); setFace('determined', 0.6);
    const fromX = s.x, fromY = s.y, toX = p.x + w * 1.25;
    paws = 1; s.turn = -0.85;
    await tween(1000, (k) => {
      const e = ease(k);
      s.x = fromX + (toX - fromX) * e; s.y = fromY + (p.y - fromY) * e;
      s.lift = Math.abs(Math.sin(k * Math.PI * 7)) * 8 + Math.sin(k * Math.PI) * 30;
      s.lean = 0.22 * Math.sin(Math.PI * Math.min(1, k * 1.2));
    });
    paws = 0; applyBody(tavi, 'neutral'); s.lean = 0;
    // 3. land on the words and bounce three times
    const jx = s.x;
    await tween(520, (k) => { s.x = jx + (p.x - jx) * k; s.lift = Math.sin(k * Math.PI) * 70; s.turn = -0.85 + 0.85 * k; });
    s.lift = 0; setFace('joyful', 1); applyBody(tavi, 'joyful', 0.6);
    await tween(160, (k) => { s.squash = 0.82 + 0.18 * k; }); dip();
    await hop(28, 480); dip();
    await hop(18, 420); dip();
    await hop(10, 360); dip();
    applyBody(tavi, 'proud', 0.4); setFace('content', 1);
    await wait(1200);
    // 4. wander the hero
    startWander();
  };

  return { play, canvas };
}
