// Tavi's paws (from 2026 on): plump cream mittens. A palm, four toe lobes and a short wrist are blended into
// one smooth shell; charcoal beans and one oval palm pad are set into its face, and an orange cuff rings the
// wrist behind the palm. Shapes and layout are measured off the reference turnaround (refs/tavi_source;
// the front view is matched exactly, see scratch/paws for the solver).
// buildPaw() returns a group centred on the palm, facing +z (toward the viewer in the front view).
// The rig in tavi3d.js places and rotates the group; side = -1 is the paw on the viewer's left.
import * as THREE from 'three';

// Rest placement of the right paw (the left mirrors x and the turns), relative to the rig's pivot,
// which sits 0.62 above the base. rz rolls the print so the toes fan toward the upper outside, ry turns
// the palm out from facing straight ahead.
export const PAW_REST = { x: 0.545, y: -0.3155, z: 0.27, rx: 0, ry: 0.3, rz: -0.553 };

// The right paw in its own frame (x outward, y toward the toes, z out of the palm; origin = palm centre).
const PALM = [0.117, 0.117, 0.055, 0.085];             // ellipsoid radii (depth: front, back)
const BLEND = 0.03, TOE_BLEND = 0.014;                 // fillets: toes into the palm, toe against toe
const TOE_DEPTH = 0.88;                                // toes are slightly flattened front to back
const TOE_REACH = 0.012;                               // each toe runs on a little toward the palm centre
// Toe lobes, inner to outer: the tip sphere's centre and radius; and the bean on each toe: its centre
// on the paw's face as seen straight on (x, y) and its outline (semi-axes and tilt in the face plane).
const TOES = [
  { lobe: [-0.1625, 0.01, 0, 0.0627], bean: [-0.1732, -0.0095, 0.0371, 0.0324, -0.359] },
  { lobe: [-0.0664, 0.1512, 0, 0.067], bean: [-0.0788, 0.1084, 0.0394, 0.0363, 0.207] },
  { lobe: [0.0857, 0.152, 0, 0.0593], bean: [0.0679, 0.1115, 0.0367, 0.0338, -0.116] },
  { lobe: [0.1519, 0.0538, 0, 0.053], bean: [0.1353, 0.0254, 0.0316, 0.0292, -0.41] },
];
const PAD = [-0.0116, -0.0389, 0.0821, 0.0685, -0.076]; // palm pad: centre and outline, like a bean
// Cuff: a flat ring with rounded edges round a short wrist behind the palm (centre, inner and outer
// radius, depth, edge rounding). The wrist runs from the palm centre back to the ring.
const CUFF = { at: [0.0201, 0, -0.1], r0: 0.07, r1: 0.1153, depth: 0.034, edge: 0.009 };
// The back dome: centre (x outward, y, z) and radii (across, up, depth).
const BACK = [0.034, 0, -0.112, 0.106, 0.122, 0.05];

// Pads (beans and palm pad): warm charcoal, semi-gloss like moulded rubber, so the bevelled rims catch
// thin highlights; each pad sits in a near-black seam (the shadowed gap round an inset pad). Shared by
// both paws.
let sharedPadMats = null;
function padMaterials() {
  sharedPadMats ??= {
    pad: new THREE.MeshPhysicalMaterial({ color: '#2b211c', roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.22, specularIntensity: 0.6 }),
    seam: new THREE.MeshStandardMaterial({ color: '#0d0907', roughness: 0.85 }),
  };
  sharedPadMats.pad.name = 'pawPad';
  sharedPadMats.seam.name = 'pawSeam';
  return sharedPadMats;
}

