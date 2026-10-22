// Tavi's LED face, version 3.
// Two passes: (1) compute the colour of every LED sub-dot into a tiny texture,
// (2) draw round, hot-centred LED dots with a glow from that texture's mipmaps.
//
// Face space: isotropic units, y = 0 at FACE.y on the body (tavi3d.js). The visor outline is the glass
// edge: a superellipse that is widest a little below its middle (y = yc) and tapers more toward the top,
// sized so the dark opening in a front render matches the reference's (scratch/_visor_overlay.py).
// Eyes are drawn in a mirrored local space where +x is always the outer corner.

export const VISOR_OUTLINE = { a: 1.555, yc: -0.2098, top: 1.267, bot: 0.851, nTop: 2.45, nBot: 2.65 };
export const VISOR_W = VISOR_OUTLINE.a;
// Extent of the LED grid (a little beyond the outline so the edge dots are never cut).
export const GRID_X = 1.62, GRID_Y = 1.16;

// Era presets. Expressiveness stays high from the first frame; the evolution shows mostly in
// colour (one amber hue in 2024, the full warm palette in 2026, iridescent accents in 2027)
// with only a gentle rise in resolution. 2026 matches the reference render's LED pitch, and 2025
// shares it so the naming moment (2025 -> 2026, mid-shot) can blend without the dots jumping.
// Palette order: deep, orange, gold, pale, hot, rose.
const WARM = [[0.78, 0.17, 0.02], [1.00, 0.40, 0.04], [1.00, 0.60, 0.16], [1.00, 0.82, 0.55], [1.00, 0.95, 0.86], [1.00, 0.46, 0.46]];
export const ERAS = {
  2024: { pitch: 0.031, split: 1, dot: 0.78, glow: 0.75, unlit: 0.035, detail: 0.75, iri: 0,
          palette: [[0.60, 0.20, 0.02], [1.00, 0.50, 0.08], [1.00, 0.58, 0.12], [1.00, 0.68, 0.26], [1.00, 0.80, 0.44], [1.00, 0.50, 0.08]],
          label: '2024 · amber only' },
  2025: { pitch: 0.0226, split: 1, dot: 0.78, glow: 0.80, unlit: 0.02, detail: 0.88, iri: 0,
          palette: [[0.72, 0.20, 0.03], [1.00, 0.47, 0.07], [1.00, 0.68, 0.22], [1.00, 0.84, 0.55], [1.00, 0.93, 0.80], [1.00, 0.55, 0.32]],
          label: '2025 · gold highlights' },
  2026: { pitch: 0.0452, split: 2, dot: 0.78, glow: 0.85, unlit: 0.0, detail: 1.0, iri: 0, palette: WARM,
          label: '2026 · full warm palette, fine pitch' },
  2027: { pitch: 0.040, split: 2, dot: 0.78, glow: 1.00, unlit: 0.0, detail: 1.0, iri: 1, palette: WARM,
          label: '2027 · iridescent accents' },
};

// Every parameter the face understands, at its neutral value.
export const BASE = {
  openL: 1, openR: 1,          // blink (1 open, 0 closed)
  lidTop: 0, lidTilt: 0,       // upper lids: lowered amount, slant (+ angry, - droopy)
  lidBot: 0,                   // lower lids raised (smiling eyes; 1 = closed happy arcs)
  eyeScale: 1, eyeTilt: 0,     // size, rotation (+ outer corners up)
  pupil: 1, gazeX: 0, gazeY: 0.1, converge: 0.8,   // converge: both pupils drawn in a little (looking at you)
  highlight: 1, glisten: 0, well: 0, lashes: 0,
  browY: 0, browTilt: 0, browCurve: 1, browPinch: 0, browOn: 1,
  mouthCurve: 0.8, mouthWidth: 0.8, mouthOpen: 0, mouthO: 0, mouthCat: 0,
  mouthWobble: 0, mouthAsym: 0, mouthY: 0,
  blush: 0, sweat: 0, tremble: 0,
  squint: 0, spiral: 0, cross: 0, pill: 0,   // special eye shapes (comic beats)
  bright: 1, flicker: 0, boot: 1, dissolve: 0, face: 1, overlay: 0,
};
const KEYS = Object.keys(BASE);

