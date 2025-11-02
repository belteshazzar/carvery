import { Mat4, Vec3 } from './math.js';

/**
 * Camera that orbits around a target point with spherical coordinates.
 */
export class OrbitCamera {
  /**
   * Creates a new orbit camera.
   * 
   * @param {Object} options Camera initialization options
   * @param {number[]} [options.target=[0,0,0]] Target point to orbit around
   * @param {number} [options.radius=2.3] Initial distance from target
   * @param {number} [options.minRadius=0.3] Minimum allowed radius
   * @param {number} [options.maxRadius=100] Maximum allowed radius
   * @param {number} [options.theta=0.9] Initial horizontal angle in radians
   * @param {number} [options.phi=0.9] Initial vertical angle in radians
   */
  constructor({ target = [0, 0, 0], radius = 2.3, minRadius = 0.3, maxRadius = 100, theta = 0.9, phi = 0.9 } = {}) {
    this.target = Float32Array.from(target);
    this.radius = radius;
    this.minRadius = minRadius;
    this.maxRadius = maxRadius;
    this.theta = theta;
    this.phi = phi;
    this.up = Vec3.create(0, 1, 0);
  }

  /**
   * Clamps camera parameters to valid ranges.
   * 
   * Ensures:
   * - Phi (vertical angle) between 0 and PI
   * - Radius between minRadius and maxRadius 
   * - Theta (horizontal angle) wrapped to [-PI, PI]
   */
  clamp() {
    const eps = 0.001;
    const minPhi = 0 + eps;
    const maxPhi = Math.PI - eps;

    this.phi = Math.max(minPhi, Math.min(maxPhi, this.phi));
    this.radius = Math.max(this.minRadius, Math.min(this.maxRadius, this.radius));
    if (this.theta > Math.PI) this.theta -= 2 * Math.PI;
    if (this.theta < -Math.PI) this.theta += 2 * Math.PI;
  }

  /**
   * Calculates the camera position in world space.
   * 
   * @returns {Float32Array} Camera position [x,y,z]
   */
  getEye() {
    const s = Math.sin(this.phi);
    const c = Math.cos(this.phi);
    const x = this.radius * Math.cos(this.theta) * s;
    const y = this.radius * c;
    const z = this.radius * Math.sin(this.theta) * s;

    return new Float32Array([this.target[0] + x, this.target[1] + y, this.target[2] + z]);
  }
  
  /**
   * Creates a view matrix for the current camera position.
   * 
   * @returns {Mat4} View transformation matrix
   */
  view() {
    return Mat4.lookAt(this.getEye(), this.target, this.up);
  }
}

/*** ======= Wireframe Edge Mesh ======= ***/
export function makeCubeEdges() {
  const P = new Float32Array([
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5
  ]);
  const I = new Uint16Array([0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]);
  return { positions: P, indices: I, count: I.length };
}

