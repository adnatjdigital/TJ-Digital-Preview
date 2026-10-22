// Reflection environments, light rigs and the camera's response, shared by every scene.
import * as THREE from 'three';
import { FILM_GLSL } from './tavi-face.js';

// Final pass: exposure, the film shoulder (filmTone, shared with the 2D face) and sRGB. Use it as the
// composer's last pass with renderer.toneMapping = NoToneMapping.
export const FilmOutputShader = {
  name: 'FilmOutputShader',
  uniforms: { tDiffuse: { value: null }, exposure: { value: 1.0 } },
  vertexShader: `varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure; varying vec2 vUv;
    ${FILM_GLSL}
    vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb * exposure;
      gl_FragColor = vec4(toSRGB(clamp(filmTone(max(c, 0.0)), 0.0, 1.0)), 1.0);
    }`,
};

// A light box with feathered edges, so glossy reflections read as smooth gradients, not hard rectangles.
// `edge` sets how quickly the edge falls off: 3 is very soft, 10 is a crisp panel (sharp glass reflections).
const featherTex = {};
function feather(edge = 3) {
  if (featherTex[edge]) return featherTex[edge];
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const img = x.createImageData(256, 256);
  for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
    const u = Math.abs(i / 255 * 2 - 1), v = Math.abs(j / 255 * 2 - 1);
    const d = Math.max(Math.pow(u, edge), Math.pow(v, edge));
    const a = Math.max(0, 1 - d) ** 2.2;
    const k = (j * 256 + i) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(a * 255);
  }
  x.putImageData(img, 0, 0);
  featherTex[edge] = new THREE.CanvasTexture(c);
  return featherTex[edge];
}
function softbox(w, h, color, intensity, edge = 3) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(intensity), map: feather(edge), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
}
// Place a light around the subject: azimuth 0 = in front (+z), -90 = her right (the viewer's left);
// elevation in degrees above the horizon.
function place(obj, az, el, dist, target = new THREE.Vector3(0, 0.8, 0)) {
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  obj.position.set(Math.sin(a) * Math.cos(e) * dist, target.y + Math.sin(e) * dist, Math.cos(a) * Math.cos(e) * dist);
  obj.lookAt(target);
  return obj;
}

function gradientDome(top, horizon, bottom) {
  const g = new THREE.SphereGeometry(50, 64, 32);
  const cols = [];
  const pos = g.attributes.position;
  const ct = new THREE.Color(top), ch = new THREE.Color(horizon), cb = new THREE.Color(bottom);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 50;
    const c = y > 0 ? ch.clone().lerp(ct, Math.pow(y, 0.7)) : ch.clone().lerp(cb, Math.pow(-y, 0.5));
    cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
}

// Product-photography studio matched to the reference render: a dark room (so the visor glass stays
// black) with a crisp key panel high on the viewer's left (the bright crescent on the glass), tall strips
// on both sides (the long highlights down the shell's edges), a top light, a soft back rim and a little
// warm bounce from the floor.
export const STUDIO = { key: 4.5, left: 4.0, right: 3.0, top: 2.0, topEl: 60, topAz: 180, back: 1.2, fill: 0.25, wrap: 2.0, bounce: 0.25,
  // the light the visor glass reflects (glassEnvironment): position, size, strength, edge crispness
  // a soft light high on the upper left lands only on the steep top edge of the dome: a crescent at the upper
  // left in the front view, and it stays on the rim (off her face) as the camera moves round
  gAz: -60, gEl: 56, gW: 12, gH: 10, gI: 12, gEdge: 3 };
export function studioEnvironment(renderer, o = {}) {
  o = { ...STUDIO, ...o };
  const scene = new THREE.Scene();
  scene.add(gradientDome('#0f0d0c', '#090807', '#050404'));
  scene.add(place(softbox(10, 8, '#fff4e8', o.key, 9), -35, 30, 18));
  scene.add(place(softbox(3.5, 20, '#fff7ef', o.left, 9), -80, 5, 16));
  scene.add(place(softbox(3, 20, '#ffe2c4', o.right, 9), 95, 5, 16));
  scene.add(place(softbox(12, 12, '#fff6ee', o.top, 7), o.topAz, o.topEl, 16));
  scene.add(place(softbox(10, 10, '#ffe9d6', o.back, 3), 180, 25, 16));
  scene.add(place(softbox(22, 6, '#ffeedd', o.fill, 3), 10, -8, 18));
  if (o.wrap) scene.add(place(softbox(16, 16, '#fff3e6', o.wrap, 2.5), -60, 0, 16));
  const bounce = softbox(20, 20, '#ff9a55', o.bounce); bounce.position.set(0, -10, 0); bounce.lookAt(0, 0, 0); scene.add(bounce);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.0, 0.1, 100, { size: 512 }).texture;
  pmrem.dispose();
  return tex;
}

// What the visor glass reflects: the same dark room, but only a small crisp key panel (the bright crescent
// at the glass's upper left in the reference) and thin side strips (its rim lines). The big soft sources
// would wash the glass grey and hide the face, so the glass never sees them.
export function glassEnvironment(renderer, o = {}) {
  o = { ...STUDIO, ...o };
  const scene = new THREE.Scene();
  scene.add(gradientDome('#100d0b', '#0a0807', '#040303'));
  scene.add(place(softbox(o.gW, o.gH, '#fff4e8', o.gI, o.gEdge), o.gAz, o.gEl, 18));
  scene.add(place(softbox(1.6, 18, '#fff7ef', o.left * 0.5, 6), -80, 5, 16));
  scene.add(place(softbox(1.4, 18, '#ffe2c4', o.right * 0.7, 6), 95, 5, 16));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.0, 0.1, 100, { size: 512 }).texture;
  pmrem.dispose();
  return tex;
}

// Dark room whose only bright reflection is the chat window.
// `intensity` 6 lights the room; the visor glass gets a much dimmer copy (a faint ghost of the window).
export function windowEnvironment(renderer, winPos = new THREE.Vector3(-0.9, 1.15, 1.6), size = [1.6, 1.0], intensity = 6.0) {
  const scene = new THREE.Scene();
  scene.add(gradientDome('#0c0f16', '#07080b', '#030303'));
  const win = softbox(size[0] * 1.3, size[1] * 1.3, '#fff2e0', intensity);
  win.position.copy(winPos).multiplyScalar(4.0); win.lookAt(0, 0.7, 0); win.scale.setScalar(4.0); scene.add(win);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.0).texture;
  pmrem.dispose();
  return tex;
}