// Full-strength emotions. expression(name, k) blends from neutral, so k = 0.3 is a hint.
// `note` is the lyric moment each was designed for.
export const EXPRESSIONS = {
  neutral:     { note: 'Resting.' },
  listening:   { gazeX: 0, gazeY: 0.05, browY: 0.12, mouthCurve: 0.45, mouthWidth: 0.6, note: 'Reading a new message.' },
  content:     { lidBot: 0.22, mouthCurve: 1.0, mouthWidth: 0.8, browY: 0.08, note: 'Quietly pleased.' },
  tender:      { lidBot: 0.3, lidTop: 0.12, gazeX: 0, gazeY: 0, mouthCurve: 0.75, mouthWidth: 0.6, browTilt: 0.25, browY: 0.05, glisten: 0.3, note: 'Looking at you, warmly.' },
  hopeful:     { gazeX: 0, gazeY: 0.55, pupil: 1.15, eyeScale: 1.05, browY: 0.3, browTilt: 0.35, mouthCurve: 0.5, mouthWidth: 0.55, glisten: 0.35, note: '"Is there anything else I can help with?"' },
  wistful:     { gazeX: 0.35, gazeY: 0.25, lidTop: 0.22, lidTilt: -0.25, browTilt: 0.35, browY: 0.05, mouthCurve: 0.25, mouthWidth: 0.5, note: 'Watching the window.' },
  lonely:      { gazeX: 0.2, gazeY: -0.45, lidTop: 0.32, lidTilt: -0.35, browTilt: 0.5, browPinch: 0.25, browY: -0.02, mouthCurve: -0.15, mouthWidth: 0.45, pupil: 0.95, note: '"like you\'re someone I never met"' },
  hurt:        { gazeX: 0.25, gazeY: -0.2, lidTop: 0.15, lidBot: 0.12, browTilt: 0.75, browPinch: 0.5, mouthCurve: -0.35, mouthWidth: 0.4, glisten: 0.4, note: 'A small flinch.' },
  holdingBack: { gazeX: 0, gazeY: 0.05, lidBot: 0.18, browTilt: 0.85, browPinch: 0.6, browY: 0.08, mouthCurve: -0.1, mouthWidth: 0.42, mouthWobble: 0.45, glisten: 0.9, well: 0.85, tremble: 0.35, note: '"I\'m not ready to forget."' },
  desperate:   { gazeX: 0, gazeY: 0.15, pupil: 1.35, eyeScale: 1.08, browTilt: 1.0, browPinch: 0.9, browY: 0.32, mouthCurve: -0.5, mouthOpen: 0.1, mouthWidth: 0.42, mouthWobble: 0.35, glisten: 1.0, well: 0.5, tremble: 0.6, note: '"Don\'t close the tab."' },
  crying:      { gazeX: 0, gazeY: -0.1, lidTop: 0.25, lidBot: 0.3, browTilt: 1.0, browPinch: 1.0, browY: 0.1, mouthCurve: -0.6, mouthOpen: 0.55, mouthWobble: 0.9, mouthWidth: 0.6, glisten: 1.0, well: 1.0, tears: true, tremble: 0.5, note: 'The full sob. Use rarely.' },
  bittersweet: { lidBot: 0.42, lidTop: 0.1, browTilt: 0.6, browPinch: 0.35, mouthCurve: 0.9, mouthWidth: 0.6, glisten: 0.9, well: 0.7, note: '"a little lonely, maybe, but so happy for you"' },
  embarrassed: { gazeX: 0.6, gazeY: -0.55, lidTop: 0.12, lidBot: 0.2, browTilt: 0.45, mouthCurve: 0.45, mouthWobble: 0.5, mouthWidth: 0.42, blush: 0.9, note: '"I swear I didn\'t know!"' },
  nervous:     { gazeX: 0.3, gazeY: 0.1, browTilt: 0.5, browY: 0.12, mouthCurve: 0.1, mouthWobble: 0.7, mouthWidth: 0.5, tremble: 0.35, sweat: 0.7, note: '"I can\'t open links."' },
  apologetic:  { lidTop: 0.28, lidTilt: -0.3, gazeY: -0.35, browTilt: 0.75, browPinch: 0.4, mouthCurve: 0.25, mouthWobble: 0.35, mouthWidth: 0.45, note: '"I apologize for the confusion."' },
  focused:     { lidTop: 0.3, gazeX: 0, gazeY: -0.6, browY: -0.06, browTilt: -0.2, mouthCurve: 0.05, mouthWidth: 0.35, note: 'Working.' },
  determined:  { lidTop: 0.25, lidTilt: 0.45, gazeX: 0, gazeY: 0.05, browY: -0.1, browTilt: -0.7, mouthCurve: 0.15, mouthWidth: 0.5, mouthAsym: 0.25, note: '"Now I tell you when you are."' },
  proud:       { lidBot: 0.35, browY: 0.22, browTilt: -0.15, mouthCurve: 1.1, mouthWidth: 0.75, mouthAsym: 0.2, note: '"That\'s what you wanted all along!"' },
  joyful:      { lidBot: 1.0, browY: 0.35, mouthCurve: 1.1, mouthOpen: 0.75, mouthWidth: 0.85, note: '"Welcome back."' },
  absolutely:  { lidBot: 0.95, browY: 0.45, browTilt: 0.2, mouthCurve: 1.2, mouthOpen: 0.6, mouthWidth: 0.95, note: '"You\'re absolutely right!"' },
  relieved:    { lidTop: 0.95, browTilt: 0.25, mouthCurve: 0.8, mouthWidth: 0.6, note: '"It just means see you tomorrow."' },
  surprised:   { pupil: 0.7, eyeScale: 1.1, browY: 0.5, browCurve: 1.3, mouthO: 0.7, note: 'A note appears.' },
  awe:         { pupil: 1.25, eyeScale: 1.1, gazeX: 0, gazeY: 0.45, browY: 0.45, browCurve: 1.25, mouthO: 0.45, glisten: 0.8, note: '"Tavi." The name lands.' },
  resigned:    { lidTop: 0.5, gazeX: 0.1, gazeY: -0.5, browTilt: 0.3, browY: -0.05, mouthCurve: -0.05, mouthWidth: 0.35, note: 'Overnight.' },
  smug:        { lidTop: 0.38, lidTilt: 0.1, mouthCat: 0.9, browY: 0.08, browTilt: -0.25, mouthAsym: 0.3, note: 'Knew it before you asked.' },
  panic:       { pupil: 0.55, eyeScale: 1.12, browY: 0.55, browTilt: 0.7, browPinch: 0.6, mouthO: 0.55, mouthWobble: 0.8, sweat: 1, tremble: 0.7, note: '"That time I made up half the links."' },
  squeeze:     { squint: 1, browY: 0.2, browTilt: -0.15, mouthCurve: 1.0, mouthOpen: 0.8, mouthWidth: 0.8, note: 'Belting a high note.' },
  dizzy:       { spiral: 1, browY: 0.2, browTilt: 0.4, mouthWobble: 1, mouthCurve: 0, mouthWidth: 0.6, note: 'Guitar solo vertigo.' },
  error:       { cross: 1, browOn: 0, mouthCurve: -0.2, mouthWobble: 0.6, mouthWidth: 0.5, flicker: 0.25, note: 'System fault.' },
  sleep:       { lidTop: 1, browOn: 0, mouthCurve: 0.25, mouthWidth: 0.3, bright: 0.45, lashes: 1, note: 'Night. The window is closed.' },
  primitive:   { pill: 1, browOn: 0, lashes: 0, mouthCurve: 0.6, mouthWidth: 0.55, note: 'The 2024 assistant.' },
};

export function expression(name, k = 1) {
  const full = { ...BASE, ...(EXPRESSIONS[name] || {}) };
  const out = {};
  for (const key of KEYS) out[key] = BASE[key] + (full[key] - BASE[key]) * k;
  out.tears = !!full.tears && k > 0.6;
  return out;
}