// ---- the shell as a signed distance field ----
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
function ellipsoid(x, y, z, [a, b, cf, cb]) {
  const c = z > 0 ? cf : cb;
  const k0 = Math.hypot(x / a, y / b, z / c), k1 = Math.hypot(x / (a * a), y / (b * b), z / (c * c));
  return k0 * (k0 - 1) / k1;
}
// Distance from p to the segment a-b, as the offset vector (closest point to p).
function segOffset(px, py, pz, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / (dx * dx + dy * dy + dz * dz)));
  return [px - ax - t * dx, py - ay - t * dy, pz - az - t * dz];
}
function shell(x, y, z, side) {
  let toes = Infinity;
  for (const { lobe: [lx, ly, lz, lr] } of TOES) {
    // a capsule from the tip sphere toward the palm centre, flattened front to back
    const k = TOE_REACH / Math.hypot(lx, ly);
    const [ox, oy, oz] = segOffset(x, y, z, side * lx, ly, lz, side * lx * (1 - k), ly * (1 - k), lz);
    toes = smin(toes, ellipsoid(ox, oy, oz, [lr, lr, lr * TOE_DEPTH, lr * TOE_DEPTH]), TOE_BLEND);
  }
  const [cx, cy, cz] = CUFF.at;
  // the wrist runs from the palm centre most of the way to the cuff (its rounded end stays inside the back dome)
  const [wx, wy, wz] = segOffset(x, y, z, 0, 0, 0, side * cx * 0.7, cy * 0.7, cz * 0.7);
  const wrist = Math.hypot(wx, wy, wz) - CUFF.r0 - 0.002;
  // the back of the paw: a cream dome behind the cuff, set a little outward, so from behind the paw reads
  // cream with the orange cuff showing only on the side toward the body (reference back view)
  const [bx, by, bz, ba, bb, bc] = BACK;
  const back = ellipsoid(x - side * bx, y - by, z - bz, [ba, bb, bc, bc]);
  return smin(smin(smin(ellipsoid(x, y, z, PALM), wrist, BLEND), back, BLEND), toes, BLEND);
}
function gradient(f, p, e = 1e-4) {
  return new THREE.Vector3(
    f(p.x + e, p.y, p.z) - f(p.x - e, p.y, p.z), f(p.x, p.y + e, p.z) - f(p.x, p.y - e, p.z),
    f(p.x, p.y, p.z + e) - f(p.x, p.y, p.z - e)).normalize();
}
// Pull a point onto the surface along the field gradient.
function project(f, p) {
  for (let i = 0; i < 4; i++) p.addScaledVector(gradient(f, p), -f(p.x, p.y, p.z));
  return p;
}

