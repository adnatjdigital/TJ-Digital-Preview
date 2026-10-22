// Shared surface materials for Tavi. Parts that ride on the deformed shell wrap these with
// deformable() in tavi3d.js; free parts (paws, antenna) use them as they are.
import * as THREE from 'three';

// Glossy cream porcelain-like plastic: a soft base reflection under a crisp clear coat. The colour is
// a fairly neutral cream; warm studio light adds the rest (measured in the Cycles look-dev).
export function makeShell() {
  return new THREE.MeshPhysicalMaterial({
    color: '#f4efe9', roughness: 0.30, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.04, specularIntensity: 0.5,
  });
}

// Satin orange trim (bands, cap ring, cuffs, base collar): only lightly metallic, so it stays bright orange
// in a dark room instead of mirroring it.
export function makeOrange() {
  return new THREE.MeshPhysicalMaterial({
    color: '#ff7a1a', roughness: 0.16, metalness: 0.45, clearcoat: 1.0, clearcoatRoughness: 0.03,
    emissive: '#ff6a10', emissiveIntensity: 0.0,
  });
}

// Dark charcoal paw pads (toe beans and palm pad).
export function makePad() {
  return new THREE.MeshPhysicalMaterial({ color: '#3a3634', roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.2 });
}