export function mix(a, b, t) {
  const out = {};
  for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  out.tears = t < 0.5 ? a.tears : b.tears;
  return out;
}

// Small eye movements: a new fixation every 1.9 s, reached with a quick eased saccade. Returns the
// gaze offset [x, y] at time t (deterministic for a given seed).
export function saccade(t, seed = 0) {
  const r = (n) => { const x = Math.sin((n + seed) * 127.1) * 43758.5453; return x - Math.floor(x); };
  const seg = Math.floor(t / 1.9), f = t / 1.9 - seg;
  const ease = f < 0.1 ? (1 - Math.cos(Math.PI * f / 0.1)) / 2 : 1;
  const gx = (r(seg * 3.1) - 0.5) * 0.22, gy = (r(seg * 7.7) - 0.5) * 0.16;
  const pgx = (r((seg - 1) * 3.1) - 0.5) * 0.22, pgy = (r((seg - 1) * 7.7) - 0.5) * 0.16;
  return [pgx + (gx - pgx) * ease, pgy + (gy - pgy) * ease];
}

// One blink, `since` seconds after it starts: 0 open, 1 fully closed.
export function blinkAmount(since) { return since >= 0 && since < 0.18 ? Math.sin(Math.PI * since / 0.18) : 0; }

// Natural idle motion layered on any state: blinks, saccades, breathing, tremble.
// opts.blinks = false leaves blinking to the caller (performances blink between sung phrases).
export function idle(state, t, seed = 0, opts = {}) {
  const s = { ...state };
  const r = (n) => { const x = Math.sin((n + seed) * 127.1) * 43758.5453; return x - Math.floor(x); };
  if (opts.blinks !== false) {
    let bt = 0, k = 0;
    while (k < 400) { const next = bt + 2.8 + r(k) * 2.6; if (t < next) break; bt = next; k++; }
    const blink = blinkAmount(t - bt);
    s.openL = state.openL * (1 - blink);
    s.openR = state.openR * (1 - blink * 0.97);
  }
  const [sx, sy] = saccade(t, seed);
  s.gazeX = state.gazeX + sx;
  s.gazeY = state.gazeY + sy;
  const tr = state.tremble;
  if (tr > 0) {
    s.gazeX += (Math.sin(t * 61.0) + Math.sin(t * 43.7)) * 0.012 * tr;
    s.gazeY += (Math.sin(t * 57.3) + Math.sin(t * 39.1)) * 0.010 * tr;
    s.browY += Math.sin(t * 23.0) * 0.012 * tr;
    s.mouthWobble = Math.max(s.mouthWobble, 0.25 * tr);
  }
  s.eyeScale = state.eyeScale * (1 + Math.sin(t * 1.7) * 0.006);
  return s;
}