// Surface nets: one vertex per grid cell the surface crosses, one quad per crossed grid edge; vertices are
// then projected onto the surface and shaded with the field's gradient, so the mesh is smooth and exact.
function meshField(f, lo, hi, step) {
  const n = [0, 1, 2].map((a) => Math.ceil((hi[a] - lo[a]) / step) + 1);
  const at = (i, j, k) => i + n[0] * (j + n[1] * k);
  const val = new Float32Array(n[0] * n[1] * n[2]);
  for (let k = 0; k < n[2]; k++) for (let j = 0; j < n[1]; j++) for (let i = 0; i < n[0]; i++)
    val[at(i, j, k)] = f(lo[0] + i * step, lo[1] + j * step, lo[2] + k * step);
  const cellVert = new Int32Array(val.length).fill(-1);
  const pos = [], nrm = [], idx = [];
  const p = new THREE.Vector3();
  for (let k = 0; k < n[2] - 1; k++) for (let j = 0; j < n[1] - 1; j++) for (let i = 0; i < n[0] - 1; i++) {
    let inside = 0;
    for (let c = 0; c < 8; c++) if (val[at(i + (c & 1), j + ((c >> 1) & 1), k + (c >> 2))] < 0) inside++;
    if (inside === 0 || inside === 8) continue;
    p.set(lo[0] + (i + 0.5) * step, lo[1] + (j + 0.5) * step, lo[2] + (k + 0.5) * step);
    project(f, p);
    cellVert[at(i, j, k)] = pos.length / 3;
    pos.push(p.x, p.y, p.z);
    const g = gradient(f, p);
    nrm.push(g.x, g.y, g.z);
  }
  // each grid edge with a sign change becomes a quad joining the four cells around it
  const unit = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let k = 1; k < n[2] - 1; k++) for (let j = 1; j < n[1] - 1; j++) for (let i = 1; i < n[0] - 1; i++) {
    const v0 = val[at(i, j, k)];
    for (let a = 0; a < 3; a++) {
      const [di, dj, dk] = unit[a];
      const v1 = val[at(i + di, j + dj, k + dk)];
      if ((v0 < 0) === (v1 < 0)) continue;
      const [ei, ej, ek] = unit[(a + 1) % 3], [fi, fj, fk] = unit[(a + 2) % 3];
      const q = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([s, t]) => cellVert[at(i - s * ei - t * fi, j - s * ej - t * fj, k - s * ek - t * fk)]);
      if (q.some((v) => v < 0)) continue;
      if (v0 < 0) idx.push(q[0], q[1], q[2], q[0], q[2], q[3]);
      else idx.push(q[0], q[2], q[1], q[0], q[3], q[2]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

// The shell's front surface at (x, y): march in along -z, then bisect.
function frontPoint(f, x, y) {
  let z0 = 0.2, z1 = 0.2;
  while (f(x, y, z0) > 0 && z0 > -0.2) { z1 = z0; z0 -= 0.004; }
  for (let i = 0; i < 24; i++) { const zm = (z0 + z1) / 2; if (f(x, y, zm) > 0) z1 = zm; else z0 = zm; }
  return new THREE.Vector3(x, y, (z0 + z1) / 2);
}

// The shell point seen straight down the normal n through centre + v (v in the tangent plane).
function dropOnShell(f, centre, n, v) {
  const p = new THREE.Vector3(), at = (h) => p.copy(centre).add(v).addScaledVector(n, h);
  let h0 = -0.05, h1 = 0.05;
  for (let i = 0; i < 24; i++) { const h = (h0 + h1) / 2; if (f(...at(h).toArray()) > 0) h1 = h; else h0 = h; }
  return at((h0 + h1) / 2);
}

// A pad set into the shell: an oval raised a little above the surface, flat-topped with a slight dome and
// a quarter-round rim, ringed by a thin seam lying on the shell (the crisp inset edge) whose outer lip
// tucks under the surface. Geometry groups: 0 = the pad, 1 = the seam. place(u, r) gives the surface point
// at fraction r of the radius toward the unit tangent direction u; R(u) is the radius in that direction.
function padGeometry(f, place, R, n, { rise, bevel, dome, seam, segs = 64 }) {
  const height = (r, rad) => {                     // over the surface, at fraction r of the radius
    const toRim = (1 - r) * rad, top = rise + dome * (1 - r * r);
    return toRim >= bevel ? top : top - bevel + Math.sqrt(Math.max(0, bevel * bevel - (bevel - toRim) ** 2));
  };
  // rings: fractions of the radius, then steps in from the rim (e) down the bevel; then the seam: the rim
  // foot on the surface, its outer edge, and the tuck below the surface
  const rings = [0.15, 0.3, 0.45, 0.6, 0.72, 0.82].map((r) => ({ r }));
  for (let i = 0; i <= 5; i++) rings.push({ e: bevel * (1 - i / 5) });
  const seamFrom = rings.length - 1;
  rings.push({ e: 0, h: 0.0003 }, { e: -seam, h: 0.0003 }, { e: -seam, h: -0.003 });
  const [t1, t2] = tangents(n);
  const pos = [], idx = [];
  for (const ring of rings) {
    for (let s = 0; s < segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      const u = t1.clone().multiplyScalar(Math.cos(th)).addScaledVector(t2, Math.sin(th));
      const rad = R(u), r = ring.r ?? 1 - ring.e / rad;
      const p = place(u, r);
      p.addScaledVector(gradient(f, p), ring.h ?? height(r, rad));
      pos.push(p.x, p.y, p.z);
    }
  }
  const tip = place(t1, 0).addScaledVector(n, rise + dome);
  pos.push(tip.x, tip.y, tip.z);
  const t = pos.length / 3 - 1;
  for (let s = 0; s < segs; s++) idx.push(t, s, (s + 1) % segs);
  for (let r = 0; r < rings.length - 1; r++) for (let s = 0; s < segs; s++) {
    const a = r * segs + s, b = r * segs + (s + 1) % segs, c = a + segs, d = b + segs;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const split = 3 * segs + 6 * segs * seamFrom;
  g.addGroup(0, split, 0);
  g.addGroup(split, idx.length - split, 1);
  return g;
}
// An oval pad on the paw's face at (x, y): semi-axes a, b, the first tilted by angle from level.
function facePad(f, [x, y, a, b, angle], opts) {
  const c = frontPoint(f, x, y), n = gradient(f, c);
  const [t1, t2] = tangents(n);
  const R = (u) => {
    const th = Math.atan2(u.dot(t2), u.dot(t1)) - angle;
    return 1 / Math.hypot(Math.cos(th) / a, Math.sin(th) / b);
  };
  return padGeometry(f, (u, r) => dropOnShell(f, c, n, u.clone().multiplyScalar(r * R(u))), R, n, opts);
}
// Two unit tangents to n: the first level (no y), the second toward +y.
function tangents(n) {
  const t1 = new THREE.Vector3(0, 1, 0).cross(n).normalize();
  return [t1, n.clone().cross(t1)];
}

// Flat ring with rounded edges around the z axis (lathe of a rounded rectangle).
function cuffGeometry({ r0, r1, depth, edge }) {
  const pts = [];
  const arc = (cx, cy, a0) => { for (let i = 0; i <= 6; i++) { const a = a0 + (i / 6) * Math.PI / 2; pts.push(new THREE.Vector2(cx + Math.cos(a) * edge, cy + Math.sin(a) * edge)); } };
  const h = depth / 2;
  arc(r1 - edge, -h + edge, -Math.PI / 2); arc(r1 - edge, h - edge, 0);
  arc(r0 + edge, h - edge, Math.PI / 2); arc(r0 + edge, -h + edge, Math.PI);
  pts.push(pts[0].clone());
  const g = new THREE.LatheGeometry(pts, 96);
  g.rotateX(Math.PI / 2);
  return g;
}

export function buildPaw(side, { shell: shellMat, orange }) {
  const pads = padMaterials(), padMats = [pads.pad, pads.seam];
  const g = new THREE.Group();
  const f = (x, y, z) => shell(x, y, z, side);
  // mesh the shell over a box that holds the palm, the toes and the wrist, with a cell margin
  const lo = [-PALM[0], -PALM[1], -PALM[3]], hi = [PALM[0], PALM[1], PALM[2]];
  for (const { lobe: [lx, ly, lz, lr] } of TOES) {
    lo[0] = Math.min(lo[0], -Math.abs(lx) - lr); hi[0] = Math.max(hi[0], Math.abs(lx) + lr);
    lo[1] = Math.min(lo[1], ly - lr); hi[1] = Math.max(hi[1], ly + lr); hi[2] = Math.max(hi[2], lz + lr * TOE_DEPTH);
  }
  lo[2] = Math.min(lo[2], CUFF.at[2] - CUFF.r0, BACK[2] - BACK[5]);
  lo[0] = Math.min(lo[0], -Math.abs(BACK[0]) - BACK[3]); hi[0] = Math.max(hi[0], Math.abs(BACK[0]) + BACK[3]);
  const cell = 0.0042;
  const body = new THREE.Mesh(meshField(f, lo.map((v) => v - 2 * cell), hi.map((v) => v + 2 * cell), cell), shellMat);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  // the left paw mirrors x, so its outlines' tilts flip
  const mirror = ([x, y, a, b, angle]) => [side * x, y, a, b, side * angle];
  for (const { bean } of TOES) {
    g.add(new THREE.Mesh(facePad(f, mirror(bean), { rise: 0.0045, bevel: 0.003, dome: 0.002, seam: 0.0015, segs: 48 }), padMats));
  }
  g.add(new THREE.Mesh(facePad(f, mirror(PAD), { rise: 0.006, bevel: 0.0035, dome: 0.003, seam: 0.0018 }), padMats));
  const cuff = new THREE.Mesh(cuffGeometry(CUFF), orange);
  cuff.position.set(side * CUFF.at[0], CUFF.at[1], CUFF.at[2]);
  cuff.castShadow = true;
  g.add(cuff);
  g.userData.side = side;
  return g;
}
