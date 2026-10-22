// Tavi in 3D, built from primitives measured off the reference renders.
// Units: the widest part of the body is 1.0 across. The body's bottom sits at y = 0.
// The rig exposes body language (squash, bend, tilt, sink, tremble), paw gestures,
// a spring-driven antenna and an LED face texture that comes from TaviFace.
import * as THREE from 'three';
import { TaviFace, VISOR_OUTLINE, LED_GLSL, GRID_X, GRID_Y } from './tavi-face.js';
import { BODY_PROFILE, CAP } from './tavi-profile.js';
import { makeShell, makeOrange, makePad } from './tavi-materials.js';
import { buildPaw, PAW_REST } from './tavi-paws.js';

// Half-width of the body at each height, measured row by row from the front and back reference
// silhouettes (tools/extract_profile.py). The shell starts just above the base collar and closes
// under the cap band.
const PROFILE = [
  [0.0, 0.0], [0.0, 0.1], [0.012, 0.118],   // the shell's underside stays tucked inside the base collar
  ...BODY_PROFILE,
  [CAP.band_bottom + 0.008, CAP.band_r * 0.72], [CAP.band_bottom + 0.012, 0.0],
];
const DEPTH = 0.94;           // front-to-back radius relative to side-to-side
const HEIGHT = 1.29;
// Where the face's units sit on the body: face y = 0 at FACE.y, one face unit = FACE.s model units.
const FACE = { y: 0.8916, s: 0.2772 };

// The profile densified with Catmull-Rom. Every part that sits on the shell (body mesh, visor rim,
// bands, decals) reads this one smooth surface, so nothing pokes through anything else.
const RINGS = new THREE.SplineCurve(PROFILE.map(([y, r]) => new THREE.Vector2(r, y))).getPoints(720);
const RAD = [];
for (const p of RINGS) if (p.y > 0.02 && (!RAD.length || p.y > RAD[RAD.length - 1].y)) RAD.push(p);
function radiusAt(y) {
  if (y <= RAD[0].y) return RAD[0].x;
  let lo = 0, hi = RAD.length - 1;
  if (y >= RAD[hi].y) return RAD[hi].x;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (RAD[mid].y <= y) lo = mid; else hi = mid; }
  const a = RAD[lo], b = RAD[hi];
  return a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y);
}
// The front of the head is a flatter faceplate (a superellipse cross-section) so the visor reads as a
// broad screen like the reference; the back stays a round egg. FRONT_N = 2 would be fully round.
const FRONT_N = 2.75;
const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function frontN(y) { return 2 + (FRONT_N - 2) * smooth01(0.3, 0.68, y) * (1 - smooth01(1.08, 1.26, y)); }
// Point on the shell: angle th from the front (+z) toward +x, height y.
function surface(th, y, out = new THREE.Vector3()) {
  const r = radiusAt(y);
  const s = Math.sin(th), c = Math.cos(th);
  const e = 2 / (c > 0 ? frontN(y) : 2);
  return out.set(Math.sign(s) * Math.pow(Math.abs(s), e) * r, y, Math.sign(c) * Math.pow(Math.abs(c), e) * r * DEPTH);
}
function surfaceNormal(th, y) {
  const e = 0.002;
  const du = surface(th + e, y).sub(surface(th - e, y)), dv = surface(th, y + e).sub(surface(th, y - e));
  return new THREE.Vector3().crossVectors(du, dv).normalize();
}
// Front surface depth for a given x (side-to-side) and y.
function frontZ(x, y) { return surface(thetaFor(x, y), y).z; }

function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// ---- body deformation shared by every body material (squash, bend) ----
export const bodyUniforms = {
  uSquash: { value: 1 },
  uBend: { value: new THREE.Vector2(0, 0) },
  uHeight: { value: HEIGHT },
};
function deformShader(shader) {
    Object.assign(shader.uniforms, bodyUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uSquash; uniform vec2 uBend; uniform float uHeight;
        vec3 tvDeform(vec3 p){
          float h = clamp(p.y / uHeight, 0.0, 1.4);
          p.y *= uSquash; p.xz *= inversesqrt(uSquash);
          p.x += uBend.x * h * h * uHeight; p.z += uBend.y * h * h * uHeight;
          return p;
        }
        vec3 tvDeformN(vec3 n, vec3 p){
          float h = clamp(p.y / uHeight, 0.0, 1.4);
          n.y /= uSquash; n.xz *= sqrt(uSquash);
          n.x -= n.y * 2.0 * uBend.x * h; n.z -= n.y * 2.0 * uBend.y * h;
          return normalize(n);
        }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        objectNormal = tvDeformN(objectNormal, position);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed = tvDeform(transformed);`);
}
// Body materials bend and squash with the rig; `extra` adds a material's own shader edits.
function deformable(mat, key = 'tvDeform', extra = null) {
  mat.onBeforeCompile = (shader) => { deformShader(shader); if (extra) extra(shader); };
  mat.customProgramCacheKey = () => key;
  return mat;
}

// The LED panel draws every dot itself, per screen pixel, from the face's per-LED colours (uCells),
// so the dots stay round and crisp from a wide shot to an extreme close-up. Output is HDR light;
// the film output pass (looks.js) develops it, so centres burn white and rims stay orange.
function ledPanelMaterial(uniforms) {
  return deformable(new THREE.MeshBasicMaterial({ color: 0x000000 }), 'tvDeformLED', (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 faceUv;\nvarying vec2 vFace;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFace = faceUv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vFace;
        uniform sampler2D uCells;
        uniform vec2 uGrid, uGrid0;
        uniform float uSub, uDot, uGlow, uUnlit, uLedGain;
        ${LED_GLSL}
        // smooth (B-spline) sampling of a mip level, so the glow has no blocky texel steps
        vec4 tvCubic(float v){ vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v; vec4 s = n*n*n;
          float x = s.x, y = s.y - 4.0*s.x, z = s.z - 4.0*s.y + 6.0*s.x; return vec4(x, y, z, 6.0 - x - y - z) / 6.0; }
        vec3 tvBicubic(sampler2D t, vec2 uv, float lod){
          vec2 size = vec2(textureSize(t, int(lod)));
          vec2 st = uv*size - 0.5, f = fract(st);
          st -= f;
          vec4 xc = tvCubic(f.x), yc = tvCubic(f.y);
          vec4 c = st.xxyy + vec2(-0.5, 1.5).xyxy;
          vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
          vec4 o = (c + vec4(xc.yw, yc.yw) / s) / size.xxyy;
          vec3 s0 = textureLod(t, o.xz, lod).rgb, s1 = textureLod(t, o.yz, lod).rgb;
          vec3 s2 = textureLod(t, o.xw, lod).rgb, s3 = textureLod(t, o.yw, lod).rgb;
          float sx = s.x / (s.x + s.y), sy = s.z / (s.z + s.w);
          return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
        }
        vec3 ledPanel(vec2 p){
          vec2 gp = (p - uGrid0) / uSub;
          vec2 cell = floor(gp);
          vec3 c = texelFetch(uCells, ivec2(clamp(cell, vec2(0.0), uGrid - 1.0)), 0).rgb;   // linear
          float aa = max(fwidth(gp.x), fwidth(gp.y));
          vec3 led = ledEmission(c, fract(gp) - 0.5, uDot, aa);
          float lum = max(c.r, max(c.g, c.b));
          float dm = smoothstep(uDot*0.5 + 0.04, uDot*0.5 - 0.04, length(fract(gp) - 0.5));
          led += vec3(0.30, 0.07, 0.02) * uUnlit * dm * (1.0 - clamp(pow(lum, 0.45)*3.0, 0.0, 1.0));
          // the diffuser glow that fills the gaps and spills a pitch or two past every lit shape
          vec2 uv = gp / uGrid;
          vec2 px = 0.6 / uGrid;
          vec3 near = (textureLod(uCells, uv + px, 0.0).rgb + textureLod(uCells, uv - px, 0.0).rgb
                     + textureLod(uCells, uv + vec2(px.x, -px.y), 0.0).rgb + textureLod(uCells, uv + vec2(-px.x, px.y), 0.0).rgb) * 0.25;
          vec3 glow = near*0.75 + tvBicubic(uCells, uv, 1.0)*0.3;
          glow = mix(glow, vec3(1.0, 0.17, 0.004) * max(glow.r, max(glow.g, glow.b)), 0.5);   // the diffuser glows orange
          // a faint wide spill inside the panel (about five LEDs), so dark pupils stay warm in close-ups
          vec3 wide = tvBicubic(uCells, uv, 3.0);
          glow += vec3(1.0, 0.17, 0.004) * max(wide.r, max(wide.g, wide.b)) * 0.15;
          return (led + glow * 1.55 * uGlow) * uLedGain;
        }`)
      .replace('#include <opaque_fragment>', 'outgoingLight = ledPanel(vFace);\n#include <opaque_fragment>');
  });
}