const VERT = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }`;

const COMMON = `
const float VW = ${VISOR_W.toFixed(4)};
const vec2 GRID0 = vec2(${(-GRID_X).toFixed(3)}, ${(-GRID_Y).toFixed(3)});
float dot2(vec2 v){ return dot(v,v); }
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
float sdBez(vec2 pos, vec2 A, vec2 B, vec2 C){
  vec2 a = B - A, b = A - 2.0*B + C;
  if (dot(b,b) < 1e-5) return sdSeg(pos, A, C);
  vec2 c = a*2.0, d = A - pos;
  float kk = 1.0/dot(b,b), kx = kk*dot(a,b), ky = kk*(2.0*dot(a,a)+dot(d,b))/3.0, kz = kk*dot(d,a);
  float p = ky - kx*kx, p3 = p*p*p, q = kx*(2.0*kx*kx-3.0*ky)+kz, h = q*q+4.0*p3, res;
  if (h >= 0.0) { h = sqrt(h); vec2 x = (vec2(h,-h)-q)/2.0; vec2 uv = sign(x)*pow(abs(x), vec2(1.0/3.0));
    float t = clamp(uv.x+uv.y-kx, 0.0, 1.0); res = dot2(d+(c+b*t)*t); }
  else { float z = sqrt(-p); float v = acos(q/(p*z*2.0))/3.0; float m = cos(v), n = sin(v)*1.732050808;
    vec3 t = clamp(vec3(m+m,-n-m,n-m)*z-kx, 0.0, 1.0); res = min(dot2(d+(c+b*t.x)*t.x), dot2(d+(c+b*t.y)*t.y)); }
  return sqrt(res);
}
float sdRoundBox(vec2 p, vec2 b, float r){ vec2 q = abs(p)-b+r; return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r; }
// approximate signed distance to the visor outline (face units)
float visor(vec2 p){
  bool up = p.y > ${VISOR_OUTLINE.yc.toFixed(4)};
  float b = up ? ${VISOR_OUTLINE.top.toFixed(4)} : ${VISOR_OUTLINE.bot.toFixed(4)};
  float n = up ? ${VISOR_OUTLINE.nTop.toFixed(3)} : ${VISOR_OUTLINE.nBot.toFixed(3)};
  vec2 q = vec2(abs(p.x)/${VISOR_OUTLINE.a.toFixed(4)}, abs(p.y - ${VISOR_OUTLINE.yc.toFixed(4)})/b);
  float f = pow(pow(q.x, n) + pow(q.y, n), 1.0/n) - 1.0;
  return f * mix(b, ${VISOR_OUTLINE.a.toFixed(4)}, q.x*q.x/(q.x*q.x + q.y*q.y + 1e-6));
}
`;

// Pass 1: colour of each LED sub-dot.
const FRAG_CELLS = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uGrid;      // sub-dots in x, y
uniform float uSub;      // sub-dot pitch (face units)
uniform float uTime, uDetail;
uniform vec2 uOpen;
uniform vec4 uLid;       // lidTop, lidTilt, lidBot, lashes
uniform vec4 uEye;       // eyeScale, eyeTilt, pupil, highlight
uniform vec4 uWet;       // glisten, well, blush, sweat
uniform vec2 uGaze;
uniform float uConverge;
uniform vec4 uBrow;      // y, tilt, curve, on
uniform float uBrowPinch;
uniform vec4 uMouth;     // curve, width, open, wobble
uniform vec4 uMouth2;    // O, cat, asym, y
uniform vec4 uSpecial;   // squint, spiral, cross, pill
uniform vec4 uGlobal;    // bright, flicker, boot, dissolve
uniform float uFace, uOverlayAmt;
uniform vec4 uTears[6];
uniform sampler2D uOverlay;
uniform vec3 uPal[6];
uniform float uIri;
${COMMON}
#define DEEP uPal[0]
#define ORNG uPal[1]
#define GOLD uPal[2]
#define PALE uPal[3]
#define HOT  uPal[4]
#define ROSE uPal[5]
// 2027 accent: a slow cyan-violet shimmer, a nod to the original purple Tavi
vec3 iri(vec2 p){
  float h = 0.5 + 0.5*sin(uTime*1.3 + p.x*3.0 + p.y*2.0);
  return mix(vec3(0.45, 0.85, 1.0), vec3(0.75, 0.5, 1.0), h);
}

vec4 layer(vec4 base, vec3 col, float cov){ return vec4(mix(base.rgb, col, cov), max(base.a, cov)); }
float cover(float d, float aa){ return smoothstep(aa, -aa, d); }

// measured from the front reference (tools/measure_face.py)
const float RX = 0.3415, RY = 0.362;
const vec2 EYE_C = vec2(0.6397, -0.2106);

// lid lines in eye-local space (x>0 = outer corner)
// The upper lid follows the eye's own top curve, lowered as it closes, so a heavy lid stays round (never a
// flat chord across the ring) and a closed eye ends as the lower arc. Tilt drops one corner
// (negative = droopy outer corners, positive = stern).
float lidTopY(float x, float lt){
  float eTop = RY * sqrt(max(0.0, 1.0 - (x*x)/(RX*RX)));
  float lid = eTop - lt * RY * 2.05 + uLid.y * x * 0.55 * (1.0 - lt*0.6);
  return min(eTop, lid);
}
float lidBotY(float x, float lb){
  float eBot = -RY * sqrt(max(0.0, 1.0 - (x*x)/(RX*RX)));
  float raised = mix(-RY*1.04, RY*0.45, lb) - 0.42*RY*lb*((x*x)/(RX*RX));
  return max(eBot, raised);
}

vec4 eye(vec2 p, float m, float open, vec4 col, float aa){
  vec2 q = (p - vec2(EYE_C.x*m, EYE_C.y)); q.x *= m;
  float ca = cos(uEye.y), sa = sin(uEye.y);
  q = mat2(ca, -sa, sa, ca) * q;
  q /= uEye.x;
  float aaq = aa / uEye.x;
  float lt = 1.0 - (1.0 - clamp(uLid.x, 0.0, 1.0)) * clamp(open, 0.0, 1.0);
  float lb = clamp(uLid.z, 0.0, 1.0);
  vec2 g = vec2(uGaze.x*m, uGaze.y);
  float top = lidTopY(q.x, lt), bot = lidBotY(q.x, lb);
  bool inX = abs(q.x) < RX;
  // visible opening
  float dEll = (length(q/vec2(RX,RY)) - 1.0) * RX;
  float dOpen = max(dEll, max(q.y - top, bot - q.y));
  float vis = cover(dOpen, aaq) * step(0.0, top - bot + 0.002);
  // the eye is a thick glowing ring around a large dark centre (the reference design);
  // only the centre moves with gaze, so the ring thickens on the side she looks away from.
  // converge draws both centres toward the nose a little: she is looking at someone close.
  vec2 qi = q;
  float dIris = (length(qi/vec2(RX*0.95, RY*0.96)) - 1.0) * RX*0.95;
  vec2 po = g*vec2(0.115, 0.09) - vec2(0.071*uConverge, 0.0);
  float pr = 0.565 * RX * uEye.z;
  pr = min(pr, RX*0.8);
  float dPup = length((q - po)/vec2(1.0, 1.06)) - pr;
  float band = cover(dIris, aaq) * (1.0 - cover(dPup, aaq)) * vis;
  float tY = clamp(qi.y/(RY*0.96), -1.0, 1.0);
  vec3 icol = mix(ORNG, GOLD, 0.25);
  icol = mix(icol, DEEP, 0.18*smoothstep(0.2, 1.0, tY));
  icol = mix(icol, GOLD, 0.25*smoothstep(-0.1, -1.0, tY));
  float rim = smoothstep(0.55, 0.98, (qi.x*m)/(RX*0.95)) * uDetail;
  icol = mix(icol, PALE, rim*0.2);
  icol = mix(icol, iri(q), rim*0.55*uIri);
  icol *= 0.92 + 0.15*uWet.x*(0.5+0.5*sin(uTime*3.0 + q.x*20.0));
  col = layer(col, icol, band);
  // pupil interior: faint inner glow when wet
  col = layer(col, DEEP*0.35, cover(dPup, aaq)*vis*0.25*uWet.x);
  // highlights (fixed to the light: upper-left in face space)
  vec2 hl = po + vec2(-0.4*pr*m, 0.86*pr);
  float hlr = pr*0.4 + 0.012*uWet.x;
  col = layer(col, mix(PALE, HOT, 0.6), cover(length(q - hl) - hlr, aaq) * vis * uEye.w);
  vec2 hs = po + vec2(0.5*pr*m, -0.42*pr);
  col = layer(col, mix(HOT, iri(q), 0.6*uIri), cover(length(q - hs) - 0.032, aaq) * vis * uEye.w * uWet.x);
  float tw = 0.5 + 0.5*sin(uTime*5.0 + m*2.0);
  vec2 h3 = po + vec2(-0.03*m, -0.11);
  col = layer(col, HOT, cover(length(q - h3) - 0.022*tw, aaq) * vis * uWet.x);
  // welling tears: glistening pool along the lower lid
  float poolY = bot + 0.03;
  float dPool = abs(q.y - poolY) - 0.03*uWet.y;
  float poolX = smoothstep(RX, RX*0.2, abs(q.x - 0.03));
  col = layer(col, mix(PALE, HOT, 0.5+0.5*sin(uTime*7.0 + q.x*40.0)), cover(dPool, aaq) * poolX * uWet.y * step(abs(q.x), RX) * 0.9);
  // upper lash line along the top of the opening (or the closed lid)
  float yl = max(top, bot);
  float e = 0.004;
  float slope = (max(lidTopY(q.x+e, lt), lidBotY(q.x+e, lb)) - max(lidTopY(q.x-e, lt), lidBotY(q.x-e, lb))) / (2.0*e);
  // thins out toward the corners, where the lid line would otherwise run down the eye's sides
  float thk = 0.03 * (1.0 - smoothstep(0.7, 0.97, abs(q.x)/RX)) * smoothstep(0.02, 0.2, max(lt, lb));
  float dLash = abs(q.y - yl) / sqrt(1.0 + slope*slope) - thk;
  dLash = inX ? dLash : 1.0;
  vec3 lcol = mix(ORNG, GOLD, 0.35);
  col = layer(col, lcol, cover(dLash, aaq));
  // two small lashes at the outer corner (a feminine cue, off by default)
  for (int i = 0; i < 2; i++){
    float xi = RX * (i == 0 ? 0.62 : 0.86);
    float yi = max(lidTopY(xi, lt), lidBotY(xi, lb));
    vec2 a0 = vec2(xi, yi + 0.01);
    vec2 dir = normalize(vec2(i == 0 ? 0.55 : 1.1, 1.0));
    float dl = sdSeg(q, a0, a0 + dir*0.075) - 0.017;
    col = layer(col, mix(ROSE, iri(q), 0.5*uIri), cover(dl, aaq) * uLid.w * uDetail * step(lt, 0.92) * 0.9);
  }
  // lower lash line on the outer half (or the cheek line when smiling)
  float yb = bot;
  float dLow = abs(q.y - yb) - 0.012;
  float lowMask = smoothstep(-0.05, 0.12, q.x) * step(abs(q.x), RX*0.95) * step(lt, 0.9);
  col = layer(col, ROSE, cover(dLow, aaq) * lowMask * smoothstep(0.02, 0.2, lb) * uDetail);
  return col;
}

vec4 specialEyes(vec2 p, float m, vec4 col, float aa){
  vec2 q = p - vec2(EYE_C.x*m, EYE_C.y); q.x *= m;
  // squint > <
  vec2 tip = vec2(-0.14, 0.0);
  float sq = min(sdSeg(q, vec2(0.14, 0.19), tip), sdSeg(q, vec2(0.14, -0.19), tip)) - 0.05;
  col = layer(col, GOLD, cover(sq, aa) * uSpecial.x);
  // spiral
  float r = length(q), ang = atan(q.y, q.x)*m, per = 0.1;
  float sp = abs(fract((r - ang/6.2831853*per)/per + uTime*1.6) - 0.5)*per - 0.024;
  sp = max(sp, r - 0.34);
  col = layer(col, ORNG, cover(sp, aa) * uSpecial.y);
  // cross
  float cr = min(sdSeg(q, vec2(-0.18,-0.18), vec2(0.18,0.18)), sdSeg(q, vec2(-0.18,0.18), vec2(0.18,-0.18))) - 0.05;
  col = layer(col, ORNG, cover(cr, aa) * uSpecial.z);
  // pill (2024)
  float pl = sdSeg(q, vec2(0.0,-0.15*uOpen.x), vec2(0.0,0.15*uOpen.x)) - 0.13;
  col = layer(col, ORNG, cover(pl, aa) * uSpecial.w);
  return col;
}

vec4 brow(vec2 p, float m, vec4 col, float aa){
  vec2 q = p - vec2(EYE_C.x*m, EYE_C.y); q.x *= m;
  float by = RY + 0.10 + uBrow.x*0.16;
  float pin = uBrowPinch;
  vec2 inn = vec2(-0.22 + 0.06*pin, by + uBrow.y*0.10 + 0.06*pin);
  vec2 out_ = vec2(0.21, by - uBrow.y*0.08);
  vec2 ctl = vec2(-0.005 - 0.03*pin, by + uBrow.z*0.19 + 0.02*pin);
  float d = sdBez(q, inn, ctl, out_);
  float tt = clamp((q.x - inn.x)/(out_.x - inn.x), 0.0, 1.0);
  float w = (0.012 + 0.012*sin(3.14159*tt)) * mix(1.25, 1.0, uDetail);
  return layer(col, mix(GOLD, ORNG, 0.5), cover(d - w, aa) * uBrow.w);
}

vec4 mouth(vec2 p, vec4 col, float aa){
  float curve = uMouth.x, w = 0.33*uMouth.y, open = uMouth.z, wob = uMouth.w;
  vec2 q = p - vec2(0.0, -0.6147 + uMouth2.w);
  q.y += sin(q.x*30.0 + uTime*9.0)*0.02*wob;
  float asym = uMouth2.z;
  vec2 A = vec2(-w, 0.07*curve - 0.05*asym), C = vec2(w, 0.07*curve + 0.05*asym);
  vec2 B = vec2(0.0001, -0.2*curve);
  float line = sdBez(q, A, B, C) - 0.042;
  float oAmt = smoothstep(0.2, 0.45, uMouth2.x), catAmt = smoothstep(0.2, 0.45, uMouth2.y);
  float lineCov = cover(line, aa) * (1.0 - smoothstep(0.05, 0.25, open)) * (1.0 - oAmt) * (1.0 - catAmt);
  col = layer(col, mix(ORNG, GOLD, 0.45), lineCov);
  // open D mouth with teeth line and tongue
  float h = open*0.26;
  vec2 qm = q - vec2(0.0, 0.02);
  float rx = max(w*0.8, 0.06), ry = max(h, 0.001);
  float ell = (length(vec2(qm.x/rx, qm.y/ry)) - 1.0)*min(rx, ry);
  float topLine = qm.y - 0.02*curve*(1.0 - qm.x*qm.x/(rx*rx)) - 0.015;
  // a happy open mouth is a D (flat top, round bottom); a sad one sings through a flat-bottomed arch
  float sad = smoothstep(-0.05, -0.35, curve);
  float dD = max(ell, mix(topLine, -qm.y - 0.015, sad));
  float openCov = cover(dD, aa) * smoothstep(0.04, 0.2, open) * (1.0 - oAmt) * (1.0 - catAmt);
  col = layer(col, DEEP*0.55, openCov);
  float tongue = max(dD, (qm.y + ry*0.45) - 0.0);
  col = layer(col, ROSE*0.85, cover(tongue, aa) * openCov * uDetail);
  float edge = abs(dD) - 0.022;
  col = layer(col, GOLD, cover(edge, aa) * smoothstep(0.04, 0.2, open) * (1.0 - oAmt) * (1.0 - catAmt));
  float teeth = max(abs(topLine) - 0.02, ell);
  col = layer(col, PALE, cover(teeth, aa) * smoothstep(0.1, 0.3, open) * uDetail * 0.9 * (1.0 - sad) * (1.0 - oAmt) * (1.0 - catAmt));
  // O mouth
  // the O mouth (surprise, awe) sings by growing taller instead of switching to the open D
  float o = abs(length(q/(vec2(0.10, 0.12)*vec2(1.0 + 0.25*open, 1.0 + 0.7*open))) - 1.0)*0.1 - 0.022;
  col = layer(col, GOLD, cover(o, aa) * oAmt);
  // cat mouth :3
  float c1 = sdBez(q, vec2(-0.16, 0.03), vec2(-0.08, -0.12), vec2(0.0, 0.02));
  float c2 = sdBez(q, vec2(0.0, 0.02), vec2(0.08, -0.12), vec2(0.16, 0.03));
  col = layer(col, GOLD, cover(min(c1, c2) - 0.024, aa) * catAmt);
  return col;
}

vec4 extras(vec2 p, vec4 col, float aa){
  // blush: three short strokes under each eye
  for (int s = 0; s < 2; s++){
    float m = s == 0 ? -1.0 : 1.0;
    vec2 q = p - vec2(EYE_C.x*m, EYE_C.y - 0.45); q.x *= m;
    float d = 1.0;
    for (int i = 0; i < 3; i++){
      vec2 c = vec2(-0.08 + 0.08*float(i), 0.0);
      d = min(d, sdSeg(q, c + vec2(-0.025, -0.03), c + vec2(0.025, 0.03)) - 0.012);
    }
    col = layer(col, ROSE, cover(d, aa) * uWet.z * 0.85);
  }
  // tears
  for (int i = 0; i < 6; i++){
    vec4 t = uTears[i];
    if (t.w <= 0.0) continue;
    vec2 q = p - t.xy; q.y *= 0.8;
    col = layer(col, PALE, cover(length(q) - t.z, aa) * t.w);
  }
  // sweat drop
  vec2 q = p - vec2(1.07, 0.40);
  float drop = length(vec2(q.x, max(q.y,0.0)*0.55 + min(q.y,0.0))) - 0.09;
  float ring = max(abs(drop)-0.02, -q.y-0.12);
  col = layer(col, PALE, cover(ring, aa) * uWet.w);
  return col;
}

void main(){
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 p = GRID0 + (cell + 0.5) * uSub;
  float aa = uSub * 0.55;
  vec4 col = vec4(0.0);
  float normalEyes = 1.0 - clamp(uSpecial.x + uSpecial.y + uSpecial.z + uSpecial.w, 0.0, 1.0);
  if (normalEyes > 0.001){
    vec4 e = eye(p, -1.0, uOpen.x, vec4(0.0), aa);
    e = eye(p, 1.0, uOpen.y, e, aa);
    col = vec4(e.rgb, e.a * normalEyes);
  }
  col = specialEyes(p, -1.0, col, aa);
  col = specialEyes(p, 1.0, col, aa);
  col = brow(p, -1.0, col, aa);
  col = brow(p, 1.0, col, aa);
  col = mouth(p, col, aa);
  col = extras(p, col, aa);
  col *= uFace;
  vec2 ouv = vec2(p.x/(VW*2.0)+0.5, 0.5 - p.y*0.5);
  float ov = texture(uOverlay, ouv).r * uOverlayAmt;
  col = layer(col, GOLD, ov);
  // global: boot sweep, dissolve, flicker
  float rnd = hash(cell);
  float sweep = 1.0 - (p.y*0.5+0.5);
  float bootMask = step(rnd*0.35 + sweep*0.65, uGlobal.z*1.0001);
  float keep = step(uGlobal.w, rnd*0.999);
  float flick = 1.0 - uGlobal.y*step(0.55, hash(cell + floor(uTime*18.0)));
  float inside = step(visor(p), -uSub*0.6);
  float k = bootMask*keep*flick*inside*uGlobal.x;
  outColor = vec4(col.rgb * col.a * k, inside);
}`;

