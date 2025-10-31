import { Mat4, Vec3 } from './math.js';

export class OrbitCamera {

  constructor({ target = [0, 0, 0], radius = 2.3, minRadius = 0.3, maxRadius = 100, theta = 0.9, phi = 0.9 } = {}) {
    this.target = Float32Array.from(target);
    this.radius = radius;
    this.minRadius = minRadius;
    this.maxRadius = maxRadius;
    this.theta = theta;
    this.phi = phi;
    this.up = Vec3.create(0, 1, 0);
  }

  clamp() {
    const eps = 0.001,
      minPhi = 0 + eps,
      maxPhi = Math.PI - eps;
    this.phi = Math.max(minPhi, Math.min(maxPhi, this.phi));
    this.radius = Math.max(this.minRadius, Math.min(this.maxRadius, this.radius));
    if (this.theta > Math.PI) this.theta -= 2 * Math.PI;
    if (this.theta < -Math.PI) this.theta += 2 * Math.PI;
  }

  getEye() {
    const s = Math.sin(this.phi),
      c = Math.cos(this.phi);
    const x = this.radius * Math.cos(this.theta) * s,
      y = this.radius * c,
      z = this.radius * Math.sin(this.theta) * s;
    return new Float32Array([this.target[0] + x, this.target[1] + y, this.target[2] + z]);
  }
  
  view() {
    return Mat4.lookAt(this.getEye(), this.target, this.up);
  }
}