// Glass reflects the environment only: no glints from the direct lights.
function glassMaterial() {
  return deformable(new THREE.MeshPhysicalMaterial({
    color: '#000000', roughness: 0.035, metalness: 0.0, ior: 1.5, specularIntensity: 1.0,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }), 'tvDeformGlass', (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>',
      '#include <lights_fragment_end>\nreflectedLight.directSpecular = vec3(0.0);\nreflectedLight.directDiffuse = vec3(0.0);');
  });
}
export function deformPoint(p) {
  const s = bodyUniforms.uSquash.value, b = bodyUniforms.uBend.value;
  const h = Math.min(1.4, Math.max(0, p.y / HEIGHT));
  const q = p.clone();
  q.y *= s; q.x /= Math.sqrt(s); q.z /= Math.sqrt(s);
  q.x += b.x * h * h * HEIGHT; q.z += b.y * h * h * HEIGHT;
  return q;
}

// ---- geometry builders ----
// Even-odd test of a point against a closed polygon of Vector2s.
function insidePolygon(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// The shell: rings up the smoothed profile, each traced through surface() so the faceplate flattening
// applies. Normals come from the surface itself rather than the triangles, so parts laid on the shell
// shade exactly like it. Quads touching `cut` (an xy polygon on the front) are left out: the opening for
// the visor, whose jagged edge the rim's skirt covers.
function bodyGeometry(segT = 220, cut = null) {
  const rows = RINGS.filter((p, i) => i % 3 === 0 || i === RINGS.length - 1);
  const segY = rows.length - 1, row = segT + 1;
  const verts = [], norms = [], hole = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  if (cut) for (const p of cut) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const yMin = RAD[0].y + 0.003, yMax = RAD[RAD.length - 1].y - 0.003;
  for (let i = 0; i <= segY; i++) {
    const { x: r, y } = rows[i];
    for (let j = 0; j <= segT; j++) {
      const th = (j / segT) * Math.PI * 2 - Math.PI;
      const sn = Math.sin(th), c = Math.cos(th), e = 2 / (c > 0 ? frontN(y) : 2);
      const px = Math.sign(sn) * Math.pow(Math.abs(sn), e) * r, pz = Math.sign(c) * Math.pow(Math.abs(c), e) * r * DEPTH;
      verts.push(px, y, pz);
      hole.push(!!cut && pz > 0 && px > minX && px < maxX && y > minY && y < maxY && insidePolygon(cut, px, y));
      if (y > yMin && y < yMax) {
        const n = surfaceNormal(th, y);
        norms.push(n.x, n.y, n.z);
      } else {
        // base disc and cap pole: normal from the neighbouring rings
        const a = rows[Math.max(0, i - 1)], b = rows[Math.min(segY, i + 1)];
        const n = new THREE.Vector3(Math.sin(th) * (b.y - a.y), -(b.x - a.x), Math.cos(th) * (b.y - a.y)).normalize();
        norms.push(n.x, n.y, n.z);
      }
    }
  }
  const idx = [];
  for (let i = 0; i < segY; i++) for (let j = 0; j < segT; j++) {
    const a = i * row + j, b = a + 1, c2 = a + row, d = c2 + 1;
    if (hole[a] || hole[b] || hole[c2] || hole[d]) continue;
    idx.push(a, b, c2, b, d, c2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  g.setIndex(idx);
  return g;
}

// Angle on the shell that sits in front of side-to-side position x at height y.
// Continues smoothly around the silhouette so no triangle gets stretched.
function thetaFor(x, y) {
  const r = Math.max(radiusAt(y), 1e-3), ax = Math.abs(x);
  const th = ax < r ? Math.asin(Math.min(1, Math.pow(ax / r, frontN(y) / 2))) : Math.PI / 2 + (ax - r) / r;
  return th * Math.sign(x);
}

// ---- the visor ----
// An opening in the shell. The shell rolls inward over a rounded rim to a thin dark gasket; inside sits
// the LED panel under a glass dome that rises a little proud of the shell (reference side view).
// The outline is the glass edge, measured from the front reference (VISOR_OUTLINE, in face units).
const RIM = { w: 0.034, depth: 0.022, gasket: 0.0065, skirt: 0.028 };
const GLASS = { rise: 0.012, falloff: 0.045, panelGap: 0.007 };   // a low dome: no goggle bulge in profile

// The outline in model xy, sampled evenly along its length (counterclockwise seen from the front),
// with the outward normal at each sample.
function visorOutline(n = 480) {
  const o = VISOR_OUTLINE, dense = [];
  for (let i = 0; i < 4096; i++) {
    const t = (i / 4096) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
    const up = sn >= 0, e = 2 / (up ? o.nTop : o.nBot), b = up ? o.top : o.bot;
    dense.push(new THREE.Vector2(FACE.s * o.a * Math.sign(c) * Math.abs(c) ** e,
      FACE.y + FACE.s * (o.yc + b * Math.sign(sn) * Math.abs(sn) ** e)));
  }
  const len = [0];
  for (let i = 1; i <= dense.length; i++) len.push(len[i - 1] + dense[i % dense.length].distanceTo(dense[i - 1]));
  const total = len[len.length - 1], pts = [];
  for (let k = 0, j = 0; k < n; k++) {
    const L = (k / n) * total;
    while (len[j + 1] < L) j++;
    pts.push(dense[j].clone().lerp(dense[(j + 1) % dense.length], (L - len[j]) / (len[j + 1] - len[j])));
  }
  const nrm = pts.map((p, k) => {
    const a = pts[(k + n - 1) % n], b = pts[(k + 1) % n];
    return new THREE.Vector2(b.y - a.y, -(b.x - a.x)).normalize();
  });
  return { pts, nrm };
}
const offsetLoop = ({ pts, nrm }, d) => pts.map((p, k) => p.clone().addScaledVector(nrm[k], d));

// Shell point and normal in front of model xy.
function onShell(x, y) {
  const th = thetaFor(x, y);
  return { p: surface(th, y), n: surfaceNormal(th, y) };
}

// Index a strip of rings: `m` vertices across, `n` around a closed loop, front-facing.
function loopStrip(n, m) {
  const idx = [];
  for (let k = 0; k < n; k++) for (let i = 0; i < m - 1; i++) {
    const a = k * m + i, b = a + 1, c = ((k + 1) % n) * m + i, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  return idx;
}

// The rolled rim: a skirt lying on the shell (it hides the opening's jagged edge), then a quarter-round
// that turns down into the opening and ends vertical at the gasket.
function visorRimGeometry(outline) {
  const { pts, nrm } = outline, n = pts.length;
  // [offset outward from the outline (xy), angle around the quarter-round]
  const prof = [];
  for (let i = 0; i < 4; i++) prof.push([RIM.w + RIM.skirt * (1 - i / 4), 0]);
  for (let i = 0; i <= 16; i++) { const ph = (i / 16) * Math.PI / 2; prof.push([RIM.w * (1 - Math.sin(ph)), ph]); }
  const verts = [], norms = [], cols = [];
  for (let k = 0; k < n; k++) {
    for (const [o, ph] of prof) {
      const d = RIM.depth * (1 - Math.cos(ph));
      const x = pts[k].x + nrm[k].x * o, y = pts[k].y + nrm[k].y * o;
      const { p, n: N } = onShell(x, y);
      p.addScaledVector(N, -d);
      // outward direction along the shell, across the outline
      const e = 0.002;
      const nu = onShell(x + nrm[k].x * e, y + nrm[k].y * e).p.sub(onShell(x - nrm[k].x * e, y - nrm[k].y * e).p);
      nu.addScaledVector(N, -nu.dot(N)).normalize();
      const w3 = RIM.w * Math.hypot(1, nu.z / Math.max(1e-3, Math.hypot(nu.x, nu.y)));
      const nn = N.clone().multiplyScalar(w3 * Math.cos(ph)).addScaledVector(nu, -RIM.depth * Math.sin(ph)).normalize();
      verts.push(p.x, p.y, p.z);
      norms.push(nn.x, nn.y, nn.z);
      // the recess is shadowed: the rim darkens as it turns down toward the gasket (screen-space AO is too
      // coarse for a 3 cm recess)
      const shade = 1 - 0.72 * smoothstep(0.0, 0.9, ph / (Math.PI / 2));
      cols.push(shade, shade * 0.97, shade * 0.94);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(loopStrip(n, prof.length));
  return g;
}

// The gasket: a thin dark band at the bottom of the rim, where the glass sits.
function gasketGeometry(outline) {
  const { pts, nrm } = outline, n = pts.length, verts = [], norms = [];
  for (let k = 0; k < n; k++) for (let i = 0; i <= 2; i++) {
    const o = -RIM.gasket * (i / 2);
    const { p, n: N } = onShell(pts[k].x + nrm[k].x * o, pts[k].y + nrm[k].y * o);
    p.addScaledVector(N, -RIM.depth);
    verts.push(p.x, p.y, p.z); norms.push(N.x, N.y, N.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  g.setIndex(loopStrip(n, 3));
  return g;
}

function distToLoop(q, loop) {
  let best = Infinity;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[j], b = loop[i];
    const abx = b.x - a.x, aby = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((q.x - a.x) * abx + (q.y - a.y) * aby) / (abx * abx + aby * aby)));
    best = Math.min(best, Math.hypot(q.x - a.x - abx * t, q.y - a.y - aby * t));
  }
  return best;
}

// Glass dome (and the LED panel just under it) over the gasket's inner edge: rings from the centre
// out to the edge, raised along the shell normal by a profile that climbs steeply from the gasket and
// levels off GLASS.rise above the shell. `below` lowers the whole surface (the panel); `faceUv` adds
// each vertex's position in face units for the LED shader.
function domeGeometry(outline, below = 0, faceUv = false) {
  const edge = offsetLoop(outline, -RIM.gasket), n = edge.length, J = 48;
  const C = new THREE.Vector2(0, FACE.y + VISOR_OUTLINE.yc * FACE.s);
  const verts = [], uvs = [];
  const lift = (dE) => -RIM.depth + (GLASS.rise + RIM.depth) * (1 - Math.exp(-dE / GLASS.falloff)) - below;
  const put = (xy, dE) => {
    const { p, n: N } = onShell(xy.x, xy.y);
    p.addScaledVector(N, lift(dE));
    verts.push(p.x, p.y, p.z);
    if (faceUv) uvs.push(xy.x / FACE.s, (xy.y - FACE.y) / FACE.s);
  };
  put(C, distToLoop(C, edge));
  for (let j = 1; j <= J; j++) {
    const rho = 1 - (1 - j / J) ** 1.7;
    for (let k = 0; k < n; k++) {
      const xy = C.clone().lerp(edge[k], rho);
      put(xy, j === J ? 0 : distToLoop(xy, edge));
    }
  }
  const idx = [];
  for (let k = 0; k < n; k++) idx.push(0, 1 + k, 1 + ((k + 1) % n));
  for (let j = 1; j < J; j++) for (let k = 0; k < n; k++) {
    const a = 1 + (j - 1) * n + k, b = 1 + (j - 1) * n + ((k + 1) % n), c = a + n, d = b + n;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  if (faceUv) g.setAttribute('faceUv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function decalGeometry(cx, cy, w, h, segX = 24, segY = 8, lift = 0.0025) {
  const g = new THREE.PlaneGeometry(w, h, segX, segY);
  const pos = g.attributes.position, nrm = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx, y = pos.getY(i) + cy;
    pos.setXYZ(i, x, y, frontZ(x, y) + lift);
    const n = surfaceNormal(thetaFor(x, y), y);
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

// A rounded ribbon that follows the shell along a path of (angle, height) control points, from the
// back (s = 0) to the front of the base (s = 1); over the back it climbs at a steady slope, so it reads as
// one straight diagonal in profile. Fitted to the canonical front reference: the band's
// centre line in the front view, turned into angles on the shell. Low on the front it is a nearly
// vertical stripe about 37 degrees from the centre line; between y = 0.5 and 0.8 it sweeps out to the
// sides, then rises a little onto the back where it ends. It narrows to a point at the front of the base.
const BAND_PATH = [[2.0, 0.965], [1.85, 0.925], [1.7, 0.885], [1.542, 0.84], [1.43, 0.8], [1.34, 0.76], [1.222, 0.7], [1.132, 0.66], [1.034, 0.62], [0.923, 0.58], [0.774, 0.54], [0.667, 0.5], [0.615, 0.46], [0.614, 0.4], [0.656, 0.3], [0.652, 0.22], [0.61, 0.16]];
const BAND = { width: 0.068, rise: 0.0065 };
const bandCurve = new THREE.CatmullRomCurve3(BAND_PATH.map(([th, y]) => new THREE.Vector3(th, y, 0)), false, 'centripetal');
// The band's frame at u (0 = back end, 1 = front of the base): centre point, surface normal N, direction T,
// across-direction B, width w and end taper.
function bandFrame(side, u) {
  const at = (v) => { const c = bandCurve.getPointAt(Math.min(1, Math.max(0, v))); return { th: c.x * side, y: c.y, p: surface(c.x * side, c.y) }; };
  const a = at(u - 0.001), b = at(u + 0.001), c = at(u);
  const T = b.p.clone().sub(a.p).normalize();
  const N = surfaceNormal(c.th, c.y);
  const B = new THREE.Vector3().crossVectors(N, T).normalize();
  // a rounded end at the back, a long point at the front of the base
  const taper = (0.25 + 0.75 * smoothstep(0.0, 0.05, u)) * (1 - 0.85 * smoothstep(0.72, 1.0, u));
  // narrower where it sweeps around the sides, fuller down the front (measured against the reference)
  const w = BAND.width * taper * (1.15 - 0.43 * smoothstep(0.47, 0.57, c.y));
  return { ...c, N, T, B, w, taper };
}

function bandGeometry(side, opts = {}) {
  const { samples = 400, across = 11 } = opts;
  const verts = [], norms = [], idx = [];
  for (let i = 0; i <= samples; i++) {
    const f = bandFrame(side, i / samples);
    for (let j = 0; j < across; j++) {
      const k = (j / (across - 1)) * 2 - 1;                    // -1..1 across the band
      const dome = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(k), 4)), 0.25);   // flat top, rounded edges
      const v = f.p.clone().addScaledVector(f.B, k * f.w * 0.5).addScaledVector(f.N, 0.0012 + BAND.rise * f.taper * dome);
      verts.push(v.x, v.y, v.z);
      // slope of the rounded cross-section tilts the normal toward the band's edges
      const slope = (BAND.rise * f.taper) / (f.w * 0.5) * (-Math.sign(k) * Math.pow(Math.abs(k), 3) / Math.max(0.2, Math.pow(dome, 3)));
      const n = f.N.clone().addScaledVector(f.B, -slope).normalize();
      norms.push(n.x, n.y, n.z);
    }
  }
  for (let i = 0; i < samples; i++) for (let j = 0; j < across - 1; j++) {
    const a = i * across + j, b = a + 1, c = a + across, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  g.setIndex(idx);
  return g;
}

// The front panel's edge: a soft cream ridge along each band's inner side, from just under the visor down
// to where the band runs out, joined by a U across the bottom of the belly (reference front and 3/4 views).
function panelEdgeGeometry(opts = {}) {
  const { width = 0.014, rise = 0.003, gap = 0.002, samples = 700, across = 13 } = opts;
  // the left band's inner edge, from y = 0.62 down to its tip, as (angle, height) points
  const side = -1, inner = [];
  let u0 = 0;
  while (u0 < 1 && bandCurve.getPointAt(u0).y > 0.62) u0 += 0.002;
  for (let u = u0; u <= 0.985; u += 0.01) {
    const f = bandFrame(side, u);
    const sgn = Math.abs(f.p.clone().addScaledVector(f.B, 0.01).x) < Math.abs(f.p.x) ? 1 : -1;
    const q = f.p.clone().addScaledVector(f.B, sgn * (f.w * 0.5 + gap));
    inner.push([thetaFor(q.x, q.y), q.y]);
  }
  const [thEnd, yEnd] = inner[inner.length - 1];
  const cup = [[thEnd * 0.82, yEnd - 0.03], [thEnd * 0.55, yEnd - 0.052], [thEnd * 0.27, yEnd - 0.062], [0, yEnd - 0.064]];
  const left = [...inner, ...cup];
  const right = left.slice(0, -1).reverse().map(([th, y]) => [-th, y]);
  const curve = new THREE.CatmullRomCurve3([...left, ...right].map(([th, y]) => new THREE.Vector3(th, y, 0)), false, 'centripetal');
  const verts = [], norms = [], cols = [], idx = [];
  const at = (v) => { const c = curve.getPointAt(Math.min(1, Math.max(0, v))); return { th: c.x, y: c.y, p: surface(c.x, c.y) }; };
  for (let i = 0; i <= samples; i++) {
    const t = i / samples, a = at(t - 0.0005), b = at(t + 0.0005), c = at(t);
    const T = b.p.clone().sub(a.p).normalize(), N = surfaceNormal(c.th, c.y);
    const B = new THREE.Vector3().crossVectors(N, T).normalize();
    const fade = smoothstep(0.0, 0.04, t) * smoothstep(1.0, 0.96, t);      // the ends sink into the shell
    // a step, not a bead: from the panel side (+B) the surface rises to a rounded crest, then drops into a
    // slight crease on the band side (-B), so the edge reads as a highlight over a shadow line
    const prof = (k) => rise * fade * (smoothstep(1.0, 0.1, k) * smoothstep(-1.0, -0.45, k) - 0.35 * smoothstep(-0.55, -1.0, k) * smoothstep(-1.0, -0.8, -k + -0.0));
    for (let j = 0; j < across; j++) {
      const k = (j / (across - 1)) * 2 - 1;
      const v = c.p.clone().addScaledVector(B, k * width * 0.5).addScaledVector(N, prof(k));
      verts.push(v.x, v.y, v.z);
      const dk = 0.02, slope = (prof(k + dk) - prof(k - dk)) / (2 * dk * width * 0.5);
      const n = N.clone().addScaledVector(B, -slope).normalize();
      norms.push(n.x, n.y, n.z);
      const shade = 1 - 0.28 * fade * smoothstep(-0.35, -0.95, k);     // the crease sits in shadow
      cols.push(shade, shade, shade);
    }
  }
  for (let i = 0; i < samples; i++) for (let j = 0; j < across - 1; j++) {
    const a = i * across + j, b = a + 1, c = a + across, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx);
  return g;
}

// Thin panel seam running down the back of the shell.
function seamGeometry(th) {
  const pts = [];
  for (let y = 0.1; y <= 1.21; y += 0.03) {
    const n = surfaceNormal(th, y);
    pts.push(surface(th, y).addScaledVector(n, -0.0015));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.0032, 6, false);
}

function textTexture(text) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 1024, 256);
  x.fillStyle = '#fff';
  x.font = '300 196px "Futura", "Century Gothic", "Avenir Next", "Segoe UI", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if ('letterSpacing' in x) x.letterSpacing = '46px';
  x.fillText(text, 512, 132);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- the character ----
export class Tavi3D {
  constructor({ era = 2026 } = {}) {
    this.root = new THREE.Group();           // world placement (position, facing)
    this.motion = new THREE.Group();         // body language (sink, tilt, tremble)
    this.body = new THREE.Group();           // deformed shell parts
    this.root.add(this.motion);
    this.motion.add(this.body);
    this.body.position.y = -0.62;            // pivot near the centre of mass
    this.motion.position.y = 0.62;

    // LED face: the face engine computes every LED's colour; the panel shader draws the dots
    this.faceCanvas = document.createElement('canvas');
    this.faceCanvas.width = this.faceCanvas.height = 4;
    this.face = new TaviFace(this.faceCanvas, { era, glass: 'mask' });
    this.ledUniforms = {
      uCells: { value: null }, uGrid: { value: new THREE.Vector2() }, uGrid0: { value: new THREE.Vector2(-GRID_X, -GRID_Y) },
      uSub: { value: 0.02 }, uDot: { value: 0.62 }, uGlow: { value: 0.85 }, uUnlit: { value: 0 }, uLedGain: { value: 1 },
    };

    const shell = deformable(makeShell());
    const orange = deformable(makeOrange());
    // free parts (paws, antenna) get undeformed copies of the materials
    this.freeMats = { shell: makeShell(), orange: makeOrange(), pad: makePad() };
    const panel = ledPanelMaterial(this.ledUniforms);
    const glass = glassMaterial();
    const gasket = deformable(new THREE.MeshPhysicalMaterial({ color: '#0d0b0a', roughness: 0.55 }));
    // the rim's skirt lies exactly on the shell, so it is pulled forward in depth to win
    const rimMat = deformable(makeShell());
    Object.assign(rimMat, { vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    // the name: engraved grey letters; reveal.name (0..1) sweeps them on left to right behind a glowing
    // front, and the letters keep an orange afterglow that fades as it runs on to 3
    this.nameReveal = { value: 3 };
    const textMat = deformable(new THREE.MeshPhysicalMaterial({
      color: '#77726d', map: textTexture('TAVI'), transparent: true, roughness: 0.45, clearcoat: 1.0,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    }), 'tvDeformName', (shader) => {
      shader.uniforms.uReveal = this.nameReveal;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uReveal;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float tvLetter = diffuseColor.a;
          float tvFront = uReveal * 1.3 - 0.15;
          diffuseColor.a *= smoothstep(tvFront + 0.06, tvFront - 0.06, vMapUv.x);
          float tvBehind = tvFront - vMapUv.x;
          float tvGlow = tvLetter * (exp(-pow(tvBehind / 0.05, 2.0)) * 2.5 + step(0.0, tvBehind) * exp(-tvBehind * 2.2) * 0.9);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(1.0, 0.42, 0.08) * 2.2 * tvGlow;`);
    });
    this.mats = { shell, orange, panel, glass, textMat };

    const outline = visorOutline();
    const bodyMesh = new THREE.Mesh(bodyGeometry(220, offsetLoop(outline, RIM.w + 0.002)), shell);
    bodyMesh.castShadow = bodyMesh.receiveShadow = true;
    this.body.add(bodyMesh);
    const rim = new THREE.Mesh(visorRimGeometry(outline), rimMat);
    rim.receiveShadow = true;
    this.body.add(rim);
    this.body.add(new THREE.Mesh(gasketGeometry(outline), gasket));
    this.panel = new THREE.Mesh(domeGeometry(outline, GLASS.panelGap, true), panel);
    this.body.add(this.panel);
    this.glass = new THREE.Mesh(domeGeometry(outline), glass);
    this.body.add(this.glass);
    const seamMat = deformable(new THREE.MeshStandardMaterial({ color: '#b9b0a6', roughness: 0.6 }));
    for (const th of [2.45, -2.45]) this.body.add(new THREE.Mesh(seamGeometry(th), seamMat));
    this.bands = [1, -1].map((side) => {
      const m = new THREE.Mesh(bandGeometry(side), orange);
      m.castShadow = true;
      this.body.add(m);
      return m;
    });
    const edgeMat = deformable(makeShell(), 'tvDeformEdge');
    Object.assign(edgeMat, { vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    this.panelEdge = new THREE.Mesh(panelEdgeGeometry(), edgeMat);
    this.panelEdge.name = 'panelEdge';
    this.body.add(this.panelEdge);
    this.text = new THREE.Mesh(decalGeometry(0, 0.5, 0.40, 0.1), textMat);
    this.body.add(this.text);
    // cap: an orange band that continues the shoulder (its lower edge tucks into the shell, so the join is
    // flush), then a low dome with a small vertical lip, as in the front reference
    const yb = CAP.band_bottom, yt = CAP.band_top, r1 = CAP.band_r, r0 = CAP.band_r_top;
    const bandPts = [new THREE.Vector2(r1 - 0.04, yb - 0.01), new THREE.Vector2(r1 + 0.006, yb - 0.01)];
    for (let i = 0; i <= 10; i++) { const t = i / 10; bandPts.push(new THREE.Vector2(r1 + (r0 + 0.002 - r1) * t, yb + (yt - 0.003 - yb) * t)); }
    for (let i = 1; i <= 6; i++) { const a2 = (i / 6) * Math.PI / 2; bandPts.push(new THREE.Vector2(r0 - 0.004 + 0.006 * Math.cos(a2), yt - 0.003 + 0.003 * Math.sin(a2))); }
    bandPts.push(new THREE.Vector2(r0 - 0.04, yt));
    const ring = new THREE.Mesh(new THREE.LatheGeometry(bandPts, 192), orange);
    ring.scale.z = DEPTH; ring.castShadow = true;
    this.body.add(ring);
    // the dome sits straight on the band's top face, tucked just below it so the join is a clean crease
    const dr = CAP.dome_r;
    const domePts = [new THREE.Vector2(dr - 0.03, yt - 0.004), new THREE.Vector2(dr, yt - 0.004)];
    for (let i = 0; i <= 32; i++) {
      const a2 = (i / 32) * Math.PI / 2;
      domePts.push(new THREE.Vector2(dr * Math.cos(a2), yt + (CAP.dome_top - yt) * Math.sin(a2)));
    }
    const dome = new THREE.Mesh(new THREE.LatheGeometry(domePts, 128), shell);
    dome.scale.z = DEPTH; dome.castShadow = true;
    this.body.add(dome);
    // base: an orange collar that flares out to meet the shell exactly, around a glowing lens
    const cyb = 0.004, cyt = 0.046, crTop = radiusAt(cyt) + 0.0015, crBot = 0.132;
    const collarPts = [new THREE.Vector2(crBot - 0.02, cyb), new THREE.Vector2(crBot - 0.004, cyb)];
    for (let i = 1; i <= 5; i++) { const a2 = -Math.PI / 2 + (i / 5) * Math.PI / 2 * 0.6; collarPts.push(new THREE.Vector2(crBot - 0.004 + 0.004 * Math.cos(a2), cyb + 0.004 + 0.004 * Math.sin(a2))); }
    for (let i = 0; i <= 10; i++) { const t = i / 10; collarPts.push(new THREE.Vector2(crBot + (crTop - crBot) * Math.pow(t, 1.25), cyb + 0.004 + (cyt - cyb - 0.004) * t)); }
    collarPts.push(new THREE.Vector2(crTop - 0.004, cyt + 0.01), new THREE.Vector2(crTop - 0.04, cyt + 0.01));
    const baseCollar = new THREE.Mesh(new THREE.LatheGeometry(collarPts, 192), orange);
    baseCollar.scale.z = DEPTH; baseCollar.castShadow = true;
    this.body.add(baseCollar);
    // the lens: a shallow convex disc whose glow runs from a cream centre to an amber rim
    const lc = document.createElement('canvas'); lc.width = lc.height = 256;
    const lx = lc.getContext('2d'), lg = lx.createRadialGradient(128, 128, 0, 128, 128, 128);
    lg.addColorStop(0, '#fff3dc'); lg.addColorStop(0.6, '#ffe6b8'); lg.addColorStop(0.9, '#ffd08c'); lg.addColorStop(1, '#ffb866');
    lx.fillStyle = lg; lx.fillRect(0, 0, 256, 256);
    const lensTex = new THREE.CanvasTexture(lc); lensTex.colorSpace = THREE.SRGBColorSpace;
    this.baseGlowMat = new THREE.MeshBasicMaterial({ map: lensTex, color: new THREE.Color(1, 1, 1).multiplyScalar(3.2) });   // bright enough to bloom
    // a lower hemisphere squashed into a lens that bulges ~0.022 below the collar
    const lensGeo = new THREE.SphereGeometry(1, 64, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const lens = new THREE.Mesh(lensGeo, this.baseGlowMat);
    const lensR = crBot - 0.006;              // fills the collar's bottom: from the side it reads as a glowing rim
    lens.scale.set(lensR, 0.03, lensR * DEPTH);
    lens.position.y = cyb + 0.002;
    this.body.add(lens);
    const hc = document.createElement('canvas'); hc.width = hc.height = 128;
    const hx = hc.getContext('2d'); const hg = hx.createRadialGradient(64, 64, 0, 64, 64, 64);
    hg.addColorStop(0, 'rgba(255,170,90,1)'); hg.addColorStop(0.35, 'rgba(255,130,50,0.35)'); hg.addColorStop(1, 'rgba(255,120,40,0)');
    hx.fillStyle = hg; hx.fillRect(0, 0, 128, 128);
    this.haloMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), this.haloMat);
    halo.rotation.x = -Math.PI / 2; halo.position.y = -0.06;
    this.body.add(halo);
    this.baseLight = new THREE.PointLight('#ff9a4a', 0.25, 0.9, 2);   // a little glow on the floor, not up the shell
    this.baseLight.position.set(0, -0.06, 0.05);
    this.body.add(this.baseLight);

    // antenna (not deformed; follows the deformed cap top)
    this.antenna = new THREE.Group();
    this.root.add(this.antenna);
    // overlay-fitted: rises with a slight lean left, then hooks right under the bulb
    const stalkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.012, 0.075, -0.012), new THREE.Vector3(-0.01, 0.145, -0.04),
      new THREE.Vector3(0.008, 0.195, -0.066), new THREE.Vector3(0.024, 0.218, -0.076)]);
    const rubber = new THREE.MeshPhysicalMaterial({ color: '#2b2522', roughness: 0.5, clearcoat: 0.3 });
    const stalk = new THREE.Mesh(new THREE.TubeGeometry(stalkCurve, 48, 0.02, 14, false), rubber);
    stalk.castShadow = true;
    this.antenna.add(stalk);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.017, 0.022, 32), this.freeMats.orange);
    collar.position.copy(stalkCurve.getPoint(1)); collar.lookAt(stalkCurve.getPoint(1).clone().add(stalkCurve.getTangent(1)));
    collar.rotateX(Math.PI / 2);
    this.antenna.add(collar);
    this.bulbMat = new THREE.MeshPhysicalMaterial({ color: '#ffe9cc', emissive: new THREE.Color('#ffc277'), emissiveIntensity: 0.7,
      roughness: 0.42, clearcoat: 1.0, clearcoatRoughness: 0.12, sheen: 0.6, sheenColor: new THREE.Color('#fff4e6') });
    this.bulb = new THREE.Mesh(new THREE.SphereGeometry(0.084, 48, 32), this.bulbMat);
    this.bulb.position.copy(stalkCurve.getPoint(1)).add(new THREE.Vector3(0.012, 0.06, -0.012));
    this.antenna.add(this.bulb);
    this.bulbLight = new THREE.PointLight('#ffcf8a', 0.35, 1.2, 2);
    this.bulbLight.position.copy(this.bulb.position);
    this.antenna.add(this.bulbLight);
    this.antennaBase = new THREE.Vector3(0, CAP.dome_top - 0.012, 0);

    // paws
    this.paws = [-1, 1].map((side) => buildPaw(side, this.freeMats));
    this.paws.forEach((p) => { p.userData.baseScale = p.scale.x; this.motion.add(p); });
    // arrivals: reveal.paws grows the paws in with a spring (0..1); the name uses this.nameReveal
    this.reveal = { paws: 1 };

    // rig state
    this.pose = { sink: 0, tiltX: 0, tiltZ: 0, turn: 0, squash: 1, bendX: 0, bendZ: 0, tremble: 0, bob: 1, bobSpeed: 1,
      droop: 0, bulb: 1, baseGlow: 1, lean: 0 };
    this.pawPose = pawRest();
    this.spring = { a: new THREE.Vector2(), v: new THREE.Vector2(), last: null };
    // name every material and mesh by its role, so exports (GLB for Blender) say what each part is
    const roles = [[shell, 'shell'], [orange, 'orange'], [panel, 'ledPanel'], [glass, 'visorGlass'], [gasket, 'gasket'],
      [rimMat, 'visorRim'], [textMat, 'lettering'], [seamMat, 'seam'], [this.baseGlowMat, 'baseGlow'], [this.haloMat, 'halo'],
      [rubber, 'antennaStalk'], [this.bulbMat, 'bulb'], [this.freeMats.shell, 'pawShell'], [this.freeMats.orange, 'pawCuff']];
    for (const [m, n] of roles) m.name = n;
    this.root.traverse((o) => { if (o.isMesh && !o.name) o.name = (Array.isArray(o.material) ? o.material[0] : o.material).name; });
    this.setEra(era);
  }

  setEra(year) { this.setEraBlend(year, year, 1); }

  // Part way from era a to era b (w = 0..1). Parts that arrive with b (bands, paws, name) are shown once
  // b has them; how far they have grown in is up to reveal.paws and nameReveal (perform.js eraAt).
  setEraBlend(a, b, w) {
    this.era = w < 0.5 ? a : b;
    this.face.blendEra(a, b, w);
    const hands = b >= 2026, name = b >= 2026, bands = Math.max(a, b) >= 2025;
    this.paws.forEach((p) => (p.visible = hands));
    this.text.visible = name;
    this.bands.forEach((band) => (band.visible = bands));
    this.panelEdge.visible = bands;
    const glowA = a >= 2027 ? 0.55 : 0, glowB = b >= 2027 ? 0.55 : 0;
    this.mats.orange.emissiveIntensity = glowA + (glowB - glowA) * w;
    this.freeMats.orange.emissiveIntensity = this.mats.orange.emissiveIntensity;
  }

  // Advance body language and the antenna spring. t = seconds, dt = frame step.
  update(t, dt, faceState) {
    const P = this.pose;
    // her float: free-running, or locked to the song's bars in performances (pose.barPos = bars elapsed).
    // Slow moods float once every two bars, calm ones once a bar, joyful ones twice.
    const wave = P.barPos === undefined ? (d) => Math.sin((t - d) * 1.6 * P.bobSpeed) : (d) => {
      const b = P.barPos - d * 0.28, w2 = smoothstep(1.2, 1.6, P.bobSpeed), wh = smoothstep(0.9, 0.6, P.bobSpeed);
      return (1 - w2 - wh) * Math.sin(2 * Math.PI * b) + w2 * Math.sin(4 * Math.PI * b) + wh * Math.sin(Math.PI * b);
    };
    const bob = wave(0) * 0.018 * P.bob;
    const tr = P.tremble;
    const jx = tr * (Math.sin(t * 47.0) * 0.6 + Math.sin(t * 31.3) * 0.4) * 0.006;
    const jy = tr * (Math.sin(t * 53.1) * 0.6 + Math.sin(t * 37.7) * 0.4) * 0.004;
    this.motion.position.set(jx, 0.62 + bob - P.sink * 0.25 + jy, P.lean * 0.15);
    this.motion.rotation.set(P.tiltX + Math.sin(t * 1.1) * 0.012, P.turn, P.tiltZ + Math.sin(t * 0.8) * 0.01);
    const breathe = 1 + Math.sin(t * 2.1) * 0.006;
    bodyUniforms.uSquash.value = P.squash * breathe;
    bodyUniforms.uBend.value.set(P.bendX, P.bendZ);
    // antenna follows the deformed cap, with a spring lag and an emotional droop
    const top = deformPoint(this.antennaBase.clone());
    const world = new THREE.Vector3(top.x, top.y - 0.62, top.z);
    const m = this.motion;
    m.updateMatrix();
    world.applyMatrix4(m.matrix);
    this.antenna.position.copy(world);
    const sp = this.spring;
    if (sp.last) {
      const vel = world.clone().sub(sp.last).divideScalar(Math.max(dt, 1e-3));
      sp.v.x += (-vel.x * 0.6 - sp.a.x * 90 - sp.v.x * 9) * dt;
      sp.v.y += (vel.z * 0.6 - sp.a.y * 90 - sp.v.y * 9) * dt;
      sp.a.addScaledVector(sp.v, dt);
    }
    sp.last = world.clone();
    this.antenna.rotation.set(m.rotation.x + sp.a.y + P.droop * 0.9, m.rotation.y, m.rotation.z + sp.a.x - P.droop * 0.25);
    // light levels
    this.bulbMat.emissiveIntensity = 0.7 * P.bulb;
    this.bulbLight.intensity = 0.35 * P.bulb;
    this.baseGlowMat.color.setScalar(3.2 * P.baseGlow);
    this.haloMat.opacity = 0.35 * P.baseGlow;
    this.baseLight.intensity = 0.25 * P.baseGlow;
    // paws
    this.paws.forEach((paw, i) => {
      const q = this.pawPose[i];
      const side = paw.userData.side;
      const fl = Math.sin(t * 1.9 + i * 1.3) * 0.012;
      // the paws ride with the body but trail its bob by a moment (follow-through, not extra bounce)
      const lag = wave(0.14 + i * 0.03) * 0.018 * P.bob;
      paw.position.set(q.x, q.y + fl + (lag - bob) * 0.7, q.z);
      const g = Math.min(1, Math.max(0, this.reveal.paws));
      const grow = g >= 1 ? 1 : 1 - Math.exp(-6 * g) * Math.cos(9 * g);
      paw.scale.setScalar(paw.userData.baseScale * Math.max(0.001, grow));
      paw.rotation.set(q.rx, q.ry + side * PAW_REST.ry, q.rz);
    });
    // face
    if (faceState) this.updateFace(faceState, t);
  }

  // The LEDs are calibrated for exposure 1.0. Like a screen on a film set, they are exposed for: pass the
  // shot's exposure and the panel compensates, so her face reads the same in every light.
  setExposure(exposure) { this.ledUniforms.uLedGain.value = 1 / exposure; }

  // Run the face engine and upload every LED's colour for the panel shader.
  updateFace(faceState, t) {
    const c = this.face.renderCells(faceState, t);
    let tex = this.ledUniforms.uCells.value;
    if (!tex || tex.image.width !== c.nx || tex.image.height !== c.ny) {
      if (tex) tex.dispose();
      tex = new THREE.DataTexture(new Uint8Array(c.nx * c.ny * 4), c.nx, c.ny, THREE.RGBAFormat, THREE.UnsignedByteType);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      this.ledUniforms.uCells.value = tex;
    }
    tex.image.data.set(c.data);
    tex.needsUpdate = true;
    const u = this.ledUniforms;
    u.uGrid.value.set(c.nx, c.ny);
    u.uSub.value = c.sub; u.uDot.value = c.dot; u.uGlow.value = c.glow; u.uUnlit.value = c.unlit;
  }
}

// Body language presets: pose deltas plus paw placements (x, y relative to the pivot, z, rotations).
export const BODY = {
  neutral:   { pose: {}, paws: null },
  lonely:    { pose: { sink: 0.35, tiltX: 0.12, turn: 0.32, squash: 0.97, bob: 0.45, bobSpeed: 0.6, droop: 0.45, bulb: 0.45, baseGlow: 0.55 },
               paws: [{ x: -0.5, y: -0.36, z: 0.0, rx: 0.3, ry: 0, rz: 0.4 }, { x: 0.5, y: -0.36, z: 0.0, rx: 0.3, ry: 0, rz: -0.4 }] },
  hopeful:   { pose: { sink: -0.15, tiltX: -0.1, lean: 0.4, bulb: 1.25, squash: 1.02 },
               paws: [{ x: -0.16, y: -0.2, z: 0.36, rx: -0.2, ry: 0.5, rz: 0.2 }, { x: 0.16, y: -0.2, z: 0.36, rx: -0.2, ry: -0.5, rz: -0.2 }] },
  // pleading: leaning in, both paws raised flat against the screen between her and the viewer, pads out,
  // either side of her face (the staging the best AI video tests found; her eyes stay in full view)
  desperate: { pose: { tiltX: -0.16, lean: 1.0, tremble: 1.0, squash: 1.03, droop: 0.1, bulb: 1.4, baseGlow: 1.3 },
               paws: [{ x: -0.5, y: 0.08, z: 0.4, rx: -0.15, ry: -0.25, rz: 0.15 }, { x: 0.5, y: 0.08, z: 0.4, rx: -0.15, ry: 0.25, rz: -0.15 }] },
  holdingBack:{ pose: { tiltX: 0.06, squash: 0.97, tremble: 0.45, bulb: 0.8 },
               paws: [{ x: -0.12, y: -0.3, z: 0.38, rx: 0.1, ry: 0.6, rz: 0.4 }, { x: 0.12, y: -0.3, z: 0.38, rx: 0.1, ry: -0.6, rz: -0.4 }] },
  // paws cupped at the sides of the visor, framing the face rather than hiding it
  crying:    { pose: { sink: 0.2, tiltX: 0.22, squash: 0.94, bendZ: 0.04, tremble: 0.6, droop: 0.6, bulb: 0.5 },
               paws: [{ x: -0.42, y: -0.06, z: 0.36, rx: -0.3, ry: 1.05, rz: 0.5 }, { x: 0.42, y: -0.06, z: 0.36, rx: -0.3, ry: -1.05, rz: -0.5 }] },
  joyful:    { pose: { sink: -0.25, tiltX: -0.08, bob: 2.2, bobSpeed: 1.6, squash: 1.04, bulb: 1.5, baseGlow: 1.5 },
               paws: [{ x: -0.62, y: 0.25, z: 0.12, rx: 0, ry: 0, rz: 0.5 }, { x: 0.62, y: 0.25, z: 0.12, rx: 0, ry: 0, rz: -0.5 }] },
  tender:    { pose: { tiltZ: 0.1, tiltX: 0.02, bulb: 1.1, bob: 0.8 },
               paws: [{ x: -0.2, y: -0.26, z: 0.34, rx: 0.2, ry: 0.4, rz: 0.3 }, { x: 0.2, y: -0.26, z: 0.34, rx: 0.2, ry: -0.4, rz: -0.3 }] },
  proud:     { pose: { tiltX: -0.08, squash: 1.05, bulb: 1.3 },
               paws: [{ x: -0.5, y: -0.12, z: 0.0, rx: 0, ry: 0, rz: 0.9 }, { x: 0.5, y: -0.12, z: 0.0, rx: 0, ry: 0, rz: -0.9 }] },
  embarrassed:{ pose: { turn: -0.35, tiltZ: -0.1, tiltX: 0.08, squash: 0.98 },
               paws: [{ x: -0.2, y: -0.34, z: 0.3, rx: 0.3, ry: 0.5, rz: 0.2 }, { x: 0.06, y: -0.34, z: 0.34, rx: 0.3, ry: -0.5, rz: -0.2 }] },
  awe:       { pose: { sink: -0.3, tiltX: -0.18, squash: 1.05, bulb: 1.6, baseGlow: 1.4 },
               paws: [{ x: -0.6, y: 0.0, z: 0.15, rx: -0.2, ry: 0, rz: 0.2 }, { x: 0.6, y: 0.0, z: 0.15, rx: -0.2, ry: 0, rz: -0.2 }] },
  resigned:  { pose: { sink: 0.45, tiltX: 0.14, squash: 0.95, bob: 0.3, bobSpeed: 0.5, droop: 0.7, bulb: 0.35, baseGlow: 0.4 },
               paws: [{ x: -0.48, y: -0.45, z: -0.02, rx: 0.4, ry: 0, rz: 0.2 }, { x: 0.48, y: -0.45, z: -0.02, rx: 0.4, ry: 0, rz: -0.2 }] },
  determined:{ pose: { tiltX: -0.06, lean: 0.3, squash: 0.98, bulb: 1.2 },
               paws: [{ x: -0.42, y: -0.08, z: 0.2, rx: -0.3, ry: 0.3, rz: 0.0 }, { x: 0.42, y: -0.08, z: 0.2, rx: -0.3, ry: -0.3, rz: 0.0 }] },
};

function pawRest() {
  const r = PAW_REST;
  return [-1, 1].map((sd) => ({ x: sd * r.x, y: r.y, z: r.z, rx: r.rx, ry: 0, rz: sd * r.rz }));
}

export function applyBody(tavi, name, k = 1) {
  const preset = BODY[name] || BODY.neutral;
  const base = { sink: 0, tiltX: 0, tiltZ: 0, turn: 0, squash: 1, bendX: 0, bendZ: 0, tremble: 0, bob: 1, bobSpeed: 1, droop: 0, bulb: 1, baseGlow: 1, lean: 0 };
  for (const key of Object.keys(base)) {
    const target = preset.pose[key] !== undefined ? preset.pose[key] : base[key];
    tavi.pose[key] = base[key] + (target - base[key]) * k;
  }
  const rest = pawRest();
  tavi.pawPose = rest.map((r, i) => {
    const tgt = preset.paws ? preset.paws[i] : r;
    const o = {};
    for (const key of Object.keys(r)) o[key] = r[key] + (tgt[key] - r[key]) * k;
    return o;
  });
}