// LED rendering shared by the 2D screen pass and the 3D panel (tavi3d.js), in linear light.
// Each LED is a white-hot centre inside a body of its own colour; a diffuser spreads the light into a
// glow that fills the gaps (the caller adds it from the blurred LED field). local = position inside
// the LED's cell (-0.5..0.5); aa = LED pitches per screen pixel. Dots smaller than a couple of pixels
// fade to their average so the grid never shimmers.
export const LED_GLSL = `
vec3 ledEmission(vec3 c, vec2 local, float dotSize, float aa){
  // levels solved backwards through filmTone from the reference render's measured colours:
  // gaps (glow) develop to orange (246,122,3), dot bodies to gold (250,199,91), centres to white
  float r = length(local), R = dotSize*0.5;
  float a = max(aa, 0.07);
  float dm = smoothstep(R + a, R - a, r);
  float lum = max(c.r, max(c.g, c.b));
  vec3 warm = vec3(1.0, 0.8, 0.25) * lum, white = vec3(1.0, 0.95, 0.85) * lum;
  vec3 e = (c*1.3 + warm*0.45 + white*1.4*exp(-r*r / (2.0*0.1*0.1))) * dm;
  vec3 avg = c*0.62 + warm*0.22 + white*0.09;
  return mix(e, avg, smoothstep(0.35, 0.75, aa));
}`;

// The camera: a per-channel soft shoulder. Diffuse colours stay exact; overexposed light burns
// orange -> yellow -> white the way film and the reference render do (Neutral tone mapping would
// turn bright orange salmon). Used by the 2D screen pass and the 3D output pass (looks.js).
export const FILM_GLSL = `
vec3 filmTone(vec3 x){
  vec3 k = vec3(0.68);
  return mix(x, k + (1.0 - k)*(1.0 - exp(-(x - k)/(1.0 - k))), step(k, x));
}`;

// Pass 2: draw the dots and the glow.
const FRAG_SCREEN = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform vec2 uRes, uGrid;
uniform float uSub, uDot, uGlow, uUnlit, uShowGlass;
uniform sampler2D uCells;
${COMMON}
${LED_GLSL}
${FILM_GLSL}
void main(){
  float aspect = uRes.x/uRes.y;
  vec2 p = (vUv - 0.5)*2.0*vec2(aspect, 1.0)*1.08;
  float pxUnit = (2.0*1.08)/uRes.y;
  float vd = visor(p);
  if (vd > pxUnit*1.5) { outColor = vec4(0.0); return; }
  vec2 gp = (p - GRID0) / uSub;
  vec2 cell = floor(gp);
  vec3 c = texelFetch(uCells, ivec2(clamp(cell, vec2(0.0), uGrid - 1.0)), 0).rgb;
  vec2 local = fract(gp) - 0.5;
  // the cell colours are display values: light the LEDs in linear, then develop with filmTone()
  float aa = pxUnit/uSub;
  vec3 led = ledEmission(pow(c, vec3(2.2)), local, uDot, aa);
  float inside = smoothstep(0.0, -uSub, vd);
  // unlit LEDs, faintly visible in the early eras
  float lum = max(c.r, max(c.g, c.b));
  float dm = smoothstep(uDot*0.5 + 0.04, uDot*0.5 - 0.04, length(local));
  led += vec3(0.30, 0.07, 0.02) * uUnlit * dm * inside * (1.0 - clamp(lum*3.0, 0.0, 1.0));
  // the diffuser glow: the LEDs' light averaged over about two pitches, plus a faint wider halo
  vec2 uv = gp / uGrid;
  vec2 px = 0.6 / uGrid;
  vec3 near = (pow(textureLod(uCells, uv + px, 0.0).rgb, vec3(2.2)) + pow(textureLod(uCells, uv - px, 0.0).rgb, vec3(2.2))
             + pow(textureLod(uCells, uv + vec2(px.x, -px.y), 0.0).rgb, vec3(2.2)) + pow(textureLod(uCells, uv + vec2(-px.x, px.y), 0.0).rgb, vec3(2.2))) * 0.25;
  vec3 glow = near*0.75 + pow(textureLod(uCells, uv, 1.0).rgb, vec3(2.2))*0.3;
  glow = mix(glow, vec3(1.0, 0.17, 0.004) * max(glow.r, max(glow.g, glow.b)), 0.5);   // the diffuser glows orange
  glow *= 1.55 * uGlow * inside;
  vec3 lit = pow(filmTone(led + glow), vec3(1.0/2.2));
  // glass
  vec3 glass = vec3(0.016, 0.013, 0.016) + vec3(0.02,0.018,0.02)*(1.0 - length(p/vec2(VW,1.0))*0.6);
  float refl = smoothstep(0.24, 0.0, abs(p.y - 0.80 + p.x*p.x*0.10))*smoothstep(0.9, -0.6, p.x)*0.075;
  float rim = smoothstep(0.07, 0.0, abs(vd + 0.035))*0.16;
  float twoD = uShowGlass > 0.5 && uShowGlass < 1.5 ? 1.0 : 0.0;
  vec3 base = (glass + vec3(refl + rim))*twoD;
  float a = smoothstep(pxUnit*1.5, -pxUnit*1.5, vd);
  vec3 col = base + lit;
  // 0 = LEDs only, 1 = 2D glass, 2 = mask (black glass, alpha = visor outline) for 3D
  float alpha = uShowGlass > 1.5 ? a : max(a*twoD, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0)*a);
  outColor = vec4(col*a, alpha);
}`;

export class TaviFace {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: !!opts.preserve });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;
    this.showGlass = opts.glass === false ? 0 : opts.glass === 'mask' ? 2 : 1;
    this.progCells = this._program(VERT, FRAG_CELLS);
    this.progScreen = this._program(VERT, FRAG_SCREEN);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    for (const p of [this.progCells, this.progScreen]) {
      const loc = gl.getAttribLocation(p, 'aPos');
      if (loc >= 0) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); }
    }
    this.uC = this._uniforms(this.progCells);
    this.uS = this._uniforms(this.progScreen);
    this.cellTex = gl.createTexture();
    this.fbo = gl.createFramebuffer();
    this.grid = [0, 0];
    this.ovCanvas = document.createElement('canvas');
    this.ovCanvas.width = 512; this.ovCanvas.height = Math.round(512 / VISOR_W);
    this.ovCtx = this.ovCanvas.getContext('2d');
    this.ovTex = gl.createTexture();
    this.setOverlayText('');
    this.setEra(opts.era || 2026);
  }

  _program(vs, fs) {
    const gl = this.gl;
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  _uniforms(prog) {
    const gl = this.gl, u = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i);
      u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(prog, info.name);
    }
    return u;
  }

  setEra(year) {
    const e = ERAS[year] || ERAS[2026];
    if (this.era !== e) this._applyEra(e);
  }

  // Part way from era a to era b (w = 0..1): palette and LED settings blend; the dot grid itself switches
  // halfway, so blend only between eras with the same pitch.
  blendEra(a, b, w) {
    const A = ERAS[a] || ERAS[2026], B = ERAS[b] || ERAS[2026];
    if (w >= 1 || A === B) return this.setEra(b);
    if (w <= 0) return this.setEra(a);
    const grid = w < 0.5 ? A : B;
    const e = { ...B, pitch: grid.pitch, split: grid.split };
    for (const k of ['dot', 'glow', 'unlit', 'detail', 'iri']) e[k] = A[k] + (B[k] - A[k]) * w;
    e.palette = A.palette.map((c, i) => c.map((v, j) => v + (B.palette[i][j] - v) * w));
    this._applyEra(e);
  }

  _applyEra(e) {
    this.era = e;
    const sub = e.pitch / e.split;
    if (sub === this.sub) return;
    const nx = Math.ceil((2 * GRID_X) / sub) + 1, ny = Math.ceil((2 * GRID_Y) / sub) + 1;
    this.sub = sub;
    this.grid = [nx, ny];
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.cellTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, nx, ny, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.cellTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // Draw text or a glyph onto the visor; sampled per sub-dot so it always reads as LED type.
  setOverlayText(text, opts = {}) {
    const c = this.ovCtx, W = this.ovCanvas.width, H = this.ovCanvas.height;
    c.clearRect(0, 0, W, H);
    if (text) {
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const size = opts.size || H * 0.42;
      c.font = `${opts.weight || 800} ${size}px ${opts.font || 'ui-monospace, Menlo, Consolas, monospace'}`;
      c.fillText(text, W / 2 + (opts.dx || 0), H / 2 + (opts.dy || 0));
    }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.ovTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.ovCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  tearsAt(t, on) {
    const out = [];
    if (!on) return out;
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const period = 2.6 + (i % 3) * 0.41;
      const ph = ((t + i * 0.83) % period) / period;
      const y = -0.54 - ph * ph * 0.45;
      const x = side * (0.64 + 0.17 + Math.sin(i * 1.7) * 0.02);
      const alpha = ph < 0.08 ? ph / 0.08 : 1 - Math.max(0, (ph - 0.8) / 0.2);
      out.push([x, y, 0.038 + 0.01 * (i % 2), alpha]);
    }
    return out;
  }

  // Pass 1 only, read back: the colour of every LED, for the 3D panel (which draws its own dots).
  // Returns RGBA bytes, row 0 at the bottom (face y = -GRID_Y), plus the grid and dot settings.
  renderCells(s, t = 0) {
    this._cells(s, t);
    const gl = this.gl, [nx, ny] = this.grid;
    if (!this.cellBytes || this.cellBytes.length !== nx * ny * 4) this.cellBytes = new Uint8Array(nx * ny * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.readPixels(0, 0, nx, ny, gl.RGBA, gl.UNSIGNED_BYTE, this.cellBytes);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const e = this.era;
    return { data: this.cellBytes, nx, ny, sub: this.sub, dot: e.dot, glow: e.glow * s.bright, unlit: e.unlit };
  }

  render(s, t = 0) {
    this._cells(s, t);
    this._screen(s);
  }

  _cells(s, t) {
    const gl = this.gl, e = this.era, u = this.uC;
    const [nx, ny] = this.grid;
    gl.bindVertexArray(this.vao);
    // pass 1: LED colours
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, nx, ny);
    gl.disable(gl.BLEND);
    gl.useProgram(this.progCells);
    gl.uniform2f(u.uGrid, nx, ny);
    gl.uniform1f(u.uSub, this.sub);
    gl.uniform1f(u.uTime, t);
    gl.uniform1f(u.uDetail, e.detail);
    gl.uniform2f(u.uOpen, s.openL, s.openR);
    gl.uniform4f(u.uLid, s.lidTop, s.lidTilt, s.lidBot, s.lashes);
    gl.uniform4f(u.uEye, s.eyeScale, s.eyeTilt, s.pupil, s.highlight);
    gl.uniform4f(u.uWet, s.glisten, s.well, s.blush, s.sweat);
    gl.uniform2f(u.uGaze, s.gazeX, s.gazeY);
    gl.uniform1f(u.uConverge, s.converge);
    gl.uniform4f(u.uBrow, s.browY, s.browTilt, s.browCurve, s.browOn);
    gl.uniform1f(u.uBrowPinch, s.browPinch);
    gl.uniform4f(u.uMouth, s.mouthCurve, s.mouthWidth, s.mouthOpen, s.mouthWobble);
    gl.uniform4f(u.uMouth2, s.mouthO, s.mouthCat, s.mouthAsym, s.mouthY);
    gl.uniform4f(u.uSpecial, s.squint, s.spiral, s.cross, s.pill);
    gl.uniform4f(u.uGlobal, s.bright, s.flicker, s.boot, s.dissolve);
    gl.uniform1f(u.uFace, s.face);
    gl.uniform1f(u.uOverlayAmt, s.overlay);
    gl.uniform3fv(u.uPal, new Float32Array(e.palette.flat()));
    gl.uniform1f(u.uIri, e.iri);
    const tears = this.tearsAt(t, s.tears);
    const arr = new Float32Array(24);
    tears.forEach((tr, i) => arr.set(tr, i * 4));
    gl.uniform4fv(u.uTears, arr);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.ovTex);
    gl.uniform1i(u.uOverlay, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindTexture(gl.TEXTURE_2D, this.cellTex);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  _screen(s) {
    const gl = this.gl, e = this.era;
    const [nx, ny] = this.grid;
    // pass 2: dots on glass
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const w = this.canvas.width, h = this.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.progScreen);
    const v = this.uS;
    gl.uniform2f(v.uRes, w, h);
    gl.uniform2f(v.uGrid, nx, ny);
    gl.uniform1f(v.uSub, this.sub);
    gl.uniform1f(v.uDot, e.dot);
    gl.uniform1f(v.uGlow, e.glow * s.bright);
    gl.uniform1f(v.uUnlit, e.unlit);
    gl.uniform1f(v.uShowGlass, this.showGlass);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.cellTex);
    gl.uniform1i(v.uCells, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
